// Types for the TUI terminal design system and trading terminal components.

export type SignalTag =
  | "SKIP" | "WATCH" | "GAP" | "PENDING"
  | "MATCH" | "ENTER" | "EXIT" | "CUT" | "TIMEOUT" | "SCAN";

export interface LogEntry {
  ts: string;
  kind: string;
  detail: string;
  tag: SignalTag;
}

export interface OBLevel {
  price: string;
  size: string;
  depth: number;
  side: "ask" | "bid";
}

export interface Position {
  pair: string;
  price: string;
  pnl: string;
  pct: string;
  dir: 1 | -1;
}

export interface Trade {
  ts: string;
  dur: string;
  lag: string;
  pnl: string;
  win: boolean;
}

export interface MetricItem {
  k: string;
  v: string;
  c: string;
}

export interface BarItem {
  l: string;
  pct: number;
}

export interface PortfolioRow {
  k: string;
  v: string;
  sub: string;
  c: string;
}

export interface Portfolio {
  value: string;
  badge: string;
  progressPct: number;
  rows: PortfolioRow[];
}

export interface OrderBookSpread {
  last: string;
  sprd: string;
}

export interface PnlStats {
  today: string;
  total: string;
  maxDd: string;
}

export interface BottomBarData {
  branch: string;
  meta: string;
}

// Live data from /api/markets
export interface TuiCoinItem {
  symbol: string;
  currentPrice: number;
  priceChangePercentage24h: number;
  marketCap: number;
}

export interface TuiGlobalData {
  totalMarketCapUsd: number;
  totalVolumeUsd: number;
  marketCapChangePercentage24hUsd: number;
  btcDominance: number;
}

export interface TuiHeadline {
  id: string;
  title: string;
  url: string;
  source: string;
}
