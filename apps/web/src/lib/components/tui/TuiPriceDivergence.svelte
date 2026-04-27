<script lang="ts">
  import TuiPanel from "./TuiPanel.svelte";
  import LoadingDots from "$lib/components/LoadingDots.svelte";
  import type { PriceDivRow } from "$lib/types/terminal";

  interface Props {
    coins: Record<string, PriceDivRow[]>;
    loading?: boolean;
  }

  let { coins, loading = false }: Props = $props();

  const COIN_LABELS: Record<string, string> = {
    bitcoin: "BTC",
    ethereum: "ETH",
  };

  const coinEntries = $derived(
    Object.entries(coins).filter(([, rows]) => rows.length > 0),
  );

  function fmtPrice(p: number): string {
    if (p >= 1000)
      return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (p >= 1)
      return p.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    return p.toFixed(4);
  }

  function fmtPct(p: number): string {
    const sign = p >= 0 ? "+" : "";
    return `${sign}${p.toFixed(3)}%`;
  }

  function pctClass(p: number): string {
    if (p > 0.01) return "pos";
    if (p < -0.01) return "neg";
    return "muted";
  }
</script>

<TuiPanel label="PRICE DIVERGENCE // BTC·ETH">
  {#if loading}
    <LoadingDots label="Loading price divergence" />
  {:else if coinEntries.length === 0}
    <div class="pd-empty">No exchange price data available</div>
  {:else}
    {#each coinEntries as [coinId, rows]}
      <div class="pd-coin-label">{COIN_LABELS[coinId] ?? coinId}</div>
      <div class="pd-hdr">
        <span>EXCHANGE</span><span>PRICE</span><span>VS MID</span>
      </div>
      {#each rows as row}
        <div class="pd-row">
          <span class="pd-exch">{row.exchange}</span>
          <span class="pd-price">${fmtPrice(row.price)}</span>
          <span class="pd-pct {pctClass(row.pctFromMid)}"
            >{row.pctFromMid !== 0 ? fmtPct(row.pctFromMid) : "—"}</span
          >
        </div>
      {/each}
      {#if rows.length >= 2}
        {@const prices = rows.map((r) => r.price)}
        {@const spread = Math.max(...prices) - Math.min(...prices)}
        <div class="pd-spread">
          SPREAD&nbsp;<span class="pd-spread-val">${fmtPrice(spread)}</span>
        </div>
      {/if}
    {/each}
  {/if}
</TuiPanel>

<style>
  .pd-empty {
    color: rgba(200, 212, 207, 0.3);
    font-size: 0.63rem;
    padding: 0.4rem 0;
  }
  .pd-coin-label {
    color: rgba(176, 38, 255, 0.7);
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    padding: 0.3rem 0 0.1rem;
    border-top: 1px solid rgba(176, 38, 255, 0.06);
  }
  .pd-coin-label:first-child {
    border-top: none;
    padding-top: 0;
  }
  .pd-hdr,
  .pd-row {
    display: grid;
    grid-template-columns: 10ch 1fr 6ch;
    gap: 0.3rem;
    padding: 0.05rem 0;
    align-items: center;
  }
  .pd-hdr {
    color: rgba(176, 38, 255, 0.45);
    font-size: 0.58rem;
    letter-spacing: 0.07em;
    padding-bottom: 0.1rem;
    border-bottom: 1px solid rgba(176, 38, 255, 0.08);
    margin-bottom: 0.05rem;
  }
  .pd-exch {
    color: rgba(200, 212, 207, 0.5);
    font-size: 0.64rem;
  }
  .pd-price {
    font-variant-numeric: tabular-nums;
    font-size: 0.68rem;
    color: #c8d4cf;
  }
  .pd-pct {
    text-align: right;
    font-size: 0.63rem;
    font-variant-numeric: tabular-nums;
  }
  .pd-spread {
    font-size: 0.6rem;
    color: rgba(200, 212, 207, 0.32);
    padding: 0.12rem 0 0.25rem;
    letter-spacing: 0.05em;
  }
  .pd-spread-val {
    color: rgba(200, 212, 207, 0.55);
  }
  .pos {
    color: #1ddf72;
  }
  .neg {
    color: #ff4d57;
  }
  .muted {
    color: rgba(200, 212, 207, 0.32);
  }
</style>
