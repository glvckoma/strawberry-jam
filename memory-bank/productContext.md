# Product Context

This file provides a high-level overview of the project and the expected product that will be created. Initially it is based upon projectBrief.md (if provided) and all other available project-related information in the working directory. This file is intended to be updated as the project evolves, and should be used to inform all other modes of the project's goals and context.
2025-05-06 19:36:42 - Log of updates made will be appended as footnotes to the end of this file.

*

## Project Goal

*   Strawberry Jam is a fork of the original "Jam" project by Sxip, designed as an enhanced and feature-rich tool for exploring and extending the game "Animal Jam Classic". It aims to introduce new tools, improve safety, performance, and user experience, while maintaining a flexible plugin architecture. The project is maintained by "glvckoma".

## Key Features

*   **Login Packet Manipulator:** Allows modification of login behavior.
*   **Account Tester:** Semi-automatic tool for checking multiple accounts.
*   **Improved Username Logger:** More robust username collection and checking, with batch writing and statefulness.
*   **LeakCheck API Integration:** Automatic checking of usernames against a breach database (requires user API key).
*   **Auto-Clearing Logs:** Console and network logs are automatically cleared to prevent UI lag.
*   **Enhanced Plugin System:** Supports two main types:
    *   Command/Background Plugins (`index.js`): For backend logic, command handling, and packet listening.
    *   UI Plugins (`index.html` with `"type": "ui"` in `plugin.json`): For creating custom windows and interfaces using web technologies.
    *   Features robust loading (including dependency installation via `live-plugin-manager`), error handling, and clear structure (`plugin.json` for metadata, main entry file). Plugin lifecycle, command registration, and message/packet hooking are managed by a central `Dispatch` class in the renderer process.
    *   **Standardized UI Components for UI Plugins:** Provides a template (`plugins/template/`), shared CSS (`assets/css/style.css`), and JavaScript (`assets/javascript/plugin-utils.js`) to ensure consistent headers, window controls (minimize/close), and styling for HTML-based plugins.
*   **Refactored Settings:** Settings are managed via `electron-store` in the main process with a defined schema (covering network, LeakCheck, UI preferences like `promptOnExit` and `hideGamePlugins`). The renderer process has a dedicated `Settings` class (`src/electron/renderer/application/settings/index.js`) that loads and saves these settings via IPC, provides default values, and uses `lodash` for nested key access. Settings are presented to the user in a tabbed modal.
*   **State Management:** Application state (for LeakCheck, Account Tester) is persisted in `jam_state.json` within the user data path, with a defined default structure.
*   **IPC System:** Extensive Inter-Process Communication (IPC) setup for handling events between main and renderer processes, including window management (close, minimize), opening URLs/directories, settings management, file operations (Account Tester saves, LeakCheck directory selection), application restart, LeakCheck control (start, pause, stop, status), app state persistence, and plugin window interactions.
*   **Auto-Updater:** Integrated `electron-updater` for automatic update checks and downloads in production builds.
*   **Leak Checker Module:** Includes a `leakChecker.js` module for checking usernames, with IPC controls and state persistence.
*   **Cache Management:** Features for clearing Electron session cache and specific application cache directories, including a helper script (`clear-cache-helper.js`) for external cache deletion.
*   **Uninstall Process:** Logic to locate and trigger the uninstaller (primarily for Windows).
*   **Custom Protocol Handling:** Implements an `app://` protocol for serving local resources.
*   **API Process (Game Asset Proxy & Local SWF Server):** Forks a separate Node.js process (`src/api/index.js`) which runs an Express.js server on port 8080. This server, primarily through `src/api/controllers/FilesController.js`:
    *   Serves a local copy of `ajclient.swf` from `assets/flash/` for specific versioned requests (e.g., `/<version>/ajclient.swf`).
    *   Acts as a proxy for other game asset requests, fetching them from the official Animal Jam CDN (`https://ajcontent.akamaized.net`) using the static methods of the `HttpClient` class ([`src/services/HttpClient.js`](src/services/HttpClient.js:1)) which provides default headers to mimic the official client.
    *   Uses `body-parser` for request parsing and routes are defined in `src/api/routes/index.js`.
