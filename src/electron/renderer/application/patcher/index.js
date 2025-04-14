const path = require('path')
const os = require('os')
const { rename, copyFile, rm, mkdir } = require('fs/promises') // Keep only one declaration
const { existsSync } = require('fs') // Keep only one declaration
const { spawn } = require('child_process')
// Removed treeKill as it's not used in the restore logic directly
const { promisify } = require('util')
// Removed execFileAsync as we'll use spawn and handle exit differently

/**
 * Animal Jam Classic base path.
 * @constant
 */
const ANIMAL_JAM_CLASSIC_BASE_PATH = process.platform === 'win32'
  ? path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'aj-classic')
  : process.platform === 'darwin'
    ? path.join('/', 'Applications', 'AJ Classic.app', 'Contents')
    : undefined

/**
 * Animal Jam cache path.
 * @constant
 */
const ANIMAL_JAM_CLASSIC_CACHE_PATH = process.platform === 'win32'
  ? path.join(os.homedir(), 'AppData', 'Roaming', 'AJ Classic', 'Cache')
  : process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'AJ Classic', 'Cache')
    : undefined

/**
 * Path to the original app.asar file.
 * @constant
 */
const APP_ASAR_PATH = path.join(ANIMAL_JAM_CLASSIC_BASE_PATH, 'resources', 'app.asar')

/**
 * Path to the backup of the original app.asar file.
 * @constant
 */
const BACKUP_ASAR_PATH = `${APP_ASAR_PATH}.unpatched`


