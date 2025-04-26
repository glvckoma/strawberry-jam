/**
 * TFD Automator Plugin Logic
 */

// Wait for the dispatch object to be ready
function waitForDispatch(callback) {
    if (window.jam && window.jam.dispatch) {
        callback();
    } else {
        console.log('TFD Automator: Waiting for dispatch...');
        setTimeout(() => waitForDispatch(callback), 100); // Check again shortly
    }
}

// --- Global Variables ---
let packets = [];
let isAutomating = false;
let isPaused = false; // Added pause state
let currentPacketIndex = 0;
let timeoutId = null;
let currentSpeed = 500; // Default speed in ms
let crystalPacketCounts = { yellow: 0, green: 0, white: 0, blue: 0 }; // Store counts per crystal
let currentCrystalProgress = { yellow: 0, green: 0, white: 0, blue: 0 }; // Store current progress
let autoStartEnabled = false; // Auto-start flag

// --- UI Elements ---
let autoStartCheck;
// Controls
let startButton;
let stopButton;
let loadButton;
let pauseButton;
let speedSlider;
let speedValueDisplay;
// Crystal Progress
let progressGreen, progressYellow, progressBlue, progressGrey;
let progressTextGreen, progressTextYellow, progressTextBlue, progressTextGrey;
// Status
let statusIcon;
let statusText1;
let statusText2;
// Activity Log
let activityLog;

// --- Core Functions ---

/**
 * Extracts a readable identifier from the packet content.
 * Example: "%xt%o%qat%{room}%1crystal_05a%0%" -> "crystal_05a"
 * @param {string} packetContent The raw packet string.
 * @returns {string} A readable identifier or 'Unknown Packet'.
 */
function getPacketIdentifier(packetContent) {
    try {
        const parts = packetContent.split('%');
        
        // Look for specific packet types in order:
        
        // Crystal packets (1crystal_, 2crystal_, 3crystal_, 4crystal_)
        const crystalPart = parts.find(part => /^[1234]crystal_\d+[ab]$/.test(part));
        if (crystalPart) return crystalPart;
        
        // Pail/water packets
        const pailPart = parts.find(part => /^3pail_\d+[e]$/.test(part));
        if (pailPart) return pailPart;
        
        const waterPart = parts.find(part => /^3water_\d+[ab]$/.test(part));
        if (waterPart) return waterPart;
        
        // Socvol (cactus) packets
        const socvolPart = parts.find(part => /^4socvol/.test(part));
        if (socvolPart) return socvolPart;
        
    } catch (error) {
        console.error('TFD Automator: Error parsing packet identifier:', error);
    }
    return 'Unknown Packet';
}


/**
 * Sends the next packet in the sequence.
 */
function sendNextPacket() {
    // Don't proceed if paused or not automating
    if (isPaused || !isAutomating) return;

    const totalPackets = packets.length;
    if (currentPacketIndex >= totalPackets) {
        // Sequence completed
        isAutomating = false;
        updateStatus('Completed', 'All packets processed', 'success');
        logActivity('Automation sequence completed');
        
        // Reset UI
        startButton.disabled = false;
        stopButton.disabled = true;
        pauseButton.disabled = true;
        loadButton.disabled = false;
        speedSlider.disabled = false;
        currentPacketIndex = 0;
        return;
    }

    try {
        const packetInfo = packets[currentPacketIndex];
        
        // Get room ID using multiple fallback methods
        let roomId;
        try {
            // First try the synchronous method (preferred)
            if (window.jam.dispatch.getStateSync) {
                roomId = window.jam.dispatch.getStateSync('room');
            }
            // Fall back to state property if available
            if (!roomId && window.jam.state) {
                roomId = window.jam.state.room;
            }
            // Fall back to async getState if needed
            if (!roomId && window.jam.dispatch.getState) {
                roomId = window.jam.dispatch.getState('room');
            }
            
            if (!roomId) {
                throw new Error('Room ID not available');
            }
        } catch (error) {
            throw new Error('Failed to get room ID: ' + error.message);
        }

        // Prepare packet content
        const packetContent = packetInfo.content.replace('{room}', roomId);
        const packetIdentifier = getPacketIdentifier(packetContent);

        // Send packet based on type (remote or connection)
        if (packetContent.startsWith('%xt%')) {
            // Animal Jam packet (remote)
            window.jam.dispatch.sendRemoteMessage(packetContent);
        } else {
            // Connection packet
            window.jam.dispatch.sendConnectionMessage(packetContent);
        }

        // Update crystal progress if applicable
        const crystalType = getCrystalType(packetIdentifier);
        if (crystalType) {
            currentCrystalProgress[crystalType]++;
            updateCrystalProgress(
                crystalType,
                currentCrystalProgress[crystalType],
                crystalPacketCounts[crystalType]
            );
        }

        // Update status with friendly message and calculate timing for next packet
        const usePacketDelay = currentSpeed === 500;
        const originalDelay = parseFloat(packetInfo.delay) * 1000;
        const actualDelay = usePacketDelay ? originalDelay : currentSpeed;
        
        updateStatus(
            getFriendlyActionName(packetIdentifier, crystalType),
            `Packet ${currentPacketIndex + 1}/${totalPackets} ${usePacketDelay ? 
                `(${originalDelay}ms delay)` : 
                `(Speed: ${currentSpeed}ms)`}`,
            'loading'
        );
        logActivity(`Sent packet: ${packetIdentifier}`);

        // Move to next packet and schedule next packet
        currentPacketIndex++;
        logActivity(`Next packet in ${actualDelay}ms (${usePacketDelay ? 'packet delay' : 'speed setting'})`);
        timeoutId = setTimeout(sendNextPacket, actualDelay);

    } catch (error) {
        console.error('TFD Automator:', error);
        updateStatus('Error', error.message, 'error');
        logActivity(`Error: ${error.message}`);
        handleStop(); // Stop automation on error
    }
}

