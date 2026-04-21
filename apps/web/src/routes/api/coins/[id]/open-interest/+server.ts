import { json } from '@sveltejs/kit';

const ANALYTICS_BASE_URL = process.env.YACT_ANALYTICS_URL || 'http://localhost:8000';

export async function GET({ fetch, params }) {
    const coinId = params.id;

    if (!coinId) {
        return json({ error: 'Missing coin id.' }, { status: 400 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
        response = await fetch(`${ANALYTICS_BASE_URL}/api/v1/open-interest/${encodeURIComponent(coinId)}`, {
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });
    } catch {
        clearTimeout(timer);
        return json({ error: 'open-interest upstream timed out or unreachable' }, { status: 503 });
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        if (response.status === 404) {
            return json({ oi: [], exchanges: [] });
        }
        const detail = await response.text();
        return json({
            error: `open-interest upstream failed: HTTP ${response.status}`,
            detail
        }, { status: 503 });
    }

    const payload = await response.json();
    const rows = payload?.oi ?? [];

    const oiData = rows.map((row: unknown) => {
        const r = row as { coin_id?: string; exchange?: string; oi_usd?: number; ts?: number };
        return {
            coinId: r.coin_id ?? coinId,
            exchange: r.exchange ?? 'unknown',
            oiUsd: typeof r.oi_usd === 'number' ? r.oi_usd : 0,
            ts: typeof r.ts === 'number' ? r.ts : 0,
        };
    });

    const exchanges = [...new Set(oiData.map((r: { exchange: string }) => r.exchange))];

    return json({
        oi: oiData,
        exchanges,
    });
}