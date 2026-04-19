<script lang="ts">
  import type {
    MissingClarity,
    MetadataStage,
    PriceTier,
  } from "../../routes/dashboard/+page.js";

  interface Props {
    missingClarity: MissingClarity | undefined;
    metadataStage: MetadataStage | undefined;
    chartTimeframes: string[] | undefined;
    totalCoins: number;
    priceTier: PriceTier | undefined;
  }

  let {
    missingClarity,
    metadataStage,
    chartTimeframes,
    totalCoins,
    priceTier,
  }: Props = $props();

  // Group top-missing fields into breakdown vs charts buckets
  const fieldGroups = $derived(
    (): { breakdown: [string, number][]; charts: [string, number][] } => {
      const entries = Object.entries(
        missingClarity?.topMissingItemsByField ?? {},
      );
      return {
        breakdown: entries.filter(([k]) => k.startsWith("breakdown.")),
        charts: entries.filter(([k]) => k.startsWith("charts.")),
      };
    },
  );

  // Friendly label for a field key like "breakdown.categories" → "categories"
  function fieldLabel(key: string): string {
    return key.split(".").slice(1).join(".");
  }

  // Bar width percentage capped at 100
  function barPct(missing: number): number {
    if (!totalCoins || totalCoins === 0) return 0;
    return Math.min(100, Math.round((missing / totalCoins) * 100));
  }

  function bucketColor(bucket: string): string {
    switch (bucket) {
      case "fresh":
        return "var(--status-ok)";
      case "warning":
        return "var(--status-warn)";
      case "stale":
        return "var(--status-error)";
      default:
        return "var(--tv-text-muted)";
    }
  }
</script>

