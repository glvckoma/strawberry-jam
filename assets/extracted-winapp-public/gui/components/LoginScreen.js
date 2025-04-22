"use strict";

// are now called directly in the constructor. They are expected to be globally available

(() => {
  let forgotBlocked = false;

  const forgotPassword = () => {
    if (forgotBlocked) {
      return;
    }
    forgotBlocked = true;

    const modal = document.createElement("ajd-forgot-password-modal");
    modal.addEventListener("close", event => {
      document.getElementById("modal-layer").removeChild(modal);
      forgotBlocked = false;
    });
    document.getElementById("modal-layer").appendChild(modal);
  };

  // Helper function to darken a hex color by a percentage (moved outside class)
  const darkenColor = (hex, percent) => {
    if (!hex || hex.length < 7) return hex;
    
    // Convert hex to RGB
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    
    // Darken
    r = Math.max(0, Math.floor(r * (100 - percent) / 100));
    g = Math.max(0, Math.floor(g * (100 - percent) / 100));
    b = Math.max(0, Math.floor(b * (100 - percent) / 100));
    
    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  customElements.define("ajd-login-screen", class extends HTMLElement {
    static get observedAttributes() {
      return [];
    }

    constructor() {
      super();

      this.attachShadow({mode: "open"}).innerHTML = `
        <style>
          
          /* Define CSS variables for theming */
          :host {
            --theme-primary: #e83d52; /* Default: Strawberry Red */
            --theme-secondary: rgba(232, 61, 82, 0.3);
            --theme-highlight: rgba(255, 220, 220, 0.3);
            --theme-shadow: rgba(252, 93, 93, 0.1);
            --theme-gradient-start: rgba(255, 220, 220, 0.3);
            --theme-gradient-end: rgba(255, 245, 230, 0.6);
            --theme-hover-border: rgba(232, 61, 82, 0.5);
            --theme-radial-1: rgba(255, 180, 180, 0.05);
            --theme-radial-2: rgba(255, 200, 200, 0.07);
            --theme-settings-hover: rgba(232, 61, 82, 0.05);
            --theme-settings-border: rgba(232, 61, 82, 0.2);
            --theme-box-background: rgba(255, 245, 230, 0.95); /* Default box background */
            --theme-button-bg: var(--theme-primary); /* Default button background */
            --theme-button-border: var(--theme-secondary); /* Default button border */
            --theme-button-text: #FFFFFF; /* Default button text */
            
            width: 100vw;
            height: calc(100vh - 2px);
            display: grid;
            /* Modified grid to make space for settings button */
            grid-template: 1fr 590px 1fr / 1fr 936px 1fr;
            grid-template-areas: ". . button-tray"
                                 ". box ."
                                 ". . .";
            background-color: rgba(239, 234, 221, 0);
            transition: background-color 0.2s;
          }
          
          /* Settings button and panel styles */
          #settings-btn {
            position: absolute;
            top: 10px;
            left: 10px;
            width: 32px;
            height: 32px;
            font-size: 20px;
            border: 2px solid var(--theme-secondary);
            border-radius: 8px;
            background-color: rgba(255, 245, 230, 0.95); /* Keep neutral */
            cursor: pointer;
            opacity: 0.8;
            transition: all 0.3s ease;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          #settings-btn:hover {
            opacity: 1;
            border-color: var(--theme-hover-border);
            transform: scale(1.05);
          }
          
          #settings-panel {
            position: absolute;
            top: 50px;
            left: 10px;
            width: 250px;
            background-color: rgba(255, 245, 230, 0.95); /* Keep neutral */
            border: 2px solid var(--theme-secondary);
            border-radius: 12px;
            padding: 15px;
            /* display: none; */ /* Handled by animation */
            z-index: 1000;
            box-shadow: 0 8px 32px var(--theme-shadow);
            transition: border-color 0.3s ease, box-shadow 0.3s ease;
          }
          
          #settings-panel h3 {
            margin-top: 0;
            color: var(--theme-primary);
            font-family: Tiki-Island;
            font-size: 18px;
            text-align: center;
            margin-bottom: 10px;
            text-shadow: 1px 1px 0px var(--theme-shadow);
            transition: color 0.3s ease, text-shadow 0.3s ease;
          }
          
          .settings-group {
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--theme-settings-border);
            transition: border-bottom-color 0.3s ease;
          }
          
          .settings-group:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }
          
          .settings-item {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            font-size: 12px;
            color: #6E4B37;
            font-family: CCDigitalDelivery;
            padding: 4px;
            transition: background-color 0.2s;
            border-radius: 6px;
          }
          
          .settings-item:hover {
            background-color: var(--theme-settings-hover);
          }
          
          .settings-item input[type="checkbox"] {
            margin-right: 8px;
          }

          .hidden {
            display: none !important;
          }

          #box-background {
            /* Original grid area */
            grid-area: box;
            background-color: var(--theme-box-background); /* Use theme variable */
            border-radius: 20px;
            box-shadow: 0 8px 32px var(--theme-shadow);
            border: 1px solid var(--theme-secondary);
            opacity: 1;
            transition: opacity 0.2s, box-shadow 0.3s ease, border-color 0.3s ease, background-color 0.3s ease; /* Added background-color transition */
          }

          @media (max-width: 950px), (max-height: 590px) {
            #box-background {
              z-index: -1;
              opacity: 0;
            }

            :host {
              background-color: rgba(255, 240, 245, 1); /* Keep neutral */
              background-image: linear-gradient(to bottom right, var(--theme-gradient-start), var(--theme-gradient-end));
              transition: background-image 0.3s ease;
            }
          }

          #box {
            grid-area: box;
            display: flex;
            justify-content: center;
            align-items: center; /* Added for vertical centering */
            /* Removed border-image, handled by #box-background */
            padding: 50px 70px 50px;
            /* position: relative; */ /* REMOVED */
            /* z-index: 1; */         /* REMOVED */
          }

          #login-container {
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          #login-container > * {
            margin-bottom: 9px;
          }

          #login-image {
            user-select: none;
            pointer-events: none;
            grid-area: left;
          }

          #need-account {
            user-select: none;
            pointer-events: none;
            font-size: 12px;
            line-height: 18px;
            letter-spacing: -0.25px;
            color: #6E4B37;
            font-family: CCDigitalDelivery;
            font-weight: bold;
          }

          #player-login-text {
            color: var(--theme-primary);
            font-family: Tiki-Island;
            font-size: 36px;
            text-shadow: 1px 2px 0px var(--theme-shadow);
            margin-bottom: 10px;
            letter-spacing: 0.5px;
            transition: color 0.3s ease, text-shadow 0.3s ease;
          }

          #login-btn-container {
            display: grid;
            grid-template: 1fr / 1fr fit-content(100%) 1fr;
            grid-template-areas: "left mid right";
            align-items: center;
          }

          #log-in-btn {
            grid-area: mid;
            padding: 6px 24px;
            /* Apply theme variables to bubble buttons */
            --ajd-bubble-button-background-color: var(--theme-button-bg);
            --ajd-bubble-button-border-color: var(--theme-button-border);
            --ajd-bubble-button-text-color: var(--theme-button-text);
            transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
          }

          @keyframes fade {
            0%,100% { opacity: 0 }
            50% { opacity: 1 }
          }

          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(-360deg);
            }
          }

          #spinner {
            margin-left: 10px;
            grid-area: left;
            height: 90%;
            opacity: 0;
            transition: opacity .5s;
            animation: spin 1500ms linear infinite;
          }

          /* --- Fruit Rotation Animation (Simple Pop) --- */
          @keyframes fruit-pop {
            0%   { transform: scale(1); } /* Start normal */
            50%  { transform: scale(1.25); } /* Pop bigger */
            100% { transform: scale(1); } /* Settle to normal size */
          }

          .fruit-animate {
            /* Apply the animation */
            animation: fruit-pop 0.3s ease-out; /* Quick pop */
            /* Ensure the image flips back correctly if starting flipped */
            transform-style: preserve-3d; 
          }
          /* --- End Fruit Rotation Animation --- */

          #spinner.show {
            opacity: 1;
          }

          ajd-text-input {
            width: 100%;
            border-radius: 25px;
            border: var(--theme-secondary) 2px solid;
            transition: border-color 0.3s ease;
            margin-bottom: 12px;
          }

          ajd-text-input:hover {
            border-color: var(--theme-hover-border);
          }

          #remember-me-cb {
            font-size: 15px;
            letter-spacing: -1px;
            font-weight: bold;
          }

          #forgot-password-link {
            font-size: 12px;
            line-height: 14px;
            letter-spacing: .25px;
            color: #CC6C2B;
            text-decoration: none;
            user-select: none;
            cursor: pointer;
            font-family: CCDigitalDelivery;
          }

          .vertical-spacer {
            height: 2px;
            width: 75%;
            border-bottom: var(--theme-secondary) 2px solid;
            margin: 10px 0;
            transition: border-bottom-color 0.3s ease;
          }

          #forgot-password-link {
            letter-spacing: -0.5px;
          }

          #forgot-password-link:hover {
            text-decoration: underline;
          }

          #create-account-btn {
            font-size: 24px;
            padding: 4px 12px;
            /* Apply theme variables to bubble buttons */
            --ajd-bubble-button-background-color: var(--theme-button-bg);
            --ajd-bubble-button-border-color: var(--theme-button-border);
            --ajd-bubble-button-text-color: var(--theme-button-text);
            transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
          }

          #version {
            position: absolute;
            right: 10px;
            bottom: 10px;
            display: grid;
            grid-template-columns: 1fr 24px;
          }

          #version:hover {
            text-decoration: underline;
          }

          #version-link {
            font-size: 16px;
            line-height: 24px;
            letter-spacing: -0.5px;
            color: #684A26;
            text-decoration: none;
            user-select: none;
            cursor: pointer;
            font-family: CCDigitalDelivery;
          }

          #version-status-icon {
            background: url(images/core/core_form_input_status_icn_sprite.svg);
            background-repeat: no-repeat;
            background-size: 80px;
            width: 20px;
            height: 20px;
            opacity: 0.0;
          }

          #version-status-icon.check {
            background-position: -20px 0px;
            animation: spin 1500ms linear infinite;
            opacity: 1.0;
            transition-property: opacity;
            transition-duration: 0.5s;
          }

          #version-status-icon.download {
            opacity: 1.0;
          }

          #version-status-icon.restart {
            background-position: -40px 0px;
            opacity: 0.0;
            animation: fade 1.5s ease-out infinite;
          }

          #version-status-icon.error {
            background-position: -60px 0px;
            opacity: 0.0;
            animation: fade 1.5s ease-out infinite;
          }

          #button-tray {
            grid-area: button-tray;
            display: flex;
            flex-direction: row;
            justify-content: flex-end;
          }
          #button-tray ajd-button {
            width: 54px;
            height: 54px;
          }

          /* Settings Panel Animation */
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          #settings-panel {
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            transition: max-height 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
                        opacity 0.3s ease, 
                        padding 0.3s ease;
            transform-origin: top center;
          }
          
          #settings-panel.show {
            max-height: 500px; /* Adjust as needed to fit content */
            opacity: 1;
            animation: slideDown 0.3s ease forwards;
          }
          
          /* Show/hide warning for UUID spoofing */
          #uuid-spoofing-warning {
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            transition: max-height 0.2s ease, opacity 0.2s ease, margin 0.2s ease;
          }
          
          #uuid-spoofing-warning.show {
            max-height: 100px; /* Adjust as needed */
            opacity: 1;
            margin-top: 5px;
          }
          
        </style>
        <div id="box-background"></div>
        <div id="button-tray" class="hidden">
          <ajd-button graphic="UI_fullScreen" id="expand-button">
          </ajd-button>
          <ajd-button graphic="UI_power" id="close-button">
          </ajd-button>
        </div>
        <div id="box">
<div id="login-container">
  <img src="images/strawberry.png" alt="App Icon" id="login-app-icon" style="width:90px;display:block;margin-bottom:8px;margin-left:auto;margin-right:auto;"> <!-- Changed default src -->
  <div id="player-login-text">playerLogin</div>
  <ajd-text-input id="username-input" placeholder="username" type="text"></ajd-text-input>
            <ajd-text-input id="password-input" placeholder="password" type="password"></ajd-text-input>
            <ajd-checkbox id="remember-me-cb" text="rememberMeText"></ajd-checkbox>
            <div id="login-btn-container">
              <ajd-bubble-button id="log-in-btn" text="login"></ajd-bubble-button>
              <img id="spinner" src="images/electron_login/log_spinner.svg"></img>
            </div>
            <a id="forgot-password-link">forgotPassword</a>
            <div class="vertical-spacer"></div>
            <div id="need-account">needAccount?</div>
            <ajd-bubble-button id="create-account-btn" text="createAnimal"></ajd-bubble-button>
          </div>
        </div>

        <!-- Settings Button and Panel -->
        <button id="settings-btn" title="Settings">⚙️</button>
        <div id="settings-panel">
          <h3>Settings</h3>
          <div class="settings-group">
            <div class="settings-item">
              <input type="checkbox" id="debug-toggle" style="vertical-align: middle;">
              <label for="debug-toggle" style="vertical-align: middle;">Enable Debug Logging</label>
            </div>
            <div class="settings-item">
              <input type="checkbox" id="disable-devtools-toggle" style="vertical-align: middle;">
              <label for="disable-devtools-toggle" style="vertical-align: middle;">Enable Developer Console on Start</label>
            </div>
            <div class="settings-item">
              <input type="checkbox" id="uuid-spoofer-toggle" style="vertical-align: middle;">
              <label for="uuid-spoofer-toggle" style="vertical-align: middle;">Enable UUID Spoofing</label>
              <div id="uuid-spoofing-warning" class="hidden" style="margin-top: 5px; padding: 6px; background-color: rgba(255, 217, 0, 0.1); border-left: 3px solid rgba(255, 176, 0, 0.6); border-radius: 4px; font-size: 11px; line-height: 1.3;">
                ⚠️ Warning: UUID spoofing will not work with accounts that have 2FA enabled.
              </div>
            </div>
            <div class="settings-item">
              <label for="game-language-select" style="vertical-align: middle; margin-right: 8px;">Game Language:</label>
              <select id="game-language-select" style="vertical-align: middle; padding: 2px 4px; border-radius: 4px; border: 1px solid var(--theme-settings-border); background-color: white; color: #333; font-family: CCDigitalDelivery; font-size: 11px;">
                <option value="en">English</option>
                <option value="de">German</option>
                <option value="fr">French</option>
                <option value="es">Spanish</option>
                <option value="pt">Portuguese</option>
              </select>
            </div>
          </div>
        </div>

        <div id="version">
          <a id="version-link">0.0.0</a>
          <ajd-progress-ring id="version-status-icon" stroke-color="#64cc4d" stroke-width="3" radius="11"></ajd-progress-ring>
        </div>
      `;

      // --- Core Login State ---
      this._authToken = null;
      this._refreshToken = null;
      this._otp = null;
      this._isFakePassword = false;
      this._version = "";

      // --- Core Login Element References ---
      this.loginSpinnerElem = this.shadowRoot.getElementById("spinner");
      this.versionElem = this.shadowRoot.getElementById("version");
      this.versionLinkElem = this.shadowRoot.getElementById("version-link");
      this.versionStatusIconElem = this.shadowRoot.getElementById("version-status-icon");
      this.usernameInputElem = this.shadowRoot.getElementById("username-input");
      this.passwordInputElem = this.shadowRoot.getElementById("password-input");
      this.rememberMeElem = this.shadowRoot.getElementById("remember-me-cb");
      this.forgotPasswordLinkElem = this.shadowRoot.getElementById("forgot-password-link");
      this.needAccountElem = this.shadowRoot.getElementById("need-account");
      this.createAnAnimalTextElem = this.shadowRoot.getElementById("create-an-animal"); // Note: Element ID seems incorrect in original HTML?
      this.playerLoginTextElem = this.shadowRoot.getElementById("player-login-text");
      this.createAccountElem = this.shadowRoot.getElementById("create-account-btn");
      this.logInButtonElem = this.shadowRoot.getElementById("log-in-btn");
      this.expandButtonElement = this.shadowRoot.getElementById("expand-button");
      this.closeButtonElement = this.shadowRoot.getElementById("close-button");
      this.loginAppIconElem = this.shadowRoot.getElementById("login-app-icon"); // Get reference to the icon

      // --- Settings Element References ---
      this.settingsBtn = this.shadowRoot.getElementById("settings-btn");
      this.settingsPanel = this.shadowRoot.getElementById("settings-panel");
      this.debugToggle = this.shadowRoot.getElementById("debug-toggle");
      this.disableDevToolsToggle = this.shadowRoot.getElementById("disable-devtools-toggle");
      this.uuidSpooferToggle = this.shadowRoot.getElementById("uuid-spoofer-toggle");
      this.uuidSpoofingWarning = this.shadowRoot.getElementById("uuid-spoofing-warning");
      this.gameLanguageSelect = this.shadowRoot.getElementById("game-language-select"); // Get reference

      // --- Fruit Rotation & Theming Logic ---
      const fruitThemes = {
        'strawberry.png': { primary: '#e83d52', secondary: 'rgba(232, 61, 82, 0.3)', highlight: 'rgba(255, 220, 220, 0.3)', shadow: 'rgba(252, 93, 93, 0.1)', gradientStart: 'rgba(255, 220, 220, 0.3)', gradientEnd: 'rgba(255, 245, 230, 0.6)', hoverBorder: 'rgba(232, 61, 82, 0.5)', radial1: 'rgba(255, 180, 180, 0.05)', radial2: 'rgba(255, 200, 200, 0.07)', settingsHover: 'rgba(232, 61, 82, 0.05)', settingsBorder: 'rgba(232, 61, 82, 0.2)' },
        'banana.png': { primary: '#FFDA03', secondary: 'rgba(255, 218, 3, 0.3)', highlight: 'rgba(255, 248, 220, 0.3)', shadow: 'rgba(255, 218, 3, 0.1)', gradientStart: 'rgba(255, 248, 220, 0.3)', gradientEnd: 'rgba(255, 250, 235, 0.6)', hoverBorder: 'rgba(255, 218, 3, 0.5)', radial1: 'rgba(255, 230, 100, 0.05)', radial2: 'rgba(255, 240, 150, 0.07)', settingsHover: 'rgba(255, 218, 3, 0.05)', settingsBorder: 'rgba(255, 218, 3, 0.2)' },
        'blueberries.png': { primary: '#4682B4', secondary: 'rgba(70, 130, 180, 0.3)', highlight: 'rgba(173, 216, 230, 0.3)', shadow: 'rgba(70, 130, 180, 0.1)', gradientStart: 'rgba(173, 216, 230, 0.3)', gradientEnd: 'rgba(220, 235, 245, 0.6)', hoverBorder: 'rgba(70, 130, 180, 0.5)', radial1: 'rgba(100, 150, 200, 0.05)', radial2: 'rgba(120, 170, 220, 0.07)', settingsHover: 'rgba(70, 130, 180, 0.05)', settingsBorder: 'rgba(70, 130, 180, 0.2)' },
        'cantaloupe.png': { primary: '#FFA07A', secondary: 'rgba(255, 160, 122, 0.3)', highlight: 'rgba(255, 228, 196, 0.3)', shadow: 'rgba(255, 160, 122, 0.1)', gradientStart: 'rgba(255, 228, 196, 0.3)', gradientEnd: 'rgba(255, 245, 230, 0.6)', hoverBorder: 'rgba(255, 160, 122, 0.5)', radial1: 'rgba(255, 180, 150, 0.05)', radial2: 'rgba(255, 200, 170, 0.07)', settingsHover: 'rgba(255, 160, 122, 0.05)', settingsBorder: 'rgba(255, 160, 122, 0.2)' },
        'coconut.png': { primary: '#A0522D', secondary: 'rgba(160, 82, 45, 0.3)', highlight: 'rgba(210, 180, 140, 0.3)', shadow: 'rgba(160, 82, 45, 0.1)', gradientStart: 'rgba(210, 180, 140, 0.3)', gradientEnd: 'rgba(245, 222, 179, 0.6)', hoverBorder: 'rgba(160, 82, 45, 0.5)', radial1: 'rgba(180, 120, 80, 0.05)', radial2: 'rgba(200, 140, 100, 0.07)', settingsHover: 'rgba(160, 82, 45, 0.05)', settingsBorder: 'rgba(160, 82, 45, 0.2)' },
        'pineapple.png': { primary: '#FFEC8B', secondary: 'rgba(255, 236, 139, 0.3)', highlight: 'rgba(255, 250, 205, 0.3)', shadow: 'rgba(255, 236, 139, 0.1)', gradientStart: 'rgba(255, 250, 205, 0.3)', gradientEnd: 'rgba(255, 255, 224, 0.6)', hoverBorder: 'rgba(255, 236, 139, 0.5)', radial1: 'rgba(255, 240, 160, 0.05)', radial2: 'rgba(255, 245, 180, 0.07)', settingsHover: 'rgba(255, 236, 139, 0.05)', settingsBorder: 'rgba(255, 236, 139, 0.2)' },
      };
      const fruitImages = Object.keys(fruitThemes);
      
      // Helper function to determine if a color is light (requires dark text)
      const isLightColor = (hexColor) => {
        if (!hexColor || hexColor.length < 7) return false; // Basic validation
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        // Simple luminance calculation (YIQ formula)
        const luminance = (r * 299 + g * 587 + b * 114) / 1000;
        return luminance > 150; // Threshold can be adjusted (128-160 is common)
      };

      const applyTheme = (fruitKey) => {
        const theme = fruitThemes[fruitKey];
        if (!theme) return;
        const root = this.shadowRoot.host; // Apply to the component's host element
        
        // Determine if the primary color is light
        const primaryIsLight = isLightColor(theme.primary);

        // Set core theme variables
        root.style.setProperty('--theme-primary', theme.primary);
        root.style.setProperty('--theme-secondary', theme.secondary);
        root.style.setProperty('--theme-highlight', theme.highlight);
        root.style.setProperty('--theme-shadow', theme.shadow);
        root.style.setProperty('--theme-gradient-start', theme.gradientStart);
        root.style.setProperty('--theme-gradient-end', theme.gradientEnd);
        root.style.setProperty('--theme-hover-border', theme.hoverBorder);
        root.style.setProperty('--theme-radial-1', theme.radial1);
        root.style.setProperty('--theme-radial-2', theme.radial2);
        root.style.setProperty('--theme-settings-hover', theme.settingsHover);
        root.style.setProperty('--theme-settings-border', theme.settingsBorder);

        // Set box background - much darker for light themes
        if (primaryIsLight && (fruitKey === 'banana.png' || fruitKey === 'pineapple.png')) {
          root.style.setProperty('--theme-box-background', 'rgba(225, 210, 180, 0.97)'); // Much darker neutral for light themes
        } else {
          root.style.setProperty('--theme-box-background', 'rgba(255, 245, 230, 0.95)'); // Default neutral
        }

        // Set button colors with contrast check - use darker buttons for light themes
        const buttonBg = primaryIsLight ? darkenColor(theme.primary, 15) : theme.primary; // Use standalone function
        root.style.setProperty('--theme-button-bg', buttonBg);
        root.style.setProperty('--theme-button-border', theme.secondary);
        root.style.setProperty('--theme-button-text', primaryIsLight ? '#333333' : '#FFFFFF'); // Dark text for light buttons
        
        // Apply directly to buttons to ensure styling works
        const buttons = this.shadowRoot.querySelectorAll('ajd-bubble-button');
        buttons.forEach(button => {
          // Force style update
          button.style.setProperty('--ajd-bubble-button-background-color', buttonBg);
          button.style.setProperty('--ajd-bubble-button-border-color', theme.secondary);
          button.style.setProperty('--ajd-bubble-button-text-color', primaryIsLight ? '#333333' : '#FFFFFF');
        });
      };

      // Find the index of the currently displayed fruit, default to strawberry if not found or if it was icon.png
      // Removed _darkenColor method from here
      let currentFruitIndex = fruitImages.findIndex(src => this.loginAppIconElem.src.endsWith(src));
      if (currentFruitIndex === -1) currentFruitIndex = fruitImages.length - 1; // Default to last item (strawberry)

      this.loginAppIconElem.style.cursor = 'pointer'; // Make it look clickable
      this.loginAppIconElem.addEventListener('click', () => {
        // 1. Calculate next index
        currentFruitIndex = (currentFruitIndex + 1) % fruitImages.length;
        const nextFruitKey = fruitImages[currentFruitIndex];
        
        // 2. Update the image source BEFORE animation
        this.loginAppIconElem.src = `images/${nextFruitKey}`; // Assuming images are in 'images/' folder relative to component

        // 3. Apply the new theme
        applyTheme(nextFruitKey);

        // 4. Trigger the animation
        this.loginAppIconElem.classList.remove('fruit-animate'); // Remove class if already there
        // Force reflow/repaint to ensure animation restarts
        void this.loginAppIconElem.offsetWidth; 
        this.loginAppIconElem.classList.add('fruit-animate'); 

        // Remove the class after animation completes to allow re-triggering on next click
        setTimeout(() => {
            if (this.loginAppIconElem) { // Check if element still exists
                 this.loginAppIconElem.classList.remove('fruit-animate');
            }
        }, 300); // Match animation duration (0.3s)
      });
      // --- End Fruit Rotation Logic ---

      // --- Core Login Event Listeners ---
      this.loginSpinnerElem.addEventListener("click", event => {
        if (globals.userAbortController) globals.userAbortController.abort();
      });
      this.versionElem.addEventListener("click", () => {
        window.ipc.send("about");
      });
      this.usernameInputElem.addEventListener("keydown", event => event.key === "Enter" ? this.logIn() : "");
      this.usernameInputElem.addEventListener("input", event => {
        if (this.authToken) this.clearAuthToken();
        if (this.refreshToken) this.clearRefreshToken();
      });
      this.passwordInputElem.addEventListener("keydown", event => event.key === "Enter" ? this.logIn() : "");
      this.passwordInputElem.addEventListener("input", event => {
        if (this.isFakePassword) this.isFakePassword = false;
        if (this.authToken) this.clearAuthToken();
        if (this.refreshToken) this.clearRefreshToken();
      });
      this.rememberMeElem.addEventListener("click", event => {
        window.ipc.send("rememberMeStateUpdated", {newValue: this.rememberMeElem.value});
      });
      this.forgotPasswordLinkElem.addEventListener("click", () => {
        if (this.loginBlocked) return;
        forgotPassword();
      });
      this.createAccountElem.addEventListener("click", async () => {
        if (this.loginBlocked) return;
        this.loginBlocked = true;
        try {
          const flashVars = await globals.getFlashVarsFromWeb();
          Object.assign(
            flashVars,
            globals.getClientData(),
            { locale: globals.language, webRefPath: "create_account" },
            globals.affiliateCode ? { affiliate_code: globals.affiliateCode } : {}
          );
          this.dispatchEvent(new CustomEvent("loggedIn", {detail: {flashVars}}));
        } catch (err) {
          globals.reportError("webClient", `Error creating account: ${err.stack || err.message}`);
          if (err.name != "Aborted") window.alert("Something went wrong :(");
          this.loginBlocked = false;
        }
      });
      this.logInButtonElem.addEventListener("click", () => {
          globals.currentAbortController = new AbortController();
          console.log('[LoginScreen] Created AbortController for login attempt.');
          this.logIn();
      });
      this.expandButtonElement.addEventListener("click", event => {
        window.ipc.send("systemCommand", {command: "toggleFullScreen"});
      });
      this.closeButtonElement.addEventListener("click", event => {
        window.ipc.send("systemCommand", {command: "exit"});
      });

      // --- Core Login IPC Listeners ---
      window.ipc.on("autoUpdateStatus", (event, data) => {
        for (const state of ["check", "download", "restart", "error"]) {
          this.versionStatusIconElem.classList.remove(state);
          if (state == data.state) this.versionStatusIconElem.classList.add(data.state);
        }
        this.setProgress(data.progress || null);
      });
      window.ipc.on("screenChange", (event, state) => {
        const buttonTray = this.shadowRoot.getElementById("button-tray");
        if (state === "fullScreen" && globals.systemData.platform === "win32") {
          buttonTray.classList.remove("hidden");
        } else {
          buttonTray.classList.add("hidden");
        }
      });

      // --- Settings Initialization ---
      // Settings panel smooth animation toggle
      this.settingsBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent the click from propagating to document
        // Toggle the show class instead of changing display property
        if (this.settingsPanel.classList.contains('show')) {
          this.settingsPanel.classList.remove('show');
          setTimeout(() => {
            if (!this.settingsPanel.classList.contains('show')) {
              this.settingsPanel.style.padding = '0';
            }
          }, 300); // Match the CSS transition duration
        } else {
          this.settingsPanel.style.padding = '15px'; // Restore padding
          // Force reflow before adding the class
          void this.settingsPanel.offsetHeight;
          this.settingsPanel.classList.add('show');
        }
        console.log('Settings button clicked, panel classList:', this.settingsPanel.classList);
      });
      
      // Close settings panel when clicking outside
      document.addEventListener('click', (event) => {
        const path = event.composedPath ? event.composedPath() : event.path;
        if (path && !path.includes(this.settingsPanel) && !path.includes(this.settingsBtn)) {
          if (this.settingsPanel.classList.contains('show')) {
            this.settingsPanel.classList.remove('show');
            setTimeout(() => {
              if (!this.settingsPanel.classList.contains('show')) {
                this.settingsPanel.style.padding = '0';
              }
            }, 300);
          }
        }
      });
      
      // Initialize debug toggle
      // Note: State initialization moved to _initializeAsyncSettings
      this.debugToggle.addEventListener('change', () => {
        window.ipc.send('set-setting', 'debugLoggingEnabled', this.debugToggle.checked);
      });
      
      // Initialize DevTools toggle with inverted logic
      // (true means enable dev console, but stored setting is "disable")
      // Note: State initialization moved to _initializeAsyncSettings
      this.disableDevToolsToggle.addEventListener('change', () => {
        // Invert the value when sending to main process
        window.ipc.send('set-setting', 'disableDevTools', !this.disableDevToolsToggle.checked);
      });
      
      // Initialize UUID spoofer toggle
        // Note: State initialization moved to _initializeAsyncSettings
      this.uuidSpooferToggle.addEventListener('change', async () => {
        const newState = this.uuidSpooferToggle.checked;
        
        try {
          // Use invoke instead of send to properly trigger the confirmation dialog
          const result = await window.ipc.invoke('toggle-uuid-spoofing', newState);
          
          if (result.success) {
            // Toggle warning display based on the actual result
            if (result.enabled) {
              this.uuidSpoofingWarning.classList.add('show');
            } else {
              this.uuidSpoofingWarning.classList.remove('show');
            }
            
            // Make sure checkbox matches the actual result
            this.uuidSpooferToggle.checked = result.enabled;
          } else {
            // If it failed, reset the checkbox to the opposite state
            this.uuidSpooferToggle.checked = !newState;
            // Also adjust warning visibility
            if (!newState) {
              this.uuidSpoofingWarning.classList.add('show');
            } else {
              this.uuidSpoofingWarning.classList.remove('show');
            }
            console.log("[UUID] Toggle failed:", result.message);
          }
        } catch (error) {
          console.error("[UUID] Error toggling UUID spoofing:", error);
          // Reset checkbox on error
          this.uuidSpooferToggle.checked = !newState;
        }
      });

      // Call async initialization methods (don't await in constructor)
      this._initializeAsyncSettings();
      this._initializeGameLanguageSetting();

      // Initialize settings with fallbacks for packed builds where IPC might be restricted
      this.initializeSettings().catch(err => {
        console.warn('[LoginScreen] Error initializing settings:', err);
      });
    } // End Constructor

    // --- Async Settings Initialization ---
    async _initializeAsyncSettings() {
      try {
        // Initialize debug toggle state
        try {
          const debugLoggingEnabled = await window.ipc.invoke('get-setting', 'debugLoggingEnabled');
          if (this.debugToggle) {
            this.debugToggle.checked = debugLoggingEnabled;
          }
        } catch (err) {
          console.warn("Error getting debugLoggingEnabled setting:", err);
          // Default to false
        }

        // Initialize DevTools toggle state
        try {
          const disableDevTools = await window.ipc.invoke('get-setting', 'disableDevTools');
          // Invert the checkbox state - checked means ENABLE (opposite of disable)
          if (this.disableDevToolsToggle) {
            this.disableDevToolsToggle.checked = !disableDevTools;
          }
        } catch (err) {
          console.warn("Error getting disableDevTools setting:", err);
          // Default to enabled
        }

        // Initialize UUID spoofer toggle state
        try {
          const uuidSpoofingEnabled = await window.ipc.invoke('get-setting', 'uuidSpoofingEnabled');
          if (this.uuidSpooferToggle) {
            this.uuidSpooferToggle.checked = uuidSpoofingEnabled;
            // Show warning if enabled
            if (uuidSpoofingEnabled && this.uuidSpoofingWarning) {
              this.uuidSpoofingWarning.classList.add('show');
            }
          }
        } catch (err) {
          console.warn("Error getting uuidSpoofingEnabled setting:", err);
          // Default to disabled
        }
      } catch (err) {
        console.error("Error in _initializeAsyncSettings:", err);
        // Continue with defaults
      }
    }

    // --- Game Language Setting Initialization ---
    async _initializeGameLanguageSetting() {
      try {
        // Load current setting
        const gameLanguage = await window.ipc.invoke('get-setting', 'gameLanguage');
        if (gameLanguage && globals && globals.setLanguage) {
          globals.setLanguage(gameLanguage);
        }
      } catch (error) {
        console.warn('[LoginScreen] Error initializing game language setting:', error);
        // Set default language (browser language or 'en')
        if (globals && globals.setLanguage) {
          const browserLang = navigator.language.split('-')[0];
          globals.setLanguage(browserLang || 'en');
        }
      }
    }

    // Add a new method to safely initialize settings with fallbacks
    async initializeSettings() {
      try {
        // Initialize debug logging with fallback
        let debugLoggingEnabled = false;
        try {
          debugLoggingEnabled = await window.ipc.invoke('get-setting', 'debugLoggingEnabled');
          console.log('[LoginScreen] Debug logging enabled:', debugLoggingEnabled);
        } catch (err) {
          console.warn('[LoginScreen] Error getting debugLoggingEnabled setting:', err);
          // Use fallback value (false)
        }

        // Initialize DevTools setting with fallback
        let disableDevTools = true; // Default to disabled
        try {
          disableDevTools = await window.ipc.invoke('get-setting', 'disableDevTools');
          console.log('[LoginScreen] Disable DevTools setting:', disableDevTools);
          
          // Update the UI if the tester is available
          if (this.testerDisableDevToolsToggle) {
            this.testerDisableDevToolsToggle.checked = !disableDevTools;
          }
        } catch (err) {
          console.warn('[LoginScreen] Error getting disableDevTools setting:', err);
          // Use fallback value (true)
        }

        // Initialize UUID spoofing with fallback
        let uuidSpoofingEnabled = false; // Default to disabled
        try {
          uuidSpoofingEnabled = await window.ipc.invoke('get-setting', 'uuidSpoofingEnabled');
          console.log('[LoginScreen] UUID spoofing enabled:', uuidSpoofingEnabled);
          
          // Update the UI if the tester is available
          if (this.testerUuidSpooferToggle) {
            this.testerUuidSpooferToggle.checked = uuidSpoofingEnabled;
            if (uuidSpoofingEnabled && this.uuidSpoofingWarning) {
              this.uuidSpoofingWarning.classList.add('show');
            }
          }
        } catch (err) {
          console.warn('[LoginScreen] Error getting uuidSpoofingEnabled setting:', err);
          // Use fallback value (false)
        }

        // Initialize game language setting with fallback
        try {
          const gameLanguage = await window.ipc.invoke('get-setting', 'gameLanguage');
          console.log('[LoginScreen] Game language setting:', gameLanguage);
          if (gameLanguage && globals && globals.setLanguage) {
            globals.setLanguage(gameLanguage);
          }
        } catch (err) {
          console.warn('[LoginScreen] Error initializing game language setting:', err);
          // Use default language (browser language or 'en')
          if (globals && globals.setLanguage) {
            const browserLang = navigator.language.split('-')[0];
            globals.setLanguage(browserLang || 'en');
          }
        }

        // Initialize additional settings as needed
        
      } catch (err) {
        console.error('[LoginScreen] Error in settings initialization:', err);
        // Continue with defaults
      }
    }

    // --- Core Login Methods ---
    // Removed customDf parameter - we will fetch it fresh each time
    async logIn(isRetry = false) { // Added async keyword
      if (!isRetry && this.loginBlocked) {
        return;
      }
      this.loginBlocked = true;

      try {
        this.usernameInputElem.error = "";
        this.passwordInputElem.error = "";

        let authResult;
        if (this.authToken) {
          authResult = await globals.authenticateWithAuthToken(this.authToken);
        } else if (this.refreshToken) {
          authResult = await globals.authenticateWithRefreshToken(this.refreshToken, this.otp);
        } else {
          if (!this.username.length) throw new Error("EMPTY_USERNAME");
          if (!this.password.length) throw new Error("EMPTY_PASSWORD");
          // Reverted: Rely on authenticate function in index.html to handle df fallback
          // It will use customDf (passed as null here) or globals.df
          authResult = await globals.authenticateWithPassword(this.username, this.password, this.otp, null); 
        }
        this.otp = null;
        const {userData, flashVars} = authResult;
        // Fetch the currently selected game language setting using window.ipc (assuming preload exposes it)
        const langSettingResult = await window.ipc.invoke('get-setting', 'gameLanguage'); // Reverted to window.ipc
        const selectedLanguage = (langSettingResult && langSettingResult.value) ? langSettingResult.value : 'en'; // Default to 'en'

        const data = {
          username: userData.username,
          authToken: userData.authToken,
          refreshToken: userData.refreshToken,
          accountType: userData.accountType,
          language: selectedLanguage, // Use the selected language from settings
          rememberMe: this.rememberMeElem.value,
        };
        if (userData.authToken) this.authToken = userData.authToken;
        if (userData.refreshToken) this.refreshToken = userData.refreshToken;
        console.log('[LoginScreen] Login successful, sending loginSucceeded IPC with data:', data); // Add log here
        window.ipc.send("loginSucceeded", data);


        this.dispatchEvent(new CustomEvent("loggedIn", {detail: {flashVars}}));
        // loginBlocked = false handled below
      } catch (err) {

        if (err.message) {
          switch (err.message) {
            case "SUSPENDED": this.usernameInputElem.error = await globals.translate("userSuspended"); break;
            case "BANNED": this.usernameInputElem.error = await globals.translate("userBanned"); break;
            case "LOGIN_ERROR": this.usernameInputElem.error = await globals.translate("loginError"); break;
            case "WRONG_CREDENTIALS": this.passwordInputElem.error = await globals.translate("wrongCredentials"); break;
            case "EMPTY_USERNAME": this.usernameInputElem.error = await globals.translate("usernameRequired"); break;
            case "EMPTY_PASSWORD": this.passwordInputElem.error = await globals.translate("emptyPassword"); break;
            case "USER_RENAME_NEEDED": /* handled by modal */ break;
            case "OTP_NEEDED": /* handled by modal */ break;
            case "RATE_LIMITED": this.passwordInputElem.error = "Rate limited. Try again later."; break; // Keep UI error message
            case "AUTH_TOKEN_EXPIRED":
              this.clearAuthToken();
              if (this.canRetry()) setTimeout(() => this.logIn(true), 1000);
              else { this.isFakePassword = false; this.password = ""; }
              break;
            case "REFRESH_TOKEN_EXPIRED":
              this.clearRefreshToken();
              if (this.canRetry()) setTimeout(() => this.logIn(true), 1000);
              else { this.isFakePassword = false; this.password = ""; }
              break;
            default:
              globals.reportError("webClient", `Error logging in: ${err.stack || err.message}`);
              if (err.name != "Aborted") window.alert("Something went wrong :(");
              break;
          }
        } else {
          globals.reportError("webClient", `Error logging in: ${err}`);
          if (err.name != "Aborted") window.alert("Something went wrong :(");
        }
        // Only unblock if it wasn't an OTP error (modal handles OTP)
        // Moved this check from finally block to ensure 'err' is defined
        if (err?.message !== "OTP_NEEDED") {
             this.loginBlocked = false;
        }
      } finally {
        // Code that needs to run regardless of success/error, but doesn't depend on 'err'
        // If loginBlocked wasn't set to false in the catch block (due to OTP),
        // it remains true here, which is correct. If it was set to false, it stays false.
      }
    }

    canRetry() {
      return (this.authToken !== null || this.refreshToken !== null ||
        (this.username && this.password && !this.isFakePassword));
    }

    get loginBlocked() {
      // Check if elements exist before accessing disabled property
      const loginButtonDisabled = this.logInButtonElem ? this.logInButtonElem.disabled : true;
      const createAccountDisabled = this.createAccountElem ? this.createAccountElem.disabled : true;
      return loginButtonDisabled || createAccountDisabled;
    }

    set loginBlocked(val) {
       // Check if elements exist before setting disabled property
      if (this.logInButtonElem) this.logInButtonElem.disabled = val;
      if (this.createAccountElem) this.createAccountElem.disabled = val;
      if (this.loginSpinnerElem) {
          if (val) {
              this.loginSpinnerElem.classList.add("show");
          } else {
              // Use a shorter delay for removing spinner visually
              setTimeout(() => {
                  if (this.loginSpinnerElem) this.loginSpinnerElem.classList.remove("show");
              }, 250);
          }
      }
      // Clear abort controller only if unblocking
      if (!val && globals.currentAbortController) {
          console.log('[LoginScreen] Clearing AbortController in loginBlocked setter.');
          globals.currentAbortController = null;
      }
    }

    get username() { return this.usernameInputElem.value; }
    set username(val) { this.usernameInputElem.value = val; }
    get password() { return this.passwordInputElem.value; }
    set password(val) { this.passwordInputElem.value = val; }
    get isFakePassword() { return this._isFakePassword; }
    set isFakePassword(val) {
      this._isFakePassword = val;
      if (val) this.password = "FAKE_PASSWORD";
    }
    get rememberMe() { return this.rememberMeElem.value; }
    set rememberMe(val) { this.rememberMeElem.value = val; }
    get version() { return this._version; }
    set version(val) {
      this._version = val;
      this.versionLinkElem.innerHTML = `v${val}`;
    }
    setProgress(progress) {
      if (progress === null) {
        this.versionStatusIconElem.setAttribute("progress", 0);
        this.version = this._version;
      } else {
        this.versionStatusIconElem.setAttribute("progress", progress);
        this.versionLinkElem.innerHTML = `${progress}%`;
      }
    }
    get otp() { return this._otp; }
    set otp(val) { this._otp = val; }
    get authToken() { return this._authToken; }
    set authToken(val) { this._authToken = val; }
    clearAuthToken() {
      this.authToken = null;
      window.ipc.send("clearAuthToken");
    }
    get refreshToken() { return this._refreshToken; }
    set refreshToken(val) { this._refreshToken = val; }
    clearRefreshToken() {
      this.refreshToken = null;
      window.ipc.send("clearRefreshToken");
    }

    async localize() {
      this.usernameInputElem.placeholder = await globals.translate("username");
      this.passwordInputElem.placeholder = await globals.translate("password");
      this.rememberMeElem.text = await globals.translate("rememberMeText");
      this.logInButtonElem.text = await globals.translate("login");
      this.forgotPasswordLinkElem.innerText = await globals.translate("forgotPassword");
      this.needAccountElem.innerText = await globals.translate("needAccount");
      this.createAccountElem.text = await globals.translate("createAccount");
      this.playerLoginTextElem.innerText = await globals.translate("playerLogin");
      this.playerLoginTextElem.style.fontSize = `${Math.min(646 / this.playerLoginTextElem.innerText.length, 36)}px`;
    }



  });
})();
