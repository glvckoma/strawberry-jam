const __init__ = async () => {
  const isPluginPage = window.location.pathname.includes('plugins')

  const cssPath = 'app://assets/css/style.css'

  const link = document.createElement('link')
  link.setAttribute('rel', 'stylesheet')
  link.setAttribute('href', cssPath)

  document.head.appendChild(link)

  if (isPluginPage) {
    window.jQuery = window.$ = require('jquery')
  }
}

window.__init__ = __init__

document.addEventListener('DOMContentLoaded', window.__init__)

console.log('[Preload] Main application preload script executed (contextIsolation: false).'); // Added note

// Expose jam.onPacket for UI plugins to receive live packet events
try {
  const { ipcRenderer } = require('electron');
  console.log("[Preload] Setting up window.jam.onPacket...");
  
  // Ensure window.jam exists
  window.jam = window.jam || {};

  // Define onPacket function, only if it doesn't exist
  if (!window.jam.onPacket) {
    window.jam.onPacket = function (callback) {
      if (typeof callback !== 'function') {
        console.error("[Preload] Invalid callback provided to jam.onPacket");
        return function unsubscribe() {}; // Return no-op unsubscribe
      }

      const listener = (event, packetData) => {
        try {
          // Simply forward the packet data to the registered callback
          callback(packetData);
        } catch (err) {
          console.error("[Preload] Error in packet callback:", err);
        }
      };
      
      ipcRenderer.on('packet-event', listener);
      
      // Return an unsubscribe function
      return function unsubscribe() {
        try {
          ipcRenderer.removeListener('packet-event', listener);
          console.log("[Preload] Unsubscribed listener from packet-event.");
        } catch (e) {
           console.error("[Preload] Error removing packet-event listener:", e);
        }
      };
    }; 
    console.log("[Preload] Successfully set up window.jam.onPacket.");
  } else {
    console.log("[Preload] window.jam.onPacket already exists, skipping setup.");
  }
} catch (e) {
  console.error("[Preload] Error setting up window.jam.onPacket:", e);
}

// Expose room tracking utilities needed by plugins
try {
  const roomUtils = require('../utils/room-tracking'); // Adjust path relative to preload.js
  console.log("[Preload] Setting up window.jam.roomUtils...");

  // Ensure window.jam exists
  window.jam = window.jam || {};

  // Expose specific utility function
  window.jam.roomUtils = {
    getEffectiveRoomId: roomUtils.getEffectiveRoomId
  };

  console.log("[Preload] Successfully set up window.jam.roomUtils.");
} catch (e) {
  console.error("[Preload] Error setting up window.jam.roomUtils:", e);
}