*   **Build and Development System (from `package.json`):**
    *   Uses `electron-builder` (configured via `electron-builder.json`) for creating distributable packages:
        *   Windows: NSIS installer (`.exe`) for x64.
        *   MacOS: DMG and ZIP archives for x64 and arm64 (Mac builds can be done via Docker).
    *   Specifies product name, Electron version, output directory (`build`), and platform-specific icons.
    *   Packages application code into an ASAR archive.
    *   Detailed `files`, `extraFiles`, and `extraResources` configurations define precisely what is included/excluded in the final package, ensuring production readiness and inclusion of necessary assets like plugins and the `clear-cache-helper.js`.
    *   Configured for publishing releases to GitHub.
    *   Employs `nodemon` for development server with auto-reloading (`NODE_ENV=development`).
    *   Includes scripts for ASAR packaging (`asar`), versioning (`npm version`), linting (`eslint`), and publishing to GitHub releases.
    *   Manages plugin tags via a custom CLI script ([`src/utils/manage-plugin-tags.js`](src/utils/manage-plugin-tags.js:1)), which allows adding, removing, and listing tags for plugins by modifying their `plugin.json` files. This script uses helper functions from [`src/utils/plugin-tag-utils.js`](src/utils/plugin-tag-utils.js:1).
    *   Includes a `clean-public-build.js` script to prepare a public release. This script operates on the unpacked original Animal Jam Classic client's renderer-side code (found in `assets/extracted-winapp-dev/gui/` for Windows, and a similar structure would exist for the macOS version derived from `assets/osxapp.asar`). It removes development/sensitive UI components and modifies specific UI files to disable original client development features. This cleaned/modified original client UI code is then packaged into Strawberry Jam's custom `app.asar`.
        *   **Original Client Account Tester Removal:** The original client included a sophisticated Account Tester feature implemented across several modules within `assets/extracted-winapp-dev/gui/components/`:
            *   [`tester-bridge.js`](assets/extracted-winapp-dev/gui/components/tester-bridge.js:1): Provided placeholder functions for early loading, later replaced by actual implementations from other tester modules.
            *   [`tester-ipc.js`](assets/extracted-winapp-dev/gui/components/tester-ipc.js:1): Handled renderer-side IPC communication for the tester (loading accounts, getting settings, receiving status updates from the main process).
            *   [`tester-logic.js`](assets/extracted-winapp-dev/gui/components/tester-logic.js:1): Contained the core account testing loop, authentication attempts (using `globals.authenticateWithPassword`), error handling, rate limit management, and UUID spoofing logic for tests.
            *   [`tester-state.js`](assets/extracted-winapp-dev/gui/components/tester-state.js:1): Defined a shared in-memory object (`testerState`) for managing the tester's data (account list, current index, settings, status flags).
            *   [`tester-ui.js`](assets/extracted-winapp-dev/gui/components/tester-ui.js:1): Managed the rendering of the tester UI within `LoginScreen.js`, handled user interactions (button clicks, input changes), and updated the display based on `testerState`.
            *   The `clean-public-build.js` script specifically removes most of these `tester-*.js` files and modifies `LoginScreen.js` and `gui/index.html` to remove calls to tester initialization functions and script includes, effectively disabling this built-in feature in the assets bundled with Strawberry Jam. Strawberry Jam's main process ([`src/electron/index.js`](src/electron/index.js:1)) still handles many of the "tester-" IPC channels, suggesting it supports its own Account Tester plugin or feature that reuses these main-side endpoints.
