<script lang="ts">
  import TuiPanel from "./TuiPanel.svelte";
  import type { Portfolio } from "$lib/types/terminal";

  interface Props {
    portfolio: Portfolio;
  }

  let { portfolio }: Props = $props();
</script>

<TuiPanel label="PORTFOLIO // LIVE">
  <div class="port-body">
    <div class="port-hero">
      <div class="port-value">{portfolio.value}</div>
      <span class="port-badge pos">{portfolio.badge}</span>
    </div>
    {#each portfolio.rows as r}
      <div class="port-row">
        <span class="port-label">{r.k}</span>
        <span class="port-pnl {r.c}">{r.v}</span>
        <span class="port-sub">{r.sub}</span>
      </div>
    {/each}
  </div>
</TuiPanel>

<style>
  .port-body {
    padding: 0.4rem 0.55rem 0.4rem;
  }
  .port-hero {
    display: flex;
    align-items: baseline;
    gap: 0.55rem;
    padding-bottom: 0.15rem;
  }
  .port-value {
    font-size: 2.1rem;
    font-weight: 700;
    color: #1ddf72;
    line-height: 1.05;
    letter-spacing: -0.03em;
    text-shadow:
      0 0 22px rgba(29, 223, 114, 0.38),
      0 0 50px rgba(29, 223, 114, 0.12);
    font-variant-numeric: tabular-nums;
  }
  .port-badge {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 2px;
    color: #000;
  }
  .port-badge.pos {
    background: #1ddf72;
    color: #000;
  }
  .port-badge.neg {
    background: #ff4d57;
    color: #fff;
  }
  .port-row {
    display: grid;
    grid-template-columns: 5ch 1fr auto;
    gap: 0.25rem;
    padding: 0.1rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    align-items: baseline;
  }
  .port-label {
    color: rgba(200, 212, 207, 0.38);
    font-size: 0.62rem;
  }
  .port-pnl {
    font-variant-numeric: tabular-nums;
    font-size: 0.72rem;
  }
  .port-sub {
    color: rgba(200, 212, 207, 0.35);
    font-size: 0.62rem;
    text-align: right;
  }
  .pos {
    color: #1ddf72;
  }
  .neg {
    color: #ff4d57;
  }
</style>
