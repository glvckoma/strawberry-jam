/**
 * @file migration-service.js - Handles data migration between versions
 * @author glvckoma
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { getFilePaths } = require('../utils/path-utils');

/**
 * Service for handling data migration between versions
 */
class MigrationService {
  /**
   * Creates a new migration service
   * @param {Object} options - Service options
   * @param {Object} options.application - The application object for logging
   * @param {Object} options.fileService - The file service for file operations
   * @param {Object} options.configModel - The config model for accessing configuration
   * @param {string} options.dataPath - The application data path
   */
  constructor({ application, fileService, configModel, dataPath }) {
    this.application = application;
    this.fileService = fileService;
    this.configModel = configModel;
    this.dataPath = dataPath;
  }

  /**
   * Migrates data from the old aj-classic path to the new strawberry-jam path
   * @returns {Promise<boolean>} True if migration was successful or not needed
   */
  async migrateFromOldPath() {
    // Only run migration if it hasn't been done before
    if (this.configModel.getConfig().migrationCompleted) {
      return true;
    }
    
    try {
      // Define old path
      const oldBasePath = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'aj-classic', 'data');
      
      // Check if old path exists
      if (!fsSync.existsSync(oldBasePath)) {
        // No old data to migrate
        this.configModel.updateConfig('migrationCompleted', true);
        await this.configModel.saveConfig();
        return true;
      }
      
      // Get paths using the utility function and stored dataPath
      const currentPaths = getFilePaths(this.dataPath);
      
      // Define old file paths 
      const fileNames = Object.keys(currentPaths).map(key => path.basename(currentPaths[key]));
      const oldPaths = {};
      
      fileNames.forEach(fileName => {
        oldPaths[fileName] = path.join(oldBasePath, fileName);
      });
      
      // Ensure new directory exists
      const newBasePath = path.dirname(currentPaths.collectedUsernamesPath);
      await this.fileService.ensureDirectoryExists(newBasePath);
      
      // Copy each file if it exists
      let filesCopied = 0;
      
      for (const [fileName, oldPath] of Object.entries(oldPaths)) {
        const newPath = Object.values(currentPaths).find(p => path.basename(p) === fileName);
        
        if (fsSync.existsSync(oldPath) && newPath) {
          // Read old file
          const data = await fs.readFile(oldPath, 'utf8');
          
          // Write to new location (append if file exists)
          if (fsSync.existsSync(newPath)) {
            // Append to existing file
            await fs.appendFile(newPath, '\n' + data);
          } else {
            // Create new file
            await fs.writeFile(newPath, data);
          }
          
          filesCopied++;
        }
      }
      
      if (filesCopied > 0) {
        this.application.consoleMessage({
          type: 'success',
          message: `Migrated ${filesCopied} data files from aj-classic to strawberry-jam.`
        });
      }
      
      // Mark migration as completed
      this.configModel.updateConfig('migrationCompleted', true);
      await this.configModel.saveConfig();
      
      return true;
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `Error migrating data: ${error.message}`
      });
      return false;
    }
  }

  /**
   * Loads the ignore list from processed usernames file
   * @param {Object} stateModel - The state model to populate
   * @returns {Promise<boolean>} True if successful
   */
  async loadIgnoreList(stateModel) {
    try {
      // Get paths using the utility function and stored dataPath
      const paths = getFilePaths(this.dataPath);
      let loadedCount = 0;
      
      // Load processed usernames
      if (await this.fileService.fileExists(paths.processedUsernamesPath)) {
        const processedUsernames = await this.fileService.readLinesFromFile(paths.processedUsernamesPath);
        
        for (const username of processedUsernames) {
          if (username && stateModel.addIgnoredUsername(username)) {
            loadedCount++;
          }
        }
        
        this.application.consoleMessage({
          type: 'logger',
          message: `${loadedCount} ignored usernames loaded.`
        });
      } else {
        // Create the file if it doesn't exist
        await this.fileService.writeLinesToFile(paths.processedUsernamesPath, []);
      }
      
      // Also load potential accounts as part of the ignore list
      if (await this.fileService.fileExists(paths.potentialAccountsPath)) {
        const potentialAccounts = await this.fileService.readLinesFromFile(paths.potentialAccountsPath);
        let addedFromAccounts = 0;
        
        for (const username of potentialAccounts) {
          if (username && stateModel.addIgnoredUsername(username)) {
            addedFromAccounts++;
          }
        }
        
        if (addedFromAccounts > 0) {
          this.application.consoleMessage({
            type: 'logger',
            message: `[Username Logger] Added ${addedFromAccounts} usernames from potential accounts to ignore list.`
          });
        }
      }
      
      return true;
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error loading ignore list: ${error.message}`
      });
      return false;
    }
  }
}

module.exports = MigrationService;