*   **Distribution-Ready Build System:** Supports Windows/Mac and excludes sensitive files (managed by `electron-builder` and custom scripts).
*   **Sandboxed & Patched Game Client (`Patcher` class):**
    *   Instead of modifying the user's original Animal Jam Classic installation, Strawberry Jam creates a separate copy (e.g., "Strawberry Jam Classic" in user's local programs or Applications folder) on first launch if it doesn't exist.
    *   The `Patcher` class (`src/electron/renderer/application/patcher/index.js`) manages this process.
    *   It then replaces the `app.asar` file within this copied installation's resources directory with Strawberry Jam's custom ASAR (which is [`assets/winapp.asar`](assets/winapp.asar:1) for Windows or `assets/osxapp.asar` for macOS, located in the Strawberry Jam project root). This custom `app.asar` is a hybrid: it contains Strawberry Jam's own Electron main process code ([`src/electron/index.js`](src/electron/index.js:1)) and its main window preload script ([`src/electron/preload.js`](src/electron/preload.js:1)), which take precedence and define Strawberry Jam's core behavior and IPC channels. It also includes the modified renderer-side UI assets derived from the original Animal Jam Classic client (e.g., the cleaned `gui/components/LoginScreen.js` and `gui/index.html`), allowing Strawberry Jam to present a familiar game interface while controlling the backend logic and extending functionality.
    *   When launching the game, it runs the executable from this sandboxed, patched "Strawberry Jam Classic" installation.
    *   The `STRAWBERRY_JAM_DATA_PATH` is passed as an environment variable to the launched game process, allowing the patched client to access Strawberry Jam's specific data.
    *   The cache for this separate installation is also cleared before launch.
*   **UI/UX Improvements:** Draggable plugin windows, better modal design. Main interface (`src/electron/renderer/index.js` and `./application`) includes:
    *   Dynamic connection status indicator.
    *   Session timer display.
    *   Application version display.
    *   Management of empty plugin list message.
    *   **Modal System:** A dedicated `ModalSystem` class (`src/electron/renderer/application/modals/index.js`) dynamically loads, registers, and manages the display of various modal dialogs. Modals are defined in separate modules and rendered into a target container. Examples include:
        *   `confirmExitModal.js`: Provides a confirmation dialog before exiting the application, with an option to "Don't ask me again".
        *   `linksModal.js`: Displays a "Quick Links" modal with icons linking to external resources like Discord, GitHub, jam.exposed, and AJC Price Checker.
        *   `plugins.js` (Plugin Library Modal): Provides an interface to browse, install, and uninstall plugins. It fetches plugin lists and metadata from GitHub repositories (both Strawberry Jam's and the original Jam's), implements caching, and handles local plugin file operations.
        *   `settings.js`: Renders a tabbed modal for application settings, including "Connection" (Server IP, SSL), "Plugins" (Hide game plugins), "LeakCheck" (API Key, Open Output Dir), and "Advanced" (Clear Cache, Uninstall). It loads and saves settings via IPC and the main process's `electron-store`.
    *   **Console Tab:** Displays messages from the application and plugins, including errors and debug information. Includes a built-in `clear` command to empty console logs.
    *   **Network Tab:** Shows client-server communication (XML and XT packets), indicating sent and received messages.
    *   **Plugins Tab:** Lists installed plugins, their load status, and provides an interface for plugin-specific controls.
*   **Memory Bank Documentation:** Project context, progress, and patterns tracked in markdown files within `memory-bank/`.
*   **User Setup and Disclaimers (from README.md):**
    *   Provides quick start guides for Windows (.exe installer) and MacOS (.zip, requiring manual `xattr` and potential `sudo` execution due to Gatekeeper). MacOS compatibility is noted as potentially having issues.
    *   Includes an important warning about the risk of account termination from using such tools, advising responsible use.
    *   Offers links to community guides and contact points (GitHub Issues, Discord) for ideas and support.
    *   Basic instructions for developers to run from source are provided.

## Overall Architecture

