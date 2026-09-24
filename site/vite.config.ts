import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const pages = [
  'index.html',
  ...['project-release', 'deployment', 'booking', 'history'].map((name) => `examples/${name}/index.html`),
  ...['vanilla', 'react', 'vue'].map((name) => `guide/${name}/index.html`),
  'performance/index.html',
];

export default defineConfig({
  base: process.env.SITE_BASE ?? '/',
  build: { rollupOptions: { input: Object.fromEntries(pages.map((page) => [page, resolve(import.meta.dirname, page)])) } },
});
