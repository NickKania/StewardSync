#!/bin/bash

# Vercel build script for StewardSync
# This script generates environment files from Vercel environment variables
# or automatically detects the Convex deployment URL from Convex CLI

set -e

echo "=== Vercel Build for StewardSync ==="
echo ""

# Try to get PUBLIC_CONVEX_URL from environment variable or Convex CLI
if [ -z "$PUBLIC_CONVEX_URL" ]; then
  echo "PUBLIC_CONVEX_URL not set as environment variable"
  echo "Attempting to detect from Convex CLI..."
  echo ""

  # Try to get deployment URL from Convex CLI (using portable grep)
  CONVEX_OUTPUT=$(bun x convex deploy --dry-run 2>&1) || true
  DETECTED_URL=$(echo "$CONVEX_OUTPUT" | grep -o 'Deploying to https://[^[:space:]]*\.convex\.cloud' | sed 's/Deploying to //' | head -1)

  if [ -n "$DETECTED_URL" ]; then
    export PUBLIC_CONVEX_URL="$DETECTED_URL"
    echo "✅ Detected Convex URL: $PUBLIC_CONVEX_URL"
  else
    echo "❌ Could not automatically detect Convex deployment URL"
    echo ""
    echo "Please set PUBLIC_CONVEX_URL as an environment variable in Vercel:"
    echo "  1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables"
    echo "  2. Add variable: PUBLIC_CONVEX_URL"
    echo "  3. Value: https://your-deployment.convex.cloud"
    echo "  4. Get your URL from: https://dashboard.convex.dev"
    echo ""
    echo "Or run locally: bun run detect:convex-url"
    echo ""
    echo "Current Convex CLI output:"
    echo "$CONVEX_OUTPUT"
    exit 1
  fi
fi

# Display configuration
echo ""
echo "Build configuration:"
echo "  PUBLIC_CONVEX_URL: $PUBLIC_CONVEX_URL"
echo "  PUBLIC_ENABLE_DEV_LOGIN: ${PUBLIC_ENABLE_DEV_LOGIN:-false}"
if [ -n "$DISCORD_CLIENT_ID" ]; then
  echo "  DISCORD_CLIENT_ID: ${DISCORD_CLIENT_ID:0:8}..."
else
  echo "  DISCORD_CLIENT_ID: (not set)"
fi
echo ""

# Generate environment.prod.ts for Angular build
cat > src/environments/environment.prod.ts <<EOF
/**
 * Production environment configuration
 * Generated at build time from Vercel environment variables
 */

export const environment = {
  production: true,
  enableDevLogin: ${PUBLIC_ENABLE_DEV_LOGIN:-false},
  convexUrl: '$PUBLIC_CONVEX_URL',
  discordClientId: '${DISCORD_CLIENT_ID:-}',
  discordClientSecret: '${DISCORD_CLIENT_SECRET:-}'
};
EOF

echo "✓ Generated src/environments/environment.prod.ts"

# Generate runtime-config.js for browser injection
cat > src/runtime-config.js <<EOF
window.__STEWARDSYNC_CONFIG__ = {
  convexUrl: '$PUBLIC_CONVEX_URL',
  enableDevLogin: ${PUBLIC_ENABLE_DEV_LOGIN:-false},
  discordClientId: '${DISCORD_CLIENT_ID:-}',
  discordClientSecret: '${DISCORD_CLIENT_SECRET:-}'
};
EOF

echo "✓ Generated src/runtime-config.js"
echo ""

# Build Angular application
echo "Building Angular application..."
bun run build --configuration=production

echo ""
echo "✅ Build completed successfully"
