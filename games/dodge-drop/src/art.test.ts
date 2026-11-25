import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_FILES, artScale, artUrl, isLoadedArt, missingArtKeys, preloadArt } from './art.ts';

const ART_DIR = join(__dirname, '..', 'public', 'assets', 'art');

describe('art manifest', () => {
  it('maps texture keys to relative asset urls (portal rule: no absolute paths)', () => {
    for (const f of ART_FILES) {
      expect(artUrl(f)).toMatch(/^assets\/art\/[a-z0-9-]+\.png$/);
    }
  });
  it('has unique texture keys', () => {
    const keys = ART_FILES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('reports keys whose file is not shipped so the procedural fallback is used', () => {
    expect(missingArtKeys([{ key: 'dd-star', file: 'star.png' }], new Set(['star.png']))).toEqual([]);
    expect(missingArtKeys([{ key: 'dd-star', file: 'star.png' }], new Set())).toEqual(['dd-star']);
  });
  it('every ART_FILES entry is shipped in public/assets/art', () => {
    for (const f of ART_FILES) expect(existsSync(join(ART_DIR, f.file)), f.file).toBe(true);
  });
});

/** Minimal Phaser-scene double: only what art.ts touches. */
function fakeScene(textures: Record<string, { w: number; image: unknown }>): Parameters<typeof artScale>[0] {
  return {
    textures: {
      exists: (k: string) => k in textures,
      get: (k: string) => ({ getSourceImage: () => textures[k]!.image, source: [{ width: textures[k]!.w }] }),
    },
  } as never;
}

describe('procedural fallback (the game must run with no assets)', () => {
  it('a key with no loaded texture is not art and keeps scale 1', () => {
    const s = fakeScene({});
    expect(isLoadedArt(s, 'dd-star')).toBe(false);
    expect(artScale(s, 'dd-star')).toBe(1);
  });
  it('a procedurally generated (canvas) texture is not loaded art and keeps scale 1', () => {
    const s = fakeScene({ 'dd-ring': { w: 96, image: { tagName: 'CANVAS' } } });
    expect(isLoadedArt(s, 'dd-ring')).toBe(false);
    expect(artScale(s, 'dd-ring')).toBe(1);
  });
  it('a loaded image is scaled to the procedural display size so gameplay visuals keep their footprint', () => {
    const s = fakeScene({ 'dd-ring': { w: 256, image: { tagName: 'IMG' } } });
    expect(isLoadedArt(s, 'dd-ring')).toBe(true);
    expect(artScale(s, 'dd-ring')).toBeCloseTo(170 / 256, 5);
  });
  it('a failed load never throws and registers nothing', () => {
    const handlers: Record<string, () => void> = {};
    const loaded: string[] = [];
    const scene = {
      load: { image: (k: string) => loaded.push(k), on: (ev: string, fn: () => void) => { handlers[ev] = fn; } },
    } as never;
    expect(() => preloadArt(scene)).not.toThrow();
    expect(loaded.length).toBe(ART_FILES.length);
    expect(() => handlers.loaderror?.()).not.toThrow();
  });
});
