<script lang="ts">
    import "../app.css";
    import { page } from "$app/stores";

    const primaryNav = [
        "Cryptocurrencies",
        "Exchanges",
        "Community",
        "Products",
        "Learn",
    ];

    const marketTabs = [
        "Top 100",
        "Trending",
        "New Listings",
        "Layer 1",
        "DeFi",
        "AI Tokens",
    ];
</script>

<div class="app-shell">
    <header class="terminal-header">
        <div class="top-nav-main">
            <div class="brand">
                <span class="brand-badge">YACT</span>
                <span class="brand-name">YACT Markets Terminal</span>
            </div>

            <nav class="menu-links" aria-label="Primary market menu">
                {#each primaryNav as navItem}
                    <button class="menu-link" type="button">{navItem}</button>
                {/each}
            </nav>

            <div class="menu-actions">
                <button class="menu-action outlined" type="button"
                    >Portfolio</button
                >
                <button class="menu-action outlined" type="button"
                    >Alerts</button
                >
                <button class="menu-action filled" type="button">Sign In</button
                >
            </div>
        </div>

        <div class="top-nav-sub">
            <div class="market-tabs">
                {#each marketTabs as tabName}
                    <button
                        class={`market-tab ${tabName === "Top 100" ? "active" : ""}`}
                        type="button"
                    >
                        {tabName}
                    </button>
                {/each}
            </div>

            <nav class="route-links">
                <a
                    class="route-link"
                    href="/"
                    aria-current={$page.url.pathname === "/"
                        ? "page"
                        : undefined}>Markets</a
                >
                <a
                    class="route-link"
                    href="/watchlist"
                    aria-current={$page.url.pathname === "/watchlist"
                        ? "page"
                        : undefined}>Watchlist</a
                >
            </nav>
        </div>
    </header>

    <slot />
</div>
