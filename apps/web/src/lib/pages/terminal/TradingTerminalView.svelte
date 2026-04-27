<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  import TuiTopbar from "$lib/components/tui/TuiTopbar.svelte";
  import TuiTickerBar from "$lib/components/tui/TuiTickerBar.svelte";
  import TuiPortfolioPanel from "$lib/components/tui/TuiPortfolioPanel.svelte";
  import TuiSignalBars from "$lib/components/tui/TuiSignalBars.svelte";
  import TuiSignalStream from "$lib/components/tui/TuiSignalStream.svelte";
  import TuiRecentTrades from "$lib/components/tui/TuiRecentTrades.svelte";
  import TuiPriceDivergence from "$lib/components/tui/TuiPriceDivergence.svelte";
  import TuiEntryWindow from "$lib/components/tui/TuiEntryWindow.svelte";
  import TuiNewsFeed from "$lib/components/tui/TuiNewsFeed.svelte";
  import TuiBottomBar from "$lib/components/tui/TuiBottomBar.svelte";
  import TuiDashColumn from "$lib/components/tui/TuiDashColumn.svelte";

  import placeholder from "./terminal.placeholder.json";
  import type {
    TuiCoinItem,
    TuiGlobalData,
    TuiHeadline,
    LogEntry,
    BarItem,
    PriceDivRow,
    RegimeEvent,
  } from "$lib/types/terminal";

  // ── Reactive state ─────────────────────────────────────────────────────────
  let clockTime: string = $state("--:--:--");
  let blinkOn: boolean = $state(true);
  let streamRows: (LogEntry & { key: number })[] = $state([]);
  let newestKey: number = $state(-1);
  let coins: TuiCoinItem[] = $state([]);
  let headlines: TuiHeadline[] = $state([]);
  let newsRows: (TuiHeadline & { key: number })[] = $state([]);
  let globalData: TuiGlobalData | null = $state(null);
  let liveDataLoading: boolean = $state(true);

  // T-305 — live signal bars (F&G, Funding, OI)
  let signalBars: BarItem[] = $state(placeholder.signalBars as BarItem[]);
  let signalBarsLoading: boolean = $state(false);

  // T-304 — live regime events injected into signal stream
  let regimeEvents: RegimeEvent[] = $state([]);

  // T-306 — cross-exchange price divergence
  let priceDivCoins: Record<string, PriceDivRow[]> = $state({});
  let priceDivLoading: boolean = $state(true);

  // ── Derived ────────────────────────────────────────────────────────────────
  const coinDur = $derived(Math.max(24, coins.length * 4));

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(() => {
    if (!browser) return;

    const tick = () => {
      clockTime = new Date().toUTCString().slice(17, 25);
    };
    tick();
    const clockId = setInterval(tick, 1000);
    const blinkId = setInterval(() => (blinkOn = !blinkOn), 600);

    // Placeholder signal log stream — loops through placeholder log[]
    let logIdx = 0,
      rowKey = 0;
    const streamId = setInterval(() => {
      const e = placeholder.signalLog[logIdx % placeholder.signalLog.length];
      logIdx++;
      const k = ++rowKey;
      newestKey = k;
      streamRows = [
        ...streamRows.slice(-54),
        { ...e, ts: clockTime, key: k },
      ] as (LogEntry & { key: number })[];
    }, 480);

    // Vertical news feed
    let newsIdx = 0,
      newsKey = 0;
    const newsId = setInterval(() => {
      if (headlines.length === 0) return;
      const h = headlines[newsIdx % headlines.length];
      newsIdx++;
      const k = ++newsKey;
      newsRows = [...newsRows.slice(-7), { ...h, key: k }];
    }, 2800);

    // Top coins + global data
    fetch("/api/topcoins")
      .then((r) => r.json())
      .then((d: { coins?: TuiCoinItem[]; global?: TuiGlobalData }) => {
        coins = (d.coins ?? [])
          .filter((c) => c.marketCap > 0)
          .sort((a, b) => b.marketCap - a.marketCap)
          .slice(0, 12);
        if (d.global?.totalMarketCapUsd) globalData = d.global;
      })
      .catch(() => {})
      .finally(() => {
        liveDataLoading = false;
      });

    // News headlines
    fetch("/api/headlines")
      .then((r) => r.json())
      .then((d: { headlines?: TuiHeadline[] }) => {
        headlines = (d.headlines ?? []).slice(0, 12);
      })
      .catch(() => {});

    // T-304 — fetch live regime events and inject into stream
    fetch("/api/terminal/signal-events")
      .then((r) => r.json())
      .then((d: { events?: RegimeEvent[] }) => {
        regimeEvents = d.events ?? [];
        let rKey = rowKey;
        for (const ev of regimeEvents) {
          const k = ++rKey;
          newestKey = k;
          streamRows = [
            ...streamRows.slice(-54),
            {
              ts: ev.ts,
              kind: ev.kind,
              detail: ev.detail,
              tag: ev.tag as LogEntry["tag"],
              key: k,
            },
          ];
        }
        rowKey = rKey;
      })
      .catch(() => {});

    // T-305 — fetch live signal bars
    signalBarsLoading = true;
    fetch("/api/terminal/signal-bars")
      .then((r) => r.json())
      .then((d: { bars?: BarItem[] }) => {
        if (d.bars && d.bars.length > 0) {
          signalBars = d.bars;
        }
      })
      .catch(() => {})
      .finally(() => {
        signalBarsLoading = false;
      });

    // T-306 — fetch cross-exchange price divergence
    priceDivLoading = true;
    fetch("/api/terminal/price-divergence")
      .then((r) => r.json())
      .then((d: { coins?: Record<string, PriceDivRow[]> }) => {
        priceDivCoins = d.coins ?? {};
      })
      .catch(() => {})
      .finally(() => {
        priceDivLoading = false;
      });

    return () => {
      clearInterval(clockId);
      clearInterval(blinkId);
      clearInterval(streamId);
      clearInterval(newsId);
    };
  });
