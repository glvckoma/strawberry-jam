// UI rendering, DOM manipulation, and UI event listeners for the Account Tester
"use strict";

import { testerState } from './tester-state.js';
import { debugLog, runTestLoop, processCurrentAccount, testAccount } from './tester-logic.js'; // Import necessary logic, including testAccount

// Store references to DOM elements after initialization
let uiElements = {}; // Keep internal reference
// Remove module-scoped loginScreenInstance variable

// --- UI Update Functions ---

// --- REMOVED updateSavePathDisplay function ---

// Function to update delay input values from state
function updateDelayInputs() {
    if (uiElements.testerInterTestDelayInput) {
        uiElements.testerInterTestDelayInput.value = testerState.interTestDelay;
        debugLog(`Updated inter-test delay input to: ${testerState.interTestDelay}`);
    } else {
         console.warn('[TesterUI] Cannot update inter-test delay input: element not found.');
    }
     if (uiElements.testerRetryDelayInput) {
        uiElements.testerRetryDelayInput.value = testerState.retryDelay;
        debugLog(`Updated retry delay input to: ${testerState.retryDelay}`);
    } else {
         console.warn('[TesterUI] Cannot update retry delay input: element not found.');
    }
}

// Function to update toggle checkbox states from state
function updateToggleStates() {
     if (uiElements.testerDebugToggle) {
        uiElements.testerDebugToggle.checked = testerState.debugLoggingEnabled;
        debugLog(`Updated debug toggle state to: ${testerState.debugLoggingEnabled}`);
    } else {
         console.warn('[TesterUI] Cannot update debug toggle: element not found.');
    }
     if (uiElements.testerActualLoginToggle) {
        uiElements.testerActualLoginToggle.checked = testerState.actualLoginEnabled;
        debugLog(`Updated actual login toggle state to: ${testerState.actualLoginEnabled}`);
    } else {
         console.warn('[TesterUI] Cannot update actual login toggle: element not found.');
    }
     // REMOVED logic for testerDisableDevToolsToggle - Handled by LoginScreen.js
}

// Updated for Virtualization & Module Scope
function renderTesterAccountList(forceFullRender = false) {
    // Access elements via uiElements object
    debugLog('renderTesterAccountList called. forceFullRender:', forceFullRender);
    const listElement = uiElements.testerAccountList;
    if (!listElement) {
        debugLog('renderTesterAccountList aborted: listElement not found.');
        return; // Guard clause if not initialized
    }

    // Filter accounts by currentFilterQuery (case-insensitive, matches username or password)
    let filteredAccounts = testerState.accounts;
    const query = (testerState.currentFilterQuery || '').trim().toLowerCase();
    if (query.length > 0) {
        filteredAccounts = testerState.accounts.filter(acc =>
            acc.username.toLowerCase().includes(query) ||
            acc.password.toLowerCase().includes(query)
        );
    }

    const totalItems = filteredAccounts.length;
    debugLog(`List details: totalItems=${totalItems}, clientHeight=${listElement.clientHeight}, scrollTop=${listElement.scrollTop}`);
    const itemHeight = testerState.ESTIMATED_ITEM_HEIGHT;
    const listHeight = listElement.clientHeight;
    const scrollTop = listElement.scrollTop;

    // Calculate visible range with buffer
    const bufferItems = 5;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferItems);
    const endIndex = Math.min(totalItems, Math.ceil((scrollTop + listHeight) / itemHeight) + bufferItems);
    debugLog(`Calculated render range: startIndex=${startIndex}, endIndex=${endIndex}`);

    // Calculate padding heights
    const topPadding = startIndex * itemHeight;
    const bottomPadding = (totalItems - endIndex) * itemHeight;

    // --- REMOVED Preserve Tester Settings Panel Visibility ---

    listElement.innerHTML = ''; // Simple clear
    debugLog(`Calculated padding: top=${topPadding}px, bottom=${bottomPadding}px`);

    // Add top padding element
    if (topPadding > 0) {
        const topPadder = document.createElement('div');
        topPadder.style.height = `${topPadding}px`;
        topPadder.style.pointerEvents = 'none';
        listElement.appendChild(topPadder);
    }

    // Render visible items
    debugLog(`Rendering items from ${startIndex} to ${endIndex - 1}`);
    for (let i = startIndex; i < endIndex; i++) {
        const account = filteredAccounts[i];
        if (!account) {
             debugLog(`Skipping item ${i}: account data missing.`);
             continue;
        }
        const li = document.createElement('li');
        // Find the original index in the full accounts array for selection/status logic
        const originalIndex = testerState.accounts.indexOf(account);
        li.dataset.index = originalIndex;
        li.style.height = `${itemHeight}px`;
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '5px 8px';
        li.style.boxSizing = 'border-box';

        const accountSpan = document.createElement('span');
        const displayPassword = account.password.length > 8 ? account.password.substring(0, 8) + '...' : account.password;
        accountSpan.textContent = `${account.username}:${displayPassword}`;
        li.appendChild(accountSpan);

        const statusSpan = document.createElement('span');
        statusSpan.classList.add('tester-status');
        let displayStatus = account.status || 'pending';
        let statusClass = displayStatus;
        if (displayStatus === 'logged-in') {
            displayStatus = 'logged in';
            statusClass = 'logged-in';
        } else if (displayStatus === 'rate-limited') {
            statusClass = 'rate-limited';
        }
        statusSpan.classList.add(`tester-status-${statusClass}`);
        statusSpan.textContent = displayStatus;
        li.appendChild(statusSpan);

        if (originalIndex === testerState.currentIndex) {
            li.classList.add('selected');
        }
        listElement.appendChild(li);
    }

    // Add bottom padding element
    if (bottomPadding > 0) {
        const bottomPadder = document.createElement('div');
        bottomPadder.style.height = `${bottomPadding}px`;
        bottomPadder.style.pointerEvents = 'none';
        listElement.appendChild(bottomPadder);
    }
    
    // --- REMOVED Re-apply Tester Settings Panel Visibility ---

    // Scroll selected item into view
    if (forceFullRender && testerState.currentIndex >= 0) {
        // Find the index of the selected account in the filtered list
        const selectedIndex = filteredAccounts.findIndex(acc => testerState.accounts.indexOf(acc) === testerState.currentIndex);
        debugLog(`Forcing scroll into view for filtered index: ${selectedIndex}`);
        if (selectedIndex === 0) {
            listElement.scrollTop = 0;
             debugLog(`Scrolling to top (index 0).`);
        } else if (selectedIndex > 0) {
            const targetScrollTop = (selectedIndex * itemHeight) - (listHeight / 2) + (itemHeight / 2);
            const maxScrollTop = (totalItems * itemHeight) - listHeight;
            const finalScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
            listElement.scrollTop = finalScrollTop;
            debugLog(`Calculated scroll: target=${targetScrollTop}, max=${maxScrollTop}, final=${finalScrollTop}`);
        }
    }
    debugLog('renderTesterAccountList finished.');
}

