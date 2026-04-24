<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  // ── Live clock ──────────────────────────────────────────────────────────────
  let clockTime = $state("--:--:--");

  onMount(() => {
    if (!browser) return;
    const tick = () => {
      const now = new Date();
      clockTime = now.toUTCString().slice(17, 25);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  });

  // ── Types ──────────────────────────────────────────────────────────────────
  type SignalTag =
    | "SKIP"
    | "WATCH"
    | "GAP"
    | "PENDING"
    | "MATCH"
    | "ENTER"
    | "EXIT"
    | "CUT"
    | "TIMEOUT";

  interface SignalEntry {
    label: "LAG" | "KILL" | "ENTER" | "EXIT" | "SCAN";
    detail: string;
    tag: SignalTag;
  }

  interface ImbalanceEntry {
    key: string;
    value: string;
    detail: string;
    action: "ENTER" | "SKIP" | null;
  }

  interface Position {
    pair: string;
    price: string;
    pnlAbs: string;
    pnlPct: string;
    status: "profit" | "loss";
  }

  interface Trade {
    time: string;
    size: string;
    lag: string;
    pct: string;
    pnl: string;
    sigPct: string;
    dir: "buy" | "sell";
  }

  // ── Mock data ──────────────────────────────────────────────────────────────
  const signalLog: SignalEntry[] = [
    {
      label: "LAG",
      detail: "log 16s — strong — coinbase +$61 · binance +$64",
      tag: "SKIP",
    },
    {
      label: "LAG",
      detail: "spent 2 weeks watching order book — not trading",
      tag: "WATCH",
    },
    {
      label: "LAG",
      detail: "14 0s gap — binance +$551 · coinbase +$50",
      tag: "GAP",
    },
    {
      label: "LAG",
      detail: "14 2s gap detected — chainlink not updated yet",
      tag: "PENDING",
    },
    {
      label: "KILL",
      detail: "6.2s — too short — noise — skip this one",
      tag: "SKIP",
    },
    {
      label: "LAG",
      detail: "spent 2 weeks watching order book — not trading",
      tag: "WATCH",
    },
    { label: "KILL", detail: "9.1s — below 11s threshold — skip", tag: "SKIP" },
    {
      label: "LAG",
      detail: "14 7s gap detected — chainlink not updated yet",
      tag: "PENDING",
    },
    {
      label: "LAG",
      detail: "spent 2 weeks watching order book — not trading",
      tag: "WATCH",
    },
    {
      label: "ENTER",
      detail: "both signals agree · BTC 71c — entering",
      tag: "MATCH",
    },
    {
      label: "EXIT",
      detail: "wrong direction — $10 — cut immediately",
      tag: "CUT",
    },
    {
      label: "KILL",
      detail: "after 100s — no exit window — if wrong",
      tag: "TIMEOUT",
    },
    {
      label: "ENTER",
      detail: "tag 11.0s — imbalance 2.1 — entering",
      tag: "MATCH",
    },
    {
      label: "EXIT",
      detail: "imbalance 0.48 — sellers dominant — skip",
      tag: "SKIP",
    },
    {
      label: "KILL",
      detail: "after 100s — no exit window — if wrong",
      tag: "TIMEOUT",
    },
    {
      label: "SCAN",
      detail: "market opens — bot watches — does NOT enter",
      tag: "WATCH",
    },
    {
      label: "ENTER",
      detail: "tag 13.0s + imbalance 2.01 — entering at 51c",
      tag: "MATCH",
    },
    {
      label: "EXIT",
      detail: "both signals agree — BTC 71c — entering",
      tag: "ENTER",
    },
  ];

  const imbalanceLog: ImbalanceEntry[] = [
    {
      key: "RATIO",
      value: "2.08",
      detail: "30s window — both signals agree",
      action: "ENTER",
    },
    {
      key: "RATIO",
      value: "2.08",
      detail: "10s window — both signals agree",
      action: "SKIP",
    },
    {
      key: "BID DEPTH",
      value: "$3,848",
      detail: "ask depth $998 — ratio 1.04",
      action: null,
    },
    {
      key: "IMBALANCE",
      value: "0.44+0.55",
      detail: "sellers dominant",
      action: "SKIP",
    },
    {
      key: "BID DEPTH",
      value: "$3,848",
      detail: "ask depth $998 — ratio 1.04",
      action: null,
    },
    {
      key: "IMBALANCE",
      value: "0.44+0.55",
      detail: "sellers dominant",
      action: "SKIP",
    },
    {
      key: "RATIO",
      value: "2.08",
      detail: "10s window — BOTH SIGNALS",
      action: "ENTER",
    },
    {
      key: "RATIO",
      value: "1.61",
      detail: "lag 14s — window 80s",
      action: "ENTER",
    },
    {
      key: "RATIO",
      value: "2.08",
      detail: "10s window — both signals agree",
      action: "SKIP",
    },
    {
      key: "IMBALANCE",
      value: "1.2",
      detail: "neutral zone — skip this window",
      action: "SKIP",
    },
    {
      key: "IMBALANCE",
      value: "1.84",
      detail: "buyers stacking — both agree",
      action: "ENTER",
    },
  ];

  const positions: Position[] = [
    {
      pair: "BTC 5m",
      price: "$74,795",
      pnlAbs: "+$18.8k",
      pnlPct: "+25.1%",
      status: "profit",
    },
    {
      pair: "BTC 5m",
      price: "$74,770",
      pnlAbs: "+$2.1k",
      pnlPct: "+26.1%",
      status: "profit",
    },
    {
      pair: "BTC 5m",
      price: "$74,635",
      pnlAbs: "+$1.6k",
      pnlPct: "+20.8%",
      status: "profit",
    },
    {
      pair: "BTC 5m",
      price: "$74,830",
      pnlAbs: "-$1.31",
      pnlPct: "-1.7%",
      status: "loss",
    },
    {
      pair: "BTC 5m",
      price: "$74,825",
      pnlAbs: "+$0.9k",
      pnlPct: "+12.6%",
      status: "profit",
    },
    {
      pair: "BTC 5m",
      price: "$74,775",
      pnlAbs: "+$0.6k",
      pnlPct: "+8.9%",
      status: "profit",
    },
  ];

  const signalTree = [
    {
      indent: 0,
      label: "EXIT",
      detail: "wrong direction — $10 — cut immediately",
      tag: "CUT",
    },
    {
      indent: 0,
      label: "KILL",
      detail: "after 100s — no exit window if wrong",
      tag: "TIMEOUT",
    },
    {
      indent: 0,
      label: "KILL",
      detail: "after 100s — no exit window if wrong",
      tag: "TIMEOUT",
    },
    {
      indent: 0,
      label: "ENTER",
      detail: "tag 11.0s — imbalance 2.1 — entering",
      tag: "ENTER",
    },
    {
      indent: 1,
      label: "EXIT",
      detail: "imbalance 0.48 — sellers dominant",
      tag: "SKIP",
    },
    {
      indent: 0,
      label: "KILL",
      detail: "imbalance 0.48 — sellers dominant — skip",
      tag: "SKIP",
    },
    {
      indent: 0,
      label: "ENTER",
      detail: "entry window 7c — $74,825 BTC 71c — in",
      tag: "MATCH",
    },
    {
      indent: 1,
      label: "EXIT",
      detail: "both signals agree — BTC 71c — entering",
      tag: "ENTER",
    },
    {
      indent: 0,
      label: "KILL",
      detail: "imbalance 1.04 — buyers stacking — both agree",
      tag: "ENTER",
    },
  ];

  const recentTrades: Trade[] = [
    {
      time: "18:41:21",
      size: "35.0s",
      lag: "2.30",
      pct: "131%",
      pnl: "+$288",
      sigPct: "67%",
      dir: "buy",
    },
    {
      time: "18:43:16",
      size: "13.0s",
      lag: "1.34",
      pct: "86%",
      pnl: "+$40",
      sigPct: "61%",
      dir: "buy",
    },
    {
      time: "18:40:11",
      size: "14.2s",
      lag: "1.83",
      pct: "215%",
      pnl: "+$501",
      sigPct: "72%",
      dir: "buy",
    },
    {
      time: "18:38:04",
      size: "9.3s",
      lag: "2.18",
      pct: "65%",
      pnl: "-$54",
      sigPct: "67%",
      dir: "sell",
    },
    {
      time: "18:25:19",
      size: "12.1s",
      lag: "1.26",
      pct: "111%",
      pnl: "-$157",
      sigPct: "67%",
      dir: "sell",
    },
  ];

  const signalBarsA = [
    { label: "MOMENTUM", pct: 74 },
    { label: "VOLUME DELTA", pct: 62 },
    { label: "LAG DETECT", pct: 85 },
    { label: "CHAINLINK", pct: 45 },
  ];

  const signalBarsB = [
    { label: "1m–15s", pct: 70 },
    { label: "1m–30s", pct: 74 },
    { label: "1m–1m", pct: 81 },
    { label: "5m–1m", pct: 85 },
    { label: "5m–5m", pct: 43 },
    { label: "5m–10m", pct: 20 },
  ];

  // ── PnL sparkline data ─────────────────────────────────────────────────────
  const pnlData = [
    220, 380, 310, 460, 420, 530, 500, 640, 610, 720, 700, 790, 760, 860, 840,
    940, 920, 1020, 1000, 1100, 1080, 1200, 1180, 1300, 1280, 1420, 1400, 1540,
    1520, 1660, 1640, 1760, 1740, 1880, 1920, 2020, 2000, 2140, 2120, 2240,
    2220, 2360, 2420, 2400, 2540, 2520, 2660, 2640, 2780, 2840, 2820, 2960,
    2940, 3080, 3160, 3240, 3320, 3400, 3520, 3640, 3780, 3920, 4080, 4220,
    4360, 4500, 4660, 4800, 4960, 5120, 5280, 5440, 5600, 5760, 5940, 6100,
    6280, 6460, 6640, 6800, 6980, 7180, 7360, 7540, 7740, 7940, 8140, 8360,
    8580, 8820, 9080, 9360, 9620, 9900, 10180, 10460, 10760, 11060, 11356,
  ];

  const chartW = 1200;
  const chartH = 72;

  const linePath = $derived(buildLine(pnlData));
  const areaPath = $derived(buildArea(pnlData));

  function buildLine(pts: number[]): string {
    if (pts.length < 2) return "";
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const rng = max - min || 1;
    const pad = 2;
    return (
      "M " +
      pts
        .map((v, i) => {
          const x = pad + (i / (pts.length - 1)) * (chartW - pad * 2);
          const y = pad + (1 - (v - min) / rng) * (chartH - pad * 2);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" L ")
    );
  }

  function buildArea(pts: number[]): string {
    const line = buildLine(pts);
    if (!line) return "";
    const pad = 2;
    return `${line} L ${chartW - pad},${chartH - pad} L ${pad},${chartH - pad} Z`;
  }

  // ── Colour helpers ─────────────────────────────────────────────────────────
  function labelColor(label: string): string {
    switch (label) {
      case "ENTER":
      case "MATCH":
        return "var(--m3-positive)";
      case "EXIT":
      case "CUT":
      case "KILL":
      case "TIMEOUT":
        return "var(--tv-negative)";
      case "LAG":
        return "var(--tv-highlight-soft)";
      case "SCAN":
        return "var(--status-warn)";
      default:
        return "var(--tv-text-muted)";
    }
  }

  function tagColor(tag: SignalTag): string {
    switch (tag) {
      case "MATCH":
      case "ENTER":
      case "GAP":
        return "var(--m3-positive)";
      case "SKIP":
      case "CUT":
      case "TIMEOUT":
        return "var(--tv-negative)";
      default:
        return "var(--status-warn)";
    }
  }

  function actionColor(action: "ENTER" | "SKIP" | null): string {
    if (action === "ENTER") return "var(--m3-positive)";
    if (action === "SKIP") return "var(--tv-negative)";
    return "var(--tv-text-muted)";
  }

  function barColor(pct: number): string {
    if (pct >= 75) return "var(--m3-positive)";
    if (pct >= 50) return "var(--tv-highlight)";
    if (pct >= 35) return "var(--status-warn)";
    return "var(--tv-negative)";
  }
</script>

<div class="terminal-root">
  <!-- ── TICKER BAR ──────────────────────────────────────────────────────── -->
  <header class="ticker-bar">
    <div class="ticker-left">
      <span class="brand-dot">◉</span>
      <span class="brand-label">YACT</span>
      <span class="ticker-sep">·</span>
      <span class="ticker-pair">BTC/USD</span>
      <span class="ticker-sep">·</span>
      <span class="ticker-tf">5M</span>
      <span class="ticker-sep">·</span>
      <span class="ticker-price">$94,208</span>
      <span class="ticker-change pos">▲ +1.24%</span>
    </div>
    <div class="ticker-center">
      <span class="ticker-stat">MARKETS <em>400+</em></span>
      <span class="ticker-sep">·</span>
      <span class="ticker-stat">WALLETS <em>3</em></span>
      <span class="ticker-sep">·</span>
      <span class="ticker-stat">DISP <em>$2,000</em></span>
      <span class="ticker-sep">·</span>
      <span class="ticker-stat">WIN <em>74%</em></span>
      <span class="ticker-sep">·</span>
      <span class="ticker-stat">SEED <em>$10,000</em></span>
      <span class="ticker-sep">·</span>
      <span class="ticker-stat">BTC DOM <em>54.3%</em></span>
    </div>
    <div class="ticker-right">
      <span class="live-dot">◉</span>
      <span class="live-label">LIVE</span>
      <span class="ticker-clock">{clockTime} UTC</span>
    </div>
  </header>

  <!-- ── HERO STATS ──────────────────────────────────────────────────────── -->
  <div class="hero-row">
    <div class="hero-stat accent">
      <div class="hero-value">+$11,356</div>
      <div class="hero-label">P&L TODAY</div>
    </div>
    <div class="hero-stat">
      <div class="hero-value">30</div>
      <div class="hero-label">TRADES</div>
    </div>
    <div class="hero-stat">
      <div class="hero-value">74%</div>
      <div class="hero-label">WIN RATE</div>
    </div>
    <div class="hero-stat">
      <div class="hero-value">2.59B</div>
      <div class="hero-label">24H VOLUME</div>
    </div>
    <div class="hero-stat">
      <div class="hero-value">$25</div>
      <div class="hero-label">AVG FILL</div>
    </div>
    <div class="hero-stat">
      <div class="hero-value">1,847</div>
      <div class="hero-label">COINS IN DB</div>
    </div>
    <div class="hero-stat">
      <div class="hero-value">85%</div>
      <div class="hero-label">COVERAGE</div>
    </div>
    <div class="hero-balance-block">
      <div class="balance-row">
        <span class="balance-label">ACCT 1</span>
        <span class="balance-bar-wrap">
          <span class="balance-bar" style="width: 82%"></span>
        </span>
        <span class="balance-val pos">+$53,400</span>
      </div>
      <div class="balance-row">
        <span class="balance-label">ACCT 2</span>
        <span class="balance-bar-wrap">
          <span class="balance-bar neg" style="width: 28%"></span>
        </span>
        <span class="balance-val neg">-$2,000</span>
      </div>
      <div class="balance-row">
        <span class="balance-label">ACCT 3</span>
        <span class="balance-bar-wrap">
          <span class="balance-bar" style="width: 65%"></span>
        </span>
        <span class="balance-val pos">+$4,100</span>
      </div>
      <div class="balance-row">
        <span class="balance-label">ACCT 4</span>
        <span class="balance-bar-wrap">
          <span class="balance-bar neg" style="width: 18%"></span>
        </span>
        <span class="balance-val neg">-$9,100</span>
      </div>
    </div>
  </div>

  <!-- ── PnL CHART ───────────────────────────────────────────────────────── -->
  <div class="chart-band">
    <div class="chart-label-tl">
      <span class="chart-pnl-label">+$11 356</span>
      <span class="chart-sub"
        >Claude code · Beta BTC windows · 1,847 trades · Total 12.4m</span
      >
    </div>
    <div class="chart-label-tr">+$11k</div>
    <svg
      class="pnl-svg"
      viewBox={`0 0 ${chartW} ${chartH}`}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="pnl-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(29, 223, 114, 0.35)" />
          <stop offset="100%" stop-color="rgba(29, 223, 114, 0)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#pnl-fill)" />
      <path d={linePath} fill="none" stroke="#1ddf72" stroke-width="1.5" />
    </svg>
  </div>

  <!-- ── MAIN PANELS ─────────────────────────────────────────────────────── -->
  <div class="panels-grid">
    <!-- Signal 1 — Log feed -->
    <div class="panel panel-log">
      <div class="panel-header">
        <span class="panel-dot" style="background: var(--tv-highlight)"></span>
        SIGNAL LOG
        <span class="panel-sub">// 167</span>
      </div>
      <div class="log-feed">
        {#each signalLog as entry}
          <div class="log-row">
            <span class="log-label" style="color:{labelColor(entry.label)}"
              >{entry.label}</span
            >
            <span class="log-detail">{entry.detail}</span>
            <span class="log-tag" style="color:{tagColor(entry.tag)}"
              >{entry.tag}</span
            >
          </div>
        {/each}
      </div>
    </div>

    <!-- Signal 2 — Imbalance / Order book -->
    <div class="panel panel-imbalance">
      <div class="panel-header">
        <span class="panel-dot" style="background: var(--status-warn)"></span>
        IMBALANCE
        <span class="panel-sub">// 1–2</span>
      </div>
      <div class="log-feed">
        {#each imbalanceLog as entry}
          <div class="log-row imbalance-row">
            <span class="imb-key">{entry.key}</span>
            <span class="imb-val">{entry.value}</span>
            <span class="imb-detail">{entry.detail}</span>
            {#if entry.action}
              <span class="imb-action" style="color:{actionColor(entry.action)}"
                >{entry.action}</span
              >
            {/if}
          </div>
        {/each}
      </div>
      <!-- Live order book mini-visualisation -->
      <div class="ob-mini">
        <div class="ob-row ob-header">
          <span>SIDE</span><span>SIZE</span><span>PRICE</span>
        </div>
        {#each [{ s: "ASK", size: "+$1,448", price: "$94,209", cls: "neg" }, { s: "ASK", size: "+$2,200", price: "$94,215", cls: "neg" }, { s: "ASK", size: "+$1,100", price: "$94,220", cls: "neg" }, { s: "BID", size: "+$1,440", price: "$94,204", cls: "pos" }, { s: "BID", size: "+$4,380", price: "$94,198", cls: "pos" }, { s: "BID", size: "+$3,100", price: "$94,190", cls: "pos" }] as row}
          <div class="ob-row">
            <span class={row.cls}>{row.s}</span>
            <span>{row.size}</span>
            <span class={row.cls}>{row.price}</span>
          </div>
        {/each}
        <div class="ob-spread">SPREAD: 0.029</div>
      </div>
    </div>

    <!-- Entry window -->
    <div class="panel panel-entry">
      <div class="panel-header">
        <span class="panel-dot scanning"></span>
        ENTRY WINDOW
        <span class="panel-sub">// 10–1001</span>
      </div>
      <div class="entry-status-row">
        <span class="entry-status-badge">● SCANNING</span>
        <span class="entry-elapsed">4:55</span>
      </div>
      <div class="entry-details">
        <div class="entry-row">
          <span class="ek">RATIO</span>
          <span class="ev">2.08</span>
          <span class="ed">30s window — both signals agree</span>
        </div>
        <div class="entry-row">
          <span class="ek">ELAPSED</span>
          <span class="ev warn">1:35s</span>
          <span class="ed">entered valid window 50–100s</span>
        </div>
        <div class="entry-row">
          <span class="ek">BID DEPTH</span>
          <span class="ev">$3,848</span>
          <span class="ed">ask depth $998 — ratio 1.0x</span>
        </div>
        <div class="entry-row">
          <span class="ek">RATIO</span>
          <span class="ev">1.04</span>
          <span class="ed">60–90s window has 70% win rate · sweet spot</span>
        </div>
        <div class="entry-row">
          <span class="ek">ELAPSED</span>
          <span class="ev warn">1:05s</span>
          <span class="ed">entered valid window 60–100s</span>
        </div>
        <div class="entry-row">
          <span class="ek">NEW MARKET</span>
          <span class="ev warn">5-min BTC</span>
          <span class="ed">above/below $94,200</span>
        </div>
      </div>
      <div class="entry-signals">
        <div class="entry-sig-label">● ENTRY SIGNALS</div>
        {#each [{ k: "IMBALANCE", v: "1.84", color: "var(--m3-positive)" }, { k: "LAG RATIO", v: "2.08", color: "var(--tv-highlight)" }, { k: "CHAINLINK", v: "SYNCED", color: "var(--status-warn)" }, { k: "BID/ASK", v: "0.48", color: "var(--tv-negative)" }] as sig}
          <div class="entry-sig-row">
            <span class="entry-sig-key">{sig.k}</span>
            <span class="entry-sig-val" style="color:{sig.color}">{sig.v}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Active positions + signal tree -->
    <div class="panel panel-positions">
      <div class="panel-header">
        <span class="panel-dot" style="background: var(--m3-positive)"></span>
        ACTIVE POSITIONS
        <span class="panel-sub">// IN DB PAIRS</span>
      </div>
      <div class="positions-list">
        {#each positions as pos}
          <div class="pos-row">
            <div class="pos-left">
              <span class="pos-pair">{pos.pair}</span>
              <span class="pos-price">{pos.price}</span>
            </div>
            <div class="pos-right">
              <span class="pos-pnl {pos.status}">{pos.pnlAbs}</span>
              <span class="pos-badge {pos.status}"
                >{pos.status === "profit" ? "PROFIT" : "LOSS"}</span
              >
            </div>
          </div>
        {/each}
      </div>
      <div class="signal-tree-header panel-sub-header">SIGNAL TREE</div>
      <div class="signal-tree">
        {#each signalTree as node}
          <div class="tree-row" style="padding-left:{node.indent * 12 + 4}px">
            <span class="tree-label" style="color:{labelColor(node.label)}"
              >{node.label}</span
            >
            <span class="tree-detail">{node.detail}</span>
            <span
              class="tree-tag"
              style="color:{tagColor(node.tag as SignalTag)}">{node.tag}</span
            >
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- ── BOTTOM ROW ──────────────────────────────────────────────────────── -->
  <div class="bottom-row">
    <!-- Recent trades -->
    <div class="panel panel-trades">
      <div class="panel-header">
        <span class="panel-dot" style="background: var(--tv-highlight)"></span>
        LAST TRADES
        <span class="panel-sub">// TOP 5 CLOSED</span>
      </div>
      <table class="trades-table">
        <thead>
          <tr>
            <th>TIME</th>
            <th>SIZE</th>
            <th>LAG</th>
            <th>PCT</th>
            <th>P&amp;L</th>
            <th>SIG%</th>
          </tr>
        </thead>
        <tbody>
          {#each recentTrades as t}
            <tr class="trade-row {t.dir}">
              <td class="mono">{t.time}</td>
              <td class="mono">{t.size}</td>
              <td class="mono">{t.lag}</td>
              <td class="mono">{t.pct}</td>
              <td class="mono {t.dir === 'buy' ? 'pos' : 'neg'}">{t.pnl}</td>
              <td class="mono muted">{t.sigPct}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Signal analysis A -->
    <div class="panel panel-signals-a">
      <div class="panel-header">
        <span class="panel-dot" style="background: var(--tv-highlight-soft)"
        ></span>
        SIGNAL ANALYSIS
        <span class="panel-sub">// 24–2s</span>
      </div>
      <div class="signal-bars">
        {#each signalBarsA as bar}
          <div class="signal-bar-row">
            <span class="sbar-label">{bar.label}</span>
            <div class="sbar-track">
              <div
                class="sbar-fill"
                style="width:{bar.pct}%; background:{barColor(bar.pct)}"
              ></div>
            </div>
            <span class="sbar-pct" style="color:{barColor(bar.pct)}"
              >{bar.pct}%</span
            >
          </div>
        {/each}
      </div>
    </div>

    <!-- Signal analysis B — by timeframe -->
    <div class="panel panel-signals-b">
      <div class="panel-header">
        <span class="panel-dot" style="background: var(--status-warn)"></span>
        BY SIGNAL WINDOW
        <span class="panel-sub">// TF BUCKETS</span>
      </div>
      <div class="signal-bars">
        {#each signalBarsB as bar}
          <div class="signal-bar-row">
            <span class="sbar-label">{bar.label}</span>
            <div class="sbar-track">
              <div
                class="sbar-fill"
                style="width:{bar.pct}%; background:{barColor(bar.pct)}"
              ></div>
            </div>
            <span class="sbar-pct" style="color:{barColor(bar.pct)}"
              >{bar.pct}%</span
            >
          </div>
        {/each}
      </div>
    </div>

    <!-- Minimap / heatmap block -->
    <div class="panel panel-heatmap">
      <div class="panel-header">
        <span class="panel-dot" style="background: var(--tv-negative)"></span>
        ORDER FLOW
        <span class="panel-sub">// $22.3k</span>
      </div>
      <div class="heatmap-grid">
        {#each [0.54, 0.735, 0.708, 0.775, 0.74, 0.755, 0.72, 0.7, 0.475] as v, i}
          <div
            class="heatmap-cell"
            style="opacity:{0.3 + v * 0.7}; background:{v > 0.72
              ? 'rgba(29,223,114,0.6)'
              : v > 0.6
                ? 'rgba(176,38,255,0.5)'
                : 'rgba(255,77,87,0.5)'}"
          >
            {v.toFixed(3)}
          </div>
        {/each}
      </div>
      <div class="flow-spread">SPREAD: 0.029</div>
      <div class="flow-stats">
        {#each [{ k: "GAPS / HOUR", v: "213" }, { k: "AVG FILL", v: "1.39s" }, { k: "CAPITAL USED", v: "$80K" }] as stat}
          <div class="flow-stat-row">
            <span class="flow-stat-k">{stat.k}</span>
            <span class="flow-stat-v">{stat.v}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  /* ── Root / layout ────────────────────────────────────────────────────── */
  .terminal-root {
    font-family: "JetBrains Mono", "Consolas", "Courier New", monospace;
    font-size: 0.72rem;
    line-height: 1.4;
    background: var(--tv-bg);
    color: var(--tv-text-primary);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 0;
    /* Break out of AppShell max-width */
    width: 100vw;
    position: relative;
    left: 50%;
    right: 50%;
    margin-left: -50vw;
    margin-right: -50vw;
  }

  /* ── Ticker bar ───────────────────────────────────────────────────────── */
  .ticker-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.3rem 1rem;
    background: #050507;
    border-bottom: 1px solid var(--tv-border);
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
  }

  .ticker-left,
  .ticker-center,
  .ticker-right {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .brand-dot {
    color: var(--tv-highlight);
    font-size: 0.8rem;
  }

  .brand-label {
    color: var(--tv-highlight-soft);
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .ticker-sep {
    color: var(--tv-border);
  }

  .ticker-pair {
    color: var(--tv-text-primary);
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .ticker-tf {
    color: var(--tv-text-muted);
    font-size: 0.65rem;
    padding: 0.1rem 0.35rem;
    border: 1px solid var(--tv-border);
    border-radius: 3px;
  }

  .ticker-price {
    color: #fff;
    font-weight: 600;
    font-size: 0.8rem;
  }

  .ticker-change.pos {
    color: var(--m3-positive);
  }

  .ticker-stat {
    color: var(--tv-text-muted);
  }

  .ticker-stat em {
    color: var(--tv-text-primary);
    font-style: normal;
  }

  .live-dot {
    color: var(--m3-positive);
    animation: pulse-dot 1.8s ease-in-out infinite;
  }

  .live-label {
    color: var(--m3-positive);
    font-weight: 600;
    letter-spacing: 0.1em;
    font-size: 0.65rem;
  }

  .ticker-clock {
    color: var(--tv-text-muted);
    font-size: 0.7rem;
  }

  @keyframes pulse-dot {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  /* ── Hero stats row ───────────────────────────────────────────────────── */
  .hero-row {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--tv-border);
    flex-shrink: 0;
  }

  .hero-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 0.65rem 0.5rem;
    border-right: 1px solid var(--tv-border);
    gap: 0.2rem;
  }

  .hero-stat.accent .hero-value {
    color: var(--m3-positive);
    font-size: 1.25rem;
  }

  .hero-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--tv-text-primary);
    letter-spacing: -0.02em;
  }

  .hero-label {
    font-size: 0.58rem;
    color: var(--tv-text-muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .hero-balance-block {
    padding: 0.45rem 0.75rem;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    gap: 0.2rem;
    min-width: 200px;
  }

  .balance-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .balance-label {
    width: 3.2rem;
    color: var(--tv-text-muted);
    font-size: 0.6rem;
    flex-shrink: 0;
  }

  .balance-bar-wrap {
    flex: 1;
    height: 5px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
  }

  .balance-bar {
    height: 100%;
    background: var(--m3-positive);
    border-radius: 2px;
    display: block;
  }

  .balance-bar.neg {
    background: var(--tv-negative);
  }

  .balance-val {
    font-size: 0.65rem;
    width: 4.5rem;
    text-align: right;
    flex-shrink: 0;
  }

  /* ── Chart band ───────────────────────────────────────────────────────── */
  .chart-band {
    position: relative;
    height: 82px;
    border-bottom: 1px solid var(--tv-border);
    background: #02040a;
    flex-shrink: 0;
    overflow: hidden;
  }

  .chart-label-tl {
    position: absolute;
    top: 6px;
    left: 10px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .chart-pnl-label {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--m3-positive);
    letter-spacing: -0.02em;
  }

  .chart-sub {
    font-size: 0.58rem;
    color: var(--tv-text-muted);
  }

  .chart-label-tr {
    position: absolute;
    top: 6px;
    right: 12px;
    z-index: 2;
    font-size: 0.62rem;
    color: var(--m3-positive);
  }

  .pnl-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  /* ── 4-panel main grid ────────────────────────────────────────────────── */
  .panels-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    flex: 1;
    border-bottom: 1px solid var(--tv-border);
    overflow: hidden;
  }

  /* ── Panel base ───────────────────────────────────────────────────────── */
  .panel {
    border-right: 1px solid var(--tv-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 320px;
  }

  .panel:last-child {
    border-right: none;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.6rem;
    background: #04060a;
    border-bottom: 1px solid var(--tv-border);
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--tv-text-muted);
    flex-shrink: 0;
  }

  .panel-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .panel-dot.scanning {
    background: var(--status-warn);
    animation: pulse-dot 1.2s ease-in-out infinite;
  }

  .panel-sub {
    color: rgba(154, 167, 160, 0.5);
    font-weight: 400;
  }

  .panel-sub-header {
    padding: 0.25rem 0.6rem;
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--tv-text-muted);
    border-top: 1px solid var(--tv-border);
    border-bottom: 1px solid var(--tv-border);
    background: #04060a;
    flex-shrink: 0;
  }

  /* ── Log feed (signal log + imbalance log) ────────────────────────────── */
  .log-feed {
    overflow-y: auto;
    flex: 1;
    padding: 0.25rem 0;
  }

  .log-row {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    padding: 0.12rem 0.55rem;
    border-bottom: 1px solid rgba(43, 47, 51, 0.4);
    font-size: 0.65rem;
  }

  .log-row:hover {
    background: rgba(176, 38, 255, 0.06);
  }

  .log-label {
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    flex-shrink: 0;
    width: 2.8rem;
  }

  .log-detail {
    color: var(--tv-text-muted);
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .log-tag {
    font-size: 0.55rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    flex-shrink: 0;
  }

  /* ── Imbalance panel specific ─────────────────────────────────────────── */
  .imbalance-row {
    flex-wrap: nowrap;
  }

  .imb-key {
    font-size: 0.58rem;
    color: var(--tv-text-muted);
    flex-shrink: 0;
    width: 5rem;
  }

  .imb-val {
    color: var(--tv-text-primary);
    font-weight: 600;
    flex-shrink: 0;
    width: 4rem;
  }

  .imb-detail {
    color: var(--tv-text-muted);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .imb-action {
    font-size: 0.58rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  /* ── Order book mini ──────────────────────────────────────────────────── */
  .ob-mini {
    border-top: 1px solid var(--tv-border);
    padding: 0.3rem 0.55rem;
    flex-shrink: 0;
  }

  .ob-row {
    display: flex;
    justify-content: space-between;
    padding: 0.1rem 0;
    font-size: 0.62rem;
    border-bottom: 1px solid rgba(43, 47, 51, 0.3);
  }

  .ob-row span {
    flex: 1;
  }

  .ob-row span:last-child {
    text-align: right;
  }

  .ob-header {
    color: var(--tv-text-muted);
    font-size: 0.58rem;
    letter-spacing: 0.08em;
  }

  .ob-spread {
    font-size: 0.6rem;
    color: var(--tv-highlight-soft);
    text-align: center;
    padding-top: 0.25rem;
  }

  /* ── Entry window panel ───────────────────────────────────────────────── */
  .entry-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--tv-border);
    flex-shrink: 0;
  }

  .entry-status-badge {
    color: var(--status-warn);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .entry-elapsed {
    color: var(--tv-text-muted);
    font-size: 0.7rem;
    font-weight: 600;
  }

  .entry-details {
    flex: 1;
    padding: 0.2rem 0;
    overflow-y: auto;
  }

  .entry-row {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    padding: 0.12rem 0.55rem;
    border-bottom: 1px solid rgba(43, 47, 51, 0.3);
    font-size: 0.65rem;
  }

  .ek {
    color: var(--tv-text-muted);
    font-size: 0.58rem;
    flex-shrink: 0;
    width: 5.5rem;
  }

  .ev {
    color: var(--tv-text-primary);
    font-weight: 600;
    flex-shrink: 0;
    width: 3.5rem;
  }

  .ev.warn {
    color: var(--status-warn);
  }

  .ed {
    color: rgba(154, 167, 160, 0.7);
    flex: 1;
    font-size: 0.6rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-signals {
    border-top: 1px solid var(--tv-border);
    padding: 0.3rem 0.55rem;
    flex-shrink: 0;
  }

  .entry-sig-label {
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--tv-text-muted);
    margin-bottom: 0.25rem;
  }

  .entry-sig-row {
    display: flex;
    justify-content: space-between;
    padding: 0.08rem 0;
    font-size: 0.63rem;
  }

  .entry-sig-key {
    color: var(--tv-text-muted);
  }

  .entry-sig-val {
    font-weight: 600;
  }

  /* ── Positions panel ──────────────────────────────────────────────────── */
  .positions-list {
    flex-shrink: 0;
  }

  .pos-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.3rem 0.55rem;
    border-bottom: 1px solid rgba(43, 47, 51, 0.4);
    font-size: 0.65rem;
  }

  .pos-row:hover {
    background: rgba(176, 38, 255, 0.06);
  }

  .pos-left {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
  }

  .pos-pair {
    color: var(--tv-text-primary);
    font-weight: 600;
  }

  .pos-price {
    color: var(--tv-text-muted);
    font-size: 0.6rem;
  }

  .pos-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.05rem;
  }

  .pos-pnl.profit {
    color: var(--m3-positive);
    font-weight: 600;
  }

  .pos-pnl.loss {
    color: var(--tv-negative);
    font-weight: 600;
  }

  .pos-badge {
    font-size: 0.55rem;
    padding: 0.05rem 0.3rem;
    border-radius: 2px;
    letter-spacing: 0.06em;
  }

  .pos-badge.profit {
    background: rgba(29, 223, 114, 0.12);
    color: var(--m3-positive);
    border: 1px solid rgba(29, 223, 114, 0.25);
  }

  .pos-badge.loss {
    background: rgba(255, 77, 87, 0.12);
    color: var(--tv-negative);
    border: 1px solid rgba(255, 77, 87, 0.25);
  }

  /* ── Signal tree ──────────────────────────────────────────────────────── */
  .signal-tree {
    overflow-y: auto;
    flex: 1;
  }

  .tree-row {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    padding: 0.1rem 0.55rem;
    border-bottom: 1px solid rgba(43, 47, 51, 0.3);
    font-size: 0.63rem;
  }

  .tree-row:hover {
    background: rgba(176, 38, 255, 0.05);
  }

  .tree-label {
    font-size: 0.58rem;
    font-weight: 600;
    flex-shrink: 0;
    width: 2.8rem;
  }

  .tree-detail {
    color: var(--tv-text-muted);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-tag {
    font-size: 0.55rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  /* ── Bottom row ───────────────────────────────────────────────────────── */
  .bottom-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    border-top: 1px solid var(--tv-border);
    flex-shrink: 0;
  }

  .panel-trades {
    min-height: 0;
  }

  /* ── Trades table ─────────────────────────────────────────────────────── */
  .trades-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.63rem;
  }

  .trades-table th {
    padding: 0.2rem 0.55rem;
    text-align: left;
    color: var(--tv-text-muted);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    border-bottom: 1px solid var(--tv-border);
    background: #04060a;
  }

  .trades-table td {
    padding: 0.2rem 0.55rem;
    border-bottom: 1px solid rgba(43, 47, 51, 0.35);
  }

  .trade-row.buy:hover {
    background: rgba(29, 223, 114, 0.04);
  }

  .trade-row.sell:hover {
    background: rgba(255, 77, 87, 0.04);
  }

  .mono {
    font-family: "JetBrains Mono", monospace;
  }

  /* ── Signal bar panels ────────────────────────────────────────────────── */
  .signal-bars {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0.6rem;
    flex: 1;
  }

  .signal-bar-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sbar-label {
    width: 5.5rem;
    font-size: 0.6rem;
    color: var(--tv-text-muted);
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sbar-track {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
  }

  .sbar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s ease;
  }

  .sbar-pct {
    width: 2.5rem;
    text-align: right;
    font-size: 0.62rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  /* ── Heatmap / order flow ─────────────────────────────────────────────── */
  .panel-heatmap {
    border-right: none;
  }

  .heatmap-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    padding: 0.4rem 0.5rem;
    flex-shrink: 0;
  }

  .heatmap-cell {
    padding: 0.25rem 0;
    text-align: center;
    font-size: 0.58rem;
    border-radius: 2px;
    color: rgba(255, 255, 255, 0.85);
    font-weight: 500;
  }

  .flow-spread {
    font-size: 0.62rem;
    color: var(--tv-highlight-soft);
    text-align: center;
    padding: 0.1rem 0 0.3rem;
    border-top: 1px solid var(--tv-border);
  }

  .flow-stats {
    padding: 0.25rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .flow-stat-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.62rem;
  }

  .flow-stat-k {
    color: var(--tv-text-muted);
  }

  .flow-stat-v {
    color: var(--tv-text-primary);
    font-weight: 600;
  }

  /* ── Shared color utilities ───────────────────────────────────────────── */
  .pos {
    color: var(--m3-positive);
  }

  .neg {
    color: var(--tv-negative);
  }

  .warn {
    color: var(--status-warn);
  }

  .muted {
    color: var(--tv-text-muted);
  }
</style>
