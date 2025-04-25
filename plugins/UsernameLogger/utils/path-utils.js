/**
 * @file path-utils.js - Path management utilities for Username Logger
 * @author glvckoma
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { 
  COLLECTED_USERNAMES_FILE,
  POTENTIAL_ACCOUNTS_FILE,
  PROCESSED_FILE,
  FOUND_GENERAL_FILE,
  FOUND_AJC_FILE,
  WORKING_ACCOUNTS_FILE
} = require('../constants/constants');

/**
 * Determines the base path for Username Logger specific files.
 * This should be the application's main data path (already including /data).
 * @param {string} appDataPath - The application's main data path (e.g., .../strawberry-jam/data).
 * @returns {string} The base path for Username Logger files.
 */
function getBasePath(appDataPath) {
  // The provided appDataPath should already point to the desired /data directory.
  if (!appDataPath) {
    console.error("[Username Logger] Error: getBasePath called without appDataPath!");
    return path.resolve('.', 'username_logger_data_error'); 
  }
  // Removed creation of 'UsernameLogger' subdirectory and ensureDirectoryExists call.
  // Files will be created directly in the provided appDataPath.
  return appDataPath;
}

/**
 * Gets file paths based on the provided application data path.
 * @param {string} appDataPath - The application's main data path (e.g., .../strawberry-jam/data).
 * @returns {Object} An object containing file paths directly within the dataPath.
 */
function getFilePaths(appDataPath) {
  const basePath = getBasePath(appDataPath); // Now just returns appDataPath
  
  // File paths directly within the basePath (which is the /data dir)
  const paths = {
    collectedUsernamesPath: path.join(basePath, COLLECTED_USERNAMES_FILE),
    processedUsernamesPath: path.join(basePath, PROCESSED_FILE),
    potentialAccountsPath: path.join(basePath, POTENTIAL_ACCOUNTS_FILE),
    foundAccountsPath: path.join(basePath, FOUND_GENERAL_FILE),
    ajcAccountsPath: path.join(basePath, FOUND_AJC_FILE),
    workingAccountsPath: path.join(basePath, WORKING_ACCOUNTS_FILE)
  };
  
  return paths;
}

/**
 * Ensures a directory exists, creating it if necessary.
 * @param {string} dirPath - The path to check/create
 * @returns {boolean} True if directory exists or was created, false if creation failed
 */
function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (error) {
    console.error(`[Username Logger] Error creating directory ${dirPath}: ${error.message}`);
    return false;
  }
}

module.exports = {
  getBasePath,
  getFilePaths,
  ensureDirectoryExists
};