// Debounce rendering on scroll using requestAnimationFrame
function scheduleRender() {
    if (testerState.renderRequestId) {
        return;
    }
    testerState.renderRequestId = requestAnimationFrame(() => {
        renderTesterAccountList(); // Render based on current scroll position
        testerState.renderRequestId = null; // Clear ID after execution
    });
}

function updateTesterButtons() {
    // Access elements via uiElements object
    if (!uiElements.testerTestSelectedBtn) return; // Guard clause

    debugLog(`updateTesterButtons called. State: isTesting=${testerState.isTesting}, shouldStop=${testerState.shouldStop}, pausedState=${testerState.pausedState}, accounts=${testerState.accounts.length}, index=${testerState.currentIndex}, actualLogin=${testerState.actualLoginEnabled}`);
    const hasAccounts = testerState.accounts.length > 0;
    const hasSelection = testerState.currentIndex !== -1;

    // Determine if we're paused for user action
    const isPausedForUserAction = ['otp', 'ratelimit', 'forbidden', 'generic-error'].includes(testerState.pausedState);
    
    // Update: Allow test selected button even when paused for user action
    uiElements.testerTestSelectedBtn.disabled = (testerState.isTesting && !isPausedForUserAction) || !hasAccounts || !hasSelection;

    if (testerState.actualLoginEnabled) {
        uiElements.testerTestAllBtn.textContent = 'Test All';
        uiElements.testerTestAllBtn.disabled = true;
    } else if (testerState.isTesting) {
        if (testerState.shouldStop) {
            uiElements.testerTestAllBtn.textContent = 'Stopping...';
            uiElements.testerTestAllBtn.disabled = true;
        } else if (isPausedForUserAction) {
            uiElements.testerTestAllBtn.textContent = 'Continue';
            uiElements.testerTestAllBtn.disabled = false;
        } else {
            uiElements.testerTestAllBtn.textContent = 'Stop';
            uiElements.testerTestAllBtn.disabled = false;
        }
    } else {
        uiElements.testerTestAllBtn.textContent = 'Test All';
        uiElements.testerTestAllBtn.disabled = !hasAccounts || testerState.actualLoginEnabled;
    }

    // Update: Only disable buttons when truly actively running (not paused)
    const activelyRunning = testerState.isTesting && !isPausedForUserAction && !testerState.shouldStop;
    
    // Update: Allow load and reload buttons when paused
    uiElements.testerLoadBtn.disabled = activelyRunning;
    uiElements.testerReloadBtn.disabled = activelyRunning || !testerState.lastFilePath;

    // Update: Modify cleanup button logic to be more permissive
    uiElements.testerCleanupBtn.disabled = true;
    if (!activelyRunning && testerState.lastFilePath && hasAccounts) {
        try {
            window.ipc.invoke('get-app-state')
                .then(appState => {
                    const fileState = appState?.accountTester?.fileStates?.[testerState.lastFilePath];
                    let hasTestedAccounts = false;
                    if (fileState) {
                        hasTestedAccounts = Object.values(fileState).some(status => status !== 'pending' && status !== 'testing');
                    }
                    uiElements.testerCleanupBtn.disabled = !hasTestedAccounts;
                    debugLog(`Cleanup button state updated. Enabled: ${!uiElements.testerCleanupBtn.disabled}`);
                })
                .catch(err => {
                    console.error('[TesterUI] Error getting state for cleanup button update:', err);
                    uiElements.testerCleanupBtn.disabled = true;
                });
        } catch (err) {
            console.error('[TesterUI] Error invoking get-app-state for cleanup button:', err);
            uiElements.testerCleanupBtn.disabled = true;
        }
    } else {
        debugLog(`Cleanup button remains disabled (activelyRunning: ${activelyRunning}, path: ${testerState.lastFilePath}, hasAccounts: ${hasAccounts})`);
    }
}

