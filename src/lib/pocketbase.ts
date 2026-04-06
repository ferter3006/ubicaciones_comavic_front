// PocketBase client setup for Svelte
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/public';

// You can change the URL to your PocketBase instance
const pocketbaseUrl = env.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(pocketbaseUrl);
