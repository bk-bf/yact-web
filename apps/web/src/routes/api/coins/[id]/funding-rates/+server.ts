import { json } from '@sveltejs/kit';

const ANALYTICS_BASE_URL = process.env.YACT_ANALYTICS_URL || 'http://localhost:8000';

interface FundingRateRow {
    coinId: string;
    exchange: string;
    rate: number;
    ts: number;
}

interface FundingRatesResponse {
    rates?: FundingRateRow[];
    error?: string;
}

export async function GET({ fetch, params }) {
    const coinId = params.id;

    if (!coinId) {
        return json({ error: 'Missing coin id.' }, { status: 400 });
    }

    const response = await fetch(`${ANALYTICS_BASE_URL}/api/v1/funding-rates/${encodeURIComponent(coinId)}`, {
        headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
        if (response.status === 404) {
            return json({ rates: [] }, { status: 200 });
        }
        const detail = await response.text();
        return json({
            error: `funding rates upstream failed: HTTP ${response.status}`,
            detail
        }, { status: response.status === 404 ? 404 : 503 });
    }

    const payload = await response.json() as FundingRatesResponse;

    const rates = Array.isArray(payload.rates) ? payload.rates : [];

    return json({
        rates,
        stale: false,
    }, {
        headers: {
            'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
        }
    });
}