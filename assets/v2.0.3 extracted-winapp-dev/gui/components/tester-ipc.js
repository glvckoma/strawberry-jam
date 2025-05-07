// IPC communication handlers specific to the Account Tester
"use strict";

import { testerState } from './tester-state.js';
import { debugLog, processCurrentAccount } from './tester-logic.js'; // Import necessary logic
// Import ALL necessary UI functions
import {
    renderTesterAccountList,
    updateTesterButtons,
    updateTesterSummary,
    setTesterMessage,
    // updateSavePathDisplay, // Removed import
    updateDelayInputs,
    updateToggleStates
 } from './tester-ui.js';

 // REMOVED isDevelopmentMode function
 // REMOVED getDataPath function

// Reference to UI elements - will be populated by getUIElements function
let uiElements = null;

// Function to safely get UI elements from the DOM
function getUIElements() {
    if (uiElements) return uiElements;
    
    try {
        // Find the login-screen element
        const loginScreen = document.getElementById('login-screen');
        if (!loginScreen || !loginScreen.shadowRoot) {
            console.warn('[TesterIPC] Cannot find login-screen element or its shadowRoot');
            return null;
        }
        
        // Get elements from the shadow root
        const shadowRoot = loginScreen.shadowRoot;
        
        // Create a safe object with null checks
        uiElements = {
            testerAccountList: shadowRoot.getElementById('tester-account-list'),
            testerFilterInput: shadowRoot.getElementById('tester-filter-input')
        };
        
        return uiElements;
    } catch (err) {
        console.error('[TesterIPC] Error getting UI elements:', err);
        return null;
    }
}

// Helper function to load and apply saved state for a file
async function loadAndApplySavedState(filePath) {
    debugLog('[IPC] Loading tester state via get-app-state.');
    if (!filePath) {
        console.error('[IPC] Cannot load state: filePath is missing.');
        setTesterMessage('Error: Cannot load saved state (missing file path).');
        if (testerState.accounts && Array.isArray(testerState.accounts)) {
            testerState.accounts.forEach(acc => acc.status = 'pending');
        } else {
            console.warn('[TesterIPC] testerState.accounts is not an array or is undefined');
        }
        return { success: false }; // Return object indicating failure
    }
    
    try {
        // Check if window.ipc is available
        if (!window.ipc) {
            console.error('[TesterIPC] window.ipc is not available for get-app-state');
            return { success: false };
        }
        
        // Use the provided filePath directly as the key
        const stateFilePathKey = filePath;
        debugLog(`[IPC] Using state key for loading: ${stateFilePathKey}`);

        const appState = await window.ipc.invoke('get-app-state');
        const currentTesterState = appState?.accountTester || {};

        // Retrieve state using the direct file path key
        const fileState = currentTesterState.fileStates?.[stateFilePathKey];
        const savedScrollIndex = currentTesterState.scrollIndex?.[stateFilePathKey] || 0;
        const savedFilterQuery = currentTesterState.filterQuery?.[stateFilePathKey] || ""; // Load filter query

        if (fileState) {
            debugLog(`[IPC] Found state using key: ${stateFilePathKey}`);
            let appliedCount = 0;
            if (testerState.accounts && Array.isArray(testerState.accounts)) {
                testerState.accounts.forEach(acc => {
                    if (!acc) return; // Skip null/undefined accounts
                    
                    const accountKey = `${acc.username}:${acc.password}`;
                    if (fileState[accountKey]) {
                        acc.status = fileState[accountKey];
                        appliedCount++;
                    } else {
                        acc.status = 'pending'; // Default if not found in state
                    }
                });
                debugLog(`[IPC] Applied saved status to ${appliedCount} accounts.`);
            } else {
                console.warn('[TesterIPC] testerState.accounts is not an array or is undefined');
            }
        } else {
            debugLog(`[IPC] No saved state found for key ${stateFilePathKey}, defaulting all to pending.`);
            if (testerState.accounts && Array.isArray(testerState.accounts)) {
                testerState.accounts.forEach(acc => {
                    if (acc) acc.status = 'pending';
                });
            }
        }

        // Restore scroll position and filter query to state
        testerState.currentFilterQuery = savedFilterQuery;
        // Store scroll index in state, UI will apply it after render
        testerState.restoredScrollIndex = savedScrollIndex;
        debugLog(`[IPC] Scroll position to restore: ${savedScrollIndex}`);
        debugLog(`[IPC] Filter query to restore: "${savedFilterQuery}"`);

        return { success: true, scrollIndex: savedScrollIndex }; // Indicate success and return scroll index

    } catch (err) {
        console.error('[IPC] Error loading tester state:', err);
        setTesterMessage('Error loading saved state.');
        // Reset accounts to pending on error
        if (testerState.accounts && Array.isArray(testerState.accounts)) {
            testerState.accounts.forEach(acc => {
                if (acc) acc.status = 'pending';
            });
        }
        testerState.currentFilterQuery = ""; // Reset filter on error
        testerState.restoredScrollIndex = 0; // Reset scroll on error
        return { success: false }; // Indicate failure
    }
}

