#!/usr/bin/env bash
set -euo pipefail

SSH_HOST="${YACT_REMOTE_SSH_HOST:-ubuntu}"
REMOTE_DIR="${YACT_REMOTE_MINING_DIR:-/home/ubuntu/server/coindata-mining}"
LOCAL_DIR="${YACT_DATA_DIR:-$PWD/.cache}"
SYNC_INTERVAL_SEC="${YACT_REMOTE_DB_SYNC_INTERVAL_SEC:-15}"
CONNECT_TIMEOUT_SEC="${YACT_REMOTE_CONNECT_TIMEOUT_SEC:-5}"

usage() {
    echo "Usage: $0 <pull|push|watch-pull>" >&2
}

sync_pull() {
    mkdir -p "${LOCAL_DIR}"
    rsync -az --omit-dir-times --no-perms --no-owner --no-group \
        -e "ssh -o BatchMode=yes -o ConnectTimeout=${CONNECT_TIMEOUT_SEC}" \
        "${SSH_HOST}:${REMOTE_DIR}/" "${LOCAL_DIR}/"
    echo "[remote-db-sync] pulled ${SSH_HOST}:${REMOTE_DIR} -> ${LOCAL_DIR}"
}

sync_push() {
    mkdir -p "${LOCAL_DIR}"
    ssh -o BatchMode=yes -o ConnectTimeout="${CONNECT_TIMEOUT_SEC}" "${SSH_HOST}" "mkdir -p '${REMOTE_DIR}'"
    rsync -az --omit-dir-times --no-perms --no-owner --no-group \
        -e "ssh -o BatchMode=yes -o ConnectTimeout=${CONNECT_TIMEOUT_SEC}" \
        "${LOCAL_DIR}/" "${SSH_HOST}:${REMOTE_DIR}/"
    echo "[remote-db-sync] pushed ${LOCAL_DIR} -> ${SSH_HOST}:${REMOTE_DIR}"
}

watch_pull() {
    while true; do
        if ! sync_pull; then
            echo "[remote-db-sync] pull failed; retrying in ${SYNC_INTERVAL_SEC}s" >&2
        fi
        sleep "${SYNC_INTERVAL_SEC}"
    done
}

main() {
    local command="${1:-}"
    if [[ -z "${command}" ]]; then
        usage
        exit 1
    fi

    case "${command}" in
        pull)
            sync_pull
            ;;
        push)
            sync_push
            ;;
        watch-pull)
            watch_pull
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

main "$@"
