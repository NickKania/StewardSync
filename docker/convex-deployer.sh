#!/bin/sh
set -eu

if [ ! -s /convex/shared/admin_key ]; then
  echo "Missing /convex/shared/admin_key. convex-keygen must run first." >&2
  exit 1
fi

ADMIN_KEY="$(cat /convex/shared/admin_key)"
CONVEX_URL="${CONVEX_SELF_HOSTED_URL:-http://backend:3210}"

echo "Deploying Convex functions to ${CONVEX_URL}"
CONVEX_SELF_HOSTED_URL="${CONVEX_URL}" bun x convex deploy --admin-key "${ADMIN_KEY}"
