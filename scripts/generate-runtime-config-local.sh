#!/bin/bash

# Generate runtime-config.js from environment.local.ts for local development
# This is useful when you don't have Docker running but want to test the Angular app

set -e

# Read values from the local environment file, bootstrapping from the example on a fresh checkout
ENV_FILE="src/environments/environment.local.ts"
EXAMPLE_FILE="src/environments/environment.local.example.ts"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE_FILE" ]; then
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    echo "ℹ Created $ENV_FILE from $EXAMPLE_FILE (update it with your local values if needed)"
  else
    echo "ERROR: $ENV_FILE not found"
    exit 1
  fi
fi

# Extract public values from the local environment file (supports single or double quotes)
CONVEX_URL=$(grep "convexUrl:" "$ENV_FILE" | sed -E "s/.*convexUrl:[[:space:]]*['\"]([^'\"]*)['\"].*/\1/")
ENABLE_DEV_LOGIN=$(grep "enableDevLogin:" "$ENV_FILE" | sed -E "s/.*enableDevLogin:[[:space:]]*(true|false).*/\1/")
DISCORD_CLIENT_ID=$(grep "discordClientId:" "$ENV_FILE" | sed -E "s/.*discordClientId:[[:space:]]*['\"]([^'\"]*)['\"].*/\1/")

# Generate runtime-config.js
cat > src/runtime-config.js <<EOF
window.__STEWARDSYNC_CONFIG__ = {
  convexUrl: '$CONVEX_URL',
  enableDevLogin: $ENABLE_DEV_LOGIN,
  discordClientId: '$DISCORD_CLIENT_ID',
};
EOF

echo "✓ Generated src/runtime-config.js from environment.local.ts"
echo "  convexUrl: $CONVEX_URL"
echo "  enableDevLogin: $ENABLE_DEV_LOGIN"
