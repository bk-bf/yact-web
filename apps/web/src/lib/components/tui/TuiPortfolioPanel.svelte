<script lang="ts">
  import { browser } from "$app/environment";
  import TuiPanel from "./TuiPanel.svelte";
  import TuiPnlSparkline from "./TuiPnlSparkline.svelte";
  import LoadingDots from "$lib/components/LoadingDots.svelte";
  import type {
    HlPortfolio,
    SolPortfolio,
    PnlStats,
  } from "$lib/types/terminal";

  interface Props {
    hlAddress?: string | null;
    solAddress?: string | null;
  }

  let { hlAddress = null, solAddress = null }: Props = $props();

  // ── HL wallet state ─────────────────────────────────────────────────────────
  let hlPortfolio = $state<HlPortfolio | null>(null);
  let hlLoading = $state(false);
  let hlError = $state<string | null>(null);

  // ── SOL wallet state ────────────────────────────────────────────────────────
  let solPortfolio = $state<SolPortfolio | null>(null);
  let solLoading = $state(false);
  let solError = $state<string | null>(null);

  // ── HL derived ──────────────────────────────────────────────────────────────
  const hlPnlSeries = $derived(
    hlPortfolio?.pnlHistory?.map((pt) => pt.v) ?? [],
  );
  const hlPnlStats = $derived<PnlStats | null>(
    hlPortfolio
      ? {
          today: `${hlPortfolio.totalUnrealizedPnl >= 0 ? "+" : ""}$${Math.abs(hlPortfolio.totalUnrealizedPnl).toFixed(2)}`,
          total: `$${hlPortfolio.accountValue.toFixed(2)}`,
          maxDd: "—",
        }
      : null,
  );

  // ── SOL derived ─────────────────────────────────────────────────────────────
  const solTotalUsd = $derived(
    solPortfolio
      ? (solPortfolio.solPriceUsd ?? 0) * solPortfolio.solBalance +
          solPortfolio.tokens.reduce((s, t) => s + (t.valueUsd ?? 0), 0)
      : 0,
  );

  // ── Auto-fetch when addresses change ────────────────────────────────────────
  $effect(() => {
    if (!browser) return;
    if (!hlAddress) {
      hlPortfolio = null;
      hlError = null;
      return;
    }
    const addr = hlAddress;
    hlLoading = true;
    hlError = null;
    hlPortfolio = null;
    fetch(`/api/terminal/hl-portfolio?address=${encodeURIComponent(addr)}`)
      .then((r) => r.json())
      .then((d) => {
        if ((d as { error?: string }).error) {
          hlError = (d as { error: string }).error;
        } else {
          hlPortfolio = d as HlPortfolio;
        }
      })
      .catch(() => {
        hlError = "Network error — check your connection";
      })
      .finally(() => {
        hlLoading = false;
      });
  });

  $effect(() => {
    if (!browser) return;
    if (!solAddress) {
      solPortfolio = null;
      solError = null;
      return;
    }
    const addr = solAddress;
    solLoading = true;
    solError = null;
    solPortfolio = null;
    fetch(`/api/terminal/sol-portfolio?address=${encodeURIComponent(addr)}`)
      .then((r) => r.json())
      .then((d) => {
        if ((d as { error?: string }).error) {
          solError = (d as { error: string }).error;
        } else {
          solPortfolio = d as SolPortfolio;
        }
      })
      .catch(() => {
        solError = "Network error — check your connection";
      })
      .finally(() => {
        solLoading = false;
      });
  });

  function fmtUsd(v: number, decimals = 2): string {
    return `$${v.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }

  function shortenAddr(addr: string): string {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
</script>

<TuiPanel label="PORTFOLIO // WALLET TRACKER" grow>
  <!-- ══ HyperLiquid ════════════════════════════════════════════════════════ -->
  <div class="ws-section">
    <div class="ws-header">
      <span class="ws-icon">⬡</span>
      <span class="ws-name">HYPERLIQUID</span>
      {#if hlAddress}
        <span class="ws-addr">{shortenAddr(hlAddress)}</span>
      {/if}
    </div>

    {#if !hlAddress}
      <div class="ws-nocfg">no wallet — configure in <span class="ws-key">[s]</span> settings</div>
    {:else if hlLoading}
      <div class="ws-loading"><LoadingDots label="Fetching HL data" /></div>
    {:else if hlError}
      <div class="ws-error">{hlError}</div>
    {:else if hlPortfolio}
      <div class="hl-value">{fmtUsd(hlPortfolio.accountValue, 2)}</div>
      <div class="hl-pnl-row">
        <span class="muted">UNREALIZED</span>
        <span
          class:pos={hlPortfolio.totalUnrealizedPnl >= 0}
          class:neg={hlPortfolio.totalUnrealizedPnl < 0}
        >
          {hlPortfolio.totalUnrealizedPnl >= 0 ? "+" : ""}
          {fmtUsd(Math.abs(hlPortfolio.totalUnrealizedPnl))}
        </span>
      </div>

      {#if hlPortfolio.positions.length > 0}
        <div class="pos-hdr">
          <span>COIN</span><span>DIR/SZI</span><span>ENTRY</span><span>PNL</span
          >
        </div>
        {#each hlPortfolio.positions.slice(0, 8) as pos}
          <div class="pos-row">
            <span class="pos-coin">{pos.coin}</span>
            <span
              class:pos={pos.side === "long"}
              class:neg={pos.side === "short"}
            >
              {pos.side === "long" ? "▲" : "▼"}
              {Math.abs(pos.szi).toFixed(Math.abs(pos.szi) < 0.01 ? 6 : 4)}
            </span>
            <span class="muted"
              >${pos.entryPx.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}</span
            >
            <span
              class:pos={pos.unrealizedPnl >= 0}
              class:neg={pos.unrealizedPnl < 0}
            >
              {pos.unrealizedPnl >= 0 ? "+" : ""}
              {fmtUsd(Math.abs(pos.unrealizedPnl))}
            </span>
          </div>
        {/each}
      {:else}
        <div class="ws-empty">No open positions</div>
      {/if}

      {#if hlPnlSeries.length >= 3 && hlPnlStats}
        <TuiPnlSparkline pnlSeries={hlPnlSeries} stats={hlPnlStats} />
      {/if}
    {/if}
  </div>

  <div class="ws-divider"></div>

  <!-- ══ Solana / Jupiter ══════════════════════════════════════════════════ -->
  <div class="ws-section">
    <div class="ws-header">
      <span class="ws-icon">◎</span>
      <span class="ws-name">SOLANA / JUPITER</span>
      {#if solAddress}
        <span class="ws-addr">{shortenAddr(solAddress)}</span>
      {/if}
    </div>

    {#if !solAddress}
      <div class="ws-nocfg">no wallet — configure in <span class="ws-key">[s]</span> settings</div>
    {:else if solLoading}
      <div class="ws-loading"><LoadingDots label="Fetching Solana data" /></div>
    {:else if solError}
      <div class="ws-error">{solError}</div>
    {:else if solPortfolio}
      {#if solTotalUsd > 0}
        <div class="hl-value">{fmtUsd(solTotalUsd, 2)}</div>
      {/if}

      <div class="sol-row">
        <span class="sol-sym">SOL</span>
        <span>{solPortfolio.solBalance.toFixed(4)}</span>
        {#if solPortfolio.solPriceUsd}
          <span class="muted">
            {fmtUsd(solPortfolio.solBalance * solPortfolio.solPriceUsd)}
          </span>
        {/if}
      </div>

      {#each solPortfolio.tokens.slice(0, 6) as tok}
        <div class="sol-row">
          <span class="sol-sym">{tok.symbol}</span>
          <span>
            {tok.uiBalance.toLocaleString("en-US", {
              maximumFractionDigits: tok.decimals > 6 ? 4 : 2,
            })}
          </span>
          {#if tok.valueUsd !== null}
            <span class="muted">{fmtUsd(tok.valueUsd)}</span>
          {/if}
        </div>
      {/each}

      <div class="sol-footer">
        <span class="muted">RECENT TXS</span>
        <span>{solPortfolio.recentTxCount}</span>
      </div>
    {/if}
  </div>
</TuiPanel>

<style>
  .ws-section {
    padding-bottom: 0.2rem;
  }
  .ws-divider {
    height: 1px;
    background: rgba(176, 38, 255, 0.12);
    margin: 0.3rem 0;
  }
  .ws-header {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.15rem 0 0.2rem;
  }
  .ws-icon {
    color: rgba(176, 38, 255, 0.6);
    font-size: 0.72rem;
  }
  .ws-name {
    color: rgba(176, 38, 255, 0.72);
    font-size: 0.6rem;
    letter-spacing: 0.09em;
    flex: 1;
  }
  .ws-addr {
    color: rgba(200, 212, 207, 0.35);
    font-size: 0.6rem;
    font-family: monospace;
  }
  .ws-disc {
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255, 77, 87, 0.55);
    font-size: 0.65rem;
    padding: 0 0.1rem;
    line-height: 1;
  }
  .ws-disc:hover {
    color: #ff4d57;
  }
  .ws-input-row {
    display: flex;
    gap: 0.3rem;
    padding: 0.1rem 0 0.35rem;
  }
  .ws-input {
    flex: 1;
    min-width: 0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(176, 38, 255, 0.18);
    color: #c8d4cf;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.62rem;
    padding: 0.18rem 0.35rem;
    outline: none;
  }
  .ws-input:focus {
    border-color: rgba(176, 38, 255, 0.5);
  }
  .ws-input::placeholder {
    color: rgba(200, 212, 207, 0.25);
  }
  .ws-btn {
    background: rgba(176, 38, 255, 0.12);
    border: 1px solid rgba(176, 38, 255, 0.3);
    color: rgba(176, 38, 255, 0.85);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.58rem;
    letter-spacing: 0.07em;
    padding: 0.18rem 0.45rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .ws-btn:hover:not(:disabled) {
    background: rgba(176, 38, 255, 0.22);
    color: rgba(176, 38, 255, 1);
  }
  .ws-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
    padding: 0.4rem 0;
  }
  :global(.ws-loading .loading-dots) {
    padding: 0.4rem 0;
    justify-content: flex-start;
  }
  .ws-error {
    color: #ff4d57;
    font-size: 0.62rem;
    padding: 0.2rem 0;
    line-height: 1.4;
  }
  .ws-empty {
    color: rgba(200, 212, 207, 0.3);
    font-size: 0.62rem;
    padding: 0.2rem 0;
  }
  .hl-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1ddf72;
    line-height: 1.1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    text-shadow:
      0 0 18px rgba(29, 223, 114, 0.35),
      0 0 40px rgba(29, 223, 114, 0.1);
    padding-bottom: 0.1rem;
  }
  .hl-pnl-row {
    display: flex;
    gap: 0.5rem;
    font-size: 0.63rem;
    padding-bottom: 0.2rem;
    font-variant-numeric: tabular-nums;
  }
  .pos-hdr,
  .pos-row {
    display: grid;
    grid-template-columns: 5ch 1fr 6ch 6ch;
    gap: 0.25rem;
    padding: 0.06rem 0;
    align-items: baseline;
  }
  .pos-hdr {
    color: rgba(176, 38, 255, 0.45);
    font-size: 0.57rem;
    letter-spacing: 0.08em;
    padding-bottom: 0.12rem;
    border-bottom: 1px solid rgba(176, 38, 255, 0.08);
    margin-bottom: 0.05rem;
  }
  .pos-coin {
    color: #c8d4cf;
    font-size: 0.65rem;
  }
  .pos-row span {
    font-variant-numeric: tabular-nums;
    font-size: 0.65rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sol-row {
    display: grid;
    grid-template-columns: 6ch 1fr auto;
    gap: 0.3rem;
    padding: 0.07rem 0;
    align-items: baseline;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    font-size: 0.65rem;
    font-variant-numeric: tabular-nums;
  }
  .sol-sym {
    color: rgba(200, 212, 207, 0.55);
  }
  .sol-footer {
    display: flex;
    gap: 0.4rem;
    font-size: 0.6rem;
    padding-top: 0.2rem;
    font-variant-numeric: tabular-nums;
  }
  .pos {
    color: #1ddf72;
  }
  .neg {
    color: #ff4d57;
  }
  .muted {
    color: rgba(200, 212, 207, 0.35);
  }
</style>
