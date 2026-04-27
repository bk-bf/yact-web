import { json } from "@sveltejs/kit";
import type { HlPortfolio } from "$lib/types/terminal";

const HL_API = "https://api.hyperliquid.xyz/info";

// Validate a hex Ethereum address (HL uses EVM addresses).
const RE_HL_ADDR = /^0x[0-9a-fA-F]{40}$/;

export async function GET({ url, fetch }) {
  const address = url.searchParams.get("address") ?? "";
  if (!RE_HL_ADDR.test(address)) {
    return json({ error: "Invalid HL address — expected 0x<40 hex chars>" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const [stateRes, histRes] = await Promise.all([
      fetch(HL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: address }),
        signal: controller.signal,
      }),
      fetch(HL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "portfolioHistory", user: address }),
        signal: controller.signal,
      }),
    ]);

    if (!stateRes.ok) {
      return json(
        { error: `HL API returned ${stateRes.status}` },
        { status: 502 },
      );
    }

    const state = await stateRes.json() as Record<string, unknown>;

    type RawPos = {
      position: {
        coin: string;
        szi: string;
        entryPx: string;
        unrealizedPnl: string;
        returnOnEquity?: string;
      };
    };

    const positions = ((state.assetPositions ?? []) as RawPos[])
      .filter((p) => Number(p.position.szi) !== 0)
      .map((p) => ({
        coin: p.position.coin,
        szi: Number(p.position.szi),
        entryPx: Number(p.position.entryPx),
        unrealizedPnl: Number(p.position.unrealizedPnl),
        returnOnEquity: Number(p.position.returnOnEquity ?? 0),
        side: Number(p.position.szi) > 0 ? ("long" as const) : ("short" as const),
      }));

    // portfolioHistory: array of [timestamp_ms, value_usd] pairs
    let pnlHistory: { t: number; v: number }[] = [];
    if (histRes.ok) {
      try {
        const histRaw = await histRes.json() as unknown;
        if (Array.isArray(histRaw)) {
          pnlHistory = histRaw
            .filter(
              (pt): pt is [number, number] =>
                Array.isArray(pt) && pt.length >= 2,
            )
            .map((pt) => ({ t: Number(pt[0]), v: Number(pt[1]) }))
            .slice(-60);
        }
      } catch {
        // history unavailable — leave empty
      }
    }

    const portfolio: HlPortfolio = {
      address,
      accountValue: Number((state.crossAccountValue as string | undefined) ?? (state.totalRawUsd as string | undefined) ?? 0),
      totalUnrealizedPnl: positions.reduce((s, p) => s + p.unrealizedPnl, 0),
      positions,
      pnlHistory,
    };

    return json(portfolio);
  } catch {
    return json({ error: "HL API unreachable" }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
