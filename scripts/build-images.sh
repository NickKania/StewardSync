#!/bin/bash
set -euo pipefail

DOCKER_USERNAME="${DOCKER_USERNAME:-$(grep -E '^DOCKER_USERNAME=' .env 2>/dev/null | cut -d= -f2 || echo 'yourusername')}"

if [ "$DOCKER_USERNAME" = "yourusername" ]; then
  echo "Error: DOCKER_USERNAME not set"
  echo "Set it via: export DOCKER_USERNAME=your-username"
  echo "Or add it to your .env file"
  exit 1
fi

TAG="${TAG:-local}"

echo "Building images for ${DOCKER_USERNAME}/stewardsync with tag: ${TAG}"

# Enable BuildKit for better caching and performance
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

BUILD_ARGS="--cache-from=${DOCKER_USERNAME}/stewardsync:frontend-latest --cache-to=type=inline"
if [ -n "${BUILD_DATE:-}" ]; then
  BUILD_ARGS="${BUILD_ARGS} --build-arg BUILD_DATE=${BUILD_DATE}"
fi
if [ -n "${VCS_REF:-}" ]; then
  BUILD_ARGS="${BUILD_ARGS} --build-arg VCS_REF=${VCS_REF}"
fi
if [ -n "${VERSION:-}" ]; then
  BUILD_ARGS="${BUILD_ARGS} --build-arg VERSION=${VERSION}"
fi

echo "Building frontend image (this may take 5-10 minutes on macOS)..."
echo "For faster local builds, consider using Dockerfile.fast instead"
echo "See docs/docker-fast-build.md for more information"
echo ""
docker build ${BUILD_ARGS} \
  -t ${DOCKER_USERNAME}/stewardsync:frontend-${TAG} \
  -f Dockerfile \
  .

echo "Building deployer image..."
docker build ${BUILD_ARGS} \
  -t ${DOCKER_USERNAME}/stewardsync:deployer-${TAG} \
  -f docker/convex-deployer.Dockerfile \
  .

echo "✓ Images built successfully:"
echo "  - ${DOCKER_USERNAME}/stewardsync:frontend-${TAG}"
echo "  - ${DOCKER_USERNAME}/stewardsync:deployer-${TAG}"
