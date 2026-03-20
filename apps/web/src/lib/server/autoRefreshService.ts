import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
    getCoinBreakdown,
    getCoinChartSeries,
    getGlobalMarketSummary,
    getTopMarketCoins,
    type CoinChartRange
} from './coingecko';
import type { MarketCoin } from '../types/market';
import {
    listTrackedCoinIds,
    readCoinChartSnapshot,
    writeCoinBreakdownSnapshot,
    writeCoinChartSnapshot
} from './persistentCoinSnapshot';
import { getDataDir } from './dataPaths';
import { writePersistentMarketSnapshot } from './persistentMarketSnapshot';

const AUTO_REFRESH_INTERVAL_MS = 5 * 60_000;
const QUEUE_POLL_INTERVAL_MS = 8_000;
const MARKET_SWEEP_LIMIT = 100;
const AUTO_REFRESH_LOG_PREFIX = '[auto-refresh]';
const QUEUE_LOG_PREFIX = '[refresh-queue]';
const QUEUE_DEBUG_LOGS_ENABLED = process.env.YACT_QUEUE_DEBUG === '1';
const AUTO_REFRESH_LOG_DIR = getDataDir();
const AUTO_REFRESH_LOG_FILE = path.join(AUTO_REFRESH_LOG_DIR, 'auto-refresh.log');
const CHART_RANGES: CoinChartRange[] = ['24h', '7d', '1m', '3m', 'ytd', '1y', 'max'];
const CHART_RANGE_STALE_MS: Record<CoinChartRange, number> = {
    '24h': 3 * 60_000,
    '7d': 10 * 60_000,
    '1m': 45 * 60_000,
    '3m': 2 * 60 * 60_000,
    ytd: 12 * 60 * 60_000,
    '1y': 12 * 60 * 60_000,
    max: 24 * 60 * 60_000
};
const COIN_REFRESH_CONCURRENCY = Number.parseInt(process.env.YACT_COIN_REFRESH_CONCURRENCY ?? '3', 10);
const CHART_REFRESH_CONCURRENCY = Number.parseInt(process.env.YACT_CHART_REFRESH_CONCURRENCY ?? '2', 10);

let autoRefreshStarted = false;
let autoRefreshTimer: NodeJS.Timeout | null = null;
let autoRefreshRunning = false;
let queueTimer: NodeJS.Timeout | null = null;
let queueTaskRunning = false;
let logWriteChain: Promise<void> = Promise.resolve();

type RefreshPriority = 'critical' | 'high' | 'normal' | 'low';
type RefreshTaskType = 'markets' | 'coin-full';

interface RefreshTask {
    key: string;
    type: RefreshTaskType;
    coinId: string | null;
    priority: RefreshPriority;
    priorityScore: number;
    enqueuedAt: number;
    reason: string;
}

const REFRESH_PRIORITY_SCORE: Record<RefreshPriority, number> = {
    critical: 4,
    high: 3,
    normal: 2,
    low: 1
};

const TASK_COOLDOWN_MS: Record<RefreshTaskType, number> = {
    markets: 90_000,
    'coin-full': 120_000
};

const refreshQueue = new Map<string, RefreshTask>();
const taskLastRunAt = new Map<string, number>();

interface AutoRefreshStatus {
    intervalMs: number;
    schedulerStarted: boolean;
    running: boolean;
    nextCycleAt: number | null;
    cycleCount: number;
    lastCycleStartedAt: number | null;
    lastCycleFinishedAt: number | null;
    lastCycleOk: boolean | null;
    lastCycleError: string | null;
    lastSweepCoinCount: number;
    lastAdHocCoin: {
        coinId: string;
        startedAt: number;
        finishedAt: number | null;
        ok: boolean | null;
        error: string | null;
    } | null;
    queueLength: number;
    queueNextTask: {
        key: string;
        type: RefreshTaskType;
        coinId: string | null;
        priority: RefreshPriority;
        enqueuedAt: number;
        reason: string;
    } | null;
}

interface AutoRefreshEvent {
    ts: number;
    type:
    | 'scheduler-started'
    | 'cycle-start'
    | 'cycle-success'
    | 'cycle-failed'
    | 'cycle-skipped'
    | 'ad-hoc-coin-start'
    | 'ad-hoc-coin-success'
    | 'ad-hoc-coin-failed';
    detail?: Record<string, unknown>;
}

