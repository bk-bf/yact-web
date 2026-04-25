<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import M3Surface from "$lib/components/M3Surface.svelte";
  import LoadingDots from "$lib/components/LoadingDots.svelte";
  import TuiTopbar from "$lib/components/tui/TuiTopbar.svelte";
  import TuiTickerBar from "$lib/components/tui/TuiTickerBar.svelte";
  import TuiBottomBar from "$lib/components/tui/TuiBottomBar.svelte";
  import type { TuiCoinItem, TuiGlobalData } from "$lib/types/terminal";
  import type { RefreshStateData, ProgressOverview } from "./+page";

  type ProviderStatus = "healthy" | "rate_limited" | "error";

  interface ProviderHealth {
    provider: string;
    status: ProviderStatus;
    error_streak: number;
    last_success_at: string | null;
  }

  // ── TUI chrome state ──────────────────────────────────────────────────────
  let clockTime: string = $state("--:--:--");
  let blinkOn: boolean = $state(true);
  let coins: TuiCoinItem[] = $state([]);
  let globalData: TuiGlobalData | null = $state(null);
  let liveDataLoading: boolean = $state(true);

  // ── Dashboard data state ──────────────────────────────────────────────────
  let refreshState = $state<RefreshStateData | null>(null);
  let progress = $state<ProgressOverview | null>(null);
  let providers = $state<ProviderHealth[]>([]);
  let loading = $state(true);
  let lastUpdated = $state<Date | null>(null);

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

  const cycleStatus = $derived((): "ok" | "warn" | "error" | "unknown" => {
    if (!refreshState) return "unknown";
    if (!refreshState.last_cycle_at) return "unknown";
    const ageSec =
      (Date.now() - parseServerDate(refreshState.last_cycle_at).getTime()) /
      1000;
    const interval = progress?.intervalSec ?? 300;
    if (ageSec > interval * 3) return "error";
    if (!refreshState.last_cycle_success) return "warn";
    if (ageSec > interval * 1.5) return "warn";
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

    const tick = () => {
      clockTime = new Date().toUTCString().slice(17, 25);
    };
    tick();
    const clockId = setInterval(tick, 1000);
    const blinkId = setInterval(() => (blinkOn = !blinkOn), 600);

    fetch("/api/topcoins")
      .then((r) => r.json())
      .then((d: { coins?: TuiCoinItem[]; global?: TuiGlobalData }) => {
        coins = (d.coins ?? [])
          .filter((c) => c.marketCap > 0)
          .sort((a, b) => b.marketCap - a.marketCap)
          .slice(0, 12);
        if (d.global?.totalMarketCapUsd) globalData = d.global;
      })
      .catch(() => {})
      .finally(() => {
        liveDataLoading = false;
      });

    void fetchAll();
    const refreshId = setInterval(() => void fetchAll(), 30_000);

    return () => {
      clearInterval(clockId);
      clearInterval(blinkId);
      clearInterval(refreshId);
    };
  });
</script>

