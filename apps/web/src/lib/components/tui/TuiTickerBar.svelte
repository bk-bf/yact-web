<script lang="ts">
  import type { TuiCoinItem } from "$lib/types/terminal";

  interface Props {
    coins: TuiCoinItem[];
    coinDur: number;
    loading?: boolean;
  }

  let { coins, coinDur, loading = false }: Props = $props();

  function fmtPrice(p: number): string {
    if (!isFinite(p)) return "--";
    if (p >= 10000) return "$" + Math.round(p).toLocaleString("en-US");
    if (p >= 1)
      return (
        "$" +
        p.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    if (p >= 0.001) return "$" + p.toFixed(4);
    return "$" + p.toFixed(6);
  }
</script>

<div class="t-ticker-bar">
  <span class="ticker-label">TOP·{coins.length > 0 ? coins.length : "—"}</span>
  {#if coins.length > 0}
    <div
      class="ticker-overflow"
      aria-live="off"
      aria-label="Top coins by market cap"
    >
      <div class="ticker-inner" style="animation-duration: {coinDur}s">
        {#each [...coins, ...coins] as coin, i (i)}
          <span class="ticker-item">
            <span class="ti-sym">{coin.symbol.toUpperCase()}</span>
            <span class="ti-price">{fmtPrice(coin.currentPrice)}</span>
            <span
              class="ti-chg"
              class:pos={coin.priceChangePercentage24h >= 0}
              class:neg={coin.priceChangePercentage24h < 0}
              >{coin.priceChangePercentage24h >= 0 ? "▲" : "▼"}{Math.abs(
                coin.priceChangePercentage24h,
              ).toFixed(2)}%</span
            >
          </span>
          <span class="ticker-sep" aria-hidden="true">◆</span>
        {/each}
      </div>
    </div>
  {:else}
    <span class="ticker-placeholder" class:ticker-loading={loading}>
      {loading ? "· · ·" : "Waiting for live data…"}
    </span>
  {/if}
</div>

<style>
  .t-ticker-bar {
    display: flex;
    align-items: center;
    height: 1.65rem;
    flex-shrink: 0;
    overflow: hidden;
    border-bottom: 1px solid rgba(176, 38, 255, 0.18);
    background: #050008;
  }
  .ticker-label {
    flex-shrink: 0;
    padding: 0 0.6rem;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: rgba(176, 38, 255, 0.75);
    border-right: 1px solid rgba(176, 38, 255, 0.2);
    height: 100%;
    display: flex;
    align-items: center;
  }
  .ticker-overflow {
    flex: 1;
    overflow: hidden;
    position: relative;
    height: 100%;
  }
  .ticker-inner {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    animation: ticker-scroll linear infinite;
    will-change: transform;
    height: 100%;
  }
  .ticker-inner:hover {
    animation-play-state: paused;
  }
  .ticker-item {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0 0.5rem;
  }
  .ti-sym {
    color: #edf5f1;
    font-weight: 600;
    font-size: 0.68rem;
  }
  .ti-price {
    color: rgba(200, 212, 207, 0.8);
    font-variant-numeric: tabular-nums;
  }
  .ti-chg {
    font-size: 0.63rem;
  }
  .ticker-sep {
    color: rgba(176, 38, 255, 0.3);
    padding: 0 0.15rem;
    flex-shrink: 0;
  }
  .ticker-placeholder {
    padding: 0 0.75rem;
    color: rgba(200, 212, 207, 0.3);
    font-size: 0.65rem;
  }
  .ticker-loading {
    animation: ticker-pulse 1.2s ease-in-out infinite;
  }
  @keyframes ticker-pulse {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 0.7;
    }
  }
  .pos {
    color: #1ddf72;
  }
  .neg {
    color: #ff4d57;
  }

  @keyframes ticker-scroll {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }
</style>