*   The project is an Electron-based desktop application with `src/electron/index.js` serving as the main process entry point. This file orchestrates:
    *   **Window Management:** Creation and management of the main application window and separate plugin windows, with default options and specific webPreferences (e.g., `nodeIntegration: true`, `contextIsolation: false`).
    *   **IPC Handling:** A comprehensive set of IPC listeners (`ipcMain.on`, `ipcMain.handle`) manage communication between the main process and renderer processes (main window, plugin UIs) for a wide range of functionalities.
    *   **Application Lifecycle:** Manages app events like `ready`, `window-all-closed`, and `will-quit` (which includes cleanup logic for the API process, LeakCheck, and cache).
    *   **Settings Persistence:** Uses `electron-store` to manage user-configurable settings with a predefined schema.
    *   **Application State Persistence:** Saves and loads application-specific state (e.g., for LeakCheck, Account Tester) to a `jam_state.json` file.
    *   **Auto-Updates:** Integrates `electron-updater` for handling application updates in packaged builds.
    *   **Child Processes:** Forks an API process (`src/api/index.js`) and can spawn helper scripts (e.g., `clear-cache-helper.js`, which is explicitly included in resources via `electron-builder.json`).
    *   **Security & Permissions:** Defines a custom `app://` protocol and handles external URL opening. WebPreferences for windows are set with `webSecurity: false` and `enableRemoteModule: true`, indicating a need for broad capabilities for plugins.
    *   **Plugin Window Support:** Dynamically creates and manages plugin UI windows, injecting a `window.jam` object with `dispatch` (for sending messages, getting state) and `application` (for console messages) capabilities.
    *   **Original Client's Auto-Login Server Integration:** Strawberry Jam's main process utilizes the `listenForAutoLogin()` and `stop()` functions from the original Animal Jam Classic client's [`assets/extracted-winapp-dev/server.js`](assets/extracted-winapp-dev/server.js:1). This local HTTP server (listening on `127.0.0.1`, typically port 8088 as per original client's `config.js`) is used to receive an `authToken` and `affiliateCode` via a POST request to `/autologin`, likely to facilitate launching and logging into the game from an external source like a website. Strawberry Jam then uses this token for its own login flow.
*   It features a modular plugin system, with plugins located in the `plugins/` directory. Each plugin resides in its own subdirectory and requires:
    *   A `plugin.json` file defining metadata. A comprehensive example (`plugins/UsernameLogger/plugin.json`) includes:
        *   `name`: Plugin display name.
        *   `version`: Plugin version (e.g., "3.0.0").
        *   `description`: Detailed explanation of the plugin's purpose.
        *   `author`: Creator of the plugin.
        *   `main`: Entry point script (e.g., "index.js" for background logic).
        *   `type`: Specifies plugin type (e.g., "game" for background/command-based, or "ui" for HTML-based interfaces).
        *   `dependencies`: An object listing Node.js dependencies and their versions (e.g., `{ "axios": "^1.3.4" }`).
        *   `tags`: An array of descriptive tags (e.g., `["beta"]`).
        *   `commands`: An array of objects, each defining a command with `name` and `description`, for plugins that register chat commands.
        *   Minimal versions (like `plugins/adventure/plugin.json`) might only include `name`, `description`, and `game`.
    *   A main entry file, either `index.js` for command/background logic (using `module.exports = class ...` and interacting with `dispatch` and `application` objects) or `index.html` for UI plugins. UI plugins are encouraged to use standardized components for headers and controls (as per `plugins/README.md`).
    *   Complex background plugins (e.g., `UsernameLogger`) demonstrate a highly modular internal structure, instantiating separate classes for models (config, state), services (file, API, leak checking, migration), handlers (message, command), and utilities. These components are initialized with necessary dependencies (application object, other services/models) in the plugin's constructor. Such plugins also implement an `unload()` method for cleanup.
