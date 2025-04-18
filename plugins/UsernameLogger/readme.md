# Username Logger Plugin

This plugin provides a unified system for collecting and analyzing usernames in Animal Jam Classic, integrating leak checking functionality.

## Features

- **Unified Username Collection**: Collects usernames from multiple sources:
  - Nearby players (from 'ac' messages)
  - Buddy list (from 'bl' messages)
  - Newly added buddies (from 'ba' messages)
  - Buddies coming online (from 'bon' messages)

- **Configurable Collection**: Choose which types of usernames to collect:
  - Nearby players only
  - Buddies only
  - Both (default)

- **Integrated Leak Checking**: Check collected usernames against the LeakCheck API:
  - Find leaked credentials
  - Separate Animal Jam specific leaks
  - Resume interrupted checks
  - Consistent index tracking between sessions
  - Ability to trim processed usernames

- **Flexible Output Management**:
  - Custom output directory support
  - Automatic file creation
  - Persistent state between sessions

- **Persistent Configuration**:
  - Settings saved between sessions
  - API key loaded from Jam settings
  - Leak check position remembered between runs

## Commands

### Logging Control

- `userlog` - Toggle username logging on/off (simplified toggle with no parameters)
- `userlogsettings [setting] [value]` - Configure logging settings
  - `userlogsettings nearby [on|off]` - Toggle nearby player collection
  - `userlogsettings buddies [on|off]` - Toggle buddy collection
  - `userlogsettings autoleakcheck [on|off]` - Toggle automatic leak checking
  - `userlogsettings threshold [number]` - Set auto leak check threshold
  - `userlogsettings reset` - Reset settings to defaults

### Leak Check Control

- `leakcheck [all|number]` - Run a leak check on collected usernames
  - Always resumes from where the last check left off
  - `all` - Process all remaining usernames (default)
  - `number` - Process only that many usernames
- `leakcheckstop` - Stop a running leak check
- `setindex [number]` - Manually set the leak check position to a specific index
- `trimprocessed` - Remove already processed usernames from the collected list and reset the index

### API Configuration

- `setapikey [api_key]` - Set the LeakCheck API key directly in the plugin

## Output Files

The plugin creates and manages the following files in the configured output directory (defaults to `./data/`):

- `collected_usernames.txt`: All unique usernames collected during logging sessions (with timestamps).
- `processed_usernames.txt`: Usernames that have been successfully processed by the leak checker (found or not found). This acts as the ignore list.
- `potential_accounts.txt`: Usernames that failed the leak check due to invalid characters or other API issues.
- `found_accounts.txt`: Found credentials (`username:password`) from any source during leak checks.
- `ajc_accounts.txt`: Found credentials (`username:password`) specifically identified as coming from Animal Jam leaks.

## Setup

1. Ensure the plugin is installed in the `plugins/UsernameLogger` directory.
2. Set your LeakCheck API key using the command:
   - `setapikey YOUR_API_KEY`
3. Enable logging with `userlog` (toggles on/off).
4. Configure settings as needed with `userlogsettings`.

## Auto Leak Check

When enabled, the plugin will automatically run a leak check after collecting a specified number of usernames (default: 50). This can be configured with:

```
userlogsettings autoleakcheck on
userlogsettings threshold 100
```

## Leak Check Process

The leak checker now maintains a persistent index of where it left off, allowing you to:

1. Stop a check at any time with `leakcheckstop`
2. Continue exactly where you left off with `leakcheck`
3. Fast-forward or rewind to a specific position with `setindex <number>`
4. Remove already processed usernames with `trimprocessed` to free up space

The plugin carefully tracks which usernames have been processed to avoid duplicates and maintain efficiency.

## Notes

- The plugin requires the LeakCheck API key for leak checking functionality.
- All state, including the current processing position, is saved between sessions.
- The `processed_usernames.txt` file acts as an ignore list to prevent re-processing usernames in subsequent leak checks.
- All log files are created in the data directory.
