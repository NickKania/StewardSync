#!/bin/sh
set -eu

PUBLIC_CONVEX_URL="${PUBLIC_CONVEX_URL:-http://localhost:3210}"
PUBLIC_ENABLE_DEV_LOGIN="${PUBLIC_ENABLE_DEV_LOGIN:-false}"

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

export PUBLIC_CONVEX_URL PUBLIC_ENABLE_DEV_LOGIN

envsubst '${PUBLIC_CONVEX_URL} ${PUBLIC_ENABLE_DEV_LOGIN}' \
  < /usr/share/nginx/html/runtime-config.template.js \
  > /usr/share/nginx/html/runtime-config.js

exec nginx -g "daemon off;"
