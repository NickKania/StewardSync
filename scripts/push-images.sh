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

echo "Pushing images for ${DOCKER_USERNAME}/stewardsync with tag: ${TAG}"

echo "Pushing frontend image..."
docker push ${DOCKER_USERNAME}/stewardsync:frontend-${TAG}

echo "Pushing deployer image..."
docker push ${DOCKER_USERNAME}/stewardsync:deployer-${TAG}

echo "✓ Images pushed successfully:"
echo "  - ${DOCKER_USERNAME}/stewardsync:frontend-${TAG}"
echo "  - ${DOCKER_USERNAME}/stewardsync:deployer-${TAG}"
