import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ANALYTICS_BASE_URL = process.env.YACT_ANALYTICS_URL || 'http://localhost:8000';

export const GET: RequestHandler = async ({ fetch, params }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
        response = await fetch(
            `${ANALYTICS_BASE_URL}/api/v1/coins/${params.id}/regime-match`,
            {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            },
        );
    } catch {
        clearTimeout(timer);
        return json({ error: 'Regime-match upstream unreachable' }, { status: 503 });
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        const detail = await response.text();
        return json(
            { error: `Regime-match upstream failed: HTTP ${response.status}`, detail },
            { status: response.status >= 500 ? 502 : response.status },
        );
    }

    const payload = await response.json();
    return json(payload);
};
