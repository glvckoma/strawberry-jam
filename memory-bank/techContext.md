# Technical Context: Strawberry Jam

> **Note:** This project is a fork of the original Jam by sxip. All new work, documentation, and branding is under the name "Strawberry Jam".

## Core Technologies

-   **Runtime:** Node.js (v20.16.0). The `Username Logger` plugin (refactored from the original `buddyListLogger`, which was moved externally) is the primary plugin example.
-   **Framework:** Electron (v32.0.1) - Used for creating the cross-platform desktop application shell.
-   **UI:** HTML, CSS (Tailwind CSS), JavaScript (including jQuery).
-   **Networking:** Node.js `net` and `tls` modules for TCP/TLS proxying.
-   **API Server:** Express.js (v4.17.1) - Used for an internal API (port 8080), primarily for serving assets like the modified SWF.
-   **Package Management:** npm (v10.8.2 used as a dependency, system npm also required).
-   **Developer GUI:** A separate Electron window (`dev/`) built with HTML/CSS/JS, using IPC to interact with the main process for development tasks.

## Key Dependencies

-   `electron`: Core framework.
-   `electron-builder`: Used for packaging the application.
-   `ajv`: JSON Schema validator (used in `Dispatch` for `plugin.json`).
-   `cheerio`: Server-side HTML/XML parser (used in `XmlMessage.js`).
-   `electron-updater`: Handles application updates (used in `src/electron/index.js`).
-   `express`: Runs the internal API server (`src/api/`).
-   `axios`: Used for external API calls (`process_logs.js`, startup proxy test).
-   `https-proxy-agent`: Used in `Client.js` for proxy rotation.
-   `live-plugin-manager`: Used by `Dispatch` to dynamically install plugin dependencies (security risk).
-   `lodash`: Used for `debounce` in `Settings.js`.
-   `nodemon`: Used for development (`npm run dev`).
-   `cross-env`: Used for setting environment variables in npm scripts.
-   `tailwindcss`: Used for CSS styling (compiled via `nodemon`).
-   `request`, `request-promise-native`: Deprecated HTTP clients (used in `HttpClient.js`).
-   `eslint`: Used for code linting.
-   `git-filter-repo`: External tool used for advanced Git history rewriting (removing sensitive data).
-   `Docker`: Used for building macOS application versions on Windows.
-   *Note:* Settings (`settings.json`) are managed manually via the `Settings` class (`fs.promises`), not `electron-store`.

## Development Setup

-   Clone repository: `git clone https://github.com/glvckoma/strawberry-jam.git` (Updated URL)
-   Install dependencies: `cd jam && npm install`
-   Run main app in development mode: `npm run dev` (uses `nodemon` for auto-restarts).
-   Run Developer Tools GUI: `npm run devtools` (Launches `dev/index.js`)
-   (Optional) Install Docker Desktop for macOS builds on Windows (`npm run build:mac-docker:public` or `dev`).
-   Build Windows (Example): `npm run build:win:public`
-   Publish: `npx electron-builder --<platform> --publish always`. Requires `GH_TOKEN` environment variable.
    -   **MINGW64/Git Bash Workaround:** If `export GH_TOKEN=...` doesn't work, prepend directly: `GH_TOKEN="<token>" npx electron-builder ...`
-   (Optional) Install `git-filter-repo` for history manipulation.
-   Run custom pack & run script: `node pack-and-run.js` (Packs `dev` or `public` extracted client code into `assets/winapp.asar` and launches the app).

## Technical Constraints & Issues

