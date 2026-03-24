<script lang="ts">
  import { getContext, hasContext } from "svelte";
  import type { CoinBreakdown } from "./coin-detail-page.data";
  import { usd, percent } from "../../utils/formatters";
  import CoinRailCard from "./CoinRailCard.svelte";
  import {
    WATCHLIST_IDS_CONTEXT_KEY,
    type WatchlistIdsContext,
  } from "../../composables/useWatchlistIds.svelte";

  const { coin }: { coin: CoinBreakdown } = $props();

  const watchlist = hasContext(WATCHLIST_IDS_CONTEXT_KEY)
    ? getContext<WatchlistIdsContext>(WATCHLIST_IDS_CONTEXT_KEY)
    : null;
</script>

<CoinRailCard extraClass="coin-hero-card">
  <div class="coin-terminal-identity">
    <div class="coin-title-wrap">
      <img src={coin.image} alt={coin.name} width="40" height="40" />
      <h1>
        <span class="coin-title-name">{coin.name}</span>
        <span class="coin-title-symbol">{coin.symbol.toUpperCase()}</span>
      </h1>
    </div>
    <div class="coin-rank-area">
      {#if watchlist}
        {@const inList = watchlist.getIds().includes(coin.id)}
        <button
          class="watchlist-star-btn hero-star"
          class:watchlist-star-btn--active={inList}
          onclick={() =>
            inList ? watchlist.removeId(coin.id) : watchlist.addId(coin.id)}
          aria-label="{inList ? 'Remove' : 'Add'} {coin.name} {inList
            ? 'from'
            : 'to'} watchlist">{inList ? "★" : "☆"}</button
        >
      {/if}
      <span class="coin-rank-pill">#{coin.marketCapRank}</span>
    </div>
  </div>

  <div class="coin-terminal-price">
    <strong>{usd.format(coin.currentPrice)}</strong>
    <span class={coin.priceChangePercentage24h >= 0 ? "positive" : "negative"}>
      {percent.format(coin.priceChangePercentage24h / 100)}
    </span>
  </div>
</CoinRailCard>

<style>
  .coin-rank-area {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .watchlist-star-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
    padding: 0.25rem 0.35rem;
    color: var(--tv-text-muted);
    transition:
      color 0.15s ease,
      transform 0.1s ease;
    border-radius: 4px;
  }

  .watchlist-star-btn:hover {
    color: var(--tv-highlight-soft);
    transform: scale(1.15);
  }

  .watchlist-star-btn--active {
    color: var(--tv-highlight);
  }

  .watchlist-star-btn--active:hover {
    color: var(--tv-highlight-soft);
  }

  .hero-star {
    font-size: 1.25rem;
  }
</style>
