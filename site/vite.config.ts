// The standalone page's build (`npm run site`, `npm run site:build`): Vite over `site/`, reading webmidi's sources as
// they are. A relative base, so the built page works under any path (GitHub Pages serves it under the repository's).
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [svelte()],
  build: { outDir: '../dist-site', emptyOutDir: true },
});
