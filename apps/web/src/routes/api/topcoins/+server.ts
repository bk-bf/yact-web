import { json } from "@sveltejs/kit";

const ANALYTICS_BASE_URL =
  process.env.YACT_ANALYTICS_URL || "http://localhost:8000";

export async function GET({ fetch }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  let upstream: Response;
  try {
    upstream = await fetch(`${ANALYTICS_BASE_URL}/api/v1/topcoins`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    return json(
      { error: "topcoins upstream timed out or unreachable" },
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    return json(
      {
        error: `topcoins upstream failed: HTTP ${upstream.status}`,
        detail,
      },
      { status: 503 },
    );
  }

  const payload = await upstream.json();
  return json(payload);
}
