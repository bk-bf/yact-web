import type { RequestHandler } from "./$types";

const ANALYTICS_BASE_URL =
  process.env.YACT_ANALYTICS_URL || "http://localhost:8000";

/**
 * SSE proxy: forward the backend /api/v1/logs/stream response byte-for-byte
 * so the browser EventSource sees a proper text/event-stream.
 */
export const GET: RequestHandler = async ({ fetch, url }) => {
  const source = url.searchParams.get("source") ?? "miner";

  let upstream: Response;
  try {
    upstream = await fetch(
      `${ANALYTICS_BASE_URL}/api/v1/logs/stream?source=${encodeURIComponent(source)}`,
      { headers: { Accept: "text/event-stream" } },
    );
  } catch {
    return new Response("upstream unavailable", { status: 503 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("upstream error", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
};
