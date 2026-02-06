#!/bin/sh
set -eu

PUBLIC_CONVEX_URL="${PUBLIC_CONVEX_URL:-http://localhost:3210}"
export PUBLIC_CONVEX_URL

envsubst '${PUBLIC_CONVEX_URL}' \
  < /usr/share/nginx/html/runtime-config.template.js \
  > /usr/share/nginx/html/runtime-config.js

exec nginx -g "daemon off;"
