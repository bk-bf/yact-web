<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import M3Surface from "$lib/components/M3Surface.svelte";
  import LoadingDots from "$lib/components/LoadingDots.svelte";
  import CoverageDetail from "$lib/components/CoverageDetail.svelte";
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
  let providers = $state<ProviderHealth[]>([]);
  let coreLoading = $state(true);
  let progressLoading = $state(true);
  let lastUpdated = $state<Date | null>(null);

  // ── Log viewer state ────────────────────────────────────────────────────────
  let logLines = $state<string[]>([]);
  let logSource = $state<"miner" | "api">("miner");
  let logLoading = $state(false);
  let logTotalLines = $state(0);

  // ── Formatting helpers ──────────────────────────────────────────────────────

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

  async function fetchLogs() {
    logLoading = true;
    try {
      const res = await fetch(`/api/logs?lines=150&source=${logSource}`);
      if (res.ok) {
        const data = await res.json();
        logLines = data.lines ?? [];
        logTotalLines = data.totalLines ?? 0;
      }
    } catch {
      /* keep last known state */
    } finally {
      logLoading = false;
    }
  }

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

    try {
      await corePromise;
    } catch {
      // keep last known state on transient errors
    } finally {
      coreLoading = false;
      lastUpdated = new Date();
    }

    // progress settles in the background; lastUpdated is already set
    await progressPromise;
  }

  onMount(() => {
    if (!browser) return;
    void fetchAll();
    void fetchLogs();
    const id = setInterval(() => void fetchAll(), 30_000);
    const logId = setInterval(() => void fetchLogs(), 15_000);
    return () => {
      clearInterval(id);
      clearInterval(logId);
    };
  });
</script>

