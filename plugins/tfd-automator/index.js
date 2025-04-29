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
let fullAutomationEnabled = false; // Full automation toggle
let currentAutomationPhase = 'none'; // Tracks which phase we're in (join, gems, rewards, leave)
let fullAutomationCycles = 0; // Number of completed cycles
let currentUserId = null; // Will store the current user's ID
let currentDenId = null; // Will store the current user's den ID
let loggedInUserId = null; // Store the confirmed logged-in user's ID
let isReady = false; // Flag to indicate if plugin is ready (user in den)

// --- Predefined Packet Sequences - these will be populated dynamically ---
let joinTfdPackets = [];
let startTfdPackets = [];
let collectRewardsPackets = [];
let leaveTfdPackets = [];

/**
 * Initialize the packet templates with dynamic user values
 * ASSUMES currentUserId and currentDenId are correctly set globally
 * before this function is called by the packet listener.
 */
function initializePacketTemplates() {
    // User ID and den check are now done in handleJoinRoom before calling this

    logActivity(`Initializing templates for User ID: ${currentUserId}`);
    logActivity(`Using Den ID: ${currentDenId}`);

    // Now initialize the packet templates with these values
    joinTfdPackets = [
        { type: "aj", content: "%xt%o%rc%{room}%", delay: "1.0" },
        { type: "aj", content: "%xt%o%gl%{room}%201%", delay: "1.0" },
        { type: "aj", content: `%xt%o%qjc%{room}%${currentDenId}%23%0%`, delay: "1.0" },
        { type: "connection", content: "<msg t=\"sys\"><body action=\"pubMsg\" r=\"{room}\"><txt><![CDATA[on%11]]></txt></body></msg>", delay: "1.0" }
    ];

    startTfdPackets = [
        { type: "aj", content: `%xt%o%qs%{room}%${currentDenId}%`, delay: "1.0" },
        { type: "connection", content: "<msg t=\"sys\"><body action=\"pubMsg\" r=\"{room}\"><txt><![CDATA[off%11]]></txt></body></msg>", delay: "1.0" },
        { type: "aj", content: "%xt%o%qmi%{room}%", delay: "1.0" },
        { type: "aj", content: "%xt%o%au%{room}%1%111%5544%14%0%", delay: "1.0" },
        { type: "aj", content: "%xt%o%gl%{room}%47%", delay: "0.5" },
        { type: "aj", content: "%xt%o%gl%{room}%66%", delay: "0.5" },
        { type: "aj", content: "%xt%o%gl%{room}%158%", delay: "0.5" },
        { type: "aj", content: "%xt%o%gl%{room}%170%", delay: "0.5" },
        { type: "aj", content: "%xt%o%gl%{room}%333%", delay: "0.5" }
    ];

    // Updated treasure collection packets based on actual observed TFD packets
    collectRewardsPackets = [
        // TFD uses qpgift for treasures
        { type: "aj", content: "%xt%o%qpgift%{room}%0%0%0%", delay: "0.8" },
        { type: "aj", content: "%xt%o%qpgift%{room}%1%0%0%", delay: "0.8" },
        { type: "aj", content: "%xt%o%qpgift%{room}%2%0%0%", delay: "0.8" },
        { type: "aj", content: "%xt%o%qpgift%{room}%3%0%0%", delay: "0.8" },
        // Final "done" packet to complete the treasure collection
        { type: "aj", content: "%xt%o%qpgiftdone%{room}%1%", delay: "1.0" }
    ];

    leaveTfdPackets = [
        { type: "aj", content: "%xt%o%qx%{room}%%", delay: "1.0" },
        { type: "aj", content: "%xt%o%au%{room}%1%221%1275%14%0%", delay: "1.0" },
        { type: "aj", content: `%xt%o%wt%{room}%${currentUserId}%`, delay: "1.0" },
        { type: "aj", content: "%xt%o%au%{room}%2%259%1307%643%1331%14%0%", delay: "1.0" },
        { type: "aj", content: "%xt%o%au%{room}%1%715%1403%14%0%", delay: "1.0" }
    ];
}

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
// Full Automation Status
let fullAutoStatus;
let currentPhaseText;
let cycleCountText;
let automationProgress;
// Full automation toggle
let fullAutoToggle;
let fullAutoText;
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
        
        // TFD Treasure packets
        if (parts.includes('qpgift')) {
            // Extract gift number if available
            const giftNumIndex = parts.indexOf('qpgift') + 2;
            if (parts.length > giftNumIndex && !isNaN(parseInt(parts[giftNumIndex]))) {
                return `tfd-treasure-${parts[giftNumIndex]}`;
            }
            return 'tfd-treasure';
        }
        
        if (parts.includes('qpgiftdone')) {
            return 'tfd-treasure-done';
        }
        
        // Treasure packets (adventure plugin style)
        const treasurePart = parts.find(part => /^treasure_\d+$/.test(part));
        if (treasurePart) {
            // Check if this is a spawn or claim packet
            if (parts.includes('qat')) {
                return `spawn-${treasurePart}`;
            } else if (parts.includes('qatt')) {
                return `claim-${treasurePart}`;
            }
            return treasurePart;
        }
        
        // Check for common packet types by command
        if (parts.includes('qx')) {
            return 'leave-adventure';
        }
        
        if (parts.includes('qjc')) {
            return 'join-adventure';
        }
        
        if (parts.includes('qs')) {
            return 'start-adventure';
        }
        
    } catch (error) {
        console.error('TFD Automator: Error parsing packet identifier:', error);
    }
    return 'Unknown Packet';
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
    
    // TFD Treasure chests
    if (identifier.startsWith('tfd-treasure-')) {
        if (identifier === 'tfd-treasure-done') {
            return 'Completing Treasure Collection';
        }
        const treasureNum = identifier.split('-')[2];
        return `Opening TFD Treasure Chest ${treasureNum}`;
    }
    
    // Regular Adventure treasure packets
    if (identifier.startsWith('spawn-treasure_')) {
        const treasureNum = identifier.split('_')[1];
        return `Spawning Treasure Chest ${treasureNum}`;
    }
    if (identifier.startsWith('claim-treasure_')) {
        const treasureNum = identifier.split('_')[1];
        return `Claiming Treasure Chest ${treasureNum}`;
    }
    
    // Adventure flow packets
    if (identifier === 'treasure-chest') {
        return 'Collecting Treasure Chest';
    }
    if (identifier === 'leave-adventure') {
        return 'Leaving Adventure';
    }
    if (identifier === 'join-adventure') {
        return 'Joining Adventure';
    }
    if (identifier === 'start-adventure') {
        return 'Starting Adventure';
    }
    
    return `Processing: ${identifier}`;
}

