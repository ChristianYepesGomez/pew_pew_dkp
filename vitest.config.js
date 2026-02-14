import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.js'],
    testTimeout: 15000,
    hookTimeout: 15000,
    sequence: { concurrent: false },
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['routes/**', 'middleware/**', 'lib/**', 'services/**', 'server.js', 'database.js'],
      thresholds: {
        lines: 60,
      },
    },
  },
});
