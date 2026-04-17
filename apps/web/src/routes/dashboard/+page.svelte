<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import M3Surface from "$lib/components/M3Surface.svelte";
  import LoadingDots from "$lib/components/LoadingDots.svelte";
  import type { RefreshStateData, ProgressOverview } from "./+page";

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
  let loading = $state(true);
  let lastUpdated = $state<Date | null>(null);

  // ── Formatting helpers ──────────────────────────────────────────────────────

  function parseServerDate(iso: string): Date {
    const normalized = iso.replace(/(\.\d{3})\d*/, "$1").replace(/([^Z])$/, "$1Z");
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
      case "healthy": return "var(--status-ok)";
      case "rate_limited": return "var(--status-warn)";
      case "error": return "var(--status-error)";
      default: return "var(--tv-text-muted)";
    }
  }

  function providerStatusLabel(status: ProviderStatus): string {
    switch (status) {
      case "healthy": return "Healthy";
      case "rate_limited": return "Rate limited";
      case "error": return "Error";
      default: return status;
    }
  }

  // ── Cycle health ────────────────────────────────────────────────────────────
  // "error" only when genuinely stalled (age > 3× interval).
  // A single failed cycle that is recent is "warn" — transient rate limits etc.

  const cycleStatus = $derived((): "ok" | "warn" | "error" | "unknown" => {
    if (!refreshState) return "unknown";
    if (!refreshState.last_cycle_at) return "unknown";
    const ageSec = (Date.now() - parseServerDate(refreshState.last_cycle_at).getTime()) / 1000;
    const interval = progress?.intervalSec ?? 300;
    if (ageSec > interval * 3) return "error";           // genuinely stalled
    if (!refreshState.last_cycle_success) return "warn"; // recent failure, still cycling
    if (ageSec > interval * 1.5) return "warn";          // overdue but last was ok
    return "ok";
  });

  const cycleStatusColor = $derived((): string => {
    switch (cycleStatus()) {
      case "ok": return "var(--status-ok)";
      case "warn": return "var(--status-warn)";
      case "error": return "var(--status-error)";
      default: return "var(--tv-text-muted)";
    }
  });

  // ── Fetch logic ─────────────────────────────────────────────────────────────

  async function fetchAll() {
    try {
      const [rsRes, progRes, provRes] = await Promise.all([
        fetch("/api/refresh-state"),
        fetch("/api/progress"),
        fetch("/api/provider-health"),
      ]);

      if (rsRes.ok) {
        const payload = await rsRes.json();
        if (payload) refreshState = payload as RefreshStateData;
      }
      if (progRes.ok) {
        const payload = await progRes.json();
        if (payload) progress = payload as ProgressOverview;
      }
      if (provRes.ok) {
        const payload = await provRes.json();
        if (Array.isArray(payload)) providers = payload;
      }
    } catch {
      // keep last known state on transient errors
    } finally {
      loading = false;
      lastUpdated = new Date();
    }
  }

  onMount(() => {
    if (!browser) return;
    void fetchAll();
    const id = setInterval(() => void fetchAll(), 30_000);
    return () => clearInterval(id);
  });
</script>

