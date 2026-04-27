import { json } from "@sveltejs/kit";

const ANALYTICS_BASE_URL =
  process.env.YACT_ANALYTICS_URL || "http://localhost:8000";

export async function GET({ fetch }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  let res: Response;
  try {
    res = await fetch(`${ANALYTICS_BASE_URL}/api/v1/progress/field-velocity`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    return json(null);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) return json(null);
  return json(await res.json());
}
