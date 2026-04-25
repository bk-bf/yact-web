<script lang="ts">
  import type { TuiCoinItem, TuiGlobalData } from "$lib/types/terminal";

  interface Props {
    globalData: TuiGlobalData | null;
    coinCount: number;
    clockTime: string;
    blinkOn: boolean;
    loading?: boolean;
    activePage?: "markets" | "watchlist" | "dashboard" | "terminal";
  }

  let { globalData, coinCount, clockTime, blinkOn, loading = false, activePage = "terminal" }: Props = $props();

  function fmtCompact(n: number): string {
    if (!isFinite(n) || n === 0) return "--";
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
    return "$" + Math.round(n).toLocaleString("en-US");
  }
</script>

<div class="t-topbar">
  <div class="t-topbar-l">
    <a href="/" class="t-brand-wrap" aria-label="YACT home">
      <span class="t-brand-text">YACT</span>
    </a>
    <span class="t-sep">│</span>
    <nav class="t-nav" aria-label="Primary">
      <a href="/" class="t-nav-link" class:t-nav-active={activePage === "markets"}>Markets</a>
      <a href="/watchlist" class="t-nav-link" class:t-nav-active={activePage === "watchlist"}>Watchlist</a>
      <a href="/dashboard" class="t-nav-link" class:t-nav-active={activePage === "dashboard"}>Dashboard</a>
      <a href="/terminal" class="t-nav-link" class:t-nav-active={activePage === "terminal"}>Terminal</a>
    </nav>
    <span class="t-sep">│</span>
    <span class="t-live-dot" class:blink={blinkOn}>●</span>
    <span class="t-live-label">LIVE</span>
    <span class="t-sep">│</span>
    <span class="t-pair">MCAP</span>
    <span class="t-price" class:t-loading={loading && !globalData}
      >{globalData ? fmtCompact(globalData.totalMarketCapUsd) : "···"}</span
    >
    {#if globalData && globalData.marketCapChangePercentage24hUsd != null && isFinite(globalData.marketCapChangePercentage24hUsd)}
      {@const pct = globalData.marketCapChangePercentage24hUsd}
      <span class="t-chg" class:pos={pct >= 0} class:neg={pct < 0}>
        {pct >= 0 ? "▲" : "▼"}{Math.abs(pct).toFixed(2)}%
      </span>
    {/if}
    <span class="t-sep">│</span>
    <span class="t-pair">VOL·24H</span>
    <span class="t-price-muted" class:t-loading={loading && !globalData}
      >{globalData ? fmtCompact(globalData.totalVolumeUsd) : "···"}</span
    >
  </div>
  <div class="t-topbar-r">
    <span class="t-kv"
      >BTC.DOM <b class:t-loading={loading && !globalData}
        >{globalData ? globalData.btcDominance.toFixed(1) + "%" : "···"}</b
      ></span
    >
    <span class="t-kv">COINS <b>{coinCount > 0 ? coinCount : "—"}</b></span>
    <span class="t-sep">│</span>
    <span class="t-clock">{clockTime} UTC</span>
  </div>
</div>

<style>
  .t-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.75rem;
    height: 2.4rem;
    flex-shrink: 0;
    background: #1e0938;
    border-bottom: 1px solid rgba(160, 60, 240, 0.4);
    box-shadow: 0 2px 20px rgba(120, 20, 200, 0.22);
    white-space: nowrap;
    overflow: hidden;
  }
  .t-topbar-l,
  .t-topbar-r {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
  }
  .t-brand-wrap {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
  }
  .t-brand-text {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #fff;
  }
  .t-nav {
    display: flex;
    align-items: center;
  }
  .t-nav-link {
    border: 0;
    border-right: 1px solid rgba(46, 53, 58, 0.8);
    padding: 0.18rem 0.65rem;
    background: transparent;
    color: rgba(217, 228, 223, 0.6);
    font-size: 0.7rem;
    font-weight: 600;
    font-family: inherit;
    text-decoration: none;
    cursor: pointer;
    transition: color 0.15s;
    white-space: nowrap;
  }
  .t-nav-link:last-child {
    border-right: 0;
  }
  .t-nav-link:hover {
    color: #e3a4ff;
  }
  .t-nav-active {
    color: #e3a4ff !important;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
  }
  .t-live-dot {
    color: #1ddf72;
    font-size: 0.6rem;
    transition: opacity 0.1s;
  }
  .t-live-dot.blink {
    opacity: 0.18;
  }
  .t-live-label {
    color: rgba(200, 212, 207, 0.4);
    font-size: 0.63rem;
  }
  .t-sep {
    color: rgba(176, 38, 255, 0.3);
  }
  .t-pair {
    color: #edf5f1;
    font-weight: 600;
  }
  .t-price {
    color: #fff;
    font-weight: 600;
  }
  .t-price-muted {
    color: rgba(200, 212, 207, 0.65);
    font-weight: 500;
  }
  .t-chg.pos {
    color: #1ddf72;
  }
  .t-chg.neg {
    color: #ff4d57;
  }
  .t-kv {
    color: rgba(200, 212, 207, 0.5);
    font-size: 0.65rem;
  }
  .t-kv b {
    color: #c8d4cf;
    font-weight: 500;
  }
  .t-clock {
    color: rgba(200, 212, 207, 0.4);
    font-size: 0.65rem;
    font-variant-numeric: tabular-nums;
  }
  .pos {
    color: #1ddf72;
  }
  .neg {
    color: #ff4d57;
  }
  .t-loading {
    opacity: 0.35;
    animation: t-pulse 1.2s ease-in-out infinite;
  }
  @keyframes t-pulse {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 0.7; }
  }
</style>
