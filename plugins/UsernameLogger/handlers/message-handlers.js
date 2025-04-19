/**
 * @file message-handlers.js - Handles game message processing for Username Logger
 * @author glvckoma
 */

const { shouldIgnoreUsername } = require('../utils/username-utils');

/**
 * Class for handling game message processing
 */
class MessageHandlers {
  /**
   * Creates a new message handlers instance
   * @param {Object} options - Handler options
   * @param {Object} options.application - The application object for logging
   * @param {Object} options.configModel - The config model for configuration
   * @param {Object} options.stateModel - The state model for state management
   * @param {Object} options.fileService - The file service for file operations
   * @param {Object} options.batchLogger - The batch logger for console messages
   */
  constructor({ application, configModel, stateModel, fileService, batchLogger }) {
    this.application = application;
    this.configModel = configModel;
    this.stateModel = stateModel;
    this.fileService = fileService;
    this.batchLogger = batchLogger;
    
    // Bind methods to ensure 'this' context is correct
    this.handlePlayerAdd = this.handlePlayerAdd.bind(this);
    this.handleBuddyList = this.handleBuddyList.bind(this);
    this.handleBuddyAdded = this.handleBuddyAdded.bind(this);
    this.handleBuddyOnline = this.handleBuddyOnline.bind(this);
    this.logUsername = this.logUsername.bind(this);
  }

  /**
   * Logs a username to the collected usernames file.
   * @param {string} username - The username to log.
   * @param {string} source - The source of the username ('nearby' or 'buddy').
   */
  async logUsername(username, source) {
    const config = this.configModel.getConfig();
    if (!config.isLoggingEnabled) return;
    if (!username) return;
    
    // Skip collection based on source and settings
    if (source === 'nearby' && !config.collectNearbyPlayers) return;
    if (source === 'buddy' && !config.collectBuddies) return;
    
    // Skip if username should be ignored
    if (shouldIgnoreUsername(
      username, 
      this.stateModel.ignoredUsernames, 
      this.stateModel.loggedUsernamesThisSession
    )) {
      return;
    }
    
    // Add to session log to prevent duplicates
    this.stateModel.markUsernameLogged(username);
    
    // Add to console batch log
    this.batchLogger.logUsername(username, source);
    
    // Get current file paths
    const { collectedUsernamesPath } = this.configModel.getFilePaths();
    
    // Append to collected usernames file
    await this.fileService.appendUsernameToLog(collectedUsernamesPath, username);
      
    // Check if we should auto-run leak check
    if (config.autoLeakCheck && 
        this.stateModel.getLoggedUsernamesCount() >= config.autoLeakCheckThreshold) {
      this.application.consoleMessage({
        type: 'notify',
        message: `[Username Logger] Auto-running leak check after collecting ${this.stateModel.getLoggedUsernamesCount()} usernames`
      });
      
      // Reset the counter
      this.stateModel.clearLoggedUsernames();
      
      // Signal that we should run leak check (callback will be provided by the plugin)
      if (typeof this.onAutoLeakCheckTriggered === 'function') {
        this.onAutoLeakCheckTriggered();
      }
    }
  }

  /**
   * Handles the 'ac' message to extract and log added player usernames.
   * @param {Object} params - The message parameters.
   */
  handlePlayerAdd({ type, message }) {
    const config = this.configModel.getConfig();
    if (!config.isLoggingEnabled || !config.collectNearbyPlayers) return;
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
   * @param {Object} params - The message parameters.
   */
  handleBuddyList({ type, message }) {
    const config = this.configModel.getConfig();
    if (!config.isLoggingEnabled || !config.collectBuddies) return;
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
            this.logUsername(username, 'buddy');
          }
        }

        // Advance the index to start searching *after* the current UUID
        currentIndex = uuidIndex + 1;
      }
    }
  }

  /**
   * Handles the 'ba' message (buddy added) to log newly added buddies.
   * @param {Object} params - The message parameters.
   */
  handleBuddyAdded({ type, message }) {
    const config = this.configModel.getConfig();
    if (!config.isLoggingEnabled || !config.collectBuddies) return;
    if (message.constructor.name !== 'XtMessage') return;

    const rawContent = message.toMessage();
    const parts = rawContent.split('%');

    // Expected format: %xt%ba%INTERNAL_ID%username%uuid%status%...
    if (parts.length >= 7 && parts[1] === 'xt' && parts[2] === 'ba') {
      const username = parts[4];
      
      if (username) {
        this.logUsername(username, 'buddy');
      }
    }
  }

  /**
   * Handles the 'bon' message (buddy online) to log buddies coming online.
   * @param {Object} params - The message parameters.
   */
  handleBuddyOnline({ type, message }) {
    const config = this.configModel.getConfig();
    if (!config.isLoggingEnabled || !config.collectBuddies) return;
    if (message.constructor.name !== 'XtMessage') return;

    const rawContent = message.toMessage();
    const parts = rawContent.split('%');

    // Expected format: %xt%bon%INTERNAL_ID%username%...
    if (parts.length >= 5 && parts[1] === 'xt' && parts[2] === 'bon') {
      const username = parts[4];
      
      if (username) {
        this.logUsername(username, 'buddy');
      }
    }
  }

  /**
   * Sets a callback to be called when auto leak check is triggered 
   * @param {Function} callback - The callback to call
   */
  setAutoLeakCheckCallback(callback) {
    this.onAutoLeakCheckTriggered = callback;
  }

  /**
   * Registers all message handlers with the dispatch system
   * @param {Object} dispatch - The dispatch system
   */
  registerHandlers(dispatch) {
    dispatch.onMessage({
      type: 'aj',
      message: 'ac',
      callback: this.handlePlayerAdd
    });
    
    dispatch.onMessage({
      type: 'aj',
      message: 'bl',
      callback: this.handleBuddyList
    });
    
    dispatch.onMessage({
      type: 'aj',
      message: 'ba',
      callback: this.handleBuddyAdded
    });
    
    dispatch.onMessage({
      type: 'aj',
      message: 'bon',
      callback: this.handleBuddyOnline
    });
  }
}

module.exports = MessageHandlers;
