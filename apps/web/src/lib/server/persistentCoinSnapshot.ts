import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CoinBreakdown, CoinChartRange, CoinChartSeries } from './coingecko';

const SNAPSHOT_VERSION = 1;
const DESCRIPTION_REVALIDATE_MS = 14 * 24 * 60 * 60_000;
const SNAPSHOT_DIR = path.join(process.cwd(), '.cache');
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'coin-snapshot.json');
const SNAPSHOT_BACKUP_FILE = path.join(SNAPSHOT_DIR, 'coin-snapshot.backup.json');
const SNAPSHOT_LOG_PREFIX = '[coin-snapshot]';

interface StoredCoinBreakdown {
    ts: number;
    value: CoinBreakdown;
}

interface StoredCoinChartSeries {
    ts: number;
    value: CoinChartSeries;
}

interface StoredCoinEntry {
    breakdown?: StoredCoinBreakdown;
    charts?: Partial<Record<CoinChartRange, StoredCoinChartSeries>>;
}

interface PersistentCoinSnapshot {
    v: number;
    updatedAt: number;
    coins: Record<string, StoredCoinEntry>;
}

export interface PersistedCoinBreakdown {
    ts: number;
    value: CoinBreakdown;
}

export interface PersistedCoinChartSeries {
    ts: number;
    value: CoinChartSeries;
}

function pickNonEmptyString(primary: string, fallback: string): string {
    return primary.trim().length > 0 ? primary : fallback;
}

function pickNonEmptyNullableString(primary: string | null, fallback: string | null): string | null {
    if (primary && primary.trim().length > 0) {
        return primary;
    }

    return fallback;
}

