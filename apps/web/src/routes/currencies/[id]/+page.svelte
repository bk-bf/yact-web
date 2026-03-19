<script lang="ts">
    let { data } = $props();

    type ChartMode = "line" | "candles";
    type ChartRange = "24h" | "7d" | "1m" | "3m" | "ytd" | "1y" | "max";

    const chartRangeConfig: Record<
        ChartRange,
        {
            label: string;
            pointsRatio: number;
            durationHours: number;
            candleBuckets: number;
        }
    > = {
        "24h": {
            label: "24H",
            pointsRatio: 1 / 7,
            durationHours: 24,
            candleBuckets: 24,
        },
        "7d": {
            label: "7D",
            pointsRatio: 1,
            durationHours: 24 * 7,
            candleBuckets: 28,
        },
        "1m": {
            label: "1M",
            pointsRatio: 1,
            durationHours: 24 * 30,
            candleBuckets: 32,
        },
        "3m": {
            label: "3M",
            pointsRatio: 1,
            durationHours: 24 * 90,
            candleBuckets: 36,
        },
        ytd: {
            label: "YTD",
            pointsRatio: 1,
            durationHours: 24 * 180,
            candleBuckets: 40,
        },
        "1y": {
            label: "1Y",
            pointsRatio: 1,
            durationHours: 24 * 365,
            candleBuckets: 44,
        },
        max: {
            label: "MAX",
            pointsRatio: 1,
            durationHours: 24 * 730,
            candleBuckets: 48,
        },
    };

    let chartMode = $state<ChartMode>("line");
    let chartRange = $state<ChartRange>("24h");

    const chartWidth = 1000;
    const chartHeight = 470;
    const plotLeft = 14;
    const plotTop = 16;
    const plotWidth = 876;
    const priceHeight = 292;
    const volumeTop = 320;
    const volumeHeight = 56;
    const overviewTop = 420;
    const overviewHeight = 30;
    const rightLabelX = 978;

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

    const integerNumber = new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
    });

    const dateTime = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    const headlineTime = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    const shortTime = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });

    const shortDate = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    });

    function formatOptionalDate(value: string | null): string {
        if (!value) return "--";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "--";
        }

        return dateTime.format(date);
    }

    function formatHeadlineDate(value: string): string {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "--";
        }

        return headlineTime.format(date);
    }

    function clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }

    function buildLinePath(values: number[], min: number, max: number): string {
        if (values.length < 2) {
            return "";
        }

        const range = max - min || 1;
        const step = plotWidth / (values.length - 1);

        return values
            .map((value, index) => {
                const x = plotLeft + step * index;
                const y = plotTop + ((max - value) / range) * priceHeight;
                return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(" ");
    }

    function buildAreaPath(values: number[], min: number, max: number): string {
        const line = buildLinePath(values, min, max);
        if (!line) {
            return "";
        }

        return `${line} L ${plotLeft + plotWidth} ${plotTop + priceHeight} L ${plotLeft} ${plotTop + priceHeight} Z`;
    }

    function buildOverviewPath(values: number[]): string {
        if (values.length < 2) {
            return "";
        }

        const localMin = Math.min(...values);
        const localMax = Math.max(...values);
        const localRange = localMax - localMin || 1;
        const step = plotWidth / (values.length - 1);

        return values
            .map((value, index) => {
                const x = plotLeft + step * index;
                const y =
                    overviewTop +
                    ((localMax - value) / localRange) * overviewHeight;
                return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(" ");
    }

    function formatTickTime(
        index: number,
        totalTicks: number,
        durationHours: number,
    ): string {
        const now = Date.now();
        const offsetHours =
            durationHours * (1 - index / Math.max(totalTicks - 1, 1));
        const date = new Date(now - offsetHours * 3600 * 1000);
        if (durationHours <= 48) {
            return shortTime.format(date);
        }

        return shortDate.format(date);
    }

    function buildCandles(
        values: number[],
        buckets: number,
    ): Array<{ open: number; close: number; high: number; low: number }> {
        if (values.length < 2) {
            return [];
        }

        const candles: Array<{
            open: number;
            close: number;
            high: number;
            low: number;
        }> = [];
        const chunkSize = Math.max(2, Math.floor(values.length / buckets));

        for (let i = 0; i < values.length - 1; i += chunkSize) {
            const chunk = values.slice(
                i,
                Math.min(values.length, i + chunkSize),
            );
            if (chunk.length < 2) {
                continue;
            }

            candles.push({
                open: chunk[0],
                close: chunk[chunk.length - 1],
                high: Math.max(...chunk),
                low: Math.min(...chunk),
            });
        }

        return candles;
    }

    const coin = $derived(data.coin);
    const primaryHeadline = $derived(data.headlines[0] ?? null);
    const extraHeadlines = $derived((data.headlines ?? []).slice(1, 4));
    const bullishShare = $derived(
        clamp(Math.round(50 + coin.priceChangePercentage24h * 4), 5, 95),
    );
    const bearishShare = $derived(100 - bullishShare);
    const volToMcapPercent = $derived(
        coin.marketCap > 0 ? (coin.totalVolume24h / coin.marketCap) * 100 : 0,
    );
    const fdv = $derived(
        coin.maxSupply ? coin.maxSupply * coin.currentPrice : null,
    );

    const baseChartPrices = $derived(
        coin.chartPrices7d?.length > 1 ? coin.chartPrices7d : coin.sparkline7d,
    );

    const baseChartVolumes = $derived(
        coin.chartVolumes7d?.length > 1
            ? coin.chartVolumes7d
            : baseChartPrices.map((price, index, arr) => {
                  if (index === 0) {
                      return coin.totalVolume24h / 24;
                  }

                  const prev = arr[index - 1] || price;
                  const relativeMove = Math.abs((price - prev) / (prev || 1));
                  return (coin.totalVolume24h / 24) * (1 + relativeMove * 4);
              }),
    );

    const filteredChartPrices = $derived.by(() => {
        const prices = baseChartPrices;
        if (prices.length < 2) {
            return [coin.currentPrice, coin.currentPrice];
        }

        const ratio = chartRangeConfig[chartRange].pointsRatio;
        const windowPoints = clamp(
            Math.floor(prices.length * ratio),
            24,
            prices.length,
        );
        return prices.slice(prices.length - windowPoints);
    });

    const filteredChartVolumes = $derived.by(() => {
        const volumes = baseChartVolumes;
        const points = filteredChartPrices.length;
        if (!volumes.length || points < 2) {
            return new Array(points).fill(coin.totalVolume24h / 24);
        }

        return volumes.slice(Math.max(0, volumes.length - points));
    });

    const chartMin = $derived(Math.min(...filteredChartPrices));
    const chartMax = $derived(Math.max(...filteredChartPrices));
    const chartPadding = $derived(
        (chartMax - chartMin || chartMax || 1) * 0.12,
    );
    const scaledMin = $derived(Math.max(0, chartMin - chartPadding));
    const scaledMax = $derived(chartMax + chartPadding);
    const isPositive = $derived(
        filteredChartPrices[filteredChartPrices.length - 1] >=
            filteredChartPrices[0],
    );
    const linePath = $derived(
        buildLinePath(filteredChartPrices, scaledMin, scaledMax),
    );
    const areaPath = $derived(
        buildAreaPath(filteredChartPrices, scaledMin, scaledMax),
    );
    const overviewPath = $derived(buildOverviewPath(baseChartPrices));
    const yLevels = $derived(
        Array.from(
            { length: 6 },
            (_, idx) => scaledMax - ((scaledMax - scaledMin) * idx) / 5,
        ),
    );
    const volumeMax = $derived(Math.max(...filteredChartVolumes, 1));
    const candles = $derived(
        buildCandles(
            filteredChartPrices,
            chartRangeConfig[chartRange].candleBuckets,
        ),
    );
    const chartDurationHours = $derived(
        chartRangeConfig[chartRange].durationHours,
    );
    const xTickLabels = $derived(
        Array.from({ length: 6 }, (_, idx) =>
            formatTickTime(idx, 6, chartDurationHours),
        ),
    );
    const currentPriceY = $derived(
        plotTop +
            ((scaledMax - filteredChartPrices[filteredChartPrices.length - 1]) /
                (scaledMax - scaledMin || 1)) *
                priceHeight,
    );
</script>

<svelte:head>
    <title>{coin.name} Markets | YACT</title>
</svelte:head>

<section class="coin-terminal">
    {#if data.stale}
        <p class="warning-text">
            Showing cached coin snapshot while live detail data is unavailable.
        </p>
    {/if}

    <div class="coin-terminal-layout">
        <aside class="coin-left-rail">
            <article class="coin-rail-card coin-hero-card">
                <div class="coin-terminal-identity">
                    <img
                        src={coin.image}
                        alt={coin.name}
                        width="40"
                        height="40"
                    />
                    <h1>
                        {coin.name} <span>{coin.symbol.toUpperCase()}</span>
                    </h1>
                    <span class="metric-chip">#{coin.marketCapRank}</span>
                </div>

                <div class="coin-terminal-price">
                    <strong>{usd.format(coin.currentPrice)}</strong>
                    <span
                        class={coin.priceChangePercentage24h >= 0
                            ? "positive"
                            : "negative"}
                    >
                        {percent.format(coin.priceChangePercentage24h / 100)}
                    </span>
                </div>
            </article>

            <article class="coin-rail-card">
                <h3>Snapshot</h3>
                <ul class="coin-rail-list">
                    <li>
                        <span>Market cap</span><strong
                            >{compactUsd.format(coin.marketCap)}</strong
                        >
                    </li>
                    <li>
                        <span>Volume (24h)</span><strong
                            >{compactUsd.format(coin.totalVolume24h)}</strong
                        >
                    </li>
                    <li>
                        <span>Vol/Mcap ratio</span><strong
                            >{volToMcapPercent.toFixed(2)}%</strong
                        >
                    </li>
                    <li>
                        <span>FDV</span><strong
                            >{fdv ? compactUsd.format(fdv) : "--"}</strong
                        >
                    </li>
                </ul>
            </article>

            <article class="coin-rail-card">
                <h3>Supply</h3>
                <ul class="coin-rail-list">
                    <li>
                        <span>Circulating</span>
                        <strong
                            >{integerNumber.format(coin.circulatingSupply)}
                            {coin.symbol.toUpperCase()}</strong
                        >
                    </li>
                    <li>
                        <span>Max supply</span>
                        <strong
                            >{coin.maxSupply
                                ? `${integerNumber.format(coin.maxSupply)} ${coin.symbol.toUpperCase()}`
                                : "--"}</strong
                        >
                    </li>
                    <li>
                        <span>All-time high</span><strong
                            >{coin.allTimeHigh > 0
                                ? usd.format(coin.allTimeHigh)
                                : "--"}</strong
                        >
                    </li>
                    <li>
                        <span>ATH date</span><strong
                            >{formatOptionalDate(coin.allTimeHighDate)}</strong
                        >
                    </li>
                </ul>
            </article>

            <article class="coin-rail-card">
                <h3>Links</h3>
                <div class="coin-links">
                    {#if coin.homepage}
                        <a
                            class="m3-button outlined"
                            href={coin.homepage}
                            target="_blank"
                            rel="noreferrer">Website</a
                        >
                    {/if}
                    {#if coin.blockchainSite}
                        <a
                            class="m3-button outlined"
                            href={coin.blockchainSite}
                            target="_blank"
                            rel="noreferrer">Explorer</a
                        >
                    {/if}
                    <a
                        class="m3-button outlined"
                        href={coin.coingeckoUrl}
                        target="_blank"
                        rel="noreferrer">CoinGecko</a
                    >
                    <a
                        class="m3-button outlined"
                        href={coin.coinmarketcapUrl}
                        target="_blank"
                        rel="noreferrer">CoinMarketCap</a
                    >
                </div>
            </article>
        </aside>

        <main class="coin-main-panel">
            <div
                class="coin-terminal-tabs coin-terminal-tabs-center"
                role="tablist"
                aria-label="Coin sections"
            >
                <button class="coin-terminal-tab active" type="button"
                    >Chart</button
                >
                <button class="coin-terminal-tab" type="button">Markets</button>
                <button class="coin-terminal-tab" type="button">News</button>
                <button class="coin-terminal-tab" type="button">Yield</button>
                <button class="coin-terminal-tab" type="button">About</button>
            </div>

            <article class="coin-chart-card">
                <div class="coin-chart-shell">
                    <div class="coin-chart-toolbar">
                        <div class="coin-chart-left">
                            <div class="coin-chart-modes">
                                <button class="coin-chip active" type="button"
                                    >Price</button
                                >
                                <button class="coin-chip" type="button"
                                    >Mkt Cap</button
                                >
                            </div>

                            <div class="coin-chart-type">
                                <button
                                    class={`coin-chip ${chartMode === "line" ? "active" : ""}`}
                                    type="button"
                                    onclick={() => (chartMode = "line")}
                                    >Line</button
                                >
                                <button
                                    class={`coin-chip ${chartMode === "candles" ? "active" : ""}`}
                                    type="button"
                                    onclick={() => (chartMode = "candles")}
                                    >Candles</button
                                >
                            </div>
                        </div>

                        <div class="coin-chart-right">
                            <span class="coin-chart-provider"
                                >{coin.symbol.toUpperCase()} / USD</span
                            >

                            <div class="coin-chart-range">
                                {#each Object.entries(chartRangeConfig) as [key, value]}
                                    <button
                                        class={`coin-chip ${chartRange === key ? "active" : ""}`}
                                        type="button"
                                        onclick={() =>
                                            (chartRange = key as ChartRange)}
                                    >
                                        {value.label}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    </div>

                    <div
                        class="coin-widget-wrap"
                        aria-label={`${coin.name} custom chart`}
                    >
                        <svg
                            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                            class="coin-custom-chart"
                            role="img"
                            aria-label={`${coin.name} price and volume chart`}
                        >
                            <defs>
                                <linearGradient
                                    id="priceFill"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stop-color={isPositive
                                            ? "rgba(32, 214, 141, 0.28)"
                                            : "rgba(255, 77, 87, 0.28)"}
                                    />
                                    <stop
                                        offset="100%"
                                        stop-color="rgba(8, 13, 20, 0)"
                                    />
                                </linearGradient>
                            </defs>

                            <rect
                                x={plotLeft}
                                y={plotTop}
                                width={plotWidth}
                                height={priceHeight}
                                class="coin-chart-plot-bg"
                            />

                            {#each yLevels as level}
                                <line
                                    x1={plotLeft}
                                    x2={plotLeft + plotWidth}
                                    y1={plotTop +
                                        ((scaledMax - level) /
                                            (scaledMax - scaledMin || 1)) *
                                            priceHeight}
                                    y2={plotTop +
                                        ((scaledMax - level) /
                                            (scaledMax - scaledMin || 1)) *
                                            priceHeight}
                                    class="coin-chart-grid-line"
                                />
                                <text
                                    x={rightLabelX}
                                    y={plotTop +
                                        ((scaledMax - level) /
                                            (scaledMax - scaledMin || 1)) *
                                            priceHeight +
                                        4}
                                    class="coin-chart-axis-label"
                                    text-anchor="end"
                                >
                                    {compactUsd.format(level)}
                                </text>
                            {/each}

                            {#if chartMode === "line"}
                                <path d={areaPath} class="coin-chart-area" />
                                <path
                                    d={linePath}
                                    class={`coin-chart-line ${isPositive ? "positive" : "negative"}`}
                                />
                            {:else}
                                {#each candles as candle, index}
                                    {@const candleStep =
                                        plotWidth / Math.max(candles.length, 1)}
                                    {@const cx =
                                        plotLeft + candleStep * (index + 0.5)}
                                    {@const openY =
                                        plotTop +
                                        ((scaledMax - candle.open) /
                                            (scaledMax - scaledMin || 1)) *
                                            priceHeight}
                                    {@const closeY =
                                        plotTop +
                                        ((scaledMax - candle.close) /
                                            (scaledMax - scaledMin || 1)) *
                                            priceHeight}
                                    {@const highY =
                                        plotTop +
                                        ((scaledMax - candle.high) /
                                            (scaledMax - scaledMin || 1)) *
                                            priceHeight}
                                    {@const lowY =
                                        plotTop +
                                        ((scaledMax - candle.low) /
                                            (scaledMax - scaledMin || 1)) *
                                            priceHeight}
                                    {@const bodyY = Math.min(openY, closeY)}
                                    {@const bodyH = Math.max(
                                        1.5,
                                        Math.abs(closeY - openY),
                                    )}
                                    <line
                                        x1={cx}
                                        x2={cx}
                                        y1={highY}
                                        y2={lowY}
                                        class={`coin-candle-wick ${candle.close >= candle.open ? "up" : "down"}`}
                                    />
                                    <rect
                                        x={cx - candleStep * 0.28}
                                        y={bodyY}
                                        width={candleStep * 0.56}
                                        height={bodyH}
                                        class={`coin-candle-body ${candle.close >= candle.open ? "up" : "down"}`}
                                    />
                                {/each}
                            {/if}

                            <line
                                x1={plotLeft}
                                x2={plotLeft + plotWidth}
                                y1={currentPriceY}
                                y2={currentPriceY}
                                class="coin-current-line"
                            />
                            <rect
                                x={plotLeft + plotWidth + 4}
                                y={currentPriceY - 12}
                                width="88"
                                height="24"
                                rx="6"
                                class={`coin-current-pill ${isPositive ? "positive" : "negative"}`}
                            />
                            <text
                                x={plotLeft + plotWidth + 48}
                                y={currentPriceY + 5}
                                text-anchor="middle"
                                class="coin-current-pill-text"
                            >
                                {compactUsd.format(
                                    filteredChartPrices[
                                        filteredChartPrices.length - 1
                                    ],
                                )}
                            </text>

                            <rect
                                x={plotLeft}
                                y={volumeTop}
                                width={plotWidth}
                                height={volumeHeight}
                                class="coin-volume-bg"
                            />
                            {#each filteredChartVolumes as volume, idx}
                                {@const barWidth =
                                    plotWidth / filteredChartVolumes.length}
                                {@const barH =
                                    (volume / volumeMax) * volumeHeight}
                                <rect
                                    x={plotLeft + idx * barWidth + 0.4}
                                    y={volumeTop + (volumeHeight - barH)}
                                    width={Math.max(0.8, barWidth - 0.8)}
                                    height={barH}
                                    class="coin-volume-bar"
                                />
                            {/each}

                            {#each xTickLabels as label, idx}
                                <text
                                    x={plotLeft +
                                        (plotWidth * idx) /
                                            Math.max(xTickLabels.length - 1, 1)}
                                    y={401}
                                    text-anchor={idx === 0
                                        ? "start"
                                        : idx === xTickLabels.length - 1
                                          ? "end"
                                          : "middle"}
                                    class="coin-chart-time-label"
                                >
                                    {label}
                                </text>
                            {/each}

                            <line
                                x1={plotLeft}
                                x2={plotLeft + plotWidth}
                                y1={overviewTop + overviewHeight + 1}
                                y2={overviewTop + overviewHeight + 1}
                                class="coin-overview-baseline"
                            />
                            <path d={overviewPath} class="coin-overview-line" />
                        </svg>
                    </div>
                </div>
            </article>

            <article class="coin-about-card">
                <h3>{coin.name} Market Context</h3>
                {#if coin.description}
                    <p>{coin.description}</p>
                {:else}
                    <p class="muted">
                        No description available from the current data source.
                    </p>
                {/if}

                {#if coin.categories.length > 0}
                    <div>
                        {#each coin.categories.slice(0, 8) as category}
                            <span class="metric-chip">{category}</span>
                        {/each}
                    </div>
                {/if}
            </article>
        </main>

        <aside class="coin-right-rail">
            <article class="coin-rail-card">
                <h3>Community Sentiment</h3>
                <div
                    class="sentiment-bar"
                    aria-label="Bullish vs bearish sentiment"
                >
                    <span
                        class="sentiment-positive"
                        style={`width: ${bullishShare}%`}>{bullishShare}%</span
                    >
                    <span
                        class="sentiment-negative"
                        style={`width: ${bearishShare}%`}>{bearishShare}%</span
                    >
                </div>
            </article>

            <article class="coin-rail-card">
                <h3>Hot Topic</h3>
                {#if primaryHeadline}
                    <a
                        href={primaryHeadline.url}
                        target="_blank"
                        rel="noreferrer"
                        class="coin-news-link"
                    >
                        {primaryHeadline.title}
                    </a>
                    <p class="coin-news-meta">
                        {primaryHeadline.source} • {formatHeadlineDate(
                            primaryHeadline.publishedAt,
                        )}
                    </p>
                {:else}
                    <p class="muted">No headlines available right now.</p>
                {/if}
            </article>

            <article class="coin-rail-card">
                <h3>Latest</h3>
                {#if extraHeadlines.length > 0}
                    <ul class="coin-news-list">
                        {#each extraHeadlines as headline}
                            <li>
                                <a
                                    href={headline.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    class="coin-news-link"
                                >
                                    {headline.title}
                                </a>
                                <p class="coin-news-meta">
                                    {headline.source} • {formatHeadlineDate(
                                        headline.publishedAt,
                                    )}
                                </p>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p class="muted">No additional headlines available.</p>
                {/if}
            </article>

            <article class="coin-rail-card">
                <h3>Market Movers</h3>
                <ul class="coin-movers-list">
                    {#each data.topGainers.slice(0, 3) as mover}
                        <li>
                            <a href={`/currencies/${mover.id}`}>{mover.name}</a>
                            <span
                                class={mover.priceChangePercentage24h >= 0
                                    ? "positive"
                                    : "negative"}
                            >
                                {percent.format(
                                    mover.priceChangePercentage24h / 100,
                                )}
                            </span>
                        </li>
                    {/each}
                </ul>
            </article>
        </aside>
    </div>
</section>
