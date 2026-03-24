<!-- LOC cap: 95 (updated: 2026-03-24) -->

# AGENTS.md — yact-web

## Agent rules

- Never commit or push unprompted.
- Always use `YYYY-MM-DD` date format.
- Work on one branch at a time.
- TypeScript-first: use TypeScript for app and package code unless tooling requires JavaScript.
- Svelte conventions: keep `.svelte` and route files strongly typed.
- Use repository scripts first: `./scripts/dev-web.sh` and `./scripts/check.sh`.
- Avoid unnecessary dev server restarts; rely on hot reload when Vite is healthy.
- After each code change, verify live HTTP response with curl against the active dev URL (`http://localhost:5173`) for `/` and the changed route.
- Do not edit files outside this repo unless explicitly requested.
- **Fresh clone / first run**: run `pnpm install` then `pnpm dev:web` once before running `svelte-check` — SvelteKit must generate `.svelte-kit/tsconfig.json` first or type-checking will fail with phantom errors across every file.

## UI coding rules

- **Loading states**: whenever a component has an unavoidable async wait, show the three-dot pulse animation. Use `<LoadingDots>` from `src/lib/components/LoadingDots.svelte` — accepts an optional `label` prop for the `aria-label`. Never leave a blank area or zero-value data visible while data is in flight.
- **Component extraction**: feature logic belongs in dedicated `.svelte` components under `src/lib/`. Route files (`+page.svelte`, `+layout.svelte`) and page-view orchestrators are wiring only — they import components, own top-level state, and pass props. Do not implement rendering logic, formatting, or feature sub-views directly inside orchestration files.

## Troubleshooting Protocol

Collect independent evidence before patching code.

Required evidence sources:

- Dev server/runtime state (`./scripts/dev-web.sh`, terminal status).
- Browser-console relay logs from `/api/debug/client-logs`.
- Debug endpoint state from `/api/debug/snapshot-meta` and `/api/debug/auto-refresh`.
- API proxy behavior from web routes under `/api/*`.

Required workflow:

1. Capture UTC timestamp and context (branch, commit SHA, host, browser URL).
2. Confirm dev server state and capture current terminal output.
3. Capture browser-console relay tail via `/api/debug/client-logs`.
4. Capture debug endpoints and web API proxy responses at the same timestamp.
5. Document a state-ownership map for the affected UI (route loader vs page state vs layout polling).
6. Correlate UI symptoms with relay logs, ownership map, and endpoint payloads.
7. Classify incident: client-runtime, proxy-route, upstream-api, config/env, unknown.
8. Apply the smallest fix and repeat the same capture to confirm resolution.
9. After every code change, run curl probes to confirm non-500 responses before reporting success.

Guardrail: do not switch loading architecture modes in the same incident without a before/after evidence bundle.

```bash
cd /home/ubuntu/server/yact/yact-web
./scripts/capture-web-incident.sh
```

## Docs

Only read these when the task genuinely requires them. Do not load speculatively.

| File                                         | Read when…                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `yact-dev-docs/web/ARCHITECTURE.md`          | adding/changing a route, BFF endpoint, data-loading pattern, or backend dependency                                 |
| `yact-dev-docs/web/DECISIONS.md`             | a design choice has an existing ADR — check before proposing an alternative approach                               |
| `yact-dev-docs/web/DESIGN.md`                | creating or modifying any UI component, colour, typography, or layout                                              |
| `yact-dev-docs/web/PHILOSOPHY.md`            | evaluating a trade-off that affects route responsiveness or state update strategy                                  |
| `yact-dev-docs/web/features/open/ROADMAP.md` | asked to implement a planned feature                                                                               |
| `yact-dev-docs/web/bugs/BUGS.md`             | **always** — before implementing or troubleshooting any feature, to avoid reimplementing previously toxic patterns |

## Local scripts

- `./scripts/dev-web.sh` — starts the Svelte app dev server (main branch).
- `./scripts/check.sh` — full check pipeline: `svelte-check` → `knip` → `vitest`.
- Feature dev servers are launched from the metarepo root via `../start-features.sh`.
- Metarepo aliases: `../check.sh` (check pipeline), `../logs.sh web [branch]` (log tailing).
- Use `pnpm install` (not `npm install`) — this repo uses pnpm workspaces.

## Repo structure note

This repo lives at `yact-web/`. Feature branch worktrees are at `yact-web/features/<branch>/` and share these same rules.

## Feature branch notes

Add a row whenever a branch diverges from main in a way that affects agent behaviour (different env vars, patched deps, known broken tests, etc.). Remove on merge.

| Branch                | Port | Notes                                                                             |
| --------------------- | ---- | --------------------------------------------------------------------------------- |
| `topbar-filter-0p88`  | 5176 | —                                                                                 |
| `visual-style`        | 5177 | Excluded from `start-features.sh` — `"exclude"` in `yact-web/features/ports.json` |
| `watchlist-crud-h1eg` | 5178 | —                                                                                 |
