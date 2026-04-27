import { json } from "@sveltejs/kit";
import type { PriceDivRow } from "$lib/types/terminal";

const ANALYTICS_BASE_URL =
  process.env.YACT_ANALYTICS_URL || "http://localhost:8000";

export async function GET({ fetch }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  let raw: unknown = null;
  try {
    const r = await fetch(
      `${ANALYTICS_BASE_URL}/api/v1/price-divergence?coins=bitcoin,ethereum`,
      { signal: controller.signal },
    );
    if (r.ok) raw = await r.json();
  } catch {
    // upstream unavailable — return empty
  } finally {
    clearTimeout(timer);
  }

  if (!raw) return json({ coins: {} });

  type RawRow = {
    exchange: string;
    raw_symbol: string;
    price_usd: number | null;
    updated_at: string;
  };

  const rawCoins = (raw as { coins?: Record<string, RawRow[]> }).coins ?? {};
  const result: Record<string, PriceDivRow[]> = {};

  for (const [coinId, rows] of Object.entries(rawCoins)) {
    const valid = rows.filter(
      (r): r is RawRow & { price_usd: number } =>
        r.price_usd !== null && r.price_usd > 0,
    );
    if (valid.length === 0) continue;
    const mid = valid.reduce((s, r) => s + r.price_usd, 0) / valid.length;
    result[coinId] = valid.map((r) => ({
      exchange: r.exchange,
      symbol: r.raw_symbol,
      price: r.price_usd,
      pctFromMid: mid > 0 ? ((r.price_usd - mid) / mid) * 100 : 0,
      updatedAt: r.updated_at,
    }));
  }

  return json({ coins: result });
}
