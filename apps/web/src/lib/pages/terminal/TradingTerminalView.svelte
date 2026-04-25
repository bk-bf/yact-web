<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  import TuiTopbar          from "$lib/components/tui/TuiTopbar.svelte";
  import TuiTickerBar        from "$lib/components/tui/TuiTickerBar.svelte";
  import TuiPortfolioPanel   from "$lib/components/tui/TuiPortfolioPanel.svelte";
  import TuiPositionsPanel   from "$lib/components/tui/TuiPositionsPanel.svelte";
  import TuiSessionMetrics   from "$lib/components/tui/TuiSessionMetrics.svelte";
  import TuiSignalBars       from "$lib/components/tui/TuiSignalBars.svelte";
  import TuiSignalStream     from "$lib/components/tui/TuiSignalStream.svelte";
  import TuiRecentTrades     from "$lib/components/tui/TuiRecentTrades.svelte";
  import TuiOrderBook        from "$lib/components/tui/TuiOrderBook.svelte";
  import TuiPnlSparkline     from "$lib/components/tui/TuiPnlSparkline.svelte";
  import TuiEntryWindow      from "$lib/components/tui/TuiEntryWindow.svelte";
  import TuiNewsFeed         from "$lib/components/tui/TuiNewsFeed.svelte";
  import TuiBottomBar        from "$lib/components/tui/TuiBottomBar.svelte";

  import placeholder from "./terminal.placeholder.json";
  import type { TuiCoinItem, TuiGlobalData, TuiHeadline, LogEntry, Position, OBLevel } from "$lib/types/terminal";

  // JSON imports lose literal union types — narrow at the boundary
  const typedPositions = placeholder.positions as Position[];
  const typedAsks      = placeholder.orderBook.asks as OBLevel[];
  const typedBids      = placeholder.orderBook.bids as OBLevel[];

  // ── Reactive state ─────────────────────────────────────────────────────────
  let clockTime:  string                                       = $state("--:--:--");
  let blinkOn:    boolean                                      = $state(true);
  let streamRows: (LogEntry & { key: number })[]               = $state([]);
  let newestKey:  number                                       = $state(-1);
  let coins:      TuiCoinItem[]                                = $state([]);
  let headlines:  TuiHeadline[]                                = $state([]);
  let newsRows:   (TuiHeadline & { key: number })[]            = $state([]);
  let globalData: TuiGlobalData | null                         = $state(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const coinDur = $derived(Math.max(24, coins.length * 4));

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(() => {
    if (!browser) return;

    const tick = () => { clockTime = new Date().toUTCString().slice(17, 25); };
    tick();
    const clockId = setInterval(tick, 1000);
    const blinkId = setInterval(() => (blinkOn = !blinkOn), 600);

    // Streaming signal log — infinite loop through placeholder log[], no pause/reset
    let logIdx = 0, rowKey = 0;
    const streamId = setInterval(() => {
      const e = placeholder.signalLog[logIdx % placeholder.signalLog.length];
      logIdx++;
      const k = ++rowKey;
      newestKey = k;
      streamRows = [...streamRows.slice(-54), { ...e, ts: clockTime, key: k }] as (LogEntry & { key: number })[];
    }, 480);

    // Vertical news feed — stream in one headline every 2.8 s
    let newsIdx = 0, newsKey = 0;
    const newsId = setInterval(() => {
      if (headlines.length === 0) return;
      const h = headlines[newsIdx % headlines.length];
      newsIdx++;
      const k = ++newsKey;
      newsRows = [...newsRows.slice(-7), { ...h, key: k }];
    }, 2800);

    // Top coins by market cap + global data (live DB)
    fetch("/api/markets")
      .then((r) => r.json())
      .then((d: { coins?: TuiCoinItem[]; global?: TuiGlobalData }) => {
        coins = (d.coins ?? [])
          .filter((c) => c.marketCap > 0)
          .sort((a, b) => b.marketCap - a.marketCap)
          .slice(0, 12);
        if (d.global?.totalMarketCapUsd) globalData = d.global;
      })
      .catch(() => {});

    // News headlines (live DB)
    fetch("/api/headlines")
      .then((r) => r.json())
      .then((d: { headlines?: TuiHeadline[] }) => {
        headlines = (d.headlines ?? []).slice(0, 12);
      })
      .catch(() => {});

    return () => {
      clearInterval(clockId);
      clearInterval(blinkId);
      clearInterval(streamId);
      clearInterval(newsId);
    };
  });
</script>

<div class="t-root">
  <TuiTopbar {globalData} coinCount={coins.length} {clockTime} {blinkOn} />
  <TuiTickerBar {coins} {coinDur} />

  <!-- ══ MAIN 3-COLUMN AREA ════════════════════════════════════════════════ -->
  <div class="t-main">

    <!-- ── LEFT COLUMN ──────────────────────────────────────────────────── -->
    <div class="t-col-left">
      <TuiPortfolioPanel portfolio={placeholder.portfolio} />
      <TuiPositionsPanel positions={typedPositions} />
      <TuiSessionMetrics metrics={placeholder.sessionMetrics} />
      <TuiSignalBars bars={placeholder.signalBars} />
    </div>

    <!-- ── CENTER COLUMN ─────────────────────────────────────────────────── -->
    <div class="t-col-center">
      <TuiSignalStream
        rows={streamRows}
        {newestKey}
        {clockTime}
        {blinkOn}
        streamLabel={placeholder.signalStreamLabel}
      />
      <TuiRecentTrades trades={placeholder.trades} />
    </div>

    <!-- ── RIGHT COLUMN ──────────────────────────────────────────────────── -->
    <div class="t-col-right">
      <TuiOrderBook
        asks={typedAsks}
        bids={typedBids}
        spread={placeholder.orderBook.spread}
      />
      <TuiPnlSparkline pnlSeries={placeholder.pnlSeries} stats={placeholder.pnlStats} />
      <TuiEntryWindow items={placeholder.entryWindow} />
      <TuiNewsFeed {newsRows} />
    </div>

  </div>

  <TuiBottomBar branch={placeholder.bottomBar.branch} meta={placeholder.bottomBar.meta} />

  <!-- CRT scanline overlay -->
  <div class="t-scanlines" aria-hidden="true"></div>
</div>

<style>
  /* ── Root ──────────────────────────────────────────────────────────────── */
  .t-root {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #000;
    color: #c8d4cf;
    font-family: "JetBrains Mono", "Menlo", "Consolas", monospace;
    font-size: 0.7rem;
    line-height: 1.55;
    overflow: hidden;
    z-index: 9998;
  }

  /* ── CRT overlay ───────────────────────────────────────────────────────── */
  .t-scanlines {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 1px,
      rgba(0, 0, 0, 0.04) 1px,
      rgba(0, 0, 0, 0.04) 2px
    );
  }

  /* ── Main grid ─────────────────────────────────────────────────────────── */
  .t-main {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 17rem 1fr 19rem;
    overflow: hidden;
    border-bottom: 1px solid rgba(176, 38, 255, 0.15);
  }

  /* ── Columns ───────────────────────────────────────────────────────────── */
  .t-col-left,
  .t-col-right {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    border-right: 1px solid rgba(176, 38, 255, 0.12);
    scrollbar-width: thin;
    scrollbar-color: rgba(176, 38, 255, 0.2) transparent;
  }
  .t-col-center {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
    border-right: 1px solid rgba(176, 38, 255, 0.12);
  }
  .t-col-right { border-right: none; }

  /* ── Scrollbar styling ─────────────────────────────────────────────────── */
  ::-webkit-scrollbar       { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(176, 38, 255, 0.28); }
</style>
