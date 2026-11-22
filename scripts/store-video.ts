// Portal preview videos: portrait 1080x1620 (2:3) and landscape 1920x1080 (16:9), under 20 s.
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Orientation } from '../packages/game-kit/src/manifest.ts';

/** Record at the game's own aspect (FIT fills the viewport, no letterbox). Override per game in store/record.json. */
export const RECORD_VIEWPORT = {
  portrait: { width: 720, height: 1280 },
  landscape: { width: 1280, height: 720 },
} as const;

const TARGETS = { portrait: { w: 1080, h: 1620 }, landscape: { w: 1920, h: 1080 } } as const;
const BLUR = 'boxblur=30:3,eq=brightness=-0.15';

/** Whole frame fitted inside w x h, centred over a blurred, cover-scaled copy of itself. */
const fitOverBlur = (w: number, h: number): string =>
  `split[a][b];[b]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},${BLUR}[bg];` +
  `[a]scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[v]`;

/**
 * ffmpeg -filter_complex graphs (output label [v]) for both portal videos. Never crops game content:
 * `trim` only removes browser/phone chrome from a user recording.
 */
export function videoFilters(trim: { top: number; bottom: number }): { portrait: string; landscape: string } {
  const cut = trim.top + trim.bottom > 0 ? `crop=iw:ih-${trim.top + trim.bottom}:0:${trim.top},` : '';
  const graph = (t: { w: number; h: number }) => `[0:v]${cut}fps=60,${fitOverBlur(t.w, t.h)}`;
  return { portrait: graph(TARGETS.portrait), landscape: graph(TARGETS.landscape) };
}

/** Portals cap preview videos at 20 s; stay just under it. */
export const MAX_SECONDS = 19.9;

/** Full ffmpeg argument list: trim, 0.5 s fade-out, h264/yuv420p, aac, web-friendly (faststart). */
export function ffmpegArgs(input: string, output: string, filter: string, hasAudio: boolean, startAt = 0): string[] {
  const st = (MAX_SECONDS - 0.5).toFixed(1);
  const audio = hasAudio ? ['-map', '0:a?', '-af', `afade=t=out:st=${st}:d=0.5`, '-c:a', 'aac', '-b:a', '128k'] : ['-an'];
  return [
    '-v', 'error', '-y', ...(startAt > 0 ? ['-ss', String(startAt)] : []), '-i', input, '-t', String(MAX_SECONDS),
    '-filter_complex', `${filter};[v]fade=t=out:st=${st}:d=0.5,format=yuv420p[out]`, '-map', '[out]',
    ...audio,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', output,
  ];
}

/** Problems with an encoded video, from `ffprobe -show_streams -show_format -of json` output. */
export function videoProblems(ffprobeJson: string, w: number, h: number): string[] {
  const j = JSON.parse(ffprobeJson) as {
    streams: Array<{ codec_type: string; width?: number; height?: number }>;
    format: { duration: string };
  };
  const v = j.streams.find((s) => s.codec_type === 'video');
  const out: string[] = [];
  if (!v || v.width !== w || v.height !== h) out.push(`size ${v?.width}x${v?.height}, expected ${w}x${h}`);
  if (Number(j.format.duration) > 20) out.push(`duration ${j.format.duration} s exceeds 20 s`);
  return out;
}

// ---- CLI: node scripts/store-video.ts <slug> [--from <file>] [--top <px>] [--bottom <px>] ----
// Thin IO shell around the tested functions above. Records the local build (test hooks on) with Playwright,
// or converts the user's own recording, then encodes and self-checks both portal videos.

interface RecordConfig {
  /** Runs before the game loads, e.g. `window.__dd = { god: true };` so the run never ends. */
  initScript?: string;
  /** Time on the title screen before tapping start. */
  warmupMs?: number;
  /** Runs right after the run starts, e.g. `window.__dd.warp(60)` to skip the slow opening. */
  afterStartScript?: string;
  /** Recording size; defaults to RECORD_VIEWPORT for the game's orientation. Use the game's design aspect. */
  viewport?: { width: number; height: number };
}

const RECORD_PORT = 5190;
const OUTPUTS = [
  { kind: 'portrait', file: 'video-portrait-1080x1620.mp4', w: 1080, h: 1620 },
  { kind: 'landscape', file: 'video-landscape-1920x1080.mp4', w: 1920, h: 1080 },
] as const;

