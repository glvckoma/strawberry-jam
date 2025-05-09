/**
 * @file command-handlers.js - Command handlers for Username Logger
 * @author glvckoma
 */

const path = require('path');
const { getFilePaths } = require('../utils/path-utils');

/**
 * Class for handling user commands
 */
class CommandHandlers {
  /**
   * Creates a new command handlers instance
   * @param {Object} options - Handler options
   * @param {Object} options.application - The application object for logging
   * @param {Object} options.configModel - The config model for configuration
   * @param {Object} options.stateModel - The state model for state management
   * @param {Object} options.fileService - The file service for file operations
   * @param {Object} options.apiService - The API service for API operations
   * @param {Object} options.leakCheckService - The leak check service for leak checking
   * @param {string} options.dataPath - The application data path
   */
  constructor({ application, configModel, stateModel, fileService, apiService, leakCheckService, dataPath }) {
    this.application = application;
    this.configModel = configModel;
    this.stateModel = stateModel;
    this.fileService = fileService;
    this.apiService = apiService;
    this.leakCheckService = leakCheckService;
    this.dataPath = dataPath;
    
    // Bind methods to ensure 'this' context is correct
    this.handleLogCommand = this.handleLogCommand.bind(this);
    this.handleSettingsCommand = this.handleSettingsCommand.bind(this);
    this.handleLeakCheckCommand = this.handleLeakCheckCommand.bind(this);
    this.handleLeakCheckStopCommand = this.handleLeakCheckStopCommand.bind(this);
    this.handleTrimProcessedCommand = this.handleTrimProcessedCommand.bind(this);
    this.handleSetApiKeyCommand = this.handleSetApiKeyCommand.bind(this);
    this.handleUserCountCommand = this.handleUserCountCommand.bind(this);
    // this.handleTestApiKeyCommand = this.handleTestApiKeyCommand.bind(this); // Removed
    // Removed handleSetIndexCommand binding
  }

  /**
   * Detect whether we're in development mode - more reliable than process.env.NODE_ENV
   * @returns {boolean} true if in development mode
   * @private
   */
  _isDevMode() {
    try {
      // In packaged apps, app.asar will be in the path
      return !window.location.href.includes('app.asar');
    } catch (e) {
      return false;
    }
  }

  /**
   * Toggles username logging on/off.
   * @param {Object} params - Command parameters.
   * @param {string[]} params.parameters - Command arguments.
   */
  handleLogCommand({ parameters }) {
    // Simplified to just toggle on/off with no parameters
    const config = this.configModel.getConfig();
    const newValue = !config.isLoggingEnabled;
    
    this.configModel.updateConfig('isLoggingEnabled', newValue);
    this.configModel.saveConfig();
    
    this.application.consoleMessage({
      type: newValue ? 'success' : 'notify',
      message: `[Username Logger] Logging ${newValue ? 'enabled' : 'disabled'}.`
    });
  }

