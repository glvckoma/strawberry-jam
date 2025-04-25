"use strict";

(() => {
  customElements.define("ajd-packet-spammer-tray", class extends HTMLElement {
    constructor() {
      super();

      // Create the toggle icon that will be fixed in the top right
      this.toggleIcon = document.createElement('div');
      this.toggleIcon.className = 'icon-button';
      this.toggleIcon.innerHTML = '<span>📨</span>'; // Using an emoji for the icon
      this.toggleIcon.title = 'Packet Spammer';
      this.toggleIcon.addEventListener('click', () => this.toggleVisibility());

      this.attachShadow({mode: "open"}).innerHTML = `
        <style>
          :host {
            --tray-width: 320px;
            --tray-height: 400px;
            --header-height: 40px;
            --button-height: 30px;
            --border-radius: 8px;
            display: block;
            position: absolute;
            width: var(--tray-width);
            height: var(--tray-height);
            background-color: rgba(24, 26, 31, 0.95);
            border: 2px solid #4a5568;
            border-radius: var(--border-radius);
            color: white;
            font-family: 'CCDigitalDelivery', sans-serif;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
            overflow: hidden;
            /* Position in top right by default */
            top: 10px;
            right: 10px;
            /* Change from leftward slide-out to rightward */
            transform: translateX(calc(var(--tray-width) + 20px));
            opacity: 0;
          }

          :host(.visible) {
            transform: translateX(0);
            opacity: 1;
          }

          .tray-header {
            height: var(--header-height);
            background-color: #2d3748;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 10px;
            border-top-left-radius: var(--border-radius);
            border-top-right-radius: var(--border-radius);
            user-select: none;
            cursor: move;
          }

          .tray-title {
            font-weight: bold;
            font-size: 16px;
          }

          .tray-controls {
            display: flex;
            gap: 8px;
          }

          .control-button {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 4px;
          }

          .control-button:hover {
            background-color: rgba(255, 255, 255, 0.1);
          }

          .tray-content {
            display: flex;
            flex-direction: column;
            height: calc(100% - var(--header-height));
            overflow: hidden;
          }

          .packet-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }

          thead {
            position: sticky;
            top: 0;
            background-color: #2d3748;
            z-index: 10;
          }

          th, td {
            padding: 6px 8px;
            text-align: left;
          }

          tr:hover {
            background-color: rgba(255, 255, 255, 0.05);
          }

          .input-area {
            padding: 8px;
            background-color: #2d3748;
            border-top: 1px solid #4a5568;
          }

          textarea {
            width: 100%;
            height: 60px;
            background-color: #1a202c;
            border: 1px solid #4a5568;
            border-radius: 4px;
            color: white;
            font-family: monospace;
            padding: 6px;
            resize: none;
            margin-bottom: 8px;
          }

          .controls-row {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
          }

          select, input {
            background-color: #1a202c;
            border: 1px solid #4a5568;
            border-radius: 4px;
            color: white;
            padding: 4px 8px;
            font-size: 12px;
          }

          button {
            background-color: #2d3748;
            border: 1px solid #4a5568;
            border-radius: 4px;
            color: white;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          button:hover {
            background-color: #4a5568;
          }

          button.green {
            background-color: rgba(72, 187, 120, 0.2);
            color: rgb(72, 187, 120);
            border-color: rgba(72, 187, 120, 0.5);
          }

          button.green:hover {
            background-color: rgba(72, 187, 120, 0.3);
          }

          button.red {
            background-color: rgba(245, 101, 101, 0.2);
            color: rgb(245, 101, 101);
            border-color: rgba(245, 101, 101, 0.5);
          }

          button.red:hover {
            background-color: rgba(245, 101, 101, 0.3);
          }

          .status-feedback {
            height: 16px;
            font-size: 12px;
            color: rgb(72, 187, 120);
          }

          .toggle-button {
            position: absolute;
            top: 50%;
            left: -28px; /* Changed from right to left */
            background-color: #2d3748;
            border: 2px solid #4a5568;
            border-radius: 4px 0 0 4px; /* Changed from right to left border radius */
            width: 26px;
            height: 80px;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transform: translateY(-50%);
          }

          .toggle-button:hover {
            background-color: #4a5568;
          }

          /* Add additional styles for a collapsed icon button in top right */
          .icon-button {
            position: fixed;
            top: 10px;
            right: 10px;
            width: 40px;
            height: 40px;
            background: #673ab7;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 9999;
            transition: all 0.3s ease;
          }
          
          .icon-button:hover {
            transform: scale(1.1);
            background: #7e57c2;
          }
        </style>

        <!-- Add a fixed icon button for top right corner -->
        <div class="icon-button" id="toggle-icon">📦</div>

        <div class="toggle-button" id="toggle-tray">
          &lt;
        </div>

        <div class="tray-header">
          <div class="tray-title">Packet Spammer</div>
          <div class="tray-controls">
            <button class="control-button" id="minimize-button">_</button>
            <button class="control-button" id="close-button">✕</button>
          </div>
        </div>

        <div class="tray-content">
          <div class="packet-list">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Content</th>
                  <th>Delay</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="packet-table">
                <!-- Packets will be added here -->
              </tbody>
            </table>
          </div>

          <div class="input-area">
            <textarea id="input-text" placeholder="Enter packet content here..."></textarea>
            
            <div class="controls-row">
              <select id="input-type">
                <option value="connection">Client</option>
                <option value="aj">Animal Jam</option>
              </select>
              
              <input type="text" id="input-delay" placeholder="Delay" value="1">
              
              <button id="add-button">
                <span>+</span>
                <span>Add</span>
              </button>
              
              <button id="send-button" class="green">
                <span>↑</span>
                <span>Send</span>
              </button>
            </div>
            
            <div class="controls-row">
              <button id="save-button">
                <span>💾</span>
                <span>Save</span>
              </button>
              
              <button id="load-button">
                <span>📂</span>
                <span>Load</span>
              </button>
              
              <select id="run-type">
                <option value="loop">Loop</option>
                <option value="once">Once</option>
              </select>
              
              <button id="stop-button" class="red">
                <span>⏹</span>
                <span>Stop</span>
              </button>
              
              <button id="run-button" class="green">
                <span>▶</span>
                <span>Start</span>
              </button>
            </div>
            
            <div class="status-feedback" id="status-feedback"></div>
          </div>
        </div>
      `;

      // Get references to DOM elements
      this.toggleButton = this.shadowRoot.getElementById('toggle-tray');
      this.minimizeButton = this.shadowRoot.getElementById('minimize-button');
      this.closeButton = this.shadowRoot.getElementById('close-button');
      this.packetTable = this.shadowRoot.getElementById('packet-table');
      this.inputText = this.shadowRoot.getElementById('input-text');
      this.inputType = this.shadowRoot.getElementById('input-type');
      this.inputDelay = this.shadowRoot.getElementById('input-delay');
      this.addButton = this.shadowRoot.getElementById('add-button');
      this.sendButton = this.shadowRoot.getElementById('send-button');
      this.saveButton = this.shadowRoot.getElementById('save-button');
      this.loadButton = this.shadowRoot.getElementById('load-button');
      this.runType = this.shadowRoot.getElementById('run-type');
      this.stopButton = this.shadowRoot.getElementById('stop-button');
      this.runButton = this.shadowRoot.getElementById('run-button');
      this.statusFeedback = this.shadowRoot.getElementById('status-feedback');

      // Initialize drag functionality
      this.initDrag();

      // Add event listeners
      this.toggleButton.addEventListener('click', () => this.toggleVisibility());
      this.minimizeButton.addEventListener('click', () => this.toggleVisibility());
      this.closeButton.addEventListener('click', () => this.toggleVisibility());

      // At initialization, ensure the stop button is disabled
      this.stopButton.disabled = true;
      this.stopButton.style.opacity = "0.5";
      this.stopButton.style.cursor = "not-allowed";

      // Get reference to the new toggle icon button
      this.toggleIcon = this.shadowRoot.getElementById('toggle-icon');
      
      // Add event listener for the icon button
      this.toggleIcon.addEventListener('click', () => this.toggleVisibility());
    }

    connectedCallback() {
      // Add the toggle icon to the document body
      document.body.appendChild(this.toggleIcon);
      // Make it visible by default
      this.toggleIcon.style.display = 'flex';
      
      // Connect to the plugin window to sync state and functionality
      this.connectToSpammerPlugin();
    }

    disconnectedCallback() {
      // Clean up the toggle icon when component is removed
      if (this.toggleIcon && this.toggleIcon.parentNode) {
        this.toggleIcon.parentNode.removeChild(this.toggleIcon);
      }
    }

    toggleVisibility() {
      if (this.classList.contains('visible')) {
        this.classList.remove('visible');
        // Show the fixed icon when the tray is hidden
        this.toggleIcon.style.display = 'flex';
      } else {
        this.classList.add('visible');
        // Hide the fixed icon when the tray is visible
        this.toggleIcon.style.display = 'none';
      }
    }

    initDrag() {
      const header = this.shadowRoot.querySelector('.tray-header');
      let isDragging = false;
      let offsetX, offsetY;

      header.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - this.getBoundingClientRect().left;
        offsetY = e.clientY - this.getBoundingClientRect().top;
        
        const moveHandler = (e) => {
          if (isDragging) {
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            this.style.left = `${x}px`;
            this.style.top = `${y}px`;
          }
        };
        
        const upHandler = () => {
          isDragging = false;
          document.removeEventListener('mousemove', moveHandler);
          document.removeEventListener('mouseup', upHandler);
        };
        
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
      });
    }

    connectToSpammerPlugin() {
      // Initialize with default position if not set
      if (!this.style.left) {
        this.style.left = '20px';
        this.style.top = '100px';
      }

      // We'll set up the bridge to the main plugin's functionality here
      this.addButton.addEventListener('click', () => {
        // We'll relay this to the main plugin window
        if (window.jam && window.jam.plugins) {
          window.jam.plugins.relayToPlugin('spammer', 'addClick', {
            type: this.inputType.value,
            content: this.inputText.value,
            delay: this.inputDelay.value
          });
        }
      });

      this.sendButton.addEventListener('click', () => {
        if (window.jam && window.jam.plugins) {
          window.jam.plugins.relayToPlugin('spammer', 'sendClick', {
            type: this.inputType.value,
            content: this.inputText.value
          });
        }
      });

      this.saveButton.addEventListener('click', () => {
        if (window.jam && window.jam.plugins) {
          window.jam.plugins.relayToPlugin('spammer', 'saveToFile');
        }
      });

      this.loadButton.addEventListener('click', () => {
        if (window.jam && window.jam.plugins) {
          window.jam.plugins.relayToPlugin('spammer', 'loadFromFile');
        }
      });

      this.runButton.addEventListener('click', () => {
        if (window.jam && window.jam.plugins) {
          window.jam.plugins.relayToPlugin('spammer', 'runClick', {
            runType: this.runType.value
          });
          
          // Update UI state
          this.runButton.disabled = true;
          this.runButton.style.opacity = "0.5";
          this.runButton.style.cursor = "not-allowed";
          
          this.stopButton.disabled = false;
          this.stopButton.style.opacity = "1";
          this.stopButton.style.cursor = "pointer";
          
          this.statusFeedback.textContent = "Spammer is running in background mode";
        }
      });

      this.stopButton.addEventListener('click', () => {
        if (window.jam && window.jam.plugins) {
          window.jam.plugins.relayToPlugin('spammer', 'stopClick');
          
          // Update UI state
          this.stopButton.disabled = true;
          this.stopButton.style.opacity = "0.5";
          this.stopButton.style.cursor = "not-allowed";
          
          this.runButton.disabled = false;
          this.runButton.style.opacity = "1";
          this.runButton.style.cursor = "pointer";
          
          this.statusFeedback.textContent = "Spammer stopped";
          
          // Clear the message after 3 seconds
          setTimeout(() => {
            this.statusFeedback.textContent = "";
          }, 3000);
        }
      });

      // Set up listener for plugin data updates from the main plugin window
      if (window.jam && window.jam.plugins) {
        window.jam.plugins.registerInGameListener('spammer', (action, data) => {
          if (action === 'updatePackets') {
            this.updatePacketTable(data.packets);
          } else if (action === 'updateStatus') {
            this.statusFeedback.textContent = data.status;
          }
        });
      }
    }

    updatePacketTable(packets) {
      // Clear existing rows
      this.packetTable.innerHTML = '';
      
      // Add new rows from packets
      packets.forEach((packet, index) => {
        const row = document.createElement('tr');
        
        // Type cell
        const typeCell = document.createElement('td');
        typeCell.textContent = packet.type;
        row.appendChild(typeCell);
        
        // Content cell
        const contentCell = document.createElement('td');
        contentCell.textContent = packet.content;
        contentCell.title = packet.content; // Add tooltip for full content
        contentCell.style.maxWidth = '150px';
        contentCell.style.overflow = 'hidden';
        contentCell.style.textOverflow = 'ellipsis';
        contentCell.style.whiteSpace = 'nowrap';
        row.appendChild(contentCell);
        
        // Delay cell
        const delayCell = document.createElement('td');
        delayCell.textContent = packet.delay;
        row.appendChild(delayCell);
        
        // Action cell
        const actionCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '✕';
        deleteButton.style.padding = '2px 6px';
        deleteButton.addEventListener('click', () => {
          if (window.jam && window.jam.plugins) {
            window.jam.plugins.relayToPlugin('spammer', 'deleteRow', { index });
          }
        });
        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);
        
        this.packetTable.appendChild(row);
      });
    }
  });
})(); 