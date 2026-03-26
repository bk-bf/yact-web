import { json } from '@sveltejs/kit';

const ANALYTICS_BASE_URL = process.env.YACT_ANALYTICS_URL || 'http://localhost:8000';

export async function GET({ fetch }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    let upstreamResponse: Response;
    try {
        upstreamResponse = await fetch(`${ANALYTICS_BASE_URL}/api/v1/provider-health`, {
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });
    } catch {
        clearTimeout(timer);
        return json([]);
    } finally {
        clearTimeout(timer);
    }

    if (!upstreamResponse.ok) {
        return json([]);
    }

    const payload = await upstreamResponse.json();
    return json(Array.isArray(payload) ? payload : []);
}
