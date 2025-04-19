# Security Guide for Handling Sensitive Information

## Issue: API Key Exposure in Git History

We've identified that the LeakCheck API key was accidentally committed to the git repository in `settings.json`. Although `settings.json` is now properly ignored in `.gitignore`, the API key still exists in the git history.

## Immediate Actions Required

### 1. Revoke the Exposed API Key

The LeakCheck API key `b38c72b84b3b17f963426ee95e3271392c9f81b0` has been exposed. You should:

- Immediately revoke this API key on the LeakCheck.io dashboard
- Generate a new API key
- Update your local settings with the new API key using `!setapikey YOUR_NEW_KEY`

### 2. Remove the API Key from Git History

To completely remove the API key from git history, you need to use the BFG Repo-Cleaner tool or git filter-branch. Here's how to do it with BFG:

```bash
# Install BFG (if using Homebrew on macOS)
brew install bfg

# Clone a fresh copy of your repo (faster than modifying the original)
git clone --mirror https://github.com/yourusername/yourrepo.git repo-mirror

# Run BFG to replace the API key with "REMOVED-API-KEY"
cd repo-mirror
bfg --replace-text ../passwords.txt

# Create a passwords.txt file containing:
b38c72b84b3b17f963426ee95e3271392c9f81b0=REMOVED-API-KEY

# Clean up the repository
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Push the changes
git push
```

Alternatively, using git filter-branch (slower but doesn't require additional tools):

```bash
git filter-branch --force --index-filter \
  "git ls-files -z | xargs -0 sed -i 's/b38c72b84b3b17f963426ee95e3271392c9f81b0/REMOVED-API-KEY/g'" \
  --prune-empty --tag-name-filter cat -- --all

git push --force
```

## Prevention Strategies

### 1. Use Environment Variables or Secure Storage

Never store API keys or sensitive credentials directly in files that might be committed:

```javascript
// Bad
const API_KEY = "actual-api-key-here";

// Good
const API_KEY = process.env.LEAK_CHECK_API_KEY;
```

### 2. Use a Template for Configuration Files

Create template files without real credentials:

```
# settings.template.json
{
  "smartfoxServer": "example.server.com",
  "secureConnection": true,
  "preventAutoLogin": false,
  "leakCheckApiKey": "",
  "leakCheckOutputDir": ""
}
```

And instruct users to:
1. Copy `settings.template.json` to `settings.json`
2. Add their own credentials to `settings.json`

### 3. Pre-commit Hooks

Use git pre-commit hooks to prevent accidental commits of sensitive information:

```bash
#!/bin/sh
# .git/hooks/pre-commit

if git diff --cached | grep -q "API_KEY\|SECRET\|PASSWORD"; then
  echo "WARNING: Potential credential in commit. Review changes before proceeding."
  exit 1
fi
```

### 4. Git Secrets or Other Tools

Consider using tools like:
- [git-secrets](https://github.com/awslabs/git-secrets)
- [Talisman](https://github.com/thoughtworks/talisman)
- [detect-secrets](https://github.com/Yelp/detect-secrets)

These can automatically scan commits for potential secrets and prevent them from being committed.

## Documentation for New Contributors

Add the following to your README or CONTRIBUTING.md:

```markdown
## Handling Sensitive Information

This project requires API keys for certain functionality. Never commit real API keys or other credentials to the repository.

1. Copy `settings.template.json` to `settings.json` (which is git-ignored)
2. Add your own API keys to your local `settings.json`
3. Use the in-app command `!setapikey YOUR_API_KEY` to configure APIs
```

## Implementation Steps for This Project

1. Create settings.template.json
2. Update documentation
3. Consider implementing pre-commit hooks
4. Revoke and replace the exposed API key
5. Clean git history using instructions above
