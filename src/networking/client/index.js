const { ConnectionMessageTypes } = require('../../Constants')
const { TLSSocket } = require('tls')
const DelimiterTransform = require('../transform')
const { Socket } = require('net')

/**
 * Messages.
 * @constant
 */
const Message = require('../messages')
const XmlMessage = require('../messages/XmlMessage')
const XtMessage = require('../messages/XtMessage')
const JsonMessage = require('../messages/JsonMessage')

/**
 * Connection message blacklist types.
 * @type {Set<string>}
 * @constant
 */
const BLACKLIST_MESSAGES = new Set([
  'apiOK',
  'verChk',
  'rndK',
  'login'
])

module.exports = class Client {
  /**
   * Constructor.
   * @constructor
   */
  constructor (connection, server) {
    /**
     * The server that instantiated this client.
     * @type {Server}
     * @private
     */
    this._server = server

    /**
     * The remote connection to Animal Jam.
     * @type {TLSSocket | Socket}
     * @private
     */
    const secureConnection = this._server.application.settings.get('secureConnection')
    this._aj = secureConnection ? new TLSSocket() : new Socket()

    /**
     * Connected indicator.
     * @type {boolean}
     * @public
     */
    this.connected = false

    /**
     * The connection that instantiated this client.
     * @type {NetifySocket}
     * @private
     */
    this._connection = connection
  }

  /**
   * Validates and returns the appropriate message type.
   * @param {string} packetString
   * @returns {Message|null}
   * @private
   */
  static validate (message) {
    if (message[0] === '<' && message[message.length - 1] === '>') return new XmlMessage(message)
    if (message[0] === '%' && message[message.length - 1] === '%') return new XtMessage(message)
    if (message[0] === '{' && message[message.length - 1] === '}') return new JsonMessage(message)
    return null
  }

  /**
 * Attempts to create a socket connection.
 * @returns {Promise<void>}
 * @public
 */
  async connect () {
    if (this._aj.destroyed) {
      const secureConnection = this._server &&
        this._server.application &&
        this._server.application.settings &&
        typeof this._server.application.settings.get === 'function'
        ? this._server.application.settings.get('secureConnection')
        : false

      this._aj = secureConnection ? new TLSSocket() : new Socket()
    }

    try {
      // Ensure we have the correct server settings
      let smartfoxServer = this._server?.application?.settings?.get('smartfoxServer');
      
      // If server is empty, null, or not a valid string, use default
      if (!smartfoxServer || typeof smartfoxServer !== 'string' || !smartfoxServer.includes('animaljam')) {
        smartfoxServer = "lb-iss04-classic-prod.animaljam.com";
      }

      // Create a timeout promise to avoid hanging
      const connectionPromise = new Promise((resolve, reject) => {
        const onError = (err) => {
          cleanupListeners();
          reject(err);
        }

        const onConnected = () => {
          cleanupListeners();
          this.connected = true;
          resolve();
        }

        const cleanupListeners = () => {
          this._aj.off('error', onError);
          this._aj.off('connect', onConnected);
        }

        this._aj.once('error', onError);
        this._aj.once('connect', onConnected);

        // Add check for empty server value
        if (!smartfoxServer) {
          reject(new Error('Invalid server address. Unable to connect.'));
          return;
        }

        this._aj.connect({
          host: smartfoxServer,
          port: 443,
          rejectUnauthorized: false
        });
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timed out after 10 seconds')), 10000);
      });

      await Promise.race([connectionPromise, timeoutPromise]);

      // Set up the transforms
      this._setupTransforms();
    } catch (error) {
      this._server.application.consoleMessage({
        message: `Connection error: ${error.message}`,
        type: 'error'
      })
    }
  }

  /**
 * Sets up the necessary transforms for socket connections.
 * @private
 */
  _setupTransforms () {
    const ajTransform = new DelimiterTransform(0x00)
    const connectionTransform = new DelimiterTransform(0x00)

    this._aj
      .pipe(ajTransform)
      .on('data', (message) => {
        message = message.toString()

        const validatedMessage = this.constructor.validate(message)
        if (validatedMessage) {
          validatedMessage.parse()

          this._onMessageReceived({
            type: ConnectionMessageTypes.aj,
            message: validatedMessage,
            packet: message
          })
        }
      })
      .once('close', this.disconnect.bind(this))

    this._connection
      .pipe(connectionTransform)
      .on('data', (message) => {
        message = message.toString()

        const validatedMessage = this.constructor.validate(message)
        if (validatedMessage) {
          validatedMessage.parse()

          this._onMessageReceived({
            type: ConnectionMessageTypes.connection,
            message: validatedMessage,
            packet: message
          })
        }
      })
      .once('close', this.disconnect.bind(this))
  }

  /**
   * Sends a connection message.
   * @param message
   * @returns {Promise<number>}
   * @public
   */
  sendConnectionMessage (message) {
    return this._sendMessage(this._connection, message)
  }

  /**
   * Sends a remote message.
   * @param message
   * @returns {Promise<number>}
   * @public
   */
  sendRemoteMessage (message) {
    return this._sendMessage(this._aj, message)
  }

  /**
   * Sends a message through the provided socket.
   * @param socket
   * @param message
   * @returns {Promise<number>}
   * @private
   */
  async _sendMessage (socket, message) {
    if (message instanceof Message) message = message.toMessage()

    if (!socket.writable || socket.destroyed) {
      throw new Error('Failed to write to socket after end!')
    }

    return new Promise((resolve, reject) => {
      const onError = (err) => {
        cleanup()
        reject(err)
      }

      const onDrain = () => {
        cleanup()
        resolve(message.length)
      }

      const onClose = () => {
        cleanup()
        reject(new Error('Socket closed before the message could be sent'))
      }

      const cleanup = () => {
        socket.off('error', onError)
        socket.off('drain', onDrain)
        socket.off('close', onClose)
      }

      socket.once('error', onError)
      socket.once('drain', onDrain)
      socket.once('close', onClose)

      const writable = socket.write(message) && socket.write('\x00')

      if (writable) {
        cleanup()
        resolve(message.length)
      }
    }).catch((error) => {
      this._server.application.consoleMessage({
        message: `Message sending error: ${error.message}`,
        type: 'error'
      })
      throw error
    })
  }

  /**
   * Handles received message.
   * @param message
   * @private
   */
  async _onMessageReceived ({ type, message, packet }) {
    this._server.application.dispatch.all({ client: this, type, message })

    if (type === ConnectionMessageTypes.aj && packet.includes('cross-domain-policy')) {
      const crossDomainMessage = `<?xml version="1.0"?>
        <!DOCTYPE cross-domain-policy SYSTEM "http://www.adobe.com/xml/dtds/cross-domain-policy.dtd">
        <cross-domain-policy>
        <allow-access-from domain="*" to-ports="80,443"/>
        </cross-domain-policy>`

      await this.sendConnectionMessage(crossDomainMessage)
      return
    }

    // Handle blacklisted messages
    if (type === ConnectionMessageTypes.connection && BLACKLIST_MESSAGES.has(message.type)) {
      await this.sendRemoteMessage(packet)
      return
    }

    if (message.send) {
      if (type === ConnectionMessageTypes.connection) {
        await this.sendRemoteMessage(message)
      } else {
        await this.sendConnectionMessage(message)
      }
    }
  }

  /**
   * Disconnects the session from the remote host and server.
   * @returns {Promise<void>}
   * @public
   */
  async disconnect () {
    this._connection.destroy()
    this._aj.destroy()

    const { dispatch } = this._server.application
    dispatch.intervals.forEach((interval) => dispatch.clearInterval(interval))
    dispatch.intervals.clear()

    if (this.connected) {
      this.connected = false
      this._server.clients.delete(this)
      
      // Get the timestamps of recent console messages to avoid showing disconnect
      // message right after a successful AJ launch
      const recentLaunchSuccess = this._wasGameJustLaunched();
      
      // Only show disconnection message if we didn't just launch the game
      if (!recentLaunchSuccess) {
        this._server.application.consoleMessage({
          message: 'Connection to Animal Jam servers closed.',
          type: 'notify'
        })
      }
    } else {
      this._server.clients.delete(this)
    }
  }
  
  /**
   * Checks if Animal Jam was just successfully launched.
   * @returns {boolean} True if the game was launched within the last 5 seconds
   * @private
   */
  _wasGameJustLaunched() {
    try {
      // Try to find the message log container
      const messagesContainer = document.getElementById('messages');
      if (!messagesContainer) return false;
      
      // Look through recent messages
      const messages = messagesContainer.getElementsByClassName('message-animate-in');
      if (!messages || messages.length === 0) return false;
      
      // Check the last few messages for launch success message
      const messageCount = Math.min(messages.length, 10); // Check the last 10 messages
      for (let i = messages.length - 1; i >= messages.length - messageCount; i--) {
        const messageElement = messages[i];
        if (!messageElement) continue;
        
        // Check if this is a success message with the launch text
        const successText = messageElement.textContent || '';
        if (successText.includes('Successfully launched Animal Jam Classic')) {
          // Get the message timestamp
          const timestampElement = messageElement.querySelector('.text-xs.text-gray-500');
          if (!timestampElement) return true; // If no timestamp, assume it's recent
          
          const timestampText = timestampElement.textContent || '';
          const currentTime = new Date();
          const messageParts = timestampText.split(':');
          
          if (messageParts.length === 3) {
            // Create a date with the same hour/minute/second
            const messageTime = new Date();
            messageTime.setHours(parseInt(messageParts[0], 10));
            messageTime.setMinutes(parseInt(messageParts[1], 10));
            messageTime.setSeconds(parseInt(messageParts[2], 10));
            
            // If the message is less than 5 seconds old, consider it "just launched"
            const timeDiff = currentTime - messageTime;
            return timeDiff < 5000; // 5 seconds
          }
          
          return true; // If we can't parse the time, assume it's recent
        }
      }
      
      return false; // No launch success message found
    } catch (e) {
      // If any error occurs, default to showing the message
      return false;
    }
  }
}