function updateTesterSummary() {
    // Access elements via uiElements object
    if (!uiElements.testerStatusSummary) return; // Guard clause

    const total = testerState.accounts.length;
    const tested = testerState.accounts.filter(acc => acc.status !== 'pending' && acc.status !== 'testing').length;
    const works = testerState.accounts.filter(acc => acc.status === 'works').length;
    const invalid = testerState.accounts.filter(acc => acc.status === 'invalid').length;
    const other = tested - works - invalid;

    uiElements.testerStatusSummary.innerHTML = `Loaded: ${total} • Tested: ${tested} <br>Works: ${works} • Invalid: ${invalid} • Other: ${other}`;
}

// Helper method to set tester message and handle auto-clear, with error priority
function setTesterMessage(message, autoClearDelay = 5000, options = {}) {
    // options: { priority: 'known' | 'generic' }
    if (!uiElements.testerMessage) return; // Guard clause

    debugLog('_setTesterMessage called:', message, 'Delay:', autoClearDelay, 'Options:', options);

    // Track the current error priority in testerState
    if (!testerState.currentErrorPriority) testerState.currentErrorPriority = null;

    // If a known error is currently displayed, do not overwrite with a generic error
    if (
        testerState.currentErrorPriority === 'known' &&
        options.priority !== 'known' &&
        message
    ) {
        debugLog('Known error is currently displayed; ignoring generic error message.');
        return;
    }

    // If setting a known error, update the priority
    if (options.priority === 'known') {
        testerState.currentErrorPriority = 'known';
    } else if (!message) {
        // If clearing the message, reset priority
        testerState.currentErrorPriority = null;
    } else {
        testerState.currentErrorPriority = 'generic';
    }

    if (testerState.messageClearTimeoutId) {
        clearTimeout(testerState.messageClearTimeoutId);
        testerState.messageClearTimeoutId = null;
    }

    uiElements.testerMessage.textContent = message;

    // Only auto-clear if not a known error
    if (
        message &&
        typeof autoClearDelay === 'number' &&
        autoClearDelay > 0 &&
        options.priority !== 'known'
    ) {
        debugLog('Setting auto-clear timeout for message.');
        testerState.messageClearTimeoutId = setTimeout(() => {
            if (uiElements.testerMessage.textContent === message) {
                debugLog('Auto-clearing tester message.');
                uiElements.testerMessage.textContent = '';
                testerState.currentErrorPriority = null;
            } else {
                debugLog('Tester message changed before auto-clear timeout.');
            }
            testerState.messageClearTimeoutId = null;
        }, autoClearDelay);
    }
}

// --- State Saving (Debounced) ---

function saveScrollPositionDebounced() {
    if (testerState.saveScrollTimeoutId) {
        clearTimeout(testerState.saveScrollTimeoutId);
    }
    testerState.saveScrollTimeoutId = setTimeout(async () => {
        if (!testerState.lastFilePath || !uiElements.testerAccountList) {
            debugLog('Skipping scroll save: No file path known or list element not found.');
            return;
        }
        const currentScrollTop = uiElements.testerAccountList.scrollTop;
        debugLog(`Debounced scroll save triggered. Saving scroll top: ${currentScrollTop} for file: ${testerState.lastFilePath}`);
        try {
            const currentState = await window.ipc.invoke('get-app-state');
            const currentAccountTesterState = currentState.accountTester || {};
            const currentScrollIndexState = currentAccountTesterState.scrollIndex || {};
            const newState = {
                ...currentState,
                accountTester: {
                    ...currentAccountTesterState,
                    scrollIndex: {
                        ...currentScrollIndexState,
                        [testerState.lastFilePath]: currentScrollTop
                    }
                }
            };
            await window.ipc.invoke('set-app-state', newState);
            debugLog(`Scroll position saved successfully.`);
        } catch (err) {
            console.error(`[TesterUI] Error saving scroll position state:`, err);
        } finally {
            testerState.saveScrollTimeoutId = null;
        }
    }, 500);
}

