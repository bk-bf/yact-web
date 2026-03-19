import { json } from '@sveltejs/kit';

import {
    getCachedGlobalMarketSummary,
    getCachedGasGwei,
    getCachedTopMarketCoins,
    getFallbackGlobalMarketSummary,
    getGlobalMarketSummary,
    getLatestGasGwei,
    getTopGainers,
    getTrendingByVolume,
    getTopMarketCoins
} from '../../../lib/server/coingecko';
import { getFallbackCryptoHeadlines, getTopCryptoHeadlines } from '../../../lib/server/headlines';

export async function GET({ fetch }) {
    const headlinesPromise = getTopCryptoHeadlines(fetch, 5).catch(() => getFallbackCryptoHeadlines());
    const gasPromise = getLatestGasGwei().catch(() => getCachedGasGwei());

    try {
        const coins = await getTopMarketCoins(fetch);
        const [global, headlines, gasGwei] = await Promise.all([
            getGlobalMarketSummary(fetch, coins),
            headlinesPromise,
            gasPromise
        ]);

        return json({
            source: 'coingecko',
            count: coins.length,
            coins,
            global: {
                ...global,
                gasGwei: gasGwei ?? global.gasGwei
            },
            headlines,
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
            const [headlines, gasGwei] = await Promise.all([headlinesPromise, gasPromise]);
            const cached = getCachedTopMarketCoins();
            const globalCached = getCachedGlobalMarketSummary();
            if (cached) {
                const cachedGlobal = globalCached?.summary ?? getFallbackGlobalMarketSummary(cached.coins);
                return json({
                    source: 'coingecko-cache',
                    count: cached.coins.length,
                    coins: cached.coins,
                    global: {
                        ...cachedGlobal,
                        gasGwei: gasGwei ?? cachedGlobal.gasGwei
                    },
                    headlines,
                    highlights: {
                        trending: getTrendingByVolume(cached.coins, 3),
                        topGainers: getTopGainers(cached.coins, 3)
                    },
                    stale: true,
                    warning: 'CoinGecko rate-limited requests (429). Showing cached market snapshot.'
                });
            }

            const emptyGlobal = getFallbackGlobalMarketSummary([]);
            return json(
                {
                    source: 'coingecko-unavailable',
                    count: 0,
                    coins: [],
                    global: {
                        ...emptyGlobal,
                        gasGwei: gasGwei ?? emptyGlobal.gasGwei
                    },
                    headlines,
                    highlights: {
                        trending: [],
                        topGainers: []
                    },
                    stale: true,
                    warning: 'CoinGecko rate-limited requests (429) and no cached market snapshot is available.'
                },
                { status: 503 }
            );
        }

        return json(
            {
                source: 'coingecko',
                count: 0,
                coins: [],
                global: getFallbackGlobalMarketSummary([]),
                headlines: getFallbackCryptoHeadlines(),
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
