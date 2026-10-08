import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/game_kyo/merge10/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: {
    baseURL: "http://localhost:5173/game_kyo/merge10/",
    // Adventure mode adds a start menu. The existing specs were written for the endless
    // board at "/", so every page starts with this dev-only key, which makes src/main.ts
    // skip the menu and open 修練. Specs about the menu clear it with test.use(NO_DEBUG_START).
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:5173",
          localStorage: [{ name: "mathMerge10DebugStart", value: "endless" }],
        },
      ],
    },
  },
});
