import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.js'],
    testTimeout: 15000,
    hookTimeout: 15000,
    sequence: { concurrent: false },
    fileParallelism: false,
  },
});
