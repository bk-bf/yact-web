<script lang="ts">
    import { onMount } from "svelte";
    import CoinRailCard from "./CoinRailCard.svelte";
    import LoadingDots from "../../components/LoadingDots.svelte";
    import { formatStableCompactUsd } from "../../utils/formatters";

    type OpenInterestRow = {
        coinId: string;
        exchange: string;
        oiUsd: number;
        ts: number;
    };

    type Props = {
        coinId: string;
    };

    let { coinId }: Props = $props();

    let loading = $state(true);
    let error = $state(false);
    let oiData = $state<OpenInterestRow[]>([]);
    let exchanges = $state<string[]>([]);

    async function loadOpenInterest() {
        loading = true;
        error = false;

        try {
            const response = await fetch(`/api/coins/${coinId}/open-interest`);
            if (!response.ok) {
                throw new Error("fetch failed");
            }
            const payload = await response.json();
            oiData = payload.oi ?? [];
            exchanges = payload.exchanges ?? [];
        } catch {
            error = true;
            oiData = [];
            exchanges = [];
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        void loadOpenInterest();
    });

    const totalOi = $derived(
        oiData.reduce((sum, row) => sum + row.oiUsd, 0)
    );

    const latestRow = $derived(() => {
        if (oiData.length === 0) return null;
        return oiData.reduce((max, row) =>
            (row.ts > max.ts) ? row : max
        , oiData[0]);
    });

    const oneDayAgoMs = $derived(() => {
        const latest = latestRow();
        if (!latest) return null;
        const oneDayMs = 24 * 60 * 60 * 1000;
        return latest.ts - oneDayMs;
    });

    const oi24hAgo = $derived(() => {
        const cutoff = oneDayAgoMs();
        if (cutoff === null) return 0;
        const pastData = oiData.filter(row => row.ts <= cutoff);
        return pastData.reduce((sum, row) => sum + row.oiUsd, 0);
    });

    const change24h = $derived(() => {
        const past = oi24hAgo();
        const current = totalOi;
        if (past === 0) return null;
        return ((current - past) / past) * 100;
    });

    const hasData = $derived(oiData.length > 0 && totalOi > 0);

    const sparklineValues = $derived(() => {
        if (oiData.length === 0) return [];
        const byTime = new Map<number, number>();
        for (const row of oiData) {
            const hourKey = Math.floor(row.ts / (3600000));
            const existing = byTime.get(hourKey) ?? 0;
            if (row.oiUsd > existing) {
                byTime.set(hourKey, row.oiUsd);
            }
        }
        return Array.from(byTime.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, oi]) => oi);
    });

    const sparklinePath = $derived(() => {
        const values = sparklineValues();
        if (values.length < 2) return "";
        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = max - min || 1;
        const width = 100;
        const height = 24;
        const step = width / (values.length - 1);

        let path = "";
        values.forEach((v, i) => {
            const x = i * step;
            const y = height - ((v - min) / range) * height;
            path += `${i === 0 ? "M" : "L"}${x},${y} `;
        });
        return path;
    });
</script>

<CoinRailCard title="Open Interest">
    {#if loading}
        <LoadingDots label="Loading open interest..." />
    {:else if error || !hasData}
        <div class="oi-unavailable">
            <span class="oi-unavailable-text">OI unavailable</span>
            <span class="oi-unavailable-note">Only available for perpetual futures</span>
        </div>
    {:else}
        <div class="oi-content">
            <div class="oi-main">
                <span class="oi-label">Total OI</span>
                <span class="oi-value">{formatStableCompactUsd(totalOi)}</span>
            </div>
            {#if change24h() !== null}
                {@const ch = change24h()!}
                <div class="oi-change" class:positive={ch > 0} class:negative={ch < 0}>
                    <span>{ch > 0 ? "+" : ""}{ch.toFixed(1)}% (24h)</span>
                </div>
            {/if}
            {#if sparklinePath()}
                <div class="oi-sparkline-wrapper">
                    <svg viewBox="0 0 100 24" preserveAspectRatio="none" class="oi-sparkline">
                        <path d={sparklinePath()} fill="none" stroke="var(--tv-highlight)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </div>
            {/if}
            {#if exchanges.length > 0}
                <div class="oi-exchanges">
                    {#each exchanges as exchange}
                        <span class="oi-exchange-pill">{exchange}</span>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</CoinRailCard>

<style>
    .oi-unavailable {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        padding: 1.5rem 0;
    }

    .oi-unavailable-text {
        color: var(--tv-text-muted);
        font-size: 0.875rem;
    }

    .oi-unavailable-note {
        color: var(--tv-text-muted);
        opacity: 0.6;
        font-size: 0.75rem;
    }

    .oi-content {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .oi-main {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }

    .oi-label {
        color: var(--tv-text-muted);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .oi-value {
        color: var(--tv-text-primary);
        font-size: 1.25rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }

    .oi-change {
        font-size: 0.8125rem;
        font-weight: 500;
    }

    .oi-change.positive {
        color: var(--m3-positive);
    }

    .oi-change.negative {
        color: var(--tv-negative);
    }

    .oi-sparkline-wrapper {
        height: 1.5rem;
        width: 100%;
    }

    .oi-sparkline {
        width: 100%;
        height: 100%;
    }

    .oi-exchanges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        margin-top: 0.25rem;
    }

    .oi-exchange-pill {
        background: var(--tv-surface-2);
        color: var(--tv-text-muted);
        font-size: 0.6875rem;
        padding: 0.1875rem 0.5rem;
        border-radius: 999px;
    }
</style>