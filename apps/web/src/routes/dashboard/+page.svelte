<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import M3Surface from "$lib/components/M3Surface.svelte";
  import LoadingDots from "$lib/components/LoadingDots.svelte";
  import CoverageDetail from "$lib/components/CoverageDetail.svelte";
  import type { RefreshStateData, ProgressOverview, DbCohorts, FieldVelocity } from "./+page";

  type ProviderStatus = "healthy" | "rate_limited" | "error";

  interface ProviderHealth {
    provider: string;
    status: ProviderStatus;
    error_streak: number;
    last_success_at: string | null;
  }

  let refreshState = $state<RefreshStateData | null>(null);
  let progress = $state<ProgressOverview | null>(null);
  let fieldVelocity = $state<FieldVelocity | null>(null);
  let providers = $state<ProviderHealth[]>([]);
  let coreLoading = $state(true);
  let progressLoading = $state(true);
  let velocityLoading = $state(true);
  let lastUpdated = $state<Date | null>(null);

  // ── Log viewer state ────────────────────────────────────────────────────────
  let logLines = $state<string[]>([]);
  let logSource = $state<"miner" | "api">("miner");
  let logLoading = $state(false);
  let streamEl = $state<HTMLElement | null>(null);
  // Incrementing this forces the effect to re-run (reconnect) even when source hasn't changed
  let reconnectKey = $state(0);

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
        // Keep latest 500 lines; newest rendered at top via parsedLogLines.toReversed()
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
  } {
    const loc = localizeLogLine(raw);
    const m = _LOG_LEVEL_RE.exec(loc);
    if (m) return { ts: m[1], level: m[2].toUpperCase(), detail: m[3] };
    const ts = /^\d{4}-\d{2}-\d{2} (\d{2}:\d{2}:\d{2})/.exec(loc);
    return { ts: ts ? ts[1] : "", level: "", detail: loc };
  }

  function levelColor(level: string): string {
    if (level === "ERROR" || level === "CRITICAL") return "#ff4d57";
    if (level === "WARNING" || level === "WARN") return "#f5a623";
    if (level === "INFO") return "rgba(200,212,207,0.65)";
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
    if (level === "INFO") return { label: "INFO", color: "#9aa7a0" };
    if (level === "DEBUG")
      return { label: "DBG", color: "rgba(200,212,207,0.25)" };
    return { label: "—", color: "rgba(200,212,207,0.2)" };
  }

  const parsedLogLines = $derived(
    logLines
      .filter((l) => l.trim().length > 0)
      .map((raw) => parseLogLine(raw))
      .toReversed(),
  );

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
          if (payload) progress = payload as ProgressOverview;
        }
      })
      .catch(() => {
        /* keep last known state */
      })
      .finally(() => {
        progressLoading = false;
      });

    const velocityPromise = fetch("/api/progress/velocity")
      .then(async (res) => {
        if (res.ok) {
          const payload = await res.json();
          if (payload) fieldVelocity = payload as FieldVelocity;
        }
      })
      .catch(() => {
        /* keep last known state */
      })
      .finally(() => {
        velocityLoading = false;
      });

    try {
      await corePromise;
    } catch {
      // keep last known state on transient errors
    } finally {
      coreLoading = false;
      lastUpdated = new Date();
    }

    // progress and velocity settle in the background
    await progressPromise;
    await velocityPromise;
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
  <div class="t-topbar">
    <span class="t-bullet">●</span>
    <h1 class="t-title">SYSTEM·DASHBOARD</h1>
    <span class="t-sep">│</span>
    {#if !coreLoading}
      <div class="t-status">
        <span class="t-kv"
          ><span class="t-k">CYCLE</span><span
            class="t-v"
            style="color:{cycleStatusColor()};"
            >{cycleStatus() === "ok"
              ? "HEALTHY"
              : cycleStatus() === "warn"
                ? "WARN"
                : cycleStatus() === "error"
                  ? "STALLED"
                  : "—"}</span
          ></span
        >
        {#if providers.length > 0}
          {@const hc = providers.filter((p) => p.status === "healthy").length}
          {@const pc =
            hc === providers.length
              ? "var(--status-ok)"
              : hc === 0
                ? "var(--status-error)"
                : "var(--status-warn)"}
          <span class="t-kv"
            ><span class="t-k">PROVIDERS</span><span
              class="t-v"
              style="color:{pc};">{hc}/{providers.length}</span
            ></span
          >
        {/if}
        {#if progress && !progressLoading}
          <span class="t-kv"
            ><span class="t-k">COVERAGE</span><span
              class="t-v"
              style="color:{coverageColor(progress.totals.coveragePct)};"
              >{formatPct(progress.totals.coveragePct)}</span
            ></span
          >
          <span class="t-kv"
            ><span class="t-k">SNAPSHOT</span><span class="t-v"
              >{formatRelative(progress.snapshotTs ?? progress.asOf)}</span
            ></span
          >
        {/if}
        {#if progress?.dbCohorts}
          <span class="t-kv"
            ><span class="t-k">DB</span><span class="t-v"
              >{progress.dbCohorts.totalInDb.toLocaleString()}</span
            ></span
          >
        {/if}
      </div>
    {/if}
    <span class="t-clock"
      >{lastUpdated
        ? lastUpdated.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
        : "--:--:--"} UTC</span
    >
    <button class="t-btn t-btn-icon" onclick={fetchAll} title="Refresh"
      >↻</button
    >
  </div>

  {#if coreLoading}
    <div class="t-loading"><LoadingDots label="Loading dashboard" /></div>
  {:else}
    <!-- ══ MAIN 3-PANE GRID ═══════════════════════════════════════════════════ -->
    <div class="t-main">
      <!-- ── LEFT COLUMN: Operations ────────────────────────────────────── -->
      <div class="t-col t-col-l">
        <!-- Alerts (cycle errors surfaced here, not as a layout-shifting banner) -->
        {#if refreshState && !refreshState.last_cycle_success && refreshState.current_state?.error}
          <div class="t-panel alert-panel">
            <div class="t-panel-label alert-label">⚠ ALERT</div>
            <div class="t-panel-body">
              <div class="alert-title">
                CYCLE FAILING{(refreshState.current_state
                  .consecutive_failures ?? 0) > 1
                  ? ` · ${refreshState.current_state.consecutive_failures}×`
                  : ""}
              </div>
              <div class="alert-msg">{refreshState.current_state.error}</div>
            </div>
          </div>
        {/if}
        <!-- Miner Cycle -->
        <div class="t-panel">
          <div class="t-panel-label">
            MINER CYCLE // {refreshState
              ? cycleStatus() === "ok"
                ? "HEALTHY"
                : cycleStatus() === "warn"
                  ? "WARNING"
                  : cycleStatus() === "error"
                    ? "STALLED"
                    : "UNKNOWN"
              : "—"}
          </div>
          <div class="t-panel-body">
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
                  >{progress?.intervalSec
                    ? `${progress.intervalSec}s`
                    : "—"}</span
                >
              </div>
            {/if}
          </div>
        </div>

        <!-- Provider Health -->
        <div class="t-panel">
          <div class="t-panel-label">
            PROVIDER HEALTH // {providers.filter((p) => p.status === "healthy")
              .length}/{providers.length} OK
          </div>
          <div class="t-panel-body">
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
                  <span class="prov-last"
                    >{formatRelative(p.last_success_at)}</span
                  >
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <!-- DB Cohorts -->
        <div class="t-panel">
          <div class="t-panel-label">
            DB COIN COHORTS // {progress?.dbCohorts
              ? progress.dbCohorts.totalInDb.toLocaleString() + " TOTAL"
              : "—"}
          </div>
          <div class="t-panel-body">
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
                <span class="m-k">current snapshot</span><span
                  class="m-v cohort-hl"
                  >{c.currentSnapshot.toLocaleString()}</span
                >
              </div>
              <div class="m-row">
                <span class="m-k">coingecko-enriched</span><span class="m-v"
                  >{c.coingeckoEnriched.toLocaleString()}</span
                >
              </div>
            {/if}
          </div>
        </div>

        <!-- Fill Tracker -->
        <div class="t-panel t-panel-grow">
          <div class="t-panel-label">
            FILL TRACKER // {fieldVelocity
              ? `${fieldVelocity.totalCoins} COINS`
              : "—"}
          </div>
          <div class="t-panel-body">
            {#if velocityLoading}
              <LoadingDots label="Loading" />
            {:else if !fieldVelocity}
              <p class="t-empty">no velocity data</p>
            {:else}
              <div class="vt-hdr">
                <span class="vt-name">FIELD</span>
                <span class="vt-num">FILLED</span>
                <span class="vt-num">+1H</span>
                <span class="vt-num">+7H</span>
                <span class="vt-num">+24H</span>
                <span class="vt-dlt">Δ</span>
              </div>
              {#each fieldVelocity.fields as entry}
                {@const pct =
                  fieldVelocity.totalCoins > 0
                    ? Math.round((entry.total / fieldVelocity.totalCoins) * 100)
                    : 0}
                <div class="vt-row">
                  <span class="vt-name">{entry.field}</span>
                  <span class="vt-num"
                    >{entry.total}<span class="vt-pct"> {pct}%</span></span
                  >
                  <span class="vt-num"
                    >{entry.window_1h > 0 ? entry.window_1h : "—"}</span
                  >
                  <span class="vt-num"
                    >{entry.window_7h > 0 ? entry.window_7h : "—"}</span
                  >
                  <span class="vt-num"
                    >{entry.window_24h > 0 ? entry.window_24h : "—"}</span
                  >
                  <span
                    class="vt-dlt"
                    style="color:{entry.delta > 0
                      ? 'var(--status-ok)'
                      : entry.delta < 0
                        ? 'var(--status-error)'
                        : 'rgba(200,212,207,0.22)'};"
                    >{entry.delta > 0
                      ? "+" + entry.delta
                      : entry.delta === 0
                        ? "—"
                        : entry.delta}</span
                  >
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>

      <!-- ── CENTER COLUMN: LOG STREAM ───────────────────────────────────── -->
      <div class="t-col t-col-c">
        <div class="t-panel t-panel-fill">
          <div class="t-panel-label">
            LOG STREAM // {logSource.toUpperCase()} // LIVE{logLines.length > 0
              ? ` // ${logLines.length}`
              : ""}
          </div>
          <div class="t-panel-tools">
            <div class="log-toggle">
              <button
                class="t-tab"
                class:active={logSource === "miner"}
                onclick={() => {
                  logSource = "miner";
                }}>MINER</button
              >
              <button
                class="t-tab"
                class:active={logSource === "api"}
                onclick={() => {
                  logSource = "api";
                }}>API</button
              >
            </div>
            <button
              class="t-btn t-btn-tiny t-btn-icon"
              onclick={() => {
                reconnectKey += 1;
              }}
              title="Reconnect stream">↻</button
            >
          </div>
          <div class="t-stream" bind:this={streamEl}>
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

      <!-- ── RIGHT COLUMN: Data Health ───────────────────────────────────── -->
      <div class="t-col t-col-r">
        <!-- Data Coverage -->
        <div class="t-panel">
          <div class="t-panel-label">
            DATA COVERAGE // {progress
              ? formatPct(progress.totals.coveragePct)
              : "—"}
          </div>
          <div class="t-panel-body">
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
                  )};"
                  >{formatPct(progress.sections.marketCoins.coveragePct)}</span
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
                  >{formatPct(
                    progress.sections.coinBreakdown.coveragePct,
                  )}</span
                ><span class="m-s"
                  >{progress.sections.coinBreakdown.populated}/{progress
                    .sections.coinBreakdown.expected}</span
                >
              </div>
              <div class="m-row">
                <span class="m-k">charts</span><span
                  class="m-v"
                  style="color:{coverageColor(
                    progress.sections.charts.coveragePct,
                  )};">{formatPct(progress.sections.charts.coveragePct)}</span
                ><span class="m-s"
                  >{progress.sections.charts.populated}/{progress.sections
                    .charts.expected}</span
                >
              </div>
            {/if}
          </div>
        </div>

        <!-- Freshness -->
        <div class="t-panel">
          <div class="t-panel-label">
            FRESHNESS // {progress
              ? `AS OF ${formatRelative(progress.snapshotTs ?? progress.asOf)}`
              : "—"}
          </div>
          <div class="t-panel-body">
            {#if !progress}
              <p class="t-empty">—</p>
            {:else}
              <div class="m-row">
                <span class="m-k">fresh</span><span
                  class="m-v"
                  style="color:var(--status-ok);"
                  >{progress.freshness.fresh}</span
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
          </div>
        </div>

        <!-- Coverage Detail (compact) -->
        <div class="t-panel t-panel-grow">
          <div class="t-panel-label">
            COVERAGE DETAIL // {progress?.missingClarity
              ? progress.missingClarity.expectedCoins.toLocaleString() +
                " COINS"
              : "—"}
          </div>
          <div class="t-panel-body">
            {#if progressLoading}
              <LoadingDots label="Loading" />
            {:else if !progress}
              <p class="t-empty">no coverage data</p>
            {:else if !progress.missingClarity}
              <p class="t-empty">no field-level breakdown</p>
            {:else}
              <CoverageDetail
                missingClarity={progress.missingClarity}
                metadataStage={progress.metadataStage}
                chartTimeframes={progress.chartTimeframes}
                totalCoins={progress.missingClarity.expectedCoins}
                priceTier={progress.priceTier}
              />
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  /* ── Root: viewport-filling 3-pane terminal ────────────────────────────── */
  .t-root {
    display: flex;
    flex-direction: column;
    height: calc(100dvh - 3.6rem); /* allow for app shell topbar */
    background: var(--tv-bg, #030303);
    color: var(--tv-text-primary);
    font-family: "JetBrains Mono", "IBM Plex Mono", Menlo, Consolas,
      ui-monospace, monospace;
    font-size: 0.7rem;
    line-height: 1.45;
    overflow: hidden;
  }

  /* ── Topbar ─────────────────────────────────────────────────────────────── */
  .t-topbar {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0 0.875rem;
    height: 2.2rem;
    border-bottom: 1px solid rgba(176, 38, 255, 0.25);
    flex-shrink: 0;
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .t-bullet {
    color: var(--tv-highlight);
    font-size: 0.55rem;
    line-height: 1;
  }
  .t-title {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--tv-text-primary);
    margin: 0;
    flex-shrink: 0;
  }
  .t-sep {
    color: rgba(176, 38, 255, 0.3);
    flex-shrink: 0;
  }

  .t-status {
    display: flex;
    align-items: center;
    flex: 1;
    gap: 0.875rem;
    min-width: 0;
  }

  .t-kv {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35rem;
    flex-shrink: 0;
  }
  .t-k {
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--tv-text-muted);
  }
  .t-v {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--tv-text-primary);
    font-variant-numeric: tabular-nums;
  }

  .t-clock {
    color: rgba(200, 212, 207, 0.5);
    font-size: 0.65rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
    margin-left: auto;
    flex-shrink: 0;
  }

  .t-btn {
    padding: 0.15rem 0.6rem;
    font-family: inherit;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    border: 1px solid var(--tv-border);
    border-radius: 0;
    background: transparent;
    color: var(--tv-text-primary);
    cursor: pointer;
    flex-shrink: 0;
    transition:
      border-color 0.15s,
      color 0.15s;
  }
  .t-btn:hover {
    border-color: var(--tv-highlight);
    color: var(--tv-highlight-soft);
  }

  .t-btn-tiny {
    padding: 0.05rem 0.45rem;
    font-size: 0.6rem;
  }
  .t-btn-icon {
    font-size: 0.85rem;
    line-height: 1;
    padding: 0.05rem 0.45rem;
    letter-spacing: 0;
  }

  /* ── Loading ────────────────────────────────────────────────────────────── */
  .t-loading {
    padding: 2rem;
  }

  /* ── Alert panel (in left column — no layout shift) ─────────────────────── */
  .alert-panel {
    border-top-color: rgba(255, 77, 87, 0.45) !important;
    background: rgba(255, 77, 87, 0.04);
  }
  .alert-label {
    color: var(--status-error) !important;
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
    min-width: 0; /* prevent grid track blowout from wide content */
    padding-top: 0.6rem; /* breathing room so first floating label isn't clipped */
    border-right: 1px solid rgba(176, 38, 255, 0.15);
  }
  .t-col-r {
    border-right: none;
  }

  /* ── Panels with floating label ─────────────────────────────────────────── */
  .t-panel {
    position: relative;
    margin-top: 0.7rem; /* clearance for the floating label that sits at top: -0.55em */
    border-top: 1px solid rgba(176, 38, 255, 0.12);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .t-panel:first-child {
    margin-top: 0;
  }

  .t-panel-grow {
    flex: 1;
    min-height: 0;
  }
  .t-panel-fill {
    flex: 1;
    min-height: 0;
  }

  .t-panel-label {
    position: absolute;
    top: -0.6em;
    left: 0.8rem;
    padding: 0 0.4rem;
    background: var(--tv-bg, #030303);
    color: rgba(176, 38, 255, 0.75);
    font-size: 0.6rem;
    line-height: 1.2;
    font-weight: 600;
    letter-spacing: 0.1em;
    white-space: nowrap;
    z-index: 2;
    pointer-events: none;
    max-width: calc(100% - 1.6rem);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .t-panel-body {
    padding: 0.85rem 0.6rem 0.45rem;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    flex: 1;
  }

  .t-panel-tools {
    position: absolute;
    top: -0.7em;
    right: 0.6rem;
    display: flex;
    gap: 0.3rem;
    background: var(--tv-bg, #030303);
    padding: 0 0.25rem;
    z-index: 2;
  }

  .log-toggle {
    display: flex;
    border: 1px solid var(--tv-border);
  }
  .t-tab {
    padding: 0.05rem 0.45rem;
    font-family: inherit;
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    background: transparent;
    border: none;
    border-right: 1px solid var(--tv-border);
    cursor: pointer;
    color: var(--tv-text-muted);
  }
  .t-tab:last-child {
    border-right: none;
  }
  .t-tab.active {
    background: rgba(176, 38, 255, 0.15);
    color: var(--tv-highlight-soft);
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

  /* ── Fill Tracker table ─────────────────────────────────────────────────── */
  .vt-hdr,
  .vt-row {
    display: grid;
    grid-template-columns: 1fr 6ch 4ch 4ch 5ch 4ch;
    gap: 0.1rem 0.3rem;
    font-size: 0.6rem;
    padding: 0.05rem 0;
    line-height: 1.4;
  }
  .vt-hdr {
    color: rgba(200, 212, 207, 0.3);
    font-size: 0.55rem;
    border-bottom: 1px solid rgba(43, 47, 51, 0.8);
    padding-bottom: 0.2rem;
    margin-bottom: 0.1rem;
  }
  .vt-name {
    color: rgba(200, 212, 207, 0.72);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .vt-num {
    color: var(--tv-text-primary);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .vt-pct {
    color: rgba(200, 212, 207, 0.38);
    font-size: 0.55rem;
  }
  .vt-dlt {
    text-align: right;
    font-variant-numeric: tabular-nums;
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
    padding: 0.85rem 0.6rem 0.4rem;
    min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(176, 38, 255, 0.2) transparent;
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
    padding: 0.05rem 0;
    line-height: 1.5;
    font-size: 0.65rem;
  }

  .sr-ts {
    color: rgba(200, 212, 207, 0.3);
    font-variant-numeric: tabular-nums;
  }
  .sr-kind {
    font-weight: 600;
    font-size: 0.62rem;
  }
  .sr-detail {
    color: rgba(200, 212, 207, 0.72);
    overflow: visible;
    text-overflow: unset;
    white-space: pre-wrap;
    word-break: break-all;
    min-width: 0;
  }
  .sr-tag {
    text-align: right;
    font-size: 0.6rem;
    letter-spacing: 0.05em;
    font-weight: 600;
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
      min-height: calc(100dvh - 3.6rem);
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
    .t-panel-fill,
    .t-panel-grow {
      flex: none;
    }
    .t-stream {
      max-height: 60vh;
    }
  }
</style>
