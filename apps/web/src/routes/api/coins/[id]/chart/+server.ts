import { json } from '@sveltejs/kit';

type CoinChartRange = '24h' | '7d' | '1m' | '3m' | 'ytd' | '1y' | 'max';

const VALID_RANGES: CoinChartRange[] = ['24h', '7d', '1m', '3m', 'ytd', '1y', 'max'];

const ANALYTICS_BASE_URL = process.env.YACT_ANALYTICS_URL || 'http://localhost:8000';

function isCoinChartRange(value: string): value is CoinChartRange {
    return VALID_RANGES.includes(value as CoinChartRange);
}

export async function GET({ fetch, params, url }) {
    const coinId = params.id;
    const rangeParam = url.searchParams.get('range') ?? '7d';

    if (!coinId) {
        return json({ error: 'Missing coin id.' }, { status: 400 });
    }

    if (!isCoinChartRange(rangeParam)) {
        return json({ error: `Invalid range '${rangeParam}'.` }, { status: 400 });
    }

    const response = await fetch(`${ANALYTICS_BASE_URL}/api/v1/coins/${encodeURIComponent(coinId)}`, {
        headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
        const detail = await response.text();
        return json({
            error: `coin upstream failed: HTTP ${response.status}`,
            detail
        }, { status: response.status === 404 ? 404 : 503 });
    }

    const payload = await response.json();
    const chart = payload?.coins?.[coinId]?.charts?.[rangeParam];
    if (!chart?.value) {
        return json({
            error: `No '${rangeParam}' chart available for '${coinId}' in analytics API.`
        }, { status: 404 });
    }

    return json({
        range: rangeParam,
        prices: chart.value.prices,
        volumes: chart.value.volumes,
        timestamps: chart.value.timestamps,
        source: 'analytics-api',
        stale: false,
        origin: chart.value.source,
        snapshotTs: chart.ts
    });
}