/**
 * Classifies which crystal type a packet is targeting.
 * @param {string} identifier The packet identifier from getPacketIdentifier
 * @returns {'yellow'|'green'|'white'|'blue'|null} The crystal type or null if not a crystal.
 */
function getCrystalType(identifier) {
    // Yellow Diamond Gems (2crystal_)
    if (identifier.startsWith('2crystal_')) {
        return 'yellow';
    }
    
    // Green Hexagon Gems (1crystal_)
    if (identifier.startsWith('1crystal_')) {
        return 'green';
    }
    
    // White Triangle Gems (4socvol or 4crystal_)
    if (identifier.startsWith('4socvol') || identifier.startsWith('4crystal_')) {
        return 'white';
    }
    
    // Blue Square Gems (3pail_, 3water_, 3crystal_)
    if (identifier.startsWith('3pail_') || 
        identifier.startsWith('3water_') || 
        identifier.startsWith('3crystal_')) {
        return 'blue';
    }
    
    return null;
}

/**
 * Gets a user-friendly action message for the current packet
 */
function getFriendlyActionName(identifier) {
    // Yellow Diamond
    if (identifier.startsWith('2crystal_')) {
        return 'Grabbing Yellow Diamond';
    }
    // Green Hexagon
    if (identifier.startsWith('1crystal_')) {
        return 'Grabbing Green Hexagon';
    }
    // White Triangle
    if (identifier.startsWith('4socvol')) {
        return 'Activating White Triangle';
    }
    if (identifier.startsWith('4crystal_')) {
        return 'Collecting White Triangle';
    }
    // Blue Square
    if (identifier.startsWith('3pail_')) {
        return 'Getting Water Pail';
    }
    if (identifier.startsWith('3water_')) {
        return 'Watering with Pail';
    }
    if (identifier.startsWith('3crystal_')) {
        return 'Grabbing Blue Square';
    }
    return `Processing: ${identifier}`;
}

/**
 * Handles room changes to auto-start when entering TFD
 */
function handleRoomChange(roomId) {
    if (!autoStartEnabled || isAutomating) return;
    
    // Check if this is a TFD adventure room
    if (roomId && roomId.startsWith('adventures.room_adventure_8')) {
        logActivity('TFD Adventure room detected, auto-starting in 1 second...');
        setTimeout(() => {
            handleStart();
        }, 1000);
    }
}

/**
 * Updates the progress display for a specific crystal type.
 * @param {string} type The crystal type ('green', 'yellow', 'blue', 'grey')
 * @param {number} current Current progress
 * @param {number} total Total packets for this crystal
 */