const AUTO_REFRESH_EVENT_CAP = 80;
const autoRefreshEvents: AutoRefreshEvent[] = [];

function pushAutoRefreshEvent(event: AutoRefreshEvent): void {
    autoRefreshEvents.push(event);
    if (autoRefreshEvents.length > AUTO_REFRESH_EVENT_CAP) {
        autoRefreshEvents.splice(0, autoRefreshEvents.length - AUTO_REFRESH_EVENT_CAP);
    }
}

export function getAutoRefreshEvents(limit = 30): AutoRefreshEvent[] {
    const safeLimit = Math.max(1, Math.min(200, limit));
    return autoRefreshEvents.slice(-safeLimit);
}

const autoRefreshStatus: AutoRefreshStatus = {
    intervalMs: AUTO_REFRESH_INTERVAL_MS,
    schedulerStarted: false,
    running: false,
    nextCycleAt: null,
    cycleCount: 0,
    lastCycleStartedAt: null,
    lastCycleFinishedAt: null,
    lastCycleOk: null,
    lastCycleError: null,
    lastSweepCoinCount: 0,
    lastAdHocCoin: null,
    queueLength: 0,
    queueNextTask: null
};

export function getAutoRefreshStatus(): AutoRefreshStatus {
    return { ...autoRefreshStatus };
}

function taskKey(type: RefreshTaskType, coinId: string | null): string {
    return type === 'markets' ? 'markets' : `coin:${coinId ?? 'unknown'}`;
}

function toQueueSnapshot(limit = 25): Array<{
    key: string;
    type: RefreshTaskType;
    coinId: string | null;
    priority: RefreshPriority;
    priorityScore: number;
    enqueuedAt: number;
    reason: string;
}> {
    return [...refreshQueue.values()]
        .sort((a, b) => {
            if (a.priorityScore !== b.priorityScore) {
                return b.priorityScore - a.priorityScore;
            }
            return a.enqueuedAt - b.enqueuedAt;
        })
        .slice(0, Math.max(1, limit))
        .map((task) => ({
            key: task.key,
            type: task.type,
            coinId: task.coinId,
            priority: task.priority,
            priorityScore: task.priorityScore,
            enqueuedAt: task.enqueuedAt,
            reason: task.reason
        }));
}

function appendAutoRefreshLog(scope: string, phase: string, detail: Record<string, unknown>): void {
    const entry = {
        ts: new Date().toISOString(),
        scope,
        phase,
        ...detail
    };
    const line = `${JSON.stringify(entry)}\n`;

    logWriteChain = logWriteChain
        .then(async () => {
            await mkdir(AUTO_REFRESH_LOG_DIR, { recursive: true });
            await appendFile(AUTO_REFRESH_LOG_FILE, line, 'utf-8');
        })
        .catch(() => {
            // Keep runtime path resilient even if file logging fails.
        });
}

async function runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T, context: { workerId: number; itemIndex: number }) => Promise<void>,
    options?: {
        scope?: string;
        label?: string;
        logItems?: boolean;
    }
): Promise<{ peakInFlight: number; totalItems: number; durationMs: number }> {
    const safeConcurrency = Math.max(1, Math.min(10, concurrency));
    const startedAt = Date.now();
    const scope = options?.scope ?? 'refresh-parallel';
    const label = options?.label ?? 'parallel-run';
    const logItems = options?.logItems ?? false;
    let inFlight = 0;
    let peakInFlight = 0;
    let completed = 0;

    appendAutoRefreshLog(scope, 'parallel-start', {
        label,
        requestedConcurrency: concurrency,
        concurrency: safeConcurrency,
        totalItems: items.length
    });

    if (!items.length) {
        appendAutoRefreshLog(scope, 'parallel-finish', {
            label,
            totalItems: 0,
            completed: 0,
            peakInFlight: 0,
            durationMs: 0
        });
        return {
            peakInFlight: 0,
            totalItems: 0,
            durationMs: 0
        };
    }

    let cursor = 0;

    const workers = Array.from({ length: Math.min(safeConcurrency, items.length) }, async (_, workerIndex) => {
        const workerId = workerIndex + 1;
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;

            inFlight += 1;
            peakInFlight = Math.max(peakInFlight, inFlight);

            if (logItems) {
                appendAutoRefreshLog(scope, 'parallel-item-start', {
                    label,
                    workerId,
                    itemIndex: index,
                    inFlight,
                    totalItems: items.length
                });
            }

            try {
                await worker(items[index], { workerId, itemIndex: index });
            } finally {
                inFlight -= 1;
                completed += 1;

                if (logItems) {
                    appendAutoRefreshLog(scope, 'parallel-item-finish', {
                        label,
                        workerId,
                        itemIndex: index,
                        inFlight,
                        completed,
                        totalItems: items.length
                    });
                }
            }
        }
    });

    await Promise.all(workers);

    const durationMs = Date.now() - startedAt;
    appendAutoRefreshLog(scope, 'parallel-finish', {
        label,
        totalItems: items.length,
        completed,
        peakInFlight,
        durationMs
    });

    return {
        peakInFlight,
        totalItems: items.length,
        durationMs
    };
}