function mergeCoinBreakdownPreservingDetails(
    existing: CoinBreakdown | undefined,
    existingTs: number | undefined,
    incoming: CoinBreakdown
): CoinBreakdown {
    if (!existing) {
        return incoming;
    }

    const existingDescription = existing.description.trim();
    const incomingDescription = incoming.description.trim();
    const existingDescriptionIsFresh =
        typeof existingTs === 'number' &&
        Date.now() - existingTs < DESCRIPTION_REVALIDATE_MS;

    // Keep description stable: prefer existing text unless a scheduled CoinGecko revalidation window has passed.
    const description = existingDescription.length > 0 && (
        incoming.source !== 'coingecko' ||
        existingDescriptionIsFresh ||
        incomingDescription.length === 0
    )
        ? existing.description
        : pickNonEmptyString(incoming.description, existing.description);

    const merged: CoinBreakdown = {
        ...incoming,
        maxSupply: incoming.maxSupply ?? existing.maxSupply,
        allTimeHigh: incoming.allTimeHigh > 0 ? incoming.allTimeHigh : existing.allTimeHigh,
        allTimeHighDate: pickNonEmptyNullableString(incoming.allTimeHighDate, existing.allTimeHighDate),
        allTimeLow: incoming.allTimeLow > 0 ? incoming.allTimeLow : existing.allTimeLow,
        allTimeLowDate: pickNonEmptyNullableString(incoming.allTimeLowDate, existing.allTimeLowDate),
        low24h: incoming.low24h ?? existing.low24h,
        high24h: incoming.high24h ?? existing.high24h,
        categories: incoming.categories.length > 0 ? incoming.categories : existing.categories,
        description,
        homepage: pickNonEmptyNullableString(incoming.homepage, existing.homepage),
        blockchainSite: pickNonEmptyNullableString(incoming.blockchainSite, existing.blockchainSite),
        sparkline7d: incoming.sparkline7d.length > 1 ? incoming.sparkline7d : existing.sparkline7d,
        chartPrices7d: incoming.chartPrices7d.length > 1 ? incoming.chartPrices7d : existing.chartPrices7d,
        chartVolumes7d: incoming.chartVolumes7d.length > 1 ? incoming.chartVolumes7d : existing.chartVolumes7d
    };

    return merged;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isValidSnapshot(value: unknown): value is PersistentCoinSnapshot {
    if (!isObject(value)) {
        return false;
    }

    if (value.v !== SNAPSHOT_VERSION || typeof value.updatedAt !== 'number' || !isObject(value.coins)) {
        return false;
    }

    return true;
}

function normalizeSnapshotLike(value: unknown): PersistentCoinSnapshot | null {
    if (!isObject(value)) {
        return null;
    }

    const coinsRaw = value.coins;
    if (!isObject(coinsRaw)) {
        return null;
    }

    const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : Date.now();
    const normalized: PersistentCoinSnapshot = {
        v: SNAPSHOT_VERSION,
        updatedAt,
        coins: {}
    };

    for (const [coinId, entryRaw] of Object.entries(coinsRaw)) {
        if (!isObject(entryRaw)) {
            continue;
        }

        const entry: StoredCoinEntry = {};

        if (isObject(entryRaw.breakdown) && typeof entryRaw.breakdown.ts === 'number' && entryRaw.breakdown.value) {
            entry.breakdown = {
                ts: entryRaw.breakdown.ts,
                value: entryRaw.breakdown.value as CoinBreakdown
            };
        }

        if (isObject(entryRaw.charts)) {
            const charts: Partial<Record<CoinChartRange, StoredCoinChartSeries>> = {};
            for (const [range, seriesRaw] of Object.entries(entryRaw.charts)) {
                if (!isObject(seriesRaw) || typeof seriesRaw.ts !== 'number' || !seriesRaw.value) {
                    continue;
                }

                charts[range as CoinChartRange] = {
                    ts: seriesRaw.ts,
                    value: seriesRaw.value as CoinChartSeries
                };
            }

            if (Object.keys(charts).length > 0) {
                entry.charts = charts;
            }
        }

        if (entry.breakdown || entry.charts) {
            normalized.coins[coinId] = entry;
        }
    }

    return normalized;
}

async function tryReadSnapshotFile(filePath: string): Promise<PersistentCoinSnapshot | null> {
    try {
        const raw = await readFile(filePath, 'utf-8');
        const parsed = JSON.parse(raw);

        if (isValidSnapshot(parsed)) {
            return parsed;
        }

        const migrated = normalizeSnapshotLike(parsed);
        if (migrated) {
            console.warn(`${SNAPSHOT_LOG_PREFIX} migrated snapshot payload from ${filePath}`);
            return migrated;
        }

        return null;
    } catch (error) {
        if (isObject(error) && error.code === 'ENOENT') {
            return null;
        }

        console.error(`${SNAPSHOT_LOG_PREFIX} failed to read ${filePath}:`, error);
        return null;
    }
}

async function readSnapshot(): Promise<PersistentCoinSnapshot> {
    const primary = await tryReadSnapshotFile(SNAPSHOT_FILE);
    if (primary) {
        return primary;
    }

    const backup = await tryReadSnapshotFile(SNAPSHOT_BACKUP_FILE);
    if (backup) {
        console.warn(`${SNAPSHOT_LOG_PREFIX} recovered snapshot from backup file`);
        return backup;
    }

    return {
        v: SNAPSHOT_VERSION,
        updatedAt: Date.now(),
        coins: {}
    };
}

async function writeSnapshot(snapshot: PersistentCoinSnapshot): Promise<void> {
    await mkdir(SNAPSHOT_DIR, { recursive: true });
    const serialized = JSON.stringify(snapshot);
    const tempFile = `${SNAPSHOT_FILE}.tmp`;
    await writeFile(tempFile, serialized, 'utf-8');
    await rename(tempFile, SNAPSHOT_FILE);
    await writeFile(SNAPSHOT_BACKUP_FILE, serialized, 'utf-8');
}

export async function readCoinBreakdownSnapshot(coinId: string): Promise<PersistedCoinBreakdown | null> {
    const snapshot = await readSnapshot();
    const entry = snapshot.coins[coinId];
    if (!entry?.breakdown) {
        return null;
    }

    return entry.breakdown;
}

export async function writeCoinBreakdownSnapshot(coinId: string, breakdown: CoinBreakdown): Promise<void> {
    const snapshot = await readSnapshot();
    const existing = snapshot.coins[coinId] ?? {};
    const mergedBreakdown = mergeCoinBreakdownPreservingDetails(
        existing.breakdown?.value,
        existing.breakdown?.ts,
        breakdown
    );

    snapshot.coins[coinId] = {
        ...existing,
        breakdown: {
            ts: Date.now(),
            value: mergedBreakdown
        }
    };
    snapshot.updatedAt = Date.now();

    try {
        await writeSnapshot(snapshot);
    } catch (error) {
        console.error(`${SNAPSHOT_LOG_PREFIX} failed to write breakdown for ${coinId}:`, error);
        throw error;
    }
}

export async function readCoinChartSnapshot(
    coinId: string,
    range: CoinChartRange
): Promise<PersistedCoinChartSeries | null> {
    const snapshot = await readSnapshot();
    const entry = snapshot.coins[coinId];
    const chart = entry?.charts?.[range];

    return chart ?? null;
}

export async function writeCoinChartSnapshot(
    coinId: string,
    range: CoinChartRange,
    series: CoinChartSeries
): Promise<void> {
    const snapshot = await readSnapshot();
    const existing = snapshot.coins[coinId] ?? {};

    snapshot.coins[coinId] = {
        ...existing,
        charts: {
            ...(existing.charts ?? {}),
            [range]: {
                ts: Date.now(),
                value: series
            }
        }
    };
    snapshot.updatedAt = Date.now();

    try {
        await writeSnapshot(snapshot);
    } catch (error) {
        console.error(`${SNAPSHOT_LOG_PREFIX} failed to write chart for ${coinId}/${range}:`, error);
        throw error;
    }
}

export async function listTrackedCoinIds(): Promise<string[]> {
    const snapshot = await readSnapshot();
    return Object.keys(snapshot.coins);
}

export async function readCoinLatestSnapshotTs(coinId: string): Promise<number | null> {
    const snapshot = await readSnapshot();
    const entry = snapshot.coins[coinId];
    if (!entry) {
        return null;
    }

    let latestTs = entry.breakdown?.ts ?? null;
    const charts = entry.charts ? Object.values(entry.charts) : [];
    for (const chart of charts) {
        if (!chart) {
            continue;
        }

        latestTs = latestTs === null ? chart.ts : Math.max(latestTs, chart.ts);
    }

    return latestTs;
}
