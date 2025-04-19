// Require ipcRenderer directly as contextIsolation is false
const ipcRenderer = require('electron').ipcRenderer;

/**
 * Module name
 * @type {string}
 */
exports.name = 'settings'

/**
 * Render the settings modal
 * @param {Application} app - The application instance
 * @param {Object} data - Additional data passed to the modal
 * @returns {JQuery<HTMLElement>} The rendered modal element
 */
exports.render = function (app, data = {}) {
  const $modal = $(`
    <div class="flex items-center justify-center min-h-screen">
      <!-- Modal Backdrop -->
      <div class="fixed inset-0 bg-black/50 transition-opacity"></div>
      
      <div class="relative bg-secondary-bg rounded-lg shadow-xl max-w-md w-full flex flex-col max-h-[85vh] overflow-hidden">
        <div class="flex items-center p-4 border-b border-sidebar-border flex-shrink-0">
          <h3 class="text-lg font-semibold text-text-primary">
            <i class="fas fa-cog text-highlight-yellow mr-2"></i>
            Settings
          </h3>
          <button type="button" class="ml-auto p-2 w-8 h-8 flex-shrink-0 rounded hover:bg-error-red hover:text-white text-sidebar-text focus:outline-none flex items-center justify-center" id="closeSettingsBtn">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="p-5 overflow-y-auto">
          <!-- Network Settings Content -->
          <div class="space-y-4">
            <!-- Server IP -->
            <div>
              <label for="smartfoxServer" class="block mb-2 text-sm font-medium text-text-primary">
                Server IP
              </label>
              <input id="smartfoxServer" type="text"
                class="bg-tertiary-bg text-text-primary placeholder-text-primary focus:outline-none rounded px-3 py-2 w-full"
                placeholder="lb-iss02-classic-prod.animaljam.com">
              <p class="mt-1 text-xs text-gray-400">Animal Jam server address</p>
            </div>

            <!-- Secure Connection -->
            <div class="flex items-center mt-4 bg-tertiary-bg/30 p-3 rounded mb-6">
              <input id="secureConnection" type="checkbox"
                class="w-4 h-4 bg-tertiary-bg rounded focus:ring-custom-pink">
              <label for="secureConnection" class="ml-2 text-sm text-text-primary">
                Use secure connection (SSL/TLS)
              </label>
            </div>

            <!-- LeakCheck Settings Section -->
            <div class="mt-6 pt-4 border-t border-sidebar-border space-y-4">
               <h4 class="text-md font-semibold text-text-primary mb-3">LeakCheck Settings</h4>
               <!-- LeakCheck API Key -->
               <div>
                 <label for="leakCheckApiKey" class="block mb-2 text-sm font-medium text-text-primary">
                   LeakCheck API Key
                 </label>
                 <input id="leakCheckApiKey" type="password"
                   class="bg-tertiary-bg text-text-primary placeholder-text-primary focus:outline-none rounded px-3 py-2 w-full"
                   placeholder="Enter your LeakCheck API Key">
                 <p class="mt-1 text-xs text-gray-400">Required for the leak check feature.</p>
               </div>
               <!-- Output Directory -->
               <div>
                <label for="leakCheckOutputDir" class="block mb-1 text-sm font-medium text-text-primary">
                  Output Directory
                </label>
                <div class="flex items-center space-x-2">
                  <input id="leakCheckOutputDir" type="text" readonly
                    class="flex-grow bg-tertiary-bg text-text-primary placeholder-text-primary focus:outline-none rounded px-3 py-2"
                    placeholder="Default: (Jam Project)/data/">
                  <button type="button" class="bg-sidebar-hover text-text-primary px-3 py-2 rounded hover:bg-sidebar-hover/70 transition" id="browseOutputDirBtn">
                    Browse...
                  </button>
                </div>
                 <p class="mt-1 text-xs text-gray-400">Where Leak Check result files are saved. Default is the 'data' folder in Jam's directory.</p>
               </div>
            </div>
            <!-- End LeakCheck Settings Section -->

            <!-- Danger Zone Section -->
            <div class="mt-6 pt-4 border-t border-sidebar-border space-y-4">
              <h4 class="text-md font-semibold text-red-500 mb-3">
                <i class="fas fa-exclamation-triangle mr-2"></i>Danger Zone
              </h4>

              <!-- Clear Cache Button -->
              <div>
                <button type="button" id="clearCacheBtn" class="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">
                  Clear Cache Now
                </button>
                <p class="mt-1 text-xs text-gray-400">Deletes cache for both Animal Jam Classic and Strawberry Jam. Requires app restart.</p>
              </div>

              <!-- Uninstall Button -->
              <div class="mt-4">
                <button type="button" id="uninstallBtn" class="w-full bg-red-800 text-white px-4 py-2 rounded hover:bg-red-900 transition">
                  Uninstall Strawberry Jam
                </button>
                <p class="mt-1 text-xs text-gray-400">Removes Strawberry Jam from your computer. This action is irreversible.</p>
              </div>
            </div>
            <!-- End Danger Zone Section -->

          </div>
        </div>

        <div class="flex items-center justify-end p-4 border-t border-sidebar-border flex-shrink-0">
          <button type="button" class="bg-sidebar-hover text-text-primary px-4 py-2 mr-2 rounded hover:bg-sidebar-hover/70 transition" id="cancelSettingsBtn">
            Cancel
          </button>
          <button type="button" class="bg-custom-pink text-white px-4 py-2 rounded hover:bg-custom-pink/90 transition" id="saveSettingsBtn">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  `)

  setupEventHandlers($modal, app)
  loadSettings($modal, app)
  return $modal
}