  /**
   * Configures which types of usernames to collect.
   * @param {Object} params - Command parameters.
   * @param {string[]} params.parameters - Command arguments.
   */
  handleSettingsCommand({ parameters }) {
    if (parameters.length === 0) {
      // Display current settings
      const config = this.configModel.getConfig();
      const paths = getFilePaths(this.dataPath);
      
      this.application.consoleMessage({
        type: 'logger',
        message: `[Username Logger] Current Settings:`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Logging: ${config.isLoggingEnabled ? 'Enabled' : 'Disabled'}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Collect Nearby Players: ${config.collectNearbyPlayers ? 'Yes' : 'No'}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Collect Buddies: ${config.collectBuddies ? 'Yes' : 'No'}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Auto Leak Check: ${config.autoLeakCheck ? 'Enabled' : 'Disabled'}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Auto Leak Check Threshold: ${config.autoLeakCheckThreshold} usernames`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Output Directory: ${path.dirname(paths.collectedUsernamesPath)}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- LeakCheck API Key: ${config.leakCheckApiKey ? 'Set' : 'Not Set'}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `Use userlogsettings [setting] [value] to change a setting.`
      });
      
      // Display detailed information about available settings
      this.application.consoleMessage({
        type: 'logger',
        message: `\nAvailable Settings:`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- [nearby] [on/off/yes/no/true/false] - Collect usernames of nearby players in rooms`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- [buddies] [on/off/yes/no/true/false] - Collect usernames from buddy list updates`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- [autoleakcheck] [on/off/yes/no/true/false] - Automatically run leak checks`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- [threshold] [positive number] - Number of new usernames before triggering auto leak check`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- [reset] - Reset all settings to default values (preserves API key)`
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
        const nearbyValue = value === 'on' || value === 'true' || value === 'yes';
        this.configModel.updateConfig('collectNearbyPlayers', nearbyValue);
        this.application.consoleMessage({
          type: 'success',
          message: `[Username Logger] Collect Nearby Players: ${nearbyValue ? 'Enabled' : 'Disabled'}`
        });
        break;
        
      case 'buddies':
        const buddiesValue = value === 'on' || value === 'true' || value === 'yes';
        this.configModel.updateConfig('collectBuddies', buddiesValue);
        this.application.consoleMessage({
          type: 'success',
          message: `[Username Logger] Collect Buddies: ${buddiesValue ? 'Enabled' : 'Disabled'}`
        });
        break;
        
      case 'autoleakcheck':
        const autoLeakCheckValue = value === 'on' || value === 'true' || value === 'yes';
        this.configModel.updateConfig('autoLeakCheck', autoLeakCheckValue);
        this.application.consoleMessage({
          type: 'success',
          message: `[Username Logger] Auto Leak Check: ${autoLeakCheckValue ? 'Enabled' : 'Disabled'}`
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
        
        this.configModel.updateConfig('autoLeakCheckThreshold', threshold);
        this.application.consoleMessage({
          type: 'success',
          message: `[Username Logger] Auto Leak Check Threshold set to ${threshold} usernames.`
        });
        break;
        
      case 'reset':
        // Reset to defaults but preserve API key
        this.configModel.resetConfig(true);
        
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
    this.configModel.saveConfig();
  }

  /**
   * Handles the leak check command.
   * @param {Object} params - Command parameters.
   * @param {string[]} params.parameters - Command arguments.
   */
  async handleLeakCheckCommand({ parameters }) {
    try {
      // Always resume from the last processed index by default
      let limit = Infinity;
      let startIndex = this.configModel.getLeakCheckIndex() + 1;
      
      const isDevMode = this._isDevMode();
      
      // Debug log the current saved index
      if (isDevMode) {
        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] Current saved index is ${this.configModel.getLeakCheckIndex()}, will start from ${startIndex}`
        });
      }
      
      if (parameters.length > 0) {
        // Only parameter accepted is a number for the limit
        const param = parameters[0].toLowerCase();
        
        if (param === 'all') {
          // Process all remaining usernames (already the default with Infinity)
          if (isDevMode) {
            this.application.consoleMessage({
              type: 'notify',
              message: `[Username Logger] Processing all remaining usernames from index ${startIndex}.`
            });
          } else {
            this.application.consoleMessage({
              type: 'notify',
              message: `[Username Logger] Processing all remaining usernames.`
            });
          }
        } else {
          // Try to parse as a number (limit)
          const num = parseInt(param, 10);
          if (isNaN(num) || num <= 0) {
            this.application.consoleMessage({
              type: 'error',
              message: `[Username Logger] Invalid parameter. Use a positive number or 'all'.`
            });
            return;
          }
          
          limit = num;
          if (isDevMode) {
            this.application.consoleMessage({
              type: 'notify',
              message: `[Username Logger] Processing up to ${limit} usernames from index ${startIndex}.`
            });
          } else {
            this.application.consoleMessage({
              type: 'notify',
              message: `[Username Logger] Processing up to ${limit} usernames.`
            });
          }
        }
      } else {
        // No parameters - default is to process all remaining
        if (isDevMode) {
          this.application.consoleMessage({
            type: 'notify',
            message: `[Username Logger] Processing all remaining usernames from index ${startIndex}.`
          });
        } else {
          this.application.consoleMessage({
            type: 'notify',
            message: `[Username Logger] Processing all remaining usernames.`
          });
        }
      }
      
      // Run the leak check with the determined parameters
      this.leakCheckService.runLeakCheck({ limit, startIndex });
    } catch (error) {
      // Silent error handling to avoid breaking the app
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error starting leak check: ${error.message}`
      });
    }
  }

  /**
   * Handles the leak check stop command.
   */
  handleLeakCheckStopCommand() {
    try {
      this.leakCheckService.stopLeakCheck();
    } catch (error) {
      // Silent error handling
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error stopping leak check: ${error.message}`
      });
    }
  }

  /**
   * Trims already processed usernames from the collected_usernames.txt file
   * and resets the index to -1 (next check will start at 0).
   */
  async handleTrimProcessedCommand() {
    try {
      const { collectedUsernamesPath } = getFilePaths(this.dataPath);
      const processedIndex = this.configModel.getLeakCheckIndex();
      const isDevMode = this._isDevMode();
      
      // Check if leak check is running
      if (this.stateModel.getLeakCheckState().isRunning) {
        this.application.consoleMessage({
          type: 'warn',
          message: `[Username Logger] Cannot trim usernames while leak check is running. Stop the check first.`
        });
        return;
      }
      
      // Show processing message
      this.application.consoleMessage({
        type: 'notify',
        message: `[Username Logger] Processing usernames for trimming... This might take a moment for large files.`
      });
      
      // Configure options for large files
      const trimOptions = {
        chunkSize: 5000,
        safeMode: true
      };
      
      if (isDevMode) {
        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] Using optimized chunked processing for large files.`
        });
      }
      
      // Trim processed usernames with enhanced options
      const result = await this.fileService.trimProcessedUsernames(
        collectedUsernamesPath, 
        processedIndex,
        trimOptions
      );
      
      if (result) {
        // Reset the index
        this.configModel.setLeakCheckIndex(-1);
        
        // Save the config to persist the index change
        const saveSuccess = await this.configModel.saveConfig();
        
        if (!saveSuccess) {
          this.application.consoleMessage({
            type: 'error',
            message: `[Username Logger] Warning: Index was reset but failed to save config. Changes may not persist.`
          });
        }
        
        if (isDevMode) {
          this.application.consoleMessage({
            type: 'success',
            message: `[Username Logger] Index reset to -1. Next leak check will start from index 0.`
          });
        } else {
          this.application.consoleMessage({
            type: 'success',
            message: `[Username Logger] Processed usernames trimmed. Next check will start from the beginning.`
          });
        }
      } else {
        this.application.consoleMessage({
          type: 'error',
          message: `[Username Logger] Failed to trim processed usernames. Check logs for details.`
        });
      }
    } catch (error) {
      // More detailed error handling
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error trimming processed usernames: ${error.message}`
      });
      
      // Log stack trace in development mode
      const isDevMode = this._isDevMode();
      if (isDevMode) {
        this.application.consoleMessage({
          type: 'error',
          message: `[Username Logger] Error stack trace: ${error.stack}`
        });
      }
    }
  }

  /**
   * Handles the set API key command.
   * @param {Object} params - Command parameters.
   * @param {string[]} params.parameters - Command arguments.
   */
  async handleSetApiKeyCommand({ parameters }) {
    try {
      if (parameters.length === 0) {
        this.application.consoleMessage({
          type: 'warn',
          message: '[Username Logger] Please specify an API key. Usage: !setapikey YOUR_API_KEY'
        });
        
        // Show guidance on how to get an API key
        this.application.consoleMessage({
          type: 'logger',
          message: '[Username Logger] You need a LeakCheck.io API key to check usernames against leak databases.'
        });
        
        return;
      }
      
      // Use the first parameter as the API key
      const apiKey = parameters[0];
      
      // Basic validation - just ensure it's a non-empty string
      if (typeof apiKey !== 'string' || apiKey.trim() === '') {
        this.application.consoleMessage({
          type: 'error',
          message: `[Username Logger] Invalid API key format. API key cannot be empty.`
        });
        return;
      }
      
      // Log what we're setting (partially masked)
      if (apiKey.length > 8) {
        const masked = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] Setting API key: ${masked}`
        });
      }
      
      // Try to set it in the application settings
      const saveResult = await this.apiService.setApiKey(apiKey);
      
      if (saveResult) {
        this.application.consoleMessage({
          type: 'success',
          message: `[Username Logger] LeakCheck API key saved successfully. You can now use !leakcheck to check usernames.`
        });
      } else {
        this.application.consoleMessage({
          type: 'error',
          message: `[Username Logger] Failed to save API key. Please try again or check application logs.`
        });
      }
    } catch (error) {
      // Silent error handling
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error setting API key: ${error.message}`
      });
    }
  }

  // Removed handleTestApiKeyCommand method

  // Removed handleSetIndexCommand method

  /**
   * Displays counts of usernames in various log files
   */
  async handleUserCountCommand() {
    try {
      const { collectedUsernamesPath, processedUsernamesPath, foundAccountsPath, ajcAccountsPath, potentialAccountsPath, workingAccountsPath } = getFilePaths(this.dataPath);
      
      // Show processing message
      this.application.consoleMessage({
        type: 'notify',
        message: `[Username Logger] Counting usernames in files...`
      });
      
      // Count usernames in each file
      const counts = {};
      
      // Get collected usernames (not yet processed)
      const collectedUsernames = await this.fileService.readUsernamesFromLog(collectedUsernamesPath);
      counts.collected = collectedUsernames.length;
      
      // Get processed usernames
      const processedUsernames = await this.fileService.readLinesFromFile(processedUsernamesPath);
      counts.processed = processedUsernames.length;
      
      // Get found accounts
      const foundAccounts = await this.fileService.readLinesFromFile(foundAccountsPath);
      counts.found = foundAccounts.length;
      
      // Get AJC-specific accounts
      const ajcAccounts = await this.fileService.readLinesFromFile(ajcAccountsPath);
      counts.ajc = ajcAccounts.length;
      
      // Get potential/invalid accounts
      const potentialAccounts = await this.fileService.readLinesFromFile(potentialAccountsPath);
      counts.potential = potentialAccounts.length;
      
      // Get working accounts
      const workingAccounts = await this.fileService.readLinesFromFile(workingAccountsPath);
      counts.working = workingAccounts.length;
      
      // Calculate total unique usernames logged
      const totalUnique = new Set([
        ...collectedUsernames,
        ...processedUsernames
      ]).size;
      
      // Display results in a structured way
      this.application.consoleMessage({
        type: 'success',
        message: `[Username Logger] Username Counts:`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Collected (not yet processed): ${counts.collected}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Processed: ${counts.processed}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Total Unique Usernames: ${totalUnique}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Found Accounts (General): ${counts.found}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Found Accounts (AJC): ${counts.ajc}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Working Accounts: ${counts.working}`
      });
      
      this.application.consoleMessage({
        type: 'logger',
        message: `- Potential Accounts (Invalid Characters): ${counts.potential}`
      });
      
      // Show current index
      const currentIndex = this.configModel.getLeakCheckIndex();
      this.application.consoleMessage({
        type: 'logger',
        message: `- Current Leak Check Index: ${currentIndex}`
      });
      
    } catch (error) {
      // Error handling
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error counting usernames: ${error.message}`
      });
      
      // Log stack trace in development mode
      const isDevMode = this._isDevMode();
      if (isDevMode) {
        this.application.consoleMessage({
          type: 'error',
          message: `[Username Logger] Error stack trace: ${error.stack}`
        });
      }
    }
  }

  /**
   * Registers all command handlers with the dispatch system
   * @param {Object} dispatch - The dispatch system
   */
  registerHandlers(dispatch) {
    try {
      dispatch.onCommand({
        name: 'userlog',
        description: 'Toggles username logging on/off.',
        callback: this.handleLogCommand
      });
      
      dispatch.onCommand({
        name: 'userlogsettings',
        description: 'Configure username logging settings. Usage: !userlogsettings [setting] [value]',
        callback: this.handleSettingsCommand
      });
      
      dispatch.onCommand({
        name: 'leakcheck',
        description: 'Run a leak check on collected usernames. Usage: !leakcheck [all|number]',
        callback: this.handleLeakCheckCommand
      });

      dispatch.onCommand({
        name: 'leakcheckstop',
        description: 'Stop a running leak check.',
        callback: this.handleLeakCheckStopCommand
      });
      
      dispatch.onCommand({
        name: 'setapikey',
        description: 'Sets the LeakCheck API key. Usage: !setapikey YOUR_API_KEY',
         callback: this.handleSetApiKeyCommand
       });
 
       // Removed testapikey command registration
 
       // Removed setindex command registration
      
      dispatch.onCommand({
        name: 'trimprocessed',
        description: 'Remove processed usernames from the collected list and reset index.',
        callback: this.handleTrimProcessedCommand
      });
      
      dispatch.onCommand({
        name: 'usercount',
        description: 'Display the number of usernames in the collected username files.',
        callback: this.handleUserCountCommand
      });
    } catch (error) {
      // Silent error handling
      console.error('[Username Logger] Error registering command handlers:', error);
    }
  }
}

module.exports = CommandHandlers;
