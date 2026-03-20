#!/usr/bin/env bash
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPTS_DIR}/.." && pwd)"

"${SCRIPTS_DIR}/remote-autoconnect.sh"
YACT_DATA_DIR="${YACT_DATA_DIR:-${PROJECT_ROOT}/apps/web/.cache}" "${SCRIPTS_DIR}/remote-db-sync.sh" pull || true

SYNC_PID=""
if [[ "${YACT_REMOTE_DB_WATCH:-1}" == "1" ]]; then
	YACT_DATA_DIR="${YACT_DATA_DIR:-${PROJECT_ROOT}/apps/web/.cache}" "${SCRIPTS_DIR}/remote-db-sync.sh" watch-pull &
	SYNC_PID="$!"
fi

cleanup() {
	if [[ -n "${SYNC_PID}" ]]; then
		kill "${SYNC_PID}" >/dev/null 2>&1 || true
	fi
}
trap cleanup EXIT INT TERM

cd apps/analytics
uv run uvicorn app.main:app --reload --port 8000
