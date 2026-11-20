import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const ADAPTERS_DIR = resolve(here, '../platform/src/adapters');

export function availablePlatforms(): string[] {
  return readdirSync(ADAPTERS_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => f.slice(0, -3))
    .sort();
}

export function resolveAdapter(platform: string): string {
  const file = resolve(ADAPTERS_DIR, `${platform}.ts`);
  if (!/^[a-z0-9-]+$/.test(platform) || !existsSync(file)) {
    throw new Error(`Unknown PLATFORM "${platform}". Available: ${availablePlatforms().join(', ')}`);
  }
  return file;
}

export function createGameViteConfig(gameDir: string, env: NodeJS.ProcessEnv = process.env): UserConfig {
  const platform = env.PLATFORM ?? 'local';
  const adapter = resolveAdapter(platform);
  return {
    root: gameDir,
    base: './',
    publicDir: resolve(gameDir, 'public'),
    resolve: { alias: { '@platform/active': adapter } },
    define: { __GK_TEST_HOOKS__: JSON.stringify(platform === 'local') },
    build: {
      outDir: env.GAME_OUT_DIR ?? resolve(gameDir, 'dist', platform),
      emptyOutDir: true,
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 2000,
    },
  };
}
