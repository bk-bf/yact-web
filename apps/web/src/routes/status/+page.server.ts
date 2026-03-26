import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

export function load() {
    if (!env.YACT_ENABLE_STATUS_PAGE) throw error(404, 'Not found');
}
