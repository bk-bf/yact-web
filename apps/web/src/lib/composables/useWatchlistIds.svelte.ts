/**
 * useWatchlistIds — persistent user watchlist ID list.
 *
 * Stores a list of coin IDs in localStorage under "yact:watchlist:ids".
 * This is DATA state (which coins the user watches), not display state —
 * it intentionally lives outside useViewSettings.
 *
 * Follows the same createXxx / $state / persist() pattern as useViewSettings.
 */

import { DEFAULT_WATCHLIST_IDS } from "../pages/watchlist/watchlist-page.data";

export const WATCHLIST_IDS_STORAGE_KEY = "yact:watchlist:ids";
export const WATCHLIST_IDS_CONTEXT_KEY = "yact:watchlist-ids";
export type WatchlistIdsContext = ReturnType<typeof createWatchlistIds>;

function loadPersistedIds(): string[] {
    try {
        const raw =
            typeof localStorage !== "undefined" &&
            localStorage.getItem(WATCHLIST_IDS_STORAGE_KEY);
        if (!raw) return [...DEFAULT_WATCHLIST_IDS];
        const parsed: unknown = JSON.parse(raw);
        if (
            Array.isArray(parsed) &&
            parsed.length > 0 &&
            parsed.every((id) => typeof id === "string" && id.trim().length > 0)
        ) {
            return parsed as string[];
        }
        return [...DEFAULT_WATCHLIST_IDS];
    } catch {
        return [...DEFAULT_WATCHLIST_IDS];
    }
}

export function createWatchlistIds() {
    let ids = $state<string[]>(loadPersistedIds());

    function persist(): void {
        try {
            localStorage.setItem(WATCHLIST_IDS_STORAGE_KEY, JSON.stringify(ids));
        } catch {
            // storage unavailable (private browsing quota, etc.) — silently ignore
        }
    }

    return {
        getIds(): string[] {
            return ids;
        },
        addId(id: string): void {
            const normalized = id.trim().toLowerCase();
            if (!normalized || ids.includes(normalized)) return;
            ids = [...ids, normalized];
            persist();
        },
        removeId(id: string): void {
            ids = ids.filter((i) => i !== id);
            persist();
        },
    };
}