/**
 * Sends the next packet in the sequence.
 */
function sendNextPacket() {
    // Don't proceed if paused or not automating OR if not ready
    if (isPaused || !isAutomating || !isReady) return;

    const totalPackets = packets.length;
    if (currentPacketIndex >= totalPackets) {
        // Sequence completed
        isAutomating = false;
        updateStatus('Phase Completed', `Completed ${currentAutomationPhase} phase`, 'success');
        logActivity(`Automation phase completed: ${currentAutomationPhase}`);
        
        // Reset UI for non-full-automation
        if (!fullAutomationEnabled) {
        startButton.disabled = false;
        stopButton.disabled = true;
        pauseButton.disabled = true;
        loadButton.disabled = false;
        speedSlider.disabled = false;
        currentPacketIndex = 0;
        } else {
            // Move to next phase if in full automation mode
            handlePhaseCompletion();
        }
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
                // If we still can't get room ID, use a default value of the current user's den ID
                // This ensures packets work even with missing room ID
                roomId = "denK06e4744"; // Default fallback
                logActivity(`Warning: Using fallback room ID: ${roomId}`);
            } else {
                logActivity(`Using room ID: ${roomId} for packet`);
            }
        } catch (error) {
            throw new Error('Failed to get room ID: ' + error.message);
        }

        // Prepare packet content
        const packetContent = packetInfo.content.replace(/{room}/g, roomId);
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
            getFriendlyActionName(packetIdentifier),
            `Packet ${currentPacketIndex + 1}/${totalPackets} ${usePacketDelay ? 
                `(${originalDelay}ms delay)` : 
                `(Speed: ${currentSpeed}ms)`}`,
            'loading'
        );
        logActivity(`Sent packet: ${packetIdentifier || 'System packet'}`);

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
 * Handles room changes to auto-start when entering TFD
 */
