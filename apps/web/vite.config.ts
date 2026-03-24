import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: parseInt(process.env.YACT_WEB_PORT ?? '5175'),
    strictPort: true,
  }
});
