import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // The integration files share one dev database, so running them in
    // parallel makes global table counts race against each other.
    fileParallelism: false,
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**'],
    },
  },
});
