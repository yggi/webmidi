// Lifted from yggi/cells vitest.config.ts @ 41ef16b, one project: webmidi has no slow tests. Svelte compiles the `ui`
// layer's components, and its tests (`*.svelte.test.ts`, which use runes) mount them in jsdom; the browser's build of
// Svelte is the one that mounts.
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'node',
    isolate: false,
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
