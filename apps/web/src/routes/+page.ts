import { browser } from '$app/environment';
import type { PageLoad } from './$types';

import {
    loadMarketsPageData,
} from '../lib/pages/markets/markets-page.data';

// Ownership contract (BUG-002):
// - Route loader is the canonical owner of markets page payload for first render
//   and client navigation.
// - Loader always fetches real data so $page.data.global is populated and the
//   shell headbar can update via its existing $page.data watcher.
// - Browser navigations use a shorter timeout so SvelteKit's progress bar stays
//   brief; the MarketsPageView recovery effect handles timeout/empty fallback.
export const load: PageLoad = async ({ fetch }) => {
    // Fix BUG-002: removed the `if (browser) return createEmptyMarketsPageData()`
    // shortcut that guaranteed a zero-state flash on every client navigation.
    return loadMarketsPageData(fetch, browser ? 1500 : 2200);
};
