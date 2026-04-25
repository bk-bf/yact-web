<script lang="ts">
  import TuiPanel from "./TuiPanel.svelte";
  import type { PnlStats } from "$lib/types/terminal";

  interface Props {
    pnlSeries: number[];
    stats: PnlStats;
  }

  let { pnlSeries, stats }: Props = $props();

  const blocks = "▁▂▃▄▅▆▇█";

  const sparkline = $derived.by(() => {
    const mn  = Math.min(...pnlSeries);
    const mx  = Math.max(...pnlSeries);
    const rng = mx - mn || 1;
    const step = Math.ceil(pnlSeries.length / 40);
    const sampled = pnlSeries.filter((_, i) => i % step === 0);
    return sampled.map(v => blocks[Math.round(((v - mn) / rng) * 7)]).join("");
  });
</script>

<TuiPanel label="PNL CURVE // {pnlSeries.length} SESSIONS">
  <div class="spark-line">{sparkline}</div>
  <div class="spark-stats">
    <div class="spark-stat"><span class="muted">TODAY</span> <span class="pos">{stats.today}</span></div>
    <div class="spark-stat"><span class="muted">TOTAL</span> <span class="pos">{stats.total}</span></div>
    <div class="spark-stat"><span class="muted">MAX DD</span> <span class="neg">{stats.maxDd}</span></div>
  </div>
</TuiPanel>

<style>
  .spark-line {
    font-size: 0.85rem;
    letter-spacing: -0.05em;
    color: #1ddf72;
    padding: 0.5rem 0 0.3rem;
    line-height: 1;
    word-break: break-all;
    text-shadow: 0 0 6px rgba(29, 223, 114, 0.4);
  }
  .spark-stats { display: flex; gap: 1rem; padding-top: 0.3rem; flex-wrap: wrap; }
  .spark-stat  { display: flex; gap: 0.3rem; font-size: 0.63rem; }
  .muted { color: rgba(200, 212, 207, 0.35); }
  .pos   { color: #1ddf72; }
  .neg   { color: #ff4d57; }
</style>
