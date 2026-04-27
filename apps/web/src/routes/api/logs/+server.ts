import { json } from "@sveltejs/kit";

const ANALYTICS_BASE_URL =
  process.env.YACT_ANALYTICS_URL || "http://localhost:8000";

export async function GET({ fetch, url }) {
  const lines = url.searchParams.get("lines") ?? "150";
  const source = url.searchParams.get("source") ?? "miner";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(
      `${ANALYTICS_BASE_URL}/api/v1/logs?lines=${encodeURIComponent(lines)}&source=${encodeURIComponent(source)}`,
      {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      },
    );
  } catch {
    clearTimeout(timer);
    return json({ lines: [], source, exists: false, error: "upstream_timeout" });
  } finally {
    clearTimeout(timer);
  }

  if (!upstreamResponse.ok) {
    return json({ lines: [], source, exists: false, error: "upstream_error" });
  }

  return json(await upstreamResponse.json());
}