*   The main application source code resides in the `src/` directory, with `src/index.js` as the entry point. It's further organized into subdirectories for API handling (`src/api/`, confirmed to be an Express.js server listening on port 8080), Electron-specific logic (`src/electron/` for main and renderer processes), networking (`src/networking/`), services (`src/services/`), and utilities (`src/utils/`).
*   The original Animal Jam Classic client's renderer UI is primarily defined in [`assets/extracted-winapp-dev/gui/index.html`](assets/extracted-winapp-dev/gui/index.html:1). This file:
    *   Loads custom web components like `<ajd-login-screen>` and `<ajd-game-screen>`.
    *   Defines a global `globals` object with utility functions for translation, HTTP requests (via `fetch` wrapper), error reporting, authentication flow, and FlashVar manipulation.
    *   Handles IPC communication with the original client's main process via `window.ipc` (exposed by [`assets/extracted-winapp-dev/gui/preload.js`](assets/extracted-winapp-dev/gui/preload.js:1)) for tasks like login, settings, and receiving system data.
    *   Manages the transition between the login screen and the game screen.
    *   Strawberry Jam reuses this HTML structure (after modifications by `clean-public-build.js`) but its `src/electron/preload.js` and `src/electron/index.js` control the actual IPC and backend logic.
*   The `src/electron/renderer/index.js` script serves as the entry point for the main application window's renderer process. It primarily initializes and runs an `Application` class (defined in `src/electron/renderer/application/index.js`). This `Application` class is central to the renderer's functionality, managing:
    *   Interaction with the `Patcher` module to launch a sandboxed and patched version of the Animal Jam Classic client.
    *   Instantiation of core renderer modules: `Server` (networking), `Settings`, `Patcher`, `Dispatch` (central manager for plugin loading, command registration, message/packet hooking, and renderer-side state), `HttpClient`, `ModalSystem`, and `core-commands`.
    *   UI interactions: Command input handling (with jQuery UI Autocomplete), plugin list rendering, dynamic UI updates (connection status, session timer, app version), and a sophisticated `consoleMessage` system for logging.
    *   IPC communication with the main process (receiving `dataPath`, handling plugin window events, state requests, exit confirmations).
    *   Application lifecycle events within the renderer (e.g., `ready`, `refresh:plugins`).
    *   Exposing core functionalities (`application`, `dispatch`, `settings`, `server`) globally via `window.jam`.
*   Networking components handle communication with the Animal Jam Classic game server. This involves:
    *   A local TCP proxy server (`src/networking/server/index.js`), instantiated in the renderer's `Application` class, listens on `127.0.0.1:443` for connections from the game client (SWF). It ensures default networking settings are applied.
    *   For each connection to the proxy, a `Client` instance (`src/networking/client/index.js`) is created. This `Client` manages two sockets: one to the local game client and one to the remote Animal Jam server (using SSL/TLS based on settings).
    *   A `DelimiterTransform` (`src/networking/transform/index.js`) is used on both sockets, likely to handle null-byte delimited messages common in SmartFox/Flash protocols.
    *   The `Client` class validates incoming messages (XML, XT, JSON using specific message classes like `XtMessage.js`), parses them, and dispatches them through the `Dispatch` system for plugin hooks. It also relays messages between the local client and remote server.
    *   Key protocols identified:
    *   **XML (`<...>`):** Used for login, setup, and some game actions. Likely parsed with `cheerio` (a listed dependency).
    *   **XT (`%xt%...%`):** The most common format, used for most real-time game actions (e.g., chat, movement, room joining). Follows a `%xt%COMMAND%PARAM1%...%` structure. The `src/networking/messages/XtMessage.js` class handles parsing these messages by splitting the string by '%' and storing the parts. It can also serialize an array of parts back into an XT string. It specifically identifies the message type from the parts (handling an optional 'o' prefix).
    *   **JSON (`{...}`):** Used for special data transfers, less common.
    *   The Network Tab in the UI allows viewing these raw packets.
