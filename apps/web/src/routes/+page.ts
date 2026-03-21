import type { PageLoad } from './$types';

import { loadMarketsPageData } from '../lib/pages/markets/markets-page.data';

export const load: PageLoad = async ({ fetch }) => {
    // Fetch fresh data for SSR and all client navigations.
    // SvelteKit request deduplication handles concurrent requests automatically.
    return loadMarketsPageData(fetch);
};
