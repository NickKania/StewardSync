#!/bin/bash

# Script to detect the current Convex deployment URL
# Useful for getting the URL to set in Vercel environment variables

set -e

echo "=== Detecting Convex Deployment URL ==="
echo ""

# Try to get deployment URL from Convex CLI
echo "Running: bun x convex deploy --dry-run"
echo ""
CONVEX_OUTPUT=$(bun x convex deploy --dry-run 2>&1) || true

# Try to extract URL from output (using portable grep, not -P which doesn't work on macOS)
DETECTED_URL=$(echo "$CONVEX_OUTPUT" | grep -o 'Deploying to https://[^[:space:]]*\.convex\.cloud' | sed 's/Deploying to //' | head -1)

if [ -n "$DETECTED_URL" ]; then
  echo "✅ Detected Convex deployment URL:"
  echo ""
  echo "   $DETECTED_URL"
  echo ""
  echo "To set this in Vercel:"
  echo "  1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables"
  echo "  2. Add new variable:"
  echo "     - Name: PUBLIC_CONVEX_URL"
  echo "     - Value: $DETECTED_URL"
  echo "     - Environments: Production, Preview, Development (select all that apply)"
  echo "  3. Click Save"
  echo "  4. Redeploy your application"
  echo ""
  echo "For convenience, here's the one-liner to copy:"
  echo "PUBLIC_CONVEX_URL=$DETECTED_URL"
else
  echo "❌ Could not automatically detect Convex deployment URL"
  echo ""
  echo "This could mean:"
  echo "  - No Convex project is linked to this directory"
  echo "  - You're using a self-hosted Convex instance"
  echo "  - The Convex CLI is not authenticated"
  echo ""
  echo "To fix this:"
  echo "  1. Run 'bun x convex login' to authenticate with Convex"
  echo "  2. Run 'bun x convex dev' to link/create a project"
  echo "  3. Run this script again"
  echo ""
  echo "Alternatively, manually set the environment variable in Vercel:"
  echo "  Get your deployment URL from https://dashboard.convex.dev"
  echo ""
  echo "Current Convex CLI output:"
  echo "$CONVEX_OUTPUT"
fi
