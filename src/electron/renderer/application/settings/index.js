const { ipcRenderer } = require('electron')
const { debounce, get: _get, set: _set } = require('lodash')

// Default values for critical settings - Include nested defaults
const DEFAULT_SETTINGS = {
  network: {
    smartfoxServer: 'lb-iss04-classic-prod.animaljam.com',
    secureConnection: true
  },
  leakCheck: {
    apiKey: '',
    outputDir: '' // Retained for potential future use, though maybe unused now
  },
  ui: { // Add ui defaults
    hideGamePlugins: false
  }
  // Add other top-level defaults as needed
}

// Development mode check (safer than process.env which may be undefined in packaged app)
const isDevelopment = typeof process !== 'undefined' &&
                      process.env &&
                      process.env.NODE_ENV === 'development';

module.exports = class Settings {
  constructor () {
    // Pre-initialize settings with defaults using deep copy
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this._isLoaded = false;
    // Use a shorter debounce for potentially quicker saves
    this._saveSettingsDebounced = debounce(this._saveSettings.bind(this), 300, { maxWait: 1000 }); 
  }

  /**
   * Loads settings from electron store via IPC
   * @returns {Promise<void>}
   * @public
   */
  async load () {
    try {
      // Initialize with a deep copy of defaults
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

      // Keys to attempt loading from the store (top-level)
      const keysToLoad = ['network', 'leakCheck', 'ui']; 

      for (const key of keysToLoad) {
        try {
          // Request the entire top-level object
          const storedValue = await ipcRenderer.invoke('get-setting', key);
          
          // If a value (even an empty object) was retrieved, merge it
          // Overwrite default sub-keys with stored sub-keys
          if (storedValue !== undefined && storedValue !== null) { 
             // Ensure we have a default object to merge into
             if (typeof this.settings[key] !== 'object' || this.settings[key] === null) {
                this.settings[key] = {};
             }
             // Merge the stored value into the default for this key
             Object.assign(this.settings[key], storedValue); 
          }
          // If nothing stored, the defaults remain
        } catch (settingError) {
          if (isDevelopment) {
            console.error(`[Settings] Error loading ${key}, using defaults:`, settingError);
          }
          // Ensure the default object exists even if loading failed
          if (this.settings[key] === undefined) {
             this.settings[key] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS[key] || {}));
          }
        }
      }

      this._isLoaded = true;
      if (isDevelopment) {
         console.log('[Settings] Settings loaded successfully:', JSON.stringify(this.settings));
      }
      // Optional: Save back immediately to ensure store consistency with defaults for missing keys
      // this._saveSettings(); 
    } catch (error) {
      if (isDevelopment) {
        console.error('[Settings] Fatal error during settings load:', error);
      }
      // Fallback to deep copy of defaults on fatal error
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      this._isLoaded = true; // Still mark as loaded
    }
  }

  /**
   * Returns the value if the given key is found.
   * Supports dot notation for nested keys.
   * @param {string} key - The setting key (e.g., 'network.secureConnection')
   * @param {any} defaultValue - The value to return if the key is not found.
   * @returns {any}
   * @public
   */
  get (key, defaultValue = undefined) { // Changed default to undefined to better distinguish missing vs false
    if (!this._isLoaded) {
      // console.warn('[Settings] Attempted to get setting before load completed. Returning default.');
       // Instead of throwing, maybe return default? Or ensure load is always awaited.
       // Let's try returning default for now, but this indicates an issue elsewhere if called too early.
       return defaultValue; 
      // throw new Error('Settings have not been loaded yet. Call `load()` first.');
    }
    // Use lodash get for nested access
    return _get(this.settings, key, defaultValue);
  }

  /**
   * Gets all settings.
   * @returns {object}
   */
  getAll () {
    if (!this._isLoaded) {
      // console.warn('[Settings] Attempted to getAll settings before load completed.');
      return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); // Return default if not loaded
      // throw new Error('Settings have not been loaded yet. Call `load()` first.');
    }
    return this.settings;
  }

  /**
   * Saves all settings (primarily for internal use or bulk updates)
   */
  setAll (settings) {
     if (!this._isLoaded) {
       console.error('[Settings] Attempted to setAll settings before load completed. Operation skipped.');
       return;
       // throw new Error('Settings have not been loaded yet. Call `load()` first.');
     }
     this.settings = settings; // Assume settings is a valid full object
     this._saveSettingsDebounced();
  }


  /**
   * Updates a setting value.
   * Supports dot notation for nested keys.
   * @param {string} key - The setting key (e.g., 'ui.hideGamePlugins')
   * @param {any} value - The new value.
   * @returns {Promise<void>}
   * @public
   */
  async update (key, value) {
    if (!this._isLoaded) {
        console.error(`[Settings] Attempted to update setting '${key}' before load completed. Update skipped.`);
        return; 
        // throw new Error('Settings have not been loaded yet. Call `load()` first.');
    }
    // Use lodash set for nested updates
    _set(this.settings, key, value);
    // Debounce saving the entire settings object
    this._saveSettingsDebounced();
  }

  /**
   * Immediately saves the *entire* settings object to electron store via IPC.
   * Note: The main process handler still saves key-by-key for now.
   * We will call set-setting for each top-level key.
   * @private
   */
  async _saveSettings () {
    if (!this._isLoaded) {
       console.error('[Settings] Attempted to save settings before load completed. Save skipped.');
       return; 
    }
    if (isDevelopment) {
      console.log('[Settings] Debounced save triggered. Saving settings:', JSON.stringify(this.settings));
    }
    try {
      // Save each top-level key object individually
      for (const key of Object.keys(DEFAULT_SETTINGS)) { // Iterate over known top-level keys
         if (this.settings.hasOwnProperty(key)) { // Check if key exists in current settings
            await ipcRenderer.invoke('set-setting', key, this.settings[key]);
         }
      }
      if (isDevelopment) {
        console.log('[Settings] Saved settings successfully via IPC');
      }
    } catch (error) {
      if (isDevelopment) {
        console.error('[Settings] Failed saving settings via IPC:', error);
      }
    }
  }
}
