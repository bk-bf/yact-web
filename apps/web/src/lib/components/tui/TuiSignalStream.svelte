<script lang="ts">
  import { browser } from "$app/environment";
  import TuiStreamToolbar from "$lib/components/tui/TuiStreamToolbar.svelte";
  import type { LogEntry, SignalTag } from "$lib/types/terminal";

  interface Props {
    rows: (LogEntry & { key: number })[];
    newestKey: number;
    clockTime: string;
    blinkOn: boolean;
    streamLabel: string;
  }

  let { rows, newestKey, clockTime, blinkOn, streamLabel }: Props = $props();

  let streamEl: HTMLElement | null = $state(null);
  let reversed = $state(false);

  const displayRows = $derived(reversed ? [...rows].toReversed() : rows);

  $effect(() => {
    if (browser && streamEl && newestKey >= 0) {
      const el = streamEl;
      requestAnimationFrame(() => {
        if (reversed) el.scrollTop = 0;
        else el.scrollTop = el.scrollHeight;
      });
    }
  });

  function kindColor(k: string): string {
    if (k === "ENTER") return "#1ddf72";
    if (k === "EXIT") return "#b026ff";
    if (k === "KILL") return "#ff4d57";
    if (k === "LAG") return "#d56bff";
    if (k === "SCAN") return "#f5a623";
    // Regime event kinds (T-304)
    if (k === "F&G") return "#f5a623";
    if (k === "FUNDING") return "#b026ff";
    if (k === "OI") return "#00d4ff";
    return "#9aa7a0";
  }

  function tagColor(t: SignalTag): string {
    if (t === "MATCH" || t === "ENTER") return "#1ddf72";
    if (t === "SKIP" || t === "CUT" || t === "TIMEOUT") return "#ff4d57";
    if (t === "PENDING" || t === "SCAN") return "#f5a623";
    return "#9aa7a0";
  }
</script>

<div class="t-panel t-panel-fill">
  <div class="t-plabel-row">
    <span class="t-plabel-text">SIGNAL STREAM // {streamLabel}</span>
    <TuiStreamToolbar
      {reversed}
      onFlip={() => {
        reversed = !reversed;
      }}
    />
  </div>
  <div class="t-stream" bind:this={streamEl}>
    <div class="stream-hdr">
      <span>TIME</span><span>KIND</span><span>DETAIL</span><span>TAG</span>
    </div>
    <div class="stream-rule" aria-hidden="true"></div>
    {#each displayRows as row (row.key)}
      <div class="stream-row" class:stream-new={row.key === newestKey}>
        <span class="sr-ts">{row.ts}</span>
        <span class="sr-kind" style="color:{kindColor(row.kind)}"
          >[{row.kind}]</span
        >
        <span class="sr-detail">{row.detail}</span>
        <span class="sr-tag" style="color:{tagColor(row.tag)}">{row.tag}</span>
      </div>
    {/each}
    <div class="stream-row stream-cursor">
      <span class="sr-ts">{clockTime}</span>
      <span class="sr-kind" style="color:#f5a623">[SCAN]</span>
      <span class="sr-detail"
        >watching 1,847 pairs…<span class="cursor" class:visible={blinkOn}
          >█</span
        ></span
      >
      <span class="sr-tag" style="color:#f5a623">LIVE</span>
    </div>
  </div>
</div>

<style>
  .t-panel {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(176, 38, 255, 0.08);
  }
  .t-panel-fill {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .t-plabel-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.28rem 0.3rem 0.22rem 0.5rem;
    background: rgba(176, 38, 255, 0.055);
    border-bottom: 1px solid rgba(176, 38, 255, 0.1);
    flex-shrink: 0;
    gap: 0.4rem;
    overflow: hidden;
  }
  .t-plabel-text {
    color: rgba(176, 38, 255, 0.72);
    font-size: 0.59rem;
    letter-spacing: 0.1em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
  .t-stream {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.35rem 0.5rem 0.3rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(176, 38, 255, 0.3) transparent;
  }
  .stream-hdr {
    display: grid;
    grid-template-columns: 7ch 8ch 1fr 8ch;
    gap: 0.45rem;
    padding-bottom: 0.2rem;
    color: rgba(176, 38, 255, 0.58);
    font-size: 0.59rem;
    letter-spacing: 0.08em;
  }
  .stream-rule {
    height: 1px;
    background: rgba(176, 38, 255, 0.12);
    margin-bottom: 0.15rem;
  }
  .stream-row {
    display: grid;
    grid-template-columns: 7ch 8ch 1fr 8ch;
    gap: 0.45rem;
    padding: 0.06rem 0;
    line-height: 1.55;
  }
  @keyframes row-in {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .stream-new {
    animation: row-in 0.22s ease-out forwards;
  }
  .sr-ts {
    color: rgba(200, 212, 207, 0.3);
    font-variant-numeric: tabular-nums;
  }
  .sr-kind {
    font-weight: 600;
  }
  .sr-detail {
    color: rgba(200, 212, 207, 0.72);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sr-tag {
    text-align: right;
    font-size: 0.61rem;
    letter-spacing: 0.05em;
  }
  .stream-cursor .sr-detail {
    color: rgba(200, 212, 207, 0.38);
  }
  .cursor {
    color: #b026ff;
    visibility: hidden;
  }
  .cursor.visible {
    visibility: visible;
  }
</style>