async function getDueChartRanges(coinId: string): Promise<CoinChartRange[]> {
    const now = Date.now();
    const due = await Promise.all(
        CHART_RANGES.map(async (range) => {
            const snapshot = await readCoinChartSnapshot(coinId, range);
            if (!snapshot) {
                return range;
            }

            const ageMs = now - snapshot.ts;
            return ageMs >= CHART_RANGE_STALE_MS[range] ? range : null;
        })
    );

    return due.filter((range): range is CoinChartRange => range !== null);
}

function logQueueDebug(phase: string, detail: Record<string, unknown> = {}): void {
    const payload = {
        ...detail,
        queueLength: refreshQueue.size,
        queue: toQueueSnapshot(15)
    };

    appendAutoRefreshLog('refresh-queue', phase, payload);

    if (!QUEUE_DEBUG_LOGS_ENABLED) {
        return;
    }

    console.info(`${QUEUE_LOG_PREFIX} ${phase}`, payload);
}

export function getRefreshQueueSnapshot(limit = 25) {
    const safeLimit = Math.max(1, Math.min(200, limit));
    return toQueueSnapshot(safeLimit);
}

function popNextQueueTask(): RefreshTask | null {
    const tasks = [...refreshQueue.values()];
    if (!tasks.length) {
        autoRefreshStatus.queueLength = 0;
        autoRefreshStatus.queueNextTask = null;
        return null;
    }

    tasks.sort((a, b) => {
        if (a.priorityScore !== b.priorityScore) {
            return b.priorityScore - a.priorityScore;
        }

        return a.enqueuedAt - b.enqueuedAt;
    });

    const [selected] = tasks;
    refreshQueue.delete(selected.key);
    autoRefreshStatus.queueLength = refreshQueue.size;

    const nextTask = [...refreshQueue.values()].sort((a, b) => {
        if (a.priorityScore !== b.priorityScore) {
            return b.priorityScore - a.priorityScore;
        }

        return a.enqueuedAt - b.enqueuedAt;
    })[0] ?? null;

    autoRefreshStatus.queueNextTask = nextTask
        ? {
            key: nextTask.key,
            type: nextTask.type,
            coinId: nextTask.coinId,
            priority: nextTask.priority,
            enqueuedAt: nextTask.enqueuedAt,
            reason: nextTask.reason
        }
        : null;

    logQueueDebug('dequeue', {
        key: selected.key,
        type: selected.type,
        coinId: selected.coinId,
        priority: selected.priority,
        reason: selected.reason
    });

    return selected;
}

