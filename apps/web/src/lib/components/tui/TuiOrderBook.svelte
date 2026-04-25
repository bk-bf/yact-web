<script lang="ts">
  import TuiPanel from "./TuiPanel.svelte";
  import type { OBLevel, OrderBookSpread } from "$lib/types/terminal";

  interface Props {
    asks: OBLevel[];
    bids: OBLevel[];
    spread: OrderBookSpread;
    pair?: string;
  }

  let { asks, bids, spread, pair = "BTC/USD" }: Props = $props();
</script>

<TuiPanel label="ORDER BOOK // {pair}">
  <div class="ob-hdr"><span>PRICE</span><span>DEPTH</span><span>SIZE</span></div>
  {#each [...asks].reverse() as lvl}
    <div class="ob-row">
      <span class="ob-price neg">{lvl.price}</span>
      <span class="ob-bar-wrap"><span class="ob-bar ask-bar" style="width:{lvl.depth}%"></span></span>
      <span class="ob-size">{lvl.size}</span>
    </div>
  {/each}
  <div class="ob-spread">
    <span>─────</span>
    <span class="spread-mid">{spread.last} <span class="muted">LAST</span></span>
    <span>SPRD {spread.sprd}</span>
  </div>
  {#each bids as lvl}
    <div class="ob-row">
      <span class="ob-price pos">{lvl.price}</span>
      <span class="ob-bar-wrap"><span class="ob-bar bid-bar" style="width:{lvl.depth}%"></span></span>
      <span class="ob-size">{lvl.size}</span>
    </div>
  {/each}
</TuiPanel>

<style>
  .ob-hdr,
  .ob-row {
    display: grid;
    grid-template-columns: 7ch 1fr 5ch;
    gap: 0.3rem;
    padding: 0.06rem 0;
    align-items: center;
    line-height: 1.55;
  }
  .ob-hdr {
    color: rgba(176, 38, 255, 0.58);
    font-size: 0.59rem;
    letter-spacing: 0.08em;
    padding-bottom: 0.15rem;
    border-bottom: 1px solid rgba(176, 38, 255, 0.1);
    margin-bottom: 0.1rem;
  }
  .ob-price    { font-variant-numeric: tabular-nums; font-size: 0.67rem; }
  .ob-bar-wrap { height: 3px; background: rgba(255, 255, 255, 0.05); position: relative; overflow: hidden; }
  .ob-bar      { position: absolute; inset-block: 0; height: 100%; }
  .ask-bar     { background: rgba(255, 77, 87, 0.55); right: 0; left: auto; }
  .bid-bar     { background: rgba(29, 223, 114, 0.45); left: 0; }
  .ob-size     { color: rgba(200, 212, 207, 0.38); font-size: 0.62rem; text-align: right; }
  .ob-spread {
    display: flex;
    justify-content: space-between;
    padding: 0.22rem 0;
    color: rgba(176, 38, 255, 0.5);
    font-size: 0.62rem;
    border-top: 1px solid rgba(176, 38, 255, 0.08);
    border-bottom: 1px solid rgba(176, 38, 255, 0.08);
    margin: 0.08rem 0;
  }
  .spread-mid { color: #edf5f1; font-weight: 600; }
  .muted { color: rgba(200, 212, 207, 0.35); }
  .pos   { color: #1ddf72; }
  .neg   { color: #ff4d57; }
</style>
