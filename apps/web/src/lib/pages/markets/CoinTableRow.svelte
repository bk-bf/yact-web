<script lang="ts">
  import { getContext, hasContext } from "svelte";
  import type { MarketCoin } from "../../types/market";
  import { isCoinJitterEligible } from "../../effects/usePriceJitter.svelte";
  import {
    usd,
    smartUsd,
    percent,
    compactNumber,
    formatDetailedUsd,
    formatStableCompactUsd,
  } from "../../utils/formatters";
  import {
    sparklinePath,
    chartDirectionClass,
    SPARKLINE_WIDTH,
    SPARKLINE_HEIGHT,
  } from "../../utils/sparkline";
  import {
    WATCHLIST_IDS_CONTEXT_KEY,
    type WatchlistIdsContext,
  } from "../../composables/useWatchlistIds.svelte";

  const {
    coin,
    jitter,
  }: {
    coin: MarketCoin;
    jitter: {
      getFlash(k: string): string | null;
      getValue(k: string, b: number): number;
    };
  } = $props();

  const watchlist = hasContext(WATCHLIST_IDS_CONTEXT_KEY)
    ? getContext<WatchlistIdsContext>(WATCHLIST_IDS_CONTEXT_KEY)
    : null;

  function formatJitterUsd(key: string, base: number): string {
    return formatDetailedUsd(jitter.getValue(key, base));
  }
</script>

<tr>
  <td class="col-watchlist">
    {#if watchlist}
      {@const inList = watchlist.getIds().includes(coin.id)}
      <button
        class="watchlist-star-btn"
        class:watchlist-star-btn--active={inList}
        onclick={() =>
          inList ? watchlist.removeId(coin.id) : watchlist.addId(coin.id)}
        aria-label="{inList ? 'Remove' : 'Add'} {coin.name} {inList
          ? 'from'
          : 'to'} watchlist">{inList ? "★" : "☆"}</button
      >
    {/if}
  </td>
  <td>{coin.marketCapRank}</td>
  <td>
    <div class="coin-name">
      <a
        class="coin-row-anchor"
        href={`/currencies/${encodeURIComponent(coin.id)}`}
        aria-label={`Open ${coin.name} breakdown`}
      >
        <img src={coin.image} alt={coin.name} width="24" height="24" />
        <span>{coin.name} ({coin.symbol.toUpperCase()})</span>
      </a>
    </div>
  </td>
  <td
    class={jitter.getFlash(coin.id) === "up"
      ? "price-tick-up"
      : jitter.getFlash(coin.id) === "down"
        ? "price-tick-down"
        : ""}
  >
    {isCoinJitterEligible(coin)
      ? formatJitterUsd(coin.id, coin.currentPrice)
      : smartUsd(coin.currentPrice)}
  </td>
  <td
    class={coin.priceChangePercentage24h == null
      ? "muted"
      : coin.priceChangePercentage24h >= 0
        ? "positive"
        : "negative"}
  >
    {coin.priceChangePercentage24h == null
      ? "—"
      : percent.format(coin.priceChangePercentage24h / 100)}
  </td>
  <td>
    <svg
      class={`sparkline sparkline-coin ${chartDirectionClass(coin.sparkline7d)}`}
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${coin.name} 7 day chart`}
    >
      <path d={sparklinePath(coin.sparkline7d)} />
    </svg>
  </td>
  <td>{formatStableCompactUsd(coin.marketCap)}</td>
  <td>{formatStableCompactUsd(coin.totalVolume24h)}</td>
  <td>
    {compactNumber.format(coin.circulatingSupply)}
    {coin.symbol.toUpperCase()}
  </td>
</tr>

<style>
  .col-watchlist {
    text-align: center;
    padding-left: 0.25rem;
    padding-right: 0.25rem;
  }

  .watchlist-star-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0.2rem 0.3rem;
    color: var(--tv-text-muted);
    transition:
      color 0.15s ease,
      transform 0.1s ease;
    border-radius: 3px;
  }

  .watchlist-star-btn:hover {
    color: var(--tv-highlight-soft);
    transform: scale(1.2);
  }

  .watchlist-star-btn--active {
    color: var(--tv-highlight);
  }

  .watchlist-star-btn--active:hover {
    color: var(--tv-highlight-soft);
  }
</style>
