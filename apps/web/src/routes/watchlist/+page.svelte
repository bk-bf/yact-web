<script lang="ts">
  import { browser } from "$app/environment";
  import { getContext } from "svelte";
  import {
    createPriceJitter,
    isCoinJitterEligible,
  } from "../../lib/effects/usePriceJitter.svelte";
  import { useProgressiveDataLoad } from "../../lib/composables/useProgressiveDataLoad.svelte";
  import { loadWatchlistPageData } from "../../lib/pages/watchlist/watchlist-page.data";
  import {
    getMarketsDataCache,
    setMarketsDataCache,
    coerceMarketsPageData,
  } from "../../lib/pages/markets/markets-page.data";
  import {
    WATCHLIST_IDS_CONTEXT_KEY,
    type WatchlistIdsContext,
  } from "../../lib/composables/useWatchlistIds.svelte";
  import CoinTableRow from "../../lib/pages/markets/CoinTableRow.svelte";
  import type { MarketCoin } from "../../lib/types/market";
  import { smartUsd, percent } from "../../lib/utils/formatters";
  import {
    sparklinePath,
    chartDirectionClass,
    SPARKLINE_WIDTH,
    SPARKLINE_HEIGHT,
  } from "../../lib/utils/sparkline";

  let { data } = $props();
  const progressive = useProgressiveDataLoad(() => data);
  const viewData = $derived(progressive.getViewData());
  const watchlistIds = getContext<WatchlistIdsContext>(
    WATCHLIST_IDS_CONTEXT_KEY,
  );
  const jitter = createPriceJitter();

  // True while the first real fetch is in-flight.
  // Gates table rendering so 0-price placeholder rows never paint.
  const isEmpty = $derived(watchlistIds.getIds().length === 0);
  const isInitialLoad = $derived(!isEmpty && viewData.stale);

  // Suggestion cards (fetched once when the watchlist is empty).
  let suggestedCoins = $state<MarketCoin[]>([]);

  type SortKey =
    | "rank"
    | "name"
    | "price"
    | "change24h"
    | "change7d"
    | "marketCap"
    | "volume"
    | "supply";
  type SortDir = "asc" | "desc";
  let sortKey = $state<SortKey>("rank");
  let sortDir = $state<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortDir = sortDir === "desc" ? "asc" : "desc";
    } else {
      sortKey = key;
      sortDir = "desc";
    }
  }

  function sparkline7dChange(sparkline: number[]): number {
    if (!sparkline || sparkline.length < 2) return 0;
    const first = sparkline[0];
    if (first === 0) return 0;
    return (sparkline[sparkline.length - 1] - first) / first;
  }

  const sortedItems = $derived.by(() => {
    const items = [...viewData.items];
    const dir = sortDir === "asc" ? 1 : -1;
    items.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "price":
          return dir * (a.currentPrice - b.currentPrice);
        case "change24h":
          return (
            dir * (a.priceChangePercentage24h - b.priceChangePercentage24h)
          );
        case "change7d":
          return (
            dir *
            (sparkline7dChange(a.sparkline7d) -
              sparkline7dChange(b.sparkline7d))
          );
        case "marketCap":
          return dir * (a.marketCap - b.marketCap);
        case "volume":
          return dir * (a.totalVolume24h - b.totalVolume24h);
        case "supply":
          return dir * (a.circulatingSupply - b.circulatingSupply);
        default:
          return dir * (a.marketCapRank - b.marketCapRank);
      }
    });
    return items;
  });

  // Re-fetch whenever IDs change. Skip when empty — no data to load.
  $effect(() => {
    if (!browser) return;
    const currentIds = watchlistIds.getIds();
    if (currentIds.length === 0) return;
    void progressive.loadCritical(() =>
      loadWatchlistPageData(fetch, currentIds),
    );
  });

  // Load suggestion cards only when the watchlist is empty.
  // Read from the shared markets cache first (instant if navigated from markets page),
  // falling back to a fresh fetch only when the cache is cold.
  $effect(() => {
    if (!browser || !isEmpty) {
      suggestedCoins = [];
      return;
    }
    const cached = getMarketsDataCache();
    if (cached && cached.coins.length > 0) {
      suggestedCoins = cached.coins.slice(0, 6);
      return;
    }
    fetch("/api/markets")
      .then((r) => r.json())
      .then((d: Parameters<typeof coerceMarketsPageData>[0]) => {
        const normalized = coerceMarketsPageData(d);
        setMarketsDataCache(normalized);
        suggestedCoins = normalized.coins.slice(0, 6);
      })
      .catch(() => {});
  });

  $effect(() => {
    if (!browser) return;
    const coinEntries = viewData.items
      .filter(isCoinJitterEligible)
      .map((c) => ({ id: c.id, value: c.currentPrice }));
    return jitter.start(coinEntries);
  });