function updateCrystalProgress(type, current, total) {
    // Map the progress bars (using existing UI elements)
    const progressBar = {
        'yellow': progressYellow,
        'green': progressGreen,
        'white': progressGrey, // Using grey element for white gems
        'blue': progressBlue
    }[type];

    // Map the text elements (using existing UI elements)
    const progressText = {
        'yellow': progressTextYellow,
        'green': progressTextGreen,
        'white': progressTextGrey, // Using grey element for white gems
        'blue': progressTextBlue
    }[type];

    if (progressBar && progressText) {
        const percent = Math.round((current / total) * 100);
        const prevWidth = progressBar.style.width;
        const newWidth = `${percent}%`;

        // Only animate if there's an actual change
        if (prevWidth !== newWidth) {
            // Update width and percentage text
            progressBar.style.width = newWidth;
            progressBar.textContent = `${percent}%`;
            // Set data attribute for hover display
            progressBar.setAttribute('data-percent', `${percent}%`);
            // Update count display
            progressText.textContent = `${current}/${total}`;
            
            // Add shimmer effect
            progressBar.classList.add('updating');
            setTimeout(() => {
                progressBar.classList.remove('updating');
            }, 500); // Match animation duration
        }
    }
}

/**
 * Updates the status display and icon.
 * @param {string} message Primary status message
 * @param {string} [submessage] Secondary status message
 * @param {'success'|'error'|'loading'|'warning'} [type='success'] Status type
 */
function updateStatus(message, submessage = '', type = 'success') {
    if (statusText1) statusText1.textContent = message;
    if (statusText2) statusText2.textContent = submessage;
    if (statusIcon) {
        statusIcon.className = 'fas ' + {
            'success': 'fa-check-circle text-highlight-green',
            'error': 'fa-times-circle text-error-red',
            'loading': 'fa-sync fa-spin text-highlight-blue',
            'warning': 'fa-exclamation-circle text-highlight-yellow'
        }[type];
    }
}

/**
 * Handles starting the automation sequence.
 */
function handleStart() {
    if (packets.length === 0) {
        updateStatus('Error: No packets loaded', 'Please load TFD first', 'error');
        logActivity('Cannot start: No packets loaded');
        return;
    }

    isAutomating = true;
    isPaused = false;
    currentPacketIndex = 0;
    
    // Reset all progress
    Object.keys(currentCrystalProgress).forEach(type => {
        currentCrystalProgress[type] = 0;
        updateCrystalProgress(type, 0, crystalPacketCounts[type]);
    });

    // Update UI
    startButton.disabled = true;
    stopButton.disabled = false;
    pauseButton.disabled = false;
    loadButton.disabled = true;
    speedSlider.disabled = true;

    // Show initial status with timing info
    const usePacketDelays = currentSpeed === 500;
    const timingInfo = usePacketDelays ? 
        'Using original packet delays' : 
        `Using fixed speed: ${currentSpeed}ms`;
    
    updateStatus('Running...', timingInfo, 'loading');
    logActivity(`Starting automation sequence (${timingInfo})`);
    
    sendNextPacket();
}

/**
 * Handles stopping the automation sequence.
 */
function handleStop() {
    isAutomating = false;
    isPaused = false;
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }

    // Update UI
    startButton.disabled = false;
    stopButton.disabled = true;
    pauseButton.disabled = true;
    loadButton.disabled = false;
    speedSlider.disabled = false;
    pauseButton.innerHTML = '<i class="fas fa-pause mr-2"></i>Pause';

    updateStatus('Stopped', 'Automation stopped by user', 'warning');
    logActivity('Automation stopped by user');
}

/**
 * Handles pausing/resuming the automation sequence.
 */
function handlePauseResume() {
    if (isPaused) {
        // Resume
        isPaused = false;
        pauseButton.innerHTML = '<i class="fas fa-pause mr-2"></i>Pause';
        
        // Show timing mode in status
        const usePacketDelays = currentSpeed === 500;
        const timingInfo = usePacketDelays ? 
            'Using original packet delays' : 
            `Using fixed speed: ${currentSpeed}ms`;
        
        updateStatus('Running...', timingInfo, 'loading');
        logActivity(`Automation resumed (${timingInfo})`);
        
        // Clear any existing timeout
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        
        // Send next packet immediately instead of waiting for remaining delay
        sendNextPacket();
    } else {
        // Pause
        isPaused = true;
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        pauseButton.innerHTML = '<i class="fas fa-play mr-2"></i>Resume';
        updateStatus('Paused', 'Click Resume to continue', 'warning');
        logActivity('Automation paused');
    }
}

/**
 * Handles loading/reloading the TFD packet sequence.
 */