function saveFilterQueryDebounced() {
    if (testerState.saveFilterTimeoutId) {
        clearTimeout(testerState.saveFilterTimeoutId);
    }
    testerState.saveFilterTimeoutId = setTimeout(async () => {
        if (!testerState.lastFilePath) {
            debugLog('Skipping filter save: No file path known.');
            return;
        }
        const currentFilterQuery = testerState.currentFilterQuery; // Use state variable
        debugLog(`Debounced filter save triggered. Saving query: "${currentFilterQuery}" for file: ${testerState.lastFilePath}`);
        try {
            const currentState = await window.ipc.invoke('get-app-state');
            const currentAccountTesterState = currentState.accountTester || {};
            const currentFilterQueryState = currentAccountTesterState.filterQuery || {};
            const newState = {
                ...currentState,
                accountTester: {
                    ...currentAccountTesterState,
                    filterQuery: {
                        ...currentFilterQueryState,
                        [testerState.lastFilePath]: currentFilterQuery
                    }
                }
            };
            await window.ipc.invoke('set-app-state', newState);
            debugLog(`Filter query saved successfully.`);
        } catch (err) {
            console.error(`[TesterUI] Error saving filter query state:`, err);
        } finally {
            testerState.saveFilterTimeoutId = null;
        }
    }, 500);
}

// --- Initialization ---

