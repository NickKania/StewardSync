#!/bin/bash
# Docker build script with optimization for macOS filesystem performance
set -euo pipefail

echo "Building Docker image with optimizations..."

# Enable BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export BUILDKIT_PROGRESS=plain

# Docker Desktop on macOS filesystem optimizations
export DOCKER_BUILDKIT_NETWORK_MODE=bridge

# Build with inline cache
docker build \
  --cache-from=stewardsync:frontend-latest \
  --cache-to=type=inline,mode=max \
  --target=builder \
  --progress=plain \
  -t stewardsync:builder-test \
  . 2>&1 | tee /tmp/docker-build.log

# Extract build timing
echo ""
echo "Build Timing Summary:"
grep -E "Step|done|CACHED" /tmp/docker-build.log | tail -20

# If builder stage succeeds, continue with production image
if [ $? -eq 0 ]; then
  echo ""
  echo "Builder stage completed successfully"
  echo "Now building production image..."
  
  docker build \
    --cache-from=stewardsync:frontend-latest \
    --cache-to=type=inline,mode=max \
    -t stewardsync:test \
    .
else
  echo "Builder stage failed. Check /tmp/docker-build.log for details."
  exit 1
fi
