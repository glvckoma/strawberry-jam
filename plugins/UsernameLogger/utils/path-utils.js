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
  FOUND_AJC_FILE
} = require('../constants/constants');

/**
 * Determines the base path for log files.
 * @param {Object} dispatch - The dispatch object from the application
 * @returns {string} The base path for log files, determined by the environment.
 */
function getBasePath(dispatch) {
  // Use the dataPath property from dispatch
  if (!dispatch.dataPath) {
    // Fallback or error handling if dispatch doesn't have the dataPath yet
    console.error("[Username Logger] Error: dispatch.dataPath is not available!");
    // Provide a default fallback path using strawberry-jam directory
    const fallbackPath = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'strawberry-jam', 'data');
    try {
      if (!fs.existsSync(fallbackPath)) {
        fs.mkdirSync(fallbackPath, { recursive: true });
      }
    } catch (e) { /* ignore fallback creation error */ }
    return fallbackPath;
  }
  return dispatch.dataPath;
}

/**
 * Gets file paths based on current base path.
 * @param {Object} dispatch - The dispatch object from the application
 * @returns {Object} An object containing file paths.
 */
function getFilePaths(dispatch) {
  const currentBasePath = getBasePath(dispatch);
  
  // File paths
  const paths = {
    collectedUsernamesPath: path.join(currentBasePath, COLLECTED_USERNAMES_FILE),
    processedUsernamesPath: path.join(currentBasePath, PROCESSED_FILE),
    potentialAccountsPath: path.join(currentBasePath, POTENTIAL_ACCOUNTS_FILE),
    foundAccountsPath: path.join(currentBasePath, FOUND_GENERAL_FILE),
    ajcAccountsPath: path.join(currentBasePath, FOUND_AJC_FILE)
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
