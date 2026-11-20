import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest, type GameManifest } from '../../packages/game-kit/src/manifest.ts';

export const GAMES_DIR = fileURLToPath(new URL('../../games', import.meta.url));

export function loadGames(gamesDir: string = GAMES_DIR): GameManifest[] {
  if (!existsSync(gamesDir)) return [];
  const games: GameManifest[] = [];
  const problems: string[] = [];
  for (const dir of readdirSync(gamesDir).sort()) {
    const file = join(gamesDir, dir, 'game.json');
    if (!existsSync(file)) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      problems.push(`${dir}: invalid JSON (${(e as Error).message})`);
      continue;
    }
    const result = validateManifest(raw);
    if (!result.ok) {
      problems.push(...result.errors.map((err) => `${dir}: ${err}`));
      continue;
    }
    if (result.manifest.slug !== dir) {
      problems.push(`${dir}: slug "${result.manifest.slug}" must equal its directory name`);
      continue;
    }
    games.push(result.manifest);
  }
  if (problems.length > 0) throw new Error(`Invalid games:\n${problems.join('\n')}`);
  return games;
}
