/**
 * @file file-service.js - File operations for Username Logger
 * @author glvckoma
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { createLogEntry, extractUsernameFromLogLine } = require('../utils/username-utils');

/**
 * Service for handling file operations
 */
class FileService {
  /**
   * Creates a new file service instance
   * @param {Object} options - Service options
   * @param {Object} options.application - The application object for logging
   */
  constructor({ application }) {
    this.application = application;
  }

  /**
   * Ensures a directory exists
   * @param {string} dirPath - The directory path to check/create
   * @returns {Promise<boolean>} True if successful
   */
  async ensureDirectoryExists(dirPath) {
    try {
      if (!fsSync.existsSync(dirPath)) {
        await fs.mkdir(dirPath, { recursive: true });
      }
      return true;
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error creating directory ${dirPath}: ${error.message}`
      });
      return false;
    }
  }

  /**
   * Appends a username entry to the log file
   * @param {string} filePath - Path to the log file
   * @param {string} username - Username to log
   * @returns {Promise<boolean>} True if successful
   */
  async appendUsernameToLog(filePath, username) {
    try {
      await this.ensureDirectoryExists(path.dirname(filePath));
      const logEntry = createLogEntry(username);
      await fs.appendFile(filePath, logEntry);
      return true;
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error writing to log file: ${error.message}`
      });
      return false;
    }
  }

  /**
   * Reads usernames from a log file
   * @param {string} filePath - Path to the log file
   * @returns {Promise<Array<string>>} Array of unique usernames
   */
  async readUsernamesFromLog(filePath) {
    try {
      if (!fsSync.existsSync(filePath)) {
        return [];
      }

      const content = await fs.readFile(filePath, 'utf8');
      const uniqueUsernames = new Set();

      content.split(/\r?\n/).forEach(line => {
        const username = extractUsernameFromLogLine(line);
        if (username) {
          uniqueUsernames.add(username);
        }
      });

      return [...uniqueUsernames];
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error reading from log file: ${error.message}`
      });
      return [];
    }
  }

  /**
   * Reads usernames with original lines from a log file
   * @param {string} filePath - Path to the log file
   * @returns {Promise<Array<{line: string, username: string}>>} Array of username entries with original lines
   */
  async readUsernameEntriesFromLog(filePath) {
    try {
      if (!fsSync.existsSync(filePath)) {
        return [];
      }

      const content = await fs.readFile(filePath, 'utf8');
      const entries = [];

      content.split(/\r?\n/).forEach(line => {
        const username = extractUsernameFromLogLine(line);
        if (username) {
          entries.push({
            line,
            username
          });
        }
      });

      return entries;
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error reading from log file: ${error.message}`
      });
      return [];
    }
  }

  /**
   * Writes an array of lines to a file
   * @param {string} filePath - Path to the file
   * @param {Array<string>} lines - Lines to write
   * @param {boolean} [append=false] - Whether to append to existing content
   * @returns {Promise<boolean>} True if successful
   */
  async writeLinesToFile(filePath, lines, append = false) {
    try {
      await this.ensureDirectoryExists(path.dirname(filePath));
      const content = lines.join('\n') + (lines.length > 0 ? '\n' : '');
      
      if (append) {
        await fs.appendFile(filePath, content);
      } else {
        await fs.writeFile(filePath, content);
      }
      
      return true;
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error writing to file ${filePath}: ${error.message}`
      });
      return false;
    }
  }

  /**
   * Reads lines from a file
   * @param {string} filePath - Path to the file
   * @returns {Promise<Array<string>>} Array of lines
   */
  async readLinesFromFile(filePath) {
    try {
      if (!fsSync.existsSync(filePath)) {
        return [];
      }

      const content = await fs.readFile(filePath, 'utf8');
      return content.split(/\r?\n/).filter(line => line.trim());
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error reading from file ${filePath}: ${error.message}`
      });
      return [];
    }
  }

  /**
   * Checks if a file exists
   * @param {string} filePath - Path to the file
   * @returns {Promise<boolean>} True if the file exists
   */
  async fileExists(filePath) {
    try {
      return fsSync.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Batch appends multiple usernames to the log file
   * @param {string} filePath - Path to the log file
   * @param {Array<string>} usernames - Usernames to log
   * @returns {Promise<boolean>} True if successful
   */
  async batchAppendUsernames(filePath, usernames) {
    if (!usernames || usernames.length === 0) {
      return true;
    }

    try {
      await this.ensureDirectoryExists(path.dirname(filePath));
      const logEntries = usernames.map(username => createLogEntry(username).trim());
      await fs.appendFile(filePath, logEntries.join('\n') + '\n');
      return true;
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error batch writing to log file: ${error.message}`
      });
      return false;
    }
  }

  /**
   * Trims processed usernames from a log file
   * @param {string} logFilePath - Path to the log file
   * @param {number} processedIndex - Index up to which usernames have been processed
   * @returns {Promise<boolean>} True if successful
   */
  async trimProcessedUsernames(logFilePath, processedIndex) {
    try {
      const entries = await this.readUsernameEntriesFromLog(logFilePath);
      
      if (entries.length === 0) {
        this.application.consoleMessage({
          type: 'warn',
          message: `[Username Logger] No usernames found in collected file.`
        });
        return false;
      }

      // Keep only the entries beyond the processed index
      if (processedIndex < 0) {
        this.application.consoleMessage({
          type: 'warn',
          message: `[Username Logger] No usernames have been processed yet (index = ${processedIndex}).`
        });
        return false;
      }

      if (processedIndex >= entries.length) {
        // Clear the file completely
        await fs.writeFile(logFilePath, '');
        return true;
      } else {
        // Keep only the non-processed usernames
        const keepEntries = entries.slice(processedIndex + 1);
        const keepLines = keepEntries.map(entry => entry.line);
        
        await fs.writeFile(logFilePath, keepLines.join('\n') + (keepLines.length > 0 ? '\n' : ''));
        return true;
      }
    } catch (error) {
      this.application.consoleMessage({
        type: 'error',
        message: `[Username Logger] Error trimming processed usernames: ${error.message}`
      });
      return false;
    }
  }
}

module.exports = FileService;
