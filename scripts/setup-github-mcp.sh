#!/bin/bash

# GitHub MCP Server Setup Script
# Integrates official GitHub MCP server for advanced GitHub automation

echo "🚀 Setting up GitHub MCP Server Integration..."

# Install GitHub MCP server
echo "📦 Installing GitHub MCP server..."
npm install -g @github/github-mcp-server

# Create GitHub MCP configuration
echo "⚙️ Configuring GitHub MCP server..."

# Add GitHub MCP server to our mcp-config.json
cat > temp-github-config.json << 'EOF'
{
  "github-official": {
    "command": "npx",
    "args": ["@github/github-mcp-server"],
    "description": "Official GitHub MCP server for repository management",
    "env": {
      "GITHUB_TOKEN": "${GITHUB_TOKEN}",
      "GITHUB_REPOSITORY": "johnnydxm/bank",
      "GITHUB_OWNER": "johnnydxm"
    },
    "optional": false,
    "timeout": 30000,
    "retryAttempts": 3
  }
}
EOF

echo "✅ GitHub MCP server configuration created"

# Generate GitHub token instructions
cat > github-token-setup.md << 'EOF'
# GitHub Token Setup Instructions

## 1. Create GitHub Personal Access Token

Go to: https://github.com/settings/tokens/new

### Required Scopes:
- `repo` (Full control of private repositories)
- `workflow` (Update GitHub Action workflows)
- `write:packages` (Write packages to GitHub Package Registry)
- `read:org` (Read org and team membership)
- `project` (Read/write access to projects)

## 2. Set Environment Variable

```bash
# Add to your shell profile (~/.zshrc or ~/.bashrc)
export GITHUB_TOKEN="your_token_here"

# Reload shell
source ~/.zshrc
```

## 3. Verify Token
```bash
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
```
EOF

echo "📝 GitHub token setup instructions created: github-token-setup.md"

# Update our mcp-config.json to include GitHub MCP server
echo "🔧 Updating MCP configuration..."

# Create backup of current config
cp mcp-config.json mcp-config.json.backup

# Merge GitHub MCP server into existing config
node -e "
const fs = require('fs');
const currentConfig = JSON.parse(fs.readFileSync('mcp-config.json', 'utf8'));
const githubConfig = JSON.parse(fs.readFileSync('temp-github-config.json', 'utf8'));

currentConfig.mcpServers = {
  ...currentConfig.mcpServers,
  ...githubConfig
};

fs.writeFileSync('mcp-config.json', JSON.stringify(currentConfig, null, 2));
console.log('✅ GitHub MCP server added to configuration');
"

# Clean up temp file
rm temp-github-config.json

echo "🎉 GitHub MCP Server setup complete!"
echo "📖 Next steps:"
echo "1. Follow instructions in github-token-setup.md"
echo "2. Run: npm run mcp:restart"
echo "3. Test GitHub integration with: npm run github:test"