function enqueueTask(type: RefreshTaskType, coinId: string | null, priority: RefreshPriority, reason: string): void {
    const key = taskKey(type, coinId);
    const now = Date.now();
    const existing = refreshQueue.get(key);
    const candidate: RefreshTask = {
        key,
        type,
        coinId,
        priority,
        priorityScore: REFRESH_PRIORITY_SCORE[priority],
        enqueuedAt: existing?.enqueuedAt ?? now,
        reason
    };

    if (existing) {
        if (candidate.priorityScore >= existing.priorityScore) {
            refreshQueue.set(key, candidate);
            logQueueDebug('enqueue-update', {
                key,
                oldPriority: existing.priority,
                newPriority: candidate.priority,
                reason
            });
        } else {
            logQueueDebug('enqueue-skip-lower-priority', {
                key,
                existingPriority: existing.priority,
                attemptedPriority: candidate.priority,
                reason
            });
        }
    } else {
        refreshQueue.set(key, candidate);
        logQueueDebug('enqueue-new', {
            key,
            type,
            coinId,
            priority,
            reason
        });
    }

    autoRefreshStatus.queueLength = refreshQueue.size;
    const nextTask = [...refreshQueue.values()].sort((a, b) => {
        if (a.priorityScore !== b.priorityScore) {
            return b.priorityScore - a.priorityScore;
        }
        return a.enqueuedAt - b.enqueuedAt;
    })[0] ?? null;
    autoRefreshStatus.queueNextTask = nextTask
        ? {
            key: nextTask.key,
            type: nextTask.type,
            coinId: nextTask.coinId,
            priority: nextTask.priority,
            enqueuedAt: nextTask.enqueuedAt,
            reason: nextTask.reason
        }
        : null;
}

async function runQueueTask(task: RefreshTask): Promise<void> {
    const cooldownMs = TASK_COOLDOWN_MS[task.type];
    const lastRun = taskLastRunAt.get(task.key) ?? 0;
    const now = Date.now();

    if (now - lastRun < cooldownMs) {
        logQueueDebug('cooldown-skip', {
            key: task.key,
            type: task.type,
            coinId: task.coinId,
            cooldownMs,
            ageMs: now - lastRun,
            reason: task.reason
        });
        return;
    }

    taskLastRunAt.set(task.key, now);
    logQueueDebug('execute-start', {
        key: task.key,
        type: task.type,
        coinId: task.coinId,
        priority: task.priority,
        reason: task.reason
    });

    if (task.type === 'markets') {
        await refreshMarketsNow(fetch);
        logQueueDebug('execute-success', {
            key: task.key,
            type: task.type,
            coinId: task.coinId
        });
        return;
    }

    if (task.coinId) {
        await refreshCoinNow(fetch, task.coinId);
        logQueueDebug('execute-success', {
            key: task.key,
            type: task.type,
            coinId: task.coinId
        });
    }
}

async function processRefreshQueue(): Promise<void> {
    if (queueTaskRunning || autoRefreshRunning) {
        return;
    }

    const task = popNextQueueTask();
    if (!task) {
        return;
    }

    queueTaskRunning = true;
    try {
        await runQueueTask(task);
    } catch (error) {
        logQueueDebug('execute-failed', {
            key: task.key,
            type: task.type,
            coinId: task.coinId,
            reason: task.reason,
            error: error instanceof Error ? error.message : String(error)
        });
        console.warn(`${AUTO_REFRESH_LOG_PREFIX} queued task failed`, {
            key: task.key,
            type: task.type,
            coinId: task.coinId,
            reason: task.reason,
            error: error instanceof Error ? error.message : String(error)
        });
    } finally {
        queueTaskRunning = false;
    }
}

export function enqueueMarketsRefresh(priority: RefreshPriority = 'low', reason = 'background-update'): void {
    enqueueTask('markets', null, priority, reason);
}

export function enqueueCoinRefresh(coinId: string, priority: RefreshPriority = 'normal', reason = 'background-update'): void {
    if (!coinId) {
        return;
    }

    enqueueTask('coin-full', coinId, priority, reason);
}

async function refreshMarketsFromUpstream(fetchFn: typeof fetch): Promise<MarketCoin[]> {
    const startedAt = Date.now();
    console.info(`${AUTO_REFRESH_LOG_PREFIX} markets refresh start`, {
        startedAt
    });

    const coins = await getTopMarketCoins(fetchFn);
    const global = await getGlobalMarketSummary(fetchFn, coins);
    await writePersistentMarketSnapshot('coingecko-auto-refresh', coins, global);

    console.info(`${AUTO_REFRESH_LOG_PREFIX} markets refresh success`, {
        startedAt,
        finishedAt: Date.now(),
        coinCount: coins.length
    });

    return coins;
}

