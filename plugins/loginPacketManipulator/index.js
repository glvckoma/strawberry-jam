/**
 * Login Packet Manipulator UI Plugin
 * Author: Glockoma
 * For Strawberry Jam (fork of Jam by sxip)
 * 
 * Allows viewing, intercepting, editing, and modifying login response packets.
 * 
 * WARNING: Manipulating login packets can result in account bans, instability, or data loss.
 * Use at your own risk.
 */

console.log("[LoginPacketManipulator] index.js loaded at " + new Date().toISOString());
(function () {
  // Function to initialize the plugin logic
  function initializePlugin() {
    if (!window.jam || !window.jam.dispatch || !window.jam.application || typeof window.jam.onPacket !== 'function') {
      console.error("[LoginPacketManipulator] Core not fully detected after jam-ready, window.jam:", window.jam);
      alert("Strawberry Jam core not fully initialized. This plugin must be run as a UI plugin. Please restart.");
      return;
    }

    // --- State ---
    let originalLoginPacket = null; // Store the full original packet
    let interceptEnabled = true; // Flag to enable/disable interception
    let unsubscribePacketListener = null; // To store the unsubscribe function
    let isActive = false; // Track if we're actively intercepting

    // --- DOM Elements ---
    const editorContainer = document.getElementById("login-packet-editor");
    const sendButton = document.getElementById("send-modified-login");
    const interceptInCheckbox = document.getElementById("intercept-in");
    const statusIndicator = document.getElementById("status-indicator");
    const saveConfigBtn = document.getElementById("save-config-btn");
    const loadConfigBtn = document.getElementById("load-config-btn");
    const fileInput = document.getElementById("file-input");
    const toastContainer = document.getElementById("toast-container");
    const paramsSection = document.getElementById("params-section");
    const paramsFields = document.getElementById("params-fields");

    // --- localStorage Keys ---
    const STORAGE_KEY_CONFIG = 'loginPacketManipulator_config';

    // --- Utility Functions ---
    function nowTime() {
      return new Date().toLocaleTimeString();
    }

    /**
     * Displays a toast notification
     * @param {string} message - The message to display
     * @param {string} type - The notification type: 'success', 'error', 'warning', or 'info'
     */
    function showToast(message, type = 'success') {
      if (!toastContainer) return;

      const toastClasses = {
        success: 'bg-highlight-green text-white',
        error: 'bg-error-red text-white',
        warning: 'bg-highlight-yellow text-black',
        info: 'bg-blue-400 text-white'
      };

      const $toast = $('<div>')
        .addClass(`px-4 py-2 rounded shadow-lg mb-2 flex items-center ${toastClasses[type] || toastClasses.info}`)
        .html(`
          <i class="fas fa-${
            type === 'success' ? 'check-circle' :
            type === 'error' ? 'times-circle' :
            type === 'warning' ? 'exclamation-circle' :
            'info-circle'
          } mr-2"></i>
          ${message}
        `);

      $(toastContainer).append($toast);

      // Log to main console for audit
      try {
        window.jam.application.consoleMessage({
          type: type === 'warning' ? 'warn' : type,
          message: "[LoginPacketManipulator] " + message
        });
      } catch (e) {
        console.error("[LoginPacketManipulator] Error sending console message:", e);
      }

      // Auto-remove toast after 3 seconds
      setTimeout(() => {
        $toast.css({
          'opacity': '0',
          'transition': 'opacity 0.5s'
        });
        setTimeout(() => $toast.remove(), 500);
      }, 3000);
    }

    /**
     * Updates the status indicator
     * @param {boolean} active - Whether the interceptor is active
     */
    function updateStatusIndicator(active) {
      if (!statusIndicator) return;
      
      isActive = active;
      
      if (active) {
        statusIndicator.classList.remove('bg-error-red/20', 'text-error-red');
        statusIndicator.classList.add('bg-highlight-green/20', 'text-highlight-green');
        statusIndicator.innerHTML = '<i class="fas fa-circle mr-1"></i> Active';
      } else {
        statusIndicator.classList.remove('bg-highlight-green/20', 'text-highlight-green');
        statusIndicator.classList.add('bg-error-red/20', 'text-error-red');
        statusIndicator.innerHTML = '<i class="fas fa-circle mr-1"></i> Inactive';
      }
    }

    /**
     * Saves the current configuration to a JSON file
     */
    function saveConfig() {
      if (!originalLoginPacket) {
        showToast("No login packet data to save", "warning");
        return;
      }

      try {
        // Create a config object with the current packet data
        const config = {
          timestamp: new Date().toISOString(),
          packet: originalLoginPacket
        };

        // Create a blob and download it
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `login-packet-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast("Configuration saved successfully", "success");
      } catch (error) {
        console.error("[LoginPacketManipulator] Error saving config:", error);
        showToast("Error saving configuration: " + error.message, "error");
      }
    }

    /**
     * Loads a configuration from a JSON file
     * @param {File} file - The file to load
     */
    async function loadConfig(file) {
      try {
        const text = await file.text();
        const config = JSON.parse(text);

        if (!config.packet || !config.packet.b || !config.packet.b.o) {
          throw new Error("Invalid configuration file format");
        }

        // Display the loaded packet
        displayLoginPacketEditor(config.packet);
        originalLoginPacket = config.packet;

        showToast("Configuration loaded successfully", "success");
        updateStatusIndicator(true);
      } catch (error) {
        console.error("[LoginPacketManipulator] Error loading config:", error);
        showToast("Error loading configuration: " + error.message, "error");
      }
    }

    // --- Editor Display (Incoming JSON) ---
    function displayLoginPacketEditor(packetObj) {
      if (!editorContainer) return;

      originalLoginPacket = packetObj; // Store the full packet
      const dataObject = packetObj?.b?.o;

      if (!dataObject) {
        showToast("Received packet is not the expected login structure", "warning");
        return;
      }

      editorContainer.innerHTML = ''; // Clear previous content
      showToast("Login packet received and displayed", "success");
      updateStatusIndicator(true);

      // Organize fields into sections
      const sections = {
        "Connection Info": ["_cmd", "sessionId", "userId", "dbUserId", "perUserAvId", "uuid", "status"],
        "User Info": ["userName", "userNameModerated", "avName", "email", "pendingEmail"],
        "Currency & Resources": [
          "gemsCount", "ticketsCount", "diamondsCount", "ecoCreditsCount", "ecoCredits",
          "orbsCount", "bambooCount", "woodCount", "goldCount", "silverCount", "strawCount",
          "stoneCount", "gemstoneCount"
        ],
        "Member Status": [
          "accountType", "subscriptionSourceType", "accountTypeChanged", 
          "numDaysLeftOnSubscription", "numAJHQGiftCards", "numAJHQBulkGiftCards", "dailyGiftIndex"
        ],
        "Chat & Privacy": [
          "statusId", "sgChatType", "sgChatTypeNonDegraded",
          "denPrivacySettings", "eCardPrivacySettings", "webWallStatus", "playerWallSettings"
        ],
        "User Flags & Stats": [
          "isModerator", "isGuide", "pendingFlags", "interactions",
          "hasOnlineBuddies", "recyclePercentage", "numLogins"
        ],
        "Den & Pet": ["activeDenRoomInvId", "activePetInvId"],
        "Activity Data": [
          "createdAt", "jamaaDate", "numRedemptionCards", "numUnreadECards",
          "lastBroadcastMessage"
        ],
        "Lists & Defs": ["newspaperDefs", "usableAdoptAPetDefs"]
      };

      // Create sections
      Object.entries(sections).forEach(([sectionName, fields]) => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'mb-6';
        
        const sectionTitle = document.createElement('h3');
        sectionTitle.className = 'text-base font-medium text-text-primary mb-2 border-b border-gray-700 pb-1';
        sectionTitle.textContent = sectionName;
        sectionDiv.appendChild(sectionTitle);

        // Add fields that exist in the packet
        let fieldsAdded = 0;
        fields.forEach(key => {
          if (key === "params") return; // Skip rendering params in the main editor
          if (key in dataObject) {
            fieldsAdded++;
            const value = dataObject[key];
            const valueType = typeof value;
            const isComplex = Array.isArray(value) || (value !== null && valueType === 'object');
            const valueString = isComplex ? JSON.stringify(value, null, 2) : String(value);

            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'flex flex-col sm:flex-row sm:items-center mb-2';

            const label = document.createElement('label');
            label.textContent = `${key}:`;
            label.className = 'w-full sm:w-1/4 font-medium text-gray-300 mb-1 sm:mb-0';
            label.htmlFor = `edit-${key}`;

            // Add tooltips for special fields
            if (key === 'statusId') {
              label.title = 'Login Status Code:\n-11: Account in use\n-12: Account maintenance\n-14: Too many connections\n-15: Banned user\n-16: Server maintenance\n-24: Client version mismatch';
            }
            else if (key === 'sgChatType' || key === 'sgChatTypeNonDegraded') {
              label.title = 'Chat Safety Type (2 = Restricted Mode)';
            }

            let inputElement;
            if (isComplex) {
              inputElement = document.createElement('textarea');
              inputElement.rows = 3;
              inputElement.className = 'w-full sm:w-3/4 p-1 bg-tertiary-bg text-text-primary border border-gray-600 rounded font-mono text-xs';
            } else if (valueType === 'boolean') {
              inputElement = document.createElement('select');
              inputElement.className = 'w-full sm:w-3/4 p-1 bg-tertiary-bg text-text-primary border border-gray-600 rounded text-xs';
              const optionTrue = document.createElement('option'); optionTrue.value = 'true'; optionTrue.textContent = 'true';
              const optionFalse = document.createElement('option'); optionFalse.value = 'false'; optionFalse.textContent = 'false';
              inputElement.appendChild(optionTrue); inputElement.appendChild(optionFalse);
              inputElement.value = String(value);
            } else {
              inputElement = document.createElement('input');
              inputElement.type = valueType === 'number' ? 'number' : 'text';
              inputElement.className = 'w-full sm:w-3/4 p-1 bg-tertiary-bg text-text-primary border border-gray-600 rounded text-xs';
            }

            inputElement.id = `edit-${key}`;
            inputElement.value = valueString;
            inputElement.dataset.key = key;
            inputElement.dataset.type = valueType;
            inputElement.dataset.isComplex = isComplex;

            fieldDiv.appendChild(label);
            fieldDiv.appendChild(inputElement);
            sectionDiv.appendChild(fieldDiv);
          }
        });

        // Only add section if it has fields
        if (fieldsAdded > 0) {
          editorContainer.appendChild(sectionDiv);
        }
      });

      // Add any remaining fields that weren't in predefined sections
      const remainingFields = Object.keys(dataObject).filter(key => 
        !Object.values(sections).flat().includes(key) && key !== "params"
      );

      if (remainingFields.length > 0) {
        const otherSection = document.createElement('div');
        otherSection.className = 'mb-6';
        
        const sectionTitle = document.createElement('h3');
        sectionTitle.className = 'text-base font-medium text-text-primary mb-2 border-b border-gray-700 pb-1';
        sectionTitle.textContent = 'Other Fields';
        otherSection.appendChild(sectionTitle);

        remainingFields.forEach(key => {
          const value = dataObject[key];
          const valueType = typeof value;
          const isComplex = Array.isArray(value) || (value !== null && valueType === 'object');
          const valueString = isComplex ? JSON.stringify(value, null, 2) : String(value);

          const fieldDiv = document.createElement('div');
          fieldDiv.className = 'flex flex-col sm:flex-row sm:items-center mb-2';

          const label = document.createElement('label');
          label.textContent = `${key}:`;
          label.className = 'w-full sm:w-1/4 font-medium text-gray-300 mb-1 sm:mb-0';
          label.htmlFor = `edit-${key}`;

          let inputElement;
          if (isComplex) {
            inputElement = document.createElement('textarea');
            inputElement.rows = 3;
            inputElement.className = 'w-full sm:w-3/4 p-1 bg-tertiary-bg text-text-primary border border-gray-600 rounded font-mono text-xs';
          } else if (valueType === 'boolean') {
            inputElement = document.createElement('select');
            inputElement.className = 'w-full sm:w-3/4 p-1 bg-tertiary-bg text-text-primary border border-gray-600 rounded text-xs';
            const optionTrue = document.createElement('option'); optionTrue.value = 'true'; optionTrue.textContent = 'true';
            const optionFalse = document.createElement('option'); optionFalse.value = 'false'; optionFalse.textContent = 'false';
            inputElement.appendChild(optionTrue); inputElement.appendChild(optionFalse);
            inputElement.value = String(value);
          } else {
            inputElement = document.createElement('input');
            inputElement.type = valueType === 'number' ? 'number' : 'text';
            inputElement.className = 'w-full sm:w-3/4 p-1 bg-tertiary-bg text-text-primary border border-gray-600 rounded text-xs';
          }

          inputElement.id = `edit-${key}`;
          inputElement.value = valueString;
          inputElement.dataset.key = key;
          inputElement.dataset.type = valueType;
          inputElement.dataset.isComplex = isComplex;

          fieldDiv.appendChild(label);
          fieldDiv.appendChild(inputElement);
          otherSection.appendChild(fieldDiv);
        });

        // Only add section if it has fields
        if (otherSection.children.length > 1) {
          editorContainer.appendChild(otherSection);
        }
      }

      // Render params as a flat list in the params-section
      if (dataObject.params && typeof dataObject.params === 'object' && paramsSection && paramsFields) {
        paramsSection.classList.remove("hidden");
        paramsFields.innerHTML = ""; // Clear previous params
        Object.entries(dataObject.params).forEach(([paramKey, paramValue]) => {
          const paramType = typeof paramValue;
          const isParamComplex = Array.isArray(paramValue) || (paramValue !== null && paramType === 'object');
          const paramValueString = isParamComplex ? JSON.stringify(paramValue, null, 2) : String(paramValue);

          const paramDiv = document.createElement('div');
          paramDiv.className = 'flex flex-col sm:flex-row sm:items-center mb-2';

          const paramLabel = document.createElement('label');
          paramLabel.textContent = `${paramKey}:`;
          paramLabel.className = 'w-full sm:w-1/3 font-medium text-gray-300 mb-1 sm:mb-0';
          paramLabel.htmlFor = `edit-${paramKey}`;

          let paramInput;
          if (isParamComplex) {
            paramInput = document.createElement('textarea');
            paramInput.rows = 3;
            paramInput.className = 'w-full sm:w-2/3 p-1 bg-tertiary-bg text-text-primary border border-gray-600 rounded font-mono text-xs';
          } else if (paramType === 'boolean') {
            paramInput = document.createElement('select');
            paramInput.className = 'w-full sm:w-2/3 p-1 bg-tertiary-bg text-text-primary border border-gray-600 rounded text-xs';
            const optionTrue = document.createElement('option'); optionTrue.value = 'true'; optionTrue.textContent = 'true';
            const optionFalse = document.createElement('option'); optionFalse.value = 'false'; optionFalse.textContent = 'false';
            paramInput.appendChild(optionTrue); paramInput.appendChild(optionFalse);
            paramInput.value = String(paramValue);
          } else {
            paramInput = document.createElement('input');
            paramInput.type = paramType === 'number' ? 'number' : 'text';
            paramInput.className = 'w-full sm:w-2/3 p-1 bg-tertiary-bg text-text-primary border border-gray-600 rounded text-xs';
          }

          paramInput.id = `edit-${paramKey}`;
          paramInput.value = paramValueString;
          paramInput.dataset.key = paramKey;
          paramInput.dataset.type = paramType;
          paramInput.dataset.isComplex = isParamComplex;

          paramDiv.appendChild(paramLabel);
          paramDiv.appendChild(paramInput);
          paramsFields.appendChild(paramDiv);
        });
      } else if (paramsSection) {
        // Hide params section if not present or elements not found
        paramsSection.classList.add("hidden");
      }

      if (sendButton) {
        sendButton.disabled = false; // Enable the send button
      }
    }

    // --- Send Modified Packet ---
    function sendModifiedLoginPacket() {
      if (!originalLoginPacket || !editorContainer || !sendButton) {
        showToast("Cannot send: Original packet or editor not found", "error");
        return;
      }

      showToast("Reconstructing and sending modified packet...", "info");
      sendButton.disabled = true; // Disable while processing

      try {
        // Reconstruct the 'o' object, including nested 'params'
        const modifiedO = {};
        const modifiedParams = {};

        // Query the whole document to get inputs from both main editor and params section
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
          // Skip inputs without a data-key (e.g., the intercept checkbox)
          if (!input.dataset.key) return; 
          
          const key = input.dataset.key;
          const originalType = input.dataset.type;
          const isComplex = input.dataset.isComplex === 'true';
          let newValue = input.value;
          let targetObject = modifiedO; // Default to main 'o' object

          // Determine if this key belongs to the 'params' object
          if (originalLoginPacket.b.o.params && key in originalLoginPacket.b.o.params) {
             targetObject = modifiedParams;
          }

          try {
            if (isComplex) {
              newValue = JSON.parse(newValue); // Parse complex types from JSON string
            } else if (originalType === 'number') {
              newValue = Number(newValue);
              if (isNaN(newValue)) throw new Error(`Invalid number format for ${key}`);
            } else if (originalType === 'boolean') {
              newValue = newValue === 'true';
            }
            // Strings remain strings
            targetObject[key] = newValue;
          } catch (parseError) {
             showToast(`Error parsing value for '${key}': ${parseError.message}. Using original value.`, "warning");
             // Keep original value if parsing fails
             if (targetObject === modifiedParams) {
                targetObject[key] = originalLoginPacket.b.o.params[key];
             } else {
                targetObject[key] = originalLoginPacket.b.o[key];
             }
          }
        });

        // Add the reconstructed 'params' object back to 'o'
        if (Object.keys(modifiedParams).length > 0) {
           modifiedO.params = modifiedParams;
        } else if (originalLoginPacket.b.o.params) {
           // If params existed but no inputs were found (e.g., empty object), keep original
           modifiedO.params = originalLoginPacket.b.o.params;
        }

        // Create the new full packet structure
        const modifiedPacket = {
          ...originalLoginPacket, // Copy top-level keys like 't'
          b: {
            ...originalLoginPacket.b, // Copy other keys within 'b' like 'r'
            o: modifiedO // Use the modified 'o' object
          }
        };

        const modifiedJsonString = JSON.stringify(modifiedPacket);

        // Send to client
        window.jam.dispatch.sendConnectionMessage(modifiedJsonString);
        showToast("Modified login packet sent successfully!", "success");

      } catch (error) {
        showToast(`Error sending modified packet: ${error.message}`, "error");
        console.error("[LoginPacketManipulator] Error sending modified packet:", error);
      } finally {
         // Re-enable button after a short delay to prevent rapid clicks
         setTimeout(() => { if (sendButton) sendButton.disabled = false; }, 500);
      }
    }

    // --- Packet Hooking ---
    try {
      // Store the unsubscribe function returned by onPacket
      unsubscribePacketListener = window.jam.onPacket(function (packetData) {
        if (!interceptEnabled || !packetData || packetData.direction !== 'in') {
          return; // Only process incoming packets if enabled
        }

        try {
          const parsedPacket = JSON.parse(packetData.raw);
          // Check for the specific login packet structure
          if (parsedPacket && parsedPacket.t === 'xt' && parsedPacket.b && parsedPacket.b.o && parsedPacket.b.o._cmd === 'login') {
            displayLoginPacketEditor(parsedPacket);
          }
        } catch (e) {
          // Ignore packets that are not valid JSON or don't match
        }
      });
      // Packet listener set up successfully (no toast needed)
    } catch (err) {
      console.error("[LoginPacketManipulator] Error setting up incoming packet subscription:", err);
      showToast("Error setting up incoming packet listener: " + err.message, "error");
    }

    // --- UI Event Handlers ---
    // Incoming Intercept Checkbox
    if (interceptInCheckbox) {
      interceptInCheckbox.checked = interceptEnabled;
      interceptInCheckbox.addEventListener("change", function () {
        interceptEnabled = this.checked;
        showToast("Incoming packet interception " + (interceptEnabled ? "enabled" : "disabled"), interceptEnabled ? "success" : "warning");
        
        if (!interceptEnabled) {
           // Clear editor and disable button if interception is turned off
           if (editorContainer) editorContainer.innerHTML = '<p class="text-gray-400 italic">Interception disabled. Enable to see login packet.</p>';
           if (sendButton) sendButton.disabled = true;
           originalLoginPacket = null;
           updateStatusIndicator(false);
        }
      });
    }

    // Save Config Button
    if (saveConfigBtn) {
      saveConfigBtn.addEventListener("click", saveConfig);
    }

    // Load Config Button
    if (loadConfigBtn) {
      loadConfigBtn.addEventListener("click", function() {
        if (fileInput) fileInput.click();
      });
    }

    // File Input Change
    if (fileInput) {
      fileInput.addEventListener("change", function(event) {
        const file = event.target.files[0];
        if (file) {
          loadConfig(file);
        }
        // Reset the input so the same file can be selected again
        fileInput.value = '';
      });
    }

    // Send Modified Incoming JSON Button
    if (sendButton) {
      sendButton.addEventListener("click", sendModifiedLoginPacket);
    }

    // Initial state
    updateStatusIndicator(false);
    // No initialization toast needed
  }

  // Set up the minimize button functionality with proper DOM content loaded check
  document.addEventListener('DOMContentLoaded', function() {
    const minimizeBtn = document.getElementById('minimize-btn');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        if (window.jam && window.jam.application) {
          window.jam.application.minimize();
        } else {
          // Fallback if jam.application is not available
          try {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('window-minimize');
          } catch (e) {
            console.error("[LoginPacketManipulator] Error minimizing window:", e);
          }
        }
      });
    }
  });

  // Wait for the jam-ready event before initializing
  if (window.jam && window.jam.dispatch && window.jam.application && typeof window.jam.onPacket === 'function') {
    initializePlugin();
  } else {
    window.addEventListener('jam-ready', initializePlugin, { once: true });
  }

  // Add cleanup listener for window close
  window.addEventListener('beforeunload', () => {
    // Unsubscribe from incoming listener
    if (typeof unsubscribePacketListener === 'function') {
      try {
        unsubscribePacketListener();
        console.log("[LoginPacketManipulator] Unsubscribed from incoming packet listener.");
      } catch (e) {
        console.error("[LoginPacketManipulator] Error unsubscribing from incoming packet listener:", e);
      }
    }
  });
})();
