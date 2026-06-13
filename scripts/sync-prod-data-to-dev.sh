#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROD_ENV_FILE="${PROD_ENV_FILE:-.env.production}"
DEV_ENV_FILE="${DEV_ENV_FILE:-.env.staging}"
EXPORT_DIR="${EXPORT_DIR:-tmp/convex-exports}"
INCLUDE_FILE_STORAGE="${INCLUDE_FILE_STORAGE:-false}"

usage() {
  cat <<'EOF'
Usage: scripts/sync-prod-data-to-dev.sh [--yes] [--include-file-storage]

Exports Convex data from the production deployment configured by .env.production
and imports it into the development deployment configured by .env.staging.

This overwrites the development deployment with the production snapshot.

Environment overrides:
  PROD_ENV_FILE=.env.production   Source deployment env file
  DEV_ENV_FILE=.env.staging       Destination deployment env file
  EXPORT_DIR=tmp/convex-exports   Snapshot output directory
  INCLUDE_FILE_STORAGE=true       Include Convex file storage in the export

Examples:
  scripts/sync-prod-data-to-dev.sh --yes
  DEV_ENV_FILE=.env.local scripts/sync-prod-data-to-dev.sh --yes
EOF
}

CONFIRMED=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --yes|-y)
      CONFIRMED=true
      ;;
    --include-file-storage)
      INCLUDE_FILE_STORAGE=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [ ! -f "$PROD_ENV_FILE" ]; then
  echo "Production env file not found: $PROD_ENV_FILE" >&2
  exit 1
fi

if [ ! -f "$DEV_ENV_FILE" ]; then
  echo "Development env file not found: $DEV_ENV_FILE" >&2
  exit 1
fi

if command -v nvm >/dev/null 2>&1; then
  nvm use 20
elif [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
  nvm use 20
elif [ -s "/opt/homebrew/opt/nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "/opt/homebrew/opt/nvm/nvm.sh"
  nvm use 20
elif [ -s "/usr/local/opt/nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "/usr/local/opt/nvm/nvm.sh"
  nvm use 20
else
  echo "Warning: nvm was not found; continuing with Node $(node --version 2>/dev/null || echo unknown)." >&2
fi

mkdir -p "$EXPORT_DIR"

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
SNAPSHOT_PATH="$EXPORT_DIR/production-snapshot-$TIMESTAMP.zip"

cat <<EOF
Source:      $PROD_ENV_FILE
Destination: $DEV_ENV_FILE
Snapshot:    $SNAPSHOT_PATH
EOF

if [ "$INCLUDE_FILE_STORAGE" = "true" ]; then
  echo "File storage: included"
else
  echo "File storage: data tables only"
fi

if [ "$CONFIRMED" != "true" ]; then
  echo ""
  echo "This will replace all data in the development Convex deployment."
  printf "Continue? [y/N]: "
  read -r confirmation
  case "$confirmation" in
    y|Y|yes|YES)
      ;;
    *)
      echo "Aborted."
      exit 1
      ;;
  esac
fi

EXPORT_ARGS=(export --env-file "$PROD_ENV_FILE" --path "$SNAPSHOT_PATH")
if [ "$INCLUDE_FILE_STORAGE" = "true" ]; then
  EXPORT_ARGS+=(--include-file-storage)
fi

echo ""
echo "Exporting production data..."
bun x convex "${EXPORT_ARGS[@]}"

echo ""
echo "Importing snapshot into development with --replace-all..."
bun x convex import --env-file "$DEV_ENV_FILE" --replace-all --yes "$SNAPSHOT_PATH"

echo ""
echo "Development data has been overwritten from production."
echo "Snapshot retained at: $SNAPSHOT_PATH"
