/**
 * @file index.js - Entry point for Username Logger plugin
 * @author glvckoma
 */

const path = require('path');

// Import modules
const ConfigModel = require('./models/config-model');
const StateModel = require('./models/state-model');
const FileService = require('./services/file-service');
const ApiService = require('./services/api-service');
const LeakCheckService = require('./services/leak-check-service');
const MigrationService = require('./services/migration-service');
const MessageHandlers = require('./handlers/message-handlers');
const CommandHandlers = require('./handlers/command-handlers');
const BatchLogger = require('./utils/batch-logger');
const { getFilePaths } = require('./utils/path-utils');

/**
 * UsernameLogger plugin for collecting and analyzing usernames
 */
class UsernameLogger {
  /**
   * Creates a new UsernameLogger instance
   * @param {Object} options - Plugin options
   * @param {Object} options.application - The application object
   * @param {Object} options.dispatch - The dispatch object
   */
  constructor({ application, dispatch }) {
    this.application = application;
    this.dispatch = dispatch;
    
    // Set up configuration
    this.configFilePath = path.resolve(process.cwd(), 'plugins', 'UsernameLogger', 'config.json');
    
    // Initialize components
    this._initializeComponents();
    
    // Initialize plugin
    this._initialize();
  }
  
  /**
   * Initializes all components and services
   * @private
   */
  _initializeComponents() {
    // Create models
    this.configModel = new ConfigModel({
      application: this.application,
      configFilePath: this.configFilePath
    });
    
    this.stateModel = new StateModel({
      application: this.application
    });
    
    // Create services
    this.fileService = new FileService({
      application: this.application
    });
    
    this.apiService = new ApiService({
      application: this.application
    });
    
    this.batchLogger = new BatchLogger({
      application: this.application
    });
    
    // Initialize config model with file paths
    this.configModel.getFilePaths = () => getFilePaths(this.dispatch);
    
    this.leakCheckService = new LeakCheckService({
      application: this.application,
      fileService: this.fileService,
      apiService: this.apiService,
      configModel: this.configModel,
      stateModel: this.stateModel
    });
    
    this.migrationService = new MigrationService({
      application: this.application,
      fileService: this.fileService,
      configModel: this.configModel
    });
    
    // Create handlers
    this.messageHandlers = new MessageHandlers({
      application: this.application,
      configModel: this.configModel,
      stateModel: this.stateModel,
      fileService: this.fileService,
      batchLogger: this.batchLogger
    });
    
    this.commandHandlers = new CommandHandlers({
      application: this.application,
      configModel: this.configModel,
      stateModel: this.stateModel,
      fileService: this.fileService,
      apiService: this.apiService,
      leakCheckService: this.leakCheckService
    });
    
    // Set up auto leak check callback
    this.messageHandlers.setAutoLeakCheckCallback(() => {
      this.leakCheckService.runLeakCheck();
    });
  }
  
  /**
   * Initializes the plugin
   * @private
   */
  async _initialize() {
    try {
      // Load configuration
      await this.configModel.loadConfig();
      
      // Run data migration if needed
      await this.migrationService.migrateFromOldPath();
      
      // Load ignore list
      await this.migrationService.loadIgnoreList(this.stateModel);
      
      // Register message handlers
      this.messageHandlers.registerHandlers(this.dispatch);
      
      // Register command handlers
      this.commandHandlers.registerHandlers(this.dispatch);
      
      // Log status
      this.application.consoleMessage({
        type: 'success',
        message: `Username logging is ${this.configModel.getConfig().isLoggingEnabled ? 'enabled' : 'disabled'}`
      });
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Initialization error: ${error.message}`
      });
    }
  }
  
  /**
   * Cleans up resources when plugin is unloaded
   */
  unload() {
    // Flush any pending log batches
    this.batchLogger.forceFlush();
    
    // If a leak check is running, try to stop it
    if (this.stateModel.getLeakCheckState().isRunning) {
      this.leakCheckService.stopLeakCheck();
    }
  }
}

module.exports = UsernameLogger;