function setupTesterIPCListeners() {
    try {
        debugLog("Setting up Tester IPC listeners.");

        // Check if window.ipc is available
        if (!window.ipc) {
            console.error('[TesterIPC] window.ipc is not available for setting up listeners');
            return;
        }

        // --- State Loading & Updates ---
        window.ipc.on("tester-accounts-loaded", async (event, data) => {
            console.log('[AUTOLOAD] Received tester-accounts-loaded:', data ? `success=${data.success}, accounts=${data.accounts?.length}` : 'null');
            debugLog('[IPC] Received tester-accounts-loaded:', data);
            if (data && data.success) {
                console.log(`[AUTOLOAD] Successfully loaded ${data.accounts?.length || 0} accounts from ${data.filePath}`);
                testerState.accounts = data.accounts || [];
                testerState.currentIndex = testerState.accounts.length > 0 ? 0 : -1;
                testerState.lastFilePath = data.filePath;
                setTesterMessage(''); // Clear message initially

                // Load state *after* loading accounts from file
                console.log('[AUTOLOAD] Loading and applying saved state for manual load');
                const stateLoadResult = await loadAndApplySavedState(testerState.lastFilePath);

                // Defer the UI updates slightly to allow layout calculation
                console.log('[AUTOLOAD] Deferring UI updates for manual load');
                setTimeout(() => {
                    console.log('[AUTOLOAD] Executing deferred UI updates for manual load');
                    // First render to get elements in DOM
                    renderTesterAccountList(true); // Call UI function
                    
                    // Then use requestAnimationFrame for a second render after layout
                    requestAnimationFrame(() => {
                        console.log('[AUTOLOAD] First animation frame for manual load - waiting for layout');
                        requestAnimationFrame(() => {
                            console.log('[AUTOLOAD] Second animation frame for manual load - rendering with layout');
                            // Final render with correct measurements
                            renderTesterAccountList(true); // Force full render to apply scroll
                            updateTesterButtons(); // Call UI function
                            updateTesterSummary(); // Call UI function
                            
                            // Apply scroll position if loaded successfully
                            const elements = getUIElements();
                            if (stateLoadResult.success && elements && elements.testerAccountList) {
                                elements.testerAccountList.scrollTop = stateLoadResult.scrollIndex;
                                debugLog(`[IPC] Applied restored scroll position: ${stateLoadResult.scrollIndex}`);
                            } else {
                                debugLog('[IPC] Could not apply scroll position: UI elements not available');
                            }
                            
                            // Apply filter query to input
                            if (elements && elements.testerFilterInput) {
                                elements.testerFilterInput.value = testerState.currentFilterQuery;
                            } else {
                                debugLog('[IPC] Could not apply filter query: UI elements not available');
                            }
                            
                            console.log('[AUTOLOAD] UI updates complete for manual load');
                        });
                    });
                    
                    debugLog(`[IPC] Deferred initial render complete for ${data.filePath}.`);
                }, 0); // 0ms timeout defers execution until after current stack clears

                debugLog(`[IPC] Loaded ${testerState.accounts.length} accounts from ${data.filePath}. State applied.`);

            } else {
                console.error(`[IPC] Error loading accounts file: ${data?.error || 'Unknown error'}`);
                window.alert(`Error loading accounts file: ${data?.error || 'Unknown error'}`); // Keep alert for user feedback
            }
        });
        // REMOVED loginSucceeded listener - Moved to tester-bridge.js


        // Listeners for shortcut triggers
        window.ipc.on('tester-trigger-works', () => {
            debugLog('[IPC] Received tester-trigger-works.');
            processCurrentAccount('works'); // Call logic function
        });

        window.ipc.on('tester-trigger-does-not-work', () => {
            debugLog('[IPC] Received tester-trigger-does-not-work.');
            processCurrentAccount('invalid'); // Call logic function
        });

        // --- REMOVED 'tester-save-path-result' listener ---

        // Listener for loaded delays
        window.ipc.on('tester-delays-loaded', (event, delays) => {
            debugLog('[IPC] Received tester-delays-loaded:', delays);
            let stateChanged = false;
            if (typeof delays.interTestDelay === 'number' && delays.interTestDelay >= 0) {
                testerState.interTestDelay = delays.interTestDelay; // Update state
                stateChanged = true;
                debugLog(`[IPC] Applied interTestDelay from main: ${testerState.interTestDelay}`);
            } else {
                debugLog(`[IPC] Invalid or missing interTestDelay received from main: ${delays.interTestDelay}`);
            }
            if (typeof delays.retryDelay === 'number' && delays.retryDelay >= 0) {
                testerState.retryDelay = delays.retryDelay; // Update state
                stateChanged = true;
                debugLog(`[IPC] Applied retryDelay from main: ${testerState.retryDelay}`);
            } else {
                debugLog(`[IPC] Invalid or missing retryDelay received from main: ${delays.retryDelay}`);
            }

            // Always log the final values being set
            debugLog(`[IPC] Final delay values after load: interTestDelay=${testerState.interTestDelay}, retryDelay=${testerState.retryDelay}`);

            // Defer UI updates to ensure DOM elements are accessible
            setTimeout(() => {
                debugLog(`[IPC] Calling updateDelayInputs after delay load. UI should show: interTestDelay=${testerState.interTestDelay}, retryDelay=${testerState.retryDelay}`);
                updateDelayInputs();
            }, 100); // Small delay to ensure DOM is ready
        });

        // Listener for loaded debug mode state
        window.ipc.on('tester-debug-mode-loaded', (event, isEnabled) => {
            debugLog(`[IPC] Received tester-debug-mode-loaded: ${isEnabled}`);
            testerState.debugLoggingEnabled = !!isEnabled; // Update state
            
            // Defer UI updates to ensure DOM elements are accessible
            setTimeout(() => {
                debugLog('[IPC] Deferred updateToggleStates call after tester-debug-mode-loaded');
                updateToggleStates();
                
                // Dispatch event for GameScreen (assuming document is accessible)
                try {
                    document.dispatchEvent(new CustomEvent('tester-debug-state-changed', {
                        detail: { isEnabled: testerState.debugLoggingEnabled }
                    }));
                } catch (err) {
                    console.error('[TesterIPC] Error dispatching debug state change event:', err);
                }
            }, 100); // Small delay to ensure DOM is ready
        });

        // Listener for loaded actual login mode state
        window.ipc.on('tester-actual-login-mode-loaded', (event, isEnabled) => {
            debugLog(`[IPC] Received tester-actual-login-mode-loaded: ${isEnabled}`);
            testerState.actualLoginEnabled = !!isEnabled; // Update state
            
            // Defer UI updates to ensure DOM elements are accessible
            setTimeout(() => {
                debugLog('[IPC] Deferred updateToggleStates and updateTesterButtons call after tester-actual-login-mode-loaded');
                updateToggleStates();
                updateTesterButtons(); // Keep this one as it affects button logic immediately
            }, 100); // Small delay to ensure DOM is ready
        });

    // REMOVED Listener for loaded disable devtools mode state - Handled by LoginScreen.js

        // Listener for reload result
        window.ipc.on('tester-reload-list-result', async (event, data) => {
            console.log('[AUTOLOAD] Received tester-reload-list-result:', data ? `success=${data.success}, accounts=${data.accounts?.length}` : 'null');
            debugLog('[IPC] Received tester-reload-list-result:', data);
            // Update button state via UI function
            updateTesterButtons();
            if (data && data.success) {
                console.log(`[AUTOLOAD] Successfully reloaded ${data.accounts?.length || 0} accounts from ${data.filePath}`);
                testerState.accounts = data.accounts || []; // Update state
                testerState.currentIndex = testerState.accounts.length > 0 ? 0 : -1; // Update state
                
                // Load and apply saved state before UI updates
                console.log('[AUTOLOAD] Loading and applying saved state for reload');
                const reloadStateResult = await loadAndApplySavedState(data.filePath);

                // Defer the UI updates slightly to allow layout calculation
                console.log('[AUTOLOAD] Deferring UI updates for reload');
                setTimeout(() => {
                    console.log('[AUTOLOAD] Executing deferred UI updates for reload');
                    // First render to get elements in DOM
                    renderTesterAccountList(true); // Call UI function
                    
                    // Then use requestAnimationFrame for a second render after layout
                    requestAnimationFrame(() => {
                        console.log('[AUTOLOAD] First animation frame for reload - waiting for layout');
                        requestAnimationFrame(() => {
                            console.log('[AUTOLOAD] Second animation frame for reload - rendering with layout');
                            // Final render with correct measurements
                            renderTesterAccountList(true); // Force full render to apply scroll
                            updateTesterButtons(); // Call UI function
                            updateTesterSummary(); // Call UI function
                            setTesterMessage(`Reloaded ${testerState.accounts.length} accounts from ${data.filePath.split(/[\\/]/).pop()}.`); // Call UI function
                            
                            // Apply scroll position if loaded successfully
                            const elements = getUIElements();
                            if (reloadStateResult.success && elements && elements.testerAccountList) {
                                elements.testerAccountList.scrollTop = reloadStateResult.scrollIndex;
                                debugLog(`[IPC] Applied restored scroll position: ${reloadStateResult.scrollIndex}`);
                            } else {
                                debugLog('[IPC] Could not apply scroll position: UI elements not available');
                            }
                            
                            // Apply filter query to input
                            if (elements && elements.testerFilterInput) {
                                elements.testerFilterInput.value = testerState.currentFilterQuery;
                            } else {
                                debugLog('[IPC] Could not apply filter query: UI elements not available');
                            }
                            
                            console.log('[AUTOLOAD] UI updates complete for reload');
                        });
                    });
                    
                    debugLog(`[IPC] Deferred initial render complete for reloaded file ${data.filePath}`);
                }, 0); // 0ms timeout defers execution until after current stack clears

                debugLog(`Reloaded ${testerState.accounts.length} accounts from ${data.filePath}`);
            } else {
                console.error(`[IPC] Error reloading file ${data.filePath}: ${data.error}`);
                setTesterMessage(`Error reloading list: ${data.error}`); // Call UI function
            }
        });

        // Listener for auto-load result (This seems redundant with tester-specific-file-loaded, maybe consolidate?)
        window.ipc.on('tester-auto-load-result', async (event, data) => {
            console.log('[AUTOLOAD] Received tester-auto-load-result:', data ? `success=${data.success}, accounts=${data.accounts?.length}` : 'null');
            debugLog('[IPC] Received tester-auto-load-result:', data);
            if (data && data.success) {
                console.log(`[AUTOLOAD] Successfully loaded ${data.accounts?.length || 0} accounts from ${data.filePath}`);
                testerState.accounts = data.accounts || []; // Update state
                testerState.currentIndex = testerState.accounts.length > 0 ? 0 : -1; // Update state
                testerState.lastFilePath = data.filePath; // Update state
                
                // Load and apply saved state before UI updates
                console.log('[AUTOLOAD] Loading and applying saved state');
                const autoLoadResultStateResult = await loadAndApplySavedState(data.filePath);

                // Defer the UI updates slightly to allow layout calculation
                console.log('[AUTOLOAD] Deferring UI updates');
                setTimeout(() => {
                    console.log('[AUTOLOAD] Executing deferred UI updates');
                    // First render to get elements in DOM
                    renderTesterAccountList(true); // Call UI function
                    
                    // Then use requestAnimationFrame for a second render after layout
                    requestAnimationFrame(() => {
                        console.log('[AUTOLOAD] First animation frame - waiting for layout');
                        requestAnimationFrame(() => {
                            console.log('[AUTOLOAD] Second animation frame - rendering with layout');
                            // Final render with correct measurements
                            renderTesterAccountList(true); // Force full render to apply scroll
                            updateTesterButtons(); // Call UI function
                            updateTesterSummary(); // Call UI function
                            setTesterMessage(`Auto-loaded ${testerState.accounts.length} accounts from ${data.filePath.split(/[\\/]/).pop()}.`); // Call UI function
                            
                            // Apply scroll position if loaded successfully
                            const elements = getUIElements();
                            if (autoLoadResultStateResult.success && elements && elements.testerAccountList) {
                                elements.testerAccountList.scrollTop = autoLoadResultStateResult.scrollIndex;
                                debugLog(`[IPC] Applied restored scroll position: ${autoLoadResultStateResult.scrollIndex}`);
                            } else {
                                debugLog('[IPC] Could not apply scroll position: UI elements not available');
                            }
                            
                            // Apply filter query to input
                            if (elements && elements.testerFilterInput) {
                                elements.testerFilterInput.value = testerState.currentFilterQuery;
                            } else {
                                debugLog('[IPC] Could not apply filter query: UI elements not available');
                            }
                            
                            console.log('[AUTOLOAD] UI updates complete');
                        });
                    });
                    
                    debugLog(`[IPC] Deferred initial render complete for auto-loaded file ${data.filePath}`);
                }, 0); // 0ms timeout defers execution until after current stack clears

                debugLog(`Auto-loaded ${testerState.accounts.length} accounts from ${data.filePath}`);
            } else {
                console.error(`[IPC] Error auto-loading file ${data.filePath}: ${data.error}`);
                setTesterMessage(`Error auto-loading last file: ${data.error}`); // Call UI function
            }
        });

        debugLog("Tester IPC Listeners Initialized.");
        
        // Add listener for the main process ready signal
        window.ipc.on("tester-main-ready", (event, isReady) => {
            if (isReady) {
                console.log('[AUTOLOAD] Received tester-main-ready signal.');
                isMainProcessReady = true;
                // If initializeTesterState was already called, initiate the auto-load path now
                if (initializeTesterStateCalled) {
                    initiateAutoLoadPath();
                }
            }
        });
    } catch (err) {
        console.error('[TesterIPC] Error setting up IPC listeners:', err);
    }
}

