<script lang="ts">
    import FilterBar from "$lib/components/FilterBar.svelte";

    interface Props {
        activeFilter?: string;
        onfilter?: (label: string) => void;
    }

    let { activeFilter = "Top 100", onfilter }: Props = $props();

    const FILTER_LABELS = [
        "Top 100",
        "Trending",
        "Watchlist",
        "New Listings",
        "Layer 1",
        "DeFi",
        "AI Tokens",
        "All",
        "Highlights",
        "Base Ecosystem",
        "Categories",
        "Payment Solutions",
        "Perpetuals",
        "DEX",
    ];

    const filters = $derived(
        FILTER_LABELS.map((label) => ({ label, active: label === activeFilter }))
    );
</script>

<FilterBar
    items={filters}
    role="toolbar"
    ariaLabel="Market filters"
    onselect={(label) => onfilter?.(label)}
/>
