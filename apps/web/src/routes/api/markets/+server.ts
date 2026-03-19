import { json } from '@sveltejs/kit';

import {
    getCachedGlobalMarketSummary,
    getCachedTopMarketCoins,
    getFallbackGlobalMarketSummary,
    getFallbackTopMarketCoins,
    getGlobalMarketSummary,
    getTopGainers,
    getTrendingByVolume,
    getTopMarketCoins
} from '../../../lib/server/coingecko';

export async function GET({ fetch }) {
    try {
        const [coins, global] = await Promise.all([
            getTopMarketCoins(fetch),
            getGlobalMarketSummary(fetch)
        ]);

        return json({
            source: 'coingecko',
            count: coins.length,
            coins,
            global,
            highlights: {
                trending: getTrendingByVolume(coins, 3),
                topGainers: getTopGainers(coins, 3)
            },
            stale: false
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const isRateLimit = message.includes('status 429') || message.includes('global request failed');

        if (isRateLimit) {
            const cached = getCachedTopMarketCoins();
            const globalCached = getCachedGlobalMarketSummary();
            if (cached) {
                return json({
                    source: 'coingecko-cache',
                    count: cached.coins.length,
                    coins: cached.coins,
                    global: globalCached?.summary ?? getFallbackGlobalMarketSummary(cached.coins),
                    highlights: {
                        trending: getTrendingByVolume(cached.coins, 3),
                        topGainers: getTopGainers(cached.coins, 3)
                    },
                    stale: true,
                    warning: 'CoinGecko rate-limited requests (429). Showing cached market snapshot.'
                });
            }

            const fallback = getFallbackTopMarketCoins();
            return json({
                source: 'local-fallback',
                count: fallback.length,
                coins: fallback,
                global: getFallbackGlobalMarketSummary(fallback),
                highlights: {
                    trending: getTrendingByVolume(fallback, 3),
                    topGainers: getTopGainers(fallback, 3)
                },
                stale: true,
                warning: 'CoinGecko rate-limited requests (429). Showing fallback market list.'
            });
        }

        return json(
            {
                source: 'coingecko',
                count: 0,
                coins: [],
                global: getFallbackGlobalMarketSummary([]),
                highlights: {
                    trending: [],
                    topGainers: []
                },
                stale: false,
                error: message
            },
            { status: 502 }
        );
    }
}
