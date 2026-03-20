import type { PageLoad } from './$types';

import { createInitialMarketsPageData, loadMarketsPageData } from '../lib/pages/markets/markets-page.data';

export const load: PageLoad = async ({ fetch }) => {
    const data = await loadMarketsPageData(fetch);
    return data ?? createInitialMarketsPageData();
};
