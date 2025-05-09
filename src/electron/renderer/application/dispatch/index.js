const path = require('path')
const { PluginManager: PM } = require('live-plugin-manager')

// Define isDevelopment for environment checks
const isDevelopment = process.env.NODE_ENV === 'development';

// Helper: Only log in development
function devLog(...args) {
  if (isDevelopment) console.log(...args);
}
const fs = require('fs').promises
const Ajv = new (require('ajv'))({ useDefaults: true })
const { ConnectionMessageTypes, PluginTypes, getDataPath } = require('../../../../Constants') // Import getDataPath

/**
 * The path to the plugins folder.
 * @constant
 */
const BASE_PATH = process.platform === 'win32'
  ? path.resolve('plugins/')
  : process.platform === 'darwin'
    ? path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', 'plugins/')
    : undefined

/**
 * The default Configuration schema.
 * @type {Object}
 * @private
 */
const ConfigurationSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    main: { type: 'string', default: 'index.js' },
    description: { type: 'string', default: '' },
    author: { type: 'string', default: 'Sxip' },
    type: { type: 'string', default: 'game' },
    dependencies: { type: 'object', default: {} }
  },
  required: [
    'name',
    'main',
    'description',
    'author',
    'type',
    'dependencies'
  ]
}

module.exports = class Dispatch {
  /**
   * Constructor.
   * @param {Application} application
   * @param {string} dataPath - The data path from the main process
   * @param {Function} boundConsoleMessage - The consoleMessage function bound to the application instance
   * @constructor
   */
  constructor (application, dataPath, boundConsoleMessage) {
    this._application = application

    /**
     * The data path for plugins to use.
     * @type {string}
     * @public
     */
    this.dataPath = dataPath;

    /**
     * The bound consoleMessage function from the Application instance.
     * @type {Function}
     * @private
     */
    this._consoleMessage = boundConsoleMessage;

    /**
     * Stores all of the plugins.
     * @type {Map<string, any>}
     * @public
     */
    this.plugins = new Map()

    /**
     * Dependency manager plugin manager.
     * @type {PluginManager}
     * @public
     */
    this.dependencyManager = new PM(process.platform === 'darwin'
      ? { pluginsPath: path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', 'plugin_packages') }
      : {}
    )

    /**
     * Stores all of the commands
     * @type {Map<string, object>}
     * @public
     */
    this.commands = new Map()

    /**
     * Intervals set.
     * @type {Set<Interval>}
     * @public
     */
    this.intervals = new Set()

    /**
     * State object.
     * @type {Object}
     * @public
     */
    this.state = {}

    /**
     * Stores the message hooks.
     * @type {Object}
     * @public
     */
    this.hooks = {
      connection: new Map(),
      aj: new Map(),
      any: new Map()
    }

    // No longer exposing getDataPath function directly
    // this.getDataPath = getDataPath;
  }

  get connected () {
    return this._application.server.clients.size > 0
  }

  get settings () {
    return this._application.settings
  }

  /**
   * Reads files recursively from a directory.
   * @param {string} directory
   * @returns {string[]}
   * @static
   */
  static async readdirRecursive (directory) {
    const result = []

    const read = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      const promises = entries.map(async (entry) => {
        const filepath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          await read(filepath)
        } else {
          result.push(filepath)
        }
      })

      await Promise.all(promises)
    }

    await read(directory)
    return result
  }

  /**
   * Opens the plugin window.
   * @param name
   * @public
   */
  open (name) {
    const plugin = this.plugins.get(name)

    if (plugin) {
      const { filepath, configuration: { main } } = plugin
      const url = `file://${path.join(filepath, main)}`

      // Request main process to create a new window
      if (typeof require === "function") {
        try {
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('open-plugin-window', {
            url,
            name,
            pluginPath: filepath
          });
        } catch (e) {
          console.error("Failed to request plugin window:", e);
          // Fallback to basic window.open
          const popup = window.open(url);
          if (popup) {
            popup.jam = {
              application: this._application,
              dispatch: this
            };
          }
        }
      }
    } else {
      this._consoleMessage({
        type: 'error',
        message: `Plugin "${name}" not found.`
      })
    }
  }

  /**
   * Installs plugin dependencies..
   * @param {object} configuration
   * @public
   */
  async installDependencies (configuration) {
    const { dependencies } = configuration

    if (!dependencies || Object.keys(dependencies).length === 0) {
      return
    }

    const installPromises = Object.entries(dependencies).map(
      ([module, version]) => this.dependencyManager.install(module, version)
    )

    await Promise.all(installPromises)
  }

  /**
   * Requires a plugin dependency.
   * @param {string} name
   */
  require (name) {
    return this.dependencyManager.require(name)
  }

  /**
   * Helper function to wait for the jquery preload to finish.
   * @param {Window} window
   * @param {Function} callback
   * @public
   */
  waitForJQuery (window, callback) {
    return new Promise((resolve, reject) => {
      const checkInterval = 100
      const maxRetries = 100
      let retries = 0

      const intervalId = setInterval(() => {
        if (typeof window.$ !== 'undefined') {
          clearInterval(intervalId)
          try {
            callback()
            resolve()
          } catch (error) {
            reject(error)
          }
        } else if (retries >= maxRetries) {
          clearInterval(intervalId)
          reject(new Error('jQuery was not found within the expected time.'))
        } else {
          retries++
        }
      }, checkInterval)
    })
  }

  /**
   * Loads all of the plugins.
   * @returns {Promise<void>}
   * @public
   */
  async load (filter = file => path.basename(file) === 'plugin.json') {
    try {
      // Revert to using BASE_PATH for locating plugin source code
      if (!BASE_PATH) {
        throw new Error('Plugin base path (BASE_PATH) could not be determined for this platform.');
      }
      devLog(`[Dispatch] Loading plugins from BASE_PATH: ${BASE_PATH}`);

      const filepaths = await this.constructor.readdirRecursive(BASE_PATH); // Use BASE_PATH

      // Collect plugin configurations instead of storing immediately
      const pluginConfigurations = []; 

      await Promise.all(filepaths.map(async filepath => {
        if (filter(filepath)) {
          try {
            const configuration = require(filepath);
            // Store the validated configuration along with its filepath temporarily
            const validatedConfig = await this._validateAndPrepareConfig(path.dirname(filepath), configuration.default || configuration);
            if (validatedConfig) {
              pluginConfigurations.push(validatedConfig);
            }
          } catch (error) {
            this._consoleMessage({
              type: 'error',
              message: `Error initially processing plugin file ${filepath}: ${error.message}`
            })
          }
        }
      }));

      // Sort configurations: UI plugins first, then alphabetically by name
      pluginConfigurations.sort((a, b) => {
        if (a.configuration.type === 'ui' && b.configuration.type !== 'ui') return -1;
        if (a.configuration.type !== 'ui' && b.configuration.type === 'ui') return 1;
        return a.configuration.name.localeCompare(b.configuration.name); // Alphabetical sort within types
      });

      // --- Filter out game plugins if setting is enabled --- 
      const hideGamePlugins = await this._application.settings.get('ui.hideGamePlugins', false);
      const finalConfigurations = hideGamePlugins 
        ? pluginConfigurations.filter(p => p.configuration.type !== 'game') 
        : pluginConfigurations;
      // --- End filtering --- 

      // Clear the plugin list in the UI
      this._application.$pluginList.empty();
      this.plugins.clear(); // Clear internal plugin map before re-populating

      // Process and render FILTERED plugins
      await Promise.all(finalConfigurations.map(configData => 
        this._processAndRenderPlugin(configData)
      ));

      // Update autocomplete after all plugins are processed
      this._application.refreshAutoComplete();

      // Update the empty message status after rendering
      this._application._updateEmptyPluginMessage(); 

      // --- Add Room State Hooks ---
      this.onMessage({
        type: ConnectionMessageTypes.aj, // Listen to game server messages
        message: 'rj', // *** CORRECTED: Listen for 'rj' (join room) packet ***
        callback: ({ message }) => {
          try {
            // Extract room ID from the parsed message value (like jam-master)
            // message.value should be an array of parameters for XtMessage
            if (message.value && message.value.length >= 4) {
              const roomId = message.value[3]; // Room ID is typically the 4th parameter (index 3)

              if (typeof roomId !== 'string' || roomId.length === 0) {
                devError('[Dispatch:rj] Extracted room ID is invalid:', roomId);
                console.warn('[Dispatch] Invalid room ID extracted from rj packet:', message.raw);
                return; // Don't proceed with invalid ID
              }
              
              // Import room tracking utilities
              const roomUtils = require('../../../../utils/room-tracking');
              
              // Store room info in state
              this.setState('room', roomId);
              this.setState('isAdventureRoom', roomUtils.isAdventureRoom(roomId));
              this.setState('effectiveRoomId', roomUtils.getEffectiveRoomId(roomId));
              
              // Verify state immediately after setting
              const currentRoomState = this.getState('room');
              const currentAdventureState = this.getState('isAdventureRoom');
              const currentEffectiveState = this.getState('effectiveRoomId');

              if (currentRoomState !== roomId) {
                devError('[Dispatch:rj] STATE UPDATE FAILED! getState("room") did not return the expected value immediately after setState.');
              }
            } else {
               devLog('[Dispatch:rj] Could not parse room ID from rj packet. message.value:', message.value);
               console.warn('[Dispatch] Could not parse room ID from rj packet:', message.raw, 'Value:', message.value);
            }
          } catch (e) {
            devError('[Dispatch:rj] Error processing rj packet:', e);
            console.error('[Dispatch] Error processing rj packet:', e);
          }
        }
      });

      this.onMessage({
        type: ConnectionMessageTypes.aj, // Listen to game server messages
        message: 'j#l', // Packet type for leaving a room (Assuming this is correct, check logs if needed)
        callback: () => {
          const oldRoom = this.getState('room');
          this.setState('room', null);
          this.setState('isAdventureRoom', false);
          this.setState('effectiveRoomId', null);
        }
      });
      // --- End Room State Hooks ---

    } catch (error) {
      this._consoleMessage({
        type: 'error',
        message: `Error loading plugins: ${error.message}`
      })
    }
  }

  /**
   * Dispatches all of the message hooks.
   * @returns {Promise<void>}
   * @public
   */
  async all ({ client, type, message }) {
    const hooks = [
      ...type === ConnectionMessageTypes.aj ? this.hooks.aj.get(message.type) || [] : [],
      ...type === ConnectionMessageTypes.connection ? this.hooks.connection.get(message.type) || [] : [],
      ...this.hooks.any.get(ConnectionMessageTypes.any) || []
    ]

    const promises = hooks.map(async (hook) => {
      try {
        await hook({ client, type, dispatch: this, message })
      } catch (error) {
        this._consoleMessage({
          type: 'error',
          message: `Failed hooking packet ${message.type}. ${error.message}`
        })
      }
    })

    await Promise.all(promises)
  }

  /**
   * Sends multiple messages.
   * @param messages
   * @public
   */
  async sendMultipleMessages ({ type, messages = [] } = {}) {
    if (messages.length === 0) {
      return Promise.resolve()
    }

    const sendFunction = type === ConnectionMessageTypes.aj
      ? this.sendRemoteMessage.bind(this)
      : this.sendConnectionMessage.bind(this)

    try {
      await Promise.all(messages.map(sendFunction))
    } catch (error) {
      this._consoleMessage({
        type: 'error',
        message: `Error sending messages: ${error.message}`
      })
    }
  }

  /**
   * Stores and validates the plugin configuration.
   * @param filepath
   * @param configuration
   * @private
   */
  async _storeAndValidate (filepath, configuration) {
    // This function is being replaced by _validateAndPrepareConfig and _processAndRenderPlugin
    // We keep it temporarily for reference if needed, but it won't be called directly by load anymore.
    // TODO: Remove this function after confirming new logic works.
    const validate = Ajv.compile(ConfigurationSchema)

    if (!validate(configuration)) {
      this._consoleMessage({
        type: 'error',
        message: `Failed validating the configuration for the plugin ${filepath}. ${validate.errors[0].message}.`
      })
      return
    }

    // Check if the plugin name already exists
    if (this.plugins.has(configuration.name)) {
      this._consoleMessage({
        type: 'error',
        message: `Plugin with the name ${configuration.name} already exists.`
      })
      return
    }

    try {
      await this.installDependencies(configuration)

      switch (configuration.type) {
        case PluginTypes.game: {
          const PluginInstance = require(path.join(filepath, configuration.main))
          const plugin = new PluginInstance({
            application: this._application,
            dispatch: this,
            dataPath: this.dataPath // Pass dataPath to game plugin constructors
          })

          this.plugins.set(configuration.name, {
            configuration,
            filepath,
            plugin
          })
          break
        }

        case PluginTypes.ui:
          this.plugins.set(configuration.name, { configuration, filepath })
          break

        default:
          throw new Error(`Unsupported plugin type: ${configuration.type}`)
      }

      this._application.renderPluginItems(configuration)
    } catch (error) {
      this._consoleMessage({
        type: 'error',
        message: `Error processing the plugin ${filepath}: ${error.message}`
      })
    }
  }

  /**
   * Refreshes a plugin
   * @param {string} The plugin name
   * @returns {Promise<void>}
   */
  async refresh () {
    const { $pluginList, consoleMessage } = this._application

    $pluginList.empty()

    const pluginPaths = [...this.plugins.values()].map(({ filepath, configuration: { main } }) => ({
      jsPath: path.resolve(filepath, main),
      jsonPath: path.resolve(filepath, 'plugin.json')
    }))

    for (const { jsPath, jsonPath } of pluginPaths) {
      const jsCacheKey = require.resolve(jsPath)
      const jsonCacheKey = require.resolve(jsonPath)
      if (require.cache[jsCacheKey]) delete require.cache[jsCacheKey]
      if (require.cache[jsonCacheKey]) delete require.cache[jsonCacheKey]
    }

    this.clearAll()
    await this.load()

    this._application.emit('refresh:plugins')
    this._consoleMessage({
      type: 'success',
      message: `Successfully refreshed ${this.plugins.size} plugins.`
    })
  }

  /**
   * Promise timeout helper.
   * @param ms
   * @returns {Promise<void>}
   * @public
   */
  wait (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Displays a server admin message.
   * @param {string} text
   * @public
   */
  serverMessage (text) {
    return this.sendConnectionMessage(`%xt%ua%${text}%0%`)
  }

  /**
   * Helper method for random.
   * @param {number} min
   * @param {number} max
   * @public
   */
  random (min, max) {
    return ~~(Math.random() * (max - min + 1)) + min
  }

  /**
   * Sets a state.
   * @param {string} key
   * @param {any} value
   * @returns {this}
   * @public
   */
  setState (key, value) {
    this.state[key] = value
    
    // When room state is updated, notify the main process for sync access
    if (key === 'room' && typeof require === 'function') {
      try {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('update-room-state', value);
      } catch (error) {
        devError(`[Dispatch] Error broadcasting room state update: ${error.message}`);
      }
    }
    
    return this
  }

  /**
   * Fetches the state.
   * @param key
   * @param defaultValue
   * @returns {any}
   * @public
   */
  getState (key, defaultValue = null) {
    if (this.state[key]) return this.state[key]
    return defaultValue
  }

  /**
   * Updates a state.
   * @param {string} key
   * @param {any} value
   * @returns {this}
   * @public
   */
  updateState (key, value) {
    if (this.state[key]) this.state[key] = value
    else throw new Error('Invalid state key.')
    return this
  }

  /**
   * Sends a connection message.
   * @param message
   * @returns {Promise<number>}
   * @public
   */
  sendConnectionMessage (message) {
    const promises = [...this._application.server.clients].map(client => client.sendConnectionMessage(message))
    return Promise.all(promises)
  }

  /**
   * Sends a remote message.
   * @param message
   * @returns {Promise<number>}
   * @public
   */
  sendRemoteMessage (message) {
    const promises = [...this._application.server.clients].map(client => client.sendRemoteMessage(message))
    return Promise.all(promises)
  }

  /**
   * Sets an interval.
   * @param {*} fn
   * @param {*} delay
   * @param  {...any} args
   * @returns
   * @public
   */
  setInterval (fn, delay, ...args) {
    const interval = setInterval(fn, delay, ...args)
    this.intervals.add(interval)
    return interval
  }

  /**
   * Clears an interval.
   * @param {} interval
   * @public
   */
  clearInterval (interval) {
    clearInterval(interval)
    this.intervals.clear(interval)
  }

  /**
   * Hooks a command.
   * @param command
   * @public
   */
  onCommand ({ name, description = '', callback } = {}) {
    if (typeof name !== 'string' || typeof callback !== 'function') return

    if (this.commands.has(name)) return
    this.commands.set(name, { name, description, callback })
  }

  /**
   * Off command, removes the command.
   * @param command
   * @public
   */
  offCommand ({ name, callback } = {}) {
    if (!this.commands.has(name)) return

    const commandCallbacks = this.commands.get(name)

    const index = commandCallbacks.indexOf(callback)
    if (index !== -1) commandCallbacks.splice(index, 1)
  }

  /**
   * Hooks a message by the type.
   * @param options
   * @public
   */
  onMessage ({ type, message, callback } = {}) {
    const registrationMap = {
      [ConnectionMessageTypes.aj]: this._registerAjHook.bind(this),
      [ConnectionMessageTypes.connection]: this._registerConnectionHook.bind(this),
      [ConnectionMessageTypes.any]: this._registerAnyHook.bind(this)
    }

    const registerHook = registrationMap[type]
    if (registerHook) {
      registerHook({ type, message, callback })
    }
  }

  /**
   * Unhooks a message.
   * @param options
   * @public
   */
  offMessage ({ type, callback } = {}) {
    const hooksMap = {
      [ConnectionMessageTypes.aj]: this.hooks.aj,
      [ConnectionMessageTypes.connection]: this.hooks.connection,
      [ConnectionMessageTypes.any]: this.hooks.any
    }

    const hooks = hooksMap[type]

    if (hooks) {
      const hookList = hooks.get(type)
      if (hookList) {
        const index = hookList.indexOf(callback)
        if (index !== -1) {
          hookList.splice(index, 1)
        }
      }
    }
  }

  /**
 * Registers a message hook for the specified type.
 * @param {string} type - The type of hook to register.
 * @param {object} hook - The hook object containing message and callback.
 * @private
 */
  _registerHook (type, { message, callback }) {
    if (!this.hooks[type]) {
      return this._consoleMessage({
        type: 'error',
        message: `Invalid hook type: ${type}`
      })
    }

    const hooksMap = this.hooks[type]
    if (hooksMap.has(message)) {
      hooksMap.get(message).push(callback)
    } else {
      hooksMap.set(message, [callback])
    }
  }

  /**
 * Registers a local message hook.
 * @param {object} hook - The hook object.
 * @private
 */
  _registerConnectionHook (hook) {
    this._registerHook('connection', hook)
  }

  /**
 * Registers a remote message hook.
 * @param {object} hook - The hook object.
 * @private
 */
  _registerAjHook (hook) {
    this._registerHook('aj', hook)
  }

  /**
 * Registers any message hook.
 * @param {object} hook - The hook object.
 * @private
 */
  _registerAnyHook (hook) {
    this._registerHook('any', { message: ConnectionMessageTypes.any, callback: hook.callback })
  }

  clearAll () {
    this.plugins.clear()
    this.commands.clear()

    const { connection, aj, any } = this.hooks

    connection.clear()
    aj.clear()
    any.clear()
  }

  /**
   * Validates configuration and installs dependencies. Does not instantiate or render.
   * @param {string} filepath - Directory path of the plugin
   * @param {object} configuration - Raw configuration from plugin.json
   * @returns {Promise<object|null>} - Object containing validated config and filepath, or null on error
   * @private
   */
  async _validateAndPrepareConfig(filepath, configuration) {
    const validate = Ajv.compile(ConfigurationSchema);
    if (!validate(configuration)) {
      this._consoleMessage({
        type: 'error',
        message: `Failed validating configuration for plugin in ${filepath}. ${validate.errors[0].message}.`
      });
      return null;
    }

    // Check for duplicate name before proceeding (although checked again later)
    if (this.plugins.has(configuration.name)) {
       this._consoleMessage({
         type: 'warn', // Warning as it might be caught later during processing
         message: `Duplicate plugin name found during validation: ${configuration.name}`
       });
       // Don't return null here yet, let the main processing handle final duplicate check
    }

    try {
      await this.installDependencies(configuration);
      return { filepath, configuration }; // Return validated config and path
    } catch (error) {
      this._consoleMessage({
        type: 'error',
        message: `Error installing dependencies for plugin in ${filepath}: ${error.message}`
      });
      return null;
    }
  }

  /**
   * Processes a single validated plugin config: instantiates/stores plugin and renders UI item.
   * @param {object} configData - Object containing { filepath, configuration }
   * @returns {Promise<void>}
   * @private
   */
  async _processAndRenderPlugin(configData) {
    const { filepath, configuration } = configData;

    // Final duplicate check before storing
    if (this.plugins.has(configuration.name)) {
      this._consoleMessage({
        type: 'error',
        message: `Plugin with the name ${configuration.name} already exists. Skipping.`
      });
      return;
    }

    try {
      let pluginInstance = null;
      if (configuration.type === PluginTypes.game) {
        const PluginClass = require(path.join(filepath, configuration.main));
        pluginInstance = new PluginClass({
          application: this._application,
          dispatch: this,
          dataPath: this.dataPath
        });
      }

      // Store plugin data (instance is null for UI plugins here)
      this.plugins.set(configuration.name, {
        configuration,
        filepath,
        plugin: pluginInstance // Store instance for game plugins
      });

      // Render the item using Application method - this now returns the element
      const $pluginElement = this._application.renderPluginItems(configuration); 

      // Append the rendered element to the list
      this._application.$pluginList.append($pluginElement);

    } catch (error) {
      this._consoleMessage({
        type: 'error',
        message: `Error processing/rendering plugin ${configuration.name}: ${error.message}`
      });
    }
  }
}
