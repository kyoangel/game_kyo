import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { buildGames } from './build-games.ts';
import { checkArtifact, type PortalPlatform } from './check-artifact.ts';
import { loadGames } from './lib/games.ts';

export const PORTALS: readonly PortalPlatform[] = ['crazygames', 'gamedistribution'];
/** Placeholder GD id used ONLY by the smoke build (--smoke); never shipped. */
export const SMOKE_GD_ID = 'smoke-test-game-id';

export const zipName = (slug: string, platform: PortalPlatform, version: string): string =>
  `${slug}-${platform}-v${version}.zip`;

export interface Selection {
  build: GameManifest[];
  skipped: Array<{ slug: string; reason: string }>;
}

export function selectGames(
  platform: PortalPlatform,
  games: GameManifest[],
  opts: { fakeGdId?: boolean } = {},
): Selection {
  const build: GameManifest[] = [];
  const skipped: Selection['skipped'] = [];
  for (const g of games) {
    if (!(g.targets as string[]).includes(platform)) continue;
    if (platform === 'gamedistribution' && !g.portalIds?.gamedistribution && !opts.fakeGdId) {
      skipped.push({
        slug: g.slug,
        reason: 'no portalIds.gamedistribution in game.json (register the game in the GameDistribution dashboard first)',
      });
      continue;
    }
    build.push(g);
  }
  return { build, skipped };
}

export function gameEnv(platform: PortalPlatform, game: GameManifest, fakeGdId: boolean): Record<string, string> {
  if (platform !== 'gamedistribution') return {};
  return { GD_GAME_ID: game.portalIds?.gamedistribution ?? (fakeGdId ? SMOKE_GD_ID : '') };
}

/** Zips the CONTENTS of `dir` (index.html at the zip root) using the system zip CLI. Replaces an existing zip. */
export function zipDirectory(dir: string, zipPath: string): void {
  const target = resolve(zipPath);
  rmSync(target, { force: true });
  mkdirSync(dirname(target), { recursive: true });
  execFileSync('zip', ['-q', '-r', '-X', '-D', target, '.'], { cwd: dir });
}

export interface BuildPortalsOptions {
  outRoot: string;
  /** null = do not zip (smoke). */
  releaseDir: string | null;
  fakeGdId?: boolean;
  platforms?: readonly PortalPlatform[];
  games?: GameManifest[];
}

export interface BuildPortalsResult {
  built: Array<{ slug: string; platform: PortalPlatform; dir: string; zip: string | null }>;
  skipped: Array<{ slug: string; platform: PortalPlatform; reason: string }>;
  errors: string[];
}

export async function buildPortals(opts: BuildPortalsOptions): Promise<BuildPortalsResult> {
  const all = opts.games ?? loadGames();
  const fakeGdId = opts.fakeGdId ?? false;
  const result: BuildPortalsResult = { built: [], skipped: [], errors: [] };
  for (const platform of opts.platforms ?? PORTALS) {
    const { build, skipped } = selectGames(platform, all, { fakeGdId });
    for (const s of skipped) result.skipped.push({ ...s, platform });
    if (build.length === 0) continue;
    const slugs = new Set(build.map((g) => g.slug));
    const platformRoot = join(opts.outRoot, platform);
    await buildGames(platform, platformRoot, (slug) => slug, {
      only: (g) => slugs.has(g.slug),
      env: (g) => gameEnv(platform, g, fakeGdId),
    });
    for (const game of build) {
      const dir = join(platformRoot, game.slug);
      const problems = checkArtifact(dir, platform);
      if (problems.length > 0) {
        result.errors.push(...problems.map((p) => `${game.slug} (${platform}): ${p}`));
        continue;
      }
      let zip: string | null = null;
      if (opts.releaseDir) {
        zip = join(opts.releaseDir, zipName(game.slug, platform, game.version));
        zipDirectory(dir, zip);
      }
      result.built.push({ slug: game.slug, platform, dir, zip });
    }
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const smoke = process.argv.includes('--smoke');
  const outRoot = resolve(smoke ? 'dist/portals-smoke' : 'dist/portals');
  const releaseDir = smoke ? null : resolve('dist/release');
  rmSync(outRoot, { recursive: true, force: true });
  if (releaseDir) rmSync(releaseDir, { recursive: true, force: true });
  const result = await buildPortals({ outRoot, releaseDir, fakeGdId: smoke });
  for (const s of result.skipped) console.warn(`[portals] SKIP ${s.slug} (${s.platform}): ${s.reason}`);
  for (const b of result.built) console.log(`[portals] ${b.slug} (${b.platform}) ${b.zip ? `→ ${b.zip}` : '(smoke build, no zip)'}`);
  if (result.errors.length > 0) {
    for (const e of result.errors) console.error(`[portals] ERROR ${e}`);
    process.exit(1);
  }
}
