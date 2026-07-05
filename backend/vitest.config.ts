import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    setupFiles: ['./tests/setup.ts'],
    env: {
      DATABASE_URL: 'file:./test.db',
    },
  },
});
