const Application = require('./application')
const { ipcRenderer } = require('electron')

const application = new Application()

// Track session start time
let sessionStartTime = null;

/**
 * Updates the connection status indicator in the UI.
 * @param {boolean} connected - Whether the client is connected
 */
const updateConnectionStatus = (connected) => {
  // Get footer-based status element
  const statusElement = document.getElementById('connection-status')
  if (!statusElement) return
  
  // Update status for footer indicator
  if (connected) {
    // Connected state
    statusElement.querySelector('span:first-child').classList.remove('bg-error-red')
    statusElement.querySelector('span:first-child').classList.add('bg-highlight-green')
    statusElement.querySelector('span:last-child').textContent = 'Connected'
    statusElement.querySelector('span:first-child').classList.remove('pulse-animation')
    statusElement.querySelector('span:first-child').classList.add('pulse-green')
    statusElement.classList.remove('text-gray-400')
    statusElement.classList.add('text-highlight-green')
  } else {
    // Disconnected state
    statusElement.querySelector('span:first-child').classList.remove('bg-highlight-green')
    statusElement.querySelector('span:first-child').classList.add('bg-error-red')
    statusElement.querySelector('span:last-child').textContent = 'Disconnected'
    statusElement.querySelector('span:first-child').classList.remove('pulse-green')
    statusElement.querySelector('span:first-child').classList.add('pulse-animation')
    statusElement.classList.remove('text-highlight-green')
    statusElement.classList.add('text-gray-400')
  }
}

// Set initial connection status to disconnected
document.addEventListener('DOMContentLoaded', () => {
  updateConnectionStatus(false)
})

const initializeApp = async () => {
  // Start session timer
  sessionStartTime = new Date();
  
  // Removed the initial "Starting Strawberry Jam..." message from here.
  // It's now logged within application.instantiate()

  // No need for startup delay - our messages are stored with IDs for later removal

  try {
    await application.instantiate()
    
    application.attachNetworkingEvents()
    
    // Setup connection status monitoring
    setupConnectionMonitoring()
  } catch (error) {
    application.consoleMessage({
      message: `Error during initialization: ${error.message}`,
      type: 'error'
    })
    
    console.error('Initialization error details:', error)
  }
}

/**
 * Setup monitoring for connection status changes.
 */
const setupConnectionMonitoring = () => {
  // Check for connection changes periodically
  setInterval(() => {
    const isConnected = application.server && 
                        application.server.clients && 
                        application.server.clients.size > 0
    updateConnectionStatus(isConnected)
    updateTimestamp()
    checkEmptyPluginList()
  }, 1000) // Check every second
  
  // Listen for client connect events
  if (application.server) {
    const originalOnConnection = application.server._onConnection
    application.server._onConnection = async function(connection) {
      await originalOnConnection.call(this, connection)
      updateConnectionStatus(true)
      application.consoleMessage({
        message: 'Connected to Animal Jam servers.',
        type: 'success'
      })
    }
  }
}

/**
 * Update the timestamp display in the footer to show session time.
 */
const updateTimestamp = () => {
  const timestampDisplay = document.getElementById('timestamp-display')
  if (timestampDisplay && sessionStartTime) {
    const now = new Date()
    const sessionDuration = now - sessionStartTime
    
    // Convert milliseconds to hours, minutes, seconds
    const hours = Math.floor(sessionDuration / (1000 * 60 * 60))
    const minutes = Math.floor((sessionDuration % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((sessionDuration % (1000 * 60)) / 1000)
    
    // Format the time with leading zeros
    const formattedHours = String(hours).padStart(2, '0')
    const formattedMinutes = String(minutes).padStart(2, '0')
    const formattedSeconds = String(seconds).padStart(2, '0')
    
    timestampDisplay.textContent = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`
  }
}

/**
 * Check if the plugin list is empty and toggle the empty state message.
 */
const checkEmptyPluginList = () => {
  const pluginList = document.getElementById('pluginList')
  const emptyPluginMessage = document.getElementById('emptyPluginMessage')
  
  if (pluginList && emptyPluginMessage) {
    // Get plugin items while ignoring empty text nodes
    const hasPlugins = Array.from(pluginList.children)
      .some(child => child.nodeType !== 3 && child.textContent.trim() !== '')
    
    emptyPluginMessage.classList.toggle('hidden', hasPlugins)
  }
}

const setupIpcEvents = () => {
  ipcRenderer
    .on('message', (sender, args) => application.consoleMessage({ ...args }))
}

const setupAppEvents = () => {
  application
    .on('ready', () => application.activateAutoComplete())
    .on('refresh:plugins', () => {
      application.refreshAutoComplete()
      application.attachNetworkingEvents()
    })
}

console.log = (message) => {
  const formattedMessage = typeof message === 'object'
    ? JSON.stringify(message)
    : message

  application.consoleMessage({
    type: 'logger',
    message: formattedMessage
  })
}

initializeApp()
setupIpcEvents()
setupAppEvents()

// --- Fetch and Display App Version ---
const displayAppVersion = async () => {
  try {
    const version = await ipcRenderer.invoke('get-app-version');
    const versionDisplayElement = document.getElementById('appVersionDisplay');
    if (versionDisplayElement) {
      // Prepend "Strawberry Jam v" to the version number
      versionDisplayElement.textContent = `Strawberry Jam v${version}`;
    } else {
      console.error('Could not find element with ID appVersionDisplay');
    }
  } catch (error) {
    console.error('Error fetching app version:', error);
    // Optionally display an error or default text
    const versionDisplayElement = document.getElementById('appVersionDisplay');
    if (versionDisplayElement) {
      versionDisplayElement.textContent = 'Strawberry Jam v?.?.?'; // Default/error text
    }
  }
};
displayAppVersion(); // Call the function to display the version on load
// --- End Fetch and Display App Version ---

window.jam = {
  application,
  dispatch: application.dispatch,
  settings: application.settings,
  server: application.server
}
