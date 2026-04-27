<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import M3Surface from "$lib/components/M3Surface.svelte";
  import LoadingDots from "$lib/components/LoadingDots.svelte";
  import CoverageDetail from "$lib/components/CoverageDetail.svelte";
  import CoverageBreakdown from "$lib/components/CoverageBreakdown.svelte";
  import TuiPanel from "$lib/components/tui/TuiPanel.svelte";
  import TuiStreamToolbar from "$lib/components/tui/TuiStreamToolbar.svelte";
  import type { RefreshStateData, ProgressOverview, DbCohorts } from "./+page";

  type ProviderStatus = "healthy" | "rate_limited" | "error";

  interface ProviderHealth {
    provider: string;
    status: ProviderStatus;
    error_streak: number;
    last_success_at: string | null;
  }

  let refreshState = $state<RefreshStateData | null>(null);
  let progress = $state<ProgressOverview | null>(null);
  let prevMissingFields = $state<Record<string, number> | null>(null);
  let providers = $state<ProviderHealth[]>([]);
  let coreLoading = $state(true);
  let progressLoading = $state(true);
  let lastUpdated = $state<Date | null>(null);

  // ── Log viewer state ────────────────────────────────────────────────────────
  let logLines = $state<string[]>([]);
  let logSource = $state<"miner" | "api">("miner");
  let logLoading = $state(false);
  let streamEl = $state<HTMLElement | null>(null);
  // Incrementing this forces the effect to re-run (reconnect) even when source hasn't changed
  let reconnectKey = $state(0);

  // ── Log filter state ────────────────────────────────────────────────────────
  // Each set holds the active selections for its category.
  // An empty set means "show all" (same as ALL).
  let filterLevels = $state(new Set<string>());
  let filterTags = $state(new Set<string>());
  let filterMinutes = $state(new Set<number>());
  // true = newest at top (default), false = newest at bottom
  let logNewestTop = $state(true);
  // true = wrap long lines, false = single-line + horizontal scroll
  let logWrap = $state(false);

  function toggleSet<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  // ── Live SSE stream ──────────────────────────────────────────────────────────
  // Opens an EventSource for the active source; restarts when logSource or reconnectKey changes.
  $effect(() => {
    if (!browser) return;
    const src = logSource;
    void reconnectKey; // declare dependency so ↻ can force a reconnect
    logLines = [];
    logLoading = true;

    const es = new EventSource(`/api/logs/stream?source=${src}`);

    es.onmessage = (e: MessageEvent<string>) => {
      logLoading = false;
      if (e.data.trim()) {
        // Keep latest 500 lines; order controlled by logNewestTop
        logLines =
          logLines.length >= 500
            ? [...logLines.slice(-499), e.data]
            : [...logLines, e.data];
      }
    };

    // Do NOT close on error — let EventSource auto-reconnect every 3 s.
    // Only update loading state so the UI reflects the reconnecting state.
    es.onerror = () => {
      logLoading = false;
    };

    return () => {
      es.close();
    };
  });

  // ── Log parsing ──────────────────────────────────────────────────────────────
  // Matches localized lines: YYYY-MM-DD HH:MM:SS  [LEVEL]  name  message
  // Also accepts bare LEVEL (legacy / uvicorn lines) for robustness.
  const _LOG_LEVEL_RE =
    /^\d{4}-\d{2}-\d{2} (\d{2}:\d{2}:\d{2})\s+\[?(DEBUG|INFO|WARNING|WARN|ERROR|CRITICAL)\]?\s+(.*)/i;

  function parseLogLine(raw: string): {
    ts: string;
    level: string;
    detail: string;
    tsMs: number;
  } {
    const loc = localizeLogLine(raw);
    const m = _LOG_LEVEL_RE.exec(loc);
    // Parse tsMs from the raw (UTC) line so time filtering is accurate
    const rawDt = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/.exec(raw);
    const tsMs = rawDt
      ? new Date(rawDt[1].replace(" ", "T") + "Z").getTime()
      : 0;
    if (m) return { ts: m[1], level: m[2].toUpperCase(), detail: m[3], tsMs };
    const ts = /^\d{4}-\d{2}-\d{2} (\d{2}:\d{2}:\d{2})/.exec(loc);
    return { ts: ts ? ts[1] : "", level: "", detail: loc, tsMs };
  }

  function levelColor(level: string): string {
    if (level === "ERROR" || level === "CRITICAL") return "#ff4d57";
    if (level === "WARNING" || level === "WARN") return "#f5a623";
    if (level === "INFO") return "#4F9CF9";
    return "rgba(200,212,207,0.28)";
  }

  function levelTag(
    level: string,
    detail: string,
  ): { label: string; color: string } {
    const d = detail.toLowerCase();
    if (level === "ERROR" || level === "CRITICAL")
      return { label: "ERR", color: "#ff4d57" };
    if (d.includes("429") || d.includes("rate limit"))
      return { label: "LIMIT", color: "#f5a623" };
    if (level === "WARNING" || level === "WARN")
      return { label: "WARN", color: "#f5a623" };
    if (d.includes("start") || d.includes("launch") || d.includes("init"))
      return { label: "START", color: "#1ddf72" };
    if (d.includes("complete") || d.includes("success") || d.includes("finish"))
      return { label: "OK", color: "#1ddf72" };
    if (d.includes("skip")) return { label: "SKIP", color: "#9aa7a0" };
    if (level === "INFO") return { label: "INFO", color: "#4F9CF9" };
    if (level === "DEBUG")
      return { label: "DBG", color: "rgba(200,212,207,0.25)" };
    return { label: "—", color: "rgba(200,212,207,0.2)" };
  }

  const activeFilterCount = $derived(
    filterLevels.size + filterTags.size + filterMinutes.size,
  );

  const parsedLogLines = $derived.by(() => {
    const now = Date.now();
    // For time: keep a row if it falls within ANY of the selected windows.
    const timeActive = filterMinutes.size > 0;
    const maxWindowMs = timeActive
      ? Math.max(...Array.from(filterMinutes)) * 60_000
      : 0;
    const base = logLines
      .filter((l) => l.trim().length > 0)
      .map((raw) => parseLogLine(raw))
      .filter((row) => {
        if (timeActive && row.tsMs > 0 && now - row.tsMs > maxWindowMs)
          return false;
        if (filterLevels.size > 0 && !filterLevels.has(row.level)) return false;
        if (
          filterTags.size > 0 &&
          !filterTags.has(levelTag(row.level, row.detail).label)
        )
          return false;
        return true;
      });
    return logNewestTop ? base.toReversed() : base;
  });

  function parseServerDate(iso: string): Date {
    const normalized = iso
      .replace(/(\.\d{3})\d*/, "$1")
      .replace(/([^Z])$/, "$1Z");
    return new Date(normalized);
  }

  function formatRelative(iso: string | null | undefined): string {
    if (!iso) return "never";
    const date = parseServerDate(iso);
    if (isNaN(date.getTime())) return "never";
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  }

  function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return "—";
    const date = parseServerDate(iso);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function formatPct(v: number): string {
    return Number.isFinite(v) ? `${v.toFixed(1)}%` : "—";
  }

  // ── Log timestamp localisation ───────────────────────────────────────────────
  // Server runs in UTC; the raw log lines contain naive UTC timestamps in the
  // format "YYYY-MM-DD HH:MM:SS".  Rewrite them to the browser's local time so
  // the displayed time matches the user's clock.

  const _LOG_TS_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/;
  const _p2 = (n: number) => String(n).padStart(2, "0");

  function localizeLogLine(line: string): string {
    const m = _LOG_TS_RE.exec(line);
    if (!m) return line;
    const d = new Date(`${m[1]}T${m[2]}Z`); // treat as UTC
    if (isNaN(d.getTime())) return line;
    const local = `${d.getFullYear()}-${_p2(d.getMonth() + 1)}-${_p2(d.getDate())} ${_p2(d.getHours())}:${_p2(d.getMinutes())}:${_p2(d.getSeconds())}`;
    return local + line.slice(m[0].length);
  }

  function coverageColor(pct: number): string {
    if (!Number.isFinite(pct)) return "var(--tv-text-muted)";
    if (pct >= 90) return "var(--status-ok)";
    if (pct >= 60) return "var(--status-warn)";
    return "var(--status-error)";
  }

  // ── Provider helpers ────────────────────────────────────────────────────────

  function providerStatusColor(status: ProviderStatus): string {
    switch (status) {
      case "healthy":
        return "var(--status-ok)";
      case "rate_limited":
        return "var(--status-warn)";
      case "error":
        return "var(--status-error)";
      default:
        return "var(--tv-text-muted)";
    }
  }

  function providerStatusLabel(status: ProviderStatus): string {
    switch (status) {
      case "healthy":
        return "Healthy";
      case "rate_limited":
        return "Rate limited";
      case "error":
        return "Error";
      default:
        return status;
    }
  }

  // ── Cycle health ────────────────────────────────────────────────────────────
  // "error" when stalled (age > 3× interval) OR ≥5 consecutive failures.
  // A small streak of failures that is recent is "warn" — transient rate limits etc.

  const cycleStatus = $derived((): "ok" | "warn" | "error" | "unknown" => {
    if (!refreshState) return "unknown";
    if (!refreshState.last_cycle_at) return "unknown";
    const ageSec =
      (Date.now() - parseServerDate(refreshState.last_cycle_at).getTime()) /
      1000;
    const interval = progress?.intervalSec ?? 300;
    if (ageSec > interval * 3) return "error"; // genuinely stalled
    const consecutiveFails =
      refreshState.current_state?.consecutive_failures ?? 0;
    if (consecutiveFails >= 5) return "error"; // persistently failing
    if (!refreshState.last_cycle_success) return "warn"; // recent failure, still cycling
    if (ageSec > interval * 1.5) return "warn"; // overdue but last was ok
    return "ok";
  });

  const cycleStatusColor = $derived((): string => {
    switch (cycleStatus()) {
      case "ok":
        return "var(--status-ok)";
      case "warn":
        return "var(--status-warn)";
      case "error":
        return "var(--status-error)";
      default:
        return "var(--tv-text-muted)";
    }
  });

  // ── Fetch logic ─────────────────────────────────────────────────────────────

  async function fetchAll() {
    // Fetch fast endpoints (refresh-state, provider-health) first so the core
    // dashboard renders immediately, independent of the slow progress overview.
    const corePromise = Promise.all([
      fetch("/api/refresh-state"),
      fetch("/api/provider-health"),
    ]).then(async ([rsRes, provRes]) => {
      if (rsRes.ok) {
        const payload = await rsRes.json();
        if (payload) refreshState = payload as RefreshStateData;
      }
      if (provRes.ok) {
        const payload = await provRes.json();
        if (Array.isArray(payload)) providers = payload;
      }
    });

    const progressPromise = fetch("/api/progress")
      .then(async (res) => {
        if (res.ok) {
          const payload = await res.json();
          if (payload) {
            const prev = progress?.missingClarity?.topMissingItemsByField;
            if (prev) prevMissingFields = prev;
            progress = payload as ProgressOverview;
          }
        }
      })
      .catch(() => {
        /* keep last known state */
      })
      .finally(() => {
        progressLoading = false;
      });

    try {
      await corePromise;
    } catch {
      // keep last known state on transient errors
    } finally {
      coreLoading = false;
      lastUpdated = new Date();
    }

    await progressPromise;
  }

  onMount(() => {
    if (!browser) return;
    void fetchAll();
    const id = setInterval(() => void fetchAll(), 30_000);
    return () => clearInterval(id);
  });