export async function refreshTrackedCoinData(fetchFn: typeof fetch, marketCoinIds: string[] = []): Promise<void> {
    const trackedCoinIds = await listTrackedCoinIds();
    const normalizedMarketIds = marketCoinIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .slice(0, MARKET_SWEEP_LIMIT);
    const coinIds = Array.from(new Set([...trackedCoinIds, ...normalizedMarketIds]));

    const startedAt = Date.now();
    console.info(`${AUTO_REFRESH_LOG_PREFIX} tracked coin refresh start`, {
        startedAt,
        trackedCoinCount: trackedCoinIds.length,
        marketCoinCount: normalizedMarketIds.length,
        sweepCoinCount: coinIds.length
    });
    autoRefreshStatus.lastSweepCoinCount = coinIds.length;

    if (!coinIds.length) {
        console.info(`${AUTO_REFRESH_LOG_PREFIX} tracked coin refresh noop`, {
            startedAt,
            finishedAt: Date.now(),
            reason: 'no-sweep-coins'
        });
        return;
    }

    let coinSuccessCount = 0;
    let coinFailureCount = 0;
    let chartSuccessCount = 0;
    let chartFailureCount = 0;

    let peakCoinInFlight = 0;
    let peakChartInFlight = 0;

    const coinPoolStats = await runWithConcurrency(coinIds, COIN_REFRESH_CONCURRENCY, async (coinId) => {
        const coinStartedAt = Date.now();
        console.info(`${AUTO_REFRESH_LOG_PREFIX} coin refresh start`, {
            coinId,
            startedAt: coinStartedAt
        });

        try {
            const breakdown = await getCoinBreakdown(fetchFn, coinId);
            await writeCoinBreakdownSnapshot(coinId, breakdown);
            coinSuccessCount += 1;
            console.info(`${AUTO_REFRESH_LOG_PREFIX} coin refresh success`, {
                coinId,
                startedAt: coinStartedAt,
                finishedAt: Date.now(),
                source: breakdown.source
            });

            const dueRanges = await getDueChartRanges(coinId);
            if (!dueRanges.length) {
                console.info(`${AUTO_REFRESH_LOG_PREFIX} chart refresh noop`, {
                    coinId,
                    reason: 'all-ranges-fresh'
                });
                return;
            }

            const chartPoolStats = await runWithConcurrency(dueRanges, CHART_REFRESH_CONCURRENCY, async (range, chartWorkerContext) => {
                const chartStartedAt = Date.now();
                console.info(`${AUTO_REFRESH_LOG_PREFIX} chart refresh start`, {
                    coinId,
                    range,
                    startedAt: chartStartedAt,
                    workerId: chartWorkerContext.workerId
                });

                try {
                    const series = await getCoinChartSeries(fetchFn, coinId, range);
                    if (series.source === 'coingecko' || series.source === 'cryptocompare') {
                        await writeCoinChartSnapshot(coinId, range, series);
                        chartSuccessCount += 1;
                        console.info(`${AUTO_REFRESH_LOG_PREFIX} chart refresh success`, {
                            coinId,
                            range,
                            startedAt: chartStartedAt,
                            finishedAt: Date.now(),
                            source: series.source,
                            points: series.prices.length
                        });
                    } else {
                        console.warn(`${AUTO_REFRESH_LOG_PREFIX} chart refresh skipped`, {
                            coinId,
                            range,
                            startedAt: chartStartedAt,
                            finishedAt: Date.now(),
                            source: series.source,
                            reason: 'non-persistable-source'
                        });
                    }
                } catch (error) {
                    chartFailureCount += 1;
                    console.warn(`${AUTO_REFRESH_LOG_PREFIX} chart refresh failed for ${coinId}/${range}:`, error);
                }
            }, {
                scope: 'refresh-tracked-coins',
                label: `charts:${coinId}`,
                logItems: true
            });

            peakChartInFlight = Math.max(peakChartInFlight, chartPoolStats.peakInFlight);
        } catch (error) {
            coinFailureCount += 1;
            console.warn(`${AUTO_REFRESH_LOG_PREFIX} coin refresh failed for ${coinId}:`, error);
        }
    }, {
        scope: 'refresh-tracked-coins',
        label: 'coins',
        logItems: true
    });

    peakCoinInFlight = coinPoolStats.peakInFlight;

    console.info(`${AUTO_REFRESH_LOG_PREFIX} tracked coin refresh finished`, {
        startedAt,
        finishedAt: Date.now(),
        sweepCoinCount: coinIds.length,
        coinSuccessCount,
        coinFailureCount,
        chartSuccessCount,
        chartFailureCount,
        peakCoinInFlight,
        peakChartInFlight
    });
}

