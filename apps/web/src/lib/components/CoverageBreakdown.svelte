<script lang="ts">
  import type {
    MissingClarity,
    MetadataStage,
    PriceTier,
  } from "../../routes/dashboard/+page.js";

  interface Props {
    missingClarity: MissingClarity | undefined;
    metadataStage: MetadataStage | undefined;
    totalCoins: number;
    priceTier: PriceTier | undefined;
    previousMissing: Record<string, number> | undefined;
  }

  let {
    missingClarity,
    metadataStage,
    totalCoins,
    priceTier,
    previousMissing,
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

  function pctFilled(missing: number): number {
    if (!totalCoins || totalCoins === 0) return 0;
    return Math.round(((totalCoins - missing) / totalCoins) * 100);
  }

  function fillColor(missing: number): string {
    const p = pctFilled(missing);
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
</script>

<div class="cd-root">
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

  <!-- ── Breakdown filled fields ──────────────────────────────────────── -->
  {#if missingClarity && fieldGroups.breakdown.length > 0}
    <div class="cd-grp">
      <div class="cd-row-4 cd-hdr-row">
        <span class="cd-grp-lbl">BREAKDOWN FILLED</span>
        <span class="cd-hint">%</span>
        <span class="cd-hint">filled</span>
        <span class="cd-hint">Δ</span>
      </div>
      {#each fieldGroups.breakdown as [key, count] (key)}
        {@const delta =
          previousMissing !== undefined
            ? (previousMissing[key] ?? count) - count
            : null}
        {@const filled = totalCoins - count}
        <div class="cd-row cd-row-4">
          <span class="cd-k">{fieldLabel(key)}</span>
          <span class="cd-s" style="color:{fillColor(count)};"
            >{pctFilled(count)}%</span
          >
          <span class="cd-frac">{filled}/{totalCoins}</span>
          <span
            class="cd-s"
            style="color:{delta !== null && delta > 0
              ? 'var(--status-ok)'
              : delta !== null && delta < 0
                ? 'var(--status-error)'
                : 'rgba(200,212,207,0.22)'};"
            >{delta !== null
              ? delta > 0
                ? "+" + delta
                : delta === 0
                  ? "\u2014"
                  : delta
              : "\u2014"}</span
          >
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Chart timeframes filled ────────────────────────────────────────── -->
  {#if missingClarity && fieldGroups.charts.length > 0}
    <div class="cd-grp">
      <div class="cd-row-4 cd-hdr-row">
        <span class="cd-grp-lbl">CHARTS FILLED</span>
        <span class="cd-hint">%</span>
        <span class="cd-hint">filled</span>
        <span class="cd-hint">Δ</span>
      </div>
      {#each fieldGroups.charts as [key, count] (key)}
        {@const delta =
          previousMissing !== undefined
            ? (previousMissing[key] ?? count) - count
            : null}
        {@const filled = totalCoins - count}
        <div class="cd-row cd-row-4">
          <span class="cd-k">{fieldLabel(key)}</span>
          <span class="cd-s" style="color:{fillColor(count)};"
            >{pctFilled(count)}%</span
          >
          <span class="cd-frac">{filled}/{totalCoins}</span>
          <span
            class="cd-s"
            style="color:{delta !== null && delta > 0
              ? 'var(--status-ok)'
              : delta !== null && delta < 0
                ? 'var(--status-error)'
                : 'rgba(200,212,207,0.22)'};"
            >{delta !== null
              ? delta > 0
                ? "+" + delta
                : delta === 0
                  ? "\u2014"
                  : delta
              : "\u2014"}</span
          >
        </div>
      {/each}
    </div>
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
    padding: 0.06rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }
  .cd-row:last-child {
    border-bottom: none;
  }

  /* 4-col: field | fill% | filled/total | Δ */
  .cd-row-4 {
    grid-template-columns: minmax(0, 1fr) 3.5ch 9ch 4.5ch;
  }

  /* header row matching cd-row-4 */
  .cd-hdr-row {
    padding: 0.15rem 0;
    border-bottom: 1px solid rgba(176, 38, 255, 0.12);
    margin-bottom: 0.2rem;
    align-items: baseline;
  }

  .cd-grp-lbl {
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: rgba(176, 38, 255, 0.6);
  }

  .cd-hint {
    font-size: 0.52rem;
    color: rgba(200, 212, 207, 0.28);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .cd-frac {
    font-size: 0.58rem;
    color: rgba(200, 212, 207, 0.35);
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cd-row-bar {
    grid-template-columns: minmax(0, 1fr) 3rem 4.5ch 3.5ch;
    align-items: center;
    gap: 0.35rem;
  }

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
