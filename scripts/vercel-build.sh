#!/bin/bash

# Vercel build script for StewardSync
# This script generates environment files from Vercel environment variables

set -e

echo "=== Vercel Build for StewardSync ==="
echo ""

# Run configuration verification
./scripts/verify-config.sh || exit 1

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