</script>

<svelte:head>
  <title>YACT Watchlist</title>
</svelte:head>

<section class="market-section">
  <h2 class="m3-surface-title">My Watchlist</h2>

  {#if isEmpty}
    <!-- Empty state widget -->
    <div class="watchlist-empty-wrap">
      <div class="watchlist-empty-icon" aria-hidden="true">★</div>
      <p class="watchlist-empty-heading">Your watchlist is empty</p>
      <p class="watchlist-empty-sub">
        Click ☆ on any coin to add it here, or pick one below.
      </p>

      {#if suggestedCoins.length > 0}
        <div class="watchlist-suggestions">
          {#each suggestedCoins as coin (coin.id)}
            {@const alreadyAdded = watchlistIds.getIds().includes(coin.id)}
            <button
              class="suggestion-card"
              class:suggestion-card--added={alreadyAdded}
              onclick={() =>
                alreadyAdded
                  ? watchlistIds.removeId(coin.id)
                  : watchlistIds.addId(coin.id)}
              aria-label="{alreadyAdded
                ? 'Remove'
                : 'Add'} {coin.name} {alreadyAdded ? 'from' : 'to'} watchlist"
            >
              <div class="suggestion-card__header">
                <span class="suggestion-card__identity">
                  <img
                    src={coin.image}
                    alt={coin.name}
                    width="20"
                    height="20"
                  />
                  <span class="suggestion-card__name">{coin.name}</span>
                </span>
                <span class="suggestion-card__add-icon" aria-hidden="true"
                  >{alreadyAdded ? "★" : "+"}</span
                >
              </div>
              <div class="suggestion-card__price">
                {smartUsd(coin.currentPrice)}
                <span
                  class={coin.priceChangePercentage24h >= 0
                    ? "positive"
                    : "negative"}
                >
                  {percent.format(coin.priceChangePercentage24h / 100)}
                </span>
              </div>
              <svg
                class={`suggestion-sparkline ${chartDirectionClass(coin.sparkline7d)}`}
                viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d={sparklinePath(coin.sparkline7d)} />
              </svg>
            </button>
          {/each}
        </div>
      {/if}

      <a href="/" class="watchlist-browse-link">Browse all markets →</a>
    </div>
  {:else if isInitialLoad}
    <!-- Suppress 0-price flash while first fetch is in-flight -->
    <div class="watchlist-loading" aria-label="Loading watchlist…">
      <span class="watchlist-loading__dot"></span>
      <span class="watchlist-loading__dot"></span>
      <span class="watchlist-loading__dot"></span>
    </div>
  {:else}
    <div class="market-table-wrap">
      <table class="market-table">
        <thead>
          <tr>
            {#snippet sortTh(key: SortKey, label: string)}
              <th class={sortKey === key ? "th--sorted" : ""}>
                <button class="sort-btn" onclick={() => toggleSort(key)}>
                  {label}<span class="sort-icon" aria-hidden="true"
                    >{sortKey === key
                      ? sortDir === "asc"
                        ? "▲"
                        : "▼"
                      : "⇅"}</span
                  >
                </button>
              </th>
            {/snippet}
            <th class="th-watchlist" aria-label="Watchlist"></th>
            {@render sortTh("rank", "Rank")}
            {@render sortTh("name", "Coin")}
            {@render sortTh("price", "Price")}
            {@render sortTh("change24h", "24h")}
            {@render sortTh("change7d", "7d")}
            {@render sortTh("marketCap", "Market Cap")}
            {@render sortTh("volume", "Volume (24h)")}
            {@render sortTh("supply", "Circulating Supply")}
          </tr>
        </thead>
        <tbody>
          {#each sortedItems as coin (coin.id)}
            <CoinTableRow {coin} {jitter} />
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  /* ── Empty state ────────────────────────────────────── */
  .watchlist-empty-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1rem 4rem;
    gap: 0.5rem;
  }

  .watchlist-empty-icon {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    background: rgba(176, 38, 255, 0.18);
    border: 1px solid var(--tv-highlight);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    color: var(--tv-highlight);
    margin-bottom: 0.75rem;
  }

  .watchlist-empty-heading {
    margin: 0;
    font-family: "Space Grotesk", sans-serif;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--tv-text-primary);
  }

  .watchlist-empty-sub {
    margin: 0 0 1.5rem;
    font-size: 0.9rem;
    color: var(--tv-text-muted);
    text-align: center;
    max-width: 28rem;
  }

  /* ── Suggestion cards ───────────────────────────────── */
  .watchlist-suggestions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    width: 100%;
    max-width: 760px;
    margin-bottom: 2rem;
  }

  @media (max-width: 680px) {
    .watchlist-suggestions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .suggestion-card {
    background: var(--tv-surface-1);
    border: 1px solid var(--tv-border);
    border-radius: var(--radius-md);
    padding: 0.85rem 1rem 0.65rem;
    cursor: pointer;
    text-align: left;
    color: var(--tv-text-primary);
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .suggestion-card:hover {
    border-color: var(--tv-highlight);
    background: var(--tv-surface-2);
  }

  .suggestion-card--added {
    border-color: var(--tv-highlight);
    background: rgba(176, 38, 255, 0.07);
  }

  .suggestion-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
  }

  .suggestion-card__identity {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .suggestion-card__name {
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .suggestion-card__add-icon {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: var(--tv-surface-2);
    border: 1px solid var(--tv-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    color: var(--tv-text-muted);
    line-height: 1;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .suggestion-card:hover .suggestion-card__add-icon,
  .suggestion-card--added .suggestion-card__add-icon {
    color: var(--tv-highlight);
    border-color: var(--tv-highlight);
  }

  .suggestion-card__price {
    font-size: 0.95rem;
    font-weight: 600;
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }

  .suggestion-card__price span {
    font-size: 0.8rem;
    font-weight: 500;
  }

  .suggestion-sparkline {
    width: 100%;
    height: 2rem;
    display: block;
    fill: none;
    stroke-width: 1.5;
    opacity: 0.8;
  }

  .suggestion-sparkline path {
    vector-effect: non-scaling-stroke;
  }

  /* inherits .positive / .negative from application-shell.css */

  .watchlist-browse-link {
    font-size: 0.9rem;
    color: var(--tv-highlight-soft);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .watchlist-browse-link:hover {
    color: var(--tv-highlight);
  }

  /* ── Loading skeleton ───────────────────────────────── */
  .watchlist-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 4rem 0;
  }

  .watchlist-loading__dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--tv-highlight);
    opacity: 0.5;
    animation: wl-dot-pulse 1.2s ease-in-out infinite;
  }

  .watchlist-loading__dot:nth-child(2) {
    animation-delay: 0.2s;
  }
  .watchlist-loading__dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes wl-dot-pulse {
    0%,
    80%,
    100% {
      opacity: 0.2;
      transform: scale(0.85);
    }
    40% {
      opacity: 0.9;
      transform: scale(1.15);
    }
  }
</style>
