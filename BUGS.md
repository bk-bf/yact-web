# BUGS

## 2026-03-20 - Coin Detail right column headlines delayed/empty

- Status: fixed
- Area: web coin detail page (`/currencies/{coin_id}`)
- Symptom: right column (`Latest`) showed `No headlines available right now.` for up to 60+ seconds.

### Root cause

- Headlines were coupled to the web `/api/markets` route instead of being fetched independently.
- `/api/markets` has variable latency because it depends on slower market payload computation.
- Coin detail data loading used the markets payload for both highlights and headlines, so a markets timeout/slow response left headlines empty.

### Fix

- Added dedicated web endpoint: `/api/headlines`.
- Decoupled headline fetching from `/api/markets` in coin detail and app shell.
- Kept markets endpoint focused on market/global/highlights payload.
- Added auxiliary retry/backfill logic so right-column content recovers quickly when initial fetch is empty.

### Verification

- `./scripts/check.sh` passed.
- Web build passed.
- Post-fix timing checks showed `/api/headlines` responding fast and independently from `/api/markets`.
