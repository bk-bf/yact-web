import { json } from '@sveltejs/kit';
const ANALYTICS_BASE_URL = process.env.YACT_ANALYTICS_URL || 'http://localhost:8000';

export async function GET({ url, fetch }) {

    const coinId = url.searchParams.get('coinId');

    const marketResponse = await fetch(`${ANALYTICS_BASE_URL}/api/v1/markets`, {
        headers: { Accept: 'application/json' }
    });
    const marketPayload = marketResponse.ok ? await marketResponse.json() : null;

    let coinSnapshotTs: number | null = null;
    if (coinId) {
        const coinResponse = await fetch(`${ANALYTICS_BASE_URL}/api/v1/coins/${encodeURIComponent(coinId)}`, {
            headers: { Accept: 'application/json' }
        });
        if (coinResponse.ok) {
            const coinPayload = await coinResponse.json();
            const entry = coinPayload?.coins?.[coinId];
            const breakdownTs = entry?.breakdown?.ts ?? null;
            const charts: Array<{ ts: number } | undefined> = Object.values(entry?.charts ?? {});
            let latestChartTs: number | null = null;
            for (const chart of charts) {
                if (!chart || typeof chart.ts !== 'number') {
                    continue;
                }
                latestChartTs = latestChartTs === null ? chart.ts : Math.max(latestChartTs, chart.ts);
            }
            coinSnapshotTs = breakdownTs === null ? latestChartTs : (latestChartTs === null ? breakdownTs : Math.max(breakdownTs, latestChartTs));
        }
    }

    return json({
        marketSnapshotTs: typeof marketPayload?.ts === 'number' ? marketPayload.ts : null,
        coinSnapshotTs,
        coinId: coinId ?? null,
        ts: Date.now()
    });
}
