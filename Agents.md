<!-- LOC cap: 180 (updated: 2026-03-20) -->
# Agents.md — AI coding agent reference for yact-web

## Agent rules

- **Never commit or push to git unprompted.** Always wait for the user to explicitly ask, or for a slash command (e.g. `/commit`) to trigger it.
- **Date format**: always use `YYYY-MM-DD` (e.g. `2026-03-20`).
- **One branch at a time**: only make changes to the branch the user specifies.
- **TypeScript-first policy**: use TypeScript for app and package code unless tooling requires JavaScript.
- **Svelte-first policy**: for `.svelte` and route work, follow this repository's conventions and keep components/routes strongly typed.
- **Use repository scripts first**: prefer `./scripts/dev-web.sh` and `./scripts/check.sh` over ad-hoc commands.
- **Avoid unnecessary dev server restarts**: if Vite is healthy, rely on hot reload.
- **Repository boundary**: do not edit files under `../yact-server/` unless explicitly requested.

## .github routing

- For prompts/skills/automation related to web work, use files under `yact-web/.github/`.
- Do not use `yact-server/.github/` for web-only tasks.

## Local scripts

- `./scripts/dev-web.sh` — starts the Svelte web app dev server.
- `./scripts/check.sh` — runs repository lint/test checks.
