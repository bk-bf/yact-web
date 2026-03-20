import { json } from '@sveltejs/kit';

import {
    getCachedGasGwei,
    getFallbackGlobalMarketSummary,
    getLatestGasGwei,
    getTopGainers,
    getTrendingByVolume
} from '../../../lib/server/coingecko';
import { getFallbackCryptoHeadlines, getTopCryptoHeadlines } from '../../../lib/server/headlines';
import { ensureAutoRefreshStarted, refreshMarketsNow } from '../../../lib/server/autoRefreshService';
import {
    readPersistentHeadlinesSnapshot,
    writePersistentHeadlinesSnapshot
} from '../../../lib/server/persistentHeadlinesSnapshot';
import { readPersistentMarketSnapshot } from '../../../lib/server/persistentMarketSnapshot';

export async function GET({ fetch }) {
    ensureAutoRefreshStarted();

    const [persistentSnapshot, headlinesSnapshot] = await Promise.all([
        readPersistentMarketSnapshot(),
        readPersistentHeadlinesSnapshot()
    ]);

    const headlines = headlinesSnapshot?.headlines ?? [];
    const cachedGasGwei = getCachedGasGwei();

    // Keep API latency low: refresh upstream sources in background only.
    void getTopCryptoHeadlines(fetch, 12)
        .then((freshHeadlines) => {
            if (freshHeadlines.length > 0) {
                return writePersistentHeadlinesSnapshot('reddit-direct', freshHeadlines);
            }

            const fallbackHeadlines = getFallbackCryptoHeadlines();
            if (fallbackHeadlines.length > 0) {
                return writePersistentHeadlinesSnapshot('fallback', fallbackHeadlines);
            }

            return Promise.resolve();
        })
        .catch(() => {
            // Keep stale snapshot headlines when live fetch fails.
        });

    if (cachedGasGwei === null) {
        void getLatestGasGwei().catch(() => {
            // Gas is optional in UI; stale value is acceptable.
        });
    }

    if (persistentSnapshot) {
        // Serve DB snapshot immediately and refresh upstream asynchronously.
        void refreshMarketsNow(fetch);

        const dbGlobalResolved = {
            ...persistentSnapshot.global,
            gasGwei: cachedGasGwei ?? persistentSnapshot.global.gasGwei
        };

        const ageMs = Date.now() - persistentSnapshot.ts;
        return json({
            source: 'db-cache',
            count: persistentSnapshot.count,
            coins: persistentSnapshot.coins,
            global: dbGlobalResolved,
            headlines,
            highlights: {
                trending: getTrendingByVolume(persistentSnapshot.coins, 3),
                topGainers: getTopGainers(persistentSnapshot.coins, 3)
            },
            stale: ageMs > 5 * 60_000,
            snapshotTs: persistentSnapshot.ts
        });
    }

    // DB-only mode: never block request path on live upstream fetch.
    return json(
        {
            source: 'db-unavailable',
            count: 0,
            coins: [],
            global: getFallbackGlobalMarketSummary([]),
            headlines,
            highlights: {
                trending: [],
                topGainers: []
            },
            stale: true,
            error: 'No persisted market snapshot available yet. Auto-refresh will populate DB when upstream succeeds.'
        },
        { status: 503 }
    );
}
