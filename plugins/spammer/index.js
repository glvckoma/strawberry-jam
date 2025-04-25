function waitForDispatch(callback) {
  if (window.jam && window.jam.dispatch) {
    callback(window.jam.dispatch);
  } else {
    setTimeout(() => waitForDispatch(callback), 50);
  }
}

waitForDispatch(function(dispatch) {
  /**
   * Elements
   */
  const input = document.getElementById('inputTxt')
const inputType = document.getElementById('inputType')
const inputDelay = document.getElementById('inputDelay')
const inputRunType = document.getElementById('inputRunType')
const stopButton = document.getElementById('stopButton')
const runButton = document.getElementById('runButton')
const table = document.getElementById('table')

// Initial button states
stopButton.disabled = true

const tab = ' '.repeat(2)

let runner
let runnerType
let runnerRow
let activeRow = null
let continueRunning = false // Flag to continue running background tasks

// Track if we're using Electron
let isElectron = false;
try {
  isElectron = window && window.process && window.process.type === 'renderer';
} catch (e) {
  console.log('[Spammer] Not running in Electron environment');
}

// Try to get the electron modules if available
let ipcRenderer;
if (isElectron) {
  try {
    const electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
    
    // Set up an IPC channel for background packet sending
    if (ipcRenderer) {
      console.log('[Spammer] Setting up IPC communication for background processing');
      
      // Listen for signals from main process to continue packet execution
      ipcRenderer.on('spammer-process-next-packet', () => {
        if (continueRunning) {
          console.log('[Spammer] Received IPC signal to process next packet');
          executeNextPacket();
        }
      });
      
      // Register this plugin instance with the main process
      ipcRenderer.send('spammer-register');
    }
  } catch (e) {
    console.error('[Spammer] Error setting up Electron IPC:', e);
  }
}

// Create a shared storage key for cross-window/tab communication
const STORAGE_KEY = 'strawberry-jam-spammer-state';

// Function to save state to localStorage for persistence
function saveState() {
  if (window.localStorage) {
    try {
      const state = {
        running: continueRunning,
        lastUpdate: Date.now()
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[Spammer] Error saving state to localStorage:', e);
    }
  }
}

// Function to load state from localStorage
function loadState() {
  if (window.localStorage) {
    try {
      const stateStr = window.localStorage.getItem(STORAGE_KEY);
      if (stateStr) {
        const state = JSON.parse(stateStr);
        
        // If the state is relatively fresh (last updated in the past 5 minutes)
        // and was running, we might need to restart
        const stateAge = Date.now() - state.lastUpdate;
        if (state.running && stateAge < 300000) { // 5 minutes in ms
          console.log('[Spammer] Found saved running state, considering restart');
          
          // Only auto-restart if we have packets in the queue (will be loaded later)
          // This just flags that we'll want to restart after UI is fully loaded
          window._spammerShouldRestart = true;
        }
      }
    } catch (e) {
      console.error('[Spammer] Error loading state from localStorage:', e);
    }
  }
}

// Try to load the state as soon as possible
loadState();

// Create a background worker for off-focus processing
const backgroundWorkerCode = `
  let intervalId = null;
  let keepAliveId = null;
  let superKeepAliveId = null;
  
  // Add a timestamp function for logging
  function timestamp() {
    return new Date().toISOString().substring(11, 23);
  }
  
  self.onmessage = function(e) {
    const { command, delay } = e.data;
    
    if (command === 'start') {
      console.log('[Worker ' + timestamp() + '] Starting timers with delay ' + delay + 'ms');
      
      // Start the timer that will post messages back at the specified interval
      clearInterval(intervalId); // Clear any existing interval
      clearInterval(keepAliveId); // Clear any existing keep-alive interval
      clearInterval(superKeepAliveId); // Clear super keep-alive
      
      intervalId = setInterval(() => {
        self.postMessage({ type: 'tick' });
      }, delay);
      
      // Add a separate high-priority keep-alive timer that runs frequently
      keepAliveId = setInterval(() => {
        self.postMessage({ type: 'keepAlive' });
      }, 500); // Run every 500ms regardless of packet delay
      
      // Add an ultra high-priority keep-alive that runs very frequently
      // This is specifically to maintain activity during fullscreen mode
      superKeepAliveId = setInterval(() => {
        self.postMessage({ type: 'superKeepAlive' });
      }, 100); // Run every 100ms to prevent throttling
    } 
    else if (command === 'stop') {
      console.log('[Worker ' + timestamp() + '] Stopping all timers');
      clearInterval(intervalId);
      clearInterval(keepAliveId);
      clearInterval(superKeepAliveId);
      intervalId = null;
      keepAliveId = null;
      superKeepAliveId = null;
    }
    else if (command === 'ping') {
      // Just send back a pong message to confirm worker is still alive
      self.postMessage({ type: 'pong', timestamp: Date.now() });
    }
  };
  
  // Create a heartbeat to maintain activity, even if main thread is throttled
  setInterval(() => {
    self.postMessage({ type: 'heartbeat', timestamp: Date.now() });
  }, 2000);
`;

// Create blob and worker
const blob = new Blob([backgroundWorkerCode], { type: 'application/javascript' });
const backgroundWorker = new Worker(URL.createObjectURL(blob));

// Track worker responsiveness
let lastWorkerResponse = Date.now();
let workerMonitorInterval;

// Function to monitor worker health and restart if needed
function startWorkerMonitoring() {
  if (workerMonitorInterval) {
    clearInterval(workerMonitorInterval);
  }
  
  workerMonitorInterval = setInterval(() => {
    const workerSilentTime = Date.now() - lastWorkerResponse;
    
    // If worker hasn't responded in 5 seconds, it might be throttled
    if (workerSilentTime > 5000 && continueRunning) {
      console.log('[Spammer] Worker unresponsive for 5+ seconds, sending ping');
      
      // Ping the worker to see if it's still alive
      backgroundWorker.postMessage({ command: 'ping' });
      
      // After 10 seconds of silence, try to restart the worker
      if (workerSilentTime > 10000) {
        console.log('[Spammer] Worker unresponsive for 10+ seconds, restarting worker');
        
        // Try to restart the worker with the current configuration
        restartWorker();
      }
    }
  }, 2000); // Check every 2 seconds
}

// Function to restart the worker
function restartWorker() {
  try {
    // Terminate the old worker
    backgroundWorker.terminate();
    
    // Create a new worker
    const newBlob = new Blob([backgroundWorkerCode], { type: 'application/javascript' });
    const newWorker = new Worker(URL.createObjectURL(newBlob));
    
    // Set up the message handler for the new worker
    newWorker.onmessage = backgroundWorker.onmessage;
    
    // Replace the old worker reference
    backgroundWorker = newWorker;
    
    // Start the timers again
    const firstRow = table.rows[1];
    const delay = firstRow ? parseInt(firstRow.cells[2].innerText) || 1000 : 1000;
    
    backgroundWorker.postMessage({ 
      command: 'start', 
      delay: delay 
    });
    
    console.log('[Spammer] Worker successfully restarted');
    
    // Force an immediate packet execution
    executeNextPacket();
    
  } catch (error) {
    console.error('[Spammer] Error restarting worker:', error);
  }
}

// Set up message handler for worker
backgroundWorker.onmessage = function(e) {
  // Update last response time for any message
  lastWorkerResponse = Date.now();
  
  if (e.data.type === 'tick' && continueRunning) {
    // Execute the next packet in the queue
    executeNextPacket();
  } else if (e.data.type === 'keepAlive' && continueRunning) {
    // Keep the worker active, but don't execute packets on every keepAlive
    // Just ensure connection is alive by accessing the dispatch object
    if (window.jam && window.jam.dispatch) {
      try {
        // Use a no-op that just keeps things active
        window.jam.dispatch.getStateSync('keepAlive');
      } catch (error) {
        // Ignore errors here
      }
    }
  } else if (e.data.type === 'superKeepAlive' && continueRunning) {
    // Ultra high frequency keep-alive for fullscreen situations
    // This just keeps the thread alive, no actual operations
  } else if (e.data.type === 'heartbeat' && continueRunning) {
    // Regular heartbeat from worker, use this to update state and
    // potentially sync with main process
    saveState();
    
    // Use IPC if available to coordinate with main process
    if (ipcRenderer) {
      ipcRenderer.send('spammer-heartbeat', {
        running: continueRunning,
        timestamp: e.data.timestamp
      });
    }
  } else if (e.data.type === 'pong') {
    console.log('[Spammer] Received pong from worker, confirming it is alive');
  }
};

// Keep track of window visibility state
let windowIsVisible = true;
let lastActivity = Date.now();
let activityCheckInterval;
let fullscreenDetectionInterval;

// Periodically check for fullscreen state
function startFullscreenDetection() {
  if (fullscreenDetectionInterval) {
    clearInterval(fullscreenDetectionInterval);
  }
  
  fullscreenDetectionInterval = setInterval(() => {
    // Check if any element is in fullscreen mode
    const isFullscreen = document.fullscreenElement || 
                        document.webkitFullscreenElement || 
                        document.mozFullScreenElement || 
                        document.msFullscreenElement;
    
    if (isFullscreen && continueRunning) {
      console.log('[Spammer] Detected fullscreen mode, ensuring packets continue');
      
      // If we have IPC available, ask main process to help maintain activity
      if (ipcRenderer) {
        ipcRenderer.send('spammer-fullscreen-detected', {
          running: continueRunning
        });
      }
      
      // Force a ping and packet execution to keep things active
      ping();
      executeNextPacket();
    }
  }, 2000); // Check every 2 seconds
}

// Detect user activity to keep the worker alive
function detectActivity() {
  lastActivity = Date.now();
  if (!activityCheckInterval && continueRunning) {
    startActivityMonitoring();
  }
}

// Start monitoring for inactivity
function startActivityMonitoring() {
  if (activityCheckInterval) {
    clearInterval(activityCheckInterval);
  }
  
  activityCheckInterval = setInterval(() => {
    const inactiveTime = Date.now() - lastActivity;
    
    // If inactive for more than 10 seconds and packets should be running,
    // send a ping to keep things alive
    if (inactiveTime > 10000 && continueRunning) {
      console.log('[Spammer] Sending keep-alive ping due to inactivity');
      ping();
    }
  }, 5000); // Check every 5 seconds
}

// Ping function to keep connections alive
function ping() {
  // Try to use the dispatch to send a minimal "ping" message
  try {
    if (window.jam && window.jam.dispatch) {
      // This is a minimal no-op that just ensures the connection is active
      window.jam.dispatch.getStateSync('ping');
    }
  } catch(e) {
    console.log('[Spammer] Ping error:', e);
  }
  
  lastActivity = Date.now();
}

// Listen to various events to detect user activity
document.addEventListener('mousemove', detectActivity);
document.addEventListener('keydown', detectActivity);
document.addEventListener('click', detectActivity);

// Listen for visibility changes
document.addEventListener('visibilitychange', function() {
  windowIsVisible = !document.hidden;
  console.log(`[Spammer] Window visibility changed to: ${windowIsVisible ? 'visible' : 'hidden'}`);
  
  detectActivity(); // Register this as an activity
  
  // Make sure the worker keeps running even when window is not visible
  if (!windowIsVisible && continueRunning) {
    console.log('[Spammer] Window hidden but spammer still running');
    
    // Update status feedback if window is still partially visible
    const feedbackArea = document.getElementById('statusFeedback');
    if (feedbackArea) {
      feedbackArea.innerText = "Spammer running in background";
      feedbackArea.style.color = "#38b000";
    }
    
    // Force a ping to ensure connection stays active
    ping();
  }
});

// Additional event handler for when the window loses focus
window.addEventListener('blur', function() {
  if (continueRunning) {
    console.log('[Spammer] Window lost focus but spammer still running');
    // Force a ping to ensure connection stays active
    ping();
  }
});

// When the window regains focus, trigger an immediate packet if running
window.addEventListener('focus', function() {
  if (continueRunning) {
    console.log('[Spammer] Window regained focus, ensuring packets continue');
    executeNextPacket();
  }
});

class Spammer {
  constructor () {
    /**
     * Handles input events for tab support in textarea
     */
    input.onkeydown = e => {
      const keyCode = e.which

      if (keyCode === 9) {
        e.preventDefault()

        const s = input.selectionStart
        input.value = input.value.substring(0, input.selectionStart) + tab + input.value.substring(input.selectionEnd)
        input.selectionEnd = s + tab.length
      }
    }
    
    // Add notice about room placeholder usage
    if (input && input.value && input.value.includes('{room}')) {
      console.log('[Spammer] Found {room} placeholder in packet. Will try to replace with current room ID.');
      console.log('[Spammer] If using getStateSync is not available, placeholder will be handled by main application.');
    }
  }

  /**
   * Sends a packet
   * @param {string|string[]} content - The packet content
   * @param {string} type - The packet type (aj or connection)
   */
  async sendPacket (content, type) {
    if (!content) return

    content = content || input.value

    // Get room ID using multiple fallback methods to ensure we have it
    let roomFromDispatch;
    try {
      // First try the synchronous method (preferred)
      if (window.jam.dispatch && window.jam.dispatch.getStateSync) {
        roomFromDispatch = window.jam.dispatch.getStateSync('room');
      }
      // Fall back to the promise-based method if necessary
      else if (window.jam.dispatch && window.jam.dispatch.getState) {
        // Don't await here - we'll check below if it's a promise
        roomFromDispatch = window.jam.dispatch.getState('room');
        console.log('[Spammer] Got room ID using getState (possibly a Promise)');
      } else {
        console.warn('[Spammer] Neither getStateSync nor getState methods are available');
      }
    } catch (error) {
      console.error('[Spammer] Error getting room state:', error);
    }

    // Allow packets without {room} placeholders to be sent even if we can't get room state
    const needsRoom = (typeof content === 'string' && content.includes('{room}')) || 
                     (Array.isArray(content) && content.some(msg => msg.includes('{room}')));
                     
    const roomFromState = window.jam?.state?.room;
    
    // Determine which room value to use
    let room;
    
    // If roomFromDispatch is a Promise, use roomFromState as immediate fallback
    if (roomFromDispatch && typeof roomFromDispatch.then === 'function') {
      console.log('[Spammer] Dispatch returned a Promise, using state room instead');
      room = roomFromState;
    } else {
      // Otherwise use the first non-null value
      room = roomFromDispatch || roomFromState;
    }

    // If we need a room ID but don't have one, we have a few options
    if (!room && needsRoom) {
      console.warn('[Spammer] Room ID needed but not available');
      
      // For UI feedback
      const feedbackArea = document.getElementById('statusFeedback');
      if (feedbackArea) {
        feedbackArea.innerText = "Warning: Room ID not available - {room} placeholders won't be replaced";
        feedbackArea.style.color = "orange";
        // Clear the message after 5 seconds
        setTimeout(() => {
          feedbackArea.innerText = "";
        }, 5000);
      }
      
      console.warn('[Spammer] The main application may try to process the placeholder');
    }

    // Process array content
    if (Array.isArray(content)) {
      const processedMessages = content.map(msg => {
        if (msg.includes('{room}')) {
          if (!room) {
            return msg // Return unmodified if room is not available
          }
          return msg.replaceAll('{room}', room)
        }
        return msg
      })

      return dispatch.sendMultipleMessages({
        type,
        messages: processedMessages
      })
    }

    // Process single content string
    if (content.includes('{room}')) {
      if (!room) {
      } else {
        const originalContent = content;
        content = content.replaceAll('{room}', room);
        console.log(`[Spammer] Successfully replaced {room} with ${room}`);
      }
    }

    try {
      if (type === 'aj') dispatch.sendRemoteMessage(content)
      else dispatch.sendConnectionMessage(content)
    } catch (error) {
      console.error('Error sending packet:', error)
    }
  }

  /**
   * Adds a packet to the queue
   */
  addClick () {
    if (!input.value) return

    const type = inputType.value
    const content = input.value
    const delay = inputDelay.value

    const row = table.insertRow(-1)
    row.className = 'hover:bg-tertiary-bg/20 transition'

    const typeCell = row.insertCell(0)
    const contentCell = row.insertCell(1)
    const delayCell = row.insertCell(2)
    const actionCell = row.insertCell(3)

    typeCell.className = 'py-2 px-3 text-xs'
    contentCell.className = 'py-2 px-3 text-xs truncate max-w-[300px]'
    delayCell.className = 'py-2 px-3 text-xs'
    actionCell.className = 'py-2 px-3 text-xs'

    typeCell.innerText = type
    contentCell.innerText = content
    delayCell.innerText = delay

    // Add tooltip for full content
    contentCell.title = content

    actionCell.innerHTML = `
      <button type="button" class="px-2 py-1 bg-tertiary-bg hover:bg-sidebar-hover text-text-primary rounded-md transition text-xs" onclick="spammer.deleteRow(this)">
        <i class="fas fa-trash-alt"></i>
      </button>
    `
  }

  /**
   * Deletes a row from the queue
   */
  deleteRow (btn) {
    const row = btn.closest('tr')
    row.parentNode.removeChild(row)
  }

  /**
   * Sends the current packet
   */
  sendClick () {
    const content = input.value
    if (!content) return

    const type = inputType.value

    try {
      const packets = content.match(/[^\r\n]+/g)
      if (packets && packets.length > 1) {
        this.sendPacket(packets, type)
      } else {
        this.sendPacket(content, type)
      }
    } catch (error) {
      console.error('Error sending packet:', error)
    }
  }

  /**
   * Starts running the queue
   */
  runClick () {
    if (table.rows.length <= 1) {
      return
    }

    stopButton.disabled = false
    runButton.disabled = true
    runnerRow = 0
    runnerType = inputRunType.value
    continueRunning = true

    // Save state to localStorage for persistence
    saveState();

    // Get feedback area and update status
    const feedbackArea = document.getElementById('statusFeedback');
    if (feedbackArea) {
      feedbackArea.innerText = "Spammer is running in background mode";
      feedbackArea.style.color = "#38b000"; // Green color for success
    }

    // Ensure we're detecting activity
    detectActivity();
    startActivityMonitoring();
    startWorkerMonitoring();
    startFullscreenDetection();
    
    // Notify main process if we have IPC
    if (ipcRenderer) {
      ipcRenderer.send('spammer-started', {
        timestamp: Date.now()
      });
    }

    // Start the background worker with the first packet's delay
    const firstRow = table.rows[1]; // Use the first actual row (index 1), not the header
    const delay = firstRow ? parseInt(firstRow.cells[2].innerText) || 1000 : 1000;
    
    backgroundWorker.postMessage({ 
      command: 'start', 
      delay: delay 
    });
    
    // Also run the first packet immediately
    this.runNext();
  }

  /**
   * Processes the next packet in the queue
   */
  runNext () {
    if (activeRow) {
      activeRow.classList.remove('bg-tertiary-bg/40')
    }

    const row = table.rows[runnerRow++]

    if (!row) {
      if (runnerType === 'loop') {
        runnerRow = 0
        // Continue in background mode - worker will trigger executeNextPacket()
        
        // Force the packet sending to continue even if window is not focused
        if (!windowIsVisible) {
          console.log('[Spammer] Window not visible, continuing loop in background');
          
          // Use a small delay to ensure we don't overload the system
          setTimeout(() => {
            if (continueRunning) {
              executeNextPacket();
            }
          }, 100);
        }
        return
      } else {
        // If not looping, stop the background worker
        this.stopClick()
        return
      }
    }

    // Highlight the current row
    row.classList.add('bg-tertiary-bg/40')
    activeRow = row

    // Get data from current row
    const type = row.cells[0].innerText
    const content = row.cells[1].innerText
    const delay = parseInt(row.cells[2].innerText) || 1000

    // Send the packet
    try {
      const packets = content.match(/[^\r\n]+/g)
      if (packets && packets.length > 1) {
        this.sendPacket(packets, type)
      } else {
        this.sendPacket(content, type)
      }
    } catch (error) {
      console.error('Error sending packet:', error)
    }

    // Update the worker with the current delay
    backgroundWorker.postMessage({ 
      command: 'start', 
      delay: delay 
    });
  }

  /**
   * Stop running the queue
   */
  stopClick () {
    continueRunning = false
    
    // Update localStorage
    saveState();
    
    // Stop the background worker
    backgroundWorker.postMessage({ command: 'stop' });
    
    // Stop all monitoring intervals
    if (activityCheckInterval) {
      clearInterval(activityCheckInterval);
      activityCheckInterval = null;
    }
    
    if (workerMonitorInterval) {
      clearInterval(workerMonitorInterval);
      workerMonitorInterval = null;
    }
    
    if (fullscreenDetectionInterval) {
      clearInterval(fullscreenDetectionInterval);
      fullscreenDetectionInterval = null;
    }
    
    // Notify main process if we have IPC
    if (ipcRenderer) {
      ipcRenderer.send('spammer-stopped', {
        timestamp: Date.now()
      });
    }
    
    if (activeRow) {
      activeRow.classList.remove('bg-tertiary-bg/40')
      activeRow = null
    }

    stopButton.disabled = true
    runButton.disabled = false

    // Update status feedback
    const feedbackArea = document.getElementById('statusFeedback');
    if (feedbackArea) {
      feedbackArea.innerText = "Spammer stopped";
      feedbackArea.style.color = "orange";
      
      // Clear the message after 3 seconds
      setTimeout(() => {
        feedbackArea.innerText = "";
      }, 3000);
    }
  }

  /**
   * Saves the current queue to a file
   */
  saveToFile () {
    const packets = []
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i]
      const type = row.cells[0].innerText
      const content = row.cells[1].innerText
      const delay = row.cells[2].innerText
      packets.push({ type, content, delay })
    }

    const data = {
      input: input.value,
      packets: packets
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'packet-queue.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  /**
   * Loads a queue from a file
   */
  loadFromFile () {
    const inputElement = document.createElement('input')
    inputElement.type = 'file'
    inputElement.accept = '.json,.txt'

    inputElement.onchange = async (event) => {
      try {
        const file = event.target.files[0]
        if (!file) return

        console.log('[Spammer] Loading file:', file.name)
        
        const text = await file.text()
        let data

        // Try to parse as JSON
        try {
          data = JSON.parse(text)
          console.log('[Spammer] Successfully parsed file as JSON')
        } catch (jsonError) {
          console.error('[Spammer] JSON parse error:', jsonError)
          console.log('[Spammer] Attempting to handle as plain text file')
          
          // Handle plain text file with each line as a packet
          const lines = text.split('\n').filter(line => line.trim().length > 0)
          
          if (lines.length > 0) {
            data = {
              input: lines[0],
              packets: lines.map(line => ({
                type: 'aj',
                content: line,
                delay: '0.5'
              }))
            }
            console.log('[Spammer] Created packet data from text file with', lines.length, 'lines')
          } else {
            console.error('[Spammer] File appears to be empty')
            return
          }
        }

        input.value = data.input || ''
        console.log('[Spammer] Set input value to:', input.value)

        // Clear existing rows except header
        while (table.rows.length > 1) {
          table.deleteRow(1)
        }

        // Add packets from file
        if (data.packets && Array.isArray(data.packets)) {
          console.log('[Spammer] Loading', data.packets.length, 'packets')
          
          data.packets.forEach(packet => {
            const row = table.insertRow(-1)
            row.className = 'hover:bg-tertiary-bg/20 transition'

            const typeCell = row.insertCell(0)
            const contentCell = row.insertCell(1)
            const delayCell = row.insertCell(2)
            const actionCell = row.insertCell(3)

            typeCell.className = 'py-2 px-3 text-xs'
            contentCell.className = 'py-2 px-3 text-xs truncate max-w-[300px]'
            delayCell.className = 'py-2 px-3 text-xs'
            actionCell.className = 'py-2 px-3 text-xs'

            typeCell.innerText = packet.type || 'aj'  // Default to 'aj' if not specified
            contentCell.innerText = packet.content
            delayCell.innerText = packet.delay || '0.5'  // Default to 0.5 if not specified

            // Add tooltip for full content
            contentCell.title = packet.content

            actionCell.innerHTML = `
              <button type="button" class="px-2 py-1 bg-tertiary-bg hover:bg-sidebar-hover text-text-primary rounded-md transition text-xs" onclick="spammer.deleteRow(this)">
                <i class="fas fa-trash-alt"></i>
              </button>
            `
          })
          
          console.log('[Spammer] Successfully loaded packets into table')
        } else {
          console.error('[Spammer] No packets found in file or invalid format')
        }
      } catch (error) {
        console.error('[Spammer] Error loading file:', error)
      }
    }

    inputElement.click()
  }
}

// Function to execute the next packet in the queue (called by the worker)
function executeNextPacket() {
  if (!continueRunning) return;
  
  // Record this as activity
  detectActivity();
  
  // Only proceed if we have a valid spammer instance
  if (window.spammer && typeof window.spammer.runNext === 'function') {
    // For fullscreen mode, we need to be more aggressive about execution
    // Instead of using requestAnimationFrame which might be throttled,
    // execute directly with a small timeout to ensure it runs
    setTimeout(() => {
      try {
        window.spammer.runNext();
      } catch (error) {
        console.error('[Spammer] Error in executeNextPacket:', error);
        
        // Ensure we don't stop the entire process if one packet fails
        if (continueRunning) {
          console.log('[Spammer] Continuing despite error');
          setTimeout(() => {
            if (continueRunning) {
              backgroundWorker.postMessage({ 
                command: 'start', 
                delay: 1000 // Default to 1 second if we can't get the current delay
              });
            }
          }, 1000);
        }
      }
    }, 0);
  }
}

// Global instance
window.spammer = new Spammer()

// Check if we should automatically restart based on saved state
setTimeout(() => {
  if (window._spammerShouldRestart && table.rows.length > 1) {
    console.log('[Spammer] Auto-restarting based on saved state');
    window.spammer.runClick();
    delete window._spammerShouldRestart;
  }
}, 1000); // Wait 1 second after initialization before auto-restarting

// Only stop the spammer when the window is actually being closed, not just losing focus
window.addEventListener('beforeunload', function(event) {
  // Only stop if we're actually closing the window, not just switching focus
  if (event.currentTarget.performance && event.currentTarget.performance.navigation.type !== 1) {
    spammer.stopClick();
  }
});
  
// Set up the minimize button functionality
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
        console.error("[Spammer] Error minimizing window:", e);
      }
    }
  });
}
});
