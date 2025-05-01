# TFD Automator Plugin

Automates "The Forgotten Treasure" adventure in Animal Jam Classic.

## Features

*   Sends the required packets in sequence to complete the adventure.
*   Uses the correct delays between packets.
*   Dynamically uses the current room ID.
*   Provides visual feedback on the current step being processed.
*   Includes a Start/Stop button to control the automation.
*   Properly collects treasure rewards using the exact TFD-specific packets.
*   Automatically detects and uses the current user's ID for user-specific packets.
*   Full Automation mode that:
    *   Automatically joins the TFD adventure
    *   Completes all gem collections
    *   Collects treasure chest rewards
    *   Leaves the adventure
    *   Repeats the entire process continuously

## How to Use

### Basic Mode
1.  Navigate to the start of "The Forgotten Treasure" adventure in-game.
2.  Open the TFD Automator plugin panel in Strawberry Jam.
3.  Click the "Start Automation" button.
4.  The status display will show which packet/step is being processed.
5.  Click "Stop Automation" at any time to interrupt the sequence.

### Full Automation Mode
1.  Open the TFD Automator plugin panel while in your den.
2.  Toggle on the "Full Auto" switch.
3.  Click the "Start" button to begin the automation cycle.
4.  The plugin will automatically:
    * Join the TFD adventure from your den
    * Start the adventure
    * Complete all gem collections
    * Collect treasure chest rewards using the exact TFD reward packets
    * Exit the adventure and return to your den
    * Repeat the entire cycle continuously
5.  Toggle off "Full Auto" or click "Stop" at any time to end the automation cycle.

**Note:** For best results, make sure you're in your den before starting full automation mode.

## Automation Workflow

The full automation cycle follows this workflow:
1. User is in their den
2. Full Auto is enabled and Start button is pressed
3. Plugin automatically opens adventure map and joins TFD
4. Plugin starts the adventure play session
5. Plugin automatically collects all gems
6. After completion, plugin collects all treasure chests using TFD-specific treasure collection
7. Plugin leaves the adventure and returns to den
8. Cycle repeats automatically

## User ID Auto-Detection

The plugin automatically detects your Animal Jam user ID and uses it for user-specific packets:

- When starting, the plugin attempts to extract your user ID from the game
- Your user ID is used to generate the correct "den ID" (e.g., denK06e4744)
- All user-specific packets will be customized with your ID, making the plugin work for all users

The activity log will show which user ID and den ID were detected for verification.

## TFD Treasure Collection

The plugin uses the exact TFD-specific treasure collection sequence:
1. Sends `qpgift` packets for each treasure (0-3)
2. Sends a final `qpgiftdone` packet to complete the process
3. Each packet is properly timed to ensure all rewards are collected

This approach ensures reliable treasure collection by using the actual packets observed in the TFD adventure.

## Troubleshooting

If the automation seems to be having issues:
1. Check that you're in your den before starting full automation
2. Ensure your game connection is stable
3. Try adjusting the packet speed with the slider
4. Verify that room IDs are properly displaying in the activity log
5. Check that your user ID was correctly detected in the activity log
