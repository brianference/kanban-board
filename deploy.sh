#!/bin/bash
set -e

# Kanban Board Deployment Script
# Generates static HTML and deploys to Cloudflare Pages

echo "🚀 Deploying Kanban Board..."

# Load secrets
source /root/.openclaw/secrets/keys.env

# Generate HTML from tasks.json
echo "📄 Generating static HTML..."
python3 kanban.py generate

# Commit to git (without exposing secrets)
echo "📦 Committing to git..."
cd /root/.openclaw/workspace/python-kanban

git add tasks.json index.html
git commit -m "Update kanban board - $(date +'%Y-%m-%d %H:%M:%S')" || echo "No changes to commit"

# Push to GitHub
echo "🔼 Pushing to GitHub..."
git push origin master || echo "⚠️  Push failed (may need git remote setup)"

# Trigger Cloudflare Pages deployment
echo "☁️  Triggering Cloudflare deployment..."
ACCOUNT_ID="dd01b432f0329f87bb1cc1a3fad590ee"
PROJECT_NAME="kanban-board"

curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME/deployments" \
  -H "Authorization: Bearer $CloudflarePagesDeployment" \
  -H "Content-Type: application/json" \
  --data '{"branch":"master"}' \
  --silent | jq -r '.success, .result.url' | grep -E '^(true|http)'

echo ""
echo "✅ Deployment complete!"
echo "🔗 Board URL: https://kanban-board-264.pages.dev"
