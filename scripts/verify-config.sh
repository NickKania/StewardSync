#!/bin/bash

# Pre-build verification script
# Checks that required environment variables are set

echo "=== Pre-Build Configuration Check ==="
echo ""

# Check environment variables
if [ -z "$PUBLIC_CONVEX_URL" ]; then
  echo "❌ PUBLIC_CONVEX_URL is not set"
  echo ""
  echo "Required: PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud"
  echo ""
  echo "For Vercel: Set in Vercel Dashboard → Settings → Environment Variables"
  echo "For Local: export PUBLIC_CONVEX_URL=..."
  exit 1
fi

echo "✅ PUBLIC_CONVEX_URL: $PUBLIC_CONVEX_URL"

if [ -n "$PUBLIC_ENABLE_DEV_LOGIN" ]; then
  echo "✅ PUBLIC_ENABLE_DEV_LOGIN: $PUBLIC_ENABLE_DEV_LOGIN"
else
  echo "ℹ️  PUBLIC_ENABLE_DEV_LOGIN: (not set, will use default: false)"
fi

if [ -n "$DISCORD_CLIENT_ID" ]; then
  echo "✅ DISCORD_CLIENT_ID: ${DISCORD_CLIENT_ID:0:8}..."
else
  echo "⚠️  DISCORD_CLIENT_ID: (not set - Discord login may not work)"
fi

if [ -n "$DISCORD_CLIENT_SECRET" ]; then
  echo "✅ DISCORD_CLIENT_SECRET: (set)"
else
  echo "⚠️  DISCORD_CLIENT_SECRET: (not set - Discord login may not work)"
fi

echo ""
echo "✅ Configuration check passed"
