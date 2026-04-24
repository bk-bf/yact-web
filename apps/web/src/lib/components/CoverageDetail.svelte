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

  const fieldGroups = $derived.by(() => {
    const entries = Object.entries(
      missingClarity?.topMissingItemsByField ?? {},
    );
    return {
      breakdown: entries.filter(([k]) => k.startsWith("breakdown.")),
      charts: entries.filter(([k]) => k.startsWith("charts.")),
    };
  });

  function fieldLabel(key: string): string {
    return key.split(".").slice(1).join(".");
  }

  function pctMissing(missing: number): number {
    if (!totalCoins || totalCoins === 0) return 0;
    return Math.round((missing / totalCoins) * 100);
  }

  function missColor(missing: number): string {
    const p = pctMissing(missing);
    if (p >= 100) return "var(--status-ok)";
    if (p >= 50) return "var(--status-warn)";
    return "var(--status-error)";
  }

  function priceFieldColor(value: number, total: number): string {
    if (!total) return "var(--tv-text-muted)";
    const p = Math.round((value / total) * 100);
    if (p >= 100) return "var(--status-ok)";
    if (p >= 50) return "var(--status-warn)";
    return "var(--status-error)";
  }

  function priceBarColor(value: number, total: number): string {
    if (!total) return "rgba(255,255,255,0.1)";
    const p = Math.round((value / total) * 100);
    if (p >= 100) return "rgba(29, 223, 114, 0.5)";
    if (p >= 50) return "rgba(245, 166, 35, 0.55)";
    return "rgba(255, 77, 87, 0.6)";
  }

  /** Returns the fill color for the "filled" portion of a missing-field bar. */
  function barFillColor(missing: number): string {
    const p = pctMissing(missing);
    if (p >= 100) return "rgba(29, 223, 114, 0.5)";
    if (p >= 50) return "rgba(245, 166, 35, 0.55)";
    return "rgba(255, 77, 87, 0.6)";
  }
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

    <!-- ── Breakdown missing fields ─────────────────────────────────────── -->
    {#if fieldGroups.breakdown.length > 0}
      <div class="cd-grp">
        <div class="cd-grp-hd">BREAKDOWN MISSING</div>
        {#each fieldGroups.breakdown as [key, count] (key)}
          <div class="cd-row cd-row-bar">
            <span class="cd-k">{fieldLabel(key)}</span>
            <span class="ob-bar-wrap"
              ><span
                class="ob-bar"
                style="width:{pctMissing(count)}%; background:{barFillColor(
                  count,
                )};"
              ></span></span
            >
            <span class="cd-v" style="color:{missColor(count)};">{count}</span>
            <span class="cd-s">{pctMissing(count)}%</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- ── Chart timeframes missing ─────────────────────────────────────── -->
    {#if fieldGroups.charts.length > 0}
      <div class="cd-grp">
        <div class="cd-grp-hd">CHARTS MISSING</div>
        {#each fieldGroups.charts as [key, count] (key)}
          <div class="cd-row">
            <span class="cd-k">{fieldLabel(key)}</span>
            <span class="cd-v" style="color:{missColor(count)};">{count}</span>
            <span class="cd-s">{pctMissing(count)}%</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- ── Price fields ─────────────────────────────────────────────────── -->
    {#if priceTier}
      <div class="cd-grp">
        <div class="cd-grp-hd">PRICE FIELDS</div>
        {#each [{ label: "price", value: priceTier.currentPrice }, { label: "symbol", value: priceTier.symbol }, { label: "name", value: priceTier.name }, { label: "market cap", value: priceTier.marketCap }, { label: "rank", value: priceTier.marketCapRank }, { label: "vol 24h", value: priceTier.volume24h }, { label: "Δ 24h", value: priceTier.priceChange24h }] as col (col.label)}
          {@const pct =
            priceTier.totalCoins > 0
              ? Math.round((col.value / priceTier.totalCoins) * 100)
              : 0}
          <div class="cd-row cd-row-bar">
            <span class="cd-k">{col.label}</span>
            <span class="ob-bar-wrap"
              ><span
                class="ob-bar"
                style="width:{pct}%; background:{priceBarColor(
                  col.value,
                  priceTier.totalCoins,
                )};"
              ></span></span
            >
            <span
              class="cd-v"
              style="color:{priceFieldColor(col.value, priceTier.totalCoins)};"
              >{col.value}</span
            >
            <span class="cd-s">{pct}%</span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- ── Metadata stage ─────────────────────────────────────────────────── -->
  {#if metadataStage}
    <div class="cd-grp">
      <div class="cd-grp-hd">METADATA</div>
      <div class="cd-row">
        <span class="cd-k">enrichment</span>
        <span
          class="cd-v"
          style="color:{metadataStage.enabled
            ? 'var(--status-ok)'
            : 'var(--tv-text-muted)'};"
          >{metadataStage.enabled ? "ENABLED" : "DISABLED"}</span
        >
      </div>
      {#if metadataStage.skippedReason}
        <div class="cd-row">
          <span class="cd-k">skipped</span>
          <span class="cd-v cd-v-sm">{metadataStage.skippedReason}</span>
        </div>
      {:else if metadataStage.freshness.lastAttemptAt}
        <div class="cd-row">
          <span class="cd-k">freshness</span>
          <span
            class="cd-v"
            style="color:{metadataStage.freshness.bucket === 'fresh'
              ? 'var(--status-ok)'
              : metadataStage.freshness.bucket === 'warning'
                ? 'var(--status-warn)'
                : metadataStage.freshness.bucket === 'stale'
                  ? 'var(--status-error)'
                  : 'var(--tv-text-muted)'};"
            >{metadataStage.freshness.bucket.toUpperCase()}</span
          >
        </div>
        <div class="cd-row">
          <span class="cd-k">written</span>
          <span class="cd-v">{metadataStage.writtenCoins}</span>
        </div>
        <div class="cd-row">
          <span class="cd-k">failed</span>
          <span
            class="cd-v"
            style="color:{metadataStage.failedCoins > 0
              ? 'var(--status-error)'
              : 'var(--tv-text-muted)'};">{metadataStage.failedCoins}</span
          >
        </div>
      {/if}
    </div>
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

  .cd-grp {
    margin-top: 0.6rem;
  }

  .cd-grp-hd {
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: rgba(176, 38, 255, 0.6);
    padding: 0.15rem 0;
    border-bottom: 1px solid rgba(176, 38, 255, 0.12);
    margin-bottom: 0.2rem;
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

  /* bar variant: name | bar-track | count | pct */
  .cd-row-bar {
    grid-template-columns: minmax(0, 1fr) 4rem 4.5ch 3.5ch;
    align-items: center;
    gap: 0.35rem;
  }

  /* Order Book-style bar — identical to TradingTerminalView .ob-bar-wrap/.ob-bar */
  .ob-bar-wrap {
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    position: relative;
    overflow: hidden;
    border-radius: 0;
  }
  .ob-bar {
    position: absolute;
    inset-block: 0;
    right: 0;
    left: auto;
    height: 100%;
    transition: width 0.4s ease;
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

  .cd-s {
    font-size: 0.58rem;
    color: rgba(200, 212, 207, 0.4);
    text-align: right;
    min-width: 4ch;
    font-variant-numeric: tabular-nums;
  }
</style>
