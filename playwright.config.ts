import { defineConfig } from '@playwright/test';

const serve = (dir: string, port: number) => ({
  command: `node scripts/serve-static.ts ${dir} ${port}`,
  port,
  reuseExistingServer: !process.env.CI,
});

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  webServer: [
    serve('dist/local', 5180),
    serve('dist/portals-smoke/crazygames', 5181),
    serve('dist/portals-smoke/gamedistribution', 5182),
  ],
  use: { baseURL: 'http://localhost:5180' },
});