async function recordGameplay(slug: string, orientation: Orientation, workDir: string): Promise<{ file: string; startAt: number }> {
  const { spawn } = await import('node:child_process');
  const { existsSync, readFileSync } = await import('node:fs');
  const { chromium } = await import('@playwright/test');
  const { buildGames } = await import('./build-games.ts');

  await buildGames('local', resolve('dist', 'local'), (s) => s, { only: (g) => g.slug === slug });
  const cfgPath = resolve('games', slug, 'store', 'record.json');
  const cfg: RecordConfig = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};

  const server = spawn(process.execPath, [resolve('scripts', 'serve-static.ts'), resolve('dist', 'local'), String(RECORD_PORT)], { stdio: 'ignore' });
  const browser = await chromium.launch();
  try {
    await new Promise((r) => setTimeout(r, 500));
    const viewport = cfg.viewport ?? RECORD_VIEWPORT[orientation === 'landscape' ? 'landscape' : 'portrait'];
    const context = await browser.newContext({ viewport, locale: 'en-US', recordVideo: { dir: workDir, size: viewport } });
    const t0 = Date.now();
    const page = await context.newPage();
    if (cfg.initScript) await page.addInitScript(cfg.initScript);
    await page.goto(`http://localhost:${RECORD_PORT}/${slug}/`);
    await page.waitForFunction(() => (window as unknown as { __gk?: { activeScenes?: string[] } }).__gk?.activeScenes?.includes('GKTitle'));
    await page.waitForTimeout(cfg.warmupMs ?? 1500);
    const startAt = Math.max(0, (Date.now() - t0) / 1000 - 0.3);
    await page.mouse.click(viewport.width / 2, viewport.height / 2);
    if (cfg.afterStartScript) {
      await page.waitForTimeout(300);
      await page.evaluate(cfg.afterStartScript);
    }
    const end = Date.now() + (MAX_SECONDS + 1) * 1000;
    let key = 'ArrowLeft';
    while (Date.now() < end) {
      await page.keyboard.down(key);
      await page.waitForTimeout(300 + Math.random() * 600);
      await page.keyboard.up(key);
      if (Math.random() < 0.7) key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
    }
    const video = page.video();
    await context.close();
    if (!video) throw new Error('Playwright produced no video');
    return { file: await video.path(), startAt: Number(startAt.toFixed(2)) };
  } finally {
    await browser.close();
    server.kill();
  }
}

async function main(argv: string[]): Promise<number> {
  const { execFileSync } = await import('node:child_process');
  const { mkdirSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { loadGames } = await import('./lib/games.ts');

  const slug = argv[0];
  const flag = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const game = loadGames().find((g) => g.slug === slug);
  if (!slug || !game) {
    console.error('usage: npm run store-video -- <slug> [--from <recording>] [--top <px>] [--bottom <px>]');
    return 2;
  }
  const outDir = resolve('dist', 'store', slug);
  mkdirSync(outDir, { recursive: true });
  const from = flag('--from');
  const trim = { top: Number(flag('--top') ?? 0), bottom: Number(flag('--bottom') ?? 0) };
  const src = from
    ? { file: resolve(from), startAt: 0 }
    : await recordGameplay(slug, game.orientation, mkdtempSync(join(tmpdir(), `store-video-${slug}-`)));
  const probeOf = (f: string) => execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', f], { encoding: 'utf8' });
  const hasAudio = (JSON.parse(probeOf(src.file)) as { streams: Array<{ codec_type: string }> }).streams.some((s) => s.codec_type === 'audio');
  const filters = videoFilters(trim);
  let failed = false;
  for (const o of OUTPUTS) {
    const out = join(outDir, o.file);
    execFileSync('ffmpeg', ffmpegArgs(src.file, out, filters[o.kind], hasAudio, src.startAt), { stdio: 'inherit' });
    const problems = videoProblems(probeOf(out), o.w, o.h);
    console.log(problems.length ? `[store-video] FAIL ${out}: ${problems.join('; ')}` : `[store-video] ${out}`);
    failed ||= problems.length > 0;
  }
  return failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
