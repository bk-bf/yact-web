import type { PageLoad } from "./$types";

export interface RefreshStateData {
  cycle_count: number;
  last_cycle_at: string | null;
  last_cycle_success: boolean;
  updated_at: string | null;
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
}

export interface DashboardPageData {
  refreshState: RefreshStateData | null;
  progress: ProgressOverview | null;
}

export const load: PageLoad = (): DashboardPageData => {
  return { refreshState: null, progress: null };
};
