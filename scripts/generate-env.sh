#!/bin/bash

# Generate environment file from environment variables
# This script is used during build to inject environment variables into Angular

cat > src/environments/environment.staging.ts <<EOF
/**
 * Staging environment configuration
 * Generated at build time from environment variables
 */

export const environment = {
  production: false,
  enableDevLogin: ${PUBLIC_ENABLE_DEV_LOGIN:-false},
  convexUrl: '${PUBLIC_CONVEX_URL}',
  discordClientId: '${DISCORD_CLIENT_ID}',
  discordClientSecret: '${DISCORD_CLIENT_SECRET}'
};
EOF

echo "Generated environment.staging.ts"
