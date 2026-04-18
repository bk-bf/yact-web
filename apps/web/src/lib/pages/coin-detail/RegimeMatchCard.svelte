<script lang="ts">
    import { browser } from '$app/environment';
    import CoinRailCard from './CoinRailCard.svelte';
    import LoadingDots from '../../components/LoadingDots.svelte';

    interface RegimeParams {
        leverage?: number;
        fg_threshold?: number;
        fr_threshold?: number;
        take_profit_pct?: number;
        stop_loss_pct?: number;
        size_pct?: number;
        fr_exit_below?: number;
    }

    interface RegimeData {
        strategy_name: string;
        sharpe_ratio: number;
        total_return_pct: number;
        max_drawdown_pct: number;
        win_rate: number;
        trade_count: number;
        period_start: string | null;
        period_end: string | null;
        params: RegimeParams;
        match_score: number;
        context_line: string;
    }

    interface RegimeMatchResponse {
        coin_id: string;
        fg_score: number;
        funding_rate: number;
        regime: RegimeData | null;
    }

    interface Props {
        coinId: string;
    }

    let { coinId }: Props = $props();

    let loading = $state(true);
    let data = $state<RegimeMatchResponse | null>(null);
    let fetchError = $state<string | null>(null);

    $effect(() => {
        if (!browser) return;
        loading = true;
        fetchError = null;
        data = null;

        let cancelled = false;
        fetch(`/api/coins/${encodeURIComponent(coinId)}/regime-match`, { cache: 'no-store' })
            .then(async (res) => {
                if (cancelled) return;
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                data = (await res.json()) as RegimeMatchResponse;
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                fetchError = err instanceof Error ? err.message : 'Failed to load regime match';
            })
            .finally(() => {
                if (!cancelled) loading = false;
            });

        return () => { cancelled = true; };
    });

    function fmtPct(v: number | undefined): string {
        if (v == null) return '—';
        return v.toFixed(1) + '%';
    }

    function fmtFR(v: number | undefined): string {
        if (v == null) return '—';
        return (v * 100).toFixed(4) + '%';
    }

    function fmtDate(iso: string | null): string {
        if (!iso) return '?';
        return iso.slice(0, 10);
    }

    function matchScoreColor(score: number): string {
        if (score >= 0.75) return 'var(--m3-positive)';
        if (score >= 0.45) return '#f0b429';
        return 'var(--tv-negative)';
    }
</script>

