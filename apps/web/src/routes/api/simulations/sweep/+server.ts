import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ANALYTICS_BASE_URL = process.env.YACT_ANALYTICS_URL || 'http://localhost:8000';

export const POST: RequestHandler = async ({ fetch, request }) => {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000); // sweeps can be slow

    let response: Response;
    try {
        response = await fetch(`${ANALYTICS_BASE_URL}/api/v1/simulations/sweep`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    } catch {
        clearTimeout(timer);
        return json({ error: 'Sweep upstream timed out or unreachable' }, { status: 503 });
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        const detail = await response.text();
        return json(
            { error: `Sweep upstream failed: HTTP ${response.status}`, detail },
            { status: response.status >= 500 ? 502 : response.status },
        );
    }

    const payload = await response.json();
    return json(payload);
};
