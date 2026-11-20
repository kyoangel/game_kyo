import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@platform/active': fileURLToPath(new URL('./packages/platform/src/adapters/local.ts', import.meta.url)),
    },
  },
  define: { __GK_TEST_HOOKS__: 'false' },
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'games/*/src/**/*.test.ts',
      'site/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
  },
});
