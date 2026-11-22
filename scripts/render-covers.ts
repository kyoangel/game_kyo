import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES_DIR, loadGames } from './lib/games.ts';

export const COVER_SIZES = [
  { name: 'landscape-1920x1080.png', width: 1920, height: 1080 },
  { name: 'portrait-800x1200.png', width: 800, height: 1200 },
  { name: 'square-800x800.png', width: 800, height: 800 },
] as const;

/** Background CSS value of a cover SVG: fill of its first <rect> (resolving url(#grad) to a seamless stop gradient), else #111111. */
export function extractBackground(svg: string): string {
  const firstRect = /<rect\b[^>]*\bfill="([^"]+)"/.exec(svg)?.[1];
  if (!firstRect) return '#111111';
  if (/^#[0-9a-fA-F]{3,8}$/.test(firstRect)) return firstRect;
  const gradId = /^url\(#([^)]+)\)$/.exec(firstRect)?.[1];
  if (gradId) {
    const gradRe = new RegExp(`<linearGradient\\b[^>]*\\bid="${gradId}"[^>]*>([\\s\\S]*?)</linearGradient>`);
    const body = gradRe.exec(svg)?.[1];
    if (body) {
      const stops = [...body.matchAll(/\bstop-color="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1]!);
      if (stops.length >= 2) return `linear-gradient(to bottom, ${stops[0]} 50%, ${stops[stops.length - 1]} 50%)`;
      if (stops.length === 1) return stops[0]!;
    }
  }
  return '#111111';
}

/**
 * Source SVG for one store size: `store/src/<variant>.svg` (variant = landscape | portrait | square) when the game
 * provides a composition for that shape, else the shared `public/<cover>` (letterboxed).
 */
export function coverSourceFor(gameDir: string, cover: string, sizeName: string, exists: (p: string) => boolean = existsSync): string {
  const variant = sizeName.split('-')[0]!;
  const own = join(gameDir, 'store', 'src', `${variant}.svg`);
  return exists(own) ? own : join(gameDir, 'public', cover);
}

export function coverHtml(svg: string, width: number, height: number, bg: string): string {
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return (
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    `html,body{margin:0;width:${width}px;height:${height}px;background:${bg};overflow:hidden}` +
    'body{display:flex;align-items:center;justify-content:center}' +
    'img{width:100%;height:auto;max-height:100%;object-fit:contain;display:block}' +
    `</style></head><body><img src="${src}" alt=""></body></html>`
  );
}

export function readPngSize(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Renders games/<slug>/public/<cover>.svg to the three store PNGs in games/<slug>/store/. Returns the file paths. */
export async function renderCovers(slug: string, gamesDir: string = GAMES_DIR): Promise<string[]> {
  const manifest = loadGames(gamesDir).find((g) => g.slug === slug);
  if (!manifest) throw new Error(`Unknown game "${slug}"`);
  if (!manifest.cover.toLowerCase().endsWith('.svg')) throw new Error(`cover "${manifest.cover}" must be an .svg to render store covers`);
  const gameDir = join(gamesDir, slug);
  const outDir = join(gamesDir, slug, 'store');
  mkdirSync(outDir, { recursive: true });

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const written: string[] = [];
    for (const size of COVER_SIZES) {
      const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
      const svg = readFileSync(coverSourceFor(gameDir, manifest.cover, size.name), 'utf8');
      await page.setContent(coverHtml(svg, size.width, size.height, extractBackground(svg)));
      const file = join(outDir, size.name);
      writeFileSync(file, await page.screenshot({ type: 'png' }));
      await page.close();
      written.push(file);
    }
    return written;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: npm run covers -- <slug>');
    process.exit(2);
  }
  for (const file of await renderCovers(slug)) console.log(`[covers] ${file}`);
}
