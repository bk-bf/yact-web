import { json } from '@sveltejs/kit';

export async function GET({ url }) {
    const limitParam = Number(url.searchParams.get('limit') ?? '20');
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(200, Math.floor(limitParam))) : 20;
    const queueLimitParam = Number(url.searchParams.get('queueLimit') ?? '30');
    const queueLimit = Number.isFinite(queueLimitParam)
        ? Math.max(1, Math.min(200, Math.floor(queueLimitParam)))
        : 30;

    return json({
        status: {
            schedulerStarted: false,
            running: false,
            mode: 'disabled'
        },
        events: [],
        queue: [],
        note: `web auto-refresh is deprecated in REST-only mode (limit=${limit}, queueLimit=${queueLimit})`
    });
}
