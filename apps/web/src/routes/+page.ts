import { browser } from '$app/environment';
import type { PageLoad } from './$types';

import {
    getMarketsDataCache,
    hasMeaningfulMarketsPayload,
    loadMarketsPageData,
    setMarketsDataCache,
} from '../lib/pages/markets/markets-page.data';

// Ownership contract (BUG-002 fix):
// - SSR / first cold browser visit: fetches real data, caches result.
// - Subsequent browser navigations: serve cached data instantly (no zero-state
//   flash), then revalidate in the background so the next visit is fresh.
//
// Timeout rationale: the BFF server-side route now enforces its own 9s timeout
// against the analytics server, so the client's abort is a safety net only.
// Cold load uses 4s so the progress bar doesn't feel infinite; if the BFF is
// still slow (first boot, DB warm-up), recovery handles the retry in the
// background without blocking navigation.
export const load: PageLoad = async ({ fetch }) => {
    if (browser) {
        const cached = getMarketsDataCache();
        if (cached && hasMeaningfulMarketsPayload(cached)) {
            // Stale-while-revalidate: return immediately, refresh silently.
            void loadMarketsPageData(fetch, 5000).then(setMarketsDataCache);
            return cached;
        }
    }

    const data = await loadMarketsPageData(fetch, browser ? 4000 : 3000);
    setMarketsDataCache(data);
    return data;
};
