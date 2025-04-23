/**
 * @file config-model.js - Configuration model for Username Logger plugin
 * @author glvckoma
 */

const fs = require('fs').promises; // Use promises API
const path = require('path');
const { DEFAULT_CONFIG } = require('../constants/constants');

/**
 * Manages plugin configuration including loading, saving, and access
 */
class ConfigModel {
  /**
   * Creates a new configuration model
   * @param {Object} options - Configuration options
   * @param {Object} options.application - The application object for logging
   * @param {string} options.configFilePath - Path to the config file
   */
  constructor({ application, configFilePath }) {
    this.application = application;
    this.configFilePath = configFilePath;
    this.config = { ...DEFAULT_CONFIG };
    this.leakCheckLastProcessedIndex = -1;
  }

  /**
   * Loads configuration from disk
   * @returns {Promise<boolean>} True if config was loaded successfully
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
        
        // Only log detailed info in development mode
        if (process.env.NODE_ENV === 'development') {
          this.application.consoleMessage({
            type: 'logger',
            message: `[Username Logger] Loaded configuration from ${this.configFilePath}`
          });
          
          this.application.consoleMessage({
            type: 'logger',
            message: `[Username Logger] Loaded saved index: ${this.leakCheckLastProcessedIndex}`
          });
        }
        return true;
      } else {
        // If config doesn't exist, ensure index is default
        this.leakCheckLastProcessedIndex = -1;
        if (process.env.NODE_ENV === 'development') {
          this.application.consoleMessage({
            type: 'warn',
            message: `[Username Logger] Config file not found, using default index: -1`
          });
        }
        return false;
      }
    } catch (error) {
      // Only show error in development mode
      if (process.env.NODE_ENV === 'development') {
        this.application.consoleMessage({
          type: 'error',
          message: `[Username Logger] Error loading config: ${error.message}`
        });
      }
      // Ensure index is default on error
      this.leakCheckLastProcessedIndex = -1;
      return false;
    }
  }
  
  /**
   * Saves the current configuration to disk asynchronously
   * @returns {Promise<boolean>} True if saved successfully
   */
  async saveConfig() {
    try {
      // Don't save API key to config file for security
      const configToSave = {
        ...this.config,
        leakCheckLastProcessedIndex: this.leakCheckLastProcessedIndex // Add index to save data
      };
      delete configToSave.leakCheckApiKey;

      const configDir = path.dirname(this.configFilePath);
      // Ensure directory exists asynchronously
      await fs.mkdir(configDir, { recursive: true });

      // Write file asynchronously
      await fs.writeFile(this.configFilePath, JSON.stringify(configToSave, null, 2));
      
      return true;
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error saving config: ${error.message}`
      });
      return false;
    }
  }

  /**
   * Updates a specific configuration value
   * @param {string} key - The configuration key to update
   * @param {any} value - The new value
   * @returns {boolean} True if the update was valid
   */
  updateConfig(key, value) {
    if (this.config.hasOwnProperty(key)) {
      this.config[key] = value;
      return true;
    }
    return false;
  }

  /**
   * Gets the current configuration
   * @returns {Object} The current configuration object
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Gets the current leak check index
   * @returns {number} The current leak check index
   */
  getLeakCheckIndex() {
    return this.leakCheckLastProcessedIndex;
  }

  // Removed setLeakCheckIndex method

  /**
   * Resets configuration to defaults
   * @param {boolean} preserveApiKey - Whether to preserve the API key
   */
  resetConfig(preserveApiKey = true) {
    const apiKey = preserveApiKey ? this.config.leakCheckApiKey : undefined;
    this.config = { ...DEFAULT_CONFIG };
    if (preserveApiKey && apiKey) {
      this.config.leakCheckApiKey = apiKey;
    }
  }
}

module.exports = ConfigModel;
