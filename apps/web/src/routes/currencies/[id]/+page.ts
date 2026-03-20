import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import {
    loadCoinDetailCriticalData
} from '../../../lib/pages/coin-detail/coin-detail-page.data';

export const load: PageLoad = async ({ params, fetch }) => {
    if (!params.id) {
        throw error(400, 'Missing coin id.');
    }

    return loadCoinDetailCriticalData(fetch, params.id);
};
