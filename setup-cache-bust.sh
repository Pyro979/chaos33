#!/bin/bash

# Setup script to install the cache-busting pre-commit hook

if [ ! -d ".git" ]; then
    echo "Error: This script must be run from the root of a git repository"
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create the pre-commit hook
cat > .git/hooks/pre-commit << 'HOOK_EOF'
#!/bin/bash

# Get short git commit hash
GIT_HASH=$(git rev-parse --short HEAD)

# Update version in index.html
if [ -f "index.html" ]; then
    # Use sed to replace version query parameters with git hash
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS requires empty string after -i
        sed -i '' "s/\?v=[0-9a-f.]*/\?v=$GIT_HASH/g" index.html
    else
        # Linux
        sed -i "s/\?v=[0-9a-f.]*/\?v=$GIT_HASH/g" index.html
    fi
    
    # Stage the updated file
    git add index.html
fi

exit 0
HOOK_EOF

# Make it executable
chmod +x .git/hooks/pre-commit

echo "Cache-busting pre-commit hook installed successfully!"
echo "The hook will automatically update version numbers in index.html before each commit."

