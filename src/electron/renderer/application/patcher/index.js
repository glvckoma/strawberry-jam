const path = require('path')
const os = require('os')
const { rename, copyFile, rm, mkdir } = require('fs/promises')
const { existsSync } = require('fs')
const { rename, copyFile, rm, mkdir } = require('fs/promises') // Added rename
const { existsSync } = require('fs')
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

      // Backup original app.asar if it exists and backup doesn't
      if (!existsSync(backupAsarPath) && existsSync(asarPath)) {
        console.log(`Backing up original app.asar to ${backupAsarPath}`)
        await rename(asarPath, backupAsarPath)
      } else if (existsSync(backupAsarPath)) {
        console.log('Backup app.asar already exists.')
      } else if (!existsSync(asarPath)) {
         console.warn('Original app.asar not found, cannot create backup.')
      }

      // Copy custom asar over the original path
      console.log(`Copying custom ASAR to ${asarPath}`)
      await copyFile(customAsarPath, asarPath)

      // Clear cache
      if (existsSync(ANIMAL_JAM_CLASSIC_CACHE_PATH)) {
        await rm(ANIMAL_JAM_CLASSIC_CACHE_PATH, { recursive: true })
        await mkdir(ANIMAL_JAM_CLASSIC_CACHE_PATH, { recursive: true })
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
      // Check if backup exists before attempting restore
      if (existsSync(backupAsarPath)) {
        console.log(`Restoring original app.asar from ${backupAsarPath}`)
        // Ensure the target path is clear before renaming backup
        if (existsSync(asarPath)) {
            await rm(asarPath); // Remove the patched asar first
        }
        await rename(backupAsarPath, asarPath)
        console.log('Original app.asar restored successfully.')
      } else {
        console.log('No backup app.asar found to restore.')
      }
    } catch (error) {
      console.error(`Failed to restore original app.asar: ${error.message}`)
      // Consider notifying the user here
    }
  }
}
