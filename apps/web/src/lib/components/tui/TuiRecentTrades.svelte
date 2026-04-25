<script lang="ts">
  import TuiPanel from "./TuiPanel.svelte";
  import type { Trade } from "$lib/types/terminal";

  interface Props {
    trades: Trade[];
  }

  let { trades }: Props = $props();
</script>

<TuiPanel label="RECENT TRADES // LAST {trades.length}">
  <div class="trades-hdr">
    <span>TIME</span><span>DUR</span><span>LAG</span><span>P&L</span><span
      >RESULT</span
    >
  </div>
  {#each trades as t}
    <div class="trade-row">
      <span>{t.ts}</span>
      <span>{t.dur}</span>
      <span>{t.lag}</span>
      <span class:pos={t.win} class:neg={!t.win}>{t.pnl}</span>
      <span class:pos={t.win} class:neg={!t.win}>{t.win ? "WIN" : "LOSS"}</span>
    </div>
  {/each}
</TuiPanel>

<style>
  .trades-hdr,
  .trade-row {
    display: grid;
    grid-template-columns: 8ch 6ch 5ch 6ch 5ch;
    gap: 0.45rem;
    padding: 0.07rem 0;
    line-height: 1.55;
  }
  .trades-hdr {
    color: rgba(176, 38, 255, 0.58);
    font-size: 0.59rem;
    letter-spacing: 0.08em;
    padding-bottom: 0.2rem;
    border-bottom: 1px solid rgba(176, 38, 255, 0.1);
    margin-bottom: 0.15rem;
  }
  .trade-row {
    color: rgba(200, 212, 207, 0.62);
    font-variant-numeric: tabular-nums;
  }
  .pos {
    color: #1ddf72;
  }
  .neg {
    color: #ff4d57;
  }
</style>
