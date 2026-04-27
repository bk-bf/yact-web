import type { RequestHandler } from "./$types";

const ANALYTICS_BASE_URL =
  process.env.YACT_ANALYTICS_URL || "http://localhost:8000";

/**
 * SSE proxy: pipes /api/v1/markets/stream from FastAPI to the browser.
 *
 * No timeout — this is a long-lived connection; the browser EventSource
 * reconnects automatically if the upstream closes or the server restarts.
 */
export const GET: RequestHandler = async ({ fetch }) => {
  let upstream: Response;
  try {
    upstream = await fetch(`${ANALYTICS_BASE_URL}/api/v1/markets/stream`, {
      headers: { Accept: "text/event-stream" },
    });
  } catch {
    return new Response("upstream SSE unavailable", { status: 503 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("upstream SSE failed", { status: 503 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
};
