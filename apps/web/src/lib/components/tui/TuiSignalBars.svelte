<script lang="ts">
  import TuiPanel from "./TuiPanel.svelte";
  import type { BarItem } from "$lib/types/terminal";

  interface Props {
    bars: BarItem[];
  }

  let { bars }: Props = $props();
</script>

<TuiPanel label="SIGNAL STRENGTH" grow>
  {#each bars as b}
    <div class="bar-row">
      <span class="bar-l">{b.l}</span>
      <span class="bar-track"><span class="bar-fill" style="width:{b.pct}%"></span></span>
      <span class="bar-pct" class:pos={b.pct >= 70} class:warn={b.pct >= 50 && b.pct < 70} class:neg={b.pct < 50}>{b.pct}%</span>
    </div>
  {/each}
</TuiPanel>

<style>
  .bar-row {
    display: grid;
    grid-template-columns: 9ch 1fr 4ch;
    align-items: center;
    gap: 0.35rem;
    padding: 0.12rem 0;
  }
  .bar-l     { color: rgba(200, 212, 207, 0.48); font-size: 0.63rem; }
  .bar-pct   { text-align: right; font-size: 0.63rem; font-variant-numeric: tabular-nums; }
  .bar-track { height: 3px; background: rgba(255, 255, 255, 0.06); position: relative; overflow: hidden; }
  .bar-fill  {
    position: absolute; inset-block: 0; left: 0;
    background: #b026ff;
    box-shadow: 0 0 4px rgba(176, 38, 255, 0.5);
    transition: width 0.4s;
  }
  .pos  { color: #1ddf72; }
  .neg  { color: #ff4d57; }
  .warn { color: #f5a623; }
</style>
