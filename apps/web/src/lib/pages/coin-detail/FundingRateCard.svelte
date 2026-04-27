<script lang="ts">
    import { onMount } from "svelte";
    import CoinRailCard from "./CoinRailCard.svelte";
    import LoadingDots from "../../components/LoadingDots.svelte";
    import { sparklinePath } from "../../utils/sparkline";

    interface Props {
        coinId: string;
    }

    let { coinId }: Props = $props();

    interface FundingRateRow {
        coinId: string;
        exchange: string;
        rate: number;
        ts: number;
    }

    let loading = $state(true);
    let error = $state(false);
    let rates = $state<FundingRateRow[]>([]);

    const SPARKLINE_WIDTH = 140;
    const SPARKLINE_HEIGHT = 42;

    async function loadFundingRates() {
        loading = true;
        error = false;

        try {
            const response = await fetch(`/api/coins/${coinId}/funding-rates`, {
                cache: "no-store",
            });

            if (!response.ok) {
                error = true;
                return;
            }

            const data = await response.json();
            rates = Array.isArray(data.rates) ? data.rates : [];
        } catch {
            error = true;
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        void loadFundingRates();
    });

    const latestRate = $derived(rates.length > 0 ? rates[0].rate : null);
    const formattedRate = $derived(
        latestRate !== null ? (latestRate * 100).toFixed(4) + "%" : "--"
    );
    const isPositive = $derived(latestRate !== null && latestRate >= 0);
    const sparklineData = $derived(
        rates.length > 0
            ? rates.slice(-30).map((r) => r.rate * 100)
            : []
    );
    const sparklineSvg = $derived(sparklinePath(sparklineData, SPARKLINE_WIDTH, SPARKLINE_HEIGHT));
    const sparklineClass = $derived(
        sparklineData.length >= 2
            ? sparklineData[sparklineData.length - 1] >= sparklineData[0]
                ? "chart-positive"
                : "chart-negative"
            : "chart-negative"
    );
</script>

<CoinRailCard title="Funding Rate">
    {#if loading}
        <LoadingDots label="Loading funding rates" />
    {:else if error || rates.length === 0}
        <div class="no-data">Funding data unavailable</div>
    {:else}
        <div class="funding-content">
            <div class="funding-value" class:positive={isPositive} class:negative={!isPositive}>
                <span class="value-label">Current</span>
                <span class="value-number">{formattedRate}</span>
            </div>
            {#if sparklineSvg}
                <svg
                    class="funding-sparkline {sparklineClass}"
                    viewBox="0 0 {SPARKLINE_WIDTH} {SPARKLINE_HEIGHT}"
                >
                    <path d={sparklineSvg} />
                </svg>
            {/if}
        </div>
    {/if}
</CoinRailCard>

<style>
    .funding-content {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .funding-value {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }

    .value-label {
        font-size: 0.75rem;
        color: var(--tv-text-muted);
    }

    .value-number {
        font-size: 1.125rem;
        font-weight: 600;
    }

    .positive .value-number {
        color: var(--m3-positive);
    }

    .negative .value-number {
        color: var(--tv-negative);
    }

    .funding-sparkline {
        width: 140px;
        height: 42px;
    }

    .funding-sparkline path {
        fill: none;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .funding-sparkline.chart-positive path {
        stroke: var(--m3-positive);
    }

    .funding-sparkline.chart-negative path {
        stroke: var(--tv-negative);
    }

    .no-data {
        color: var(--tv-text-muted);
        font-size: 0.875rem;
    }
</style>