</script>

<main class="t-root">
  <!-- ══ HEADER ══════════════════════════════════════════════════════════════ -->
  <div class="t-infobar">
    <span class="t-infolabel">SYSTEM·DASHBOARD</span>
    <div class="t-infoflow">
      {#if !coreLoading}
        <span class="t-infoitem">
          <span class="t-infok">CYCLE</span>
          <span class="t-infov" style="color:{cycleStatusColor()};"
            >{cycleStatus() === "ok"
              ? "HEALTHY"
              : cycleStatus() === "warn"
                ? "WARN"
                : cycleStatus() === "error"
                  ? "STALLED"
                  : "—"}</span
          >
        </span>
        {#if providers.length > 0}
          {@const hc = providers.filter((p) => p.status === "healthy").length}
          {@const pc =
            hc === providers.length
              ? "var(--status-ok)"
              : hc === 0
                ? "var(--status-error)"
                : "var(--status-warn)"}
          <span class="t-infodot" aria-hidden="true">◆</span>
          <span class="t-infoitem">
            <span class="t-infok">PROVIDERS</span>
            <span class="t-infov" style="color:{pc};"
              >{hc}/{providers.length}</span
            >
          </span>
        {/if}
        {#if progress && !progressLoading}
          <span class="t-infodot" aria-hidden="true">◆</span>
          <span class="t-infoitem">
            <span class="t-infok">COVERAGE</span>
            <span
              class="t-infov"
              style="color:{coverageColor(progress.totals.coveragePct)};"
              >{formatPct(progress.totals.coveragePct)}</span
            >
          </span>
          <span class="t-infodot" aria-hidden="true">◆</span>
          <span class="t-infoitem">
            <span class="t-infok">SNAPSHOT</span>
            <span class="t-infov"
              >{formatRelative(progress.snapshotTs ?? progress.asOf)}</span
            >
          </span>
        {/if}
        {#if progress?.dbCohorts}
          <span class="t-infodot" aria-hidden="true">◆</span>
          <span class="t-infoitem">
            <span class="t-infok">DB</span>
            <span class="t-infov"
              >{progress.dbCohorts.totalInDb.toLocaleString()}</span
            >
          </span>
        {/if}
      {/if}
    </div>
    <span class="t-infoclock"
      >{lastUpdated
        ? lastUpdated.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
        : "--:--:--"} UTC</span
    >
    <button class="t-infobtn" onclick={fetchAll} title="Refresh">↻</button>
  </div>
  <!-- ══ MAIN 3-PANE GRID ═══════════════════════════════════════════════════ -->
  <div class="t-main">
    <!-- ── LEFT COLUMN: Operations ─────────────────────────────────────── -->
    <div class="t-col t-col-l">
      <!-- Alerts (cycle errors surfaced here, not as a layout-shifting banner) -->
      {#if refreshState && !refreshState.last_cycle_success && refreshState.current_state?.error}
        <div class="alert-panel-wrap">
          <TuiPanel label="⚠ ALERT">
            <div class="alert-title">
              CYCLE FAILING{(refreshState.current_state.consecutive_failures ??
                0) > 1
                ? ` · ${refreshState.current_state.consecutive_failures}×`
                : ""}
            </div>
            <div class="alert-msg">{refreshState.current_state.error}</div>
          </TuiPanel>
        </div>
      {/if}
      <!-- Miner Cycle -->
      <TuiPanel
        label="MINER CYCLE // {refreshState
          ? cycleStatus() === 'ok'
            ? 'HEALTHY'
            : cycleStatus() === 'warn'
              ? 'WARNING'
              : cycleStatus() === 'error'
                ? 'STALLED'
                : 'UNKNOWN'
          : '—'}"
      >
        {#if !refreshState}
          <p class="t-empty">no cycle data</p>
        {:else}
          <div class="m-row">
            <span class="m-k">cycles</span><span class="m-v"
              >{refreshState.cycle_count ?? "—"}</span
            >
          </div>
          <div class="m-row">
            <span class="m-k">last cycle</span><span class="m-v"
              >{formatDateTime(refreshState.last_cycle_at)}</span
            >
          </div>
          <div class="m-row">
            <span class="m-k">age</span><span
              class="m-v"
              style="color:{cycleStatusColor()};"
              >{formatRelative(refreshState.last_cycle_at)}</span
            >
          </div>
          <div class="m-row">
            <span class="m-k">last success</span><span
              class="m-v"
              style="color:{refreshState.last_cycle_success
                ? 'var(--status-ok)'
                : 'var(--status-error)'};"
              >{refreshState.last_cycle_success ? "YES" : "NO"}</span
            >
          </div>
          {#if (refreshState.current_state?.consecutive_failures ?? 0) > 0}
            <div class="m-row">
              <span class="m-k">failures</span><span
                class="m-v"
                style="color:var(--status-error);"
                >{refreshState.current_state?.consecutive_failures}</span
              >
            </div>
          {/if}
          <div class="m-row">
            <span class="m-k">interval</span><span class="m-v"
              >{progress?.intervalSec ? `${progress.intervalSec}s` : "—"}</span
            >
          </div>
        {/if}
      </TuiPanel>

      <!-- Provider Health -->
      <TuiPanel
        label="PROVIDER HEALTH // {providers.filter(
          (p) => p.status === 'healthy',
        ).length}/{providers.length} OK"
      >
        {#if providers.length === 0}
          <p class="t-empty">no provider data</p>
        {:else}
          {#each providers as p (p.provider)}
            <div class="prov-row">
              <span class="prov-name">{p.provider}</span>
              <span
                class="prov-status"
                style="color:{providerStatusColor(p.status)};"
              >
                {#if p.status === "error" && p.error_streak > 0}{p.error_streak}
                  ERR{:else if p.status === "rate_limited" && p.error_streak > 0}LIMIT
                  · {p.error_streak}{:else}{providerStatusLabel(
                    p.status,
                  ).toUpperCase()}{/if}
              </span>
              <span class="prov-last">{formatRelative(p.last_success_at)}</span>
            </div>
          {/each}
        {/if}
      </TuiPanel>

      <!-- DB Cohorts -->
      <TuiPanel
        label="DB COIN COHORTS // {progress?.dbCohorts
          ? progress.dbCohorts.totalInDb.toLocaleString() + ' TOTAL'
          : '—'}"
      >
        {#if !progress?.dbCohorts}
          <p class="t-empty">no cohort data</p>
        {:else}
          {@const c = progress.dbCohorts as DbCohorts}
          <div class="m-row">
            <span class="m-k">total in db</span><span class="m-v"
              >{c.totalInDb.toLocaleString()}</span
            >
          </div>
          <div class="m-row">
            <span class="m-k">paprika-ranked</span><span class="m-v"
              >{c.paprikaTracked.toLocaleString()}</span
            >
          </div>
          <div class="m-row">
            <span class="m-k">ticker-only</span><span class="m-v"
              >{c.tickerOnly.toLocaleString()}</span
            >
          </div>
          <div class="m-row">
            <span class="m-k">current snapshot</span><span class="m-v cohort-hl"
              >{c.currentSnapshot.toLocaleString()}</span
            >
          </div>
          <div class="m-row">
            <span class="m-k">coingecko-enriched</span><span class="m-v"
              >{c.coingeckoEnriched.toLocaleString()}</span
            >
          </div>
        {/if}
      </TuiPanel>

      <!-- Data Coverage -->
      <TuiPanel
        label="DATA COVERAGE // {progress
          ? formatPct(progress.totals.coveragePct)
          : '\u2014'}"
      >
        {#if progressLoading}
          <LoadingDots label="Loading" />
        {:else if !progress}
          <p class="t-empty">no coverage data</p>
        {:else}
          <div class="m-row">
            <span class="m-k">overall</span><span
              class="m-v"
              style="color:{coverageColor(progress.totals.coveragePct)};"
              >{formatPct(progress.totals.coveragePct)}</span
            ><span class="m-s"
              >{progress.totals.populated}/{progress.totals.expected}</span
            >
          </div>
          <div class="m-row">
            <span class="m-k">market</span><span
              class="m-v"
              style="color:{coverageColor(
                progress.sections.marketCoins.coveragePct,
              )};">{formatPct(progress.sections.marketCoins.coveragePct)}</span
            ><span class="m-s"
              >{progress.sections.marketCoins.populated}/{progress.sections
                .marketCoins.expected}</span
            >
          </div>
          <div class="m-row">
            <span class="m-k">breakdown</span><span
              class="m-v"
              style="color:{coverageColor(
                progress.sections.coinBreakdown.coveragePct,
              )};"
              >{formatPct(progress.sections.coinBreakdown.coveragePct)}</span
            ><span class="m-s"
              >{progress.sections.coinBreakdown.populated}/{progress.sections
                .coinBreakdown.expected}</span
            >
          </div>
          <div class="m-row">
            <span class="m-k">charts</span><span
              class="m-v"
              style="color:{coverageColor(
                progress.sections.charts.coveragePct,
              )};">{formatPct(progress.sections.charts.coveragePct)}</span
            ><span class="m-s"
              >{progress.sections.charts.populated}/{progress.sections.charts
                .expected}</span
            >
          </div>
        {/if}
      </TuiPanel>

      <!-- Freshness -->
      <TuiPanel
        label="FRESHNESS // {progress
          ? `AS OF ${formatRelative(progress.snapshotTs ?? progress.asOf)}`
          : '\u2014'}"
      >
        {#if !progress}
          <p class="t-empty">\u2014</p>
        {:else}
          <div class="m-row">
            <span class="m-k">fresh</span><span
              class="m-v"
              style="color:var(--status-ok);">{progress.freshness.fresh}</span
            >
          </div>
          <div class="m-row">
            <span class="m-k">warning</span><span
              class="m-v"
              style="color:var(--status-warn);"
              >{progress.freshness.warning}</span
            >
          </div>
          <div class="m-row">
            <span class="m-k">stale</span><span
              class="m-v"
              style="color:var(--status-error);"
              >{progress.freshness.stale}</span
            >
          </div>
          {#if progress.freshness.unknown > 0}
            <div class="m-row">
              <span class="m-k">unknown</span><span class="m-v"
                >{progress.freshness.unknown}</span
              >
            </div>
          {/if}
        {/if}
      </TuiPanel>

      <!-- Coverage Detail -->
      <TuiPanel
        label="COVERAGE DETAIL // {progress?.missingClarity
          ? progress.missingClarity.expectedCoins.toLocaleString() + ' COINS'
          : '\u2014'}"
      >
        {#if progressLoading}
          <LoadingDots label="Loading" />
        {:else if !progress}
          <p class="t-empty">no coverage data</p>
        {:else if !progress.missingClarity}
          <p class="t-empty">no field-level breakdown</p>
        {:else}
          <CoverageDetail
            missingClarity={progress.missingClarity}
            chartTimeframes={progress.chartTimeframes}
          />
        {/if}
      </TuiPanel>
    </div>
    <!-- ── CENTER COLUMN: LOG STREAM ───────────────────────────────────── -->
    <div class="t-col t-col-c">
      <div class="log-panel">
        {#snippet filterDropdown()}
          <div
            class="log-filter-dropdown"
            role="dialog"
            aria-label="Log filters"
          >
            <div class="lfd-section">
              <div class="lfd-label">
                TIME{#if filterMinutes.size > 1}
                  <span class="lfd-multi-hint">(union)</span>{/if}
              </div>
              <div class="lfd-chips">
                {#each [[5, "5m"], [15, "15m"], [60, "1h"], [240, "4h"]] as [mins, label] (label)}
                  <button
                    class="lfd-chip"
                    class:lfd-chip-on={filterMinutes.has(mins as number)}
                    onclick={() => {
                      filterMinutes = toggleSet(filterMinutes, mins as number);
                    }}>{label}</button
                  >
                {/each}
              </div>
            </div>
            <div class="lfd-section">
              <div class="lfd-label">LEVEL</div>
              <div class="lfd-chips">
                {#each ["DEBUG", "INFO", "WARNING", "ERROR"] as lv (lv)}
                  <button
                    class="lfd-chip"
                    class:lfd-chip-on={filterLevels.has(lv)}
                    onclick={() => {
                      filterLevels = toggleSet(filterLevels, lv);
                    }}>{lv}</button
                  >
                {/each}
              </div>
            </div>
            <div class="lfd-section">
              <div class="lfd-label">TAG</div>
              <div class="lfd-chips">
                {#each ["ERR", "WARN", "LIMIT", "START", "OK", "SKIP", "INFO", "DBG"] as tg (tg)}
                  <button
                    class="lfd-chip"
                    class:lfd-chip-on={filterTags.has(tg)}
                    onclick={() => {
                      filterTags = toggleSet(filterTags, tg);
                    }}>{tg}</button
                  >
                {/each}
              </div>
            </div>
            {#if activeFilterCount > 0}
              <button
                class="lfd-reset"
                onclick={() => {
                  filterLevels = new Set();
                  filterTags = new Set();
                  filterMinutes = new Set();
                }}>CLEAR FILTERS</button
              >
            {/if}
          </div>
        {/snippet}
        <div class="log-plabel">
          <span class="log-plabel-text"
            >LOG STREAM // {logSource.toUpperCase()} // LIVE{logLines.length > 0
              ? ` // ${logLines.length}`
              : ""}</span
          >
          <TuiStreamToolbar
            source={logSource}
            onSourceChange={(s) => {
              logSource = s;
            }}
            onReconnect={() => {
              reconnectKey += 1;
            }}
            reversed={!logNewestTop}
            onFlip={() => {
              logNewestTop = !logNewestTop;
            }}
            wrapped={logWrap}
            onWrap={() => {
              logWrap = !logWrap;
            }}
            {activeFilterCount}
            {filterDropdown}
          />
        </div>
        <div
          class="t-stream"
          class:t-stream-wrap={logWrap}
          bind:this={streamEl}
        >
          {#if logLoading && logLines.length === 0}
            <LoadingDots label="Loading logs" />
          {:else if parsedLogLines.length === 0}
            <p class="t-empty">no log lines found</p>
          {:else}
            <div class="stream-hdr">
              <span>TIME</span><span>LEVEL</span><span>DETAIL</span><span
                >TAG</span
              >
            </div>
            <div class="stream-rule" aria-hidden="true"></div>
            {#each parsedLogLines as row, i (i)}
              {@const tag = levelTag(row.level, row.detail)}
              <div class="stream-row">
                <span class="sr-ts">{row.ts}</span>
                <span class="sr-kind" style="color:{levelColor(row.level)};"
                  >{row.level ? `[${row.level}]` : ""}</span
                >
                <span class="sr-detail">{row.detail}</span>
                <span class="sr-tag" style="color:{tag.color};"
                  >{tag.label}</span
                >
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
    <!-- ── RIGHT COLUMN: Breakdown + Fill Tracker ──────────────────────── -->
    <div class="t-col t-col-r">
      <!-- Coverage Breakdown -->
      <TuiPanel
        label="BREAKDOWN // {progress?.missingClarity
          ? progress.missingClarity.expectedCoins.toLocaleString() + ' COINS'
          : '\u2014'}"
      >
        {#if progressLoading}
          <LoadingDots label="Loading" />
        {:else if !progress}
          <p class="t-empty">no data</p>
        {:else}
          <CoverageBreakdown
            missingClarity={progress.missingClarity}
            metadataStage={progress.metadataStage}
            totalCoins={progress.missingClarity?.expectedCoins ?? 0}
            priceTier={progress.priceTier}
            previousMissing={prevMissingFields ?? undefined}
          />
        {/if}
      </TuiPanel>
    </div>
  </div>
</main>

<style>
  /* ── Root: viewport-filling 3-pane terminal ────────────────────────────── */
  .t-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--tv-bg, #030303);
    color: var(--tv-text-primary);
    font-family: var(
      --tui-font,
      "JetBrains Mono",
      "Menlo",
      "Consolas",
      monospace
    );
    font-size: var(--tui-font-size, 0.7rem);
    line-height: var(--tui-line-height, 1.55);
  }

  /* ── Infobar (SYSTEM·DASHBOARD — ticker-bar style strip) ───────────────── */
  .t-infobar {
    display: flex;
    align-items: center;
    height: var(--tui-infobar-height, 1.65rem);
    background: var(--tui-infobar-bg, #050008);
    border-bottom: 1px solid var(--tui-infobar-border, rgba(176, 38, 255, 0.18));
    flex-shrink: 0;
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .t-infolabel {
    flex-shrink: 0;
    padding: 0 0.65rem;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--tui-infobar-label-color, rgba(176, 38, 255, 0.75));
    border-right: 1px solid var(--tui-infobar-border, rgba(176, 38, 255, 0.18));
    height: 100%;
    display: flex;
    align-items: center;
  }
  .t-infoflow {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0 0.6rem;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
  .t-infoitem {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3rem;
    flex-shrink: 0;
  }
  .t-infok {
    font-size: 0.58rem;
    letter-spacing: 0.06em;
    color: var(--tui-muted, rgba(200, 212, 207, 0.4));
  }
  .t-infov {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--tv-text-primary);
    font-variant-numeric: tabular-nums;
  }
  .t-infodot {
    color: var(--tui-sep-color, rgba(176, 38, 255, 0.3));
    font-size: 0.45rem;
    flex-shrink: 0;
  }
  .t-infoclock {
    color: var(--tui-muted, rgba(200, 212, 207, 0.4));
    font-size: 0.62rem;
    font-variant-numeric: tabular-nums;
    padding: 0 0.4rem;
    flex-shrink: 0;
    margin-left: auto;
  }
  .t-infobtn {
    padding: 0;
    width: 1.8rem;
    height: 100%;
    font-family: inherit;
    font-size: 0.85rem;
    border: 0;
    border-left: 1px solid var(--tui-infobar-border, rgba(176, 38, 255, 0.18));
    background: transparent;
    color: var(--tui-infobar-label-color, rgba(176, 38, 255, 0.75));
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s;
  }
  .t-infobtn:hover {
    color: var(--tv-highlight-soft, #d56bff);
  }

  /* ── Alert panel (in left column — no layout shift) ─────────────────────── */
  .alert-panel-wrap :global(.t-panel) {
    border-bottom-color: rgba(255, 77, 87, 0.45);
    background: rgba(255, 77, 87, 0.04);
  }
  .alert-panel-wrap :global(.t-plabel) {
    color: var(--status-error) !important;
    background: rgba(255, 77, 87, 0.06);
    border-bottom-color: rgba(255, 77, 87, 0.2);
  }
  .alert-title {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--status-error);
  }
  .alert-msg {
    margin-top: 0.3rem;
    font-size: 0.62rem;
    color: rgba(200, 212, 207, 0.7);
    line-height: 1.45;
    word-break: break-all;
  }

  /* ── Main grid ─────────────────────────────────────────────────────────── */
  .t-main {
    flex: 1;
    display: grid;
    grid-template-columns: 17rem 1fr 19rem;
    overflow: hidden;
  }

  .t-col {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    overflow-y: auto;
    overflow-x: hidden;
    border-right: 1px solid var(--tui-col-border, rgba(176, 38, 255, 0.12));
    scrollbar-width: thin;
    scrollbar-color: var(--tui-panel-grow-scrollbar, rgba(176, 38, 255, 0.15))
      transparent;
  }
  .t-col-r {
    border-right: none;
  }
  .t-col-c {
    overflow: hidden;
  }

  /* ── Log panel (center column fill) ──────────────────────────────────── */
  .log-panel {
    flex: none;
    height: calc(100% - 9rem);
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-bottom: 1px solid rgba(176, 38, 255, 0.18);
  }
  /* Label bar: same visual as TuiPanel .t-plabel but flexed for inline tools */
  .log-plabel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.28rem 0.3rem 0.22rem 0.5rem;
    background: var(--tui-plabel-bg, rgba(176, 38, 255, 0.055));
    border-bottom: 1px solid var(--tui-plabel-border, rgba(176, 38, 255, 0.1));
    flex-shrink: 0;
    gap: 0.4rem;
    overflow: hidden;
  }
  .log-plabel-text {
    color: var(--tui-plabel-color, rgba(176, 38, 255, 0.72));
    font-size: 0.59rem;
    letter-spacing: 0.1em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  /* ── Log filter dropdown ───────────────────────────────────────────────── */
  .log-filter-dropdown {
    z-index: 200;
    min-width: 13rem;
    background: #0e1012;
    border: 1px solid var(--tv-border);
    padding: 0.5rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  }
  .lfd-section {
    display: flex;
    flex-direction: column;
    gap: 0.18rem;
  }
  .lfd-label {
    font-size: 0.55rem;
    letter-spacing: 0.1em;
    color: rgba(176, 38, 255, 0.55);
    margin-bottom: 0.1rem;
  }
  .lfd-multi-hint {
    font-size: 0.5rem;
    letter-spacing: 0.04em;
    color: rgba(176, 38, 255, 0.35);
    font-weight: 400;
  }
  .lfd-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
  }
  .lfd-chip {
    padding: 0.06rem 0.35rem;
    font-family: inherit;
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    background: transparent;
    border: 1px solid var(--tv-border);
    color: var(--tv-text-muted);
    cursor: pointer;
    transition:
      color 0.1s,
      border-color 0.1s,
      background 0.1s;
  }
  .lfd-chip:hover {
    border-color: rgba(176, 38, 255, 0.4);
    color: var(--tv-text-primary);
  }
  .lfd-chip-on {
    background: rgba(176, 38, 255, 0.15);
    border-color: rgba(176, 38, 255, 0.5);
    color: var(--tv-highlight-soft);
  }
  .lfd-reset {
    margin-top: 0.1rem;
    padding: 0.1rem 0.4rem;
    font-family: inherit;
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.07em;
    background: transparent;
    border: 1px solid rgba(255, 77, 87, 0.35);
    color: rgba(255, 77, 87, 0.7);
    cursor: pointer;
    width: 100%;
    transition:
      color 0.1s,
      border-color 0.1s;
  }
  .lfd-reset:hover {
    color: #ff4d57;
    border-color: #ff4d57;
  }
  /* ── Metric rows ────────────────────────────────────────────────────────── */
  .m-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 0.5rem;
    align-items: baseline;
    padding: 0.1rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
  .m-row:last-child {
    border-bottom: none;
  }

  .m-k {
    color: rgba(200, 212, 207, 0.5);
    font-size: 0.65rem;
    letter-spacing: 0.02em;
  }
  .m-v {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--tv-text-primary);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .m-s {
    font-size: 0.6rem;
    color: rgba(200, 212, 207, 0.4);
    font-variant-numeric: tabular-nums;
    text-align: right;
    min-width: 9ch;
  }

  .cohort-hl {
    color: var(--tv-highlight-soft) !important;
  }

  /* ── Provider rows ──────────────────────────────────────────────────────── */
  .prov-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 0.4rem;
    align-items: baseline;
    padding: 0.1rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
  .prov-row:last-child {
    border-bottom: none;
  }

  .prov-name {
    color: var(--tv-text-primary);
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .prov-status {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-align: right;
  }
  .prov-last {
    color: rgba(200, 212, 207, 0.4);
    font-size: 0.6rem;
    min-width: 7ch;
    text-align: right;
  }

  /* ── Stream / log (matches signal stream in TradingTerminalView) ─────────── */
  .t-stream {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.35rem 0.5rem 0.3rem;
    min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(176, 38, 255, 0.3) transparent;
  }

  .stream-hdr {
    display: grid;
    grid-template-columns: 7ch 9ch 1fr 5ch;
    gap: 0.45rem;
    padding-bottom: 0.2rem;
    color: rgba(176, 38, 255, 0.58);
    font-size: 0.59rem;
    letter-spacing: 0.08em;
  }

  .stream-rule {
    height: 1px;
    background: rgba(176, 38, 255, 0.12);
    margin-bottom: 0.15rem;
  }

  .stream-row {
    display: grid;
    grid-template-columns: 7ch 9ch 1fr 5ch;
    gap: 0.45rem;
    padding: 0.06rem 0;
    line-height: 1.55;
  }

  .sr-ts {
    color: rgba(200, 212, 207, 0.3);
    font-variant-numeric: tabular-nums;
  }
  .sr-kind {
    font-weight: 600;
  }
  /* Default (wrap off): detail scrolls horizontally inside its cell */
  .sr-detail {
    color: rgba(200, 212, 207, 0.72);
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    min-width: 0;
    scrollbar-width: none;
  }
  .sr-detail::-webkit-scrollbar {
    display: none;
  }
  /* Wrap mode: detail wraps instead of scrolling */
  .t-stream-wrap .sr-detail {
    overflow-x: hidden;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .sr-tag {
    text-align: right;
    font-size: 0.61rem;
    letter-spacing: 0.05em;
  }

  /* ── Empty state ────────────────────────────────────────────────────────── */
  .t-empty {
    color: rgba(200, 212, 207, 0.4);
    font-size: 0.68rem;
    letter-spacing: 0.02em;
    margin: 0;
    padding: 0.2rem 0;
  }

  /* ── Responsive: stack columns under 1100px ─────────────────────────────── */
  @media (max-width: 1100px) {
    .t-root {
      height: auto;
      min-height: 0;
    }
    .t-main {
      grid-template-columns: 1fr;
    }
    .t-col {
      border-right: none;
      border-bottom: 1px solid rgba(176, 38, 255, 0.15);
    }
    .t-col:last-child {
      border-bottom: none;
    }
    .t-stream {
      max-height: 60vh;
    }
  }
</style>
