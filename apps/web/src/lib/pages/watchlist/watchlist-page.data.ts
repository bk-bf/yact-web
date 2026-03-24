import type { MarketCoin } from "../../types/market";

// Exported so the useWatchlistIds composable can import defaults from here,
// avoiding a circular dependency (composable → data file, not data file → composable).
export const DEFAULT_WATCHLIST_IDS: readonly string[] = [];

interface MarketsResponse {
    coins?: MarketCoin[];
    snapshotTs?: number;
    ts?: number;
    stale?: boolean;
    error?: string;
}

export interface WatchlistPageData {
    items: MarketCoin[];
    snapshotTs: number | null;
    stale: boolean;
    error?: string;
}

function placeholderCoin(id: string): MarketCoin {
    return {
        id,
        symbol: id.toUpperCase().slice(0, 8),
        name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " "),
        image: "",
        currentPrice: 0,
        marketCap: 0,
        marketCapRank: 0,
        priceChangePercentage24h: 0,
        totalVolume24h: 0,
        circulatingSupply: 0,
        sparkline7d: [],
    };
}

function normalizeWatchlistData(
    payload: Partial<MarketsResponse> | null,
    ids: readonly string[],
): WatchlistPageData {
    const coins = Array.isArray(payload?.coins) ? payload.coins : [];
    const map = new Map(coins.map((coin) => [coin.id, coin]));
    const items = ids.map((id) => map.get(id) ?? placeholderCoin(id));

    return {
        items,
        snapshotTs: payload?.snapshotTs ?? payload?.ts ?? null,
        stale: payload?.stale ?? false,
        error: payload?.error,
    };
}

export function createInitialWatchlistPageData(
    ids: readonly string[] = DEFAULT_WATCHLIST_IDS,
): WatchlistPageData {
    return normalizeWatchlistData({ stale: true }, ids);
}

export async function loadWatchlistPageData(
    fetchFn: typeof fetch,
    ids: readonly string[] = DEFAULT_WATCHLIST_IDS,
): Promise<WatchlistPageData> {
    try {
        const response = await fetchFn("/api/markets");
        const payload = (await response.json()) as Partial<MarketsResponse>;

        if (!response.ok) {
            return normalizeWatchlistData({ ...payload, stale: true }, ids);
        }

        return normalizeWatchlistData(payload, ids);
    } catch {
        return createInitialWatchlistPageData(ids);
    }
}
