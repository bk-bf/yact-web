<script lang="ts">
    // Placeholder filter bar — buttons are not yet wired to filtering state.
    // See TODO(T-007, .docs/features/open/ROADMAP.md) for implementation plan.
    import FilterBar from "$lib/components/FilterBar.svelte";

    const filters = [
        { label: "Top 100", active: true },
        { label: "Trending" },
        { label: "New Listings" },
        { label: "Layer 1" },
        { label: "DeFi" },
        { label: "AI Tokens" },
        { label: "All" },
        { label: "Highlights" },
        { label: "Base Ecosystem" },
        { label: "Categories" },
        { label: "Payment Solutions" },
        { label: "Perpetuals" },
        { label: "DEX" },
    ];
</script>

<FilterBar items={filters} role="toolbar" ariaLabel="Market filters" />
