<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  let clockTime = $state("--:--:--");
  let blinkOn = $state(true);
  let streamEl: HTMLElement | null = null;

  onMount(() => {
    if (!browser) return;
    const tick = () => {
      const now = new Date();
      clockTime = now.toUTCString().slice(17, 25);
    };
    tick();
    const id = setInterval(tick, 1000);
    const blinkId = setInterval(() => (blinkOn = !blinkOn), 600);
    // Scroll signal stream to latest entry
    if (streamEl) streamEl.scrollTop = streamEl.scrollHeight;
    return () => {
      clearInterval(id);
      clearInterval(blinkId);
    };
  });

  // ── Types ──────────────────────────────────────────────────────────────────
  type Tag =
    | "SKIP"
    | "WATCH"
    | "GAP"
    | "PENDING"
    | "MATCH"
    | "ENTER"
    | "EXIT"
    | "CUT"
    | "TIMEOUT"
    | "SCAN";
  interface LogEntry {
    ts: string;
    kind: string;
    detail: string;
    tag: Tag;
  }
  interface OBLevel {
    price: string;
    size: string;
    depth: number;
    side: "ask" | "bid";
  }
  interface Position {
    pair: string;
    price: string;
    pnl: string;
    pct: string;
    dir: 1 | -1;
  }
  interface Trade {
    ts: string;
    dur: string;
    lag: string;
    pnl: string;
    win: boolean;
  }

  // ── Mock data ──────────────────────────────────────────────────────────────
  const log: LogEntry[] = [
    {
      ts: "14:22:01",
      kind: "SCAN",
      detail: "market opens — bot watches — does NOT enter",
      tag: "SCAN",
    },
    {
      ts: "14:22:04",
      kind: "LAG",
      detail: "log 16s — strong — coinbase +$61 · binance +$64",
      tag: "SKIP",
    },
    {
      ts: "14:22:09",
      kind: "LAG",
      detail: "14.0s gap detected — chainlink not yet updated",
      tag: "PENDING",
    },
    {
      ts: "14:22:14",
      kind: "KILL",
      detail: "6.2s — below threshold — noise — skip this one",
      tag: "SKIP",
    },
    {
      ts: "14:22:19",
      kind: "LAG",
      detail: "spent 2 weeks watching order book — not trading",
      tag: "WATCH",
    },
    {
      ts: "14:22:23",
      kind: "KILL",
      detail: "9.1s — below 11s threshold — skip",
      tag: "SKIP",
    },
    {
      ts: "14:22:28",
      kind: "LAG",
      detail: "14.7s gap — chainlink not updated yet",
      tag: "PENDING",
    },
    {
      ts: "14:22:33",
      kind: "ENTER",
      detail: "both signals agree · BTC 71c — entering at $94,208",
      tag: "MATCH",
    },
    {
      ts: "14:22:39",
      kind: "EXIT",
      detail: "wrong direction — $10 loss — cut immediately",
      tag: "CUT",
    },
    {
      ts: "14:22:44",
      kind: "KILL",
      detail: "after 100s — no exit window — if wrong kill it",
      tag: "TIMEOUT",
    },
    {
      ts: "14:22:49",
      kind: "ENTER",
      detail: "tag 11.0s — imbalance 2.1 — entering at $94,215",
      tag: "MATCH",
    },
    {
      ts: "14:22:55",
      kind: "EXIT",
      detail: "imbalance 0.48 — sellers dominant — skip",
      tag: "SKIP",
    },
    {
      ts: "14:23:00",
      kind: "KILL",
      detail: "after 100s — no exit window — if wrong",
      tag: "TIMEOUT",
    },
    {
      ts: "14:23:05",
      kind: "SCAN",
      detail: "new 5-min BTC window — watching",
      tag: "SCAN",
    },
    {
      ts: "14:23:11",
      kind: "ENTER",
      detail: "tag 13.0s + imbalance 2.01 — entering at $94,219",
      tag: "MATCH",
    },
    {
      ts: "14:23:17",
      kind: "EXIT",
      detail: "both signals confirm exit — BTC at $94,270 — +$51",
      tag: "ENTER",
    },
    {
      ts: "14:23:22",
      kind: "LAG",
      detail: "log 12s — moderate — coinbase +$20 · binance +$22",
      tag: "WATCH",
    },
    {
      ts: "14:23:27",
      kind: "ENTER",
      detail: "ratio 2.08 — 30s window — both signals agree",
      tag: "MATCH",
    },
    {
      ts: "14:23:33",
      kind: "KILL",
      detail: "imbalance dropped to 1.04 — abort entry",
      tag: "SKIP",
    },
    {
      ts: "14:23:38",
      kind: "LAG",
      detail: "entry window 7c — $94,225 BTC 71c — in",
      tag: "MATCH",
    },
    {
      ts: "14:23:43",
      kind: "EXIT",
      detail: "imbalance 1.84 — buyers stacking — both agree",
      tag: "ENTER",
    },
    {
      ts: "14:23:48",
      kind: "KILL",
      detail: "imbalance 1.04 — buyers stacking — both agree",
      tag: "ENTER",
    },
    {
      ts: "14:24:01",
      kind: "SCAN",
      detail: "scanning 1,847 pairs — watching BTC 5m + ETH 15m",
      tag: "SCAN",
    },
    {
      ts: "14:24:07",
      kind: "LAG",
      detail: "LAG 14.2s — gap detected — chainlink not updated",
      tag: "PENDING",
    },
    {
      ts: "14:24:13",
      kind: "ENTER",
      detail: "both signals agree · ETH window — entering at $3,821",
      tag: "MATCH",
    },
    {
      ts: "14:24:19",
      kind: "EXIT",
      detail: "profit target hit — +$288 — closing ETH position",
      tag: "ENTER",
    },
  ];

  const asks: OBLevel[] = [
    { side: "ask", price: "94,225", size: "2,200", depth: 100 },
    { side: "ask", price: "94,219", size: "1,800", depth: 82 },
    { side: "ask", price: "94,215", size: "1,440", depth: 65 },
    { side: "ask", price: "94,210", size: "980", depth: 45 },
    { side: "ask", price: "94,209", size: "640", depth: 29 },
  ];
  const bids: OBLevel[] = [
    { side: "bid", price: "94,204", size: "4,380", depth: 100 },
    { side: "bid", price: "94,198", size: "3,100", depth: 71 },
    { side: "bid", price: "94,190", size: "2,400", depth: 55 },
    { side: "bid", price: "94,183", size: "1,650", depth: 38 },
    { side: "bid", price: "94,175", size: "880", depth: 20 },
  ];

  const positions: Position[] = [
    { pair: "BTC/5m", price: "$74,795", pnl: "+$18.8k", pct: "+25.1%", dir: 1 },
    { pair: "BTC/5m", price: "$74,770", pnl: "+$2.1k", pct: "+26.1%", dir: 1 },
    { pair: "BTC/5m", price: "$74,635", pnl: "+$1.6k", pct: "+20.8%", dir: 1 },
    { pair: "BTC/5m", price: "$74,830", pnl: "-$1.31", pct: "-1.7%", dir: -1 },
    { pair: "ETH/15m", price: "$3,821", pnl: "+$0.9k", pct: "+12.6%", dir: 1 },
    { pair: "ETH/15m", price: "$3,805", pnl: "+$0.6k", pct: "+8.9%", dir: 1 },
  ];

  const trades: Trade[] = [
    { ts: "18:41:21", dur: "35.0s", lag: "2.30", pnl: "+$288", win: true },
    { ts: "18:43:16", dur: "13.0s", lag: "1.34", pnl: "+$40", win: true },
    { ts: "18:40:11", dur: "14.2s", lag: "1.83", pnl: "+$501", win: true },
    { ts: "18:38:04", dur: "9.3s", lag: "2.18", pnl: "-$54", win: false },
    { ts: "18:25:19", dur: "12.1s", lag: "1.26", pnl: "-$157", win: false },
  ];

  // ── Sparkline (block chars) ─────────────────────────────────────────────────
  const pnlSeries = [
    220, 380, 310, 460, 530, 500, 640, 720, 700, 790, 860, 840, 940, 1020, 1080,
    1200, 1280, 1420, 1520, 1660, 1760, 1880, 2020, 2140, 2360, 2420, 2540,
    2660, 2780, 2960, 3080, 3240, 3400, 3520, 3780, 3920, 4080, 4360, 4500,
    4800, 4960, 5280, 5440, 5760, 5940, 6280, 6460, 6800, 7180, 7540, 7940,
    8360, 8820, 9360, 9900, 10460, 11356,
  ];

  const blocks = "▁▂▃▄▅▆▇█";
  const sparkline = $derived.by(() => {
    const mn = Math.min(...pnlSeries);
    const mx = Math.max(...pnlSeries);
    const rng = mx - mn || 1;
    // Downsample to ~40 chars
    const step = Math.ceil(pnlSeries.length / 40);
    const sampled = pnlSeries.filter((_, i) => i % step === 0);
    return sampled
      .map((v) => blocks[Math.round(((v - mn) / rng) * 7)])
      .join("");
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  function kindColor(kind: string): string {
    switch (kind) {
      case "ENTER":
        return "#1ddf72";
      case "EXIT":
        return "#b026ff";
      case "KILL":
        return "#ff4d57";
      case "LAG":
        return "#d56bff";
      case "SCAN":
        return "#f5a623";
      default:
        return "#9aa7a0";
    }
  }
  function tagColor(tag: Tag): string {
    switch (tag) {
      case "MATCH":
      case "ENTER":
        return "#1ddf72";
      case "SKIP":
      case "CUT":
        return "#ff4d57";
      case "TIMEOUT":
        return "#ff4d57";
      case "PENDING":
      case "SCAN":
        return "#f5a623";
      default:
        return "#9aa7a0";
    }
  }
</script>

<div class="t-root">
  <!-- ══ NAV HEADER ══════════════════════════════════════════════════════════ -->
  <div class="t-topbar">
    <div class="t-topbar-l">
      <a href="/" class="t-brand-wrap" aria-label="YACT home">
        <span class="t-brand-badge">YACT</span>
      </a>
      <span class="t-sep">│</span>
      <nav class="t-nav" aria-label="Primary">
        <a href="/" class="t-nav-link">Markets</a>
        <a href="/watchlist" class="t-nav-link">Watchlist</a>
        <a href="/dashboard" class="t-nav-link">Dashboard</a>
        <span class="t-nav-link t-nav-active">Terminal</span>
      </nav>
      <span class="t-sep">│</span>
      <span class="t-live-dot" class:blink={blinkOn}>●</span>
      <span class="t-live-label">LIVE</span>
      <span class="t-sep">│</span>
      <span class="t-pair">BTC/USD</span>
      <span class="t-price">$94,208</span>
      <span class="t-chg pos">▲+1.24%</span>
    </div>
    <div class="t-topbar-r">
      <span class="t-kv">ETH <b>$3,821</b></span>
      <span class="t-kv">BTC.DOM <b>54.3%</b></span>
      <span class="t-kv">MCAP <b>$3.2T</b></span>
      <span class="t-sep">│</span>
      <span class="t-clock">{clockTime} UTC</span>
    </div>
  </div>

  <!-- ══ MAIN AREA ═══════════════════════════════════════════════════════════ -->
  <div class="t-main">
    <!-- ── LEFT COLUMN ───────────────────────────────────────────────────── -->
    <div class="t-col-left">
      <!-- Portfolio tracker -->
      <div class="t-panel port-panel">
        <div class="t-panel-label">PORTFOLIO // LIVE</div>
        <div class="t-panel-body port-body">
          <div class="port-value">$21,356</div>
          <div class="port-row">
            <span class="port-label">TODAY</span>
            <span class="port-pnl pos">+$11,356</span>
            <span class="port-pct pos">+112.4%</span>
          </div>
          <div class="port-row">
            <span class="port-label">TOTAL</span>
            <span class="port-pnl pos">+$55,400</span>
            <span class="port-pct pos">+554%</span>
          </div>
          <div class="port-row">
            <span class="port-label">SEED</span>
            <span class="port-val">$10,000</span>
            <span class="port-sub">30 sessions</span>
          </div>
        </div>
      </div>

      <!-- Positions panel -->
      <div class="t-panel">
        <div class="t-panel-label">POSITIONS // {positions.length}</div>
        <div class="t-panel-body">
          {#each positions as p}
            <div class="pos-row">
              <span class="pos-pair">{p.pair}</span>
              <span class="pos-price">{p.price}</span>
              <span class="pos-pnl" class:pos={p.dir > 0} class:neg={p.dir < 0}
                >{p.pnl}</span
              >
              <span class="pos-dir" class:pos={p.dir > 0} class:neg={p.dir < 0}
                >{p.dir > 0 ? "▲" : "▼"}</span
              >
            </div>
          {/each}
        </div>
      </div>

      <!-- Session metrics -->
      <div class="t-panel">
        <div class="t-panel-label">SESSION METRICS</div>
        <div class="t-panel-body">
          {#each [{ k: "P&L TODAY", v: "+$11,356", c: "pos" }, { k: "TRADES", v: "30", c: "" }, { k: "WIN RATE", v: "74%", c: "pos" }, { k: "AVG FILL", v: "$25", c: "" }, { k: "MAX DD", v: "-$157", c: "neg" }, { k: "COVERAGE", v: "85%", c: "" }, { k: "PAIRS", v: "1,847", c: "" }, { k: "SEED", v: "$10,000", c: "" }] as m}
            <div class="metric-row">
              <span class="metric-k">{m.k}</span>
              <span class="metric-v {m.c}">{m.v}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Signal bars -->
      <div class="t-panel t-panel-grow">
        <div class="t-panel-label">SIGNAL STRENGTH</div>
        <div class="t-panel-body">
          {#each [{ l: "MOMENTUM", pct: 74 }, { l: "VOL DELTA", pct: 62 }, { l: "LAG DETECT", pct: 85 }, { l: "CHAINLINK", pct: 45 }, { l: "1m–15s", pct: 70 }, { l: "5m–1m", pct: 85 }, { l: "5m–5m", pct: 43 }] as b}
            <div class="bar-row">
              <span class="bar-l">{b.l}</span>
              <span class="bar-track"
                ><span
                  class="bar-fill"
                  style="width:{b.pct}%; opacity:{0.4 + (b.pct / 100) * 0.6}"
                ></span></span
              >
              <span
                class="bar-pct"
                class:pos={b.pct >= 70}
                class:warn={b.pct >= 50 && b.pct < 70}
                class:neg={b.pct < 50}>{b.pct}%</span
              >
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- ── CENTER COLUMN — SIGNAL STREAM ─────────────────────────────────── -->
    <div class="t-col-center">
      <div class="t-panel t-panel-fill">
        <div class="t-panel-label">
          SIGNAL STREAM // {log.length} EVENTS ── BTC 5m ── SCANNING
        </div>
        <div class="t-stream" bind:this={streamEl}>
          <!-- Column headers -->
          <div class="stream-hdr">
            <span class="sh-ts">TIME</span>
            <span class="sh-kind">KIND</span>
            <span class="sh-detail">DETAIL</span>
            <span class="sh-tag">TAG</span>
          </div>
          <div class="stream-divider">
            ────────────────────────────────────────────────────────────────────────────────
          </div>
          {#each log as e}
            <div class="stream-row">
              <span class="sr-ts">{e.ts}</span>
              <span class="sr-kind" style="color:{kindColor(e.kind)}"
                >[{e.kind}]</span
              >
              <span class="sr-detail">{e.detail}</span>
              <span class="sr-tag" style="color:{tagColor(e.tag)}">{e.tag}</span
              >
            </div>
          {/each}
          <!-- Cursor line -->
          <div class="stream-row stream-cursor">
            <span class="sr-ts">{clockTime}</span>
            <span class="sr-kind" style="color:#f5a623">[SCAN]</span>
            <span class="sr-detail"
              >watching 1,847 pairs…<span class="cursor" class:visible={blinkOn}
                >█</span
              ></span
            >
            <span class="sr-tag" style="color:#f5a623">LIVE</span>
          </div>
        </div>
      </div>

      <!-- Recent trades -->
      <div class="t-panel">
        <div class="t-panel-label">RECENT TRADES // LAST {trades.length}</div>
        <div class="t-panel-body">
          <div class="trades-hdr">
            <span>TIME</span><span>DUR</span><span>LAG</span><span>P&amp;L</span
            ><span>RESULT</span>
          </div>
          {#each trades as t}
            <div class="trade-row">
              <span>{t.ts}</span>
              <span>{t.dur}</span>
              <span>{t.lag}</span>
              <span class:pos={t.win} class:neg={!t.win}>{t.pnl}</span>
              <span class:pos={t.win} class:neg={!t.win}
                >{t.win ? "WIN" : "LOSS"}</span
              >
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- ── RIGHT COLUMN ───────────────────────────────────────────────────── -->
    <div class="t-col-right">
      <!-- Order book -->
      <div class="t-panel">
        <div class="t-panel-label">ORDER BOOK // BTC/USD</div>
        <div class="t-panel-body ob-body">
          <div class="ob-hdr">
            <span>PRICE</span><span>DEPTH</span><span>SIZE $</span>
          </div>
          <!-- Asks (reversed: highest first) -->
          {#each [...asks].reverse() as lvl}
            <div class="ob-row ask-row">
              <span class="ob-price neg">{lvl.price}</span>
              <span class="ob-bar-wrap"
                ><span class="ob-bar ask-bar" style="width:{lvl.depth}%"
                ></span></span
              >
              <span class="ob-size">{lvl.size}</span>
            </div>
          {/each}
          <!-- Spread -->
          <div class="ob-spread">
            <span>─────</span>
            <span class="spread-price"
              >94,208 <span class="muted">LAST</span></span
            >
            <span>SPRD: $5</span>
          </div>
          <!-- Bids -->
          {#each bids as lvl}
            <div class="ob-row bid-row">
              <span class="ob-price pos">{lvl.price}</span>
              <span class="ob-bar-wrap"
                ><span class="ob-bar bid-bar" style="width:{lvl.depth}%"
                ></span></span
              >
              <span class="ob-size">{lvl.size}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- PnL sparkline -->
      <div class="t-panel">
        <div class="t-panel-label">
          PNL CURVE // {pnlSeries.length} SESSIONS
        </div>
        <div class="t-panel-body">
          <div class="spark-line">{sparkline}</div>
          <div class="spark-stats">
            <div class="spark-stat">
              <span class="muted">TODAY</span> <span class="pos">+$11,356</span>
            </div>
            <div class="spark-stat">
              <span class="muted">TOTAL</span> <span class="pos">+$55,400</span>
            </div>
            <div class="spark-stat">
              <span class="muted">MAX DD</span> <span class="neg">-$157</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Entry window status -->
      <div class="t-panel t-panel-grow">
        <div class="t-panel-label">ENTRY WINDOW // ACTIVE</div>
        <div class="t-panel-body">
          {#each [{ k: "STATUS", v: "● SCANNING", c: "warn" }, { k: "RATIO", v: "2.08", c: "pos" }, { k: "ELAPSED", v: "1:35s", c: "warn" }, { k: "BID DEPTH", v: "$3,848", c: "" }, { k: "IMBALANCE", v: "1.84", c: "pos" }, { k: "CHAINLINK", v: "SYNCED", c: "pos" }, { k: "WINDOW", v: "60–100s", c: "" }, { k: "WIN RATE", v: "70%", c: "pos" }] as s}
            <div class="metric-row">
              <span class="metric-k">{s.k}</span>
              <span class="metric-v {s.c}">{s.v}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- ══ BOTTOM STATUS BAR ═══════════════════════════════════════════════════ -->
  <div class="t-botbar">
    <span class="t-key">[j/k]</span><span class="t-keylabel">scroll</span>
    <span class="t-key">[Tab]</span><span class="t-keylabel">panel</span>
    <span class="t-key">[r]</span><span class="t-keylabel">refresh</span>
    <span class="t-key">[f]</span><span class="t-keylabel">filter</span>
    <span class="t-key">[?]</span><span class="t-keylabel">help</span>
    <span class="t-key">[q]</span><span class="t-keylabel">quit</span>
    <span class="t-sep-r">│</span>
    <span class="t-branch">feat/trading-terminal</span>
    <span class="t-sep-r">│</span>
    <span class="muted"
      >yact v0.1 · 1,847 pairs · 3 accounts · 85% coverage</span
    >
  </div>

  <!-- CRT scanline overlay -->
  <div class="t-scanlines" aria-hidden="true"></div>
</div>

<style>
  /* ── Reset / root ──────────────────────────────────────────────────────── */
  .t-root {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #000;
    color: #c8d4cf;
    font-family: "JetBrains Mono", "Menlo", "Consolas", monospace;
    font-size: 0.7rem;
    line-height: 1.45;
    overflow: hidden;
    /* Must exceed market-floating-bar (80) + backdrop-filter compositing + RouteProgress (200) */
    z-index: 9998;
  }

  /* ── CRT scanlines ─────────────────────────────────────────────────────── */
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

  /* ── Nav header ─────────────────────────────────────────────────────────── */
  .t-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.75rem;
    height: 2.4rem;
    border-bottom: 1px solid rgba(160, 60, 240, 0.4);
    /* Match main app's market-floating-bar exactly */
    background: #1e0938;
    box-shadow: 0 2px 20px rgba(120, 20, 200, 0.22);
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
  }

  .t-topbar-l,
  .t-topbar-r {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  /* Brand badge — matches app shell */
  .t-brand-wrap {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
  }
  .t-brand-badge {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    border: 1px solid #b355ff;
    color: #efc9ff;
    background: #0d0712;
    padding: 0.2rem 0.45rem;
    line-height: 1;
    box-shadow: 0 0 8px rgba(179, 85, 255, 0.22);
  }

  /* Nav links — matches app shell */
  .t-nav {
    display: flex;
    align-items: center;
  }
  .t-nav-link {
    border: 0;
    border-right: 1px solid rgba(46, 53, 58, 0.8);
    padding: 0.2rem 0.65rem;
    background: transparent;
    color: rgba(217, 228, 223, 0.65);
    font-size: 0.7rem;
    font-weight: 600;
    font-family: inherit;
    text-decoration: none;
    cursor: pointer;
    transition: color 0.15s;
    white-space: nowrap;
  }
  .t-nav-link:last-child {
    border-right: 0;
  }
  .t-nav-link:hover {
    color: #e3a4ff;
  }
  .t-nav-active {
    color: #e3a4ff !important;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
  }

  .t-live-dot {
    color: #1ddf72;
    font-size: 0.6rem;
    opacity: 1;
    transition: opacity 0.1s;
  }
  .t-live-dot.blink {
    opacity: 0.2;
  }
  .t-live-label {
    color: rgba(200, 212, 207, 0.45);
    font-size: 0.63rem;
  }

  .t-sep {
    color: rgba(176, 38, 255, 0.3);
  }

  .t-pair {
    color: #edf5f1;
    font-weight: 600;
    font-size: 0.7rem;
  }
  .t-price {
    color: #fff;
    font-weight: 600;
    font-size: 0.7rem;
  }

  .t-chg.pos {
    color: #1ddf72;
  }
  .t-chg.neg {
    color: #ff4d57;
  }

  .t-kv {
    color: rgba(200, 212, 207, 0.5);
    font-size: 0.65rem;
  }
  .t-kv b {
    color: #c8d4cf;
    font-weight: 500;
  }

  .t-clock {
    color: rgba(200, 212, 207, 0.45);
    font-size: 0.65rem;
    font-variant-numeric: tabular-nums;
  }

  /* ── Main grid ─────────────────────────────────────────────────────────── */
  .t-main {
    flex: 1;
    min-height: 0; /* allow flex item to shrink below content height */
    display: grid;
    grid-template-columns: 18rem 1fr 20rem;
    overflow: hidden;
    border-bottom: 1px solid rgba(176, 38, 255, 0.2);
  }

  /* ── Columns ───────────────────────────────────────────────────────────── */
  /* Left + right: scroll as a whole column so all fixed panels are reachable */
  .t-col-left,
  .t-col-right {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    border-right: 1px solid rgba(176, 38, 255, 0.15);
    /* Space above first panel so its absolute label isn't clipped */
    padding-top: 0.75rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(176, 38, 255, 0.2) transparent;
  }

  /* Center: overflow:hidden so the stream panel fills remaining height */
  .t-col-center {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
    border-right: 1px solid rgba(176, 38, 255, 0.15);
    padding-top: 0.75rem;
  }

  .t-col-right {
    border-right: none;
  }

  /* ── Panels ────────────────────────────────────────────────────────────── */
  .t-panel {
    position: relative;
    border-bottom: 1px solid rgba(176, 38, 255, 0.12);
    flex-shrink: 0;
  }

  .t-panel-fill {
    flex: 1;
    min-height: 0; /* critical: allow flex item to shrink and not push siblings */
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .t-panel-grow {
    flex: 1;
    min-height: 0;
    min-height: 8rem; /* ensure it's always visible even when column is short */
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .t-panel-grow .t-panel-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(176, 38, 255, 0.2) transparent;
  }

  .t-panel-label {
    position: absolute;
    top: -0.55em;
    left: 0.8rem;
    padding: 0 0.3rem;
    background: #000;
    color: rgba(176, 38, 255, 0.7);
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    white-space: nowrap;
    z-index: 1;
    pointer-events: none;
  }

  .t-panel-body {
    padding: 0.9rem 0.5rem 0.4rem;
    /* No height:100% — let non-growing panels size naturally */
    overflow: visible;
  }

  /* ── Portfolio tracker ─────────────────────────────────────────────────── */
  .port-panel {
    border-bottom: 1px solid rgba(176, 38, 255, 0.18);
  }

  .port-body {
    padding: 0.9rem 0.6rem 0.5rem;
  }

  .port-value {
    font-size: 1.6rem;
    font-weight: 600;
    color: #1ddf72;
    line-height: 1.1;
    letter-spacing: -0.03em;
    text-shadow: 0 0 14px rgba(29, 223, 114, 0.3);
    padding-bottom: 0.35rem;
  }

  .port-row {
    display: grid;
    grid-template-columns: 5ch 1fr auto;
    gap: 0.3rem;
    padding: 0.1rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    align-items: baseline;
  }

  .port-label {
    color: rgba(200, 212, 207, 0.4);
    font-size: 0.62rem;
  }
  .port-pnl {
    font-variant-numeric: tabular-nums;
  }
  .port-pct {
    color: rgba(200, 212, 207, 0.45);
    font-size: 0.62rem;
    text-align: right;
  }
  .port-val {
    font-variant-numeric: tabular-nums;
    color: #c8d4cf;
  }
  .port-sub {
    color: rgba(200, 212, 207, 0.35);
    font-size: 0.62rem;
    text-align: right;
  }

  /* ── Positions ─────────────────────────────────────────────────────────── */
  .pos-row {
    display: grid;
    grid-template-columns: 6ch 7ch 1fr 1.5ch;
    gap: 0.3rem;
    padding: 0.12rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .pos-pair {
    color: #c8d4cf;
    font-size: 0.65rem;
  }
  .pos-price {
    color: rgba(200, 212, 207, 0.55);
  }
  .pos-pnl {
    font-variant-numeric: tabular-nums;
  }
  .pos-dir {
    text-align: right;
  }

  /* ── Metric rows ───────────────────────────────────────────────────────── */
  .metric-row {
    display: flex;
    justify-content: space-between;
    padding: 0.1rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .metric-k {
    color: rgba(200, 212, 207, 0.45);
    font-size: 0.63rem;
    letter-spacing: 0.06em;
  }
  .metric-v {
    font-variant-numeric: tabular-nums;
  }

  /* ── Signal bars ───────────────────────────────────────────────────────── */
  .bar-row {
    display: grid;
    grid-template-columns: 9ch 1fr 4ch;
    align-items: center;
    gap: 0.35rem;
    padding: 0.12rem 0;
  }

  .bar-l {
    color: rgba(200, 212, 207, 0.5);
    font-size: 0.63rem;
  }
  .bar-pct {
    text-align: right;
    font-size: 0.63rem;
    font-variant-numeric: tabular-nums;
  }

  .bar-track {
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    position: relative;
    overflow: hidden;
  }

  .bar-fill {
    position: absolute;
    inset-block: 0;
    left: 0;
    background: #b026ff;
    transition: width 0.3s;
  }

  /* ── Signal stream ─────────────────────────────────────────────────────── */
  .t-stream {
    flex: 1;
    min-height: 0; /* allow flex child to shrink */
    overflow-y: auto;
    padding: 0.9rem 0.5rem 0.4rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(176, 38, 255, 0.3) transparent;
  }

  .stream-hdr,
  .stream-row {
    display: grid;
    grid-template-columns: 7ch 8ch 1fr 8ch;
    gap: 0.5rem;
    padding: 0.08rem 0;
  }

  .stream-hdr {
    color: rgba(176, 38, 255, 0.6);
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    padding-bottom: 0.25rem;
  }

  .stream-divider {
    color: rgba(176, 38, 255, 0.15);
    font-size: 0.55rem;
    padding-bottom: 0.2rem;
    overflow: hidden;
    white-space: nowrap;
  }

  .sr-ts {
    color: rgba(200, 212, 207, 0.35);
    font-variant-numeric: tabular-nums;
  }
  .sr-kind {
    font-weight: 600;
  }
  .sr-detail {
    color: rgba(200, 212, 207, 0.7);
  }
  .sr-tag {
    text-align: right;
    font-size: 0.62rem;
    letter-spacing: 0.06em;
  }

  .stream-cursor .sr-detail {
    color: rgba(200, 212, 207, 0.45);
  }

  .cursor {
    color: #b026ff;
  }
  .cursor:not(.visible) {
    visibility: hidden;
  }

  /* ── Trades ────────────────────────────────────────────────────────────── */
  .trades-hdr,
  .trade-row {
    display: grid;
    grid-template-columns: 8ch 6ch 5ch 7ch 5ch;
    gap: 0.5rem;
    padding: 0.08rem 0;
  }

  .trades-hdr {
    color: rgba(176, 38, 255, 0.6);
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    padding-bottom: 0.2rem;
    border-bottom: 1px solid rgba(176, 38, 255, 0.1);
    margin-bottom: 0.2rem;
  }

  .trade-row {
    color: rgba(200, 212, 207, 0.65);
    font-variant-numeric: tabular-nums;
  }

  /* ── Order book ────────────────────────────────────────────────────────── */
  .ob-body {
    padding-top: 0.9rem;
  }

  .ob-hdr,
  .ob-row {
    display: grid;
    grid-template-columns: 7ch 1fr 5ch;
    gap: 0.3rem;
    padding: 0.07rem 0;
    align-items: center;
  }

  .ob-hdr {
    color: rgba(176, 38, 255, 0.6);
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    padding-bottom: 0.2rem;
    border-bottom: 1px solid rgba(176, 38, 255, 0.1);
    margin-bottom: 0.15rem;
  }

  .ob-price {
    font-variant-numeric: tabular-nums;
    font-size: 0.67rem;
  }

  .ob-bar-wrap {
    height: 3px;
    background: rgba(255, 255, 255, 0.05);
    position: relative;
    overflow: hidden;
  }

  .ob-bar {
    position: absolute;
    inset-block: 0;
    right: 0;
    height: 100%;
  }

  .ask-bar {
    background: rgba(255, 77, 87, 0.55);
    left: auto;
  }
  .bid-bar {
    background: rgba(29, 223, 114, 0.45);
    left: 0;
    right: auto;
  }

  .ob-size {
    color: rgba(200, 212, 207, 0.4);
    font-size: 0.63rem;
    text-align: right;
  }

  .ob-spread {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0;
    color: rgba(176, 38, 255, 0.55);
    font-size: 0.63rem;
    border-top: 1px solid rgba(176, 38, 255, 0.1);
    border-bottom: 1px solid rgba(176, 38, 255, 0.1);
    margin: 0.1rem 0;
  }

  .spread-price {
    color: #edf5f1;
    font-weight: 600;
  }

  /* ── Sparkline ─────────────────────────────────────────────────────────── */
  .spark-line {
    font-size: 0.85rem;
    letter-spacing: -0.05em;
    color: #1ddf72;
    padding: 0.5rem 0 0.3rem;
    line-height: 1;
    word-break: break-all;
    text-shadow: 0 0 6px rgba(29, 223, 114, 0.4);
  }

  .spark-stats {
    display: flex;
    gap: 1rem;
    padding-top: 0.3rem;
    flex-wrap: wrap;
  }

  .spark-stat {
    display: flex;
    gap: 0.3rem;
    font-size: 0.63rem;
  }

  /* ── Bottom bar ────────────────────────────────────────────────────────── */
  .t-botbar {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0 0.6rem;
    height: 1.5rem;
    background: #050008;
    border-top: 1px solid rgba(176, 38, 255, 0.2);
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
  }

  .t-key {
    color: #b026ff;
    font-size: 0.62rem;
  }

  .t-keylabel {
    color: rgba(200, 212, 207, 0.45);
    font-size: 0.62rem;
    margin-right: 0.3rem;
  }

  .t-sep-r {
    color: rgba(176, 38, 255, 0.3);
    margin: 0 0.2rem;
  }

  .t-branch {
    color: rgba(176, 38, 255, 0.6);
    font-size: 0.62rem;
  }

  /* ── Utility ───────────────────────────────────────────────────────────── */
  .pos {
    color: #1ddf72;
  }
  .neg {
    color: #ff4d57;
  }
  .warn {
    color: #f5a623;
  }
  .muted {
    color: rgba(200, 212, 207, 0.38);
  }

  /* ── Scrollbar styling ─────────────────────────────────────────────────── */
  ::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(176, 38, 255, 0.3);
    border-radius: 2px;
  }
</style>
