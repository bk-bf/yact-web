<script lang="ts">
  import TuiPanel from "./TuiPanel.svelte";
  import type { Position } from "$lib/types/terminal";

  interface Props {
    positions: Position[];
  }

  let { positions }: Props = $props();
</script>

<TuiPanel label="POSITIONS // {positions.length}">
  {#each positions as p}
    <div class="pos-row">
      <span class="pos-pair">{p.pair}</span>
      <span class="pos-price">{p.price}</span>
      <span class="pos-pnl" class:pos={p.dir > 0} class:neg={p.dir < 0}
        >{p.pnl}</span
      >
      <span class="pos-dir" class:pos={p.dir > 0} class:neg={p.dir < 0}
        >{p.dir > 0 ? "▲" : "▼"}</span
      >
    </div>
  {/each}
</TuiPanel>

<style>
  .pos-row {
    display: grid;
    grid-template-columns: 7ch 7ch 1fr 1.5ch;
    gap: 0.25rem;
    padding: 0.1rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    line-height: 1.55;
  }
  .pos-pair {
    color: #c8d4cf;
    font-size: 0.65rem;
  }
  .pos-price {
    color: rgba(200, 212, 207, 0.5);
  }
  .pos-pnl {
    font-variant-numeric: tabular-nums;
  }
  .pos-dir {
    text-align: right;
  }
  .pos {
    color: #1ddf72;
  }
  .neg {
    color: #ff4d57;
  }
</style>
