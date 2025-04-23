# Project Framework Documentation

## 1. Overview

Strawberry Jam is an Electron-based desktop application for exploring and extending Animal Jam Classic. It's a personal fork of the original "Jam" project created by Sxip, with added features, plugins, and improvements. The application provides network analysis capabilities, allowing users to watch messages between the game and AJ's servers, and includes a plugin system for extending functionality.

## 2. High-Level Structure

```
strawberry jam
  assets/                      # Application assets including CSS, images, and extracted ASAR files
  build/                       # Build output folders for different platforms
  community-guide/             # Documentation guides
  data/                        # Data directory for the application
  dev/                         # Development-specific files
  memory-bank/                 # Storage for memory-related data
  plugin_packages/             # External packages for plugin functionality
  plugins/                     # Plugin directory containing various plugins
  src/                         # Source code directory
    api/                       # API controllers and routes
    electron/                  # Electron-specific code
      renderer/                # Renderer process code
    networking/                # Networking code for client-server communication
    patches/                   # Patches for the application
    services/                  # Service modules
    styles/                    # CSS styles
    utils/                     # Utility functions
    index.js                   # Main entry point
  .clinerules                  # CLI rules configuration
  .eslintignore                # ESLint ignore configuration
  .eslintrc                    # ESLint rules configuration
  .gitignore                   # Git ignore file
  clean-public-build.js        # Script for cleaning public build
  dev-app-update.yml           # Development app update configuration
  electron-builder.json        # Electron builder configuration
  modularization.md            # Documentation about modularization
  nodemon.json                 # Nodemon configuration
  pack-and-run.js              # Script to pack and run the application
  package-lock.json            # NPM package lock file
  package.json                 # NPM package configuration
  README.md                    # Project README
  settings.json                # Application settings
  tag-plugin.js                # Plugin tagging script
  tailwind.config.js           # Tailwind CSS configuration
  TFD.txt                      # Text file with unknown purpose
  verify-build.js              # Script to verify builds
```

## 3. Key Entry Points & Configuration

* **Entry Points:**
  * `src/index.js` - Main application entry point that initializes the Electron app
  * `src/electron/index.js` - Core Electron implementation
  * `src/electron/renderer/index.html` - Main renderer HTML file

* **Configuration:**
  * `package.json` - NPM package configuration with scripts, dependencies, and metadata
  * `electron-builder.json` - Configuration for building the Electron application
  * `nodemon.json` - Development server configuration
  * `settings.json` - Application settings
  * `tailwind.config.js` - Tailwind CSS configuration

## 4. Detailed File/Module Breakdown

### 4.1 Assets Directory

The `assets/` directory contains all the resources used by the application, including UI assets, packaged code, and game files:

```
assets/
├── css/                          # CSS stylesheets
│   └── style.css                 # Main application stylesheet (generated from Tailwind)
│
├── extracted-winapp-dev/         # Extracted development version of the Windows app
│   ├── gui/                      # GUI-related files
│   │   ├── components/           # UI components
│   │   ├── fonts/                # Font files
│   │   ├── images/               # UI images
│   │   ├── gamePreload.js        # Game preload script
│   │   ├── index.html            # Main HTML file
│   │   ├── preload.js            # Electron preload script
│   │   ├── print.html            # Print layout HTML
│   │   ├── printPreload.js       # Print preload script
│   │   └── sharedFonts.swf       # Shared fonts in SWF format
│   ├── config.js                 # Configuration file
│   ├── index.js                  # Main entry point for the extracted app
│   ├── package.json              # Package configuration
│   ├── server.js                 # Server-side code
│   ├── spock.txt                 # Unknown text file
│   └── translation.js            # Translation/localization script
│
├── extracted-winapp-public/      # Extracted public version of the Windows app
│   └── [Similar structure to extracted-winapp-dev]
│
├── flash/                        # Flash-related files
│   ├── ajclient.swf              # Animal Jam client Flash file
│   └── ajclient - Copy.swf       # Backup copy of the Flash client
│
├── icons/                        # Application icons
│   ├── action.png                # Action icon
│   ├── celebrate.png             # Celebration icon
│   ├── error.png                 # Error icon
│   ├── logger.png                # Logger icon
│   ├── notify.png                # Notification icon
│   ├── speech.png                # Speech icon
│   ├── success.png               # Success icon
│   ├── wait.png                  # Wait/loading icon
│   └── warn.png                  # Warning icon
│
├── javascript/                   # JavaScript libraries
│   ├── jquery-ui.js              # jQuery UI library
│   └── popper.min.js             # Popper.js library for tooltips
│
├── memory-bank/                  # Memory storage assets
│
├── osxapp.asar/                  # Packaged OSX application assets
│   └── gui/                      # GUI resources for OSX
│
├── winapp.asar/                  # Packaged Windows application assets
│   └── gui/                      # GUI resources for Windows
│
├── winapp.asar.backup            # Backup of the packed Windows assets
│
└── Various image files (.png)    # Application branding images and icons
    ├── banana.png
    ├── blueberries.png
    ├── cantaloupe.png
    ├── coconut.png
    ├── icon.ico                  # Windows application icon
    ├── icon.png                  # General application icon
    ├── jam.png                   # Original Jam logo
    ├── pineapple.png
    ├── strawberry-jam.png        # Strawberry Jam logo
    └── strawberry.png
```

