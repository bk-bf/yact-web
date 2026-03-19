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
import {
    readPersistentMarketSnapshot,
    writePersistentMarketSnapshot
} from '../../../lib/server/persistentMarketSnapshot';

async function persistSnapshotSafely(
    source: string,
    coins: Awaited<ReturnType<typeof getTopMarketCoins>>,
    global: Awaited<ReturnType<typeof getGlobalMarketSummary>>
): Promise<void> {
    try {
        await writePersistentMarketSnapshot(source, coins, global);
    } catch (error) {
        console.error('Failed to persist market snapshot:', error);
    }
}

export async function GET({ fetch }) {
    const headlinesPromise = getTopCryptoHeadlines(fetch, 5).catch(() => getFallbackCryptoHeadlines());
    const gasPromise = getLatestGasGwei().catch(() => getCachedGasGwei());
    const persistentSnapshot = await readPersistentMarketSnapshot();

    try {
        const coins = await getTopMarketCoins(fetch);
        const [global, headlines, gasGwei] = await Promise.all([
            getGlobalMarketSummary(fetch, coins),
            headlinesPromise,
            gasPromise
        ]);

        const globalResolved = {
            ...global,
            gasGwei: gasGwei ?? global.gasGwei
        };

        await persistSnapshotSafely('coingecko', coins, globalResolved);

        return json({
            source: 'coingecko',
            count: coins.length,
            coins,
            global: globalResolved,
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
                const globalResolved = {
                    ...cachedGlobal,
                    gasGwei: gasGwei ?? cachedGlobal.gasGwei
                };

                await persistSnapshotSafely('coingecko-cache', cached.coins, globalResolved);

                return json({
                    source: 'coingecko-cache',
                    count: cached.coins.length,
                    coins: cached.coins,
                    global: globalResolved,
                    headlines,
                    highlights: {
                        trending: getTrendingByVolume(cached.coins, 3),
                        topGainers: getTopGainers(cached.coins, 3)
                    },
                    stale: true,
                    warning: 'CoinGecko rate-limited requests (429). Showing cached market snapshot.'
                });
            }

            if (persistentSnapshot) {
                const diskGlobalResolved = {
                    ...persistentSnapshot.global,
                    gasGwei: gasGwei ?? persistentSnapshot.global.gasGwei
                };

                return json({
                    source: 'coingecko-disk-cache',
                    count: persistentSnapshot.count,
                    coins: persistentSnapshot.coins,
                    global: diskGlobalResolved,
                    headlines,
                    highlights: {
                        trending: getTrendingByVolume(persistentSnapshot.coins, 3),
                        topGainers: getTopGainers(persistentSnapshot.coins, 3)
                    },
                    stale: true,
                    warning:
                        'CoinGecko rate-limited and memory cache was empty. Showing persisted disk snapshot fallback.'
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
