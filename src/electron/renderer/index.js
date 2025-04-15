const Application = require('./application')
const { ipcRenderer } = require('electron')

const application = new Application()

const initializeApp = async () => {
  application.consoleMessage({
    message: 'Instantiating please wait.',
    type: 'wait'
  })

  try {
    await application.instantiate()

    application.consoleMessage({
      message: 'Successfully instantiated.',
      type: 'success'
    })

    application.attachNetworkingEvents()
  } catch (error) {
    application.consoleMessage({
      message: `Error during instantiation: ${error.message}`,
      type: 'error'
    })
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
