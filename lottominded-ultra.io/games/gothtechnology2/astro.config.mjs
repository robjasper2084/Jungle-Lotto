import { defineConfig } from 'astro/config';
import { legacyIntegration } from './scripts/store-integration.mjs';

export default defineConfig({
  site: process.env.PUBLIC_SITE_ORIGIN || 'https://robjasper2084.github.io',
  base: process.env.STORE_BASE_PATH || '/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/',
  srcDir: './store', publicDir: './store/public', outDir: './dist',
  devToolbar: { enabled: false },
  output: 'static', trailingSlash: 'always', build: { assets: '_store', inlineStylesheets: 'never' },
  integrations: [legacyIntegration()],
  server: { host: '127.0.0.1', port: 4180 },
  vite: { build: { sourcemap: false } },
});
