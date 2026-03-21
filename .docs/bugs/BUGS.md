<!-- LOC cap: 678 (source: 6778, ratio: 0.10, updated: 2026-03-21) -->
# BUGS

## Open

### BUG-002: Markets hydration/navigation flicker (value-style oscillation and transient zero-state)
- **Status**: Open (Partially fixed)
- **Severity**: High
- **First appeared**: 2026-03-21
- **Related roadmap task**: None
- **Area**: UI
- **Summary**: Core navigation blocking and compact-value formatting oscillation are fixed, but transient zero-data state still appears on hard refresh and logo navigation (`/currencies/[id] -> /`, and sometimes `/ -> /` via logo).
- **Partial fix**:
  1. **Commit**: `2909ffd9da5fea50d9a0e4154fa0c0f39421822d`
  2. **Fixed in commit**: route transition delay caused by data fetching/polling contention.
  3. **Fixed in follow-up**: compact value style oscillation (`$2.5T` vs `$2.50T`).
  4. **Still open**: transient zero-data rendering in sticky headbar and/or market summary during refresh/logo navigation.
- **Reproduction steps**:
  1. Open `/currencies/bitcoin`.
  2. Click logo to navigate back to `/`.
  3. Observe market summary cards and compact reference line for first 1-3s.
  4. Repeat with hard reload and inspect network order for `/api/markets`, `/api/headlines?_ts=...`, and `/api/debug/client-logs`.
  5. Optional: while already on `/`, click logo again and verify sticky headbar does not regress to zero values.
- **Expected**: Stable first paint from route data with no zero-state regression and no compact-value oscillation.
- **Actual**: Navigation delay and compact oscillation are resolved, but zero-data state still intermittently appears around the `POST /api/debug/client-logs` window, between successful `/api/markets` and `/api/headlines?_ts=...` requests.
- **Root cause (working hypothesis)**: Remaining issue is a state-adoption race in shell/page ownership during hydration and post-navigation polling windows, not an API availability failure.
- **Fix plan**:
  1. Add focused timing/provenance logs for state writes to sticky headbar and markets page immediately before/after `POST /api/debug/client-logs`.
  2. Verify and enforce monotonic/non-regressive assignment rules for shell global state and page markets state.
  3. Capture before/after incident bundles with the same reproduction path and correlate by timestamp.
  4. Close only after repeated `/currencies/[id] -> /` and `/ -> /` logo clicks show no zero-state regression.

## Closed

### BUG-001: MAX range persisted YTD-like series from web-side fallback snapshots
- **Status**: Closed
- **Severity**: High
- **First appeared**: 2026-03-19
- **Fixed**: 2026-03-20
- **Related roadmap task**: None
- **Area**: Data
- **Summary**: MAX chart data could collapse to YTD-like density when web-local fallback series were persisted as canonical snapshot ranges.
- **Expected**: MAX should represent full available history and not be overwritten by short fallback series.
- **Actual (historical)**: Web-local persistence could store short fallback data for MAX when upstream fetches degraded.
- **Root cause (historical)**: yact-web contained in-repo persistence and fallback snapshot logic that could persist degraded chart ranges.
- **Resolution**: Architecture moved to REST-only data consumption in yact-web and removed web-local persistence/snapshot modules.
- **Evidence commits**:
  1. 49cfa3c45b930dca728ec88ad4d2b47365328404 (snapshot handling moved toward analytics API)
  2. 3b466cf7183740e74f988ebfbf12c80feba9784e (persistent snapshot modules removed from yact-web)
- **Verification notes**:
  1. yact-web no longer contains persistentCoinSnapshot/persistentMarketSnapshot/persistentDatabaseWrite modules.
  2. yact-web no longer stores chart snapshots under apps/web/.cache.
  3. Chart persistence ownership now lives in yact-server; new MAX/YTD integrity issues should be tracked there.

## Bug Report Template

Use this template for new entries:

### BUG-XXX: Short title
- **Status**: Open | Closed
- **Severity**: Low | Medium | High | Critical
- **First appeared**: YYYY-MM-DD
- **Fixed**: YYYY-MM-DD (if closed)
- **Related roadmap task**: T-NNN (if applicable)
- **Area**: UI | API | Analytics | Data | Infra
- **Summary**: One paragraph describing user-visible impact
- **Reproduction steps**:
  1. Step one
  2. Step two
  3. Step three
- **Expected**: Expected behavior
- **Actual**: Observed behavior
- **Root cause**: Optional, after investigation
- **Fix plan**: Optional, before implementation
