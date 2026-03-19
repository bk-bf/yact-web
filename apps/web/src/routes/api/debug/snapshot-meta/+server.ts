import { json } from '@sveltejs/kit';

import { ensureAutoRefreshStarted } from '../../../../lib/server/autoRefreshService';
import { readCoinLatestSnapshotTs } from '../../../../lib/server/persistentCoinSnapshot';
import { readPersistentMarketSnapshot } from '../../../../lib/server/persistentMarketSnapshot';

export async function GET({ url }) {
    ensureAutoRefreshStarted();

    const coinId = url.searchParams.get('coinId');
    const [market, coin] = await Promise.all([
        readPersistentMarketSnapshot(),
        coinId ? readCoinLatestSnapshotTs(coinId) : Promise.resolve(null)
    ]);

    return json({
        marketSnapshotTs: market?.ts ?? null,
        coinSnapshotTs: coin,
        coinId: coinId ?? null,
        ts: Date.now()
    });
}
