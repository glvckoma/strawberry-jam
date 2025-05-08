# System Patterns: Strawberry Jam

> **Note:** This project is a fork of the original Jam by sxip. All new work, documentation, and branding is under the name "Strawberry Jam".

---

## Core Architectural Patterns

- **`.clinerules` Coding Standards:**
    - **Purpose:** Define consistent coding practices and architectural guidelines for the entire project.
    - **Location:** Root directory (`.clinerules`).
    - **Key Principles:**
        - **One File, One Function:** Each file should have a single, clear responsibility.
        - **Standard Directory Structure:** Defines a consistent layout for plugins and components (`/constants`, `/models`, `/services`, `/handlers`, `/utils`).
        - **Coding Standards:** Covers file organization, class/function design (SRP, DI), error handling, and documentation (JSDoc).
        - **Plugin Guidelines:** Specific recommendations for user feedback, configuration, API access, and file operations within plugins.
        - **Modularization Strategy:** Provides a step-by-step approach for refactoring monolithic code into the standard structure.
    - **Usage:** This file serves as the primary reference for code style and architecture. All new code and refactoring efforts should adhere to these guidelines.

## April 2025: Patterns & Integration

- **Plugin Settings Access Pattern:** Plugins (e.g., UsernameLogger) must fetch sensitive settings (like API keys) from the main process via IPC (`ipcRenderer.invoke('get-setting', ...)`) at the time the setting is needed (e.g., inside a command handler). Loading settings during plugin instantiation is unreliable.
- **Plugin State Access Pattern (UI Plugins):** UI plugins (like advertising) must use `dispatch.getState(key)` to access core application state. The IPC bridge for this was refactored to use an asynchronous request/reply pattern between the main process and main renderer, supporting reliable cross-window communication.
- **Room State Tracking:** The core dispatch system now hooks `j#jr` (join room) and `j#l` (leave room) packets to automatically update `dispatch.state.room`, ensuring plugins can always access the current room ID.
- **Preview Button Pattern:** UI plugins can implement a "Preview" or "Send" button that sends a message to the game by constructing the appropriate packet and calling `dispatch.sendRemoteMessage(packet)`. The advertising plugin now uses this pattern for its preview button.
- **Build Compatibility:** UI plugins that use only standard web technologies, jQuery (injected by the main app), and the `window.jam` object for IPC do not require any special build configuration or extra dependencies. The advertising plugin is confirmed to work in both development and packaged builds.
- **Separation of Concerns:** process_logs.js is a standalone CLI script and is not used for leak checking logic inside UsernameLogger. All plugin logic is self-contained.
- **Staged, Test-Driven Workflow:** Features are delivered in stages, starting with the easiest task. User tests after each stage before proceeding. All changes and findings are documented in the memory-bank.
- **Robust Error Handling & State Reset for Long-Running Tasks:** Long-running plugin tasks (e.g., UsernameLogger leak check) must wrap their main processing loop in robust error handling (try/catch/finally or equivalent). A dedicated reset helper should always clear state flags (e.g., isLeakCheckRunning, isLeakCheckPaused) after completion, stop, pause, or error. This prevents plugins from getting "stuck" and ensures reliable stop/restart within the same session.
- **Batch File Writes for Performance:** For loops involving frequent file appends (like UsernameLogger leak check results), collect data in temporary arrays/sets within the loop. Write the collected data to the target files in batches (e.g., every N iterations or at the end/pause/stop) using a helper function. This significantly reduces I/O overhead and prevents performance degradation on large datasets.
- **Standalone CLI Scripts:** For tasks requiring independence from the Electron app (e.g., batch processing, long-running checks like `process_logs.js`), create standalone Node.js scripts.
    - Use `yargs` for robust command-line argument parsing (API keys, paths, limits, flags) and provide clear usage instructions (`.usage()`, `.epilogue()`, `.help()`).
    - Prioritize CLI arguments for configuration, potentially falling back to reading application config files (e.g., AppData `config.json`) or project files (`settings.json`) if appropriate. Clearly log the configuration source.
    - For interactive use, employ `inquirer` (using dynamic `import()`) to prompt the user for confirmation before execution. Include a `--non-interactive` flag to bypass prompts.
    - For long-running processes needing interruption, use `readline` to listen for specific keypresses (e.g., 's') or Ctrl+C to trigger a clean shutdown, ensuring final operations (like batch writes) are completed.
