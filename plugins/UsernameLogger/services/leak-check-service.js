/**
 * @file leak-check-service.js - Service for checking usernames against leak databases
 * @author glvckoma
 */

const { DEFAULT_BATCH_SIZE, DEFAULT_RATE_LIMIT_DELAY } = require('../constants/constants');

/**
 * Service for handling leak checking operations
 */
class LeakCheckService {
  /**
   * Creates a new leak check service
   * @param {Object} options - Service options
   * @param {Object} options.application - The application object for logging
   * @param {Object} options.fileService - The file service for file operations
   * @param {Object} options.apiService - The API service for API operations
   * @param {Object} options.configModel - The config model for accessing configuration
   * @param {Object} options.stateModel - The state model for managing state
   */
  constructor({ application, fileService, apiService, configModel, stateModel }) {
    this.application = application;
    this.fileService = fileService;
    this.apiService = apiService;
    this.configModel = configModel;
    this.stateModel = stateModel;
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
   * Runs a leak check on collected usernames
   * @param {Object} options - Options for the leak check
   * @param {number} [options.limit=Infinity] - Maximum number of usernames to process
   * @param {number} [options.startIndex] - The index to start processing from
   * @param {Function} [options.onProgress] - Progress callback
   * @returns {Promise<Object>} Results summary
   */
  async runLeakCheck(options = {}) {
    try {
      // Use a more reliable way to check for development mode
      const isDevMode = this._isDevMode();
      
      // Default options
      const limit = options.limit || Infinity;
      const startIndex = options.startIndex || (this.configModel.getLeakCheckIndex() + 1);
      const onProgress = options.onProgress || null;
      
      // For debugging
      if (isDevMode) {
        this.application.consoleMessage({
          type: 'logger',
          message: `[Username Logger] runLeakCheck called with options: ${JSON.stringify(options)}`
        });
      }

      // Prevent multiple instances from running
      if (!this.stateModel.startLeakCheck()) {
        this.application.consoleMessage({
          type: 'warn',
          message: `Username check is already running. Use !leakcheckstop to stop.`
        });
        return { success: false, error: 'Already running' };
      }

      try {
        // Get API key
        const apiKey = await this.apiService.getApiKey();
        if (!apiKey) {
          this.application.consoleMessage({
            type: 'error',
            message: `[Username Logger] Cannot perform leak check: No API key found. Use !setapikey YOUR_API_KEY to set your LeakCheck.io API key.`
          });
          this.stateModel.resetLeakCheckState();
          return { success: false, error: 'API key missing', needsApiKey: true };
        }
        
        // Debug log the API key (partly masked)
        if (apiKey.length > 8 && isDevMode) {
          const masked = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
          this.application.consoleMessage({
            type: 'logger',
            message: `[Username Logger] Using API key: ${masked}`
          });
        }

        // Get file paths from the config
        const paths = this.configModel.getFilePaths();

        // Read logged usernames from the collected usernames file
        const allUsernames = await this.fileService.readUsernamesFromLog(paths.collectedUsernamesPath);

        if (allUsernames.length === 0) {
          this.application.consoleMessage({
            type: 'notify',
            message: `[Username Logger] No usernames found in the collected usernames file.`
          });
          this.stateModel.resetLeakCheckState();
          return { success: false, error: 'No usernames found' };
        }

        // Determine usernames to process in this run
        const usernamesToCheckThisRun = allUsernames.slice(startIndex);
        const limitedUsernamesToCheck = usernamesToCheckThisRun.slice(0, limit);

        if (limitedUsernamesToCheck.length === 0) {
          this.application.consoleMessage({
            type: 'notify',
            message: `[Username Logger] No new usernames to process from the starting index.`
          });
          this.stateModel.resetLeakCheckState();
          return { success: false, error: 'No new usernames' };
        }

        this.application.consoleMessage({
          type: 'notify',
          message: `[Username Logger] Starting check from index ${startIndex}. Processing up to ${limitedUsernamesToCheck.length} usernames (limit: ${limit === Infinity ? 'All' : limit})...`
        });

        // Read already checked usernames (for duplicate output prevention)
        const processedUsernames = await this.fileService.readLinesFromFile(paths.processedUsernamesPath);
        const processedUsernamesSet = new Set(processedUsernames.map(u => u.toLowerCase()));

        // Processing loop & Batching Setup
        let processedInThisRun = 0;
        let foundCount = 0;
        let notFoundCount = 0;
        let errorCount = 0;
        let invalidCharCount = 0;
        let currentOverallIndex = startIndex - 1; // Initialize to startIndex - 1 since we increment at start of loop
        
        // Batching variables
        let processedBatch = [];
        let foundGeneralBatch = [];
        let foundAjcBatch = [];
        let potentialBatch = []; // For invalid char usernames

        // Main processing loop
        for (const username of limitedUsernamesToCheck) {
          currentOverallIndex++; // Increment index at start of loop
          processedInThisRun++;

          // Check if we should stop or pause
          if (this.stateModel.getLeakCheckState().isStopped || this.stateModel.getLeakCheckState().isPaused) {
            const action = this.stateModel.getLeakCheckState().isStopped ? 'stopped' : 'paused';
            if (isDevMode) {
              this.application.consoleMessage({
                type: 'logger',
                message: `[Username Logger] Leak check ${action} at index ${currentOverallIndex}. Writing pending batches...`
              });
            }
            
            // Write batches
            await this._writeBatches(paths, processedBatch, foundGeneralBatch, foundAjcBatch, potentialBatch);
            
            // Update the index
            this.configModel.setLeakCheckIndex(currentOverallIndex);
            await this.configModel.saveConfig();
            
            // Reset state
            this.stateModel.resetLeakCheckState();
            
            return { 
              success: true, 
              status: action,
              processed: processedInThisRun,
              found: foundCount,
              notFound: notFoundCount,
              errors: errorCount,
              invalidChar: invalidCharCount,
              lastIndexProcessed: currentOverallIndex
            };
          }

          // Skip if already in the processed list (skip duplicate processing)
          if (processedUsernamesSet.has(username.toLowerCase())) {
            if (isDevMode) {
              this.application.consoleMessage({
                type: 'logger',
                message: `[Username Logger] Skipping ${username} (already in processed list).`
              });
            }
            continue;
          }

          try {
            // Check username
            const result = await this.apiService.checkUsername(username, apiKey, DEFAULT_RATE_LIMIT_DELAY);
            let addedToProcessedList = false;

            if (result.status === 200 && result.data?.success) {
              // Handle successful response
              if (result.data.found > 0) {
                foundCount++;
                addedToProcessedList = true;
                this.application.consoleMessage({
                  type: 'logger',
                  message: `[Username Logger] Found ${result.data.found} results for: ${username}`
                });

                // Extract passwords
                const passwords = this.apiService.extractPasswordsFromResult(result);
                
                let passwordsFoundGeneral = 0;
                let passwordsFoundAjc = 0;

                for (const { password, isAjc } of passwords) {
                  const accountEntry = `${username}:${password}`;
                  
                  if (isAjc) {
                    foundAjcBatch.push(accountEntry);
                    passwordsFoundAjc++;
                  } else {
                    foundGeneralBatch.push(accountEntry);
                    passwordsFoundGeneral++;
                  }
                }

                // Log summary of found passwords
                if (passwordsFoundAjc > 0 || passwordsFoundGeneral > 0) {
                  this.application.consoleMessage({
                    type: 'logger',
                    message: `[Username Logger] Found ${passwordsFoundAjc} password(s) to save to ajc_accounts.txt and ${passwordsFoundGeneral} password(s) to save to found_accounts.txt.`
                  });
                } else {
                  this.application.consoleMessage({
                    type: 'logger',
                    message: `[Username Logger] No passwords found in results for ${username}, but breach exists.`
                  });
                }
              } else {
                notFoundCount++;
                addedToProcessedList = true;
                if (isDevMode) {
                  this.application.consoleMessage({
                    type: 'logger',
                    message: `[Username Logger] Not Found: ${username}`
                  });
                }
              }
            } else if (this.apiService.isInvalidCharactersError(result)) {
              invalidCharCount++;
              addedToProcessedList = false;
              this.application.consoleMessage({
                type: 'warn',
                message: `[Username Logger] Invalid Characters for API: ${username}. Saving for manual check.`
              });

              if (!processedUsernamesSet.has(username.toLowerCase())) {
                potentialBatch.push(username);
                processedUsernamesSet.add(username.toLowerCase());
              }
            } else {
              errorCount++;
              addedToProcessedList = false;
              this.application.consoleMessage({
                type: 'error',
                message: `[Username Logger] Unexpected API Response for ${username}: Status ${result.status} - ${JSON.stringify(result.data)}`
              });
            }

            // Add to processed batch if needed
            if (addedToProcessedList && !processedUsernamesSet.has(username.toLowerCase())) {
              if (isDevMode) {
                this.application.consoleMessage({
                  type: 'logger',
                  message: `[Username Logger] Adding ${username} to processed list.`
                });
              }
              processedBatch.push(username);
              processedUsernamesSet.add(username.toLowerCase());
              this.stateModel.addIgnoredUsername(username);
            }

            // Update progress if callback provided
            if (onProgress) {
              onProgress({
                currentIndex: currentOverallIndex,
                processedInThisRun,
                totalToProcess: limitedUsernamesToCheck.length,
                found: foundCount,
                notFound: notFoundCount,
                errors: errorCount,
                invalidChar: invalidCharCount
              });
            }

            // Write batches periodically
            if (processedInThisRun % DEFAULT_BATCH_SIZE === 0) {
              if (isDevMode) {
                this.application.consoleMessage({ 
                  type: 'logger', 
                  message: `[Username Logger] Performing periodic batch write.` 
                });
              }
              await this._writeBatches(paths, processedBatch, foundGeneralBatch, foundAjcBatch, potentialBatch);
              
              // Clear the batches
              processedBatch = [];
              foundGeneralBatch = [];
              foundAjcBatch = [];
              potentialBatch = [];
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
        if (isDevMode) {
          this.application.consoleMessage({ 
            type: 'logger', 
            message: `[Username Logger] Writing final batches...` 
          });
        }
        await this._writeBatches(paths, processedBatch, foundGeneralBatch, foundAjcBatch, potentialBatch);

        // Update the last processed index
        this.configModel.setLeakCheckIndex(currentOverallIndex);
        await this.configModel.saveConfig();

        const summary = {
          success: true,
          status: 'completed',
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

        return summary;
      } catch (innerError) {
        this.application.consoleMessage({
          type: 'error',
          message: `[Username Logger] Error in leak check: ${innerError.message}`
        });
        return { 
          success: false, 
          error: innerError.message,
          status: 'error'
        };
      } finally {
        this.stateModel.resetLeakCheckState();
      }
    } catch (outerError) {
      // Silently fail at the outermost level to prevent breaking the app
      try {
        this.stateModel.resetLeakCheckState();
        this.application.consoleMessage({
          type: 'error',
          message: `[Username Logger] Fatal plugin error: ${outerError.message}`
        });
      } catch (e) {
        // Do nothing - absolute fallback
      }
      
      return { 
        success: false, 
        error: 'Plugin error',
        status: 'error'
      };
    }
  }

  /**
   * Pauses a running leak check
   * @returns {boolean} True if state changed, false if already paused or not running
   */
  pauseLeakCheck() {
    try {
      if (this.stateModel.pauseLeakCheck()) {
        this.application.consoleMessage({
          type: 'notify',
          message: `[Username Logger] Leak check will pause after the current username is processed.`
        });
        return true;
      } else {
        this.application.consoleMessage({
          type: 'warn',
          message: `[Username Logger] No leak check is currently running.`
        });
        return false;
      }
    } catch (error) {
      // Silent fail to prevent breaking the app
      return false;
    }
  }

  /**
   * Stops a running leak check
   * @returns {boolean} True if state changed, false if already stopped or not running
   */
  stopLeakCheck() {
    try {
      if (this.stateModel.stopLeakCheck()) {
        this.application.consoleMessage({
          type: 'notify',
          message: `[Username Logger] Leak check will stop after current operation completes.`
        });
        return true;
      } else {
        this.application.consoleMessage({
          type: 'warn',
          message: `[Username Logger] No leak check is currently running.`
        });
        return false;
      }
    } catch (error) {
      // Silent fail to prevent breaking the app
      return false;
    }
  }

  /**
   * Write batches of data to respective files
   * @param {Object} paths - File paths object
   * @param {Array<string>} processedBatch - Processed usernames batch
   * @param {Array<string>} foundGeneralBatch - General found accounts batch
   * @param {Array<string>} foundAjcBatch - AJC-specific found accounts batch
   * @param {Array<string>} potentialBatch - Potential accounts batch 
   * @private
   */
  async _writeBatches(paths, processedBatch, foundGeneralBatch, foundAjcBatch, potentialBatch) {
    try {
      const writePromises = [];
      
      if (processedBatch.length > 0) {
        const isDevMode = this._isDevMode();
        if (isDevMode) {
          this.application.consoleMessage({
            type: 'logger',
            message: `[Username Logger] Writing ${processedBatch.length} usernames to processed_usernames.txt`
          });
        }
        writePromises.push(this.fileService.writeLinesToFile(
          paths.processedUsernamesPath, 
          processedBatch, 
          true
        ));
      }
      
      if (foundGeneralBatch.length > 0) {
        writePromises.push(this.fileService.writeLinesToFile(
          paths.foundAccountsPath, 
          foundGeneralBatch, 
          true
        ));
      }
      
      if (foundAjcBatch.length > 0) {
        writePromises.push(this.fileService.writeLinesToFile(
          paths.ajcAccountsPath, 
          foundAjcBatch, 
          true
        ));
      }
      
      if (potentialBatch.length > 0) {
        writePromises.push(this.fileService.writeLinesToFile(
          paths.potentialAccountsPath, 
          potentialBatch, 
          true
        ));
      }
      
      await Promise.all(writePromises);
    } catch (writeError) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Batch File Write Error: ${writeError.message}`
      });
    }
  }
}

module.exports = LeakCheckService;