function handleRoomChange(roomId) {
    // Don't auto-start based on room change anymore
    // This is now controlled by the Start button
    return;
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
    // Add check if the plugin is ready (user confirmed in den)
    if (!isReady) {
        updateStatus('Error', 'Must be in den to start', 'error');
        logActivity('Cannot start: User not confirmed in den.');
        return;
    }
    if (packets.length === 0 && !fullAutomationEnabled) {
        updateStatus('Error: No packets loaded', 'Please load TFD first', 'error');
        logActivity('Cannot start: No packets loaded');
        return;
    }

    isAutomating = true;
    isPaused = false;
    
    // If full automation is enabled, start with the join phase
    if (fullAutomationEnabled) {
        // Start the full automation sequence from the beginning
        currentAutomationPhase = 'none';
        startAutomationPhase('join');
        return;
    }
    
    // Otherwise proceed with normal single-phase automation
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
    isReady = false; // Reset ready state on stop
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }

    // Update UI
    startButton.disabled = true; // Disable start until user re-enters den
    stopButton.disabled = true;
    pauseButton.disabled = true;
    loadButton.disabled = false;
    speedSlider.disabled = false;
    pauseButton.innerHTML = '<i class="fas fa-pause mr-2"></i>Pause';

    // Reset status to indicate need to enter den
    updateStatus('Stopped', 'Please enter your den', 'warning');
    logActivity('Automation stopped by user. Please re-enter den to enable start.');

    // Reset full automation status if needed
    if (fullAutomationEnabled) {
        currentAutomationPhase = 'none';
        updateFullAutomationStatus();
    }
}

/**
 * Handles pausing/resuming the automation sequence.
 */