- **Build & Release Pattern:**
    - Use `electron-builder` for packaging Windows (`.exe`) and macOS (`.zip`) applications.
    - Utilize Docker for building macOS versions on Windows (`npm run build:mac-win`).
    - Employ `npm version <version>` (without `--no-git-tag-version`) for version management (updates `package.json`, `package-lock.json`, commits, tags).
    - Publish releases using `npx electron-builder --<platform> --publish always`. Requires `GH_TOKEN` environment variable (prefer prepending `GH_TOKEN=...` before the command in MINGW64/Git Bash).
    - Configure `electron-builder.json` and `package.json` for build targets, file exclusions (`directories.output` is "build"), and repository information.
- **Auto-Update Pattern:**
    - Implement auto-updates using `electron-updater`.
    - Configure `electron-builder.json` with `provider: "github"` and `releaseType: "release"`.
    - Initialize `electron-updater` in the main process (`src/electron/index.js`) only when `!isDevelopment`.
    - Ensure `autoUpdater.autoDownload = true;` is set for automatic background downloads.
    - Use `autoUpdater.on('event-name', ...)` to provide user feedback via notifications or UI updates.
    - Add placeholder `src/dev-app-update.yml` to prevent errors in development.
- **Git History Sanitization Pattern:**
    - **Untracking:** Use `git rm -r --cached <path>` to remove files/directories from Git tracking without deleting local copies. Update `.gitignore` *before* committing the removal.
    - **History Rewriting (Sensitive Data Removal):** Use `git-filter-repo --path <path> --invert-paths --force` to completely remove specific files/directories from all past commits. Requires re-adding the remote and force-pushing.
    - **History Reset (Fresh Start):** To replace all history with the current state:
        1. `rm -rf .git`
        2. `git init -b main`
        3. `git remote add origin <url>`
        4. `git add .gitignore && git commit -m "Add .gitignore"`
        5. `git add .`
        6. `git commit -m "Initial commit of project files"`
        7. `git push -u origin main --force`
- **ASAR Patching/Restoration Pattern (Deprecated - See Copied Installation Pattern):**
    - **Status:** This pattern is being replaced by the "Copied Installation Pattern".
    - **Original Logic:**
        - **Backup:** Before copying the custom ASAR (`assets/winapp.asar`), check if the original exists (`resources/app.asar` in the *original* AJC installation) and a backup (`resources/app.asar.unpatched`) does *not*. If so, rename the original to the backup path using `fs.promises.rename`.
        - **Patch:** Copy the custom ASAR over the original path using `fs.promises.copyFile`.
        - **Restore:** On application quit (`app.on('will-quit', ...)` in main process), check if the backup exists. If so, rename the backup back to the original path (`fs.promises.rename`), overwriting the patched version. **Do not** attempt to `rm` the patched ASAR first, as this can cause `EISDIR` errors.
    - **Original Quit Handler (`will-quit`):**
        - Use `event.preventDefault()` at the start.
        - Use a flag (`this._isQuitting`) to prevent the handler running multiple times.
        - Perform all critical cleanup operations within the `try` block:
            - Check flags for specific cleanup actions (e.g., manual cache clear).
            - Perform necessary `await`ed asynchronous operations (e.g., ASAR restore - *to be removed*, session cache clear).
            - **Terminate Child Processes:** Explicitly kill forked processes (e.g., `this._apiProcess.kill()`).
            - **Signal Background Tasks:** Signal long-running tasks to stop (e.g., set `this._isLeakCheckStopped = true`). Avoid awaiting indefinite stops.
        - **Force Exit:** Call `app.exit(0)` in the `finally` block. This is necessary because the default quit resumption after `event.preventDefault()` proved unreliable in packaged builds. Using `app.exit(0)` ensures the process terminates after cleanup attempts.