<main class="dashboard">
  <div class="dash-header">
    <h1 class="dash-title">System Dashboard</h1>
    <div class="dash-meta">
      {#if lastUpdated}
        <span class="last-updated">
          Updated {lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      {/if}
      <button class="m3-button outlined" onclick={fetchAll}>Refresh</button>
    </div>
  </div>

  {#if loading}
    <LoadingDots label="Loading dashboard" />
  {:else}

    <!-- ── Cycle health ───────────────────────────────────────────────────── -->
    <M3Surface title="Miner Cycle">
      {#if !refreshState}
        <p class="empty-state">No cycle data yet — waiting for first miner run</p>
      {:else}
        <div class="cycle-grid">
          <div class="cycle-stat">
            <span class="cycle-stat-label">Status</span>
            <span class="cycle-stat-value" style="color: {cycleStatusColor()};">
              <span class="dot" style="background: {cycleStatusColor()};"></span>
              {cycleStatus() === "ok" ? "Healthy" : cycleStatus() === "warn" ? "Warning / partial failure" : cycleStatus() === "error" ? "Stalled" : "Unknown"}
            </span>
          </div>
          <div class="cycle-stat">
            <span class="cycle-stat-label">Cycles completed</span>
            <span class="cycle-stat-value">{refreshState.cycle_count ?? "—"}</span>
          </div>
          <div class="cycle-stat">
            <span class="cycle-stat-label">Last cycle</span>
            <span class="cycle-stat-value">{formatDateTime(refreshState.last_cycle_at)}</span>
          </div>
          <div class="cycle-stat">
            <span class="cycle-stat-label">Last cycle age</span>
            <span class="cycle-stat-value" style="color: {cycleStatusColor()};">
              {formatRelative(refreshState.last_cycle_at)}
            </span>
          </div>
          <div class="cycle-stat">
            <span class="cycle-stat-label">Last success</span>
            <span class="cycle-stat-value"
              style="color: {refreshState.last_cycle_success ? 'var(--status-ok)' : 'var(--status-error)'};">
              {refreshState.last_cycle_success ? "Yes" : "No"}
            </span>
          </div>
          <div class="cycle-stat">
            <span class="cycle-stat-label">Interval</span>
            <span class="cycle-stat-value">{progress?.intervalSec ? `${progress.intervalSec}s` : "—"}</span>
          </div>
        </div>
      {/if}
    </M3Surface>

    <!-- ── Coverage overview ─────────────────────────────────────────────── -->
    <M3Surface title="Data Coverage">
      {#if !progress}
        <p class="empty-state">No coverage data yet</p>
      {:else}
        <div class="coverage-grid">
          <div class="coverage-card">
            <span class="coverage-card-label">Overall</span>
            <span class="coverage-card-pct" style="color: {coverageColor(progress.totals.coveragePct)};">
              {formatPct(progress.totals.coveragePct)}
            </span>
            <span class="coverage-card-sub">{progress.totals.populated} / {progress.totals.expected}</span>
          </div>
          <div class="coverage-card">
            <span class="coverage-card-label">Market coins</span>
            <span class="coverage-card-pct" style="color: {coverageColor(progress.sections.marketCoins.coveragePct)};">
              {formatPct(progress.sections.marketCoins.coveragePct)}
            </span>
            <span class="coverage-card-sub">{progress.sections.marketCoins.populated} / {progress.sections.marketCoins.expected}</span>
          </div>
          <div class="coverage-card">
            <span class="coverage-card-label">Coin breakdown</span>
            <span class="coverage-card-pct" style="color: {coverageColor(progress.sections.coinBreakdown.coveragePct)};">
              {formatPct(progress.sections.coinBreakdown.coveragePct)}
            </span>
            <span class="coverage-card-sub">{progress.sections.coinBreakdown.populated} / {progress.sections.coinBreakdown.expected}</span>
          </div>
          <div class="coverage-card">
            <span class="coverage-card-label">Charts</span>
            <span class="coverage-card-pct" style="color: {coverageColor(progress.sections.charts.coveragePct)};">
              {formatPct(progress.sections.charts.coveragePct)}
            </span>
            <span class="coverage-card-sub">{progress.sections.charts.populated} / {progress.sections.charts.expected}</span>
          </div>
        </div>

        <div class="freshness-row">
          <span class="freshness-label">Freshness</span>
          <span class="freshness-badge fresh">{progress.freshness.fresh} fresh</span>
          <span class="freshness-badge warn">{progress.freshness.warning} warning</span>
          <span class="freshness-badge stale">{progress.freshness.stale} stale</span>
          {#if progress.freshness.unknown > 0}
            <span class="freshness-badge unknown">{progress.freshness.unknown} unknown</span>
          {/if}
          <span class="freshness-as-of">as of {formatRelative(progress.snapshotTs ?? progress.asOf)}</span>
        </div>
      {/if}
    </M3Surface>

    <!-- ── Provider health ───────────────────────────────────────────────── -->
    <M3Surface title="Provider Health">
      {#if providers.length === 0}
        <p class="empty-state">No provider data yet — waiting for first miner cycle</p>
      {:else}
        <ul class="provider-list">
          {#each providers as p (p.provider)}
            <li class="provider-row">
              <span class="status-dot" style="background: {providerStatusColor(p.status)};"></span>
              <span class="provider-name">{p.provider}</span>
              <span class="provider-status" style="color: {providerStatusColor(p.status)};">
                {providerStatusLabel(p.status)}
              </span>
              <span class="provider-streak">
                {p.error_streak > 0 ? `${p.error_streak} errors` : "—"}
              </span>
              <span class="provider-last">
                {formatRelative(p.last_success_at)}
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
  .freshness-badge.fresh  { color: var(--status-ok);    background: color-mix(in srgb, var(--status-ok) 12%, transparent); }
  .freshness-badge.warn   { color: var(--status-warn);  background: color-mix(in srgb, var(--status-warn) 12%, transparent); }
  .freshness-badge.stale  { color: var(--status-error); background: color-mix(in srgb, var(--status-error) 12%, transparent); }
  .freshness-badge.unknown { color: var(--tv-text-muted); background: color-mix(in srgb, var(--tv-text-muted) 12%, transparent); }

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
    grid-template-columns: 0.75rem 1fr auto auto auto;
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

  .provider-streak {
    font-size: 0.8125rem;
    color: var(--tv-text-muted);
    text-align: right;
  }

  .provider-last {
    font-size: 0.8125rem;
    color: var(--tv-text-muted);
    text-align: right;
    min-width: 6rem;
  }
</style>
