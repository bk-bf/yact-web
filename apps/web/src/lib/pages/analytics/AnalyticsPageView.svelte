<script lang="ts">
  import { browser } from "$app/environment";
  import LoadingDots from "../../components/LoadingDots.svelte";

  interface Props {
    coinId: string;
  }

  interface SweepRow {
    "Sharpe Ratio"?: number;
    "Total Return [%]"?: number;
    "Max Drawdown [%]"?: number;
    "Win Rate [%]"?: number;
    "Total Trades"?: number;
    leverage?: number;
    fg_threshold?: number;
    fr_threshold?: number;
    take_profit_pct?: number;
    stop_loss_pct?: number;
    size_pct?: number;
    fr_exit_below?: number;
    [key: string]: unknown;
  }

  interface SweepMetadata {
    start?: string;
    end?: string;
    metric?: string;
    ohlcv_rows?: number;
    fg_rows?: number;
    fr_rows?: number;
  }

  interface SweepResponse {
    coin_id: string;
    top: SweepRow[];
    total_combos: number;
    surviving_combos: number;
    metadata: SweepMetadata;
  }

  interface InterpretResponse {
    coin_id: string;
    interpretation: string;
    model: string;
    provider: string;
  }

  let { coinId }: Props = $props();

  // ── Params ────────────────────────────────────────────────────────────────
  let paramStart = $state("2022-01-01");
  let paramEnd = $state("");
  let paramTopN = $state(20);
  let paramMinTrades = $state(1);
  let paramFgExitAbove = $state(60);
  let paramFees = $state(0.001);
  let paramSlippage = $state(0.0005);
  let paramSave = $state(true);
  let paramMetric = $state("Sharpe Ratio");

  // ── State ─────────────────────────────────────────────────────────────────
  let sweepLoading = $state(false);
  let sweepError = $state<string | null>(null);
  let sweepResult = $state<SweepResponse | null>(null);

  let interpLoading = $state(false);
  let interpError = $state<string | null>(null);
  let interpResult = $state<InterpretResponse | null>(null);

  let sortCol = $state<string>("Sharpe Ratio");
  let sortAsc = $state(false);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sortedRows = $derived.by(() => {
    if (!sweepResult?.top.length) return [];
    return [...sweepResult.top].sort((a, b) => {
      const av = (a[sortCol] as number | undefined) ?? 0;
      const bv = (b[sortCol] as number | undefined) ?? 0;
      return sortAsc ? av - bv : bv - av;
    });
  });

  function setSort(col: string) {
    if (sortCol === col) {
      sortAsc = !sortAsc;
    } else {
      sortCol = col;
      sortAsc = false;
    }
  }

  // ── Sweep ─────────────────────────────────────────────────────────────────
  async function runSweep() {
    if (!browser || sweepLoading) return;
    sweepLoading = true;
    sweepError = null;
    sweepResult = null;
    interpResult = null;

    try {
      const res = await fetch("/api/simulations/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coin_id: coinId,
          start: paramStart,
          end: paramEnd || undefined,
          top_n: paramTopN,
          min_trades: paramMinTrades,
          metric: paramMetric,
          fees: paramFees,
          slippage: paramSlippage,
          fg_exit_above: paramFgExitAbove,
          save: paramSave,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        sweepError = body.error ?? `HTTP ${res.status}`;
      } else {
        sweepResult = (await res.json()) as SweepResponse;
      }
    } catch {
      sweepError = "Network error — sweep request failed";
    } finally {
      sweepLoading = false;
    }
  }

  // ── Interpret ─────────────────────────────────────────────────────────────
  async function interpretResults() {
    if (!browser || !sweepResult?.top.length || interpLoading) return;
    interpLoading = true;
    interpError = null;

    try {
      const res = await fetch("/api/simulations/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coin_id: coinId,
          results: sweepResult.top.slice(0, 10),
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        interpError = body.error ?? `HTTP ${res.status}`;
      } else {
        interpResult = (await res.json()) as InterpretResponse;
      }
    } catch {
      interpError = "Network error — interpret request failed";
    } finally {
      interpLoading = false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmtNum(v: unknown, digits = 2): string {
    if (v == null || v === "" || (typeof v === "number" && !Number.isFinite(v)))
      return "—";
    return (+(v as number)).toFixed(digits);
  }

  function numClass(v: unknown): string {
    if (typeof v !== "number") return "";
    if (v > 0) return "positive";
    if (v < 0) return "negative";
    return "";
  }

  const TABLE_COLS: { key: string; label: string; digits: number }[] = [
    { key: "Sharpe Ratio", label: "Sharpe", digits: 2 },
    { key: "Total Return [%]", label: "Return %", digits: 1 },
    { key: "Max Drawdown [%]", label: "Max DD %", digits: 1 },
    { key: "Win Rate [%]", label: "Win %", digits: 1 },
    { key: "Total Trades", label: "Trades", digits: 0 },
    { key: "leverage", label: "Lev", digits: 0 },
    { key: "fg_threshold", label: "F&G ≤", digits: 0 },
    { key: "fr_threshold", label: "FR ≤", digits: 4 },
    { key: "take_profit_pct", label: "TP %", digits: 1 },
    { key: "stop_loss_pct", label: "SL %", digits: 1 },
    { key: "size_pct", label: "Size %", digits: 0 },
    { key: "fr_exit_below", label: "FR exit ≤", digits: 4 },
  ];
</script>

<div class="analytics-page">
  <header class="analytics-header">
    <h1 class="analytics-title">
      <a href="/currencies/{coinId}" class="analytics-back">← {coinId}</a>
      <span>Bottom-Fishing Sweep</span>
    </h1>
  </header>

  <!-- ── Params panel ──────────────────────────────────────────────────── -->
  <section class="analytics-params">
    <div class="params-grid">
      <label class="param-field">
        <span class="param-label">Start</span>
        <input type="date" bind:value={paramStart} class="param-input" />
      </label>
      <label class="param-field">
        <span class="param-label">End (blank = today)</span>
        <input type="date" bind:value={paramEnd} class="param-input" />
      </label>
      <label class="param-field">
        <span class="param-label">Top N results</span>
        <input
          type="number"
          min="1"
          max="200"
          bind:value={paramTopN}
          class="param-input"
        />
      </label>
      <label class="param-field">
        <span class="param-label">Min trades</span>
        <input
          type="number"
          min="1"
          bind:value={paramMinTrades}
          class="param-input"
        />
      </label>
      <label class="param-field">
        <span class="param-label">F&G exit above</span>
        <input
          type="number"
          min="0"
          max="100"
          bind:value={paramFgExitAbove}
          class="param-input"
        />
      </label>
      <label class="param-field">
        <span class="param-label">Sort metric</span>
        <select bind:value={paramMetric} class="param-input">
          <option>Sharpe Ratio</option>
          <option>Total Return [%]</option>
          <option>Win Rate [%]</option>
        </select>
      </label>
      <label class="param-field">
        <span class="param-label">Fees</span>
        <input
          type="number"
          step="0.0001"
          min="0"
          bind:value={paramFees}
          class="param-input"
        />
      </label>
      <label class="param-field">
        <span class="param-label">Slippage</span>
        <input
          type="number"
          step="0.0001"
          min="0"
          bind:value={paramSlippage}
          class="param-input"
        />
      </label>
      <label class="param-field param-field--check">
        <input type="checkbox" bind:checked={paramSave} />
        <span class="param-label">Save top results to DB</span>
      </label>
    </div>

    <button
      class="btn-run"
      onclick={() => {
        void runSweep();
      }}
      disabled={sweepLoading}
    >
      {sweepLoading ? "Running…" : "Run Sweep"}
    </button>
  </section>

  <!-- ── Loading ───────────────────────────────────────────────────────── -->
  {#if sweepLoading}
    <LoadingDots label="Sweep in progress — this may take a minute…" />
  {/if}

  <!-- ── Error ─────────────────────────────────────────────────────────── -->
  {#if sweepError}
    <p class="analytics-error">{sweepError}</p>
  {/if}

  <!-- ── Results ───────────────────────────────────────────────────────── -->
  {#if sweepResult}
    <section class="analytics-results">
      <div class="analytics-meta">
        <span>{sweepResult.coin_id}</span>
        <span
          >{sweepResult.metadata.start} – {sweepResult.metadata.end ??
            "today"}</span
        >
        <span>{sweepResult.total_combos.toLocaleString()} combos</span>
        <span>{sweepResult.top.length} shown</span>
        {#if sweepResult.metadata.ohlcv_rows}
          <span>{sweepResult.metadata.ohlcv_rows} OHLCV rows</span>
        {/if}
      </div>

      {#if sweepResult.top.length === 0}
        <p class="analytics-empty">No results passed the min-trades filter.</p>
      {:else}
        <div class="table-scroll">
          <table class="sweep-table">
            <thead>
              <tr>
                {#each TABLE_COLS as col}
                  <th
                    class="th-sortable"
                    class:th-sorted={sortCol === col.key}
                    onclick={() => setSort(col.key)}
                    role="columnheader"
                    aria-sort={sortCol === col.key
                      ? sortAsc
                        ? "ascending"
                        : "descending"
                      : "none"}
                  >
                    {col.label}
                    {#if sortCol === col.key}
                      <span class="sort-icon">{sortAsc ? "▲" : "▼"}</span>
                    {/if}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each sortedRows as row, i (i)}
                <tr class:row-top={i === 0}>
                  {#each TABLE_COLS as col}
                    <td class="td-num {numClass(row[col.key])}">
                      {fmtNum(row[col.key], col.digits)}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- ── Interpret ─────────────────────────────────────────── -->
        <div class="interpret-bar">
          <button
            class="btn-interpret"
            onclick={() => {
              void interpretResults();
            }}
            disabled={interpLoading}
          >
            {interpLoading ? "Interpreting…" : "Interpret with AI"}
          </button>
          {#if interpError}
            <span class="analytics-error">{interpError}</span>
          {/if}
        </div>

        {#if interpLoading}
          <LoadingDots label="Awaiting LLM interpretation…" />
        {/if}

        {#if interpResult}
          <section class="interpret-panel">
            <h2 class="interpret-title">AI Interpretation</h2>
            <p class="interpret-meta">
              {interpResult.provider} / {interpResult.model}
            </p>
            <pre class="interpret-text">{interpResult.interpretation}</pre>
          </section>
        {/if}
      {/if}
    </section>
  {/if}
</div>

<style>
  .analytics-page {
    padding: var(--space-4, 1.25rem);
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    gap: var(--space-4, 1.25rem);
  }

  .analytics-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-3, 0.75rem);
  }

  .analytics-title {
    display: flex;
    gap: var(--space-3, 0.75rem);
    align-items: baseline;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--tv-text-primary, #e0e6e1);
    margin: 0;
  }

  .analytics-back {
    font-size: 0.85rem;
    color: var(--tv-highlight, #b026ff);
    text-decoration: none;
  }

  .analytics-back:hover {
    text-decoration: underline;
  }

  /* ── Params ─────────────────────────────────────── */
  .analytics-params {
    background: var(--tv-surface-1, #161e24);
    border: 1px solid var(--tv-border, #2a3540);
    border-radius: 8px;
    padding: var(--space-3, 0.75rem);
    display: grid;
    gap: var(--space-3, 0.75rem);
  }

  .params-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    align-items: end;
  }

  .param-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .param-field--check {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  .param-label {
    font-size: 0.72rem;
    color: var(--tv-text-secondary, #9aa7a0);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .param-input {
    background: var(--tv-surface-0, #0d1318);
    border: 1px solid var(--tv-border, #2a3540);
    border-radius: 4px;
    color: var(--tv-text-primary, #e0e6e1);
    font-size: 0.85rem;
    padding: 0.3rem 0.5rem;
    width: 100%;
    box-sizing: border-box;
  }

  .param-input:focus {
    outline: 1px solid var(--tv-highlight, #b026ff);
    border-color: var(--tv-highlight, #b026ff);
  }

  .btn-run {
    background: var(--tv-highlight, #b026ff);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.88rem;
    font-weight: 600;
    padding: 0.55rem 1.5rem;
    cursor: pointer;
    transition: opacity 0.15s;
    align-self: start;
    justify-self: start;
  }

  .btn-run:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-run:not(:disabled):hover {
    opacity: 0.85;
  }

  /* ── Error / empty ──────────────────────────────── */
  .analytics-error {
    font-size: 0.82rem;
    color: var(--tv-negative, #ff4d57);
  }

  .analytics-empty {
    font-size: 0.85rem;
    color: var(--tv-text-secondary, #9aa7a0);
    padding: 1rem 0;
  }

  /* ── Results section ────────────────────────────── */
  .analytics-results {
    display: grid;
    gap: var(--space-3, 0.75rem);
  }

  .analytics-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.78rem;
    color: var(--tv-text-secondary, #9aa7a0);
  }

  .analytics-meta span::after {
    content: "·";
    margin-left: 0.75rem;
    opacity: 0.4;
  }

  .analytics-meta span:last-child::after {
    content: "";
  }

  /* ── Table ──────────────────────────────────────── */
  .table-scroll {
    overflow-x: auto;
    border: 1px solid var(--tv-border, #2a3540);
    border-radius: 8px;
  }

  .sweep-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  .sweep-table th,
  .sweep-table td {
    padding: 0.45rem 0.65rem;
    text-align: right;
    white-space: nowrap;
  }

  .sweep-table th {
    background: var(--tv-surface-1, #161e24);
    color: var(--tv-text-secondary, #9aa7a0);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--tv-border, #2a3540);
  }

  .sweep-table tbody tr {
    border-bottom: 1px solid var(--tv-border, #2a3540);
  }

  .sweep-table tbody tr:last-child {
    border-bottom: none;
  }

  .sweep-table tbody tr:hover {
    background: var(--tv-surface-1, #161e24);
  }

  .row-top {
    background: color-mix(
      in srgb,
      var(--tv-highlight, #b026ff) 6%,
      transparent
    );
  }

  .th-sortable {
    cursor: pointer;
    user-select: none;
  }

  .th-sortable:hover {
    color: var(--tv-text-primary, #e0e6e1);
  }

  .th-sorted {
    color: var(--tv-highlight, #b026ff);
  }

  .sort-icon {
    margin-left: 0.25rem;
    font-size: 0.65rem;
  }

  .td-num {
    color: var(--tv-text-primary, #e0e6e1);
  }

  .td-num.positive {
    color: var(--m3-positive, #1ddf72);
  }

  .td-num.negative {
    color: var(--tv-negative, #ff4d57);
  }

  /* ── Interpret ──────────────────────────────────── */
  .interpret-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
  }

  .btn-interpret {
    background: transparent;
    border: 1px solid var(--tv-highlight, #b026ff);
    color: var(--tv-highlight, #b026ff);
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.45rem 1.2rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-interpret:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-interpret:not(:disabled):hover {
    background: color-mix(
      in srgb,
      var(--tv-highlight, #b026ff) 12%,
      transparent
    );
  }

  .interpret-panel {
    background: var(--tv-surface-1, #161e24);
    border: 1px solid var(--tv-border, #2a3540);
    border-radius: 8px;
    padding: var(--space-3, 0.75rem) var(--space-4, 1.25rem);
    display: grid;
    gap: 0.5rem;
  }

  .interpret-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--tv-text-primary, #e0e6e1);
    margin: 0;
  }

  .interpret-meta {
    font-size: 0.72rem;
    color: var(--tv-text-secondary, #9aa7a0);
    margin: 0;
  }

  .interpret-text {
    font-size: 0.85rem;
    color: var(--tv-text-primary, #e0e6e1);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    line-height: 1.65;
    font-family: inherit;
  }
</style>
