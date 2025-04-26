# TFD Automator Plugin

Automates "The Forgotten Treasure" adventure in Animal Jam Classic.

## Features

*   Sends the required packets in sequence to complete the adventure.
*   Uses the correct delays between packets.
*   Dynamically uses the current room ID.
*   Provides visual feedback on the current step being processed.
*   Includes a Start/Stop button to control the automation.

## How to Use

1.  Navigate to the start of "The Forgotten Treasure" adventure in-game.
2.  Open the TFD Automator plugin panel in Strawberry Jam.
3.  Click the "Start Automation" button.
4.  The status display will show which packet/step is being processed.
5.  Click "Stop Automation" at any time to interrupt the sequence.

**Note:** Ensure you are in the correct adventure room before starting the automation. The plugin relies on `dispatch.getState('room')` to function correctly.
