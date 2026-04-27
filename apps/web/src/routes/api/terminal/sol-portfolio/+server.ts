import { json } from "@sveltejs/kit";
import type { SolPortfolio, SolTokenBalance } from "$lib/types/terminal";

// SPL Token program ID
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
// Wrapped SOL mint — used to price native SOL via Jupiter
const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_PRICE_API = "https://api.jup.ag/price/v2";

// Base58 Solana public key: 32–44 chars from the base58 alphabet
const RE_SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET({ url, fetch }) {
  const address = url.searchParams.get("address") ?? "";
  if (!RE_SOL_ADDR.test(address)) {
    return json({ error: "Invalid Solana address" }, { status: 400 });
  }

  const rpcUrl =
    process.env.PUBLIC_SOLANA_RPC_URL ?? process.env.SOLANA_RPC_URL ?? "";
  if (!rpcUrl) {
    return json(
      {
        error:
          "Solana RPC not configured — set PUBLIC_SOLANA_RPC_URL in your .env (use a Helius or Triton endpoint, not api.mainnet-beta.solana.com)",
      },
      { status: 503 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
    const r = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`RPC ${method} HTTP ${r.status}`);
    const d = (await r.json()) as {
      result?: unknown;
      error?: { message: string };
    };
    if (d.error) throw new Error(d.error.message);
    return d.result;
  }

  try {
    const [balanceResult, tokenResult] = await Promise.all([
      rpcCall("getBalance", [address]),
      rpcCall("getTokenAccountsByOwner", [
        address,
        { programId: TOKEN_PROGRAM_ID },
        { encoding: "jsonParsed" },
      ]),
    ]);

    const solBalance =
      ((balanceResult as { value?: number }) ?? {}).value ?? 0 / 1e9;

    type TokenAccount = {
      account?: {
        data?: {
          parsed?: {
            info?: {
              mint?: string;
              tokenAmount?: {
                uiAmount?: number;
                decimals?: number;
              };
            };
          };
        };
      };
    };

    const rawTokens: { mint: string; uiBalance: number; decimals: number }[] = (
      ((tokenResult as { value?: TokenAccount[] }) ?? {}).value ?? []
    )
      .map((ta) => {
        const info = ta.account?.data?.parsed?.info;
        const mint = info?.mint;
        const amt = info?.tokenAmount;
        if (!mint || !amt || (amt.uiAmount ?? 0) === 0) return null;
        return {
          mint,
          uiBalance: amt.uiAmount ?? 0,
          decimals: amt.decimals ?? 0,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .slice(0, 20);

    // Fetch prices for SOL + all token mints from Jupiter
    const mintIds = [SOL_MINT, ...rawTokens.map((t) => t.mint)].join(",");
    type JupPriceEntry = { price: string; type?: string };
    let prices: Record<string, JupPriceEntry> = {};
    try {
      const pr = await fetch(`${JUPITER_PRICE_API}?ids=${mintIds}`, {
        signal: controller.signal,
      });
      if (pr.ok) {
        const pd = (await pr.json()) as {
          data?: Record<string, JupPriceEntry>;
        };
        prices = pd.data ?? {};
      }
    } catch {
      // price API unavailable — continue without prices
    }

    const solPriceUsd = prices[SOL_MINT]
      ? Number(prices[SOL_MINT].price)
      : null;

    const tokens: SolTokenBalance[] = rawTokens.map((t) => {
      const p = prices[t.mint];
      const priceUsd = p ? Number(p.price) : null;
      return {
        mint: t.mint,
        symbol: p?.type ?? t.mint.slice(0, 6) + "…",
        balance: t.uiBalance,
        uiBalance: t.uiBalance,
        decimals: t.decimals,
        priceUsd,
        valueUsd: priceUsd !== null ? priceUsd * t.uiBalance : null,
      };
    });

    tokens.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

    // Fetch recent transaction signatures (best-effort)
    let recentTxCount = 0;
    try {
      const sigs = await rpcCall("getSignaturesForAddress", [
        address,
        { limit: 10 },
      ]);
      recentTxCount = Array.isArray(sigs) ? sigs.length : 0;
    } catch {
      // not critical
    }

    const portfolio: SolPortfolio = {
      address,
      solBalance:
        Number((balanceResult as { value?: number }).value ?? 0) / 1e9,
      solPriceUsd,
      tokens,
      recentTxCount,
    };

    return json(portfolio);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Solana fetch failed";
    return json({ error: msg }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
