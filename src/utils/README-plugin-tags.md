# Plugin Tag Management

This utility provides a way to manage tags for plugins in the Jam/Strawberry Jam project. Tags can be used to categorize plugins, mark them as beta, or provide other metadata.

## Usage

### Command Line Interface

You can use the command line interface to add, remove, or list tags:

```bash
# Add a tag to a plugin
npm run plugin:tag <plugin-name> add <tag-name>

# Remove a tag from a plugin
npm run plugin:tag <plugin-name> remove <tag-name>

# List all plugins with a specific tag
npm run plugin:tag:list <tag-name>
```

Examples:

```bash
# Add the beta tag to the UsernameLogger plugin
npm run plugin:tag UsernameLogger add beta

# Remove the beta tag from the UsernameLogger plugin
npm run plugin:tag UsernameLogger remove beta

# List all plugins with the beta tag
npm run plugin:tag:list beta
```

### Programmatic Usage

You can also use the utility functions programmatically in your code:

```javascript
const {
  addTagToPlugin,
  removeTagFromPlugin,
  pluginHasTag,
  getPluginsWithTag
} = require('./plugin-tag-utils');

// Add a tag to a plugin
addTagToPlugin('UsernameLogger', 'beta').then(result => {
  console.log(result.message);
});

// Remove a tag from a plugin
removeTagFromPlugin('UsernameLogger', 'beta').then(result => {
  console.log(result.message);
});

// Check if a plugin has a tag
pluginHasTag('UsernameLogger', 'beta').then(hasTag => {
  console.log(`UsernameLogger has beta tag: ${hasTag}`);
});

// Get all plugins with a tag
getPluginsWithTag('beta').then(plugins => {
  console.log(`Plugins with beta tag: ${plugins.join(', ')}`);
});
```

## API Reference

### addTagToPlugin(pluginName, tagName)

Adds a tag to a plugin.

- `pluginName` (string): The name of the plugin directory
- `tagName` (string): The tag to add
- Returns: Promise<{success: boolean, message: string, tags?: string[]}>

### removeTagFromPlugin(pluginName, tagName)

Removes a tag from a plugin.

- `pluginName` (string): The name of the plugin directory
- `tagName` (string): The tag to remove
- Returns: Promise<{success: boolean, message: string, tags?: string[]}>

### pluginHasTag(pluginName, tagName)

Checks if a plugin has a specific tag.

- `pluginName` (string): The name of the plugin directory
- `tagName` (string): The tag to check for
- Returns: Promise<boolean>

### getPluginsWithTag(tagName)

Gets all plugins with a specific tag.

- `tagName` (string): The tag to filter by
- Returns: Promise<string[]>

## Implementation Details

The plugin tag management utility works by modifying the `plugin.json` file in each plugin directory. The `tags` field in the `plugin.json` file is an array of strings, where each string is a tag.

For example, the `plugin.json` file for the UsernameLogger plugin might look like this:

```json
{
  "name": "Username Logger",
  "version": "2.0.0",
  "description": "Collects usernames from nearby players and buddies",
  "author": "glvckoma",
  "main": "index.js",
  "tags": [
    "beta"
  ]
}
```

The utility functions read and write this file to add or remove tags.