The assets directory structure shows a clear separation between development and production resources, with platform-specific assets packed into `.asar` files (Electron's archive format). The Flash files (`ajclient.swf`) suggest the application interacts with the Flash-based Animal Jam Classic game.

### 4.2 Plugins Directory

The `plugins/` directory contains various plugins that extend the functionality of Strawberry Jam:

```
plugins/
├── adventure/              # Adventure-related functionality plugin
├── advertising/            # Advertising management plugin
├── chat/                   # Chat-related functionality plugin
├── colors/                 # Color customization plugin
├── glow/                   # Glow effect plugin
├── humongous/              # Unknown functionality plugin
├── invisibleToggle/        # Toggle invisibility plugin
├── login/                  # Login-related functionality plugin
├── loginPacketManipulator/ # Login packet manipulation plugin
├── membership/             # Membership-related plugin
├── spammer/                # Message spamming functionality plugin
└── UsernameLogger/         # Username logging plugin with detailed structure:
    ├── constants/          # Constant values and enumerations
    ├── handlers/           # Event handlers
    ├── models/             # Data models
    ├── services/           # Service implementations
    ├── utils/              # Utility functions
    ├── config.json         # Plugin configuration
    ├── index.js            # Plugin entry point
    ├── plugin.json         # Plugin metadata
    └── readme.md           # Plugin documentation
```

The plugins directory provides a modular way to extend the application's functionality. Each plugin typically includes an entry point, configuration files, and may contain a structured directory layout for complex plugins like `UsernameLogger`.

### 4.3 Plugin Packages Directory

The `plugin_packages/` directory contains external dependencies that can be used by plugins:

```
plugin_packages/
└── axios/                  # Axios HTTP client library available for plugins
    ├── dist/               # Distribution files
    ├── lib/                # Source library files
    ├── CHANGELOG.md        # Version change history
    ├── index.d.cts         # TypeScript declaration file (CommonJS)
    ├── index.d.ts          # TypeScript declaration file
    ├── index.js            # Main entry point
    ├── LICENSE             # License information
    ├── MIGRATION_GUIDE.md  # Migration guide
    ├── package.json        # Package configuration
    └── README.md           # Package documentation
```

This directory appears to contain shared dependencies that can be used by multiple plugins, reducing duplication and ensuring consistent versions across the plugin ecosystem.

### 4.4 Source (src) Directory

The `src/` directory is the core of the application, containing the main code structure:

```
src/
├── api/                    # API-related code
│   ├── controllers/        # API controllers
│   ├── routes/             # API route definitions
│   └── index.js            # API entry point
│
├── electron/               # Electron-specific code
│   ├── renderer/           # Renderer process code
│   ├── clear-cache-helper.js # Helper for clearing cache
│   ├── index.js            # Main Electron implementation
│   ├── leakChecker.js      # Memory leak checking functionality
│   └── preload.js          # Preload script for Electron
│
├── networking/             # Networking code
│   ├── client/             # Client-side networking
│   ├── messages/           # Message definitions/handlers
│   ├── server/             # Server-side networking
│   └── transform/          # Data transformation utilities
│
├── patches/                # Code patches
│
├── services/               # Service implementations
│
├── styles/                 # CSS styles
│
├── utils/                  # Utility functions
│   ├── room-tracking/      # Room tracking utilities
│   ├── manage-plugin-tags.js # Plugin tag management
│   ├── plugin-tag-utils.js  # Utilities for plugin tags
│   └── README-plugin-tags.md # Documentation for plugin tags
│
├── Constants.js            # Application constants
├── dev-app-update.yml      # Development app update configuration
└── index.js                # Main application entry point
```

The `src` directory follows a modular structure, separating concerns into distinct subdirectories. The main entry point (`index.js`) initializes the Electron application, while various subdirectories handle specific aspects of functionality:

- `api/`: Backend API functionality
- `electron/`: Electron-specific configuration and behavior
- `networking/`: Communication between client and server
- `utils/`: Helper functions and utilities, including plugin management

The `Constants.js` file defines global constants used throughout the application, including connection message types, data path resolution, and plugin type definitions.

### 4.5 Inter-Process Communication (IPC) Architecture

The application uses Electron's IPC system to facilitate communication between different processes. Understanding this architecture is crucial for maintaining and extending the application.

#### 4.5.1 IPC Channel Registration Pattern

One of the most important architectural patterns in the application is the strict registration of IPC channels. This is implemented through whitelists in preload scripts:

```javascript
// In preload.js files
const sendWhitelist = new Set()
  .add("channelName1")
  .add("channelName2")
  // ...

const receiveWhitelist = new Set()
  .add("channelName3")
  .add("channelName4")
  // ...
```

**Critical Connection**: When adding a new IPC channel for communication, it must be registered in the appropriate preload script. For example:

1. If adding functionality to `LoginScreen.js` that needs to communicate with the main process, the channel must be added to the `sendWhitelist` in `preload.js`.
2. If the main process needs to send messages to the renderer, the channel must be added to the `receiveWhitelist`.

#### 4.5.2 Main IPC Flow Paths

The application has several key IPC communication pathways:

1. **Main Application ↔ Renderer Process**
   - `src/electron/index.js` sets up IPC handlers in the `_setupIPC()` method
   - `src/electron/renderer/application/index.js` contains the client-side listeners

2. **AJ Classic Client ↔ Main Process**
   - `assets/extracted-winapp-public/index.js` defines IPC handlers for the game
   - `assets/extracted-winapp-public/gui/preload.js` exposes safe IPC methods to the renderer
   - `assets/extracted-winapp-public/gui/components/LoginScreen.js` and other component files use these methods

3. **Plugin System IPC Bridge**
   - Plugin windows communicate with the main window through a special IPC bridge
   - Messages are proxied through the main process using channels like `send-remote-message` and `plugin-remote-message`

#### 4.5.3 Example: Login Flow IPC Connections

The login flow demonstrates how multiple files are connected through IPC:

1. User enters credentials in `LoginScreen.js`
2. Component uses `window.ipc.invoke('get-setting', 'rememberMe')` to retrieve settings
3. This is only possible because `get-setting` is in the `sendWhitelist` in `preload.js`
4. On login success, component calls `window.ipc.send('loginSucceeded', credentials)`
5. Main process receives this in an event handler set up in `index.js`
6. Main process may send data back through a channel in the `receiveWhitelist`

#### 4.5.4 Context Bridge Security

The application uses Electron's contextBridge to safely expose IPC functionality to renderer processes:

```javascript
// In preload.js
contextBridge.exposeInMainWorld(
  "ipc", {
    send: (channel, ...args) => {
      if (sendWhitelist.has(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },
    on: (channel, listener) => {
      if (receiveWhitelist.has(channel)) {
        ipcRenderer.on(channel, listener);
      }
    },
    // More methods...
  }
);
```

This pattern ensures that renderer processes (which may load remote content from the game) can only access explicitly allowed IPC channels.

**Key Insight**: When modifying the application to add new features that require IPC communication, developers must update the appropriate whitelists in the preload scripts in addition to implementing the actual functionality.

[Additional sections will be populated in subsequent steps] 