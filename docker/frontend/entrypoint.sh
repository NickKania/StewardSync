#!/bin/sh
set -eu

PUBLIC_CONVEX_URL="${PUBLIC_CONVEX_URL:-http://localhost:3210}"
PUBLIC_ENABLE_DEV_LOGIN="${PUBLIC_ENABLE_DEV_LOGIN:-false}"
DISCORD_CLIENT_ID="${DISCORD_CLIENT_ID:-}"
DISCORD_CLIENT_SECRET="${DISCORD_CLIENT_SECRET:-}"

case "$(printf "%s" "$PUBLIC_ENABLE_DEV_LOGIN" | tr '[:upper:]' '[:lower:]')" in
  true|1|yes)
    PUBLIC_ENABLE_DEV_LOGIN="true"
    ;;
  false|0|no|"")
    PUBLIC_ENABLE_DEV_LOGIN="false"
    ;;
  *)
    PUBLIC_ENABLE_DEV_LOGIN="false"
    ;;
esac

export PUBLIC_CONVEX_URL PUBLIC_ENABLE_DEV_LOGIN DISCORD_CLIENT_ID DISCORD_CLIENT_SECRET

envsubst '${PUBLIC_CONVEX_URL} ${PUBLIC_ENABLE_DEV_LOGIN} ${DISCORD_CLIENT_ID} ${DISCORD_CLIENT_SECRET}' \
  < /usr/share/nginx/html/runtime-config.template.js \
  > /usr/share/nginx/html/runtime-config.js

exec nginx -g "daemon off;"
