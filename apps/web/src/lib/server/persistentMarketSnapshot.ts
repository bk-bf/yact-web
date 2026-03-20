import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { MarketCoin } from '../types/market';
import type { GlobalMarketSummary } from './coingecko';
import { getDataDir } from './dataPaths';

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_DIR = getDataDir();
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'markets-snapshot.json');
const SNAPSHOT_BACKUP_FILE = path.join(SNAPSHOT_DIR, 'markets-snapshot.backup.json');
const SNAPSHOT_LOG_PREFIX = '[market-snapshot]';

export interface PersistentMarketSnapshot {
    v: number;
    ts: number;
    source: string;
    count: number;
    coins: MarketCoin[];
    global: GlobalMarketSummary;
}

function isValidSnapshot(value: unknown): value is PersistentMarketSnapshot {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const snapshot = value as Partial<PersistentMarketSnapshot>;
    return (
        snapshot.v === SNAPSHOT_VERSION &&
        typeof snapshot.ts === 'number' &&
        typeof snapshot.source === 'string' &&
        typeof snapshot.count === 'number' &&
        Array.isArray(snapshot.coins) &&
        snapshot.global !== undefined
    );
}

function normalizeSnapshotLike(value: unknown): PersistentMarketSnapshot | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const snapshot = value as Partial<PersistentMarketSnapshot>;
    if (typeof snapshot.source !== 'string' || typeof snapshot.count !== 'number' || !Array.isArray(snapshot.coins) || snapshot.global === undefined) {
        return null;
    }

    return {
        v: SNAPSHOT_VERSION,
        ts: typeof snapshot.ts === 'number' ? snapshot.ts : Date.now(),
        source: snapshot.source,
        count: snapshot.count,
        coins: snapshot.coins,
        global: snapshot.global
    };
}

async function tryReadSnapshotFile(filePath: string): Promise<PersistentMarketSnapshot | null> {
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
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            return null;
        }

        console.error(`${SNAPSHOT_LOG_PREFIX} failed to read snapshot from ${filePath}:`, error);
        return null;
    }
}

export async function readPersistentMarketSnapshot(): Promise<PersistentMarketSnapshot | null> {
    const primary = await tryReadSnapshotFile(SNAPSHOT_FILE);
    const snapshot = primary ?? await tryReadSnapshotFile(SNAPSHOT_BACKUP_FILE);

    if (!snapshot) {
        console.info(`${SNAPSHOT_LOG_PREFIX} no readable snapshot file found`);
        return null;
    }

    const sourceFile = primary ? SNAPSHOT_FILE : SNAPSHOT_BACKUP_FILE;
    const ageSeconds = Math.max(0, Math.floor((Date.now() - snapshot.ts) / 1000));
    console.info(
        `${SNAPSHOT_LOG_PREFIX} loaded snapshot from ${sourceFile} ` +
        `(source=${snapshot.source}, count=${snapshot.count}, age_s=${ageSeconds})`
    );

    return snapshot;
}

export async function writePersistentMarketSnapshot(
    source: string,
    coins: MarketCoin[],
    global: GlobalMarketSummary
): Promise<void> {
    const snapshot: PersistentMarketSnapshot = {
        v: SNAPSHOT_VERSION,
        ts: Date.now(),
        source,
        count: coins.length,
        coins,
        global
    };

    try {
        await mkdir(SNAPSHOT_DIR, { recursive: true });
        const serialized = JSON.stringify(snapshot);
        const tempFile = `${SNAPSHOT_FILE}.tmp`;
        await writeFile(tempFile, serialized, 'utf-8');
        await rename(tempFile, SNAPSHOT_FILE);
        await writeFile(SNAPSHOT_BACKUP_FILE, serialized, 'utf-8');
        console.info(
            `${SNAPSHOT_LOG_PREFIX} wrote snapshot to ${SNAPSHOT_FILE} ` +
            `(source=${source}, count=${coins.length}, ts=${snapshot.ts})`
        );
    } catch (error) {
        console.error(`${SNAPSHOT_LOG_PREFIX} failed to write snapshot to ${SNAPSHOT_FILE}:`, error);
        throw error;
    }
}
