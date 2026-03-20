import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CryptoHeadline } from './headlines';
import { getDataDir } from './dataPaths';

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_DIR = getDataDir();
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'headlines-snapshot.json');
const SNAPSHOT_BACKUP_FILE = path.join(SNAPSHOT_DIR, 'headlines-snapshot.backup.json');
const SNAPSHOT_LOG_PREFIX = '[headlines-snapshot]';

interface PersistentHeadlinesSnapshot {
    v: number;
    ts: number;
    source: string;
    headlines: CryptoHeadline[];
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isValidHeadline(value: unknown): value is CryptoHeadline {
    if (!isObject(value)) {
        return false;
    }

    return (
        typeof value.id === 'string' &&
        typeof value.title === 'string' &&
        typeof value.url === 'string' &&
        typeof value.source === 'string' &&
        typeof value.publishedAt === 'string'
    );
}

function isValidSnapshot(value: unknown): value is PersistentHeadlinesSnapshot {
    if (!isObject(value)) {
        return false;
    }

    return (
        value.v === SNAPSHOT_VERSION &&
        typeof value.ts === 'number' &&
        typeof value.source === 'string' &&
        Array.isArray(value.headlines) &&
        value.headlines.every(isValidHeadline)
    );
}

function normalizeSnapshotLike(value: unknown): PersistentHeadlinesSnapshot | null {
    if (!isObject(value) || !Array.isArray(value.headlines)) {
        return null;
    }

    const headlines = value.headlines.filter(isValidHeadline);
    if (!headlines.length) {
        return null;
    }

    return {
        v: SNAPSHOT_VERSION,
        ts: typeof value.ts === 'number' ? value.ts : Date.now(),
        source: typeof value.source === 'string' ? value.source : 'unknown',
        headlines
    };
}

async function tryReadSnapshotFile(filePath: string): Promise<PersistentHeadlinesSnapshot | null> {
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

export async function readPersistentHeadlinesSnapshot(): Promise<PersistentHeadlinesSnapshot | null> {
    const primary = await tryReadSnapshotFile(SNAPSHOT_FILE);
    if (primary) {
        return primary;
    }

    const backup = await tryReadSnapshotFile(SNAPSHOT_BACKUP_FILE);
    if (backup) {
        console.warn(`${SNAPSHOT_LOG_PREFIX} recovered snapshot from backup file`);
        return backup;
    }

    return null;
}

export async function writePersistentHeadlinesSnapshot(source: string, headlines: CryptoHeadline[]): Promise<void> {
    if (!headlines.length) {
        return;
    }

    const snapshot: PersistentHeadlinesSnapshot = {
        v: SNAPSHOT_VERSION,
        ts: Date.now(),
        source,
        headlines
    };

    try {
        await mkdir(SNAPSHOT_DIR, { recursive: true });
        const serialized = JSON.stringify(snapshot);
        const tempFile = `${SNAPSHOT_FILE}.tmp`;
        await writeFile(tempFile, serialized, 'utf-8');
        await rename(tempFile, SNAPSHOT_FILE);
        await writeFile(SNAPSHOT_BACKUP_FILE, serialized, 'utf-8');
    } catch (error) {
        console.error(`${SNAPSHOT_LOG_PREFIX} failed to write headlines snapshot:`, error);
    }
}
