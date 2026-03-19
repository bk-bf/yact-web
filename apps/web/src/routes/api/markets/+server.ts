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

    const headlinesSnapshotPromise = readPersistentHeadlinesSnapshot();
    const headlinesPromise = getTopCryptoHeadlines(fetch, 5).catch(() => getFallbackCryptoHeadlines());
    const gasPromise = getLatestGasGwei().catch(() => getCachedGasGwei());
    const [persistentSnapshot, headlinesFromSource, headlinesSnapshot, gasGwei] = await Promise.all([
        readPersistentMarketSnapshot(),
        headlinesPromise,
        headlinesSnapshotPromise,
        gasPromise
    ]);

    const headlines = headlinesFromSource.length > 0
        ? headlinesFromSource
        : (headlinesSnapshot?.headlines ?? []);

    if (headlinesFromSource.length > 0) {
        void writePersistentHeadlinesSnapshot('reddit-direct', headlinesFromSource);
    }

    if (persistentSnapshot) {
        // Serve DB snapshot immediately and refresh upstream asynchronously.
        void refreshMarketsNow(fetch);

        const dbGlobalResolved = {
            ...persistentSnapshot.global,
            gasGwei: gasGwei ?? persistentSnapshot.global.gasGwei
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
