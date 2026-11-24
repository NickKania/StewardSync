#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
exec bun --no-env-file scripts/lib/test-mode-startup.ts "$@"