<main class="dashboard">
  <div class="dash-header">
    <h1 class="dash-title">System Dashboard</h1>
    <div class="dash-meta">
      {#if lastUpdated}
        <span class="last-updated">
          Updated {lastUpdated.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      {/if}
      <button class="m3-button outlined" onclick={fetchAll}>Refresh</button>
    </div>
  </div>

  {#if coreLoading}
    <LoadingDots label="Loading dashboard" />
  {:else}
    <!-- ── Cycle health ───────────────────────────────────────────────────── -->
    <M3Surface title="Miner Cycle">
      {#if !refreshState}
        <p class="empty-state">
          No cycle data yet — waiting for first miner run
        </p>
      {:else}
        {#if !refreshState.last_cycle_success && refreshState.current_state?.error}
          <div class="cycle-error-banner">
            <span class="cycle-error-icon">⚠</span>
            <div class="cycle-error-body">
              <span class="cycle-error-title">
                Cycle failing{(refreshState.current_state
                  .consecutive_failures ?? 0) > 1
                  ? ` · ${refreshState.current_state.consecutive_failures} consecutive failures`
                  : ""}
              </span>
              <span class="cycle-error-message"
                >{refreshState.current_state.error}</span
              >
            </div>
          </div>
        {/if}
        <div class="cycle-grid">
          <div class="cycle-stat">
            <span class="cycle-stat-label">Status</span>
            <span class="cycle-stat-value" style="color: {cycleStatusColor()};">
              <span class="dot" style="background: {cycleStatusColor()};"
              ></span>
              {cycleStatus() === "ok"
                ? "Healthy"
                : cycleStatus() === "warn"
                  ? "Warning / partial failure"
                  : cycleStatus() === "error"
                    ? "Stalled / failing"
                    : "Unknown"}
            </span>
          </div>
          <div class="cycle-stat">
            <span class="cycle-stat-label">Cycles completed</span>
            <span class="cycle-stat-value"
              >{refreshState.cycle_count ?? "—"}</span
            >
          </div>
          <div class="cycle-stat">
            <span class="cycle-stat-label">Last cycle</span>
            <span class="cycle-stat-value"
              >{formatDateTime(refreshState.last_cycle_at)}</span
            >
          </div>
          <div class="cycle-stat">
            <span class="cycle-stat-label">Last cycle age</span>
            <span class="cycle-stat-value" style="color: {cycleStatusColor()};">
              {formatRelative(refreshState.last_cycle_at)}
            </span>
          </div>
          <div class="cycle-stat">
            <span class="cycle-stat-label">Last success</span>
            <span
              class="cycle-stat-value"
              style="color: {refreshState.last_cycle_success
                ? 'var(--status-ok)'
                : 'var(--status-error)'};"
            >
              {refreshState.last_cycle_success ? "Yes" : "No"}
            </span>
          </div>
          {#if (refreshState.current_state?.consecutive_failures ?? 0) > 0}
            <div class="cycle-stat">
              <span class="cycle-stat-label">Consecutive failures</span>
              <span
                class="cycle-stat-value"
                style="color: var(--status-error);"
              >
                {refreshState.current_state?.consecutive_failures}
              </span>
            </div>
          {/if}
          <div class="cycle-stat">
            <span class="cycle-stat-label">Interval</span>
            <span class="cycle-stat-value"
              >{progress?.intervalSec ? `${progress.intervalSec}s` : "—"}</span
            >
          </div>
        </div>
      {/if}
    </M3Surface>

    <!-- ── Coverage overview ─────────────────────────────────────────────── -->
    <M3Surface title="Data Coverage">
      {#if progressLoading}
        <LoadingDots label="Loading coverage" />
      {:else if !progress}
        <p class="empty-state">No coverage data yet</p>
      {:else}
        <div class="coverage-grid">
          <div class="coverage-card">
            <span class="coverage-card-label">Overall</span>
            <span
              class="coverage-card-pct"
              style="color: {coverageColor(progress.totals.coveragePct)};"
            >
              {formatPct(progress.totals.coveragePct)}
            </span>
            <span class="coverage-card-sub"
              >{progress.totals.populated} / {progress.totals.expected}</span
            >
          </div>
          <div class="coverage-card">
            <span class="coverage-card-label">Market coins</span>
            <span
              class="coverage-card-pct"
              style="color: {coverageColor(
                progress.sections.marketCoins.coveragePct,
              )};"
            >
              {formatPct(progress.sections.marketCoins.coveragePct)}
            </span>
            <span class="coverage-card-sub"
              >{progress.sections.marketCoins.populated} / {progress.sections
                .marketCoins.expected}</span
            >
          </div>
          <div class="coverage-card">
            <span class="coverage-card-label">Coin breakdown</span>
            <span
              class="coverage-card-pct"
              style="color: {coverageColor(
                progress.sections.coinBreakdown.coveragePct,
              )};"
            >
              {formatPct(progress.sections.coinBreakdown.coveragePct)}
            </span>
            <span class="coverage-card-sub"
              >{progress.sections.coinBreakdown.populated} / {progress.sections
                .coinBreakdown.expected}</span
            >
          </div>
          <div class="coverage-card">
            <span class="coverage-card-label">Charts</span>
            <span
              class="coverage-card-pct"
              style="color: {coverageColor(
                progress.sections.charts.coveragePct,
              )};"
            >
              {formatPct(progress.sections.charts.coveragePct)}
            </span>
            <span class="coverage-card-sub"
              >{progress.sections.charts.populated} / {progress.sections.charts
                .expected}</span
            >
          </div>
        </div>

        <div class="freshness-row">
          <span class="freshness-label">Freshness</span>
          <span class="freshness-badge fresh"
            >{progress.freshness.fresh} fresh</span
          >
          <span class="freshness-badge warn"
            >{progress.freshness.warning} warning</span
          >
          <span class="freshness-badge stale"
            >{progress.freshness.stale} stale</span
          >
          {#if progress.freshness.unknown > 0}
            <span class="freshness-badge unknown"
              >{progress.freshness.unknown} unknown</span
            >
          {/if}
          <span class="freshness-as-of"
            >as of {formatRelative(progress.snapshotTs ?? progress.asOf)}</span
          >
        </div>
      {/if}
    </M3Surface>

    <!-- ── Coverage detail ──────────────────────────────────────────────── -->
    <M3Surface title="Coverage Detail">
      {#if progressLoading}
        <LoadingDots label="Loading detail" />
      {:else if !progress}
        <p class="empty-state">No coverage data yet</p>
      {:else if !progress.missingClarity}
        <p class="empty-state">No field-level breakdown available</p>
      {:else}
        <CoverageDetail
          missingClarity={progress.missingClarity}
          metadataStage={progress.metadataStage}
          chartTimeframes={progress.chartTimeframes}
          totalCoins={progress.missingClarity.expectedCoins}
          priceTier={progress.priceTier}
        />
      {/if}
    </M3Surface>

    <!-- ── DB Cohorts ────────────────────────────────────────────────────── -->
    <M3Surface title="DB Coin Cohorts">
      {#if progressLoading}
        <LoadingDots label="Loading cohort data" />
      {:else if !progress?.dbCohorts}
        <p class="empty-state">No cohort data available</p>
      {:else}
        {@const c = progress.dbCohorts as DbCohorts}
        <div class="cohort-table">
          <div class="cohort-row cohort-header">
            <span>Cohort</span>
            <span>Count</span>
            <span>Note</span>
          </div>
          <div class="cohort-row">
            <span class="cohort-label">Total in DB</span>
            <span class="cohort-count">{c.totalInDb.toLocaleString()}</span>
            <span class="cohort-note">All coins ever seen (any source)</span>
          </div>
          <div class="cohort-row">
            <span class="cohort-label">Ticker-auto only</span>
            <span class="cohort-count">{c.tickerOnly.toLocaleString()}</span>
            <span class="cohort-note">Auto-registered from exchange tickers — live price only, no rank or metadata</span>
          </div>
          <div class="cohort-row">
            <span class="cohort-label">CoinPaprika-ranked</span>
            <span class="cohort-count">{c.paprikaTracked.toLocaleString()}</span>
            <span class="cohort-note">Have a market cap rank from CoinPaprika — eligible for full enrichment</span>
          </div>
          <div class="cohort-row">
            <span class="cohort-label">Current snapshot</span>
            <span class="cohort-count">{c.currentSnapshot.toLocaleString()}</span>
            <span class="cohort-note">In the latest miner snapshot — used as coverage denominator</span>
          </div>
          <div class="cohort-row">
            <span class="cohort-label">CoinGecko-enriched</span>
            <span class="cohort-count">{c.coingeckoEnriched.toLocaleString()}</span>
            <span class="cohort-note">Have CoinGecko breakdown data (ATH, ATL, description, socials…)</span>
          </div>
        </div>
        <p class="cohort-footnote">
          Coverage stats only count the <strong>current snapshot</strong> cohort.
          Ticker-auto coins will never appear in coverage until CoinPaprika or CoinGecko confirms them.
        </p>
      {/if}
    </M3Surface>

    <!-- ── Log viewer ─────────────────────────────────────────────────────── -->
    <M3Surface title="Log Tail">
      <div class="log-toolbar">
        <div class="log-source-toggle">
          <button
            class="log-toggle-btn"
            class:active={logSource === "miner"}
            onclick={() => { logSource = "miner"; void fetchLogs(); }}
          >Miner</button>
          <button
            class="log-toggle-btn"
            class:active={logSource === "api"}
            onclick={() => { logSource = "api"; void fetchLogs(); }}
          >API</button>
        </div>
        {#if logTotalLines > 0}
          <span class="log-meta">showing last 150 of {logTotalLines.toLocaleString()} lines</span>
        {/if}
        <button class="m3-button outlined log-refresh-btn" onclick={() => void fetchLogs()}>
          Refresh
        </button>
      </div>
      {#if logLoading && logLines.length === 0}
        <LoadingDots label="Loading logs" />
      {:else if logLines.length === 0}
        <p class="empty-state">No log lines found — log file may not exist yet</p>
      {:else}
        <pre class="log-pre">{logLines.join("\n")}</pre>
      {/if}
    </M3Surface>

    <!-- ── Provider health ───────────────────────────────────────────────── -->    <M3Surface title="Provider Health">
      {#if providers.length === 0}
        <p class="empty-state">
          No provider data yet — waiting for first miner cycle
        </p>
      {:else}
        <ul class="provider-list">
          {#each providers as p (p.provider)}
            <li class="provider-row">
              <span
                class="status-dot"
                style="background: {providerStatusColor(p.status)};"
              ></span>
              <span class="provider-name">{p.provider}</span>
              <span
                class="provider-status"
                style="color: {providerStatusColor(p.status)};"
              >
                {#if p.status === "error" && p.error_streak > 0}
                  {p.error_streak} errors
                {:else if p.status === "rate_limited" && p.error_streak > 0}
                  Rate limited &middot; {p.error_streak} errors
                {:else}
                  {providerStatusLabel(p.status)}
                {/if}
              </span>
              <span class="provider-last">
                {p.status === "healthy"
                  ? formatRelative(p.last_success_at)
                  : `last ok: ${formatRelative(p.last_success_at)}`}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </M3Surface>
  {/if}
</main>

<style>
  .dashboard {
    max-width: 960px;
    margin: 2rem auto;
    padding: 0 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .dash-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .dash-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--tv-text-primary);
    margin: 0;
  }

  .dash-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .last-updated {
    font-size: 0.8125rem;
    color: var(--tv-text-muted);
  }

  .empty-state {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--tv-text-muted);
    font-size: 0.9375rem;
  }

  /* Cycle grid */
  .cycle-error-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    background: color-mix(in srgb, var(--status-error) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--status-error) 40%, transparent);
    border-radius: 6px;
  }

  .cycle-error-icon {
    font-size: 1.125rem;
    color: var(--status-error);
    flex-shrink: 0;
    margin-top: 0.05rem;
  }

  .cycle-error-body {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .cycle-error-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--status-error);
  }

  .cycle-error-message {
    font-size: 0.8125rem;
    color: var(--tv-text-secondary);
    word-break: break-word;
    font-family: var(--font-mono, monospace);
  }

  .cycle-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem 1.5rem;
    padding: 0.5rem 0;
  }

  .cycle-stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .cycle-stat-label {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tv-text-muted);
  }

  .cycle-stat-value {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--tv-text-primary);
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* Coverage grid */
  .coverage-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 1rem;
    padding: 0.5rem 0 1rem;
  }

  .coverage-card {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--tv-border);
    border-radius: 6px;
    background: var(--tv-surface-1);
  }

  .coverage-card-label {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tv-text-muted);
  }

  .coverage-card-pct {
    font-size: 1.375rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .coverage-card-sub {
    font-size: 0.75rem;
    color: var(--tv-text-muted);
  }

  /* Freshness row */
  .freshness-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
    padding: 0.25rem 0 0.5rem;
  }

  .freshness-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--tv-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-right: 0.25rem;
  }

  .freshness-badge {
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
  }
  .freshness-badge.fresh {
    color: var(--status-ok);
    background: color-mix(in srgb, var(--status-ok) 12%, transparent);
  }
  .freshness-badge.warn {
    color: var(--status-warn);
    background: color-mix(in srgb, var(--status-warn) 12%, transparent);
  }
  .freshness-badge.stale {
    color: var(--status-error);
    background: color-mix(in srgb, var(--status-error) 12%, transparent);
  }
  .freshness-badge.unknown {
    color: var(--tv-text-muted);
    background: color-mix(in srgb, var(--tv-text-muted) 12%, transparent);
  }

  .freshness-as-of {
    font-size: 0.75rem;
    color: var(--tv-text-muted);
    margin-left: auto;
  }

  /* Provider list */
  .provider-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .provider-row {
    display: grid;
    grid-template-columns: 0.75rem 1fr auto auto;
    align-items: center;
    gap: 0.75rem 1rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--tv-border);
  }

  .provider-row:last-child {
    border-bottom: none;
  }

  .status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .provider-name {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--tv-text-primary);
    text-transform: capitalize;
  }

  .provider-status {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .provider-last {
    font-size: 0.8125rem;
    color: var(--tv-text-muted);
    text-align: right;
    min-width: 7rem;
  }

  /* DB Cohort table */
  .cohort-table {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--tv-border);
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 0.75rem;
  }

  .cohort-row {
    display: grid;
    grid-template-columns: minmax(10rem, 1.5fr) 6rem 1fr;
    align-items: center;
    gap: 0 1rem;
    padding: 0.6rem 0.875rem;
    border-bottom: 1px solid var(--tv-border);
  }

  .cohort-row:last-child {
    border-bottom: none;
  }

  .cohort-header {
    background: var(--tv-surface-1);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--tv-text-muted);
  }

  .cohort-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--tv-text-primary);
  }

  .cohort-count {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--tv-text-primary);
    font-variant-numeric: tabular-nums;
  }

  .cohort-note {
    font-size: 0.8125rem;
    color: var(--tv-text-muted);
  }

  .cohort-footnote {
    font-size: 0.8125rem;
    color: var(--tv-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  /* Log viewer */
  .log-toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .log-source-toggle {
    display: flex;
    border: 1px solid var(--tv-border);
    border-radius: 6px;
    overflow: hidden;
  }

  .log-toggle-btn {
    padding: 0.3rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 600;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--tv-text-secondary);
    transition: background 0.15s, color 0.15s;
  }

  .log-toggle-btn.active {
    background: var(--tv-surface-2, var(--tv-accent-muted, var(--tv-border)));
    color: var(--tv-text-primary);
  }

  .log-meta {
    font-size: 0.75rem;
    color: var(--tv-text-muted);
    margin-right: auto;
  }

  .log-refresh-btn {
    font-size: 0.8125rem;
    padding: 0.25rem 0.75rem;
  }

  .log-pre {
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    line-height: 1.55;
    color: var(--tv-text-secondary);
    background: var(--tv-surface-1);
    border: 1px solid var(--tv-border);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    max-height: 400px;
    overflow-y: auto;
    overflow-x: auto;
    white-space: pre;
    margin: 0;
  }
</style>
