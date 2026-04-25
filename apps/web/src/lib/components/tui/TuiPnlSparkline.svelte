<script lang="ts">
  import TuiPanel from "./TuiPanel.svelte";
  import type { PnlStats } from "$lib/types/terminal";

  interface Props {
    pnlSeries: number[];
    stats: PnlStats;
  }

  let { pnlSeries, stats }: Props = $props();

  const blocks = "▁▂▃▄▅▆▇█";
  const CHART_ROWS = 4;

  const sparkRows = $derived.by(() => {
    const mn = Math.min(...pnlSeries);
    const mx = Math.max(...pnlSeries);
    const rng = mx - mn || 1;
    const step = Math.ceil(pnlSeries.length / 40);
    const sampled = pnlSeries.filter((_, i) => i % step === 0);
    const totalLevels = CHART_ROWS * 8;
    const heights = sampled.map(v => Math.round((v - mn) / rng * (totalLevels - 1)));
    const rows: string[] = [];
    for (let r = CHART_ROWS - 1; r >= 0; r--) {
      let line = '';
      for (const h of heights) {
        const fill = Math.min(8, h - r * 8);
        line += fill <= 0 ? ' ' : blocks[fill - 1];
      }
      rows.push(line);
    }
    return rows;
  });
</script>

<TuiPanel label="PNL CURVE // {pnlSeries.length} SESSIONS">
  <div class="spark-chart">
    {#each sparkRows as row}
      <div class="spark-row">{row}</div>
    {/each}
  </div>
  <div class="spark-stats">
    <div class="spark-stat"><span class="muted">TODAY</span> <span class="pos">{stats.today}</span></div>
    <div class="spark-stat"><span class="muted">TOTAL</span> <span class="pos">{stats.total}</span></div>
    <div class="spark-stat"><span class="muted">MAX DD</span> <span class="neg">{stats.maxDd}</span></div>
  </div>
</TuiPanel>

<style>
  .spark-chart {
    font-size: 0.85rem;
    font-family: monospace;
    letter-spacing: -0.05em;
    color: #1ddf72;
    padding: 0.5rem 0 0.3rem;
    text-shadow: 0 0 6px rgba(29, 223, 114, 0.4);
  }
  .spark-row   { white-space: pre; line-height: 1; }
  .spark-stats { display: flex; gap: 1rem; padding-top: 0.3rem; flex-wrap: wrap; }
  .spark-stat  { display: flex; gap: 0.3rem; font-size: 0.63rem; }
  .muted { color: rgba(200, 212, 207, 0.35); }
  .pos   { color: #1ddf72; }
  .neg   { color: #ff4d57; }
</style>