function handlePauseResume() {
    // Ensure plugin is ready before allowing resume
    if (!isReady && !isPaused) return;
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
        startButton.disabled = true;
        
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
 * Updates the full automation status UI
 */
function updateFullAutomationStatus() {
    // Only show full automation status when enabled
    if (fullAutomationEnabled) {
        fullAutoStatus.classList.remove('hidden');
        
        // Update cycle count
        cycleCountText.textContent = fullAutomationCycles;
        
        // Update current phase with friendly name
        let phaseName = 'None';
        let progressPercent = 0;
        
        switch(currentAutomationPhase) {
            case 'join':
                phaseName = 'Joining Adventure';
                progressPercent = 10;
                break;
            case 'start':
                phaseName = 'Starting TFD';
                progressPercent = 20;
                break;
            case 'gems':
                phaseName = 'Collecting Gems';
                progressPercent = 50;
                break;
            case 'rewards':
                phaseName = 'Opening Chests';
                progressPercent = 80;
                break;
            case 'leave':
                phaseName = 'Exiting Adventure';
                progressPercent = 90;
                break;
            case 'none':
            default:
                phaseName = 'Waiting';
                progressPercent = 0;
                break;
        }
        
        currentPhaseText.textContent = phaseName;
        automationProgress.style.width = `${progressPercent}%`;
    } else {
        fullAutoStatus.classList.add('hidden');
    }
}

/**
 * Handles enabling/disabling full automation
 */
function handleFullAutomationToggle() {
    fullAutomationEnabled = !fullAutomationEnabled;

    if (fullAutomationEnabled) {
        logActivity('Full automation mode enabled - Enter den to begin');
        fullAutomationCycles = 0;
        // Update UI
        fullAutoToggle.classList.add('active');
        fullAutoText.textContent = 'Full Auto: ON';
        updateFullAutomationStatus();
        // Keep start button disabled until den confirmed
        startButton.disabled = true;
    } else {
        logActivity('Full automation mode disabled');
        handleStop(); // Stop current automation and reset state
        // Update UI
        fullAutoToggle.classList.remove('active');
        fullAutoText.textContent = 'Full Auto: OFF';
        updateFullAutomationStatus();
    }
}

/**
 * Starts a new phase of the full automation process
 * @param {string} phase - The phase to start ('join', 'start', 'gems', 'rewards', 'leave')
 */
function startAutomationPhase(phase) {
    if (!fullAutomationEnabled || isPaused || !isReady) return; // Also check isReady
    
    currentAutomationPhase = phase;
    let phasePackets = [];
    
    switch(phase) {
        case 'join': 
            logActivity(`Starting automation cycle #${fullAutomationCycles + 1} - Joining TFD`);
            updateStatus('Joining TFD', 'Opening adventure map', 'loading');
            phasePackets = joinTfdPackets;
            break;
        case 'start':
            logActivity(`Starting TFD adventure`);
            updateStatus('Starting Adventure', 'Initializing TFD session', 'loading');
            phasePackets = startTfdPackets;
            break;
        case 'gems':
            logActivity(`Collecting gems in TFD`);
            updateStatus('Collecting Gems', 'Starting gem collection', 'loading');
            
            // Load gem packets directly instead of using handleLoadTFD
            try {
                const loadGemPackets = async () => {
                    try {
                        const response = await fetch('tfd-packets.json');
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        
                        const gemPackets = await response.json();
                        
                        // Count packets per crystal type
                        crystalPacketCounts = { yellow: 0, green: 0, white: 0, blue: 0 };
                        gemPackets.forEach(packet => {
                            const identifier = getPacketIdentifier(packet.content);
                            const type = getCrystalType(identifier);
                            if (type) {
                                crystalPacketCounts[type]++;
                            }
                        });
                        
                        // Reset crystal progress
                        Object.keys(currentCrystalProgress).forEach(type => {
                            currentCrystalProgress[type] = 0;
                            updateCrystalProgress(type, 0, crystalPacketCounts[type]);
                        });
                        
                        // Start gem collection with loaded packets
                        packets = gemPackets;
                        currentPacketIndex = 0;
                        isAutomating = true;
                        
                        // UI updates
                        startButton.disabled = true;
                        stopButton.disabled = false;
                        pauseButton.disabled = false;
                        loadButton.disabled = true;
                        speedSlider.disabled = true;
                        
                        // Update full automation status
                        updateFullAutomationStatus();
                        
                        // Start sending packets
                        sendNextPacket();
                        
                    } catch (error) {
                        console.error('TFD Automator: Failed to load gem packets:', error);
                        logActivity(`Error loading gem packets: ${error.message}`);
                        
                        // Move to next phase if we can't load gems
                        handlePhaseCompletion();
                    }
                };
                
                loadGemPackets();
                return; // Return early as we're handling this asynchronously
            } catch (error) {
                logActivity(`Error in gems phase: ${error.message}`);
                handlePhaseCompletion();
                return;
            }
        case 'rewards':
            logActivity(`Collecting rewards/treasure chests`);
            updateStatus('Collecting Rewards', 'Opening treasure chests', 'loading');
            phasePackets = collectRewardsPackets;
            break;
        case 'leave':
            logActivity(`Leaving TFD adventure`);
            updateStatus('Leaving Adventure', 'Exiting to Jamaa Township', 'loading');
            phasePackets = leaveTfdPackets;
            break;
        default:
            logActivity(`Unknown phase: ${phase}`);
            return;
    }
    
    // Set packets and start automation
    packets = phasePackets;
    currentPacketIndex = 0;
    isAutomating = true;
    
    // UI updates
    startButton.disabled = true;
    stopButton.disabled = false;
    pauseButton.disabled = false;
    loadButton.disabled = true;
    speedSlider.disabled = true;
    
    // Update full automation status
    updateFullAutomationStatus();
    
    // Start sending packets
    sendNextPacket();
}

/**
 * Handle the completion of a phase in the full automation process
 */
function handlePhaseCompletion() {
    if (!fullAutomationEnabled || !isReady) return; // Also check isReady
    
    // Determine the next phase based on the current one
    let nextPhase;
    switch(currentAutomationPhase) {
        case 'join':
            nextPhase = 'start';
            break;
        case 'start':
            nextPhase = 'gems';
            break;
        case 'gems':
            nextPhase = 'rewards';
            break;
        case 'rewards':
            nextPhase = 'leave';
            break;
        case 'leave':
            // Completed a full cycle
            fullAutomationCycles++;
            logActivity(`Completed full automation cycle #${fullAutomationCycles}`);
            updateFullAutomationStatus(); // Update cycle count
            nextPhase = 'join';
            break;
        default:
            nextPhase = 'join'; // Default to starting over
            break;
    }
    
    // Short delay before starting next phase
    setTimeout(() => {
        // Re-check flags before starting next phase
        if (fullAutomationEnabled && !isPaused && isReady) {
            startAutomationPhase(nextPhase);
        }
    }, 2000); // 2 second pause between phases
}

/**
 * Processes the j#jr packet to confirm user ID and den location.
 */
function handleJoinRoom(packetData) {
    try {
        const message = packetData?.message || packetData?.data; // Handle potential different structures
        if (!message || typeof message !== 'string' || !message.startsWith('%xt%j#jr%')) {
            return; // Not the packet we are looking for
        }

        // Attempt to get the logged-in user ID if we haven't already
        if (!loggedInUserId && window.jam && window.jam.dispatch) {
             // Note: getState might be async, but we'll try sync first if available
             // This assumes the 'player' state has the ID. Adjust key if needed.
             if (window.jam.dispatch.getStateSync) {
                 loggedInUserId = window.jam.dispatch.getStateSync('player')?.userId || window.jam.dispatch.getStateSync('user');
             } else if (window.jam.state) {
                 loggedInUserId = window.jam.state.player?.userId || window.jam.state.user;
             }
        }

        if (!loggedInUserId) {
            logActivity("Listener Error: Could not get logged-in User ID yet.");
            // Keep status as waiting or update to reflect missing user ID
            updateStatus('Waiting', 'Login data not found yet', 'warning');
            isReady = false;
            startButton.disabled = true;
            return;
        }

        const parts = message.split('%');
        // Expected format: %xt%j#jr%internalRoomId%roomId%playerDataString%
        // Room ID should be at index 4
        const actualRoomId = parts[4];

        if (!actualRoomId) {
            logActivity(`Listener Error: Could not parse room ID from j#jr: ${message}`);
            return;
        }

        const expectedDenId = 'den' + loggedInUserId;

        // Check if the joined room is the user's den
        if (actualRoomId === expectedDenId) {
            // Now, confirm the user ID is present in the player list
            // Player data string is complex, typically starts after room ID
            const playerDataString = parts.slice(5).join('%');
            // Player data format: id:name:type:colors:x:y:frame:flags%...
            const players = playerDataString.split('%');
            let userFoundInDen = false;
            for (const player of players) {
                const playerData = player.split(':');
                const playerId = playerData[0]; // Assuming ID is the first part
                if (playerId === loggedInUserId) {
                    userFoundInDen = true;
                    break;
                }
            }

            if (userFoundInDen) {
                logActivity(`Confirmed user ${loggedInUserId} entered den ${actualRoomId}. Ready.`);
                currentUserId = loggedInUserId; // Set global ID for templates
                currentDenId = actualRoomId;   // Set global den ID
                initializePacketTemplates();   // Initialize templates now
                updateStatus('Ready', 'In den. Ready to start.', 'success');
                isReady = true;
                startButton.disabled = false;  // Enable start button
            } else {
                logActivity(`Listener Warn: Joined den ${actualRoomId}, but user ${loggedInUserId} not found in player list.`);
                // This case shouldn't happen if it's their den, but handle defensively
                 updateStatus('Error', 'User data mismatch in den', 'error');
                 isReady = false;
                 startButton.disabled = true;
            }
        } else {
            // User joined a different room, reset state
            logActivity(`User entered room: ${actualRoomId}. Waiting for den entry.`);
            updateStatus('Waiting', 'Please enter your den', 'warning');
            isReady = false;
            currentUserId = null;
            currentDenId = null;
            startButton.disabled = true;
        }
    } catch (error) {
        console.error("TFD Automator: Error processing j#jr packet:", error);
        logActivity(`Listener Error: Failed processing room join - ${error.message}`);
        updateStatus('Error', 'Packet processing failed', 'error');
        isReady = false;
        startButton.disabled = true;
    }
}

/**
 * Initializes the plugin UI and logic.
 */
async function initialize() {
    console.log('TFD Automator: Initializing...');
    // It might be too early to logActivity if activityLog isn't found yet
    // logActivity("Initializing plugin...");

    // Get Control Elements
    startButton = document.getElementById('startButton');
    stopButton = document.getElementById('stopButton');
    loadButton = document.getElementById('loadButton');
    pauseButton = document.getElementById('pauseButton');
    speedSlider = document.getElementById('speedSlider');
    // Corrected ID here to match HTML
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

    // Full automation toggle button (visible one)
    fullAutoButton = document.getElementById('fullAutoButton'); 
    
    // Full automation status UI
    fullAutoStatus = document.getElementById('fullAutoStatus');
    currentPhaseText = document.getElementById('currentPhaseText');
    cycleCountText = document.getElementById('cycleCountText');
    automationProgress = document.getElementById('automationProgress');

    // Basic check if elements exist NOW after attempting assignment
    // Ensure the variable name in the check matches the one assigned above
    if (!startButton || !stopButton || !loadButton || !pauseButton || !speedSlider || !speedValueDisplay || 
        !progressGreen || !progressTextGreen || !progressYellow || !progressTextYellow || !progressBlue || !progressTextBlue || !progressGrey || !progressTextGrey ||
        !statusIcon || !statusText1 || !statusText2 || !activityLog || !fullAutoButton || !fullAutoStatus || !currentPhaseText || !cycleCountText || !automationProgress) {
        
        console.error('TFD Automator: Critical UI elements not found!');
        // Add detailed logging to pinpoint the issue
        // Using console.log as logActivity might not be available yet
        console.log(`Debug Elements:\n` +
          `  startButton: ${!!startButton}\n` +
          `  stopButton: ${!!stopButton}\n` +
          `  loadButton: ${!!loadButton}\n` +
          `  pauseButton: ${!!pauseButton}\n` +
          `  speedSlider: ${!!speedSlider}\n` +
          `  speedValueDisplay: ${!!speedValueDisplay} (ID: speedValue)\n` + // Corrected variable name used
          `  progressGreen: ${!!progressGreen}\n` +
          `  progressTextGreen: ${!!progressTextGreen}\n` +
          `  progressYellow: ${!!progressYellow}\n` +
          `  progressTextYellow: ${!!progressTextYellow}\n` +
          `  progressBlue: ${!!progressBlue}\n` +
          `  progressTextBlue: ${!!progressTextBlue}\n` +
          `  progressGrey: ${!!progressGrey}\n` +
          `  progressTextGrey: ${!!progressTextGrey}\n` +
          `  statusIcon: ${!!statusIcon}\n` +
          `  statusText1: ${!!statusText1}\n` +
          `  statusText2: ${!!statusText2}\n` +
          `  activityLog: ${!!activityLog}\n` +
          `  fullAutoButton: ${!!fullAutoButton}\n` +
          `  fullAutoStatus: ${!!fullAutoStatus}\n` +
          `  currentPhaseText: ${!!currentPhaseText}\n` +
          `  cycleCountText: ${!!cycleCountText}\n` +
          `  automationProgress: ${!!automationProgress}\n`
        );
        // logActivity("Error: Critical UI elements missing. Cannot initialize."); // Commented out, might fail
        
        // Try to update status if elements exist
        if(statusText1) statusText1.textContent = "Initialization Error";
        // if(statusText2) statusText2.textContent = "UI elements missing."; // statusText2 is hidden anyway
        return;
    }
    
    // Now that we know activityLog exists, we can log
    logActivity("Initializing plugin..."); 

    // Set initial UI state
    updateStatus('Waiting', 'Please enter your den', 'warning');
    isReady = false;
    startButton.disabled = true;
    stopButton.disabled = true;
    pauseButton.disabled = true;


    // Add Event Listeners
    startButton.addEventListener('click', handleStart);
    stopButton.addEventListener('click', handleStop);
    pauseButton.addEventListener('click', handlePauseResume);
    loadButton.addEventListener('click', handleLoadTFD);

    speedSlider.addEventListener('input', () => {
        // Ensure speedValueDisplay exists before using it
        if (speedValueDisplay) {
            currentSpeed = parseInt(speedSlider.value, 10);
            speedValueDisplay.textContent = `${currentSpeed}ms`;
            logActivity(`Speed set to ${currentSpeed}ms`);
        }
    });

    // Set initial speed display
    // Ensure speedValueDisplay exists before using it
    if (speedValueDisplay) {
        currentSpeed = parseInt(speedSlider.value, 10);
        speedValueDisplay.textContent = `${currentSpeed}ms`;
    }

    // Add full automation toggle listener (using the correct function)
    // The onclick attribute in HTML already calls handleFullAutomationToggle
    // fullAutoButton.addEventListener('click', handleFullAutomationToggle); // Not needed due to onclick in HTML

    // Listen for room changes (j#jr packet)
    if (window.jam && window.jam.dispatch && window.jam.dispatch.on) {
        // Use 'aj' type for XT packets
        window.jam.dispatch.on('aj', handleJoinRoom);
        logActivity("Room join listener initialized (j#jr)");
    } else {
         logActivity("Error: Could not attach room join listener.");
         updateStatus('Error', 'Initialization failed', 'error');
    }

    handleLoadTFD(); // Load packets initially (start button remains disabled)
    logActivity("Initialization complete. Waiting for den entry.");
}

// --- Initialization ---
waitForDispatch(initialize);