- **Copied Installation Pattern (Implemented):**
    - **Goal:** Isolate Strawberry Jam's modifications from the original AJC installation for safety and simplicity.
    - **Path Constants:**
        - `STRAWBERRY_JAM_CLASSIC_BASE_PATH`: Path to the copied installation (e.g., `%LocalAppData%\Programs\strawberry-jam-classic` on Windows, `/Applications/Strawberry Jam Classic.app/Contents` on macOS).
        - `STRAWBERRY_JAM_CLASSIC_CACHE_PATH`: Path to the cache for the copied installation (e.g., `%AppData%\Strawberry Jam Classic\Cache` on Windows, `~/Library/Application Support/Strawberry Jam Classic/Cache` on macOS).
    - **Setup Implementation:**
        - `ensureStrawberryJamVersionExists()` method in the `Patcher` class checks if the standalone copy already exists.
        - If not, it verifies the original AJC installation is present at `ANIMAL_JAM_CLASSIC_BASE_PATH`.
        - Creates parent directories as needed using `mkdir` with `{ recursive: true }`.
        - Uses platform-specific copy commands for better performance and compatibility:
          - Windows: `xcopy "${ANIMAL_JAM_CLASSIC_BASE_PATH}" "${STRAWBERRY_JAM_CLASSIC_BASE_PATH}" /E /I /H /Y`
          - macOS: `cp -R "${ANIMAL_JAM_CLASSIC_BASE_PATH}/"* "${STRAWBERRY_JAM_CLASSIC_BASE_PATH}/"`
        - Provides user feedback during the copy process via console messages.
        - Handles errors gracefully with appropriate user messaging.
    - **Patching Implementation:**
        - `patchCustomInstallation()` method targets the standalone installation's `app.asar`.
        - Removes any existing `app.asar` and `app.asar.unpacked` in the copied installation.
        - Copies the custom ASAR (`assets/winapp.asar` or `assets/osxapp.asar`) to the target location.
        - No backup/restore logic is needed since we're not modifying the original installation.
    - **Cache Management:**
        - Clears and recreates the cache directory for the standalone installation on each launch.
        - Uses `rm` with `{ recursive: true }` followed by `mkdir` with `{ recursive: true }`.
    - **Launching Implementation:**
        - `killProcessAndPatch()` method launches the game from the standalone installation.
        - Uses `spawn` for better process management: `spawn(exePath, [], { detached: false, stdio: 'ignore' })`.
        - Provides console messages for launch status.
    - **Cleanup:** 
        - The `will-quit` handler in `src/electron/index.js` no longer calls `restoreOriginalAsar`.
        - Other cleanup operations (killing API process, signaling tasks) remain unchanged.
    - **UI Enhancement:**
        - Updated "Play" button to a more prominent "Launch Strawberry Jam Classic" button.
        - Added visual cues to indicate the button launches an external application.
- **Cache Clearing on Quit Pattern (Manual Trigger):**
    - **Trigger:** Renderer sends IPC message (e.g., `danger-zone:clear-cache`).
    - **IPC Handler:** Sets a dedicated flag (e.g., `this._isClearingCacheAndQuitting = true`) and calls `app.quit()` (which triggers `will-quit`).
    - **`will-quit` Handler:**
        - Checks the dedicated flag (`if (this._isClearingCacheAndQuitting)`).
        - If true, performs cache clearing actions *sequentially* within the `try` block:
            - `await session.defaultSession.clearCache();`
            - `await session.defaultSession.clearStorageData({...});`
            - Spawn helper script (`clear-cache-helper.js`) *detached* (`spawn` with `detached: true`, `stdio: 'ignore'`, `unref()`). Pass necessary arguments like cache paths, a relaunch flag (`--relaunch-after-clear`), and the main app executable path (`app.getPath('exe')`). The main process does *not* wait for the helper.
        - Proceeds with other cleanup (e.g., killing API process). *ASAR restore call will be removed.*
- **Delayed Relaunch via Helper Script Pattern:**
    - **Purpose:** To ensure a delay between application shutdown/cleanup and relaunch, preventing issues caused by relaunching too quickly (e.g., invisible windows).
    - **Trigger:** Used after operations like manual cache clearing that require a full restart.
    - **Implementation:**
        - The main process's `will-quit` handler spawns the helper script (`clear-cache-helper.js`) detached, passing a flag (`--relaunch-after-clear`) and the main application's executable path (`app.getPath('exe')`).
        - The helper script performs its primary task (e.g., cache deletion after an initial delay).
        - If the primary task succeeds *and* the relaunch flag is present:
            - The helper script waits for a secondary delay (`setTimeout`).
            - After the delay, it uses `spawn` to execute the provided application executable path, again detached (`detached: true`, `stdio: 'ignore'`, `unref()`).
        - The helper script then exits (`process.exit(0)`).
