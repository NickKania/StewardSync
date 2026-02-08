#!/bin/bash
# Fast Docker build for local development on macOS
# This builds the Angular project locally first, then creates a Docker image
# with the pre-built assets. Much faster than building inside Docker on macOS.

set -euo pipefail

echo "=== Fast Docker Build for macOS ==="
echo ""
echo "Step 1: Building Angular project locally..."
bun run build

if [ $? -ne 0 ]; then
  echo "❌ Angular build failed. Exiting."
  exit 1
fi

echo ""
echo "✅ Angular build completed successfully"
echo "Step 2: Building Docker image with pre-built assets..."

docker build \
  -t stewardsync:fast \
  -f Dockerfile.fast \
  .

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Docker image built successfully: stewardsync:fast"
  echo ""
  echo "To run the container:"
  echo "  docker run -p 4200:80 stewardsync:fast"
  echo ""
  echo "To run with docker-compose:"
  echo "  docker compose -f docker-compose.fast.yml up"
else
  echo ""
  echo "❌ Docker build failed. Exiting."
  exit 1
fi
