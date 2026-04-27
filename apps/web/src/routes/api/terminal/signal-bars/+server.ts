import { json } from "@sveltejs/kit";

const ANALYTICS_BASE_URL =
  process.env.YACT_ANALYTICS_URL || "http://localhost:8000";

async function safeGet(
  fetchFn: typeof fetch,
  url: string,
): Promise<unknown> {
  try {
    const r = await fetchFn(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function GET({ fetch }) {
  const [fgData, btcFrData, btcOiData] = await Promise.all([
    safeGet(fetch, `${ANALYTICS_BASE_URL}/api/v1/fear-greed/latest`),
    safeGet(
      fetch,
      `${ANALYTICS_BASE_URL}/api/v1/funding-rates/bitcoin?limit=1`,
    ),
    safeGet(
      fetch,
      `${ANALYTICS_BASE_URL}/api/v1/open-interest/bitcoin?limit=2`,
    ),
  ]);

  // F&G bar: score 0-100 directly maps to pct
  const fgItem = fgData as
    | { score: number; classification: string }
    | null
    | undefined;
  const fgScore =
    typeof fgItem?.score === "number" ? fgItem.score : undefined;
  const fgBar = {
    l: "F&G",
    pct: fgScore ?? 0,
    source: fgScore !== undefined ? ("live" as const) : ("placeholder" as const),
    raw: fgScore !== undefined ? `${fgScore} · ${fgItem!.classification}` : "N/A",
  };

  // Funding rate bar: map rate to 0–100 with 50 = neutral.
  // Typical range: −0.003 to +0.003.
  const frRates = ((btcFrData as Record<string, unknown>) ?? {})
    ?.funding_rates as unknown[];
  const latestFr = Array.isArray(frRates)
    ? (frRates[0] as { rate: number; exchange: string } | undefined)
    : undefined;
  let frPct = 50;
  let frRaw = "N/A";
  if (latestFr) {
    const rate = latestFr.rate;
    const clamped = Math.max(-0.003, Math.min(0.003, rate));
    frPct = Math.round(((clamped + 0.003) / 0.006) * 100);
    frRaw = `${(rate * 100).toFixed(4)}% · ${latestFr.exchange}`;
  }
  const frBar = {
    l: "FUNDING",
    pct: frPct,
    source: latestFr ? ("live" as const) : ("placeholder" as const),
    raw: frRaw,
  };

  // OI bar: use % change between last two readings; 50 = neutral.
  const oiRecords = ((btcOiData as Record<string, unknown>) ?? {})
    ?.open_interest as unknown[];
  let oiPct = 50;
  let oiRaw = "N/A";
  if (Array.isArray(oiRecords)) {
    if (oiRecords.length >= 2) {
      const cur = (oiRecords[0] as { oi_usd: number }).oi_usd;
      const prv = (oiRecords[1] as { oi_usd: number }).oi_usd;
      const chg = prv > 0 ? ((cur - prv) / prv) * 100 : 0;
      // Map ±5 % OI change to 0–100: 0 % = 50, +5 % = 100, −5 % = 0
      oiPct = Math.round(Math.max(0, Math.min(100, 50 + chg * 10)));
      oiRaw = `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`;
    } else if (oiRecords.length === 1) {
      const cur = (oiRecords[0] as { oi_usd: number }).oi_usd;
      oiPct = 50;
      oiRaw = `$${(cur / 1e9).toFixed(2)}B`;
    }
  }
  const oiBar = {
    l: "OI",
    pct: oiPct,
    source:
      Array.isArray(oiRecords) && oiRecords.length > 0
        ? ("live" as const)
        : ("placeholder" as const),
    raw: oiRaw,
  };

  return json({ bars: [fgBar, frBar, oiBar] });
}
