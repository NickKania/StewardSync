#!/bin/bash

# Generate runtime-config.js from environment variables
# This script creates the runtime-config.js file that gets included in the build

cat > src/runtime-config.js << EOF
window.__STEWARDSYNC_CONFIG__ = {
  convexUrl: '${PUBLIC_CONVEX_URL:-https://effervescent-possum-890.convex.cloud}',
  enableDevLogin: ${PUBLIC_ENABLE_DEV_LOGIN:-false},
  discordClientId: '${DISCORD_CLIENT_ID:-}',
  discordClientSecret: '${DISCORD_CLIENT_SECRET:-}'
};
EOF

echo "Generated src/runtime-config.js"
cat src/runtime-config.js
