/**
 * useViewSettings — shared display preferences for the markets page.
 *
 * Created by AppShellLayout via setContext and consumed by page-level
 * components via getContext. Using Svelte's context API means the state
 * is truly shared (same object reference) across the layout tree.
 *
 * Settings are persisted to localStorage so they survive hard reloads.
 */

export type OverviewStyleVariant = "separate" | "unified" | "minimal";
export type ChartEngineVariant = "svg" | "lightweight";

export interface ViewSettings {
  overviewStyle: OverviewStyleVariant;
  showMarketCapPill: boolean;
  chartEngine: ChartEngineVariant;
  activeFilter: string;
}

export const VIEW_SETTINGS_KEY = "yact:view-settings";

const STORAGE_KEY = "yact:view-settings:prefs";
const VALID_STYLES: OverviewStyleVariant[] = ["separate", "unified", "minimal"];
const VALID_ENGINES: ChartEngineVariant[] = ["svg", "lightweight"];

function loadPersistedSettings(): {
  overviewStyle: OverviewStyleVariant;
  showMarketCapPill: boolean;
  chartEngine: ChartEngineVariant;
  activeFilter: string;
} {
  const defaults = {
    overviewStyle: "separate" as OverviewStyleVariant,
    showMarketCapPill: true,
    chartEngine: "lightweight" as ChartEngineVariant,
    activeFilter: "Top 100",
  };
  try {
    const raw =
      typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      overviewStyle: VALID_STYLES.includes(parsed.overviewStyle)
        ? parsed.overviewStyle
        : defaults.overviewStyle,
      showMarketCapPill:
        typeof parsed.showMarketCapPill === "boolean"
          ? parsed.showMarketCapPill
          : defaults.showMarketCapPill,
      chartEngine: VALID_ENGINES.includes(parsed.chartEngine)
        ? parsed.chartEngine
        : defaults.chartEngine,
      activeFilter:
        typeof parsed.activeFilter === "string" && parsed.activeFilter.trim()
          ? parsed.activeFilter
          : defaults.activeFilter,
    };
  } catch {
    return defaults;
  }
}

export function createViewSettings(): ViewSettings {
  const persisted = loadPersistedSettings();
  let overviewStyle = $state<OverviewStyleVariant>(persisted.overviewStyle);
  let showMarketCapPill = $state(persisted.showMarketCapPill);
  let chartEngine = $state<ChartEngineVariant>(persisted.chartEngine);
  let activeFilter = $state<string>(persisted.activeFilter);

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          overviewStyle,
          showMarketCapPill,
          chartEngine,
          activeFilter,
        }),
      );
    } catch {
      // storage unavailable (private browsing quota, etc.) — silently ignore
    }
  }

  return {
    get overviewStyle() {
      return overviewStyle;
    },
    set overviewStyle(v: OverviewStyleVariant) {
      overviewStyle = v;
      persist();
    },
    get showMarketCapPill() {
      return showMarketCapPill;
    },
    set showMarketCapPill(v: boolean) {
      showMarketCapPill = v;
      persist();
    },
    get chartEngine() {
      return chartEngine;
    },
    set chartEngine(v: ChartEngineVariant) {
      chartEngine = v;
      persist();
    },
    get activeFilter() {
      return activeFilter;
    },
    set activeFilter(v: string) {
      activeFilter = v;
      persist();
    },
  };
}
