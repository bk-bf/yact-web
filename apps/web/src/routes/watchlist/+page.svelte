<script lang="ts">
    import { browser } from "$app/environment";
    import M3Surface from "../../lib/components/M3Surface.svelte";
    import M3Button from "../../lib/components/M3Button.svelte";
    import { useProgressiveDataLoad } from "../../lib/composables/useProgressiveDataLoad.svelte";
    import { loadWatchlistPageData } from "../../lib/pages/watchlist/watchlist-page.data";
    import { createWatchlistIds } from "../../lib/composables/useWatchlistIds.svelte";

    let { data } = $props();
    const progressive = useProgressiveDataLoad(() => data);
    const viewData = $derived(progressive.getViewData());
    const watchlistIds = createWatchlistIds();

    // Keep existing inline formatters (not refactoring per task constraints)
    const usd = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
    });

    const compactUsd = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 2,
    });

    const percent = new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: 2,
        signDisplay: "always",
    });

    function formatPrice(value: number): string {
        return value > 0 ? usd.format(value) : "--";
    }

    function formatPercent(value: number): string {
        return value !== 0 ? percent.format(value / 100) : "--";
    }

    function formatVolume(value: number): string {
        return value > 0 ? compactUsd.format(value) : "--";
    }

    let newCoinId = $state("");

    function handleAdd(): void {
        const trimmed = newCoinId.trim();
        if (!trimmed) return;
        watchlistIds.addId(trimmed);
        newCoinId = "";
    }

    function handleRemove(id: string): void {
        watchlistIds.removeId(id);
    }

    // Re-fetch whenever IDs change (reactive: getIds() reads $state).
    // Also fires on initial mount, replacing the old single-run $effect.
    $effect(() => {
        if (!browser) return;
        const currentIds = watchlistIds.getIds();
        void progressive.loadCritical(() => loadWatchlistPageData(fetch, currentIds));
    });
</script>

<svelte:head>
    <title>YACT Watchlist</title>
</svelte:head>

<M3Surface title="My Watchlist" tonal={true}>
    <div class="watchlist-add-row">
        <input
            type="text"
            class="watchlist-add-input"
            placeholder="Coin ID (e.g. solana)"
            bind:value={newCoinId}
            onkeydown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        <button class="m3-button outlined" onclick={handleAdd}>Add coin</button>
    </div>

    {#if viewData.items.length === 0}
        <p class="watchlist-empty">No coins in watchlist. Add one above.</p>
    {:else}
        <div class="watchlist-list">
            {#each viewData.items as coin (coin.id)}
                <div class="watchlist-row">
                    <span class="coin-identity">
                        <strong>{coin.name}</strong>
                        <span class="coin-symbol">{coin.symbol.toUpperCase()}</span>
                    </span>
                    <span class="metric-chip">Price: {formatPrice(coin.currentPrice)}</span>
                    <span class="metric-chip">24h: {formatPercent(coin.priceChangePercentage24h)}</span>
                    <span class="metric-chip">Volume: {formatVolume(coin.totalVolume24h)}</span>
                    <button
                        class="m3-button outlined watchlist-remove-btn"
                        onclick={() => handleRemove(coin.id)}
                        aria-label="Remove {coin.name} from watchlist"
                    >
                        Remove
                    </button>
                </div>
            {/each}
        </div>
    {/if}

    <div class="m3-button-row" style="margin-top: 1rem;">
        <M3Button href="/" tone="filled">Back To Markets</M3Button>
    </div>
</M3Surface>

<style>
    .watchlist-add-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 1rem;
    }

    .watchlist-add-input {
        flex: 1;
        padding: 0.5rem 0.75rem;
        border-radius: 4px;
        border: 1px solid currentColor;
        font-size: inherit;
        background: transparent;
        color: inherit;
    }

    .watchlist-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .watchlist-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .coin-identity {
        min-width: 10rem;
        display: flex;
        gap: 0.4rem;
        align-items: baseline;
    }

    .coin-symbol {
        opacity: 0.6;
        font-size: 0.85em;
    }

    .watchlist-remove-btn {
        margin-left: auto;
    }

    .watchlist-empty {
        opacity: 0.6;
        font-style: italic;
        margin: 1rem 0;
    }
</style>