/**
 * Close handler for the settings modal
 * @param {Application} app - The application instance
 */
exports.close = function (app) {
  // Cleanup IPC listeners when modal closes (REMOVED leak-check listeners)
  // Check if ipcRenderer exists before using it
  if (typeof ipcRenderer !== 'undefined' && ipcRenderer) {
    // No leak-check specific listeners to remove anymore
  } else {
    console.warn('[Settings Close] ipcRenderer not available for cleanup.');
  }
}

/**
 * Setup event handlers for the settings modal
 * @param {JQuery<HTMLElement>} $modal - The modal element
 * @param {Application} app - The application instance
 */
function setupEventHandlers ($modal, app) {

  // --- Define Helper Functions First ---
  // REMOVED const $leakCheckStatus = $modal.find('#leakCheckStatus');
  // REMOVED const $startButton = $modal.find('#startLeakCheckBtn');
  // REMOVED const $pauseButton = $modal.find('#pauseLeakCheckBtn');
  // REMOVED const $stopButton = $modal.find('#stopLeakCheckBtn');
  const $outputDirInput = $modal.find('#leakCheckOutputDir');
  const $browseButton = $modal.find('#browseOutputDirBtn');
  const $clearCacheButton = $modal.find('#clearCacheBtn');
  const $uninstallButton = $modal.find('#uninstallBtn');
  // REMOVED $autoClearCheckbox

  // REMOVED updateButtonStates function
  // REMOVED loadInitialState function definition

  // --- Attach Core Modal Handlers ---
  $modal.find('#closeSettingsBtn, #cancelSettingsBtn').on('click', () => {
    // console.log('[Settings Modal] Close/Cancel button clicked.'); // Log removed
    app.modals.close();
  });

  $modal.find('#saveSettingsBtn').on('click', () => {
    saveSettings($modal, app)
  })
  // --- End Core Modal Handlers ---


  // --- REMOVED IPC Listeners for leak-check-progress and leak-check-result ---


  // --- Attach Button Click Handlers ---
   $browseButton.on('click', async () => {
    // Check if ipcRenderer exists before using it
    if (typeof ipcRenderer !== 'undefined' && ipcRenderer) {
      try {
        const result = await ipcRenderer.invoke('select-output-directory'); // Use direct ipcRenderer
        if (!result.canceled && result.path) {
          $outputDirInput.val(result.path);
        }
      } catch (error) {
        console.error('Error selecting output directory:', error);
        showToast('Failed to select directory', 'error');
      }
    } else {
      console.error('ipcRenderer not available for browsing directory');
      showToast('IPC Error: Cannot browse directory', 'error');
    }
  });

  // REMOVED $startButton click handler
  // REMOVED $pauseButton click handler
  // REMOVED $stopButton click handler

  // --- Danger Zone Handlers ---
  $clearCacheButton.on('click', async () => {
    const confirmed = await showConfirmationModal(
      'Clear Cache Confirmation',
      'Are you sure you want to clear the cache for both Animal Jam Classic and Strawberry Jam? This action cannot be undone. Strawberry Jam will close, and the cache will be cleared in the background. Please wait a few seconds before reopening.',
      'Close App & Clear Cache',
      'Cancel'
    );

    if (confirmed) {
      showToast('Attempting to clear cache...', 'warning');
      try {
        const result = await ipcRenderer.invoke('danger-zone:clear-cache');
        if (!result.success) {
          showToast(`Failed to clear cache: ${result.error || result.message || 'Unknown error'}`, 'error');
        }
        // No success toast needed as the app should quit if successful.
      } catch (error) {
        console.error('Error invoking clear cache:', error);
        showToast(`Error clearing cache: ${error.message}`, 'error');
      }
    }
  });

  $uninstallButton.on('click', async () => {
    const confirmed = await showConfirmationModal(
      'Uninstall Confirmation',
      'Are you absolutely sure you want to uninstall Strawberry Jam? This will remove the application and cannot be undone. Strawberry Jam will close to start the uninstaller.',
      'Close App & Uninstall',
      'Cancel'
    );

    if (confirmed) {
      showToast('Attempting to uninstall...', 'warning');
      try {
        const result = await ipcRenderer.invoke('danger-zone:uninstall');
        if (!result.success) {
          // Show error if uninstall failed to start (e.g., uninstaller not found)
           showToast(`Failed to start uninstall: ${result.error || result.message || 'Unknown error'}`, 'error');
        }
         // No success toast needed as the app should quit if successful.
      } catch (error) {
        console.error('Error invoking uninstall:', error);
        showToast(`Error starting uninstall: ${error.message}`, 'error');
      }
    }
  });

  // No handler needed for checkbox change, state is saved with "Save Changes"

  // --- End Danger Zone Handlers ---

  // --- End Button Click Handlers ---


  // --- REMOVED Call Initial State Load ---

}


