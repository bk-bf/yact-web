<script lang="ts">
  import type { MissingClarity } from "../../routes/dashboard/+page.js";

  interface Props {
    missingClarity: MissingClarity | undefined;
    chartTimeframes: string[] | undefined;
  }

  let { missingClarity, chartTimeframes }: Props = $props();
</script>

<div class="cd-root">
  {#if missingClarity}
    <!-- ── Summary line ─────────────────────────────────────────────────── -->
    <div class="cd-row">
      <span class="cd-k">expected</span>
      <span class="cd-v">{missingClarity.expectedCoins}</span>
    </div>
    <div class="cd-row">
      <span class="cd-k">fully populated</span>
      <span
        class="cd-v"
        style="color:{missingClarity.fullyPopulatedCoins ===
        missingClarity.expectedCoins
          ? 'var(--status-ok)'
          : 'var(--tv-text-primary)'};"
        >{missingClarity.fullyPopulatedCoins}</span
      >
    </div>
    <div class="cd-row">
      <span class="cd-k">partial</span>
      <span
        class="cd-v"
        style="color:{missingClarity.coinsWithAnyMissingItems > 0
          ? 'var(--status-warn)'
          : 'var(--status-ok)'};"
        >{missingClarity.coinsWithAnyMissingItems}</span
      >
    </div>
    <div class="cd-row">
      <span class="cd-k">completely missing</span>
      <span
        class="cd-v"
        style="color:{missingClarity.completelyMissingCoins > 0
          ? 'var(--status-error)'
          : 'var(--tv-text-muted)'};"
        >{missingClarity.completelyMissingCoins}</span
      >
    </div>
    {#if chartTimeframes && chartTimeframes.length > 0}
      <div class="cd-row">
        <span class="cd-k">timeframes</span>
        <span class="cd-v cd-v-sm">{chartTimeframes.join(",")}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .cd-root {
    display: flex;
    flex-direction: column;
    font-family: inherit;
    min-width: 0;
    width: 100%;
  }

  .cd-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 0.4rem;
    align-items: baseline;
    padding: 0.08rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }
  .cd-row:last-child {
    border-bottom: none;
  }

  .cd-k {
    color: rgba(200, 212, 207, 0.5);
    font-size: 0.62rem;
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cd-v {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--tv-text-primary);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .cd-v-sm {
    font-size: 0.6rem;
    font-weight: 500;
    color: var(--tv-text-muted);
  }
</style>
