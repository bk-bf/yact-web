import type { PageLoad } from "./$types";

export interface RefreshStateData {
  cycle_count: number;
  last_cycle_at: string | null;
  last_cycle_success: boolean;
  updated_at: string | null;
  current_state?: {
    last_result?: string;
    error?: string;
    status_code?: number | null;
    consecutive_failures?: number;
    interval_sec?: number;
  } | null;
}

export interface MissingClarity {
  coverageUnit: string;
  expectedCoins: number;
  fullyPopulatedCoins: number;
  coinsWithAnyMissingItems: number;
  completelyMissingCoins: number;
  allMissingIsItemLevel: boolean;
  topMissingItemsByField: Record<string, number>;
}

export interface MetadataStage {
  enabled: boolean;
  selectedCoins: number;
  failedCoins: number;
  writtenCoins: number;
  freshness: { lastAttemptAt: string | null; bucket: string };
  skippedReason: string | null;
}

export interface PriceTier {
  totalCoins: number;
  currentPrice: number;
  symbol: number;
  name: number;
  marketCap: number;
  marketCapRank: number;
  volume24h: number;
  priceChange24h: number;
}

export interface ProgressOverview {
  asOf: string;
  snapshotTs?: string;
  cycleCount: number;
  intervalSec: number;
  freshnessThresholdsSec: { freshMax: number; warningMax: number };
  totals: {
    expected: number;
    populated: number;
    missing: number;
    coveragePct: number;
  };
  freshness: { fresh: number; warning: number; stale: number; unknown: number };
  sections: {
    marketCoins: { expected: number; populated: number; coveragePct: number };
    coinBreakdown: { expected: number; populated: number; coveragePct: number };
    charts: { expected: number; populated: number; coveragePct: number };
  };
  missingClarity?: MissingClarity;
  metadataStage?: MetadataStage;
  chartTimeframes?: string[];
  priceTier?: PriceTier;
  cycleHealth?: {
    consecutiveFailures: number;
    lastResult: string | null;
    lastError: string | null;
    lastCycleAt: string | null;
    lastCycleSuccess: boolean | null;
  };
}

export interface DashboardPageData {
  refreshState: RefreshStateData | null;
  progress: ProgressOverview | null;
}

export const load: PageLoad = (): DashboardPageData => {
  return { refreshState: null, progress: null };
};
