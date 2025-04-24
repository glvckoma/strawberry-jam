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
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"></div>
      
      <div class="relative bg-secondary-bg rounded-lg shadow-xl max-w-md w-full flex flex-col max-h-[85vh] overflow-hidden">
        <!-- Modal Header -->
        <div class="flex items-center p-4 border-b border-sidebar-border flex-shrink-0">
          <h3 class="text-lg font-semibold text-text-primary">
            <i class="fas fa-cog text-highlight-yellow mr-2"></i>
            Settings
          </h3>
          <button type="button" class="ml-auto text-gray-400 transition-colors duration-200 transform rounded-full p-1" id="closeSettingsBtn" aria-label="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Tab Bar -->
        <div class="flex border-b border-sidebar-border flex-shrink-0 px-2 pt-2">
          <button type="button" class="settings-tab active-tab px-4 py-2 text-sm font-medium text-text-primary border-b-2 border-[var(--theme-primary)] focus:outline-none" data-tab="connection">
            Connection
          </button>
          <button type="button" class="settings-tab px-4 py-2 text-sm font-medium text-sidebar-text border-b-2 border-transparent hover:text-text-primary hover:border-gray-500 focus:outline-none" data-tab="plugins">
            Plugins
          </button>
          <button type="button" class="settings-tab px-4 py-2 text-sm font-medium text-sidebar-text border-b-2 border-transparent hover:text-text-primary hover:border-gray-500 focus:outline-none" data-tab="leakcheck">
            LeakCheck
          </button>
          <button type="button" class="settings-tab px-4 py-2 text-sm font-medium text-sidebar-text border-b-2 border-transparent hover:text-text-primary hover:border-gray-500 focus:outline-none" data-tab="advanced">
            Advanced
          </button>
        </div>

        <!-- Tab Content Area -->
        <div class="p-5 overflow-y-auto flex-grow">

          <!-- Connection Tab Content -->
          <div id="connectionTabContent" class="settings-tab-content space-y-4">
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
            <div class="flex items-center mt-4 bg-tertiary-bg/30 p-3 rounded">
              <input id="secureConnection" type="checkbox"
                class="w-4 h-4 bg-tertiary-bg rounded focus:ring-custom-pink">
              <label for="secureConnection" class="ml-2 text-sm text-text-primary">
                Use secure connection (SSL/TLS)
              </label>
            </div>
          </div>
          <!-- End Connection Tab Content -->

          <!-- Plugins Tab Content -->
          <div id="pluginsTabContent" class="settings-tab-content space-y-4 hidden">
            <!-- Hide Game Plugins Option -->
            <div class="flex items-center mt-4 bg-tertiary-bg/30 p-3 rounded">
              <input id="hideGamePlugins" type="checkbox"
                class="w-4 h-4 bg-tertiary-bg rounded focus:ring-custom-pink text-custom-pink">
              <label for="hideGamePlugins" class="ml-2 text-sm text-text-primary">
                Hide Game Plugins in Sidebar
              </label>
            </div>
             <p class="mt-1 text-xs text-gray-400">If checked, plugins marked as 'game' type will not appear in the sidebar list.</p>
          </div>
          <!-- End Plugins Tab Content -->

          <!-- LeakCheck Tab Content -->
          <div id="leakcheckTabContent" class="settings-tab-content space-y-4 hidden">
             <!-- LeakCheck API Key -->
             <div>
               <label for="leakCheckApiKey" class="block mb-2 text-sm font-medium text-text-primary">
                 LeakCheck API Key
               </label>
               <input id="leakCheckApiKey" type="password"
                 class="bg-tertiary-bg text-text-primary placeholder-text-primary focus:outline-none rounded px-3 py-2 w-full"
                 placeholder="Enter LeakCheck API Key">
               <p class="mt-1 text-xs text-gray-400"><span class="font-semibold text-highlight-yellow">Requires a LeakCheck.io Pro subscription.</span></p>
             </div>
             <!-- Output Directory Button -->
             <div class="mt-2">
               <button type="button" id="openOutputDirBtn" class="w-full bg-sidebar-hover text-text-primary px-4 py-2 rounded hover:bg-sidebar-hover/70 transition">
                 <i class="fas fa-folder-open mr-2"></i>Open Output Directory
               </button>
               <p class="mt-1 text-xs text-gray-400\">Location where Leak Check results and other data files are saved.</p>
             </div>
          </div>
          <!-- End LeakCheck Tab Content -->

          <!-- Advanced Tab Content (Danger Zone) -->
          <div id="advancedTabContent" class="settings-tab-content space-y-4 hidden">
            <h4 class="text-md font-semibold text-red-500 mb-3">
              <i class="fas fa-exclamation-triangle mr-2\"></i>Danger Zone
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
          <!-- End Advanced Tab Content -->

        </div>

        <!-- Modal Footer -->
        <div class="flex items-center justify-end p-4 border-t border-sidebar-border flex-shrink-0">
          <button type="button" class="bg-sidebar-hover text-text-primary px-4 py-2 mr-2 rounded hover:bg-sidebar-hover/70 transition" id="cancelSettingsBtn">
            Cancel
          </button>
          <button type="button" class="bg-[var(--theme-primary)] text-white px-4 py-2 rounded hover:opacity-90 transition" id="saveSettingsBtn">
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
  // REMOVED const $outputDirInput = $modal.find('#leakCheckOutputDir');
  // REMOVED const $browseButton = $modal.find('#browseOutputDirBtn');
  const $openOutputDirButton = $modal.find('#openOutputDirBtn');
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

  // Add hover effect to close button
  $modal.find('#closeSettingsBtn').hover(
    function() { $(this).css({ 'color': 'var(--theme-primary)', 'background-color': 'rgba(232, 61, 82, 0.1)', 'transform': 'scale(1.1)' }); },
    function() { $(this).css({ 'color': '', 'background-color': '', 'transform': '' }); }
  );

  $modal.find('#saveSettingsBtn').on('click', () => {
    saveSettings($modal, app)
  })
  // --- End Core Modal Handlers ---

  // --- Tab Switching Logic ---
  $modal.find('.settings-tab').on('click', function () {
    const $this = $(this)
    const tabId = $this.data('tab')

    // Update tab appearance
    $('.settings-tab').removeClass('active-tab border-[var(--theme-primary)] text-text-primary').addClass('text-sidebar-text border-transparent') // Remove active state from all
    $this.addClass('active-tab border-[var(--theme-primary)] text-text-primary').removeClass('text-sidebar-text border-transparent') // Add active state to clicked tab

    // Show/Hide content panes
    $('.settings-tab-content').addClass('hidden'); // Hide all content
    $('#' + tabId + 'TabContent').removeClass('hidden'); // Show selected content
  });
  // --- End Tab Switching Logic ---


  // --- REMOVED IPC Listeners for leak-check-progress and leak-check-result ---


  // --- Attach Button Click Handlers ---
  $openOutputDirButton.on('click', () => {
    if (app.dataPath) {
      // Check if ipcRenderer exists before using it
      if (typeof ipcRenderer !== 'undefined' && ipcRenderer) {
        ipcRenderer.send('open-directory', app.dataPath);
      } else {
         console.error('ipcRenderer not available for opening directory');
         showToast('IPC Error: Cannot open directory', 'error');
      }
    } else {
      console.error('Data path not available to open.');
      showToast('Error: Data path not loaded', 'error');
    }
  });

  // REMOVED $startButton click handler
  // REMOVED $pauseButton click handler
  // REMOVED $stopButton click handler

  // --- Danger Zone Handlers ---
  $clearCacheButton.on('click', async () => {
    const confirmed = await showConfirmationModal(
      'Clear Cache Confirmation',
      'Are you sure you want to clear the application cache for both Animal Jam Classic and Strawberry Jam? This primarily affects temporary files and should not delete your saved usernames or settings. Strawberry Jam will close to complete the process.',
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
  // console.log('[Settings] Loading settings...'); // Log removed
  try {
    // Load Connection settings
    const smartfoxServer = await app.settings.get('network.smartfoxServer', 'lb-iss04-classic-prod.animaljam.com');
    const secureConnection = await app.settings.get('network.secureConnection', false);
    $modal.find('#smartfoxServer').val(smartfoxServer);
    $modal.find('#secureConnection').prop('checked', secureConnection);

    // Load LeakCheck settings
    const leakCheckApiKey = await app.settings.get('leakCheck.apiKey', '');
    $modal.find('#leakCheckApiKey').val(leakCheckApiKey);

    // Load Plugins settings
    const hideGamePlugins = await app.settings.get('ui.hideGamePlugins', false); // Default to false
    $modal.find('#hideGamePlugins').prop('checked', hideGamePlugins);

    // console.log('[Settings] Settings loaded successfully.'); // Log removed

  } catch (error) {
    console.error('[Settings] Error loading settings:', error);
    showToast('Failed to load settings', 'error');
    // Apply default values in case of error
    $modal.find('#smartfoxServer').val('lb-iss04-classic-prod.animaljam.com');
    $modal.find('#secureConnection').prop('checked', false);
    $modal.find('#leakCheckApiKey').val('');
    $modal.find('#hideGamePlugins').prop('checked', false);
  }
}

/**
 * Save settings from the modal
 * @param {JQuery<HTMLElement>} $modal - The modal element
 * @param {Application} app - The application instance
 */
async function saveSettings ($modal, app) { // Made async
  // console.log('[Settings] Attempting to save settings...'); // Log removed
  try {
    const updates = [];

    // Save Connection settings
    const smartfoxServer = $modal.find('#smartfoxServer').val();
    const secureConnection = $modal.find('#secureConnection').prop('checked');
    updates.push(app.settings.update('network.smartfoxServer', smartfoxServer));
    updates.push(app.settings.update('network.secureConnection', secureConnection));

    // Save LeakCheck settings
    const leakCheckApiKey = $modal.find('#leakCheckApiKey').val();
    updates.push(app.settings.update('leakCheck.apiKey', leakCheckApiKey));

    // Save Plugins settings
    const hideGamePlugins = $modal.find('#hideGamePlugins').prop('checked');
    updates.push(app.settings.update('ui.hideGamePlugins', hideGamePlugins));

    await Promise.all(updates);
    showToast('Settings saved successfully!', 'success');
    app.modals.close();

    // Check if plugin visibility changed and refresh if needed
    const previousHideState = await app.settings.get('ui.hideGamePlugins'); // Get previous state again
    if (previousHideState !== hideGamePlugins) {
      app.dispatch.refresh(); // Refresh plugin list if visibility changed
    }

  } catch (error) {
    console.error('[Settings] Error saving settings:', error);
    showToast('Failed to save settings', 'error');
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