// Flag to track if the main process is ready
let isMainProcessReady = false;
// Flag to track if initializeTesterState has been called
let initializeTesterStateCalled = false;

// Function to initiate auto-load path
function initiateAutoLoadPath() {
    try {
        console.log('[AUTOLOAD] Initiating auto-load path.');
        if (window.ipc) {
            window.ipc.send("tester-get-last-path");
        } else {
            console.error('[TesterIPC] window.ipc not available for initiating auto-load');
        }
    } catch (err) {
        console.error('[TesterIPC] Error initiating auto-load path:', err);
    }
}

// Function to initialize state (call this when tester UI is ready)
function initializeTesterState() {
    console.log('[AUTOLOAD] *** INITIALIZATION START ***');
    debugLog('[IPC] Initializing tester state (requesting settings)...');

    // Check if window.ipc is available
    if (!window.ipc) {
        console.error('[TesterIPC] window.ipc is not available for initialization');
        return;
    }

    // Request various settings from the main process
    debugLog('[IPC] Sending tester-get-delays');
    window.ipc.send('tester-get-delays');
    debugLog('[IPC] Sending tester-get-debug-mode');
    window.ipc.send('tester-get-debug-mode');
    debugLog('[IPC] Sending tester-get-actual-login-mode');
    window.ipc.send('tester-get-actual-login-mode');
    debugLog('[IPC] Sending tester-get-disable-devtools-mode');
    window.ipc.send('tester-get-disable-devtools-mode');
    debugLog('[IPC] Sending tester-get-uuid-spoofer');
    window.ipc.send('tester-get-uuid-spoofer');
    // REMOVED get save path logic

    // Request initial auto-load data from main process
    console.log('[AUTOLOAD] Requesting initial auto-load data from main process.');
    window.ipc.send('tester-request-initial-load');

    // Restore any previous filter query (before accounts are loaded)
    const elements = getUIElements();
    if (elements && elements.testerFilterInput) {
        elements.testerFilterInput.value = testerState.currentFilterQuery || "";
    }

    // Render initial empty/loading state
    console.log('[AUTOLOAD] Rendering initial UI state before data arrives');
    renderTesterAccountList();
    updateTesterButtons();
    updateTesterSummary();

    console.log('[AUTOLOAD] *** INITIALIZATION COMPLETE ***');
}

// Export the initialization functions
export { setupTesterIPCListeners, initializeTesterState };

// Register the real implementations with the bridge
if (window.registerSetupTesterIPCListeners) {
    window.registerSetupTesterIPCListeners(setupTesterIPCListeners);
    // Also expose the initialization function globally for the final init script
    window.initializeTesterState = initializeTesterState;
} else {
    console.error('[TesterIPC] Bridge function registerSetupTesterIPCListeners not found!');
}
