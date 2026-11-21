import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { GAMES_DIR, loadGames } from './lib/games.ts';

export interface BuildOptions {
  /** Extra filter applied after the target filter. */
  only?: (game: GameManifest) => boolean;
  /** Extra env vars set for that game's build only (restored afterwards). */
  env?: (game: GameManifest) => Record<string, string>;
}

export async function buildGames(
  platform: string,
  outRoot: string,
  layout: (slug: string) => string,
  opts: BuildOptions = {},
): Promise<GameManifest[]> {
  const games = loadGames()
    .filter((g) => platform === 'local' || (g.targets as string[]).includes(platform))
    .filter((g) => opts.only?.(g) ?? true);
  for (const game of games) {
    process.env.PLATFORM = platform;
    process.env.GAME_OUT_DIR = resolve(outRoot, layout(game.slug));
    const extra = opts.env?.(game) ?? {};
    const previous = Object.fromEntries(Object.keys(extra).map((k) => [k, process.env[k]]));
    Object.assign(process.env, extra);
    console.log(`[build] ${game.slug} (${platform}) → ${process.env.GAME_OUT_DIR}`);
    try {
      await build({ configFile: resolve(GAMES_DIR, game.slug, 'vite.config.ts'), logLevel: 'warn' });
    } finally {
      for (const [k, v] of Object.entries(previous)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }
  return games;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const platform = process.argv[2] ?? 'local';
  const games = await buildGames(platform, resolve('dist', platform), (slug) => slug);
  console.log(`[build] ${games.length} game(s) built for ${platform}`);
}