<div class="coverage-detail">
  <!-- ── Summary row ──────────────────────────────────────────────────────── -->
  {#if missingClarity}
    <div class="summary-row">
      <div class="summary-stat">
        <span class="stat-label">Expected coins</span>
        <span class="stat-value">{missingClarity.expectedCoins}</span>
      </div>
      <div class="summary-stat">
        <span class="stat-label">Fully populated</span>
        <span
          class="stat-value"
          style="color: {missingClarity.fullyPopulatedCoins ===
          missingClarity.expectedCoins
            ? 'var(--status-ok)'
            : 'var(--tv-text-primary)'};"
        >
          {missingClarity.fullyPopulatedCoins}
        </span>
      </div>
      <div class="summary-stat">
        <span class="stat-label">Partially missing</span>
        <span
          class="stat-value"
          style="color: {missingClarity.coinsWithAnyMissingItems > 0
            ? 'var(--status-warn)'
            : 'var(--status-ok)'};"
        >
          {missingClarity.coinsWithAnyMissingItems}
        </span>
      </div>
      <div class="summary-stat">
        <span class="stat-label">Completely missing</span>
        <span
          class="stat-value"
          style="color: {missingClarity.completelyMissingCoins > 0
            ? 'var(--status-error)'
            : 'var(--tv-text-muted)'};"
        >
          {missingClarity.completelyMissingCoins}
        </span>
      </div>
      {#if chartTimeframes}
        <div class="summary-stat">
          <span class="stat-label">Chart timeframes</span>
          <span class="stat-value">{chartTimeframes.join(", ")}</span>
        </div>
      {/if}
    </div>

    <!-- ── Top missing fields ─────────────────────────────────────────────── -->
    <div class="fields-grid">
      {#if fieldGroups().breakdown.length > 0}
        <div class="field-group">
          <h4 class="field-group-title">Breakdown fields missing</h4>
          <ul class="field-list">
            {#each fieldGroups().breakdown as [key, count] (key)}
              <li class="field-row">
                <span class="field-name">{fieldLabel(key)}</span>
                <div class="field-bar-track">
                  <div
                    class="field-bar-fill"
                    style="width: {barPct(count)}%; background: {barPct(count) >
                    80
                      ? 'var(--status-error)'
                      : barPct(count) > 50
                        ? 'var(--status-warn)'
                        : 'var(--tv-highlight)'};"
                  ></div>
                </div>
                <span class="field-count">{count} / {totalCoins}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if fieldGroups().charts.length > 0}
        <div class="field-group">
          <h4 class="field-group-title">Chart timeframes missing</h4>
          <ul class="field-list">
            {#each fieldGroups().charts as [key, count] (key)}
              <li class="field-row">
                <span class="field-name">{fieldLabel(key)}</span>
                <div class="field-bar-track">
                  <div
                    class="field-bar-fill"
                    style="width: {barPct(count)}%; background: {barPct(count) >
                    80
                      ? 'var(--status-error)'
                      : barPct(count) > 50
                        ? 'var(--status-warn)'
                        : 'var(--tv-highlight)'};"
                  ></div>
                </div>
                <span class="field-count">{count} / {totalCoins}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if priceTier}
        <div class="field-group">
          <h4 class="field-group-title">Price fields</h4>
          <ul class="field-list">
            {#each [{ label: "price", value: priceTier.currentPrice }, { label: "symbol", value: priceTier.symbol }, { label: "name", value: priceTier.name }, { label: "market cap", value: priceTier.marketCap }, { label: "rank", value: priceTier.marketCapRank }, { label: "volume 24h", value: priceTier.volume24h }, { label: "Δ price 24h", value: priceTier.priceChange24h }] as col (col.label)}
              {@const pct =
                priceTier.totalCoins > 0
                  ? Math.round((col.value / priceTier.totalCoins) * 100)
                  : 0}
              <li class="field-row">
                <span class="field-name">{col.label}</span>
                <div class="field-bar-track">
                  <div
                    class="field-bar-fill"
                    style="width: {pct}%; background: {pct >= 90
                      ? 'var(--status-ok)'
                      : pct >= 50
                        ? 'var(--status-warn)'
                        : 'var(--status-error)'};"
                  ></div>
                </div>
                <span class="field-count"
                  >{col.value} / {priceTier.totalCoins}</span
                >
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ── Metadata stage ────────────────────────────────────────────────────── -->
  {#if metadataStage}
    <div class="meta-stage">
      <span class="meta-stage-label">Metadata enrichment</span>
      <span
        class="meta-stage-pill"
        style="color: {metadataStage.enabled
          ? 'var(--status-ok)'
          : 'var(--tv-text-muted)'};"
      >
        {metadataStage.enabled ? "enabled" : "disabled"}
      </span>
      {#if metadataStage.skippedReason}
        <span class="meta-stage-skip"
          >skipped: {metadataStage.skippedReason}</span
        >
      {:else if metadataStage.freshness.lastAttemptAt}
        <span
          class="meta-stage-bucket"
          style="color: {bucketColor(metadataStage.freshness.bucket)};"
        >
          {metadataStage.freshness.bucket}
        </span>
        <span class="meta-stage-counts">
          {metadataStage.writtenCoins} written · {metadataStage.failedCoins} failed
        </span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .coverage-detail {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 0.25rem 0;
  }

  /* Summary row */
  .summary-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 2rem;
    padding: 0.75rem 1rem;
    background: var(--tv-surface-1);
    border: 1px solid var(--tv-border);
    border-radius: 6px;
  }

  .summary-stat {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .stat-label {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tv-text-muted);
  }

  .stat-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--tv-text-primary);
  }

  /* Field groups */
  .fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field-group-title {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--tv-text-muted);
    margin: 0 0 0.25rem;
  }

  .field-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .field-row {
    display: grid;
    grid-template-columns: 9rem 1fr 5rem;
    align-items: center;
    gap: 0.5rem;
  }

  .field-name {
    font-size: 0.8125rem;
    color: var(--tv-text-primary);
    font-family: monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .field-bar-track {
    height: 6px;
    background: var(--tv-surface-2);
    border-radius: 3px;
    overflow: hidden;
  }

  .field-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .field-count {
    font-size: 0.75rem;
    color: var(--tv-text-muted);
    text-align: right;
    white-space: nowrap;
  }

  /* Metadata stage */
  .meta-stage {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--tv-border);
    border-radius: 6px;
    background: var(--tv-surface-1);
  }

  .meta-stage-label {
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--tv-text-muted);
  }

  .meta-stage-pill {
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .meta-stage-skip {
    font-size: 0.8125rem;
    color: var(--status-warn);
    font-style: italic;
  }

  .meta-stage-bucket {
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .meta-stage-counts {
    font-size: 0.8125rem;
    color: var(--tv-text-muted);
    margin-left: auto;
  }
</style>