function initTesterUI(shadowRoot) { // Remove loginScreen parameter
    debugLog('[TesterUI] initTesterUI called.');
    
    // Validate shadowRoot
    if (!shadowRoot) {
        console.error('[TesterUI] initTesterUI called with invalid shadowRoot');
        return;
    }
    
    try {
        // Find elements within the provided shadow root with error handling
        uiElements = {};
        
        // Helper function to safely get elements and log errors
        const safeGetElement = (id) => {
            try {
                const element = shadowRoot.getElementById(id);
                if (!element) {
                    console.warn(`[TesterUI] Element with ID "${id}" not found in shadowRoot`);
                }
                return element;
            } catch (err) {
                console.error(`[TesterUI] Error getting element with ID "${id}":`, err);
                return null;
            }
        };
        
        // Populate uiElements with safe element references
        uiElements = {
            testerLoadBtn: safeGetElement("tester-load-btn"),
            testerTestSelectedBtn: safeGetElement("tester-test-selected-btn"),
            testerTestAllBtn: safeGetElement("tester-test-all-btn"),
            testerReloadBtn: safeGetElement("tester-reload-btn"),
            testerAccountList: safeGetElement("tester-account-list"),
            testerStatusSummary: safeGetElement("tester-status-summary"),
            testerMessage: safeGetElement("tester-message"),
            // testerSettingsBtn: safeGetElement("tester-settings-btn"), // Removed reference
            // testerSettingsPanel: safeGetElement("tester-settings-panel"), // Removed reference
            testerCleanupBtn: safeGetElement("tester-cleanup-btn"),
            testerFilterInput: safeGetElement("tester-filter-input"),
            testerInterTestDelayInput: safeGetElement("tester-inter-test-delay"),
            testerRetryDelayInput: safeGetElement("tester-retry-delay"),
            testerDebugToggle: safeGetElement("debug-toggle"), // Corrected ID
            testerActualLoginToggle: safeGetElement("tester-actual-login-toggle"),
            // REMOVED: testerDisableDevToolsToggle reference
        };
        
        // REMOVED code for querying ".file-swap-btn" elements

        // Helper function to safely add event listeners
        const safeAddEventListener = (element, eventType, handler) => {
            if (!element) {
                console.warn(`[TesterUI] Cannot add ${eventType} listener: element is null`);
                return;
            }
            
            try {
                element.addEventListener(eventType, handler);
                debugLog(`[TesterUI] Added ${eventType} listener to ${element.id || 'element'}`);
            } catch (err) {
                console.error(`[TesterUI] Error adding ${eventType} listener to ${element.id || 'element'}:`, err);
            }
        };
    
    // Attach Event Listeners with error handling
    safeAddEventListener(uiElements.testerInterTestDelayInput, 'change', (e) => {
        try {
            const value = parseInt(e.target.value, 10);
            debugLog('[UI] Inter-test delay input changed:', e.target.value, 'Parsed value:', value);
            if (!isNaN(value) && value >= 0) {
                testerState.interTestDelay = value; // Update state
                debugLog('[UI] Sending tester-set-delay IPC for interTestDelay:', value);
                if (window.ipc) {
                    window.ipc.send('tester-set-delay', { key: 'interTestDelay', value });
                } else {
                    console.warn('[TesterUI] window.ipc not available for sending tester-set-delay');
                }
            } else {
                debugLog('[UI] Invalid inter-test delay input, resetting.');
                e.target.value = testerState.interTestDelay; // Reset from state
            }
        } catch (err) {
            console.error('[TesterUI] Error handling inter-test delay change:', err);
            // Try to reset the input value
            try {
                e.target.value = testerState.interTestDelay;
            } catch (resetErr) {
                console.error('[TesterUI] Error resetting inter-test delay input:', resetErr);
            }
        }
    });

    safeAddEventListener(uiElements.testerRetryDelayInput, 'change', (e) => {
        try {
            const value = parseInt(e.target.value, 10);
            debugLog('[UI] Retry delay input changed:', e.target.value, 'Parsed value:', value);
            if (!isNaN(value) && value >= 0) {
                testerState.retryDelay = value; // Update state
                debugLog('[UI] Sending tester-set-delay IPC for retryDelay:', value);
                if (window.ipc) {
                    window.ipc.send('tester-set-delay', { key: 'retryDelay', value });
                } else {
                    console.warn('[TesterUI] window.ipc not available for sending tester-set-delay');
                }
            } else {
                debugLog('[UI] Invalid retry delay input, resetting.');
                e.target.value = testerState.retryDelay; // Reset from state
            }
        } catch (err) {
            console.error('[TesterUI] Error handling retry delay change:', err);
            // Try to reset the input value
            try {
                e.target.value = testerState.retryDelay;
            } catch (resetErr) {
                console.error('[TesterUI] Error resetting retry delay input:', resetErr);
            }
        }
    });

    safeAddEventListener(uiElements.testerLoadBtn, 'click', () => {
        try {
            debugLog('Load Accounts button clicked.');
            if (testerState.isTesting) {
                debugLog('Load Accounts button ignored: Tester is running.');
                return;
            }
            debugLog('Sending tester-load-accounts IPC.');
            if (window.ipc) {
                window.ipc.send("tester-load-accounts");
            } else {
                console.warn('[TesterUI] window.ipc not available for sending tester-load-accounts');
            }
        } catch (err) {
            console.error('[TesterUI] Error handling Load Accounts button click:', err);
        }
    });

    safeAddEventListener(uiElements.testerReloadBtn, 'click', () => {
        try {
            debugLog('Reload List button clicked.');
            if (testerState.isTesting || !testerState.lastFilePath) {
                debugLog('Reload List button ignored: Tester is running or no file path known.');
                return;
            }
            if (uiElements.testerReloadBtn) {
                uiElements.testerReloadBtn.disabled = true;
            }
            setTesterMessage('Reloading list...', null);
            debugLog('Sending tester-reload-list-request IPC.');
            if (window.ipc) {
                window.ipc.send("tester-reload-list-request");
            } else {
                console.warn('[TesterUI] window.ipc not available for sending tester-reload-list-request');
                setTesterMessage('Error: IPC not available', null);
                if (uiElements.testerReloadBtn) {
                    uiElements.testerReloadBtn.disabled = false;
                }
            }
        } catch (err) {
            console.error('[TesterUI] Error handling Reload List button click:', err);
            setTesterMessage('Error reloading list', null);
            if (uiElements.testerReloadBtn) {
                uiElements.testerReloadBtn.disabled = false;
            }
        }
    });

    // Removed event listener for testerClearBtn

    // Removed event listener for testerSelectSaveBtn

    if (uiElements.testerTestSelectedBtn) {
        uiElements.testerTestSelectedBtn.addEventListener("click", async () => {
            debugLog('Test Selected button clicked. Actual Login Mode:', testerState.actualLoginEnabled);
            if (testerState.isTesting || testerState.currentIndex === -1) {
                debugLog('Test Selected ignored: Tester running or no selection.');
                return;
            }

            const account = testerState.accounts[testerState.currentIndex];
            debugLog(`Processing selected account index ${testerState.currentIndex}: ${account.username}`);

            if (testerState.actualLoginEnabled) {
                // --- Actual Login Mode ---
                // No need for isTestingActualLogin flag with this direct approach
                // debugLog('[TesterUI] Set isTestingActualLogin = true');
                // Fetch the LoginScreen element directly from the DOM
                const loginScreenElement = document.getElementById('login-screen');
                debugLog('[TesterUI] Inside listener, fetched loginScreenElement:', loginScreenElement);

                if (!loginScreenElement || typeof loginScreenElement.logIn !== 'function' || !loginScreenElement.usernameInputElem) {
                    console.error('[TesterUI] LoginScreen element or its required methods/properties not found in DOM for Actual Login Mode.');
                    setTesterMessage('Error: Cannot perform actual login (UI element missing).', null);
                    return;
                }

                debugLog(`Actual Login Mode: Setting credentials for ${account.username}`);
                
                // Store original df value
                const originalDf = globals.df;
                // Check if UUID spoofing is enabled
                let shouldSpoof = false;
                try {
                    // Create a Promise to get the UUID spoofing state
                    const checkUuidSpoofingPromise = new Promise((resolve) => {
                        // Set up a one-time listener for the response
                        const listener = (event, isEnabled) => {
                            window.ipc.off('tester-uuid-spoofer-loaded', listener);
                            resolve(isEnabled);
                        };
                        window.ipc.on('tester-uuid-spoofer-loaded', listener);
                        // Send the request
                        window.ipc.send('tester-get-uuid-spoofer');
                    });
                    
                    // Wait for the response with a timeout
                    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(false), 1000));
                    shouldSpoof = await Promise.race([checkUuidSpoofingPromise, timeoutPromise]);
                    debugLog(`UUID spoofing is ${shouldSpoof ? 'enabled' : 'disabled'} for actual login`);
                } catch (err) {
                    debugLog(`Error checking UUID spoofing state: ${err}. Defaulting to disabled.`);
                    shouldSpoof = false;
                }
                
                // Only generate a random UUID if spoofing is enabled or using actual login mode
                const randomDf = window.ipc.uuidv4();
                debugLog(`Using ${shouldSpoof ? 'randomized' : 'original'} device fingerprint for actual login${shouldSpoof ? ': ' + randomDf : ''}`);
                
                try {
                    // Set username/password in the actual login fields
                    loginScreenElement.usernameInputElem.value = account.username;
                    loginScreenElement.passwordInputElem.value = account.password;
                    // Clear any previous errors
                    loginScreenElement.usernameInputElem.error = "";
                    loginScreenElement.passwordInputElem.error = "";
                    // Clear tokens just in case
                    loginScreenElement.clearAuthToken();
                    loginScreenElement.clearRefreshToken();
                    loginScreenElement.isFakePassword = false; // Ensure it's not treated as fake

                    // Only replace df with random UUID if spoofing is enabled
                    if (shouldSpoof) {
                        globals.df = randomDf;
                        debugLog(`Temporarily replaced device fingerprint with random UUID for actual login`);
                    }
                    debugLog(`Actual Login Mode: Triggering login for ${account.username} with randomized UUID`);
                    
                    // Create an AbortController specifically for this test if needed, or rely on LoginScreen's default
                    globals.currentAbortController = new AbortController();
                    console.log('[TesterUI] Created AbortController for Actual Login test.');
                    
                    // Wrap login call in a Promise to handle any synchronous errors
                    await new Promise((resolve, reject) => {
                        try {
                            // Pass the randomized UUID AND the current index to the logIn method if spoofing is enabled
                            loginScreenElement.logIn(false, shouldSpoof ? randomDf : null, testerState.currentIndex);
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    });
                    
                    debugLog(`Login initiated successfully for ${account.username}`);
                    // Set message, but DO NOT update status here anymore
                    setTesterMessage(`Attempting actual login for ${account.username}...`, 10000); 

                } catch (err) {
                    debugLog(`Error during actual login for ${account.username}:`, err);
                    setTesterMessage(`Error during login: ${err.message || 'Unknown error'}`);
                    // Reset account status to pending via the bridge function if an error occurs *before* login is called
                    if (window.updateTesterAccountStatus) {
                        window.updateTesterAccountStatus(testerState.currentIndex, 'pending', err);
                    } else {
                        console.error("[TesterUI] updateTesterAccountStatus bridge function not available to reset status on error.");
                    }
                } finally {
                    // Only restore original df value if we changed it
                    if (shouldSpoof) {
                        globals.df = originalDf;
                        debugLog('Restored original device fingerprint after actual login attempt');
                    }
                    debugLog('Restored original device fingerprint after actual login attempt');
                    // Clear abort controller
                    if (globals.currentAbortController) {
                        globals.currentAbortController = null;
                    }
                }

                // REMOVED Direct UI Update for Actual Login - Status will be updated by LoginScreen via bridge

            } else {
                // --- Standard Credential Check Mode ---
                testerState.isTesting = true;
                updateTesterButtons();
                debugLog(`Standard Mode: Testing credentials for index ${testerState.currentIndex}: ${account.username}`);
                // Call the logic function
                await testAccount(account, testerState.currentIndex);
                if (testerState.pausedState === 'none') {
                    testerState.isTesting = false;
                    debugLog('Test Selected finished, tester not paused.');
                } else {
                    debugLog(`Test Selected finished, tester paused in state: ${testerState.pausedState}`);
                }
                updateTesterButtons();
                updateTesterSummary();
            }
        });
    }

    if (uiElements.testerTestAllBtn) {
        uiElements.testerTestAllBtn.addEventListener("click", async () => {
            debugLog('Test All/Stop/Continue button clicked. Current text:', uiElements.testerTestAllBtn.textContent);
            setTesterMessage('');

            if (uiElements.testerTestAllBtn.textContent === 'Stop') {
                debugLog('Stop requested.');
                testerState.shouldStop = true;
                if (globals.currentAbortController) { // Assumes globals is accessible
                    debugLog('Aborting current fetch request via AbortController.');
                    globals.currentAbortController.abort();
                    globals.currentAbortController = null;
                }
                uiElements.testerTestAllBtn.textContent = 'Stopping...';
                uiElements.testerTestAllBtn.disabled = true;
                return;
            }

            if (testerState.isTesting && testerState.pausedState !== 'none') {
                debugLog(`Continue button clicked, resuming test loop from state: ${testerState.pausedState}.`);
                testerState.isTesting = true;
                testerState.shouldStop = false;
                runTestLoop(); // Call the logic function
                return;
            }

            if (testerState.isTesting || testerState.accounts.length === 0) {
                debugLog('Test All ignored: Tester running or no accounts.');
                return;
            }
            debugLog('Starting Test All.');
            testerState.isTesting = true;
            testerState.shouldStop = false;
            testerState.pausedState = 'none';
            // Ensure globals is accessible
            globals.currentAbortController = new AbortController();
            debugLog('Created AbortController for Test All run.');
            runTestLoop(); // Call the logic function
        });
    }

    if (uiElements.testerAccountList) {
        uiElements.testerAccountList.addEventListener("click", (event) => {
            debugLog('Account list clicked.');
            if (testerState.isTesting && testerState.pausedState === 'none') {
                debugLog('List click ignored: Tester actively running.');
                return;
            }
            const targetLi = event.target.closest('li');
            if (targetLi && targetLi.dataset.index) {
                const index = parseInt(targetLi.dataset.index, 10);
                if (index >= 0 && index < testerState.accounts.length) {
                    debugLog(`Selected account index: ${index}`);
                    testerState.currentIndex = index; // Update state
                    renderTesterAccountList(); // Re-render to show selection
                    updateTesterButtons();
                }
            }
        });
    }

    // REMOVED event listener for testerSettingsBtn

    if (uiElements.testerDebugToggle) {
        uiElements.testerDebugToggle.addEventListener('change', (e) => {
            testerState.debugLoggingEnabled = e.target.checked; // Update state
            debugLog(`Debug logging toggled via UI: ${testerState.debugLoggingEnabled ? 'enabled' : 'disabled'}.`);
            debugLog('Sending tester-set-debug-mode IPC.');
            window.ipc.send('tester-set-debug-mode', testerState.debugLoggingEnabled);
            // Dispatch event for GameScreen (assuming document is accessible)
            document.dispatchEvent(new CustomEvent('tester-debug-state-changed', {
                detail: { isEnabled: testerState.debugLoggingEnabled }
            }));
        });
    }

     if (uiElements.testerActualLoginToggle) {
        uiElements.testerActualLoginToggle.addEventListener('change', (e) => {
            testerState.actualLoginEnabled = e.target.checked; // Update state
            debugLog(`Actual Login toggled via UI: ${testerState.actualLoginEnabled ? 'enabled' : 'disabled'}.`);
            debugLog('Sending tester-set-actual-login-mode IPC.');
            window.ipc.send('tester-set-actual-login-mode', testerState.actualLoginEnabled);
            updateTesterButtons();
        });
    }

    // REMOVED event listener for devToolsToggleElem - Handled by LoginScreen.js

    if (uiElements.testerCleanupBtn) {
        uiElements.testerCleanupBtn.addEventListener("click", async () => {
            debugLog('Cleanup Tested button clicked.');
            if (testerState.isTesting || !testerState.lastFilePath) {
                debugLog('Cleanup ignored: Tester running or no file loaded.');
                return;
            }
            const confirmed = window.confirm(`Are you sure you want to remove all tested accounts (except 'pending'/'testing') from the file "${testerState.lastFilePath.split(/[\\/]/).pop()}"?\n\nThis action cannot be undone.`);
            if (!confirmed) {
                debugLog('Cleanup cancelled by user.');
                setTesterMessage('Cleanup cancelled.');
                return;
            }
            debugLog(`Sending tester-cleanup-processed IPC for file: ${testerState.lastFilePath}`);
            setTesterMessage('Cleaning up file...', null);
            uiElements.testerCleanupBtn.disabled = true;
            try {
                const result = await window.ipc.invoke('tester-cleanup-processed', testerState.lastFilePath);
                if (result.success) {
                    debugLog(`Cleanup successful. ${result.removedCount} entries removed.`);
                    setTesterMessage(`Cleanup successful: ${result.removedCount} tested entries removed. Reloading list...`);
                    debugLog('Sending tester-reload-list-request IPC after cleanup.');
                    window.ipc.send("tester-reload-list-request");
                } else {
                    console.error('[TesterUI] Cleanup failed:', result.error);
                    setTesterMessage(`Cleanup failed: ${result.error}`);
                    uiElements.testerCleanupBtn.disabled = false;
                }
            } catch (err) {
                console.error('[TesterUI] Error invoking tester-cleanup-processed:', err);
                setTesterMessage(`Error during cleanup: ${err.message || err}`);
                uiElements.testerCleanupBtn.disabled = false;
            }
        });
    }

    // REMOVED event listener attachment for file-swap-btn elements

    if (uiElements.testerFilterInput) {
        uiElements.testerFilterInput.addEventListener('input', () => {
            testerState.currentFilterQuery = uiElements.testerFilterInput.value.toLowerCase(); // Update state
            debugLog(`Filter input changed: ${testerState.currentFilterQuery}`);
            if (uiElements.testerAccountList) uiElements.testerAccountList.scrollTop = 0;
            renderTesterAccountList(true);
            saveFilterQueryDebounced();
        });
    }

    if (uiElements.testerAccountList) {
        uiElements.testerAccountList.addEventListener('scroll', () => {
            scheduleRender();
            saveScrollPositionDebounced();
        });
    }

        // Initial UI setup
        updateTesterButtons();
        updateTesterSummary();
        // Set initial values for inputs based on state using the new functions
        // This ensures UI reflects any state loaded via IPC before init finished
        updateDelayInputs();
        updateToggleStates();
        // updateSavePathDisplay(); // Removed call
        if(uiElements.testerFilterInput) uiElements.testerFilterInput.value = testerState.currentFilterQuery; // Restore filter input

        // --- Auto-load working_accounts.txt on init ---
        debugLog("Attempting to auto-load working_accounts.txt on initialization.");
        setTesterMessage("Auto-loading working accounts...", 3000); // Inform user
        if (window.ipc) {
            window.ipc.send('tester-load-works-accounts'); // Send IPC to load the default works file
        } else {
            console.warn('[TesterUI] window.ipc not available for auto-loading working accounts');
        }
        // --- End Auto-load ---

        debugLog("Tester UI Initialized");
    } catch (err) {
        console.error('[TesterUI] Error during UI initialization:', err);
    }
}