<CoinRailCard title="Regime Match">
    {#if loading}
        <LoadingDots label="Loading regime match…" />
    {:else if fetchError}
        <p class="regime-error">{fetchError}</p>
    {:else if !data?.regime}
        <p class="regime-empty">
            No sweep data for this coin.<br />
            <a href="/currencies/{coinId}/analytics" class="regime-link">Run a sweep →</a>
        </p>
    {:else}
        {@const r = data.regime}
        {@const p = r.params}
        <div class="regime-match">
            <div class="regime-score-row">
                <span class="regime-score-label">Match quality</span>
                <span class="regime-score-value" style="color: {matchScoreColor(r.match_score)}">
                    {(r.match_score * 100).toFixed(0)}%
                </span>
            </div>

            <div class="regime-live-row">
                <span>Live F&G</span>
                <strong>{data.fg_score}</strong>
                <span>Funding</span>
                <strong>{fmtFR(data.funding_rate)}</strong>
            </div>

            <div class="regime-stats">
                <div class="regime-stat">
                    <span class="regime-stat__label">Sharpe</span>
                    <strong class="regime-stat__value" class:positive={r.sharpe_ratio >= 1}
                        class:negative={r.sharpe_ratio < 0}>
                        {r.sharpe_ratio.toFixed(2)}
                    </strong>
                </div>
                <div class="regime-stat">
                    <span class="regime-stat__label">Return</span>
                    <strong class="regime-stat__value" class:positive={r.total_return_pct >= 0}
                        class:negative={r.total_return_pct < 0}>
                        {fmtPct(r.total_return_pct)}
                    </strong>
                </div>
                <div class="regime-stat">
                    <span class="regime-stat__label">Max DD</span>
                    <strong class="regime-stat__value negative">
                        {fmtPct(r.max_drawdown_pct)}
                    </strong>
                </div>
                <div class="regime-stat">
                    <span class="regime-stat__label">Win rate</span>
                    <strong class="regime-stat__value">
                        {fmtPct(r.win_rate)}
                    </strong>
                </div>
            </div>

            <div class="regime-entry">
                <span class="regime-entry__label">Entry when</span>
                <span class="regime-entry__rule">
                    F&G ≤ {p.fg_threshold ?? '—'}
                    {#if p.fr_threshold != null}
                        AND funding ≤ {fmtFR(p.fr_threshold)}
                    {/if}
                </span>
            </div>

            <div class="regime-params">
                {#if p.take_profit_pct != null}
                    <span class="regime-tag">TP {fmtPct(p.take_profit_pct)}</span>
                {/if}
                {#if p.stop_loss_pct != null}
                    <span class="regime-tag">SL {fmtPct(p.stop_loss_pct)}</span>
                {/if}
                {#if p.leverage != null}
                    <span class="regime-tag">{p.leverage}× lev</span>
                {/if}
                {#if p.fr_exit_below != null}
                    <span class="regime-tag">FR exit ≤ {fmtFR(p.fr_exit_below)}</span>
                {/if}
            </div>

            <p class="regime-period">
                {fmtDate(r.period_start)} – {fmtDate(r.period_end)}
                &nbsp;·&nbsp; {r.trade_count} trades
            </p>

            <a href="/currencies/{coinId}/analytics" class="regime-link regime-link--footer">
                Full sweep →
            </a>
        </div>
    {/if}
</CoinRailCard>

<style>
    .regime-error,
    .regime-empty {
        font-size: 0.8rem;
        color: var(--tv-text-secondary, #9aa7a0);
        padding: 0.5rem 0;
        line-height: 1.5;
    }

    .regime-match {
        display: grid;
        gap: 0.6rem;
    }

    .regime-score-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .regime-score-label {
        font-size: 0.75rem;
        color: var(--tv-text-secondary, #9aa7a0);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .regime-score-value {
        font-size: 0.95rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }

    .regime-live-row {
        display: flex;
        gap: 0.5rem;
        align-items: baseline;
        font-size: 0.78rem;
        color: var(--tv-text-secondary, #9aa7a0);
    }

    .regime-live-row strong {
        color: var(--tv-text-primary, #e0e6e1);
        font-variant-numeric: tabular-nums;
    }

    .regime-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.35rem 0.6rem;
    }

    .regime-stat {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }

    .regime-stat__label {
        font-size: 0.7rem;
        color: var(--tv-text-secondary, #9aa7a0);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .regime-stat__value {
        font-size: 0.88rem;
        font-variant-numeric: tabular-nums;
        color: var(--tv-text-primary, #e0e6e1);
    }

    .regime-stat__value.positive {
        color: var(--m3-positive, #1ddf72);
    }

    .regime-stat__value.negative {
        color: var(--tv-negative, #ff4d57);
    }

    .regime-entry {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
    }

    .regime-entry__label {
        font-size: 0.7rem;
        color: var(--tv-text-secondary, #9aa7a0);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .regime-entry__rule {
        font-size: 0.8rem;
        color: var(--tv-text-primary, #e0e6e1);
    }

    .regime-params {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
    }

    .regime-tag {
        font-size: 0.72rem;
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        border: 1px solid var(--tv-border, #2a3540);
        color: var(--tv-text-secondary, #9aa7a0);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .regime-period {
        font-size: 0.72rem;
        color: var(--tv-text-secondary, #9aa7a0);
        margin: 0;
        font-variant-numeric: tabular-nums;
    }

    .regime-link {
        font-size: 0.78rem;
        color: var(--tv-highlight, #b026ff);
        text-decoration: none;
    }

    .regime-link:hover {
        text-decoration: underline;
    }

    .regime-link--footer {
        margin-top: 0.15rem;
    }
</style>
