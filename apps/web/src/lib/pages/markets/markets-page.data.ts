import type { MarketCoin } from '../../types/market';

interface GlobalMarketSummary {
    totalMarketCapUsd: number;
    totalVolumeUsd: number;
    marketCapChangePercentage24hUsd: number;
    btcDominance: number;
    ethDominance: number;
    totalExchanges: number;
    activeCryptocurrencies: number;
    gasGwei: number | null;
    marketCapSparkline7d: number[];
}

interface MarketHighlights {
    trending: MarketCoin[];
    topGainers: MarketCoin[];
}

interface CryptoHeadline {
    id: string;
    title: string;
    url: string;
    source: string;
    publishedAt: string;
}

interface MarketsResponse {
    source: string;
    count: number;
    coins: MarketCoin[];
    global: GlobalMarketSummary;
    headlines: CryptoHeadline[];
    highlights: MarketHighlights;
    snapshotTs?: number;
    ts?: number;
    stale?: boolean;
    error?: string;
}

const EMPTY_GLOBAL: GlobalMarketSummary = {
    totalMarketCapUsd: 0,
    totalVolumeUsd: 0,
    marketCapChangePercentage24hUsd: 0,
    btcDominance: 0,
    ethDominance: 0,
    totalExchanges: 0,
    activeCryptocurrencies: 0,
    gasGwei: null,
    marketCapSparkline7d: []
};

const EMPTY_HIGHLIGHTS: MarketHighlights = {
    trending: [],
    topGainers: []
};

const MARKETS_CACHE_TTL_MS = 15_000;
const MARKETS_SNAPSHOT_MAX_AGE_MS = 60_000;
type MarketsPageData = ReturnType<typeof normalizeMarketsPayload>;
let cachedMarketsPageData: MarketsPageData | null = null;
let cachedMarketsPageDataAt = 0;

function isFreshSnapshot(snapshotTs: number | null): boolean {
    if (snapshotTs === null) {
        return false;
    }
    return Date.now() - snapshotTs < MARKETS_SNAPSHOT_MAX_AGE_MS;
}

function normalizeMarketsPayload(payload: Partial<MarketsResponse> | null) {
    const safePayload = payload ?? {};
    return {
        coins: Array.isArray(safePayload.coins) ? safePayload.coins : [],
        global: safePayload.global ?? EMPTY_GLOBAL,
        headlines: Array.isArray(safePayload.headlines) ? safePayload.headlines : [],
        highlights: safePayload.highlights ?? EMPTY_HIGHLIGHTS,
        source: safePayload.source ?? 'analytics-api',
        snapshotTs: safePayload.snapshotTs ?? safePayload.ts ?? null,
        stale: safePayload.stale ?? false,
        error: safePayload.error ?? undefined
    };
}

export function createInitialMarketsPageData() {
    if (
        cachedMarketsPageData !== null &&
        Date.now() - cachedMarketsPageDataAt < MARKETS_CACHE_TTL_MS &&
        isFreshSnapshot(cachedMarketsPageData.snapshotTs)
    ) {
        return {
            ...cachedMarketsPageData,
            // Cached snapshot is for fast paint only; client refresh should still revalidate.
            stale: true,
        };
    }

    return normalizeMarketsPayload({
        stale: true
    });
}

export async function loadMarketsPageData(fetchFn: typeof fetch) {
    try {
        const response = await fetchFn('/api/markets');
        const payload = (await response.json()) as Partial<MarketsResponse>;

        if (!response.ok) {
            return normalizeMarketsPayload({
                ...payload,
                stale: true
            });
        }

        const normalized = normalizeMarketsPayload(payload);
        if (normalized.coins.length > 0) {
            cachedMarketsPageData = normalized;
            cachedMarketsPageDataAt = Date.now();
        }

        return normalized;
    } catch {
        return normalizeMarketsPayload({
            stale: true
        });
    }
}

export async function loadMarketsPageDataWithTimeout(
    fetchFn: typeof fetch,
    timeoutMs: number,
): Promise<MarketsPageData> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchFn('/api/markets', {
            signal: controller.signal,
        });
        const payload = (await response.json()) as Partial<MarketsResponse>;

        if (!response.ok) {
            return normalizeMarketsPayload({
                ...payload,
                stale: true,
            });
        }

        const normalized = normalizeMarketsPayload(payload);
        if (normalized.coins.length > 0) {
            cachedMarketsPageData = normalized;
            cachedMarketsPageDataAt = Date.now();
        }

        return normalized;
    } catch {
        return createInitialMarketsPageData();
    } finally {
        clearTimeout(timer);
    }
}