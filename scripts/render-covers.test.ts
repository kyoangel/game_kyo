import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAMES_DIR } from './lib/games.ts';
import { COVER_SIZES, coverHtml, extractBackground, readPngSize } from './render-covers.ts';

describe('COVER_SIZES', () => {
  it('lists the three CrazyGames cover formats', () => {
    expect(COVER_SIZES.map((s) => `${s.width}x${s.height}`)).toEqual(['1920x1080', '800x1200', '800x800']);
    expect(COVER_SIZES.map((s) => s.name)).toEqual([
      'landscape-1920x1080.png',
      'portrait-800x1200.png',
      'square-800x800.png',
    ]);
  });
});

describe('extractBackground', () => {
  it('returns the fill of the first rect', () => {
    expect(extractBackground('<svg><rect width="1" height="1" fill="#111827"/><rect fill="#fff"/></svg>')).toBe('#111827');
  });

  it('falls back to #111111', () => {
    expect(extractBackground('<svg><circle r="1"/></svg>')).toBe('#111111');
  });
});

describe('coverHtml', () => {
  const html = coverHtml('<svg xmlns="http://www.w3.org/2000/svg"/>', 800, 1200, '#111827');

  it('sizes the page, centres the image and fills with the background colour', () => {
    expect(html).toContain('width:800px');
    expect(html).toContain('height:1200px');
    expect(html).toContain('background:#111827');
    expect(html).toContain('align-items:center');
    expect(html).toContain('data:image/svg+xml;base64,');
  });
});

describe('readPngSize', () => {
  it('reads width and height from the IHDR chunk', () => {
    const buf = Buffer.alloc(24);
    buf.writeUInt32BE(800, 16);
    buf.writeUInt32BE(1200, 20);
    expect(readPngSize(buf)).toEqual({ width: 800, height: 1200 });
  });
});

describe('committed store covers', () => {
  const slugs = readdirSync(GAMES_DIR).filter((d) => existsSync(join(GAMES_DIR, d, 'store')));
  it.each(slugs)('%s: every committed cover has its exact size', (slug) => {
    for (const size of COVER_SIZES) {
      const file = join(GAMES_DIR, slug, 'store', size.name);
      expect(existsSync(file), `${slug}/store/${size.name} missing`).toBe(true);
      expect(readPngSize(readFileSync(file))).toEqual({ width: size.width, height: size.height });
    }
  });
});