-   **Electron Security Configuration:** Runs with highly insecure settings (`webSecurity: false`, `nodeIntegration: true`, `contextIsolation: false`, `enableRemoteModule: true`), significantly increasing vulnerability by giving renderer process full Node.js access.
-   **TLS Validation:** Disables TLS certificate validation (`rejectUnauthorized: false` in `Client.js`) when connecting to the game server, enabling MITM but creating security risks on untrusted networks.
-   **Internal Stability ("Invalid Status Type"):** Exhibits recurring errors, strongly suspected to originate from `application.consoleMessage` when passed an invalid `type`. Triggered by unstable command callbacks (`dispatch.onCommand`), timed packet sending (`dispatch.setInterval` + `sendRemoteMessage`), and potentially synchronous file I/O during plugin load (`nearbyUsernames`).
-   **Plugin System:**
    *   **Security Risks:**
        *   Uses `live-plugin-manager` for runtime dependency installation (arbitrary code execution risk).
        *   Loads "game" type plugins via `require()` directly into the insecure renderer process (arbitrary code execution risk).
    *   **UI/UX Improvements (Implemented):**
        *   Updated plugin icons to use more appropriate FontAwesome icons (window-restore for UI plugins, code for game plugins)
        *   Removed background containers from plugin icons for a cleaner look aligned with navigation items
        *   Fixed refresh button functionality to properly use the `jam.application.dispatch.refresh()` path
        *   Improved visual presentation with consistent color scheme
    *   **Bundled Plugin Updates:** Plugins included in the `plugins/` directory and packaged with the application (via `electron-builder.json`'s `extraFiles`) are automatically updated when the user updates Strawberry Jam using the `electron-updater` mechanism. No separate update process is needed for these bundled plugins.
-   **Deprecated Dependencies:** Relies on unmaintained libraries (`request`, `request-promise-native` in `HttpClient.js`).
-   **Synchronous I/O:** Potential use in some plugins (`fs.readFileSync`).
-   **DefPack Management (External/Out of Scope):** Lacks built-in support. Relies on external files or tools. DefPacks are currently considered out of scope for this project's active development.
-   **Modified Game Client ASAR Workflow:**
    -   **Source Code:** Modifications to the Animal Jam Classic client code are made directly within the `assets/extracted-winapp-dev` (for development/unreleased features) or `assets/extracted-winapp-public` (for release candidate) directories.
    -   **Packing:**
        -   `assets/winapp.asar` (Windows): Created by packing either `extracted-winapp-dev` or `extracted-winapp-public` using `npm run pack:asar:dev`, `npm run pack:asar:public`, or the `node pack-and-run.js` script.
        -   `assets/osxapp.asar` (macOS): Created as part of the Docker build process (`npm run build:mac-docker:*`).
    -   **Legacy File Removed:** The old `assets/app.asar`, previously used by a deprecated patching method and incorrectly targeted by an older version of `pack-and-run.js`, has been removed.
-   **Client Interaction (Standalone Implementation - Completed):**
    -   **Previous Method (Deprecated):** Relied on `hosts` file modification and patching the *original* AJC client's `app.asar`.
    -   **New Method (Implemented):** Uses a standalone approach:
        - Creates a separate copy of the AJC installation (`strawberry-jam-classic`).
        - Patches the `resources/app.asar` *within this copied installation* using the appropriate modified client ASAR (`assets/winapp.asar` or `assets/osxapp.asar`). The `Patcher` class (`src/electron/renderer/application/patcher/index.js`) handles this.
        - Launches the game executable from the copied installation.
        - Clears the cache for the copied installation on launch.
        - Eliminates the need for backup/restore logic.
-   **UI Enhancements:**
    -   **Implemented Improvements:**
        -   Fixed plugin refresh button functionality by correcting the path to `jam.application.dispatch.refresh()`
        -   Updated plugin icons to more appropriate FontAwesome icons
        -   Changed settings icon color from amber to grey for visual consistency
        -   Removed background containers from plugin icons for cleaner presentation
        -   Eliminated unnecessary console logs from the theme system
        -   Resolved duplicate "Starting Strawberry Jam..." log message during application startup by removing the redundant log call in `src/electron/renderer/index.js`.
-   **Privilege Requirement:** Requires elevated privileges (`sudo`