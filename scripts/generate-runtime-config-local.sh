#!/bin/bash

# Generate runtime-config.js from environment.ts for local development
# This is useful when you don't have Docker running but want to test the Angular app

set -e

# Read values from environment.ts
ENV_FILE="src/environments/environment.local.ts"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi

# Extract values from environment.ts using grep and sed
CONVEX_URL=$(grep "convexUrl:" "$ENV_FILE" | sed "s/.*convexUrl: '\(.*\)'.*/\1/")
ENABLE_DEV_LOGIN=$(grep "enableDevLogin:" "$ENV_FILE" | sed "s/.*enableDevLogin: \(.*\),/\1/")
DISCORD_CLIENT_ID=$(grep "discordClientId:" "$ENV_FILE" | sed "s/.*discordClientId: '\(.*\)'.*/\1/")
DISCORD_CLIENT_SECRET=$(grep "discordClientSecret:" "$ENV_FILE" | sed "s/.*discordClientSecret: '\(.*\)'.*/\1/")

# Generate runtime-config.js
cat > src/runtime-config.js <<EOF
window.__STEWARDSYNC_CONFIG__ = {
  convexUrl: '$CONVEX_URL',
  enableDevLogin: $ENABLE_DEV_LOGIN,
  discordClientId: '$DISCORD_CLIENT_ID',
  discordClientSecret: '$DISCORD_CLIENT_SECRET'
};
EOF

echo "✓ Generated src/runtime-config.js from environment.local.ts"
echo "  convexUrl: $CONVEX_URL"
echo "  enableDevLogin: $ENABLE_DEV_LOGIN"