module.exports = class Patcher {
  /**
   * Creates an instance of the Patcher class.
   * @param {Settings} application - The application that instantiated this patcher.
   */
  constructor (application) {
    this._application = application
    this._animalJamProcess = null
  }

  /**
   * Starts Animal Jam Classic process after patching it, if necessary.
   * @returns {Promise<void>}
   */
  async killProcessAndPatch () {
    try {
      await this.patchApplication()

      const exePath = process.platform === 'win32'
        ? path.join(ANIMAL_JAM_CLASSIC_BASE_PATH, 'AJ Classic.exe')
        : process.platform === 'darwin'
          ? path.join(ANIMAL_JAM_CLASSIC_BASE_PATH, 'MacOS', 'AJ Classic')
          : undefined

      // Launch the game process using spawn for robust process tracking
      this._animalJamProcess = spawn(exePath, [], { detached: false, stdio: 'ignore' })

      // We will handle restoration on app quit, not here.
    } catch (error) {
      console.error(`Failed to start Animal Jam Classic process: ${error.message}`)
      // Attempt restore even if launch fails
      await this.restoreOriginalAsar()
    }
    // Removed finally block as restore is handled on app quit now
  }

  /**
   * Patches Animal Jam Classic application.
   * @returns {Promise<void>}
   */
  async patchApplication () {
    // Use constants defined above
    const asarPath = APP_ASAR_PATH
    const backupAsarPath = BACKUP_ASAR_PATH
    const customAsarPath = process.platform === 'win32'
      ? path.join('assets', 'winapp.asar') // Assuming assets is relative to project root
      : process.platform === 'darwin'
        ? path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', 'assets', 'osxapp.asar')
        : undefined

    try {
      process.noAsar = true
      // console.log('[Patcher] Attempting to patch application...'); // Removed log
      // console.log(`[Patcher] Original ASAR path: ${asarPath}`); // Removed log
      // console.log(`[Patcher] Backup ASAR path: ${backupAsarPath}`); // Removed log
      // console.log(`[Patcher] Custom ASAR path: ${customAsarPath}`); // Removed log

      // Backup original app.asar if it exists and backup doesn't
      const backupExists = existsSync(backupAsarPath);
      const originalExists = existsSync(asarPath);
      // console.log(`[Patcher] Backup exists? ${backupExists}`); // Removed log
      // console.log(`[Patcher] Original exists? ${originalExists}`); // Removed log

      if (!backupExists && originalExists) {
        // console.log(`[Patcher] Conditions met: Backing up original app.asar to ${backupAsarPath}`); // Removed log
        try {
          await rename(asarPath, backupAsarPath);
          // console.log(`[Patcher] Rename call successful.`); // Removed log
          // Verify immediately after rename
          // if (existsSync(backupAsarPath)) { // Removed verification log block
          //   console.log(`[Patcher] Verified backup file exists immediately after rename: ${backupAsarPath}`);
          // } else {
          //    console.error(`[Patcher] CRITICAL: Backup file NOT found immediately after rename!`);
          // }
        } catch (renameError) {
          console.error(`[Patcher] Error during rename operation for backup: ${renameError.message}`); // Keep error log
          // Decide if we should stop patching here or continue
          // For now, let's log the error and continue to copy (might overwrite)
        }
      } else if (backupExists) {
        // console.log('[Patcher] Backup app.asar already exists. Skipping backup step.'); // Removed log
      } else if (!originalExists) {
         console.warn('[Patcher] Original app.asar not found, cannot create backup.'); // Keep warning
      }

      // Copy custom asar over the original path
      // console.log(`[Patcher] Attempting to copy custom ASAR from ${customAsarPath} to ${asarPath}`); // Removed log
      try {
        await copyFile(customAsarPath, asarPath);
        // console.log(`[Patcher] Custom ASAR copy successful.`); // Removed log
      } catch (copyError) {
         console.error(`[Patcher] Error copying custom ASAR: ${copyError.message}`); // Keep error log
         // If copy fails, maybe try to restore backup immediately?
         // await this.restoreOriginalAsar(); // Consider adding this
         throw copyError; // Re-throw to indicate patching failed
      }


      // Clear cache
      // console.log(`[Patcher] Checking cache path: ${ANIMAL_JAM_CLASSIC_CACHE_PATH}`); // Removed log
      if (existsSync(ANIMAL_JAM_CLASSIC_CACHE_PATH)) {
        // console.log(`[Patcher] Cache exists. Attempting to clear...`); // Removed log
        try {
          await rm(ANIMAL_JAM_CLASSIC_CACHE_PATH, { recursive: true });
          await mkdir(ANIMAL_JAM_CLASSIC_CACHE_PATH, { recursive: true });
          // console.log(`[Patcher] Cache cleared successfully.`); // Removed log
        } catch (cacheError) {
           console.error(`[Patcher] Error clearing cache: ${cacheError.message}`); // Keep error log
        }
      } else {
        // console.log(`[Patcher] Cache path does not exist. Skipping clear.`); // Removed log
        // Why were these here? Removing them as they seem incorrect in the 'else' block.
        // await rm(ANIMAL_JAM_CLASSIC_CACHE_PATH, { recursive: true })
        // await mkdir(ANIMAL_JAM_CLASSIC_CACHE_PATH, { recursive: true })
      }
    } catch (error) {
      console.error(`Failed to patch Animal Jam Classic: ${error.message}`)
    } finally {
      process.noAsar = false
    }
  }

  /**
   * Restores the original app.asar file from backup.
   * @returns {Promise<void>}
   */
  async restoreOriginalAsar () {
    const asarPath = APP_ASAR_PATH
    const backupAsarPath = BACKUP_ASAR_PATH

    try {
      // console.log(`[Restore] Checking for backup at: ${backupAsarPath}`); // Removed log
      const backupFound = existsSync(backupAsarPath);
      // console.log(`[Restore] Backup found? ${backupFound}`); // Removed log

      // Check if backup exists before attempting restore
      if (backupFound) {
        // console.log(`[Restore] Attempting to restore original app.asar from ${backupAsarPath}`) // Removed log
        // Just rename the backup over the existing file (overwrite)
        await rename(backupAsarPath, asarPath)
        // console.log('Original app.asar restored successfully.') // Removed log
      } else {
        // console.log('No backup app.asar found to restore.') // Removed log
      }
    } catch (error) {
      console.error(`Failed to restore original app.asar: ${error.message}`)
      // Consider notifying the user here
    }
  }
}
