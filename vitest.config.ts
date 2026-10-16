// Lifted from yggi/cells vitest.config.ts @ 41ef16b, one project: webmidi has no slow tests.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    isolate: false,
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
