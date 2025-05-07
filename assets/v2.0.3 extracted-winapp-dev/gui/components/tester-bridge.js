"use strict";

// --- Tester Bridge Script ---
// This script loads *before* LoginScreen.js and defines placeholder functions
// globally. The actual ES modules will load later and register their
// implementations with this bridge.

(function() {
    console.log('[TesterBridge] Initializing bridge...');

    // Add a flag to track if bridge is fully initialized
    let _bridgeInitialized = false;
    let _realInitTesterUI = null;
    let _realSetupTesterIPCListeners = null;
    let _shadowRootForUI = null;
    let _ipcListenersSetupCalled = false;
    
    // Add a queue for deferred calls
    let _deferredCalls = [];
    
    // Add a timeout to ensure bridge is eventually marked as initialized
    setTimeout(() => {
        if (!_bridgeInitialized) {
            console.log('[TesterBridge] Forcing bridge initialization after timeout');
            _bridgeInitialized = true;
            
            // Process any deferred calls
            while (_deferredCalls.length > 0) {
                try {
                    const call = _deferredCalls.shift();
                    console.log(`[TesterBridge] Processing deferred call: ${call.name}`);
                    call.fn.apply(null, call.args);
                } catch (err) {
                    console.error(`[TesterBridge] Error processing deferred call ${call.name}:`, err);
                }
            }
        }
    }, 5000); // 5 second timeout

    // Helper function to safely execute a function with error handling
    function safeExecute(fn, ...args) {
        if (typeof fn !== 'function') {
            console.warn('[TesterBridge] Attempted to call a non-function');
            return;
        }
        
        try {
            return fn.apply(null, args);
        } catch (err) {
            console.error('[TesterBridge] Error executing function:', err);
            return null;
        }
    }

    // Placeholder for UI initialization with improved error handling
    window.initTesterUI = function(shadowRoot) {
        console.log('[TesterBridge] Placeholder initTesterUI called.');
        
        // Check if shadowRoot is valid
        if (!shadowRoot) {
            console.warn('[TesterBridge] initTesterUI called with invalid shadowRoot');
            return;
        }
        
        _shadowRootForUI = shadowRoot; // Store shadowRoot for later
        
        if (_realInitTesterUI) {
            console.log('[TesterBridge] Real initTesterUI available, calling now.');
            safeExecute(_realInitTesterUI, shadowRoot);
        } else {
            console.log('[TesterBridge] Real initTesterUI not yet registered.');
            // Queue this call for later if not initialized
            if (!_bridgeInitialized) {
                _deferredCalls.push({
                    name: 'initTesterUI',
                    fn: window.initTesterUI,
                    args: [shadowRoot]
                });
            }
        }
    };

    // Placeholder for IPC listener setup with improved error handling
    window.setupTesterIPCListeners = function() {
        console.log('[TesterBridge] Placeholder setupTesterIPCListeners called.');
        _ipcListenersSetupCalled = true; // Mark that setup was requested
        
        if (_realSetupTesterIPCListeners) {
            console.log('[TesterBridge] Real setupTesterIPCListeners available, calling now.');
            safeExecute(_realSetupTesterIPCListeners);
        } else {
            console.log('[TesterBridge] Real setupTesterIPCListeners not yet registered.');
            // Queue this call for later if not initialized
            if (!_bridgeInitialized) {
                _deferredCalls.push({
                    name: 'setupTesterIPCListeners',
                    fn: window.setupTesterIPCListeners,
                    args: []
                });
            }
        }
    };

    // Registration function for the real UI initializer with improved error handling
    window.registerInitTesterUI = function(realFunction) {
        console.log('[TesterBridge] Registering real initTesterUI.');
        
        if (typeof realFunction !== 'function') {
            console.error('[TesterBridge] Attempted to register non-function as initTesterUI');
            return;
        }
        
        _realInitTesterUI = realFunction;
        
        // If initTesterUI was already called with a shadowRoot, call the real one now
        if (_shadowRootForUI) {
            console.log('[TesterBridge] Calling registered initTesterUI immediately with stored shadowRoot.');
            safeExecute(_realInitTesterUI, _shadowRootForUI);
        }
    };

    // Registration function for the real IPC listener setup with improved error handling
    window.registerSetupTesterIPCListeners = function(realFunction) {
        console.log('[TesterBridge] Registering real setupTesterIPCListeners.');
        
        if (typeof realFunction !== 'function') {
            console.error('[TesterBridge] Attempted to register non-function as setupTesterIPCListeners');
            return;
        }
        
        _realSetupTesterIPCListeners = realFunction;
        
        // If setupTesterIPCListeners was already called, call the real one now
        if (_ipcListenersSetupCalled) {
            console.log('[TesterBridge] Calling registered setupTesterIPCListeners immediately.');
            safeExecute(_realSetupTesterIPCListeners);
        }
    };

    // Placeholder for tester status update function with improved error handling
    window.updateTesterAccountStatus = function(index, status, error = null) {
        console.warn(`[TesterBridge] updateTesterAccountStatus placeholder called for index ${index}, status ${status}`);
        // No need to queue this as it's just a placeholder that will be replaced
    };
    
    window.registerUpdateTesterAccountStatus = function(fn) {
        if (typeof fn !== 'function') {
            console.error('[TesterBridge] Attempted to register non-function as updateTesterAccountStatus');
            return;
        }
        window.updateTesterAccountStatus = fn;
    };

    // Add a method to check if the bridge is ready
    window.isTesterBridgeReady = function() {
        return _bridgeInitialized && _realInitTesterUI !== null && _realSetupTesterIPCListeners !== null;
    };

    // Mark bridge as initialized
    _bridgeInitialized = true;
    console.log('[TesterBridge] Bridge initialized.');
})();
