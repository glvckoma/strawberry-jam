# Decision Log

This file records architectural and implementation decisions using a list format.
2025-05-06 19:38:37 - Log of updates made.

*

## Decision

*

## Rationale 

*

## Implementation Details

*
---
[2025-05-06 20:43:22] - **Observation: Application Entry Point**

## Decision
*   The file `src/index.js` serves as the initial JavaScript entry point for the application.

## Rationale
*   Its content solely imports and initializes the Electron setup from `src/electron/index.js`.

## Implementation Details
*   `src/index.js` instantiates `Electron` class from `./electron` and calls its `create()` method. This delegates all Electron-specific application setup (main process, window creation, etc.) to `src/electron/index.js`.
---
[2025-05-06 20:49:25] - **Decision: Centralized Main Process Logic**

## Decision
*   The `src/electron/index.js` file centralizes the Electron main process logic within an `Electron` class.

## Rationale
*   Encapsulates core application lifecycle management, window creation, IPC handling, settings, state, and interactions with other modules (API, auto-updater, leak checker) in a single, albeit large, module.

## Implementation Details
*   The `Electron` class constructor initializes IPC handlers, store (`electron-store`), and various state flags.
*   The `create()` method sets up app event listeners (`whenReady`, `window-all-closed`, `will-quit`).
*   The `_onReady()` method, called when the app is ready, creates the main `BrowserWindow`, forks the API process, and initializes the auto-updater.
*   Numerous private methods (`_setupIPC`, `_createWindow`, `_initAutoUpdater`, `_handleOpenPluginWindow`, `getAppState`, `setAppState`, `_initiateOrResumeLeakCheck`, etc.) handle specific functionalities.

---
[2025-05-06 20:49:25] - **Decision: State and Settings Management**

## Decision
*   Application settings are managed using `electron-store` with a predefined schema.
*   Runtime application state (e.g., LeakCheck progress, Account Tester state) is persisted in a separate JSON file (`jam_state.json`).

## Rationale
*   `electron-store` provides a simple way to persist user-configurable settings.
*   A separate state file allows for more complex, structured runtime data to be saved and loaded across sessions, distinct from user settings.

## Implementation Details
*   `electron-store` is instantiated with a schema in the `Electron` class constructor. IPC handlers (`get-setting`, `set-setting`) allow renderer processes to interact with the store.
*   `getAppState()` and `setAppState()` helper methods in `src/electron/index.js` handle reading and writing `jam_state.json`, including merging with default state structures.

---
[2025-05-06 20:49:25] - **Decision: Plugin Window Architecture**

## Decision
*   UI-based plugins are loaded into separate `BrowserWindow` instances.
*   A `window.jam` object with `dispatch` and `application` properties is injected into plugin windows for communication with the main application.

## Rationale
*   Isolates plugin UIs from the main application UI, potentially improving stability and allowing for independent plugin window management.
*   Provides a controlled interface (`window.jam`) for plugins to interact with core application functionalities (sending messages, getting state, logging).

## Implementation Details
*   The `_handleOpenPluginWindow` method in `src/electron/index.js` creates new `BrowserWindow` instances for plugins.
*   It loads the plugin's HTML URL and, on `did-finish-load`, executes JavaScript to define `window.jam.dispatch` (with methods like `sendRemoteMessage`, `getState`) and `window.jam.application` (with `consoleMessage`).
*   jQuery is also injected into plugin windows from a CDN.
*   IPC is used extensively: `open-plugin-window` (main to create), `plugin-window-opened`/`closed` (main to renderer), and various messages relayed via `dispatch` (plugin to main, then potentially to main renderer).

---
[2025-05-06 20:49:25] - **Decision: Forked API Process**

## Decision
*   API functionalities are handled in a separate Node.js process, forked from the main Electron process.

## Rationale
*   Isolates potentially resource-intensive or blocking API operations from the main UI thread, improving application responsiveness.
*   Allows the API server to run independently.

## Implementation Details
*   `child_process.fork()` is used in `src/electron/index.js` (`_onReady` method) to spawn `src/api/index.js`.
*   The API process is killed during the `will-quit` application lifecycle event.

---
[2025-05-06 20:49:25] - **Observation: WebPreferences for Windows**

## Decision
*   Main and plugin windows are created with specific `webPreferences`: `webSecurity: false`, `nativeWindowOpen: true`, `contextIsolation: false`, `enableRemoteModule: true`, `nodeIntegration: true`.

## Rationale
*   These settings provide extensive capabilities to the renderer processes, likely to support the plugin system's need to interact with Node.js modules, the file system, and potentially less restrictive cross-origin requests.
*   `contextIsolation: false` and `nodeIntegration: true` are common for older Electron patterns or when direct Node.js access is needed in renderer code (e.g., for plugins).

## Implementation Details
*   `defaultWindowOptions` in `src/electron/index.js` defines these preferences, which are then used for both the main window and overridden/extended for plugin windows.
*   A `preload.js` script is specified, which is typical for bridging main and renderer contexts, though with `contextIsolation: false`, its role might be different or supplementary.