async function handleLoadTFD() {
    try {
        updateStatus('Loading...', 'Fetching packet data', 'loading');
        logActivity('Loading TFD packet sequence...');
        
        const response = await fetch('tfd-packets.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        packets = await response.json();
        
        // Count packets per crystal type
        crystalPacketCounts = { yellow: 0, green: 0, white: 0, blue: 0 };
        packets.forEach(packet => {
            const identifier = getPacketIdentifier(packet.content);
            const type = getCrystalType(identifier);
            if (type) {
                crystalPacketCounts[type]++;
                logActivity(`Found ${type} crystal packet: ${identifier}`);
            }
        });
        
        // Log final counts
        Object.entries(crystalPacketCounts).forEach(([type, count]) => {
            logActivity(`Total ${type} crystal packets: ${count}`);
        });

        // Update UI with counts
        Object.keys(crystalPacketCounts).forEach(type => {
            updateCrystalProgress(type, 0, crystalPacketCounts[type]);
        });

        updateStatus('Ready', `Loaded ${packets.length} packets`, 'success');
        logActivity(`Successfully loaded ${packets.length} packets`);
        startButton.disabled = false;
        
    } catch (error) {
        console.error('TFD Automator: Failed to load packets:', error);
        updateStatus('Error', 'Failed to load packets', 'error');
        logActivity(`Error loading packets: ${error.message}`);
        packets = [];
        startButton.disabled = true;
    }
}

/**
 * Adds a timestamped message to the activity log.
 * @param {string} message The message to log.
 */
function logActivity(message) {
    if (!activityLog) return;
    const timestamp = new Date().toLocaleTimeString();
    activityLog.value += `[${timestamp}] ${message}\n`;
    activityLog.scrollTop = activityLog.scrollHeight; // Auto-scroll to bottom
}

/**
 * Initializes the plugin UI and logic.
 */
function initialize() {
    console.log('TFD Automator: Initializing...');
    logActivity("Initializing plugin...");

    // Get Control Elements
    startButton = document.getElementById('startButton');
    stopButton = document.getElementById('stopButton');
    loadButton = document.getElementById('loadButton');
    pauseButton = document.getElementById('pauseButton');
    speedSlider = document.getElementById('speedSlider');
    speedValueDisplay = document.getElementById('speedValue');

    // Get Crystal Progress Elements
    progressGreen = document.getElementById('progressGreen');
    progressTextGreen = document.getElementById('progressTextGreen');
    progressYellow = document.getElementById('progressYellow');
    progressTextYellow = document.getElementById('progressTextYellow');
    progressBlue = document.getElementById('progressBlue');
    progressTextBlue = document.getElementById('progressTextBlue');
    progressGrey = document.getElementById('progressGrey');
    progressTextGrey = document.getElementById('progressTextGrey');

    // Get Status Elements
    statusIcon = document.getElementById('statusIcon');
    statusText1 = document.getElementById('statusText1');
    statusText2 = document.getElementById('statusText2');

    // Get Activity Log Element
    activityLog = document.getElementById('activityLog');
    
    // Get Auto Start Checkbox
    autoStartCheck = document.getElementById('autoStartCheck');

    // Basic check if elements exist
    if (!startButton || !stopButton || !loadButton || !pauseButton || !speedSlider || !activityLog || !autoStartCheck) {
        console.error('TFD Automator: Critical UI elements not found!');
        logActivity("Error: Critical UI elements missing. Cannot initialize.");
        if(statusText1) statusText1.textContent = "Initialization Error";
        if(statusText2) statusText2.textContent = "UI elements missing.";
        return;
    }

    // Add Event Listeners
    startButton.addEventListener('click', handleStart);
    stopButton.addEventListener('click', handleStop);
    pauseButton.addEventListener('click', handlePauseResume);
    loadButton.addEventListener('click', handleLoadTFD);

    speedSlider.addEventListener('input', () => {
        currentSpeed = parseInt(speedSlider.value, 10);
        speedValueDisplay.textContent = `${currentSpeed}ms`;
        logActivity(`Speed set to ${currentSpeed}ms`);
    });

    // Set initial speed display
    currentSpeed = parseInt(speedSlider.value, 10);
    speedValueDisplay.textContent = `${currentSpeed}ms`;

    // Add auto-start listener
    autoStartCheck.addEventListener('change', (e) => {
        autoStartEnabled = e.target.checked;
        logActivity(`Auto-start ${autoStartEnabled ? 'enabled' : 'disabled'}`);
    });

    // Listen for room changes
    if (window.jam && window.jam.dispatch && window.jam.dispatch.on) {
        window.jam.dispatch.on('room', handleRoomChange);
        logActivity("Room change listener initialized");
    }

    // Disable buttons initially
    stopButton.disabled = true;
    pauseButton.disabled = true;
    startButton.disabled = true;

    handleLoadTFD(); // Load packets
    logActivity("Initialization complete.");
}

// --- Initialization ---
waitForDispatch(initialize);
