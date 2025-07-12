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
