import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { GAMES_DIR, loadGames } from './lib/games.ts';

export async function buildGames(
  platform: string,
  outRoot: string,
  layout: (slug: string) => string,
): Promise<GameManifest[]> {
  const games = loadGames().filter((g) => platform === 'local' || (g.targets as string[]).includes(platform));
  for (const game of games) {
    process.env.PLATFORM = platform;
    process.env.GAME_OUT_DIR = resolve(outRoot, layout(game.slug));
    console.log(`[build] ${game.slug} (${platform}) → ${process.env.GAME_OUT_DIR}`);
    await build({ configFile: resolve(GAMES_DIR, game.slug, 'vite.config.ts'), logLevel: 'warn' });
  }
  return games;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const platform = process.argv[2] ?? 'local';
  const games = await buildGames(platform, resolve('dist', platform), (slug) => slug);
  console.log(`[build] ${games.length} game(s) built for ${platform}`);
}
