import { json } from "@sveltejs/kit";

const ANALYTICS_BASE_URL =
  process.env.YACT_ANALYTICS_URL || "http://localhost:8000";

export async function GET({ fetch }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`${ANALYTICS_BASE_URL}/health/db`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return json({ db: "down", api: "down" });
    const body = (await res.json()) as { db?: string };
    return json({ db: body.db ?? "unknown", api: "ok" });
  } catch {
    clearTimeout(timer);
    return json({ db: "unknown", api: "down" });
  }
}