*   The `UsernameLogger` plugin demonstrates a more detailed structure following guidelines in `.clinerules`, with dedicated folders for constants, handlers, models, services, and utils.
*   The project is a fork of the original "Jam" client, with significant core changes to support its advanced features.
*   The `assets/` directory stores static resources:
    *   Images (`.png`, `.ico`): Application icons, branding (Strawberry Jam logo, fruit images), and UI element icons (for actions, notifications).
    *   CSS (`assets/css/`): Stylesheets for the main application (`style.css`, `tailwind.css`) and plugins (`plugin-styles.css`).
    *   Flash (`assets/flash/`): Contains the core Animal Jam Classic client (`ajclient.swf`).
    *   JavaScript (`assets/javascript/`): Shared JavaScript libraries like `jquery-ui.js` and utility scripts for plugins (`plugin-utils.js`).
    *   A `winapp.asar.backup` file is also present, suggesting a backup of a packaged application archive.
*   The `data/` directory (likely within the application's user data path, managed by `getDataPath()`) stores user-generated data and plugin-specific configurations. This includes:
    *   Text files for account lists and username logs (e.g., `ajc_accounts.txt`, `collected_usernames.txt`, `working_accounts.txt`).
    *   Subdirectories for specific plugins, such as `data/UsernameLogger/config.json` for the Username Logger's configuration.
*   The `dev/` directory contains development resources:
    *   `dev/1714-defPacks/`: Likely contains game definition packs (e.g., item/room IDs), used as a reference by developers.
    *   `dev/SVF_Decompiled/`: Contains decompiled ActionScript (`.as`) files from the Animal Jam Classic client, including game logic and UI components (e.g., `scripts/`, `scripts/org/osmf/`). This serves as a crucial reference for understanding game mechanics and packet handling when developing plugins or core features.
2025-05-06 20:09:32 - Updated Overall Architecture section based on initial project structure review.
2025-05-06 20:16:45 - Updated Project Goal, Key Features, and Overall Architecture based on docs/community-guide/strawberry-jam-vs-jam.md.
2025-05-06 20:24:20 - Further detailed Key Features and Overall Architecture regarding the plugin system, based on docs/community-guide/plugins.md.
2025-05-06 20:31:34 - Added details about main UI tabs (Console, Network, Plugins) to Key Features, based on docs/community-guide/understanding-ui.md.
2025-05-06 20:37:07 - Detailed networking protocols (XML, XT, JSON) in Overall Architecture, based on docs/community-guide/packet-viewing.md.
2025-05-06 20:49:25 - Extensively updated Key Features and Overall Architecture based on detailed analysis of src/electron/index.js (main Electron process).
2025-05-06 20:59:48 - Added details about main renderer process (UI updates, Application class, window.jam) to Key Features and Overall Architecture, based on src/electron/renderer/index.js.
2025-05-06 21:09:39 - Refined XT message handling details in Overall Architecture, based on src/networking/messages/XtMessage.js.
2025-05-06 21:20:12 - Added details about standardized UI components for plugins to Key Features and Overall Architecture, based on plugins/README.md.
2025-05-06 21:32:45 - Detailed `plugin.json` structure in Overall Architecture, based on analysis of plugins/UsernameLogger/plugin.json and comparison with simpler examples.
2025-05-06 21:40:21 - Added description of complex plugin internal structure (models, services, handlers) to Overall Architecture, based on plugins/UsernameLogger/index.js.
2025-05-06 21:51:16 - Updated Project Goal and added User Setup/Warnings to Key Features based on main README.md.
2025-05-06 21:57:33 - Added details about build system, development workflow, and key dependencies from package.json to Key Features and Overall Architecture.
2025-05-06 22:12:42 - Added summary of assets/ directory contents to Overall Architecture.
2025-05-06 22:54:35 - Added summary of data/ directory contents and purpose to Overall Architecture.
2025-05-06 23:10:08 - Detailed electron-builder configurations (targets, icons, file inclusions/exclusions, publishing) in Key Features and Overall Architecture, based on electron-builder.json.
2025-05-06 23:36:28 - Added summary of dev/ directory contents (defPacks, decompiled SWF) to Overall Architecture.
2025-05-07 00:06:09 - Added details about clean-public-build.js script to Build and Development System in Key Features.
2025-05-07 00:49:25 - Confirmed API process is an Express.js server; updated Key Features and Overall Architecture in productContext.md.
2025-05-07 00:59:15 - Added API routing details (FilesController, ajclient.swf path) to API Process in Key Features, based on src/api/routes/index.js.
2025-05-07 01:07:29 - Detailed API Process in Key Features with information on local SWF serving and CDN proxying from FilesController.js.
2025-05-07 01:15:14 - Detailed the role and components of the renderer's Application class in Overall Architecture, based on src/electron/renderer/application/index.js.
2025-05-07 01:25:28 - Added 'clear' command to Console Tab description in Key Features, based on src/electron/renderer/application/core-commands/index.js.
2025-05-07 01:35:40 - Detailed the role of the Dispatch class in plugin/command/message management in Key Features and Overall Architecture, based on src/electron/renderer/application/dispatch/index.js.
2025-05-07 01:45:59 - Added ModalSystem details to UI/UX Improvements in Key Features, based on src/electron/renderer/application/modals/index.js.
2025-05-07 01:53:35 - Added confirmExitModal details to ModalSystem in Key Features, based on src/electron/renderer/application/modals/confirmExitModal.js.
2025-05-07 02:00:41 - Added linksModal details to ModalSystem in Key Features, based on src/electron/renderer/application/modals/linksModal.js.
2025-05-07 02:07:28 - Added Plugin Library modal details to ModalSystem in Key Features, based on src/electron/renderer/application/modals/plugins.js.
2025-05-07 02:16:30 - Added Settings modal details to ModalSystem in Key Features, based on src/electron/renderer/application/modals/settings.js.
2025-05-07 02:25:30 - Detailed ASAR patching workflow and sandboxed game client approach in Key Features and Overall Architecture, based on src/electron/renderer/application/patcher/index.js.
2025-05-07 02:37:07 - Detailed renderer-side Settings class and its interaction with electron-store via IPC in Key Features, based on src/electron/renderer/application/settings/index.js.
2025-05-07 02:47:53 - Detailed client-side networking (Client class, DelimiterTransform, proxy behavior) in Overall Architecture, based on src/networking/client/index.js.
2025-05-07 03:13:45 - Detailed local proxy server setup (TCP, port 443, default settings) in Overall Architecture, based on src/networking/server/index.js.
2025-05-07 03:31:36 - Clarified that the API Process uses the HttpClient service for CDN asset proxying in Key Features, based on src/services/HttpClient.js.
2025-05-07 03:41:20 - Detailed plugin tag management CLI script in Key Features, based on src/utils/manage-plugin-tags.js.
2025-05-07 06:40:05 - Clarified the role of unpacked ASAR contents (assets/extracted-winapp-dev/) in the build and patching process in Key Features.
2025-05-07 07:37:15 - Further clarified build and patching process, detailing how Strawberry Jam modifies original client UI code and replaces main process logic, based on analysis of assets/extracted-winapp-dev/index.js.
2025-05-07 08:04:02 - Refined description of how Strawberry Jam's custom ASAR integrates its own main process/preload with modified original client UI code.
2025-05-07 08:25:42 - Documented the integration and use of the original client's auto-login server (assets/extracted-winapp-dev/server.js) by Strawberry Jam in Overall Architecture.
2025-05-07 08:31:28 - Detailed the structure and role of the original client's main UI file (assets/extracted-winapp-dev/gui/index.html) in Overall Architecture.
2025-05-07 08:43:40 - Detailed the original client's Account Tester modules (tester-*.js files) and their removal/disabling by clean-public-build.js under Key Features.