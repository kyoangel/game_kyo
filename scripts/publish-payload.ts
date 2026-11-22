// Everything the CrazyGames portal form needs, derived from game.json, for the publish-crazygames skill.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';

/** Exact radio labels on the CrazyGames Upload page ("Does your game save progress?"), 2026-11-22. */
const SAVE_LABEL = {
  none: 'No, the game does not need progress save',
  sdk: 'Yes, using the Data Module from the CrazyGames SDK',
  localstorage: 'Yes, using LocalStorage (refer to Automatic Progress Save)',
} as const;
const ORIENT = { portrait: 'PORTRAIT', landscape: 'LANDSCAPE', any: 'BOTH' } as const;

export function crazyGamesPayload(g: GameManifest, root: string) {
  const cg = g.store?.crazygames;
  if (!g.store || !cg) throw new Error(`${g.slug}: add store.crazygames to game.json first`);
  const store = join(root, 'games', g.slug, 'store');
  const vids = join(root, 'dist', 'store', g.slug);
  return {
    slug: g.slug,
    version: g.version,
    uploadDir: join(root, 'dist', 'portals', 'crazygames', g.slug),
    form: {
      gameName: g.title.en,
      engine: 'HTML5',
      progressSave: SAVE_LABEL[cg.progressSave],
      // A portrait game is built for phones even if its manifest lists only mouse.
      supportsMobile: g.controls.includes('touch') || g.orientation !== 'landscape',
      mobileOrientation: ORIENT[g.orientation],
      category: cg.category,
      tags: cg.tags,
      description: g.description.en,
      controls: g.store.controls.en,
      tools: 'Phaser',
    },
    covers: {
      landscape: join(store, 'landscape-1920x1080.png'),
      portrait: join(store, 'portrait-800x1200.png'),
      square: join(store, 'square-800x800.png'),
    },
    videos: {
      landscape: join(vids, 'video-landscape-1920x1080.mp4'),
      portrait: join(vids, 'video-portrait-1080x1620.mp4'),
    },
  };
}
export type CrazyGamesPayload = ReturnType<typeof crazyGamesPayload>;

/** Every blocker to fix before opening the portal; empty means ready. IO is injected for tests. */
export function preflightProblems(
  p: CrazyGamesPayload,
  g: GameManifest,
  exists: (file: string) => boolean,
  pngSize: (file: string) => [number, number],
): string[] {
  const out: string[] = [];
  const rel = g.releases.crazygames;
  if (rel && rel.status !== 'todo' && rel.status !== 'rejected' && rel.version === g.version)
    out.push(`crazygames already ${rel.status} at ${g.version}; bump version first`);
  if (!exists(join(p.uploadDir, 'index.html'))) out.push(`missing ${p.uploadDir}/index.html (run npm run build:portals)`);
  for (const [kind, file] of Object.entries(p.covers)) {
    if (!exists(file)) {
      out.push(`missing ${file} (run npm run covers -- ${p.slug})`);
      continue;
    }
    const [w, h] = pngSize(file);
    const [ew, eh] = (file.match(/(\d+)x(\d+)\.png$/) ?? []).slice(1).map(Number);
    if (w !== ew || h !== eh) out.push(`${kind} cover is ${w}x${h}, expected ${ew}x${eh}`);
  }
  for (const file of Object.values(p.videos)) if (!exists(file)) out.push(`missing ${file} (run npm run store-video -- ${p.slug})`);
  return out;
}

// ---- CLI: npm run publish:prep -- <slug> ----
// Thin IO shell: build the portal artifact, make missing covers/videos, check everything, write the payload JSON.
async function main(slug: string | undefined): Promise<number> {
  const { execFileSync } = await import('node:child_process');
  const { existsSync, mkdirSync, readFileSync, writeFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const { loadGames } = await import('./lib/games.ts');
  const { readPngSize, renderCovers } = await import('./render-covers.ts');

  const game = loadGames().find((g) => g.slug === slug);
  if (!slug || !game) {
    console.error('usage: npm run publish:prep -- <slug>');
    return 2;
  }
  const root = resolve('.');
  const payload = crazyGamesPayload(game, root);
  const run = (args: string[]) => execFileSync('npm', ['run', ...args], { stdio: 'inherit' });

  run(['build:portals']);
  if (Object.values(payload.covers).some((f) => !existsSync(f))) await renderCovers(slug);
  if (Object.values(payload.videos).some((f) => !existsSync(f))) run(['store-video', '--', slug]);

  const pngSize = (f: string): [number, number] => {
    const { width, height } = readPngSize(readFileSync(f));
    return [width, height];
  };
  const problems = preflightProblems(payload, game, existsSync, pngSize);
  if (problems.length > 0) {
    for (const p of problems) console.error(`[publish:prep] ${p}`);
    return 1;
  }
  const outDir = resolve('dist', 'publish');
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, `${slug}-crazygames.json`);
  writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`[publish:prep] ready: ${out}`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main(process.argv[2]));