- **Developer GUI Pattern:**
    - **Purpose:** Provide a dedicated UI for common development tasks, separate from the main application.
    - **Implementation:**
        - Files located in the top-level `dev/` directory.
        - Uses a separate Electron main process entry point (`dev/index.js`) and renderer (`dev/index.html`, `dev/preload.js`).
        - Launched via `npm run devtools` (defined in `package.json`).
        - Communicates with the main process via IPC (`contextBridge` in preload, `ipcMain.handle` in main) to execute commands (`exec`, `spawn`), read project files (`package.json`, `plugins/*.json`), manage files/folders (`shell.openPath`), etc.
        - Provides UI elements (buttons, tabs, terminal view) for tasks like building, ASAR packing, plugin tag management, and running `package.json` scripts.
        - Dynamically displays the current project version and calculates/shows examples for version bumps (patch, minor, major) in the UI.
- **Script Execution via GUI Pattern:**
    - **Purpose:** Allow developers to run `package.json` scripts directly from the Developer GUI.
    - **Implementation:**
        - The GUI fetches the `scripts` object from `package.json` via IPC.
        - Buttons are dynamically generated for each script.
        - A heuristic determines if a script is likely long-running (e.g., build, publish, dev) or short (e.g., version bump, pack).
        - Clicking a button triggers the corresponding `npm run <script_name>` command via IPC, using `spawn` (for long-running with live output) or `exec` (for short).
        - Output is displayed in the GUI's integrated terminal tab.
- **Simplified `package.json` Scripts Pattern:**
    - **Purpose:** Reduce redundancy and complexity in `package.json` scripts, relying more on the Developer GUI or direct CLI commands for specific variations.
    - **Implementation:**
        - Removed: `build:mac:dev`, `build:mac:public`, `build:all:dev`, `build:all:public`, `build:mac-win:dev`, `build:mac-win:public`, `plugin:tag:add`, `plugin:tag:remove`, `plugin:tag:beta:add`, `plugin:tag:beta:remove`, `publish:all`, `publish:win:no-bump`, `publish:all:no-bump`, `publish:mac-docker:no-bump`.
        - Kept core scripts for: `devtools`, `dev`, `clean:public`, `verify`, `pack:asar:dev`, `pack:asar:public`, `build:win:dev`, `build:win:public`, `build:mac-docker:dev`, `build:mac-docker:public`, `version:*`, `publish:win`, `publish:mac-docker`, `plugin:tag`, `plugin:tag:list`.
- **Main Window Close Button Pattern:**
    - **Problem:** Inline `onclick` handlers on frameless window UI elements can be unreliable, potentially conflicting with drag regions or initialization timing.
    - **Implementation:**
        - Define the close button element (e.g., `<button id="closeButton">`) in the main renderer HTML (`src/electron/renderer/index.html`).
        - Mark the button itself as non-draggable: `style="-webkit-app-region: no-drag;"`.
        - Remove any inline `onclick` handlers from the button or its children.
        - In the main renderer's JavaScript (`src/electron/renderer/application/index.js`), after the application object (`jam.application`) is fully instantiated, attach a click listener directly to the button element:
          ```javascript
          const closeButton = document.getElementById('closeButton');
          if (closeButton) {
            closeButton.addEventListener('click', () => {
              this.close(); // Calls method that sends 'window-close' IPC
            });
          }
          ```
        - The `application.close()` method sends an IPC message (`window-close`) to the main process, which then calls `window.close()` on the main `BrowserWindow`, triggering the standard quit sequence (including the `will-quit` handler).
- **Plugin Window Cleanup Pattern:**
    - **Goal:** Ensure plugin windows close cleanly using their 'X' button without leaving orphaned resources specific to that plugin.
    - **Implementation:**
        - Use the standard `window.close()` method in the plugin HTML's 'X' button `onclick` handler (e.g., `onclick="window.close()"`). This closes only the specific plugin `BrowserWindow`.
        - If the plugin script starts persistent background tasks (e.g., `setTimeout`, `setInterval`, network listeners like `window.jam.onPacket`), add a `window.addEventListener('beforeunload', cleanupFunction);` listener within the plugin's renderer script.
        - The `cleanupFunction` must explicitly stop timers (`clearTimeout`, `clearInterval`) and unsubscribe from listeners (e.g., calling the unsubscribe function returned by `window.jam.onPacket`).
        - Examples: `plugins/spammer/index.js` (clears timeout), `plugins/loginPacketManipulator/index.js` (unsubscribes from packet listener).
- **Memory Bank Update Policy:** All new work, patterns, and findings are documented in activeContext.md, progress.md, and systemPatterns.md as appropriate, per project policy.

---
...
