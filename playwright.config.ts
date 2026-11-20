import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  webServer: {
    command: 'node scripts/serve-static.ts dist/local 5180',
    port: 5180,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:5180' },
});
