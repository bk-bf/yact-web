#!/usr/bin/env bash
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPTS_DIR}/.." && pwd)"

# Default analytics API URL (can be overridden with YACT_ANALYTICS_URL env var)
export YACT_ANALYTICS_URL="${YACT_ANALYTICS_URL:-http://localhost:8000}"

npm run dev:web
