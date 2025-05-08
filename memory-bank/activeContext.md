# Active Context

## Current Focus: Experimental Rate Limit Bypass Feature

**Task:** Implement an experimental feature to potentially mitigate rate limiting by injecting automatically generated IP addresses into HTTP headers for API requests made by the modified client.

**Implementation:**
- Added a checkbox toggle ("Enable Experimental Rate Limit Bypass") to the settings panel in `assets/extracted-winapp-dev/gui/components/LoginScreen.js`.
- The setting state is saved to `electron-store` under the key `experimental_rateLimitBypassEnabled`.
- Added logic in `assets/extracted-winapp-dev/index.js` using `session.defaultSession.webRequest.onBeforeSendHeaders`.
- When enabled, this logic intercepts outgoing HTTP/HTTPS requests to known Animal Jam API domains.
- For intercepted requests, it generates a random IP address string using a new helper function (`generateRandomIp`).
- It injects this random IP into the `X-Forwarded-For` and `Client-IP` headers of the request.

**Goal:** Allow the user to test the hypothesis that Animal Jam's API rate limiting might be influenced by these headers, despite the main game connection using TCP. This is experimental and may not be effective.

**Next Steps:**
- Test the effectiveness of this feature.
- If ineffective, consider removing it or exploring external TCP proxy integration (complex/risky).
- If testing is complete, shift focus back to the TFD Automator den detection issue.

## Current State Summary

Strawberry Jam is currently stable. Key recent accomplishments include:

1.  **Experimental Rate Limit Bypass:** Added a feature to automatically inject random IP headers (`X-Forwarded-For`, `Client-IP`) into client API requests, controlled by a setting toggle.
2.  **Formal Coding Standards:** Established `.clinerules` defining the "One File, One Function" principle, standard directory structures, and other best practices.
3.  **Standalone Client Interaction:** Implemented a safer approach by creating and managing a separate copy of the AJC installation (`strawberry-jam-classic`), patching only this copy and leaving the original untouched.
4.  **UI Enhancements:** Improved the user interface with interactive plugin information modals, theme-aware styling, better icons, and fixes for core UI elements like the plugin refresh button.
5.  **Plugin Improvements:** Fixed issues in the `Colors` and `UsernameLogger` plugins (including `fs.existsSync` error in config loading).
6.  **Code Quality:** Removed excessive console logging and streamlined application startup.

## Active Decisions & Learnings

-   **Header Injection Target:** Confirmed that HTTP header injection is only feasible for the client's API requests (HTTP/HTTPS), not the main game connection (TCP). Modifications target `assets/extracted-winapp-dev/index.js` and related UI components.
-   **Settings Integration:** Integrated the new toggle into the existing settings panel within `LoginScreen.js`, using established `electron-store` and IPC patterns (via `get-setting`/`set-setting`).
-   **Automatic IP Generation:** Implemented automatic random IP string generation within the client code to simplify user experience, avoiding manual input.
-   **Adherence to Standards:** The project follows the coding standards defined in `.clinerules`.
-   **Modularity Confirmed:** The `UsernameLogger` plugin meets the defined modular structure.
-   **Value of Standards:** Formal standards improve consistency and maintainability.
