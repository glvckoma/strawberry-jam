/* eslint-disable camelcase */
const { ipcRenderer } = require('electron')
const { EventEmitter } = require('events')

// Define isDevelopment for environment checks
const isDevelopment = process.env.NODE_ENV === 'development';

// Helper: Only log in development
function devLog(...args) {
  if (isDevelopment) console.log(...args);
}
function devError(...args) {
  if (isDevelopment) console.error(...args);
}
const Server = require('../../../networking/server')
const Settings = require('./settings')
const Patcher = require('./patcher')
const Dispatch = require('./dispatch')
const HttpClient = require('../../../services/HttpClient')
const ModalSystem = require('./modals')
const registerCoreCommands = require('./core-commands')

/**
 * Message status icons (using FontAwesome).
 * @type {Object}
 * @constant
 */
const messageIcons = Object.freeze({
  success: 'fa-check-circle',
  error: 'fa-times-circle',
  wait: 'fa-spinner fa-pulse',
  celebrate: 'fa-trophy',
  warn: 'fa-exclamation-triangle',
  notify: 'fa-info-circle',
  speech: 'fa-comment-alt',
  logger: 'fa-file-alt',
  action: 'fa-bolt',
  welcome: 'fa-heart'
})

module.exports = class Application extends EventEmitter {
  /**
   * Constructor.
   * @constructor
   */
  constructor () {
    super()

    /**
     * The data path received from the main process.
     * @type {string|null}
     * @public
     */
    this.dataPath = null;

    /**
     * Promise that resolves when the data path is received from the main process.
     * @type {Promise<void>}
     * @private
     */
    this.dataPathPromise = new Promise((resolve) => {
      ipcRenderer.once('set-data-path', (event, receivedPath) => {
        devLog(`[Renderer] Received data path: ${receivedPath}`);
        this.dataPath = receivedPath;
        resolve(); // Resolve the promise once path is received
      });
    });

    /**
     * The reference to the server connection.
     * @type {Server}
     * @public
     */
    this.server = new Server(this)

    /**
     * The reference to the settings manager.
     * @type {Settings}
     * @public
     */
    this.settings = new Settings()

    /**
     * The reference to the patcher manager.
     * @type {Patcher}
     * @public
     */
    this.patcher = new Patcher(this)

    // Dispatch will be initialized in instantiate() after dataPath is received
    /**
     * The reference to the dispatch.
     * @type {Dispatch}
     * @public
     */
    this.dispatch = null;

    /**
     * Stores the modal system.
     * @type {ModalSystem}
     * @public
     */
    this.modals = new ModalSystem(this)
    this.modals.initialize()

    /**
     * The reference to the application input.
     * @type {JQuery<HTMLElement>}
     * @private
     */
    this.$input = $('#input')

    /**
     * The reference to the plugin list.
     * @type {JQuery<HTMLElement>}
     * @private
     */
    this.$pluginList = $('#pluginList')

    /**
     * Handles the input events.
     * @type {void}
     * @private
     */
    this.$input.on('keydown', (event) => {
      if (event.key === 'Enter') {
        const message = this.$input.val().trim()
        const [command, ...parameters] = message.split(' ')

        const cmd = this.dispatch.commands.get(command)
        if (cmd) {
          cmd.callback({ parameters })
        }

        this.$input.val('')
      }
    })

    /**
     * Maximum number of log entries to keep before cleaning.
     * @type {number}
     * @private
     */
    this._maxLogEntries = 600;

    /**
     * Percentage of logs to remove when cleaning.
     * @type {number}
     * @private
     */
    this._cleanPercentage = 0.4; // Remove 40%

    /**
     * Current count of packet log entries.
     * @type {number}
     * @private
     */
    this._packetLogCount = 0;

    /**
     * Current count of application message entries.
     * @type {number}
     * @private
     */
    this._appMessageCount = 0;

    /**
     * The reference to the play button element.
     * @type {HTMLElement | null}
     * @private
     */
    this.$playButton = document.getElementById('playButton'); // Use vanilla JS as jQuery might not be ready

    this._setupPluginIPC(); // Moved from instantiate to ensure handlers are ready early
  }

  /**
   * Checks if the Animal Jam server host has changed.
   * @returns {Promise<void>}
   * @private
   */
  async _checkForHostChanges () {
    const DEFAULT_SERVER = 'lb-iss04-classic-prod.animaljam.com';
    
    try {
      // Get flashvars data from AJ
      const data = await HttpClient.fetchFlashvars();
      
      // Handle missing data
      if (!data || !data.smartfoxServer) {
        // Ensure we have a server value
        const currentServer = this.settings.get('smartfoxServer');
        if (!currentServer || typeof currentServer !== 'string' || !currentServer.includes('animaljam')) {
          this.settings.update('smartfoxServer', DEFAULT_SERVER);
        }
        return;
      }
      
      let { smartfoxServer } = data;
      
      // Process the server address if it's valid
      if (typeof smartfoxServer === 'string') {
        smartfoxServer = smartfoxServer.replace(/\.(stage|prod)\.animaljam\.internal$/, '-$1.animaljam.com');
        smartfoxServer = `lb-${smartfoxServer}`;
        
        // Only proceed if we got a valid server
        if (smartfoxServer && smartfoxServer.includes('animaljam')) {
          try {
            const currentServer = this.settings.get('smartfoxServer');
            
            if (smartfoxServer !== currentServer) {
              // Update the server setting
              this.settings.update('smartfoxServer', smartfoxServer);
              
              // Notify the user
              this.consoleMessage({
                message: 'Server host has changed. Changes are now being applied.',
                type: 'notify'
              });
            }
          } catch (settingsError) {
            // Silently handle settings error and set directly if needed
            if (this.settings && this.settings.settings) {
              this.settings.settings.smartfoxServer = smartfoxServer;
            }
          }
        }
      }
    } catch (error) {
      // Only show error to user, don't log to console
      this.consoleMessage({ 
        type: 'warn', 
        message: 'Could not check for server updates. Using saved server settings.'
      });
      
      // Ensure we have a valid server value regardless of errors
      try {
        const currentServer = this.settings.get('smartfoxServer');
        if (!currentServer || typeof currentServer !== 'string' || !currentServer.includes('animaljam')) {
          this.settings.update('smartfoxServer', DEFAULT_SERVER);
        }
      } catch (err) {
        // Last resort - try to set directly
        if (this.settings && this.settings.settings) {
          this.settings.settings.smartfoxServer = DEFAULT_SERVER;
        }
      }
    }
  }

  /**
   * Sets up IPC listeners for messages forwarded from plugin windows.
   * @private
   */
  _setupPluginIPC () {
    if (typeof require === "function") {
      try {
        const { ipcRenderer } = require('electron');
        devLog("[Main Renderer] Setting up plugin IPC listeners...");

        ipcRenderer.on('plugin-remote-message', (event, msg) => {
          devLog("[Main Renderer] Received plugin-remote-message:", msg);
          if (this.dispatch && typeof this.dispatch.sendRemoteMessage === 'function') {
            this.dispatch.sendRemoteMessage(msg).catch(err => {
              this.consoleMessage({ type: 'error', message: `Error sending remote message from plugin: ${err.message}` });
            });
          } else {
            this.consoleMessage({ type: 'error', message: 'Cannot send remote message: Dispatch not ready.' });
          }
        });

        ipcRenderer.on('plugin-connection-message', (event, msg) => {
          devLog("[Main Renderer] Received plugin-connection-message:", msg);
          if (this.dispatch && typeof this.dispatch.sendConnectionMessage === 'function') {
            this.dispatch.sendConnectionMessage(msg).catch(err => {
              this.consoleMessage({ type: 'error', message: `Error sending connection message from plugin: ${err.message}` });
            });
          } else {
            this.consoleMessage({ type: 'error', message: 'Cannot send connection message: Dispatch not ready.' });
          }
        });

        // Listener for UI plugins requesting state synchronously
        ipcRenderer.on('dispatch-get-state-sync', (event, key) => {
          devLog(`[Main Renderer] Received dispatch-get-state-sync request for key: ${key}`);
          if (this.dispatch && typeof this.dispatch.getState === 'function') {
            try {
              const value = this.dispatch.getState(key);
              devLog(`[Main Renderer] Returning sync state value for ${key}:`, value);
              event.returnValue = value; // Set return value for sendSync
            } catch (error) {
              this.consoleMessage({ type: 'error', message: `Error getting sync state for key '${key}': ${error.message}` });
              devError(`[Main Renderer] Error getting sync state for key '${key}':`, error);
              event.returnValue = null; // Return null on error
            }
          } else {
            this.consoleMessage({ type: 'error', message: `Cannot get sync state for key '${key}': Dispatch not ready.` });
            devError(`[Main Renderer] Cannot get sync state for key '${key}': Dispatch not ready.`);
            event.returnValue = null; // Return null if dispatch isn't ready
          }
        });

        // Listener for asynchronous state requests from the main process
        ipcRenderer.on('main-renderer-get-state-async', (event, { key, replyChannel }) => {
          devLog(`[Main Renderer] Received ASYNC request from main process for key: ${key} (Reply Channel: ${replyChannel})`);
          let value = null;
          // Check if dispatch and getState are available
          if (this.dispatch && typeof this.dispatch.getState === 'function') {
            try {
              value = this.dispatch.getState(key);
              devLog(`[Main Renderer] Got state value for ${key}:`, value);
            } catch (error) {
              this.consoleMessage({ type: 'error', message: `Error getting ASYNC state for key '${key}' in renderer: ${error.message}` });
              devError(`[Main Renderer] Error getting ASYNC state for key '${key}':`, error);
              value = null; // Ensure value is null on error
            }
          } else {
            this.consoleMessage({ type: 'error', message: `Cannot get ASYNC state for key '${key}': Dispatch not ready.` });
            devError(`[Main Renderer] Cannot get ASYNC state for key '${key}': Dispatch not ready.`);
            value = null; // Ensure value is null if dispatch isn't ready
          }
          // Send the value back on the unique reply channel
          devLog(`[Main Renderer] Sending reply for ${key} on channel ${replyChannel}:`, value);
          ipcRenderer.send(replyChannel, value);
        });


        devLog("[Main Renderer] Plugin IPC listeners setup complete.");
      } catch (e) {
        devError("[Main Renderer] Error setting up plugin IPC listeners:", e);
      }
    }
  }

  open (url) {
    ipcRenderer.send('open-url', url)
  }

  /**
   * Opens the plugin directory.
   * @param name
   * @public
   */
  directory (name) {
    const plugin = this.dispatch.plugins.get(name)

    if (plugin) {
      const { filepath } = plugin
      ipcRenderer.send('open-directory', filepath)
    }
  }

  /**
   * Opens the settings modal.
   * @returns {void}
   * @public
   */
  openSettings () {
    this.modals.show('settings', '#modalContainer')
  }

  /**
   * Opens plugins hub.
   */
  openPluginHub () {
    this.modals.show('pluginLibraryModal', '#modalContainer')
  }

  /**
   * Minimizes the application.
   * @public
   */
  minimize () {
    ipcRenderer.send('window-minimize')
  }

  /**
   * Closes the application.
   * @public
   */
  close () {
    ipcRenderer.send('window-close')
  }

  /**
   * Relaunches the application.
   * @public
   */
  relaunch () {
    ipcRenderer.send('application-relaunch')
  }

  /**
   * Attaches networking events.
   * @public
   */
  attachNetworkingEvents () {
    this.dispatch.onMessage({
      type: '*',
      callback: ({ message, type }) => {
        // Broadcast packet event to main process for UI plugins
        if (typeof require === "function") {
          try {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('packet-event', {
              raw: message.toMessage(),
              direction: type === 'aj' ? 'in' : 'out',
              timestamp: Date.now()
            });
          } catch (e) {
            // Ignore if not available
          }
        }
        
        // Detect login success (%xt%l%-1%) and show friendly message
        if (type === 'aj' && message.toMessage().includes('%xt%l%-1%')) {
          this.consoleMessage({
            type: 'success',
            message: 'Successfully logged in!'
          });
        }
        
        this.consoleMessage({
          type: 'speech',
          isPacket: true,
          isIncoming: type === 'aj',
          message: message.toMessage()
        })
      }
    })
  }

  /**
   * Handles input autocomplete activation.
   * @type {void}
   * @public
   */
  activateAutoComplete () {
    if (!$('#autocomplete-styles').length) {
      $('head').append(`
        <style id="autocomplete-styles">
          .ui-autocomplete {
            max-height: 280px;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 8px;
            backdrop-filter: blur(8px);
            scrollbar-width: thin;
            scrollbar-color: #3A3D4D #1C1E26;
          }
          .ui-autocomplete::-webkit-scrollbar {
            width: 8px;
          }
          .ui-autocomplete::-webkit-scrollbar-track {
            background: #1C1E26;
          }
          .ui-autocomplete::-webkit-scrollbar-thumb {
            background: #3A3D4D;
            border-radius: 8px;
          }
          .ui-autocomplete::-webkit-scrollbar-thumb:hover {
            background: #5A5F6D;
          }
          .autocomplete-item {
            padding: 6px !important;
            border-radius: 6px;
            margin-bottom: 4px;
            border: 1px solid transparent;
            transition: all 0.15s ease;
          }
          .autocomplete-item {
            padding: 6px !important;
            border-radius: 6px;
            margin-bottom: 4px;
            border: 1px solid transparent;
            transition: all 0.15s ease;
          }
          .autocomplete-item.ui-state-focus {
            border: 1px solid rgba(52, 211, 153, 0.5) !important;
            background: rgba(52, 211, 153, 0.1) !important;
            margin: 0 0 4px 0 !important;
          }
          .autocomplete-item-content {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .autocomplete-item-name {
            font-size: 14px;
            font-weight: 500;
            color: var(--text-primary, #e2e8f0);
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .autocomplete-item-description {
            font-size: 12px;
            opacity: 0.7;
            color: var(--text-secondary, #a0aec0);
            margin-left: 16px;
          }
          .autocomplete-shortcut {
            margin-top: 4px;
            font-size: 10px;
            color: rgba(160, 174, 192, 0.6);
            display: flex;
            justify-content: flex-end;
          }
          .autocomplete-shortcut kbd {
            background: rgba(45, 55, 72, 0.6);
            border-radius: 3px;
            padding: 1px 4px;
            margin: 0 2px;
            border: 1px solid rgba(160, 174, 192, 0.2);
            font-family: monospace;
          }
        </style>
      `)
    }

    this.$input.autocomplete({
      source: Array.from(this.dispatch.commands.values()).map(command => ({
        value: command.name,
        description: command.description
      })),
      position: { my: 'left top', at: 'left bottom', collision: 'flip' },
      classes: {
        'ui-autocomplete': 'bg-secondary-bg/95 border border-sidebar-border rounded-lg shadow-lg z-50'
      },
      delay: 50,
      minLength: 0,
      create: function () {
        $(this).data('ui-autocomplete')._resizeMenu = function () {
          this.menu.element.css({ width: this.element.outerWidth() + 'px' })
        }
      },
      select: function (event, ui) {
        this.value = ui.item.value
        return false
      },
      focus: function (event, ui) {
        $('.autocomplete-item').removeClass('scale-[1.01]')
        $(event.target).closest('.autocomplete-item').addClass('scale-[1.01]')
        return false
      },
      open: function () {
        const $menu = $(this).autocomplete('widget')
        $menu.css('opacity', 0)
          .animate({ opacity: 1 }, 150)
      },
      close: function () {
        const $menu = $(this).autocomplete('widget')
        $menu.animate({ opacity: 0 }, 100)
      }
    }).autocomplete('instance')._renderMenu = function (ul, items) {
      const that = this

      items.forEach(item => {
        that._renderItemData(ul, item)
      })
    }

    this.$input.autocomplete('instance')._renderItem = function (ul, item) {
      return $('<li>')
        .addClass('autocomplete-item ui-menu-item')
        .attr('data-value', item.value)
        .append(`
        <div class="autocomplete-item-content">
          <span class="autocomplete-item-name">
            <i class="fas fa-terminal text-xs opacity-70"></i>
            ${item.value}
          </span>
          <span class="autocomplete-item-description">${item.description}</span>
          <div class="autocomplete-shortcut">
            Press <kbd>Tab</kbd> to complete, <kbd>Enter</kbd> to execute
          </div>
        </div>
      `)
        .appendTo(ul)
    }
  }

  /**
   * Refreshes the autocomplete source.
   * @public
   */
  refreshAutoComplete () {
    this.activateAutoComplete()
  }

  /**
   * Displays a new console message.
   * @param message
   * @public
   */
  consoleMessage ({ message, type = 'success', withStatus = true, time = true, isPacket = false, isIncoming = false, details = null, style = '' } = {}) {
    const baseTypeClasses = {
      success: 'bg-highlight-green/10 border-l-4 border-highlight-green text-highlight-green',
      error: 'bg-error-red/10 border-l-4 border-error-red text-error-red',
      wait: 'bg-tertiary-bg/30 border-l-4 border-tertiary-bg text-gray-300',
      celebrate: 'bg-purple-500/10 border-l-4 border-purple-500 text-purple-400',
      warn: 'bg-highlight-yellow/10 border-l-4 border-highlight-yellow text-highlight-yellow',
      notify: 'bg-blue-500/10 border-l-4 border-blue-500 text-blue-400',
      welcome: 'bg-red-600/10 border-l-4 border-red-500 text-white',
      speech: 'bg-primary-bg/10 border-l-4 border-primary-bg text-text-primary',
      logger: 'bg-gray-700/30 border-l-4 border-gray-600 text-gray-300',
      action: 'bg-teal-500/10 border-l-4 border-teal-500 text-teal-400'
    }

    const packetTypeClasses = {
      incoming: 'bg-tertiary-bg/20 border-l-4 border-highlight-green text-text-primary',
      outgoing: 'bg-highlight-green/5 border-l-4 border-highlight-yellow text-text-primary'
    }

    const createElement = (tag, classes = '', content = '') => {
      return $('<' + tag + '>').addClass(classes + ' message-animate-in').html(content)
    }

    const getTime = () => {
      const now = new Date()
      const hour = String(now.getHours()).padStart(2, '0')
      const minute = String(now.getMinutes()).padStart(2, '0')
      const second = String(now.getSeconds()).padStart(2, '0')
      return `${hour}:${minute}:${second}`
    }

    const status = (type, message) => {
      const icon = messageIcons[type]
      if (!icon) throw new Error('Invalid Status Type.')
      return `
        <div class="flex items-center space-x-2 w-full">
          <div class="flex">
            <i class="fas ${icon} mr-2"></i>
          </div>
          <span>${message || ''}</span>
        </div>
      `
    }

    const $container = createElement(
      'div',
      'flex items-start p-3 rounded-md mb-2 shadow-sm max-w-full w-full transition-colors duration-150 hover:bg-opacity-20'
    )

    if (isPacket) {
      $container.addClass(packetTypeClasses[isIncoming ? 'incoming' : 'outgoing'])
    } else {
      $container.addClass(baseTypeClasses[type] || 'bg-tertiary-bg/10 border-l-4 border-tertiary-bg text-text-primary')
    }

    if (isPacket) {
      const iconClass = isIncoming ? 'fa-arrow-down text-highlight-green' : 'fa-arrow-up text-highlight-yellow'
      const $iconContainer = createElement('div', 'flex items-center mr-3 text-base', `<i class="fas ${iconClass}"></i>`)
      $container.append($iconContainer)
    } else if (time) {
      const $timeContainer = createElement('div', 'text-xs text-gray-500 mr-3 whitespace-nowrap font-mono', getTime())
      $container.append($timeContainer)
    }

    const $messageContainer = createElement(
      'div',
      isPacket
        ? 'text-xs flex-1 break-all leading-relaxed'
        : 'flex-1 text-xs flex items-center space-x-2 leading-relaxed'
    )

    if (withStatus && !isPacket) {
      $messageContainer.html(status(type, message))
    } else {
      $messageContainer.text(message)
      if (isPacket) {
        $messageContainer.addClass('font-mono')
      }
    }

    // Apply custom styling if provided
    if (style) {
      $messageContainer.attr('style', style);
    }

    $messageContainer.css({
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
      'white-space': 'normal',
      'word-break': 'break-word'
    })

    $container.append($messageContainer)
    
    // Add data-message-id if provided in details
    if (details && details.messageId) {
      $container.attr('data-message-id', details.messageId);
    }

    if (isPacket && details) {
      const $actionsContainer = createElement('div', 'flex ml-2 items-center')

      const $detailsButton = createElement(
        'button',
        'text-xs text-gray-400 hover:text-text-primary transition-colors px-2 py-1 rounded hover:bg-tertiary-bg/20',
        '<i class="fas fa-code mr-1"></i> Details'
      )

      const $copyButton = createElement(
        'button',
        'text-xs text-gray-400 hover:text-text-primary transition-colors ml-1 px-2 py-1 rounded hover:bg-tertiary-bg/20',
        '<i class="fas fa-copy mr-1"></i> Copy'
      )

      $copyButton.on('click', (e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(message)

        const originalHtml = $copyButton.html()
        $copyButton.html('<i class="fas fa-check mr-1"></i> Copied!')
        $copyButton.addClass('text-highlight-green')

        setTimeout(() => {
          $copyButton.html(originalHtml)
          $copyButton.removeClass('text-highlight-green')
        }, 1500)
      })

      $actionsContainer.append($detailsButton, $copyButton)
      $container.append($actionsContainer)

      const $detailsContainer = createElement(
        'div',
        'bg-tertiary-bg/50 rounded-md p-3 mt-2 hidden w-full',
        `<pre class="text-xs text-text-primary overflow-auto max-h-[300px] font-mono">${JSON.stringify(details, null, 2)}</pre>`
      )

      $detailsButton.on('click', (e) => {
        e.stopPropagation()
        $detailsContainer.toggleClass('hidden')
        const isHidden = $detailsContainer.hasClass('hidden')
        $detailsButton.html(
          isHidden
            ? '<i class="fas fa-code mr-1"></i> Details'
            : '<i class="fas fa-chevron-up mr-1"></i> Hide'
        )
      })

      $container.after($detailsContainer)

      $container.css('cursor', 'pointer')
      $container.on('click', function (e) {
        if (!$(e.target).closest('button').length) {
          $detailsButton.click()
        }
      })
    }

    // Determine the target container based on message type
    const $targetContainer = isPacket ? $('#message-log') : $('#messages');
    
    // Update counters for packet logs
    if (isPacket) {
      const $totalCount = $('#totalCount');
      const $incomingCount = $('#incomingCount');
      const $outgoingCount = $('#outgoingCount');

      const totalCount = parseInt($totalCount.text() || '0', 10) + 1;
      $totalCount.text(totalCount);

      if (isIncoming) {
        const incomingCount = parseInt($incomingCount.text() || '0', 10) + 1;
        $incomingCount.text(incomingCount);
      } else {
        const outgoingCount = parseInt($outgoingCount.text() || '0', 10) + 1;
        $outgoingCount.text(outgoingCount);
      }
      
      // Increment packet log count and check if cleaning is needed
      this._packetLogCount++;
      if (this._packetLogCount > this._maxLogEntries) {
        this._cleanOldLogs($targetContainer, true);
      }
    } else {
      // Increment app message count and check if cleaning is needed
      this._appMessageCount++;
      if (this._appMessageCount > this._maxLogEntries) {
        this._cleanOldLogs($targetContainer, false);
      }
    }

    // Append the container to the appropriate target
    $targetContainer.append($container);

    // Auto-scroll logic
    const isAtBottom = $targetContainer.scrollTop() + $targetContainer.innerHeight() >= $targetContainer[0].scrollHeight - 30;
    if (isAtBottom) {
      $targetContainer.scrollTop($targetContainer[0].scrollHeight);
    }


    if (window.applyFilter) window.applyFilter()
  } // End of consoleMessage method

  /**
   * Cleans old log entries from the specified container.
   * @param {JQuery<HTMLElement>} $logContainer - The jQuery object for the log container.
   * @param {boolean} isPacketLog - Whether the container is for packet logs.
   * @private
   */
  _cleanOldLogs($logContainer, isPacketLog) {
    const entriesToRemove = Math.floor(this._maxLogEntries * this._cleanPercentage);
    const $entries = $logContainer.children('div'); // Assuming logs are direct div children
    const currentTotal = $entries.length;

    if (currentTotal <= this._maxLogEntries) {
      return; // No need to clean yet
    }

    const numberToRemove = Math.min(entriesToRemove, currentTotal - (this._maxLogEntries * (1 - this._cleanPercentage))); // Ensure we don't remove too many
    const logsToRemove = $entries.slice(0, numberToRemove);

    let removedIncoming = 0;
    let removedOutgoing = 0;

    if (isPacketLog) {
      // Count incoming/outgoing packets being removed
      logsToRemove.each(function() {
        if ($(this).hasClass('bg-tertiary-bg/20')) { // Incoming class check
          removedIncoming++;
        } else if ($(this).hasClass('bg-highlight-green/5')) { // Outgoing class check
          removedOutgoing++;
        }
      });
    }

    logsToRemove.remove();

    const newCount = $logContainer.children('div').length;

    // Update counters and internal state
    if (isPacketLog) {
      this._packetLogCount = newCount;

      const $totalCount = $('#totalCount');
      const $incomingCount = $('#incomingCount');
      const $outgoingCount = $('#outgoingCount');

      const currentTotalCount = parseInt($totalCount.text() || '0', 10);
      const currentIncomingCount = parseInt($incomingCount.text() || '0', 10);
      const currentOutgoingCount = parseInt($outgoingCount.text() || '0', 10);

      $totalCount.text(Math.max(0, currentTotalCount - numberToRemove));
      $incomingCount.text(Math.max(0, currentIncomingCount - removedIncoming));
      $outgoingCount.text(Math.max(0, currentOutgoingCount - removedOutgoing));

    } else {
      this._appMessageCount = newCount;
    }

    // Add a notification message about the cleaning
    this.consoleMessage({
        message: `Cleaned ${numberToRemove} oldest log entries to maintain performance.`,
        type: 'notify',
        isPacket: false // Ensure this notification goes to the app messages log
    });

    devLog(`Cleaned ${numberToRemove} old log entries from ${isPacketLog ? 'packet log' : 'app messages'}. New count: ${newCount}`);
  }

  /**
   * Clears all console log messages for a fresh start.
   * Used primarily after initial startup messages are shown.
   * @private
   */
  _clearConsoleMessages() {
    const $messages = $('#messages');
    $messages.empty();
    this._appMessageCount = 0;
  }

  /**
   * Opens Animal Jam Classic, disabling the button during patching.
   * @returns {Promise<void>}
   * @public
   */
  async openAnimalJam () {
    if (!this.$playButton) {
      console.error("Play button element not found!");
      this.$playButton = document.getElementById('playButton'); // Try to get it again
      if (!this.$playButton) return; // Still not found, exit
    }

    // Disable button and apply styles
    this.$playButton.classList.add('opacity-50', 'pointer-events-none');
    this.$playButton.onclick = () => false; // Prevent further clicks via onclick
    
    // Unique ID for the status message
    const startMessageId = `start-aj-${Date.now()}`;
    let launchSuccessful = false;

    try {
      // Log starting message with a unique ID
      this.consoleMessage({ 
        message: 'Starting Animal Jam Classic...', 
        type: 'wait',
        details: { messageId: startMessageId } // Pass ID
      });
      
      await this.patcher.killProcessAndPatch(); // Await the patching process
      
      launchSuccessful = true; // Assume success if killProcessAndPatch completes without error
      
    } catch (error) {
      this.consoleMessage({
        message: `Error launching Animal Jam Classic: ${error.message}`,
        type: 'error'
      });
    } finally {
      // Remove the "Starting..." message ONLY if launch was successful
      if (launchSuccessful) {
        const startingMessageElement = document.querySelector(`[data-message-id='${startMessageId}']`);
        if (startingMessageElement) {
          // Add a short delay before removing the starting message
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
          $(startingMessageElement).remove(); // Use jQuery remove for potential effects
        }
        // Log success message HERE, after removing the starting message
        this.consoleMessage({
          message: 'Successfully launched Animal Jam Classic!',
          type: 'success'
        });
      }
      
      // Re-enable button and remove styles regardless of success/failure
      if (this.$playButton) {
        this.$playButton.classList.remove('opacity-50', 'pointer-events-none');
        // Restore original onclick behavior
        this.$playButton.onclick = () => jam.application.openAnimalJam();
      }
    }
  }

  /**
   * Renders a plugin item
   * @param {Object} plugin
   * @returns {JQuery<HTMLElement>}
   */
  renderPluginItems ({ name, type, description, author = 'Sxip' } = {}) {
    const getIconClass = () => {
      switch (type) {
        case 'ui': return 'fa-window-restore'
        case 'game': return 'fa-code'
      }
    }

    const getIconColorClass = () => {
      switch (type) {
        case 'ui': return 'text-highlight-green'
        case 'game': return 'text-highlight-yellow'
      }
    }

    const onClickEvent = type === 'ui' ? () => jam.application.dispatch.open(name) : null

    const $listItem = $('<li>', { class: type === 'ui' ? 'group' : '' })
    const $container = $('<div>', {
      class: `flex items-center px-3 py-3.5 ${type === 'ui' ? 'hover:bg-tertiary-bg cursor-pointer' : ''} rounded-md transition-colors`,
      click: onClickEvent
    })

    // Replace icon container with just the icon
    const $icon = $('<i>', { 
      class: `fas ${getIconClass()} ${getIconColorClass()} text-xl mr-3` 
    })

    const $contentContainer = $('<div>', { class: 'flex-1 min-w-0' })
    const $titleRow = $('<div>', { class: 'flex items-center justify-between' })

    const $titleText = $('<span>', {
      class: 'text-sidebar-text font-medium whitespace-normal break-words text-[15px]', // Removed truncate, added wrapping
      text: name
    })

    // Add info button with style matching chevron and headerlink icons
    const $infoButton = $('<button>', {
      class: 'ml-2 text-sidebar-text hover:text-theme-primary p-1.5 rounded transition-all',
      'data-tooltip': 'Info',
      'aria-label': `Learn about ${name}`
    }).append(
      $('<i>', { class: 'fas fa-info-circle text-sm' })
    )

    // Stop propagation to prevent opening plugin when clicking info button
    $infoButton.on('click', (e) => {
      e.stopPropagation();
      this._showPluginInfo(name, type, description, author);
    });

    $titleRow.append($titleText, $infoButton)

    const $metaRow = $('<div>', {
      class: 'flex items-center text-[11px] text-gray-400 mt-1'
    })

    $metaRow.append($('<span>', {
      class: 'flex items-center',
      html: `<i class="fas fa-user mr-1 opacity-70"></i>${author}`
    }))

    $metaRow.append($('<span>', {
      class: 'mx-1.5 opacity-50',
      html: '•'
    }))

    $metaRow.append($('<span>', {
      class: 'opacity-70',
      text: type.charAt(0).toUpperCase() + type.slice(1)
    }))

    const $description = $('<p>', {
      class: 'text-xs text-gray-400 whitespace-normal break-words mt-1.5', // Removed truncate, added wrapping
      text: description || `${type.charAt(0).toUpperCase() + type.slice(1)} plugin for Animal Jam`
    })

    $contentContainer.append($titleRow, $metaRow, $description)
    $container.append($icon, $contentContainer)
    $listItem.append($container)

    if (type === 'ui') this.$pluginList.prepend($listItem)
    else this.$pluginList.append($listItem)
    
    // Check if we need to hide the empty plugin message
    this._updateEmptyPluginMessage()
    
    return $listItem
  }
  
  /**
   * Shows plugin information in a kid-friendly UI
   * @param {string} name - Plugin name
   * @param {string} type - Plugin type
   * @param {string} description - Plugin description
   * @param {string} author - Plugin author
   * @private
   */
  _showPluginInfo(name, type, description, author) {
    // Get plugin commands and other metadata if available
    const pluginMetadata = this.dispatch.plugins.get(name);
    let commands = [];
    let version = '';
    let filepath = '';
    let tags = [];
    
    if (pluginMetadata) {
      if (pluginMetadata.configuration) {
        version = pluginMetadata.configuration.version || '';
        commands = pluginMetadata.configuration.commands || [];
        tags = pluginMetadata.configuration.tags || [];
      }
      filepath = pluginMetadata.filepath || '';
    }
    
    // Create modal container
    const $modal = $('<div>', {
      class: 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm',
      id: 'pluginInfoModal'
    });
    
    // Create the modal content with kid-friendly styling - removed white border
    const $content = $('<div>', {
      class: 'bg-primary-bg rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden transform transition-all duration-200 scale-100 hover:scale-[1.01]'
    });
    
    // Modal header with fun styling
    const $header = $('<div>', {
      class: 'px-6 py-4 bg-gradient-to-r from-highlight-blue/20 to-highlight-blue/5 border-b border-highlight-blue/50 flex items-center justify-between'
    });
    
    // Title with bouncy animation on hover
    const $title = $('<h3>', {
      class: 'text-lg font-bold text-highlight-blue flex items-center transition-transform duration-200',
      html: `<i class="fas ${type === 'ui' ? 'fa-window-restore' : 'fa-code'} mr-2 transform transition-all duration-300"></i> ${name}`
    });
    
    // Add bounce effect on hover
    $title.hover(
      function() {
        $(this).find('i').addClass('animate-bounce');
      },
      function() {
        $(this).find('i').removeClass('animate-bounce');
      }
    );
    
    // Close button with pulse effect
    const $closeButton = $('<button>', {
      class: 'text-gray-400 hover:text-highlight-red transition-colors duration-200 transform hover:scale-110 rounded-full p-1 hover:bg-highlight-red/10',
      'aria-label': 'Close'
    }).append(
      $('<i>', { class: 'fas fa-times' })
    ).on('click', () => {
      // Fade out animation
      $modal.css({
        'opacity': '0',
        'transform': 'scale(0.95)',
        'transition': 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out'
      });
      
      setTimeout(() => $modal.remove(), 200);
    });
    
    $header.append($title, $closeButton);
    
    // Modal body with colorful sections for kids
    const $body = $('<div>', {
      class: 'px-6 py-5 max-h-[65vh] overflow-y-auto custom-scrollbar'
    });
    
    // Version and tags display if available
    if (version || (tags && tags.length > 0)) {
      const $versionTagsContainer = $('<div>', {
        class: 'flex flex-wrap items-center gap-2 mb-4'
      });
      
      if (version) {
        $versionTagsContainer.append(
          $('<span>', {
            class: 'px-2 py-1 text-xs font-semibold rounded-full bg-tertiary-bg text-text-secondary',
            text: `v${version}`
          })
        );
      }
      
      if (tags && tags.length > 0) {
        tags.forEach(tag => {
          let tagColorClass = '';
          switch(tag.toLowerCase()) {
            case 'beta':
              tagColorClass = 'bg-highlight-yellow/20 text-highlight-yellow';
              break;
            case 'new':
              tagColorClass = 'bg-highlight-green/20 text-highlight-green';
              break;
            case 'networking':
              tagColorClass = 'bg-highlight-blue/20 text-highlight-blue';
              break;
            case 'account':
              tagColorClass = 'bg-highlight-purple/20 text-highlight-purple';
              break;
            default:
              tagColorClass = 'bg-gray-600/20 text-gray-400';
          }
          
          $versionTagsContainer.append(
            $('<span>', {
              class: `px-2 py-1 text-xs font-semibold rounded-full ${tagColorClass}`,
              text: tag
            })
          );
        });
      }
      
      $body.append($versionTagsContainer);
    }
    
    // What is this plugin? - with hover effects
    const $whatIsSection = $('<div>', {
      class: 'mb-5 bg-highlight-green/10 p-4 rounded-lg border border-highlight-green/30 transform transition-all duration-200 hover:border-highlight-green/60 hover:bg-highlight-green/15 hover:shadow-md'
    });
    
    $whatIsSection.append(
      $('<h4>', {
        class: 'text-highlight-green text-base font-bold mb-2 flex items-center',
        html: '<i class="fas fa-puzzle-piece mr-2"></i> What is this plugin?'
      }),
      $('<p>', {
        class: 'text-text-primary text-sm leading-relaxed',
        text: description || `A ${type} plugin for Animal Jam`
      })
    );
    
    $body.append($whatIsSection);
    
    // Who made it? - with hover effects
    const $whoMadeSection = $('<div>', {
      class: 'mb-5 bg-highlight-yellow/10 p-4 rounded-lg border border-highlight-yellow/30 transform transition-all duration-200 hover:border-highlight-yellow/60 hover:bg-highlight-yellow/15 hover:shadow-md'
    });
    
    $whoMadeSection.append(
      $('<h4>', {
        class: 'text-highlight-yellow text-base font-bold mb-2 flex items-center',
        html: '<i class="fas fa-user-edit mr-2"></i> Who made it?'
      }),
      $('<p>', {
        class: 'text-text-primary text-sm leading-relaxed flex items-center',
        html: `<i class="fas fa-user mr-2"></i> ${author}${version ? ` <span class="ml-2 text-gray-400">(Version ${version})</span>` : ''}`
      })
    );
    
    $body.append($whoMadeSection);
    
    // How do I use it? - detailed instructions based on plugin type
    const $howToSection = $('<div>', {
      class: 'mb-5 bg-highlight-blue/10 p-4 rounded-lg border border-highlight-blue/30 transform transition-all duration-200 hover:border-highlight-blue/60 hover:bg-highlight-blue/15 hover:shadow-md'
    });
    
    $howToSection.append(
      $('<h4>', {
        class: 'text-highlight-blue text-base font-bold mb-2 flex items-center',
        html: '<i class="fas fa-lightbulb mr-2"></i> How do I use it?'
      })
    );
    
    // Customize the instructions based on plugin name
    let howToUseHtml = '';
    
    if (type === 'ui') {
      // Basic instructions for UI plugins
      howToUseHtml = `
        <p class="text-text-primary text-sm leading-relaxed mb-3">
          Click on the plugin in the sidebar to open it! <i class="fas fa-mouse-pointer text-xs"></i>
        </p>
      `;
      
      // Add specific instructions based on plugin name
      if (name.toLowerCase().includes('packet') && name.toLowerCase().includes('spam')) {
        howToUseHtml += `
          <div class="space-y-3 mt-3">
            <div class="bg-secondary-bg/30 p-3 rounded-lg">
              <p class="text-text-primary text-sm font-medium mb-2 flex items-center">
                <i class="fas fa-bolt mr-2"></i> What is Packet Spammer?
              </p>
              <p class="text-text-primary text-sm leading-relaxed">
                Think of packets as little messages your game sends to and from Animal Jam's servers.
                This tool lets you send these messages repeatedly to do certain actions in the game.
              </p>
            </div>
            
            <div class="bg-secondary-bg/30 p-3 rounded-lg">
              <p class="text-text-primary text-sm font-medium mb-2 flex items-center">
                <i class="fas fa-gamepad mr-2"></i> Using the buttons:
              </p>
              <ul class="text-text-primary text-sm space-y-2 list-disc pl-5">
                <li>
                  <span class="text-highlight-blue font-medium">Packet Type:</span> 
                  Choose whether to send the packet to the game (client) or to Animal Jam's servers
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Packet Content:</span>
                  Type or paste the packet message you want to send
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Delay (ms):</span>
                  How long to wait between sending each packet (in milliseconds)
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Count:</span>
                  How many packets to send (leave empty to send continuously)
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Start button:</span>
                  Begin sending the packets
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Stop button:</span>
                  Stop sending packets
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Save/Load buttons:</span>
                  Save your favorite packet setups to use them again later
                </li>
              </ul>
            </div>
            
            <div class="bg-highlight-yellow/10 p-3 rounded-lg">
              <p class="text-highlight-yellow text-sm font-medium flex items-center mb-1">
                <i class="fas fa-exclamation-triangle mr-2"></i> Friendly reminder:
              </p>
              <p class="text-text-primary text-sm leading-relaxed">
                Be careful with this tool! Sending too many packets too quickly can cause lag or get you disconnected.
              </p>
            </div>
          </div>
        `;
      } else if (name.toLowerCase().includes('login')) {
        howToUseHtml += `
          <div class="space-y-3 mt-3">
            <div class="bg-secondary-bg/30 p-3 rounded-lg">
              <p class="text-text-primary text-sm font-medium mb-2 flex items-center">
                <i class="fas fa-key mr-2"></i> What does this plugin do?
              </p>
              <p class="text-text-primary text-sm leading-relaxed">
                This plugin lets you see and change the information sent between your game and Animal Jam's servers when you log in.
              </p>
            </div>
            
            <div class="bg-secondary-bg/30 p-3 rounded-lg">
              <p class="text-text-primary text-sm font-medium mb-2 flex items-center">
                <i class="fas fa-gamepad mr-2"></i> Using the features:
              </p>
              <ul class="text-text-primary text-sm space-y-2 list-disc pl-5">
                <li>
                  <span class="text-highlight-blue font-medium">View Login Packet:</span> 
                  See all the information that gets sent when you log in
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Edit Fields:</span>
                  Change values in the editor (for advanced users)
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Packet Editor:</span>
                  The large text box shows the login information in a format called JSON
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Save/Load:</span>
                  Save your changes for later or load previously saved settings
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Apply Changes:</span>
                  Use your modifications the next time you log in
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Reset:</span>
                  Go back to the original settings if something goes wrong
                </li>
              </ul>
            </div>
            
            <div class="bg-highlight-yellow/10 p-3 rounded-lg">
              <p class="text-highlight-yellow text-sm font-medium flex items-center mb-1">
                <i class="fas fa-exclamation-triangle mr-2"></i> Friendly reminder:
              </p>
              <p class="text-text-primary text-sm leading-relaxed">
                This is an advanced tool. If you're not sure what you're doing, just look but don't change anything!
              </p>
            </div>
          </div>
        `;
      } else if (name.toLowerCase().includes('advertis')) {
        howToUseHtml += `
          <div class="space-y-3 mt-3">
            <div class="bg-secondary-bg/30 p-3 rounded-lg">
              <p class="text-text-primary text-sm font-medium mb-2 flex items-center">
                <i class="fas fa-bullhorn mr-2"></i> What does this plugin do?
              </p>
              <p class="text-text-primary text-sm leading-relaxed">
                This plugin helps you automatically send messages in the game at regular intervals - perfect for advertising your den, items for trade, or just saying hello!
              </p>
            </div>
            
            <div class="bg-secondary-bg/30 p-3 rounded-lg">
              <p class="text-text-primary text-sm font-medium mb-2 flex items-center">
                <i class="fas fa-gamepad mr-2"></i> Step-by-step guide:
              </p>
              <ol class="text-text-primary text-sm space-y-2 list-decimal pl-5">
                <li>
                  <span class="text-highlight-blue font-medium">Add messages:</span> 
                  Click the "Add Message" button and type your message in the box
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Set interval:</span>
                  Enter how many seconds to wait between messages (60 seconds is a good start)
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Choose order:</span>
                  Pick "Sequential" to send messages in order or "Random" to mix them up
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Start advertising:</span>
                  Click the "Start" button to begin sending your messages
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Stop anytime:</span>
                  Click "Stop" when you want to pause the messages
                </li>
              </ol>
            </div>
            
            <div class="bg-secondary-bg/30 p-3 rounded-lg">
              <p class="text-text-primary text-sm font-medium mb-2 flex items-center">
                <i class="fas fa-save mr-2"></i> Save your setup:
              </p>
              <p class="text-text-primary text-sm leading-relaxed">
                Once you've created the perfect set of messages:
              </p>
              <ul class="text-text-primary text-sm space-y-1 list-disc pl-5">
                <li>Click "Save" to save your configuration</li>
                <li>Use "Load" to bring back your saved messages later</li>
              </ul>
            </div>
            
            <div class="bg-highlight-yellow/10 p-3 rounded-lg">
              <p class="text-highlight-yellow text-sm font-medium flex items-center mb-1">
                <i class="fas fa-exclamation-triangle mr-2"></i> Friendly reminder:
              </p>
              <p class="text-text-primary text-sm leading-relaxed">
                Don't set the interval too short or spam the same message - that could get you in trouble!
              </p>
            </div>
          </div>
        `;
      } else if (name.toLowerCase().includes('logger')) {
        howToUseHtml += `
          <div class="space-y-3 mt-3">
            <div class="bg-secondary-bg/30 p-3 rounded-lg">
              <p class="text-text-primary text-sm font-medium mb-2 flex items-center">
                <i class="fas fa-users mr-2"></i> What does this plugin do?
              </p>
              <p class="text-text-primary text-sm leading-relaxed">
                This plugin automatically collects usernames of jammers you see in the game and saves them in a file.
              </p>
            </div>
            
            <div class="bg-secondary-bg/30 p-3 rounded-lg">
              <p class="text-text-primary text-sm font-medium mb-2 flex items-center">
                <i class="fas fa-gamepad mr-2"></i> How to use it:
              </p>
              <ul class="text-text-primary text-sm space-y-2 list-disc pl-5">
                <li>
                  <span class="text-highlight-blue font-medium">Turn on/off:</span> 
                  Type <span class="font-mono bg-tertiary-bg px-1 rounded">userlog on</span> or <span class="font-mono bg-tertiary-bg px-1 rounded">userlog off</span> in the command line
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Check status:</span>
                  Type <span class="font-mono bg-tertiary-bg px-1 rounded">userlog status</span> to see if it's running
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Find saved usernames:</span>
                  Username logs are saved in your data folder
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Change settings:</span>
                  Type <span class="font-mono bg-tertiary-bg px-1 rounded">userlogsettings</span> to customize how it works
                </li>
              </ul>
            </div>
            
            <div class="bg-highlight-yellow/10 p-3 rounded-lg">
              <p class="text-highlight-yellow text-sm font-medium flex items-center mb-1">
                <i class="fas fa-exclamation-triangle mr-2"></i> Friendly reminder:
              </p>
              <p class="text-text-primary text-sm leading-relaxed">
                Be respectful of other jammers' privacy and only use collected usernames for positive purposes!
              </p>
            </div>
          </div>
        `;
      } else {
        howToUseHtml += `
          <div class="space-y-3 mt-3">
            <div class="bg-secondary-bg/30 p-3 rounded-lg">
              <p class="text-text-primary text-sm font-medium mb-2 flex items-center">
                <i class="fas fa-gamepad mr-2"></i> Step-by-step guide:
              </p>
              <ol class="text-text-primary text-sm space-y-2 list-decimal pl-5">
                <li>
                  <span class="text-highlight-blue font-medium">Open the plugin:</span> 
                  Click on this plugin in the sidebar
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Explore the options:</span>
                  Look through all the buttons and controls
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Try things out:</span>
                  Don't be afraid to experiment with different settings
                </li>
                <li>
                  <span class="text-highlight-blue font-medium">Have fun:</span>
                  See how this plugin enhances your Animal Jam experience!
                </li>
              </ol>
            </div>
            
            <div class="bg-secondary-bg/30 p-3 rounded-lg">
              <p class="text-text-primary text-sm font-medium mb-2 flex items-center">
                <i class="fas fa-lightbulb mr-2"></i> Common actions:
              </p>
              <p class="text-text-primary text-sm leading-relaxed">
                <span class="inline-block bg-tertiary-bg text-highlight-blue px-2 py-1 rounded-md mb-1">
                  <i class="fas fa-mouse-pointer mr-1"></i> Button clicks
                </span> 
                Most plugins have buttons you can click to activate features
              </p>
              <p class="text-text-primary text-sm leading-relaxed">
                <span class="inline-block bg-tertiary-bg text-highlight-blue px-2 py-1 rounded-md mb-1">
                  <i class="fas fa-cog mr-1"></i> Settings
                </span>
                Look for settings or gear icons to customize how things work
              </p>
            </div>
            
            <div class="bg-highlight-yellow/10 p-3 rounded-lg">
              <p class="text-highlight-yellow text-sm font-medium flex items-center mb-1">
                <i class="fas fa-exclamation-triangle mr-2"></i> Need help?
              </p>
              <p class="text-text-primary text-sm leading-relaxed">
                If you're not sure how to use this plugin, ask in our Discord server!
              </p>
            </div>
          </div>
        `;
      }
    } else {
      // Game plugin instructions
      howToUseHtml = `
        <div class="space-y-3">
          <p class="text-text-primary text-sm leading-relaxed">
            Game plugins run automatically when you play Animal Jam! You can use commands to control them.
          </p>
          
          <div class="bg-secondary-bg/30 p-3 rounded-lg">
            <p class="text-text-primary text-sm font-medium mb-2 flex items-center">
              <i class="fas fa-gamepad mr-2"></i> How to use this plugin:
            </p>
            <ol class="text-text-primary text-sm space-y-2 list-decimal pl-5">
              <li>
                <span class="text-highlight-blue font-medium">It's already working!</span> 
                Game plugins like this one run in the background while you play
              </li>
              <li>
                <span class="text-highlight-blue font-medium">Use commands:</span>
                Type commands in the command box at the bottom of this window
              </li>
              <li>
                <span class="text-highlight-blue font-medium">Check the commands:</span>
                Look at the "Commands you can use" section below
              </li>
            </ol>
          </div>
          
          <div class="bg-highlight-yellow/10 p-3 rounded-lg">
            <p class="text-highlight-yellow text-sm font-medium flex items-center mb-1">
              <i class="fas fa-exclamation-triangle mr-2"></i> Need help?
            </p>
            <p class="text-text-primary text-sm leading-relaxed">
              If you're not sure how to use this plugin, ask in our Discord server!
            </p>
          </div>
        </div>
      `;
    }
    
    $howToSection.append(howToUseHtml);
    $body.append($howToSection);
    
    // Special handling for InvisibleToggle plugin
    if (name === 'InvisibleToggle') {
      // Add commands section for InvisibleToggle
      const $invisibleCommandsSection = $('<div>', {
        class: 'mb-5 bg-highlight-purple/10 p-4 rounded-lg border border-highlight-purple/30 transform transition-all duration-200 hover:border-highlight-purple/60 hover:bg-highlight-purple/15 hover:shadow-md'
      });
      
      $invisibleCommandsSection.append(
        $('<h4>', {
          class: 'text-highlight-purple text-base font-bold mb-3 flex items-center',
          html: '<i class="fas fa-terminal mr-2"></i> Commands you can use:'
        })
      );
      
      const $commandsList = $('<ul>', {
        class: 'space-y-3'
      });
      
      const $cmdItem = $('<li>', {
        class: 'text-text-primary text-sm bg-secondary-bg/50 p-3 rounded-lg border border-sidebar-border/30 transform transition-all duration-200 hover:border-highlight-purple/30 hover:bg-secondary-bg'
      });
      
      const $cmdName = $('<div>', {
        class: 'font-mono bg-highlight-purple/20 px-2 py-1 rounded text-highlight-purple inline-block mb-1.5',
        text: 'invis'
      });
      
      const $cmdDesc = $('<div>', {
        class: 'text-text-primary leading-relaxed',
        text: 'Toggle invisibility ON/OFF. Use this command to hide your character from other players.'
      });
      
      $cmdItem.append($cmdName, $cmdDesc);
      $commandsList.append($cmdItem);
      
      // How to access advanced section
      const $advancedSection = $('<div>', {
        class: 'mt-3 bg-secondary-bg/30 p-3 rounded-lg'
      });
      
      $advancedSection.append(
        $('<p>', {
          class: 'text-text-primary text-sm font-medium mb-2 flex items-center',
          html: '<i class="fas fa-info-circle mr-2"></i> How to use this command:'
        }),
        $('<p>', {
          class: 'text-text-primary text-sm leading-relaxed',
          html: `Type <span class="font-mono bg-tertiary-bg px-1 rounded text-highlight-purple">!invis</span> in the command box at the bottom of Jam to toggle invisibility on or off.`
        })
      );
      
      $commandsList.append($advancedSection);
      $invisibleCommandsSection.append($commandsList);
      $body.append($invisibleCommandsSection);
    }
    
    // Display commands if available with interactive styling
    if (commands && commands.length > 0) {
      const $commandsSection = $('<div>', {
        class: 'mb-5 bg-highlight-purple/10 p-4 rounded-lg border border-highlight-purple/30 transform transition-all duration-200 hover:border-highlight-purple/60 hover:bg-highlight-purple/15 hover:shadow-md'
      });
      
      $commandsSection.append(
        $('<h4>', {
          class: 'text-highlight-purple text-base font-bold mb-3 flex items-center',
          html: '<i class="fas fa-terminal mr-2"></i> Commands you can use:'
        })
      );
      
      const $commandsList = $('<ul>', {
        class: 'space-y-3'
      });
      
      commands.forEach(cmd => {
        const $cmdItem = $('<li>', {
          class: 'text-text-primary text-sm bg-secondary-bg/50 p-3 rounded-lg border border-sidebar-border/30 transform transition-all duration-200 hover:border-highlight-purple/30 hover:bg-secondary-bg'
        });
        
        const $cmdName = $('<div>', {
          class: 'font-mono bg-highlight-purple/20 px-2 py-1 rounded text-highlight-purple inline-block mb-1.5',
          text: cmd.name
        });
        
        const $cmdDesc = $('<div>', {
          class: 'text-text-primary leading-relaxed',
          text: cmd.description || ''
        });
        
        $cmdItem.append($cmdName, $cmdDesc);
        $commandsList.append($cmdItem);
      });
      
      $commandsSection.append($commandsList);
      $body.append($commandsSection);
    }
    
    // Add a fun footer with bouncy button
    const $footer = $('<div>', {
      class: 'px-6 py-4 bg-gradient-to-r from-tertiary-bg to-tertiary-bg/70 border-t border-sidebar-border/50 flex justify-end items-center'
    });
    
    // Add directory button if available
    if (filepath) {
      const $dirButton = $('<button>', {
        class: 'mr-auto bg-tertiary-bg hover:bg-tertiary-bg/80 text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg transition-colors text-xs flex items-center',
        html: '<i class="fas fa-folder mr-1.5"></i> Open folder'
      }).on('click', () => {
        this.directory(name);
      });
      
      $footer.append($dirButton);
    }
    
    // Got it button with bounce effect
    const $gotItButton = $('<button>', {
      class: 'bg-highlight-blue hover:bg-highlight-blue/90 text-white px-5 py-2 rounded-lg transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm',
      text: 'Got it!'
    }).on('click', () => {
      // Fade out animation
      $modal.css({
        'opacity': '0',
        'transform': 'scale(0.95)',
        'transition': 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out'
      });
      
      setTimeout(() => $modal.remove(), 200);
    });
    
    $footer.append($gotItButton);
    
    // Assemble and add to DOM
    $content.append($header, $body, $footer);
    $modal.append($content);
    $('body').append($modal);
    
    // Fade in animation
    $modal.css({
      'opacity': '0',
      'transform': 'scale(0.95)'
    });
    
    setTimeout(() => {
      $modal.css({
        'opacity': '1',
        'transform': 'scale(1)',
        'transition': 'opacity 0.3s ease-out, transform 0.3s ease-out'
      });
    }, 10);
  }

  /**
   * Updates the empty plugin message visibility
   * @private
   */
  _updateEmptyPluginMessage() {
    const $emptyPluginMessage = $('#emptyPluginMessage')
    if ($emptyPluginMessage.length > 0) {
      const hasPlugins = this.$pluginList.children().not(function() {
        return this.nodeType === 3 || $(this).text().trim() === ''
      }).length > 0
      
      $emptyPluginMessage.toggleClass('hidden', hasPlugins)
    }
  }

  /**
   * Instantiates the application.
   * @returns {Promise<void>}
   * @public
   */
  async instantiate () {
    // Wait for the data path to be received from the main process
    devLog('[Renderer] Waiting for data path from main process...');
    await this.dataPathPromise;
    devLog(`[Renderer] Data path received: ${this.dataPath}`);
    
    // Initialize Dispatch with the data path
    this.dispatch = new Dispatch(this, this.dataPath);
    devLog('[Renderer] Dispatch initialized with data path');
    
    // Register core commands
    registerCoreCommands(this.dispatch, this);
    devLog('[Renderer] Core commands registered');
    
    // Load settings (log only in dev mode)
    await this.settings.load();
    if (isDevelopment) {
      devLog('[Settings] Settings loaded successfully');
    }
    
    // Display the loading plugins message first (like original Jam)
    this.consoleMessage({
      message: 'Loading plugins...',
      type: 'wait'
    });
    
    // Load plugins with concise messaging
    await this.dispatch.load();
    
    // Log plugin counts in a simpler format
    const pluginCount = this.dispatch.plugins ? this.dispatch.plugins.size : 0;
    this.consoleMessage({
      message: `Successfully loaded ${pluginCount} plugins.`,
      type: 'success'
    });

    // Host change check - only log in development mode
    const secureConnection = this.settings.get('secureConnection')
    if (secureConnection) {
      if (isDevelopment) {
        devLog('[Host] Checking for server host changes...');
      }
      await this._checkForHostChanges()
    }

    // Start the server
    await this.server.serve();
    
    // Clear all console messages just once, right before showing our final messages
    this._clearConsoleMessages();
    
    // Wait a moment to ensure clearing is complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Show final welcome message
    this.consoleMessage({
      message: 'Server started!',
      type: 'success'
    });
    
    this.consoleMessage({
      message: 'Thanks for choosing strawberry jam, type commands here to use plugins.',
      type: 'welcome'
    });
    
    // this._setupPluginIPC(); // Call moved to constructor
    this.emit('ready')

    // Signal to main process that renderer is ready (for auto-resume logic)
    devLog('[Renderer] Application instantiated, sending renderer-ready signal.');
    ipcRenderer.send('renderer-ready');

    // Attach close button listener
    const closeButton = document.getElementById('closeButton');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.close(); // Call the existing close method
      });
      devLog('[Renderer] Close button listener attached.');
    } else {
      devError('[Renderer] Close button element (#closeButton) not found!');
    }
  }
}
