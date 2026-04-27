<script lang="ts">
  import TuiPanel from "./TuiPanel.svelte";
  import LoadingDots from "$lib/components/LoadingDots.svelte";
  import type { BarItem } from "$lib/types/terminal";

  interface Props {
    bars: BarItem[];
    loading?: boolean;
  }

  let { bars, loading = false }: Props = $props();
</script>

<TuiPanel label="SIGNAL STRENGTH" grow>
  {#if loading}
    <LoadingDots label="Loading signal bars" />
  {:else}
    {#each bars as b}
      <div class="bar-row" title={b.raw ?? ""}>
        <span class="bar-l">
          {b.l}
          {#if b.source === "live"}
            <span class="bar-live">●</span>
          {/if}
        </span>
        <span class="bar-track"
          ><span class="bar-fill" style="width:{b.pct}%"></span></span
        >
        <span
          class="bar-pct"
          class:pos={b.pct >= 70}
          class:warn={b.pct >= 50 && b.pct < 70}
          class:neg={b.pct < 50}>{b.pct}%</span
        >
      </div>
    {/each}
  {/if}
</TuiPanel>

<style>
  .bar-row {
    display: grid;
    grid-template-columns: 9ch 1fr 4ch;
    align-items: center;
    gap: 0.35rem;
    padding: 0.12rem 0;
  }
  .bar-l {
    color: rgba(200, 212, 207, 0.48);
    font-size: 0.63rem;
  }
  .bar-live {
    color: #1ddf72;
    font-size: 0.5rem;
    vertical-align: middle;
  }
  .bar-pct {
    text-align: right;
    font-size: 0.63rem;
    font-variant-numeric: tabular-nums;
  }
  .bar-track {
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    position: relative;
    overflow: hidden;
  }
  .bar-fill {
    position: absolute;
    inset-block: 0;
    left: 0;
    background: #b026ff;
    box-shadow: 0 0 4px rgba(176, 38, 255, 0.5);
    transition: width 0.4s;
  }
  .pos {
    color: #1ddf72;
  }
  .neg {
    color: #ff4d57;
  }
  .warn {
    color: #f5a623;
  }
</style>
