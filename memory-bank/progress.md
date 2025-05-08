# Project Progress

## What Works (Current State)

1.  **Core Proxy & Plugin System:** Intercepts AJC traffic, allows packet analysis/modification, supports custom JavaScript plugins.
2.  **Standalone Client Interaction:** Manages a separate copy of AJC, patching and launching it independently, ensuring the original installation remains untouched.
3.  **User Interface:** Electron-based GUI for managing the proxy, viewing traffic, and interacting with plugins. Includes features like theme support and detailed plugin information modals.
4.  **Key Plugins:** Includes enhanced `UsernameLogger` (persistent state, simplified commands, robust leak check), `Advertising`, `Spammer`, `Login Packet Manipulator`, `Colors`, etc.
5.  **Build & Distribution:** Uses `electron-builder` for Windows/macOS packaging, Docker for cross-builds, `electron-updater` for auto-updates via GitHub Releases.
6.  **Developer Tools GUI:** Separate Electron app (`dev/`) for managing builds, ASAR packing, plugin tags, and running `package.json` scripts.
7.  **Coding Standards:** Formal standards defined in `.clinerules` guide development, emphasizing modularity.

## Current Status

The project is stable, featuring core MITM proxy functionality, a robust plugin system, and a user-friendly Electron interface. It utilizes a safe, standalone approach for interacting with the Animal Jam Classic client, creating and managing a separate copy of the game installation. Key plugins like `UsernameLogger` have been significantly improved, and a comprehensive Developer Tools GUI aids in build and plugin management. Formal coding standards are established and followed.

## Known Issues

1.  **Plugin System Stability:** Potential instability linked to `Dispatch` (`onCommand`, `setInterval`) and `application.consoleMessage`.
2.  **Core Security:** Electron runs with insecure settings (`nodeIntegration: true`, etc.), posing risks. TLS validation is disabled for MITM.
3.  **Developer GUI:** Testing is currently paused; potential bugs may exist.
4.  **UI Feedback:** Console/UI messaging for startup and plugin loading could be improved.
5.  **TFD Automator Plugin:** Lacks proper den detection; uses unreliable fallback user/den IDs and doesn't verify if the user is actually in their den before starting.