async function runAutoRefresh(): Promise<void> {
    if (autoRefreshRunning) {
        pushAutoRefreshEvent({
            ts: Date.now(),
            type: 'cycle-skipped',
            detail: { reason: 'already-running' }
        });
        console.info(`${AUTO_REFRESH_LOG_PREFIX} refresh cycle skipped`, {
            reason: 'already-running',
            ts: Date.now()
        });
        return;
    }

    autoRefreshRunning = true;
    autoRefreshStatus.running = true;
    const startedAt = Date.now();
    autoRefreshStatus.cycleCount += 1;
    autoRefreshStatus.lastCycleStartedAt = startedAt;
    autoRefreshStatus.lastCycleFinishedAt = null;
    autoRefreshStatus.nextCycleAt = startedAt + AUTO_REFRESH_INTERVAL_MS;
    pushAutoRefreshEvent({
        ts: startedAt,
        type: 'cycle-start',
        detail: { cycleCount: autoRefreshStatus.cycleCount }
    });
    console.info(`${AUTO_REFRESH_LOG_PREFIX} refresh cycle start`, {
        startedAt
    });

    try {
        const marketCoins = await refreshMarketsFromUpstream(fetch);
        await refreshTrackedCoinData(fetch, marketCoins.map((coin) => coin.id));
        autoRefreshStatus.lastCycleOk = true;
        pushAutoRefreshEvent({
            ts: Date.now(),
            type: 'cycle-success',
            detail: {
                cycleCount: autoRefreshStatus.cycleCount,
                sweepCoinCount: autoRefreshStatus.lastSweepCoinCount
            }
        });
        console.info(`${AUTO_REFRESH_LOG_PREFIX} refresh cycle success`, {
            startedAt,
            finishedAt: Date.now()
        });
    } catch (error) {
        autoRefreshStatus.lastCycleOk = false;
        autoRefreshStatus.lastCycleError = error instanceof Error ? error.message : String(error);
        pushAutoRefreshEvent({
            ts: Date.now(),
            type: 'cycle-failed',
            detail: {
                cycleCount: autoRefreshStatus.cycleCount,
                error: autoRefreshStatus.lastCycleError
            }
        });
        console.warn(`${AUTO_REFRESH_LOG_PREFIX} refresh cycle failed:`, error);
    } finally {
        autoRefreshRunning = false;
        autoRefreshStatus.running = false;
        autoRefreshStatus.lastCycleFinishedAt = Date.now();
    }
}

export function ensureAutoRefreshStarted(): void {
    if (autoRefreshStarted) {
        console.info(`${AUTO_REFRESH_LOG_PREFIX} ensureAutoRefreshStarted noop`, {
            reason: 'already-started',
            ts: Date.now()
        });
        return;
    }

    autoRefreshStarted = true;
    autoRefreshStatus.schedulerStarted = true;
    autoRefreshStatus.nextCycleAt = Date.now() + AUTO_REFRESH_INTERVAL_MS;
    pushAutoRefreshEvent({
        ts: Date.now(),
        type: 'scheduler-started',
        detail: {
            intervalMs: AUTO_REFRESH_INTERVAL_MS
        }
    });
    console.info(`${AUTO_REFRESH_LOG_PREFIX} auto-refresh scheduler started`, {
        intervalMs: AUTO_REFRESH_INTERVAL_MS,
        ts: Date.now()
    });

    autoRefreshTimer = setInterval(() => {
        void runAutoRefresh();
    }, AUTO_REFRESH_INTERVAL_MS);

    queueTimer = setInterval(() => {
        void processRefreshQueue();
    }, QUEUE_POLL_INTERVAL_MS);

    if (typeof autoRefreshTimer.unref === 'function') {
        autoRefreshTimer.unref();
    }
    if (queueTimer && typeof queueTimer.unref === 'function') {
        queueTimer.unref();
    }

    void runAutoRefresh();
}

