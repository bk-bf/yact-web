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

function fmtTs(iso: string | undefined | null): string {
  if (!iso) return "--:--:--";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
}

export async function GET({ fetch }) {
  const [fgData, btcFrData, ethFrData, btcOiData] = await Promise.all([
    safeGet(fetch, `${ANALYTICS_BASE_URL}/api/v1/fear-greed?limit=2`),
    safeGet(
      fetch,
      `${ANALYTICS_BASE_URL}/api/v1/funding-rates/bitcoin?limit=2`,
    ),
    safeGet(
      fetch,
      `${ANALYTICS_BASE_URL}/api/v1/funding-rates/ethereum?limit=2`,
    ),
    safeGet(
      fetch,
      `${ANALYTICS_BASE_URL}/api/v1/open-interest/bitcoin?limit=2`,
    ),
  ]);

  const events: {
    ts: string;
    kind: string;
    detail: string;
    tag: string;
    source: string;
  }[] = [];

  // Fear & Greed events
  const fgRecords = ((fgData as Record<string, unknown>) ?? {})
    ?.fear_greed as unknown[];
  if (Array.isArray(fgRecords)) {
    for (const fg of fgRecords.slice(0, 2)) {
      const item = fg as { score: number; classification: string; ts?: string };
      const score = item.score;
      const cls = item.classification;
      const tag =
        score <= 25 || score >= 75
          ? "MATCH"
          : score <= 45 || score >= 55
            ? "PENDING"
            : "SCAN";
      events.push({
        ts: fmtTs(item.ts),
        kind: "F&G",
        detail: `${score} · ${cls}`,
        tag,
        source: "fg",
      });
    }
  }

  // Funding rate events
  for (const [coin, frRaw] of [
    ["BTC", btcFrData],
    ["ETH", ethFrData],
  ] as const) {
    const rates = ((frRaw as Record<string, unknown>) ?? {})
      ?.funding_rates as unknown[];
    if (!Array.isArray(rates)) continue;
    for (const fr of rates.slice(0, 1)) {
      const item = fr as { rate: number; exchange: string; ts?: string };
      const rate = item.rate;
      const pct = (rate * 100).toFixed(4);
      const tag = Math.abs(rate) > 0.001 ? "MATCH" : "SCAN";
      events.push({
        ts: fmtTs(item.ts),
        kind: "FUNDING",
        detail: `${coin} ${rate < 0 ? "▼" : "▲"}${pct}% · ${item.exchange}`,
        tag,
        source: "fr",
      });
    }
  }

  // OI events
  const oiRecords = ((btcOiData as Record<string, unknown>) ?? {})
    ?.open_interest as unknown[];
  if (Array.isArray(oiRecords) && oiRecords.length > 0) {
    const oi = oiRecords[0] as {
      oi_usd: number;
      exchange: string;
      ts?: string;
    };
    const oiB = oi.oi_usd / 1e9;
    events.push({
      ts: fmtTs(oi.ts),
      kind: "OI",
      detail: `BTC OI $${oiB.toFixed(2)}B · ${oi.exchange}`,
      tag: "SCAN",
      source: "oi",
    });
    // Compute change if we have 2 records
    if (oiRecords.length >= 2) {
      const prev = oiRecords[1] as { oi_usd: number };
      const chg = prev.oi_usd > 0
        ? ((oi.oi_usd - prev.oi_usd) / prev.oi_usd) * 100
        : 0;
      if (Math.abs(chg) >= 0.5) {
        events.push({
          ts: fmtTs(oi.ts),
          kind: "OI",
          detail: `BTC OI ${chg >= 0 ? "+" : ""}${chg.toFixed(2)}% change`,
          tag: Math.abs(chg) >= 2 ? "MATCH" : "PENDING",
          source: "oi",
        });
      }
    }
  }

  return json({ events });
}
