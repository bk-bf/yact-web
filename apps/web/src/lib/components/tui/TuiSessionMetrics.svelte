<script lang="ts">
  import TuiPanel from "./TuiPanel.svelte";
  import type { MetricItem } from "$lib/types/terminal";

  interface Props {
    metrics: MetricItem[];
  }

  let { metrics }: Props = $props();
</script>

<TuiPanel label="SESSION METRICS">
  {#each metrics as m}
    <div class="metric-row">
      <span class="metric-k">{m.k}</span>
      <span class="metric-v {m.c}">{m.v}</span>
    </div>
  {/each}
</TuiPanel>

<style>
  .metric-row {
    display: flex;
    justify-content: space-between;
    padding: 0.1rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    line-height: 1.55;
  }
  .metric-k { color: rgba(200, 212, 207, 0.42); font-size: 0.63rem; letter-spacing: 0.06em; }
  .metric-v { font-variant-numeric: tabular-nums; }
  :global(.pos) { color: #1ddf72; }
  :global(.neg) { color: #ff4d57; }
  :global(.warn) { color: #f5a623; }
</style>