/**
 * Load settings into the UI
 * @param {JQuery<HTMLElement>} $modal - The modal element
 * @param {Application} app - The application instance
 */
async function loadSettings ($modal, app) { // Made async
  try {
    // Get settings with direct IPC
    if (typeof ipcRenderer !== 'undefined' && ipcRenderer) {
      // Log the loading attempt
      console.log('[Settings] Loading settings via IPC...');
      
      // Define all settings to load 
      const settingsToLoad = [
        'smartfoxServer',
        'secureConnection',
        'leakCheckApiKey',
        'leakCheckOutputDir'
      ];
      
      // Load each setting
      for (const key of settingsToLoad) {
        try {
          const settingObj = await ipcRenderer.invoke('get-setting', key);
          console.log(`[Settings] Loaded ${key}:`, settingObj);
          
          // Handle the setting based on its type
          if (settingObj && settingObj.value !== undefined) {
            switch (key) {
              case 'smartfoxServer':
                $modal.find('#smartfoxServer').val(settingObj.value);
                break;
              case 'secureConnection':
                $modal.find('#secureConnection').prop('checked', !!settingObj.value);
                break;
              case 'leakCheckApiKey':
                $modal.find('#leakCheckApiKey').val(settingObj.value);
                break;
              case 'leakCheckOutputDir':
                $modal.find('#leakCheckOutputDir').val(settingObj.value);
                break;
            }
          } else {
            console.log(`[Settings] No value found for ${key}`);
          }
        } catch (err) {
          console.error(`[Settings] Error loading setting ${key}:`, err);
        }
      }
    } else {
      console.error('ipcRenderer not available for loading settings');
      showToast('IPC Error: Cannot load settings', 'error');
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showToast('Error loading settings', 'error');
  }
}

/**
 * Save settings from the form
 * @param {JQuery<HTMLElement>} $modal - The modal element
 * @param {Application} app - The application instance
 */
async function saveSettings ($modal, app) { // Made async
  // Check if ipcRenderer exists before using it
  const hasIpc = typeof ipcRenderer !== 'undefined' && ipcRenderer;

  try {
    let settingsSaved = true;

    // Get all settings from the form
    const settingsToSave = {
      smartfoxServer: $modal.find('#smartfoxServer').val().trim() || 'lb-iss02-classic-prod.animaljam.com',
      secureConnection: $modal.find('#secureConnection').prop('checked'),
      leakCheckApiKey: $modal.find('#leakCheckApiKey').val().trim(),
      leakCheckOutputDir: $modal.find('#leakCheckOutputDir').val().trim()
    };

    if (hasIpc) {
      try {
        // Save each setting individually via IPC to ensure proper storage in main process
        for (const [key, value] of Object.entries(settingsToSave)) {
          const result = await ipcRenderer.invoke('set-setting', key, value);
          
          if (!result || !result.success) {
            settingsSaved = false;
            console.error(`IPC Error saving ${key}:`, result?.error || 'Unknown error');
            showToast(`Error saving setting ${key}: ${result?.error || 'Unknown error'}`, 'error');
            break; // Stop on first error
          }
        }

        // Also update local settings for immediate UI use
        if (app.settings && typeof app.settings.setAll === 'function') {
          const currentSettings = app.settings.getAll() || {};
          app.settings.setAll({ ...currentSettings, ...settingsToSave });
        }
      } catch (ipcError) { // Catch errors from invoke calls
        settingsSaved = false;
        console.error('IPC Error saving settings:', ipcError);
        showToast('IPC Error: Failed to save settings', 'error');
      }
    } else {
      settingsSaved = false;
      console.error('ipcRenderer not available for saving settings');
      showToast('IPC Error: Cannot save settings', 'error');
    }

    if (settingsSaved) {
      app.modals.close();
      showToast('Settings saved successfully');
    }
    // If not saved, keep modal open for user to see error/retry

  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('Error saving settings', 'error')
  }
}

/**
 * Show a toast notification
 * @param {string} message - The message to show
 * @param {string} type - The type of notification (success, error, warning)
 */
function showToast (message, type = 'success') {
  const colors = {
    success: 'bg-highlight-green text-white',
    error: 'bg-error-red text-white',
    warning: 'bg-custom-blue text-white'
  }

  const toast = $(`<div class="fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg z-50 ${colors[type]}">${message}</div>`)
  $('body').append(toast)

  setTimeout(() => {
    toast.fadeOut(300, function () { $(this).remove() })
  }, 3000)
}

/**
 * Show a custom confirmation modal
 * @param {string} title - The modal title
 * @param {string} message - The confirmation message
 * @param {string} confirmText - Text for the confirm button
 * @param {string} cancelText - Text for the cancel button
 * @returns {Promise<boolean>} - Resolves true if confirmed, false otherwise
 */
function showConfirmationModal(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
  return new Promise((resolve) => {
    const $confirmModal = $(`
      <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 confirmation-modal">
        <div class="relative bg-secondary-bg rounded-lg shadow-xl max-w-sm w-full">
          <div class="p-5 text-center">
            <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
            <h3 class="text-lg font-semibold text-text-primary mb-2">${title}</h3>
            <p class="text-sm text-gray-400 mb-6">${message}</p>
            <div class="flex justify-center gap-4">
              <button type="button" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition" id="confirmCancelBtn">${cancelText}</button>
              <button type="button" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition" id="confirmActionBtn">${confirmText}</button>
            </div>
          </div>
        </div>
      </div>
    `);

    $confirmModal.find('#confirmCancelBtn').on('click', () => {
      $confirmModal.remove();
      resolve(false);
    });

    $confirmModal.find('#confirmActionBtn').on('click', () => {
      $confirmModal.remove();
      resolve(true);
    });

    $('body').append($confirmModal);
  });
}