/**
 * Tooltip system: replaces CSS pseudo-element tooltips with a JS-driven tooltip
 * that is appended to document.body and positioned near the hovered element.
 */
function setupTesterTooltips() {
    // Remove any existing tooltip
    let tooltipEl = document.getElementById('tester-tooltip');
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'tester-tooltip';
        tooltipEl.style.position = 'fixed';
        tooltipEl.style.zIndex = '99999';
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.background = '#181818';
        tooltipEl.style.color = '#fff';
        tooltipEl.style.padding = '6px 14px';
        tooltipEl.style.borderRadius = '14px';
        tooltipEl.style.fontSize = '12px';
        tooltipEl.style.fontFamily = 'sans-serif';
        tooltipEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)';
        tooltipEl.style.maxWidth = '320px';
        tooltipEl.style.whiteSpace = 'pre-line';
        tooltipEl.style.display = 'none';
        document.body.appendChild(tooltipEl);
    }

    // Helper to show tooltip
    function showTooltip(e) {
        const target = e.currentTarget;
        const title = target.getAttribute('title');
        if (!title) return;
        tooltipEl.textContent = title;
        tooltipEl.style.display = 'block';

        // Position tooltip near mouse, but keep within viewport
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const tooltipRect = tooltipEl.getBoundingClientRect();
        let left = mouseX + 12;
        let top = mouseY + 12;
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        if (top + tooltipRect.height > window.innerHeight) {
            top = window.innerHeight - tooltipRect.height - 8;
        }
        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;
    }

    // Hide tooltip
    function hideTooltip() {
        tooltipEl.style.display = 'none';
    }

    // Attach listeners to all #tester-controls children with title attribute
    const controls = document.getElementById('tester-controls');
    if (controls) {
        const tooltipTargets = controls.querySelectorAll('[title]');
        tooltipTargets.forEach(el => {
            el.addEventListener('mouseenter', showTooltip);
            el.addEventListener('mousemove', showTooltip);
            el.addEventListener('mouseleave', hideTooltip);
            // Remove native tooltip
            el.setAttribute('data-original-title', el.getAttribute('title'));
            el.removeAttribute('title');
        });
    }
}

// Export necessary functions
export {
    initTesterUI,
    renderTesterAccountList,
    updateTesterButtons,
    updateTesterSummary,
    setTesterMessage,
    // updateSavePathDisplay, // Removed export
    updateDelayInputs,
    updateToggleStates,
    setupTesterTooltips
    // DO NOT export uiElements directly
};

// Register the real implementation with the bridge
if (window.registerInitTesterUI) {
    window.registerInitTesterUI(initTesterUI);
} else {
    console.error('[TesterUI] Bridge function registerInitTesterUI not found!');
}

// REMOVED registration for renderTesterAccountList and updateTesterSummary
// as they are no longer called by the bridge's loginSucceeded listener.

// Initialize tooltips after DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(setupTesterTooltips, 0);
} else {
    window.addEventListener('DOMContentLoaded', setupTesterTooltips);
}
