// games/dodge-drop/src/frame.test.ts
import { describe, expect, it } from 'vitest';
import { FIELD_W, frameFor, parseLayoutOverride, pickMode } from './frame.ts';

describe('pickMode', () => {
  it('uses landscape for 16:9 iframes at every CrazyGames size', () => {
    for (const [w, h] of [[800, 450], [907, 510], [1280, 720], [1920, 1080]] as const) {
      expect(pickMode(w, h)).toBe('landscape');
    }
  });
  it('uses portrait for phones in portrait and for squarish windows', () => {
    for (const [w, h] of [[375, 667], [390, 844], [768, 1024], [900, 900]] as const) {
      expect(pickMode(w, h)).toBe('portrait');
    }
  });
  it('honours an explicit override', () => {
    expect(pickMode(1920, 1080, 'portrait')).toBe('portrait');
    expect(pickMode(375, 667, 'landscape')).toBe('landscape');
  });
  it('guards zero/invalid sizes by falling back to portrait', () => {
    expect(pickMode(0, 0)).toBe('portrait');
    expect(pickMode(Number.NaN, 100)).toBe('portrait');
  });
});

describe('frameFor', () => {
  it('portrait matches the v2.8.4 constants exactly', () => {
    expect(frameFor('portrait')).toEqual({
      mode: 'portrait', width: 720, height: 1280, fieldX: 0, fieldY: 0, zoom: 1,
      fieldW: 720, fieldH: 1280, dispW: 720, dispH: 1280,
      playerY: 1000, stripTop: 1060, stripBottom: 1280,
    });
  });
  it('landscape shows the full portrait field scaled to the canvas height and centred', () => {
    const f = frameFor('landscape');
    expect(f.width).toBe(1440);
    expect(f.height).toBe(810);
    expect(f.zoom).toBeCloseTo(810 / 1280, 6);
    expect(f.dispH).toBeCloseTo(810, 6);
    expect(f.dispW).toBeCloseTo(FIELD_W * f.zoom, 6);
    expect(f.fieldX * 2 + f.dispW).toBeCloseTo(f.width, 6);
  });
  it('gameplay geometry is identical in both modes (no fairness impact)', () => {
    const p = frameFor('portrait');
    const l = frameFor('landscape');
    expect([l.fieldW, l.fieldH, l.playerY, l.stripTop, l.stripBottom]).toEqual([p.fieldW, p.fieldH, p.playerY, p.stripTop, p.stripBottom]);
  });
  it('landscape aspect is 16:9 and panels are wide enough for HUD text', () => {
    const f = frameFor('landscape');
    expect(f.width / f.height).toBeCloseTo(16 / 9, 5);
    expect(f.fieldX).toBeGreaterThanOrEqual(440);
  });
});

describe('parseLayoutOverride', () => {
  it('reads ?layout=', () => {
    expect(parseLayoutOverride('?layout=portrait')).toBe('portrait');
    expect(parseLayoutOverride('?a=1&layout=landscape')).toBe('landscape');
    expect(parseLayoutOverride('?layout=weird')).toBeUndefined();
    expect(parseLayoutOverride('')).toBeUndefined();
  });
});
