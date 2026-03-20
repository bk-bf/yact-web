#!/usr/bin/env bash
set -euo pipefail

# Auto-connect and verify remote miner host state without starting any remote process.
# Defaults can be overridden via env vars for different hosts/paths.
SSH_HOST="${YACT_REMOTE_SSH_HOST:-ubuntu}"
REMOTE_DIR="${YACT_REMOTE_MINING_DIR:-/home/ubuntu/server/coindata-mining}"
AUTOCONNECT_ENABLED="${YACT_REMOTE_AUTOCONNECT:-1}"
REQUIRE_REMOTE="${YACT_REMOTE_REQUIRE:-0}"
CHECK_MINER_PROCESS="${YACT_REMOTE_MINER_CHECK:-0}"
MINER_PROCESS_PATTERN="${YACT_REMOTE_MINER_PROCESS_PATTERN:-coindata-mining}"
CONNECT_TIMEOUT_SEC="${YACT_REMOTE_CONNECT_TIMEOUT_SEC:-5}"

if [[ "${AUTOCONNECT_ENABLED}" != "1" ]]; then
    exit 0
fi

if ! command -v ssh >/dev/null 2>&1; then
    echo "[remote-autoconnect] ssh not found in PATH" >&2
    if [[ "${REQUIRE_REMOTE}" == "1" ]]; then
        exit 1
    fi
    exit 0
fi

if ! ssh -o BatchMode=yes -o ConnectTimeout="${CONNECT_TIMEOUT_SEC}" "${SSH_HOST}" "test -d '${REMOTE_DIR}'"; then
    echo "[remote-autoconnect] remote dir missing or host unavailable: ${SSH_HOST}:${REMOTE_DIR}" >&2
    if [[ "${REQUIRE_REMOTE}" == "1" ]]; then
        exit 1
    fi
    exit 0
fi

if [[ "${CHECK_MINER_PROCESS}" == "1" ]]; then
    if ! ssh -o BatchMode=yes -o ConnectTimeout="${CONNECT_TIMEOUT_SEC}" "${SSH_HOST}" "pgrep -af '${MINER_PROCESS_PATTERN}' >/dev/null"; then
        echo "[remote-autoconnect] remote miner process not detected on ${SSH_HOST} (pattern='${MINER_PROCESS_PATTERN}')" >&2
        if [[ "${REQUIRE_REMOTE}" == "1" ]]; then
            exit 1
        fi
        exit 0
    fi
fi

echo "[remote-autoconnect] connected: ${SSH_HOST}:${REMOTE_DIR}"