</script>

<div class="t-root">
  <TuiTopbar
    {globalData}
    coinCount={coins.length}
    {clockTime}
    {blinkOn}
    loading={liveDataLoading}
  />
  <TuiTickerBar {coins} {coinDur} loading={liveDataLoading} />

  <!-- ══ MAIN 3-COLUMN AREA ════════════════════════════════════════════════ -->
  <div class="t-main">
    <!-- ── LEFT COLUMN — Wallet tracker + signal bars ───────────────────── -->
    <TuiDashColumn loading={false}>
      <TuiPortfolioPanel />
      <TuiSignalBars bars={signalBars} loading={signalBarsLoading} />
    </TuiDashColumn>

    <!-- ── CENTER COLUMN — Regime signal stream + recent trades ─────────── -->
    <TuiDashColumn noScroll loading={false}>
      <TuiSignalStream
        rows={streamRows}
        {newestKey}
        {clockTime}
        {blinkOn}
        streamLabel={placeholder.signalStreamLabel}
      />
      <TuiRecentTrades trades={placeholder.trades} />
    </TuiDashColumn>

    <!-- ── RIGHT COLUMN — Price divergence + entry window + news ─────────── -->
    <TuiDashColumn noBorder loading={false}>
      <TuiPriceDivergence coins={priceDivCoins} loading={priceDivLoading} />
      <TuiEntryWindow items={placeholder.entryWindow} />
      <TuiNewsFeed {newsRows} />
    </TuiDashColumn>
  </div>

  <TuiBottomBar
    branch={placeholder.bottomBar.branch}
    meta={placeholder.bottomBar.meta}
  />

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

  /* ── Scrollbar styling ─────────────────────────────────────────────────── */
  ::-webkit-scrollbar {
    width: 3px;
    height: 3px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(176, 38, 255, 0.28);
  }
</style>
