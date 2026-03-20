/**
 * Database writer for persisting YACT snapshots to PostgreSQL.
 * This module provides functions to persist market, coin, and headline data
 * to Postgres via the analytics API.
 */

import { dev } from "$app/environment";

const ANALYTICS_BASE_URL = dev
    ? process.env.YACT_ANALYTICS_URL || "http://localhost:8000"
    : process.env.YACT_ANALYTICS_URL || "https://analytics.yact.local";

type DatabaseWriteResult = {
    success: boolean;
    error?: string;
    count?: number;
};

/**
 * Persist market snapshot to database.
 * This replaces the file-based snapshot methodology.
 */
export async function persistMarketSnapshot(
    snapshot: any
): Promise<DatabaseWriteResult> {
    try {
        const response = await fetch(`${ANALYTICS_BASE_URL}/api/v1/admin/market-snapshot`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(snapshot),
        });

        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: ${await response.text()}`
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: `Failed to persist market snapshot: ${error}`
        };
    }
}

/**
 * Persist coin snapshot to database.
 */
export async function persistCoinSnapshot(
    snapshot: any
): Promise<DatabaseWriteResult> {
    try {
        const response = await fetch(`${ANALYTICS_BASE_URL}/api/v1/admin/coin-snapshot`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(snapshot),
        });

        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: ${await response.text()}`
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: `Failed to persist coin snapshot: ${error}`
        };
    }
}

/**
 * Persist headlines snapshot to database.
 */
export async function persistHeadlinesSnapshot(
    snapshot: any
): Promise<DatabaseWriteResult> {
    try {
        const response = await fetch(`${ANALYTICS_BASE_URL}/api/v1/admin/headlines-snapshot`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(snapshot),
        });

        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: ${await response.text()}`
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: `Failed to persist headlines snapshot: ${error}`
        };
    }
}

/**
 * Update refresh state in database.
 */
export async function updateRefreshState(
    state: any
): Promise<DatabaseWriteResult> {
    try {
        const response = await fetch(`${ANALYTICS_BASE_URL}/api/v1/admin/refresh-state`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(state),
        });

        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: ${await response.text()}`
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: `Failed to update refresh state: ${error}`
        };
    }
}

/**
 * Log a refresh operation to database.
 */
export async function logRefreshOperation(
    entry: any
): Promise<DatabaseWriteResult> {
    try {
        const response = await fetch(`${ANALYTICS_BASE_URL}/api/v1/admin/refresh-log`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(entry),
        });

        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: ${await response.text()}`
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: `Failed to log refresh operation: ${error}`
        };
    }
}
