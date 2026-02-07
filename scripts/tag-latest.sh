#!/bin/bash
set -euo pipefail

DOCKER_USERNAME="${DOCKER_USERNAME:-$(grep -E '^DOCKER_USERNAME=' .env 2>/dev/null | cut -d= -f2 || echo 'yourusername')}"

if [ "$DOCKER_USERNAME" = "yourusername" ]; then
  echo "Error: DOCKER_USERNAME not set"
  echo "Set it via: export DOCKER_USERNAME=your-username"
  echo "Or add it to your .env file"
  exit 1
fi

TAG="${1:-$(git rev-parse --short HEAD 2>/dev/null || echo 'local')}"

echo "Tagging images for ${DOCKER_USERNAME}/stewardsync with tag: ${TAG}"

echo "Tagging frontend images..."
docker tag ${DOCKER_USERNAME}/stewardsync:frontend-${TAG} ${DOCKER_USERNAME}/stewardsync:frontend-latest

echo "Tagging deployer images..."
docker tag ${DOCKER_USERNAME}/stewardsync:deployer-${TAG} ${DOCKER_USERNAME}/stewardsync:deployer-latest

echo "Pushing latest images..."
docker push ${DOCKER_USERNAME}/stewardsync:frontend-latest
docker push ${DOCKER_USERNAME}/stewardsync:deployer-latest

echo "✓ Latest images updated:"
echo "  - ${DOCKER_USERNAME}/stewardsync:frontend-latest"
echo "  - ${DOCKER_USERNAME}/stewardsync:deployer-latest"
