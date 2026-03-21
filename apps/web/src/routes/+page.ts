import type { PageLoad } from './$types';
import { browser } from '$app/environment';

import {
    createInitialMarketsPageData,
    loadMarketsPageDataWithTimeout,
} from '../lib/pages/markets/markets-page.data';

export const load: PageLoad = async ({ fetch }) => {
    // Keep client-side route transitions instant; background refresh runs in view.
    if (browser) {
        return createInitialMarketsPageData();
    }

    // On hard reload/server render, allow a modest fetch window to avoid empty first paint.
    return loadMarketsPageDataWithTimeout(fetch, 1200);
};
