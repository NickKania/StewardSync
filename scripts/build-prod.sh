#!/bin/bash

# Generate production environment file from environment variables
# This script is used during production builds

# Load from .env file if environment variables are not set
if [ -z "${PUBLIC_CONVEX_URL}" ] && [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Validate required variables
if [ -z "${PUBLIC_CONVEX_URL}" ]; then
  echo "ERROR: PUBLIC_CONVEX_URL is not set"
  echo "Usage: PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud bun run build:prod"
  exit 1
fi

cat > src/environments/environment.prod.ts <<EOF
/**
 * Production environment configuration
 * Generated at build time from environment variables
 */

export const environment = {
  production: true,
  enableDevLogin: ${PUBLIC_ENABLE_DEV_LOGIN:-false},
  convexUrl: '${PUBLIC_CONVEX_URL}',
  discordClientId: '${DISCORD_CLIENT_ID:-}',
  discordClientSecret: '${DISCORD_CLIENT_SECRET:-}'
};
EOF

echo "Generated environment.prod.ts"

# Also generate runtime-config.js for local builds
cat > src/runtime-config.js <<EOF
window.__STEWARDSYNC_CONFIG__ = {
  convexUrl: '${PUBLIC_CONVEX_URL}',
  enableDevLogin: ${PUBLIC_ENABLE_DEV_LOGIN:-false},
  discordClientId: '${DISCORD_CLIENT_ID:-}',
  discordClientSecret: '${DISCORD_CLIENT_SECRET:-}'
};
EOF

echo "Generated src/runtime-config.js"

# Run Angular build
bun run ng build --configuration=production
