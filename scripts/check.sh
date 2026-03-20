#!/usr/bin/env bash
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPTS_DIR}/.." && pwd)"

"${SCRIPTS_DIR}/remote-autoconnect.sh"
YACT_DATA_DIR="${YACT_DATA_DIR:-${PROJECT_ROOT}/apps/web/.cache}" "${SCRIPTS_DIR}/remote-db-sync.sh" pull || true

npm run ci:lint
npm run ci:test
cd apps/analytics
uv run pytest -q tests
