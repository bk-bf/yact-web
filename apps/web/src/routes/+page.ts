import type { PageLoad } from './$types';

import type { MarketCoin } from '../lib/types/market';

interface GlobalMarketSummary {
    totalMarketCapUsd: number;
    totalVolumeUsd: number;
    marketCapChangePercentage24hUsd: number;
    btcDominance: number;
    activeCryptocurrencies: number;
    marketCapSparkline7d: number[];
}

interface MarketHighlights {
    trending: MarketCoin[];
    topGainers: MarketCoin[];
}

interface MarketsResponse {
    source: string;
    count: number;
    coins: MarketCoin[];
    global: GlobalMarketSummary;
    highlights: MarketHighlights;
    stale?: boolean;
    warning?: string;
    error?: string;
}

export const load: PageLoad = async ({ fetch }) => {
    const response = await fetch('/api/markets');
    const payload = (await response.json()) as MarketsResponse;

    return {
        coins: payload.coins,
        global: payload.global,
        highlights: payload.highlights,
        source: payload.source,
        stale: payload.stale ?? false,
        warning: payload.warning ?? null,
        error: payload.error ?? null
    };
};
