<script lang="ts">
  import { browser } from "$app/environment";
  import LoadingDots from "../LoadingDots.svelte";

  type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

  interface ParsedLine {
    raw: string;
    ts: Date | null;
    tsStr: string;
    level: LogLevel | null;
    tag: string | null;
    message: string;
    key: number;
  }

  // 2025-04-24 10:30:15  [INFO]      logger.name  rest…
  const LINE_RE =
    /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\[(\w+)\]\s+\S+\s+(.*)/;
  // tag prefix in the message body: [auto-refresh] or [ticker-loop]
  const TAG_RE = /^\[([a-z0-9_-]+)\]/;

  let source = $state<"miner" | "api">("miner");
  let filterLevel = $state("ALL");
  let filterTag = $state("ALL");
  let filterTime = $state("ALL");

  let rawLines = $state<ParsedLine[]>([]);
  let logGraceExpired = $state(false);
  let logEl: HTMLElement | null = $state(null);

  const logPhase = $derived(
    rawLines.length > 0 ? ('content' as const)
    : logGraceExpired   ? ('empty'   as const)
    :                     ('loading' as const)
  );
  let keyCounter = 0;
  let es: EventSource | null = null;

  function parseLine(raw: string): ParsedLine {
    const m = LINE_RE.exec(raw);
    if (!m) {
      return {
        raw,
        ts: null,
        tsStr: "",
        level: null,
        tag: null,
        message: raw,
        key: ++keyCounter,
      };
    }
    const [, tsStr, levelStr, rest] = m;
    const trimmed = rest.trimStart();
    const tagMatch = TAG_RE.exec(trimmed);
    return {
      raw,
      ts: new Date(tsStr.replace(" ", "T") + "Z"),
      tsStr,
      level: levelStr as LogLevel,
      tag: tagMatch ? tagMatch[1] : null,
      message: trimmed,
      key: ++keyCounter,
    };
  }

  const knownTags = $derived(
    [...new Set(rawLines.flatMap((l) => (l.tag ? [l.tag] : [])))].sort(),
  );

  const filteredLines = $derived.by(() => {
    let lines = rawLines;
    if (filterLevel !== "ALL") {
      lines = lines.filter((l) => l.level === filterLevel);
    }
    if (filterTag !== "ALL") {
      lines = lines.filter((l) => l.tag === filterTag);
    }
    if (filterTime !== "ALL") {
      const windowMs =
        filterTime === "5m"
          ? 5 * 60_000
          : filterTime === "15m"
            ? 15 * 60_000
            : 60 * 60_000;
      const cutoff = Date.now() - windowMs;
      lines = lines.filter((l) => l.ts !== null && l.ts.getTime() >= cutoff);
    }
    return lines.slice(-300);
  });

  // Reset tag filter if no longer valid after source switch
  $effect(() => {
    const tags = knownTags;
    if (filterTag !== "ALL" && !tags.includes(filterTag)) {
      filterTag = "ALL";
    }
  });

  function connect(src: "miner" | "api") {
    es?.close();
    rawLines = [];
    logGraceExpired = false;
    es = new EventSource(`/api/logs/stream?source=${src}`);
    es.onmessage = (ev: MessageEvent) => {
      const p = parseLine(ev.data as string);
      rawLines = [...rawLines.slice(-999), p];
    };
  }

  $effect(() => {
    if (!browser) return;
    connect(source);
    return () => {
      es?.close();
    };
  });

  // Auto-scroll to bottom on new content
  $effect(() => {
    const _ = filteredLines.length; // track changes
    if (browser && logEl) {
      const el = logEl;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  });

  function levelColor(level: LogLevel | null): string {
    switch (level) {
      case "DEBUG":
        return "#6b7a74";
      case "INFO":
        return "#9aa7a0";
      case "WARNING":
        return "#f5a623";
      case "ERROR":
        return "#ff4d57";
      case "CRITICAL":
        return "#b026ff";
      default:
        return "#6b7a74";
    }
  }
</script>

<div class="t-panel t-panel-fill">
  <div class="lp-header">
    <span class="lp-title">LIVE LOGS</span>
    <div class="lp-controls">
      <div class="lp-toggle">
        <button
          class="lp-src-btn"
          class:lp-src-active={source === "miner"}
          onclick={() => (source = "miner")}>miner</button
        >
        <button
          class="lp-src-btn"
          class:lp-src-active={source === "api"}
          onclick={() => (source = "api")}>api</button
        >
      </div>
      <select
        class="lp-select"
        bind:value={filterLevel}
        aria-label="Filter by level"
      >
        <option value="ALL">level:ALL</option>
        <option value="DEBUG">DEBUG</option>
        <option value="INFO">INFO</option>
        <option value="WARNING">WARN</option>
        <option value="ERROR">ERROR</option>
        <option value="CRITICAL">CRIT</option>
      </select>
      <select
        class="lp-select"
        bind:value={filterTag}
        aria-label="Filter by tag"
      >
        <option value="ALL">tag:ALL</option>
        {#each knownTags as t (t)}
          <option value={t}>[{t}]</option>
        {/each}
      </select>
      <select
        class="lp-select"
        bind:value={filterTime}
        aria-label="Filter by time"
      >
        <option value="ALL">time:ALL</option>
        <option value="5m">last 5m</option>
        <option value="15m">last 15m</option>
        <option value="1h">last 1h</option>
      </select>
    </div>
  </div>

  <div class="lp-body" bind:this={logEl}>
    {#if logPhase === 'loading'}
      <LoadingDots
        label="waiting for log stream"
        graceMs={5000}
        onExpired={() => { logGraceExpired = true; }}
      />
    {:else if logPhase === 'empty'}
      <div class="lp-waiting">no log data received</div>
    {:else if filteredLines.length === 0}
      <div class="lp-waiting">no lines match filter</div>
    {:else}
      {#each filteredLines as line (line.key)}
        <div class="lp-row">
          <span class="lp-ts">{line.tsStr.slice(11)}</span>
          <span class="lp-level" style="color:{levelColor(line.level)}"
            >[{line.level ?? "?"}]</span
          >
          <span class="lp-msg">{line.message}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  /* ── Panel shell ────────────────────────────────────────────────────────── */
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

  /* ── Header bar ─────────────────────────────────────────────────────────── */
  .lp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.35rem;
    padding: 0.2rem 0.4rem;
    background: rgba(176, 38, 255, 0.055);
    border-bottom: 1px solid rgba(176, 38, 255, 0.1);
    flex-shrink: 0;
    min-width: 0;
  }

  .lp-title {
    color: rgba(176, 38, 255, 0.72);
    font-size: 0.59rem;
    letter-spacing: 0.1em;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .lp-controls {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-wrap: nowrap;
    min-width: 0;
    flex-shrink: 1;
  }

  /* ── Source toggle ──────────────────────────────────────────────────────── */
  .lp-toggle {
    display: flex;
    border: 1px solid rgba(176, 38, 255, 0.25);
    border-radius: 2px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .lp-src-btn {
    background: transparent;
    border: none;
    color: rgba(176, 38, 255, 0.45);
    font-family: inherit;
    font-size: 0.57rem;
    letter-spacing: 0.06em;
    padding: 0.1rem 0.35rem;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .lp-src-btn:not(:first-child) {
    border-left: 1px solid rgba(176, 38, 255, 0.25);
  }
  .lp-src-btn:hover {
    background: rgba(176, 38, 255, 0.1);
    color: rgba(176, 38, 255, 0.8);
  }
  .lp-src-active {
    background: rgba(176, 38, 255, 0.18) !important;
    color: rgba(176, 38, 255, 0.95) !important;
  }

  /* ── Filter selects ─────────────────────────────────────────────────────── */
  .lp-select {
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(176, 38, 255, 0.22);
    border-radius: 2px;
    color: rgba(176, 38, 255, 0.65);
    font-family: inherit;
    font-size: 0.56rem;
    letter-spacing: 0.05em;
    padding: 0.1rem 0.2rem;
    cursor: pointer;
    outline: none;
    flex-shrink: 1;
    min-width: 0;
    max-width: 6rem;
  }
  .lp-select:focus {
    border-color: rgba(176, 38, 255, 0.6);
  }
  .lp-select option {
    background: #0a0a10;
    color: #c8d4cf;
  }

  /* ── Log body ───────────────────────────────────────────────────────────── */
  .lp-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(176, 38, 255, 0.15) transparent;
    padding: 0.15rem 0.4rem 0.25rem;
  }

  .lp-waiting {
    color: rgba(176, 38, 255, 0.35);
    font-size: 0.6rem;
    padding: 0.5rem 0;
    font-style: italic;
  }

  /* ── Log row ────────────────────────────────────────────────────────────── */
  .lp-row {
    display: grid;
    grid-template-columns: 5.5rem 3.8rem 1fr;
    gap: 0.25rem;
    font-size: 0.6rem;
    line-height: 1.45;
    white-space: nowrap;
    overflow: hidden;
  }
  .lp-row:hover {
    background: rgba(176, 38, 255, 0.04);
  }

  .lp-ts {
    color: #5a6663;
    flex-shrink: 0;
  }
  .lp-level {
    flex-shrink: 0;
    font-weight: 600;
  }
  .lp-msg {
    color: #c8d4cf;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
