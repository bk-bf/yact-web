import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { MarketCoin } from '../types/market';
import type { GlobalMarketSummary } from './coingecko';

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_DIR = path.join(process.cwd(), '.cache');
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'markets-snapshot.json');
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

export async function readPersistentMarketSnapshot(): Promise<PersistentMarketSnapshot | null> {
    try {
        const raw = await readFile(SNAPSHOT_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!isValidSnapshot(parsed)) {
            console.warn(`${SNAPSHOT_LOG_PREFIX} invalid snapshot payload at ${SNAPSHOT_FILE}`);
            return null;
        }

        const ageSeconds = Math.max(0, Math.floor((Date.now() - parsed.ts) / 1000));
        console.info(
            `${SNAPSHOT_LOG_PREFIX} loaded snapshot from ${SNAPSHOT_FILE} ` +
            `(source=${parsed.source}, count=${parsed.count}, age_s=${ageSeconds})`
        );

        return parsed;
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            console.info(`${SNAPSHOT_LOG_PREFIX} no snapshot file found at ${SNAPSHOT_FILE}`);
            return null;
        }

        console.error(`${SNAPSHOT_LOG_PREFIX} failed to read snapshot from ${SNAPSHOT_FILE}:`, error);
        return null;
    }
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
        await writeFile(SNAPSHOT_FILE, JSON.stringify(snapshot), 'utf-8');
        console.info(
            `${SNAPSHOT_LOG_PREFIX} wrote snapshot to ${SNAPSHOT_FILE} ` +
            `(source=${source}, count=${coins.length}, ts=${snapshot.ts})`
        );
    } catch (error) {
        console.error(`${SNAPSHOT_LOG_PREFIX} failed to write snapshot to ${SNAPSHOT_FILE}:`, error);
        throw error;
    }
}