<div class="d-root">
  <TuiTopbar
    {globalData}
    coinCount={coins.length}
    {clockTime}
    {blinkOn}
    loading={liveDataLoading}
    activePage="dashboard"
  />
  <TuiTickerBar {coins} coinDur={Math.max(24, coins.length * 4)} loading={liveDataLoading} />

  <div class="d-content">
    <div class="d-header">
      <span class="d-title">SYSTEM DASHBOARD</span>
      <div class="d-meta">
        {#if lastUpdated}
          <span class="d-updated">
            updated {lastUpdated.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        {/if}
        <button class="d-refresh-btn" onclick={fetchAll}>↺ REFRESH</button>
      </div>
    </div>

    {#if loading}
      <LoadingDots label="Loading dashboard" />
    {:else}
      <!-- ── Cycle health ─────────────────────────────────────────────────── -->
      <M3Surface title="Miner Cycle">
        {#if !refreshState}
          <p class="empty-state">
            No cycle data yet — waiting for first miner run
          </p>
        {:else}
          <div class="cycle-grid">
            <div class="cycle-stat">
              <span class="cycle-stat-label">Status</span>
              <span class="cycle-stat-value" style="color: {cycleStatusColor()};">
                <span class="dot" style="background: {cycleStatusColor()};"></span>
                {cycleStatus() === "ok"
                  ? "Healthy"
                  : cycleStatus() === "warn"
                    ? "Warning / partial failure"
                    : cycleStatus() === "error"
                      ? "Stalled"
                      : "Unknown"}
              </span>
            </div>
            <div class="cycle-stat">
              <span class="cycle-stat-label">Cycles completed</span>
              <span class="cycle-stat-value">{refreshState.cycle_count ?? "—"}</span>
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
            <div class="cycle-stat">
              <span class="cycle-stat-label">Interval</span>
              <span class="cycle-stat-value"
                >{progress?.intervalSec ? `${progress.intervalSec}s` : "—"}</span
              >
            </div>
          </div>
        {/if}
      </M3Surface>

      <!-- ── Coverage overview ───────────────────────────────────────────── -->
      <M3Surface title="Data Coverage">
        {#if !progress}
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
                style="color: {coverageColor(progress.sections.marketCoins.coveragePct)};"
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
                style="color: {coverageColor(progress.sections.coinBreakdown.coveragePct)};"
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
                style="color: {coverageColor(progress.sections.charts.coveragePct)};"
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
            <span class="freshness-badge fresh">{progress.freshness.fresh} fresh</span>
            <span class="freshness-badge warn">{progress.freshness.warning} warning</span>
            <span class="freshness-badge stale">{progress.freshness.stale} stale</span>
            {#if progress.freshness.unknown > 0}
              <span class="freshness-badge unknown">{progress.freshness.unknown} unknown</span>
            {/if}
            <span class="freshness-as-of"
              >as of {formatRelative(progress.snapshotTs ?? progress.asOf)}</span
            >
          </div>
        {/if}
      </M3Surface>

      <!-- ── Provider health ─────────────────────────────────────────────── -->
      <M3Surface title="Provider Health">
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
  </div>

  <TuiBottomBar branch="main" meta="SYSTEM DASHBOARD" />
  <div class="t-scanlines" aria-hidden="true"></div>
</div>

<style>
  .d-root {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #000;
    color: #c8d4cf;
    font-family: "JetBrains Mono", "Menlo", "Consolas", monospace;
    font-size: 0.7rem;
    line-height: 1.55;
    overflow: hidden;
    z-index: 9998;
  }

  .d-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* ── Dashboard sub-header ─────────────────────────────────────────────── */
  .d-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid rgba(176, 38, 255, 0.18);
    margin-bottom: 0.25rem;
  }

  .d-title {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: rgba(176, 38, 255, 0.75);
  }

  .d-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .d-updated {
    font-size: 0.62rem;
    color: rgba(200, 212, 207, 0.35);
  }

  .d-refresh-btn {
    background: transparent;
    border: 1px solid rgba(176, 38, 255, 0.35);
    color: rgba(176, 38, 255, 0.7);
    font-family: inherit;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.1rem 0.5rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .d-refresh-btn:hover {
    border-color: rgba(176, 38, 255, 0.7);
    color: #e3a4ff;
  }

  /* ── CRT overlay ──────────────────────────────────────────────────────── */
  .t-scanlines {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 1px,
      rgba(0, 0, 0, 0.04) 1px,
      rgba(0, 0, 0, 0.04) 2px
    );
  }

  .empty-state {
    padding: 2rem 1rem;
    text-align: center;
    color: rgba(200, 212, 207, 0.35);
    font-size: 0.75rem;
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
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(200, 212, 207, 0.38);
  }

  .cycle-stat-value {
    font-size: 0.8rem;
    font-weight: 500;
    color: #c8d4cf;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-variant-numeric: tabular-nums;
  }

  .dot {
    display: inline-block;
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* Coverage grid */
  .coverage-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
    padding: 0.5rem 0 0.75rem;
  }

  .coverage-card {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.65rem 0.85rem;
    border: 1px solid rgba(176, 38, 255, 0.18);
    background: rgba(176, 38, 255, 0.04);
  }

  .coverage-card-label {
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(200, 212, 207, 0.38);
  }

  .coverage-card-pct {
    font-size: 1.2rem;
    font-weight: 700;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  .coverage-card-sub {
    font-size: 0.62rem;
    color: rgba(200, 212, 207, 0.38);
  }

  /* Freshness row */
  .freshness-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.25rem 0 0.25rem;
  }

  .freshness-label {
    font-size: 0.62rem;
    font-weight: 600;
    color: rgba(200, 212, 207, 0.38);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-right: 0.15rem;
  }

  .freshness-badge {
    font-size: 0.62rem;
    font-weight: 600;
    padding: 0.08rem 0.45rem;
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
    color: rgba(200, 212, 207, 0.4);
    background: rgba(200, 212, 207, 0.08);
  }

  .freshness-as-of {
    font-size: 0.6rem;
    color: rgba(200, 212, 207, 0.3);
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
    grid-template-columns: 0.6rem 1fr auto auto auto;
    align-items: center;
    gap: 0.65rem 0.85rem;
    padding: 0.6rem 0;
    border-bottom: 1px solid rgba(176, 38, 255, 0.08);
  }

  .provider-row:last-child {
    border-bottom: none;
  }

  .status-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .provider-name {
    font-size: 0.72rem;
    font-weight: 500;
    color: #c8d4cf;
    text-transform: capitalize;
  }

  .provider-status {
    font-size: 0.68rem;
  }

  .provider-streak {
    font-size: 0.65rem;
    color: rgba(200, 212, 207, 0.38);
  }

  .provider-last {
    font-size: 0.65rem;
    color: rgba(200, 212, 207, 0.35);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>

