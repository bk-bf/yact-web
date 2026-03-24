#!/usr/bin/env bash
# DEPRECATED — superseded by the metarepo-root start-features.sh, which manages
# both server and web features from a single command.
#
# Usage:  cd /home/ubuntu/server/yact && ./start-features.sh [start|stop|status]
exec "$(cd "$(dirname "$0")/../.." && pwd)/start-features.sh" "$@"

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTS_FILE="$PROJECT_ROOT/features/ports.json"
PIDS_DIR="$PROJECT_ROOT/features/.pids"

# Default: all web features point to stable main server
ANALYTICS_URL="${1:-http://localhost:8000}"

if [[ ! -f "$PORTS_FILE" ]]; then
    echo "[start-features] features/ports.json not found" >&2
    exit 1
fi

command -v python3 >/dev/null 2>&1 || { echo "[start-features] python3 required" >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "[start-features] pnpm required" >&2; exit 1; }

mapfile -t ENTRIES < <(python3 - "$PORTS_FILE" <<'PY'
import json, sys
data = json.loads(open(sys.argv[1]).read())
excluded = set(data.get("exclude", []))
for branch, port in data.items():
    if branch == "exclude" or not isinstance(port, int):
        continue
    if branch in excluded:
        continue
    print(f"{branch} {port}")
PY
)

mapfile -t EXCLUDED < <(python3 - "$PORTS_FILE" <<'PY'
import json, sys
data = json.loads(open(sys.argv[1]).read())
for b in data.get("exclude", []):
    print(b)
PY
)

stop_all() {
    if [[ ! -d "$PIDS_DIR" ]]; then
        echo "[start-features] no .pids dir — nothing to stop"
        return
    fi
    for pid_file in "$PIDS_DIR"/web-*.pid; do
        [[ -f "$pid_file" ]] || continue
        name="$(basename "$pid_file" .pid)"
        pid="$(cat "$pid_file")"
        if kill -0 "$pid" 2>/dev/null; then
            echo "[start-features] stopping $name (pid=$pid)"
            kill "$pid"
        fi
        rm -f "$pid_file"
    done
    echo "[start-features] all feature web servers stopped"
}

status_all() {
    echo "Feature web-server status:"
    for entry in "${ENTRIES[@]}"; do
        branch="${entry%% *}"
        port="${entry##* }"
        pid_file="$PIDS_DIR/web-${branch}.pid"
        state="stopped"
        if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
            state="running (pid=$(cat "$pid_file"))"
        fi
        printf "  %-30s  port=%-6s  %s\n" "$branch" "$port" "$state"
    done
    if [[ ${#EXCLUDED[@]} -gt 0 ]]; then
        echo "  (excluded: ${EXCLUDED[*]})"
    fi
}

case "${1:-}" in
    stop)   stop_all; exit 0 ;;
    status) status_all; exit 0 ;;
    http*)  ANALYTICS_URL="$1"; shift ;;  # explicit API URL passed
    "")     ;;  # default
esac

# ── start ────────────────────────────────────────────────────────────────────

mkdir -p "$PIDS_DIR"

# Pre-flight: verify main server is reachable (the stable target for all web features)
if command -v curl >/dev/null 2>&1; then
    if ! curl -fsS --max-time 5 "${ANALYTICS_URL}/health" >/dev/null 2>&1; then
        echo "[start-features] WARNING: analytics API at ${ANALYTICS_URL} is not responding." >&2
        echo "[start-features] Web servers will start anyway but will fail to load data." >&2
        echo "[start-features] Start yact-server main first:  cd yact-server && ./scripts/bootstrap.sh start" >&2
        echo ""
    else
        echo "[start-features] analytics API reachable at ${ANALYTICS_URL} ✓"
    fi
fi

echo "[start-features] starting feature web servers → ${ANALYTICS_URL}"
echo ""

for entry in "${ENTRIES[@]}"; do
    branch="${entry%% *}"
    port="${entry##* }"
    wt="$PROJECT_ROOT/features/$branch"

    if [[ ! -d "$wt" ]]; then
        echo "  [skip] $branch — worktree not found at $wt"
        continue
    fi

    # Ensure deps are installed (fast no-op if already up to date)
    (cd "$wt" && pnpm install --prefer-offline --silent 2>/dev/null || true)

    # Generate .svelte-kit if not present
    if [[ ! -f "$wt/apps/web/.svelte-kit/tsconfig.json" ]]; then
        (cd "$wt/apps/web" && node_modules/.bin/svelte-kit sync 2>/dev/null || true)
    fi

    LOG_FILE="$wt/logs/web.log"
    mkdir -p "$wt/logs"

    (
        cd "$wt"
        export YACT_WEB_PORT="$port"
        export YACT_ANALYTICS_URL="$ANALYTICS_URL"
        pnpm run dev:web >> "$LOG_FILE" 2>&1
    ) &
    web_pid=$!
    echo "$web_pid" > "$PIDS_DIR/web-${branch}.pid"

    printf "  ✓ %-30s  http://localhost:%-6s → %s  (pid=%s)\n" \
        "$branch" "$port" "$ANALYTICS_URL" "$web_pid"
done

echo ""
echo "[start-features] logs   → features/<branch>/logs/web.log"
echo "[start-features] stop   → ./scripts/start-features.sh stop"
echo "[start-features] status → ./scripts/start-features.sh status"
