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
    // this.handleTestApiKeyCommand = this.handleTestApiKeyCommand.bind(this); // Removed
    this.handleSetIndexCommand = this.handleSetIndexCommand.bind(this);
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
      
      // Check if leak check is running
      if (this.stateModel.getLeakCheckState().isRunning) {
        this.application.consoleMessage({
          type: 'warn',
          message: `[Username Logger] Cannot trim usernames while leak check is running. Stop the check first.`
        });
        return;
      }
      
      // Trim processed usernames
      const result = await this.fileService.trimProcessedUsernames(
        collectedUsernamesPath, 
        processedIndex
      );
      
      if (result) {
        // Reset the index
        this.configModel.setLeakCheckIndex(-1);
        
        // Save the config to persist the index change
        await this.configModel.saveConfig();
        
        const isDevMode = this._isDevMode();
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
      }
    } catch (error) {
      // Silent error handling
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error trimming processed usernames: ${error.message}`
      });
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

  /**
   * Sets the leak check index directly to a specific value.
   * @param {Object} params - Command parameters.
   * @param {string[]} params.parameters - Command arguments.
   */
  handleSetIndexCommand({ parameters }) {
    try {
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
      this.configModel.setLeakCheckIndex(newIndex);
      
      // Save configuration to persist the change
      this.configModel.saveConfig();
      
      this.application.consoleMessage({
        type: 'success',
        message: `[Username Logger] Index set to ${newIndex}. Next leak check will start from index ${newIndex + 1}.`
      });
    } catch (error) {
      // Silent error handling
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error setting index: ${error.message}`
      });
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
 
       dispatch.onCommand({
         name: 'setindex',
         description: 'Sets the leak check index to a specific position. Usage: !setindex 1234',
        callback: this.handleSetIndexCommand
      });
      
      dispatch.onCommand({
        name: 'trimprocessed',
        description: 'Remove processed usernames from the collected list and reset index.',
        callback: this.handleTrimProcessedCommand
      });
    } catch (error) {
      // Silent error handling
      console.error('[Username Logger] Error registering command handlers:', error);
    }
  }
}

module.exports = CommandHandlers;
