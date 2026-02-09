#!/bin/bash

set -e

# Build script that generates environment files from actual environment variables
# This ensures no hardcoded values in the codebase

# Default values if not provided
PUBLIC_CONVEX_URL="${PUBLIC_CONVEX_URL:-}"
PUBLIC_ENABLE_DEV_LOGIN="${PUBLIC_ENABLE_DEV_LOGIN:-false}"
DISCORD_CLIENT_ID="${DISCORD_CLIENT_ID:-}"
DISCORD_CLIENT_SECRET="${DISCORD_CLIENT_SECRET:-}"

# Validate required variables
if [ -z "$PUBLIC_CONVEX_URL" ]; then
  echo "ERROR: PUBLIC_CONVEX_URL is not set"
  echo "Usage: PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud bun run build"
  exit 1
fi

# Generate runtime-config.js from environment variables
cat > src/runtime-config.js << EOF
window.__STEWARDSYNC_CONFIG__ = {
  convexUrl: '${PUBLIC_CONVEX_URL}',
  enableDevLogin: ${PUBLIC_ENABLE_DEV_LOGIN},
  discordClientId: '${DISCORD_CLIENT_ID}',
  discordClientSecret: '${DISCORD_CLIENT_SECRET}'
};
EOF

echo "✓ Generated src/runtime-config.js"
echo "  convexUrl: ${PUBLIC_CONVEX_URL}"
echo "  enableDevLogin: ${PUBLIC_ENABLE_DEV_LOGIN}"

# Run Angular build
bun run ng build "$@"