export async function refreshCoinNow(fetchFn: typeof fetch, coinId: string): Promise<void> {
    const startedAt = Date.now();
    pushAutoRefreshEvent({
        ts: startedAt,
        type: 'ad-hoc-coin-start',
        detail: { coinId }
    });
    autoRefreshStatus.lastAdHocCoin = {
        coinId,
        startedAt,
        finishedAt: null,
        ok: null,
        error: null
    };
    console.info(`${AUTO_REFRESH_LOG_PREFIX} ad-hoc coin refresh start`, {
        coinId,
        startedAt
    });

    try {
        const breakdown = await getCoinBreakdown(fetchFn, coinId);
        await writeCoinBreakdownSnapshot(coinId, breakdown);

        let chartSuccessCount = 0;
        let chartFailureCount = 0;

        const dueRanges = await getDueChartRanges(coinId);
        if (!dueRanges.length) {
            console.info(`${AUTO_REFRESH_LOG_PREFIX} ad-hoc chart refresh noop`, {
                coinId,
                reason: 'all-ranges-fresh'
            });
        }

        const chartPoolStats = await runWithConcurrency(dueRanges, CHART_REFRESH_CONCURRENCY, async (range, chartWorkerContext) => {
            try {
                const series = await getCoinChartSeries(fetchFn, coinId, range);
                if (series.source === 'coingecko' || series.source === 'cryptocompare') {
                    await writeCoinChartSnapshot(coinId, range, series);
                    chartSuccessCount += 1;
                } else {
                    console.warn(`${AUTO_REFRESH_LOG_PREFIX} ad-hoc chart refresh skipped`, {
                        coinId,
                        range,
                        workerId: chartWorkerContext.workerId,
                        source: series.source,
                        reason: 'non-persistable-source'
                    });
                }
            } catch (error) {
                chartFailureCount += 1;
                console.warn(`${AUTO_REFRESH_LOG_PREFIX} ad-hoc chart refresh failed for ${coinId}/${range}:`, error);
            }
        }, {
            scope: 'refresh-ad-hoc-coin',
            label: `charts:${coinId}`,
            logItems: true
        });

        console.info(`${AUTO_REFRESH_LOG_PREFIX} ad-hoc coin refresh success`, {
            coinId,
            startedAt,
            finishedAt: Date.now(),
            breakdownSource: breakdown.source,
            chartSuccessCount,
            chartFailureCount,
            peakChartInFlight: chartPoolStats.peakInFlight
        });
        autoRefreshStatus.lastAdHocCoin = {
            coinId,
            startedAt,
            finishedAt: Date.now(),
            ok: true,
            error: null
        };
        pushAutoRefreshEvent({
            ts: Date.now(),
            type: 'ad-hoc-coin-success',
            detail: {
                coinId,
                chartSuccessCount,
                chartFailureCount
            }
        });
    } catch (error) {
        console.warn(`${AUTO_REFRESH_LOG_PREFIX} ad-hoc coin refresh failed for ${coinId}:`, error);
        autoRefreshStatus.lastAdHocCoin = {
            coinId,
            startedAt,
            finishedAt: Date.now(),
            ok: false,
            error: error instanceof Error ? error.message : String(error)
        };
        pushAutoRefreshEvent({
            ts: Date.now(),
            type: 'ad-hoc-coin-failed',
            detail: {
                coinId,
                error: error instanceof Error ? error.message : String(error)
            }
        });
    }
}

export async function refreshMarketsNow(fetchFn: typeof fetch): Promise<void> {
    const startedAt = Date.now();
    console.info(`${AUTO_REFRESH_LOG_PREFIX} ad-hoc markets refresh start`, {
        startedAt
    });

    try {
        await refreshMarketsFromUpstream(fetchFn);
        console.info(`${AUTO_REFRESH_LOG_PREFIX} ad-hoc markets refresh success`, {
            startedAt,
            finishedAt: Date.now()
        });
    } catch (error) {
        console.warn(`${AUTO_REFRESH_LOG_PREFIX} ad-hoc markets refresh failed:`, error);
    }
}
