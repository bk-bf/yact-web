<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        createChart,
        ColorType,
        CrosshairMode,
        LineStyle,
        AreaSeries,
        CandlestickSeries,
        HistogramSeries,
        type IChartApi,
        type ISeriesApi,
        type SeriesType,
        type Time,
    } from "lightweight-charts";

    interface Props {
        prices: number[];
        volumes: number[];
        timestamps: number[]; // milliseconds
        chartMode: "line" | "candles";
        candleBuckets: number;
        currentPrice: number;
        isPositive: boolean;
        loading: boolean;
        coinId: string;
        coinName: string;
    }

    let {
        prices,
        volumes,
        timestamps,
        chartMode,
        candleBuckets,
        currentPrice,
        isPositive,
        loading,
        coinId,
        coinName,
    }: Props = $props();

    // ─── Color palette (hardcoded from CSS vars — LW Charts can't read CSS vars) ───
    const C = {
        bg: "transparent",
        textMuted: "#9aa7a0",
        textPrimary: "#edf5f1",
        divider: "#232a2f",
        border: "#2b2f33",
        positive: "#1ddf72",
        negative: "#ff4d57",
        positiveAlpha20: "rgba(29, 223, 114, 0.20)",
        negativeAlpha20: "rgba(255, 77, 87, 0.20)",
        accentLine: "rgba(176, 38, 255, 0.55)",
        accentAxisBg: "#1a0829",
        volumeBar: "rgba(176, 38, 255, 0.32)",
    };

    let container: HTMLDivElement;
    let chart: IChartApi | null = null;
    let mainSeries: ISeriesApi<SeriesType> | null = null;
    let volumeSeries: ISeriesApi<"Histogram"> | null = null;

    // ─── Tooltip state ────────────────────────────────────────────────────────────
    let tooltipVisible = $state(false);
    let tooltipX = $state(0);
    let tooltipY = $state(0);
    let tooltipPrice = $state(0);
    let tooltipVolume = $state(0);
    let tooltipTimeSec = $state(0);
    let containerW = $state(800);

    const compactUsd = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 2,
    });

    const tooltipDateFmt = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
    });

    function formatTooltipTime(sec: number): string {
        return tooltipDateFmt.format(new Date(sec * 1000));
    }

    // ─── helpers ──────────────────────────────────────────────────────────────────

    function toSec(ms: number): Time {
        return Math.floor(ms / 1000) as Time;
    }

    /** Deduplicate ascending timestamps — LW Charts requires strictly unique times. */
    function dedup<T extends { time: Time }>(arr: T[]): T[] {
        const seen = new Set<number>();
        const out: T[] = [];
        for (const item of arr) {
            const t = item.time as number;
            if (!seen.has(t)) {
                seen.add(t);
                out.push(item);
            } else {
                // If duplicate, advance by 1 second
                const adjusted = t + 1;
                if (!seen.has(adjusted)) {
                    seen.add(adjusted);
                    out.push({ ...item, time: adjusted as Time });
                }
            }
        }
        return out;
    }

    /** Time-span-based bucketing — each candle covers an equal time window. */
    function buildCandles(
        vals: number[],
        ts: number[],
        buckets: number,
    ): Array<{
        time: Time;
        open: number;
        high: number;
        low: number;
        close: number;
    }> {
        if (vals.length < 2 || ts.length < 2) return [];

        const firstTs = ts[0];
        const lastTs = ts[ts.length - 1];
        const span = lastTs - firstTs;

        // Fall back to index-based if all timestamps are the same
        if (span <= 0) {
            const effective = Math.max(1, Math.min(buckets, vals.length));
            const chunk = Math.max(1, Math.floor(vals.length / effective));
            const out: Array<{
                time: Time;
                open: number;
                high: number;
                low: number;
                close: number;
            }> = [];
            for (let i = 0; i < vals.length; i += chunk) {
                const c = vals.slice(i, Math.min(vals.length, i + chunk));
                if (!c.length) continue;
                out.push({
                    time: toSec(firstTs + i),
                    open: c[0],
                    close: c[c.length - 1],
                    high: Math.max(...c),
                    low: Math.min(...c),
                });
            }
            return dedup(out);
        }

        const width = span / buckets;
        const out: Array<{
            time: Time;
            open: number;
            high: number;
            low: number;
            close: number;
        }> = [];

        for (let b = 0; b < buckets; b++) {
            const bStart = firstTs + b * width;
            const bEnd = bStart + width;
            const chunk: number[] = [];
            for (let i = 0; i < vals.length; i++) {
                if (ts[i] >= bStart && (ts[i] < bEnd || b === buckets - 1)) {
                    chunk.push(vals[i]);
                }
            }
            if (!chunk.length) continue;
            out.push({
                time: toSec(bStart),
                open: chunk[0],
                close: chunk[chunk.length - 1],
                high: Math.max(...chunk),
                low: Math.min(...chunk),
            });
        }

        return dedup(out);
    }

    /** Volume bucketed to match candle time windows (sum per bucket). */
    function buildBucketedVolume(
        vols: number[],
        ts: number[],
        buckets: number,
    ): Array<{ time: Time; value: number; color: string }> {
        if (vols.length < 2 || ts.length < 2) return buildVolumeData(vols, ts);

        const firstTs = ts[0];
        const lastTs = ts[ts.length - 1];
        const span = lastTs - firstTs;
        if (span <= 0) return buildVolumeData(vols, ts);

        const width = span / buckets;
        const out: Array<{ time: Time; value: number; color: string }> = [];

        for (let b = 0; b < buckets; b++) {
            const bStart = firstTs + b * width;
            const bEnd = bStart + width;
            let total = 0;
            let count = 0;
            for (let i = 0; i < vols.length; i++) {
                if (ts[i] >= bStart && (ts[i] < bEnd || b === buckets - 1)) {
                    total += vols[i];
                    count++;
                }
            }
            if (!count) continue;
            out.push({ time: toSec(bStart), value: total, color: C.volumeBar });
        }

        return dedup(out);
    }

    function buildLineData(
        vals: number[],
        ts: number[],
    ): Array<{ time: Time; value: number }> {
        const raw = vals.map((v, i) => ({
            time: toSec(ts[i] ?? ts[ts.length - 1]),
            value: v,
        }));
        return dedup(raw);
    }

    function buildVolumeData(
        vols: number[],
        ts: number[],
    ): Array<{ time: Time; value: number; color: string }> {
        const raw = vols.map((v, i) => ({
            time: toSec(ts[i] ?? ts[ts.length - 1]),
            value: v,
            color: C.volumeBar,
        }));
        return dedup(raw);
    }

    // ─── Chart lifecycle ──────────────────────────────────────────────────────────

    function destroySeries() {
        if (mainSeries && chart) {
            chart.removeSeries(mainSeries);
            mainSeries = null;
        }
        if (volumeSeries && chart) {
            chart.removeSeries(volumeSeries);
            volumeSeries = null;
        }
    }

    function addLineSeries(pos: boolean) {
        if (!chart) return;
        const lineColor = pos ? C.positive : C.negative;
        const topColor = pos ? C.positiveAlpha20 : C.negativeAlpha20;
        mainSeries = chart.addSeries(AreaSeries, {
            lineColor,
            topColor,
            bottomColor: "transparent",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            crosshairMarkerBorderColor: lineColor,
            crosshairMarkerBackgroundColor: "#030303",
        });
    }

    function addCandleSeries() {
        if (!chart) return;
        mainSeries = chart.addSeries(CandlestickSeries, {
            upColor: C.positive,
            downColor: C.negative,
            borderUpColor: C.positive,
            borderDownColor: C.negative,
            wickUpColor: C.positive,
            wickDownColor: C.negative,
            lastValueVisible: false,
            priceLineVisible: false,
        });
    }

    function addVolumeSeries() {
        if (!chart) return;
        volumeSeries = chart.addSeries(HistogramSeries, {
            color: C.volumeBar,
            priceFormat: { type: "volume" },
            priceScaleId: "volume",
            lastValueVisible: false,
            priceLineVisible: false,
        });
        chart.priceScale("volume").applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
            visible: false,
        });
    }

    function applyData() {
        if (!chart || !mainSeries) return;

        if (chartMode === "candles") {
            const candleData = buildCandles(prices, timestamps, candleBuckets);
            (mainSeries as ISeriesApi<"Candlestick">).setData(candleData);
        } else {
            const lineData = buildLineData(prices, timestamps);
            (mainSeries as ISeriesApi<"Area">).setData(lineData);
        }

        if (volumeSeries) {
            const volData =
                chartMode === "candles"
                    ? buildBucketedVolume(volumes, timestamps, candleBuckets)
                    : buildVolumeData(volumes, timestamps);
            volumeSeries.setData(volData);
        }

        // Current price line — green/red to match price direction
        if (mainSeries && currentPrice > 0) {
            mainSeries.createPriceLine({
                price: currentPrice,
                color: isPositive ? C.positive : C.negative,
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: "",
            });
        }

        chart.timeScale().fitContent();
    }

    function rebuildSeries() {
        destroySeries();
        if (chartMode === "candles") {
            addCandleSeries();
        } else {
            addLineSeries(isPositive);
        }
        addVolumeSeries();
        applyData();
    }

    onMount(() => {
        chart = createChart(container, {
            autoSize: true,
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: C.textMuted,
            },
            grid: {
                vertLines: { color: C.divider, style: LineStyle.Solid },
                horzLines: { color: C.divider, style: LineStyle.Solid },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: C.accentLine,
                    labelBackgroundColor: C.accentAxisBg,
                    style: LineStyle.Dashed,
                    width: 1,
                },
                horzLine: {
                    color: C.accentLine,
                    labelBackgroundColor: C.accentAxisBg,
                    style: LineStyle.Dashed,
                    width: 1,
                },
            },
            rightPriceScale: {
                borderColor: C.border,
                textColor: C.textMuted,
            },
            timeScale: {
                borderColor: C.border,
                timeVisible: true,
                secondsVisible: false,
            },
            handleScroll: true,
            handleScale: true,
        });

        rebuildSeries();
        subscribeTooltip();
    });

    function subscribeTooltip() {
        if (!chart) return;
        chart.subscribeCrosshairMove((param) => {
            if (!param.point || !param.time || !mainSeries) {
                tooltipVisible = false;
                return;
            }

            const data = param.seriesData.get(mainSeries);
            if (!data) {
                tooltipVisible = false;
                return;
            }

            let price: number;
            if ("value" in data) {
                price = (data as { value: number }).value;
            } else if ("close" in data) {
                price = (data as { close: number }).close;
            } else {
                tooltipVisible = false;
                return;
            }

            let vol = 0;
            if (volumeSeries) {
                const vd = param.seriesData.get(volumeSeries);
                if (vd && "value" in vd) vol = (vd as { value: number }).value;
            }

            tooltipPrice = price;
            tooltipVolume = vol;
            tooltipTimeSec = param.time as number;
            tooltipX = param.point.x;
            tooltipY = param.point.y;
            containerW = container?.offsetWidth ?? 800;
            tooltipVisible = true;
        });
    }

    onDestroy(() => {
        chart?.remove();
        chart = null;
        mainSeries = null;
        volumeSeries = null;
    });

    // ─── Reactive updates ─────────────────────────────────────────────────────────

    $effect(() => {
        // Track all reactive inputs
        const _p = prices;
        const _v = volumes;
        const _t = timestamps;
        const _m = chartMode;
        const _b = candleBuckets;
        const _pos = isPositive;
        const _cp = currentPrice;
        void _p, _v, _t, _b, _cp;

        if (!chart) return;

        // Rebuild series when mode or polarity changes (need different series type/color)
        rebuildSeries();
    });
</script>

<div
    bind:this={container}
    class="lw-chart-container"
    class:chart-loading={loading}
    role="img"
    aria-label="{coinName} price chart"
>
    {#if tooltipVisible}
        <div
            class="lw-tooltip"
            style:left="{tooltipX < containerW / 2
                ? tooltipX + 14
                : tooltipX - 154}px"
            style:top="{Math.max(4, tooltipY - 10)}px"
        >
            <p class="lw-tooltip-date">{formatTooltipTime(tooltipTimeSec)}</p>
            <p class="lw-tooltip-row">
                <span>Price</span>
                <strong>{compactUsd.format(tooltipPrice)}</strong>
            </p>
            {#if tooltipVolume > 0}
                <p class="lw-tooltip-row">
                    <span>Vol</span>
                    <strong>{compactUsd.format(tooltipVolume)}</strong>
                </p>
            {/if}
        </div>
    {/if}
</div>

<style>
    .lw-chart-container {
        width: 100%;
        height: 400px;
        position: relative;
        transition: opacity 0.2s ease;
        overflow: visible;
    }

    .lw-chart-container.chart-loading {
        opacity: 0.45;
    }

    .lw-tooltip {
        position: absolute;
        z-index: 10;
        pointer-events: none;
        background: rgba(3, 3, 3, 0.88);
        border: 1px solid #2b2f33;
        border-radius: 6px;
        padding: 7px 10px;
        min-width: 140px;
        backdrop-filter: blur(6px);
    }

    .lw-tooltip-date {
        font-size: 0.7rem;
        color: #9aa7a0;
        margin: 0 0 4px;
        white-space: nowrap;
    }

    .lw-tooltip-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        margin: 2px 0 0;
        font-size: 0.78rem;
    }

    .lw-tooltip-row span {
        color: #9aa7a0;
    }

    .lw-tooltip-row strong {
        color: #edf5f1;
        font-weight: 600;
    }
</style>
