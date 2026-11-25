import { describe, expect, it } from 'vitest';
import { frameFor } from './frame.ts';
import { fieldFont, hudAnchors, MIN_FIELD_FONT, MIN_PANEL_FONT } from './hudLayout.ts';

const CSS_800 = 450 / 810; // canvas -> css scale at an 800x450 iframe

describe('hudAnchors', () => {
  it('portrait: the run timer is the headline at top-left, the graze gauge under it', () => {
    const a = hudAnchors(frameFor('portrait'));
    expect(a.timer).toEqual({ x: 24, y: 14, originX: 0, panel: false });
    expect(a.gauge).toEqual({ x: 24, y: 86, originX: 0, panel: false });
    expect(a.mute).toEqual({ x: 672, y: 48 });
  });
  it('landscape puts every readable HUD anchor in a side panel, clear of the field rectangle', () => {
    const f = frameFor('landscape');
    const a = hudAnchors(f);
    const fieldL = f.fieldX;
    const fieldR = f.fieldX + f.dispW;
    for (const [name, p] of Object.entries({ timer: a.timer, gauge: a.gauge, shields: a.shields, goal: a.goal, mute: a.mute, missions: a.missions })) {
      expect(p.x <= fieldL || p.x >= fieldR, `${name} x=${p.x}`).toBe(true);
    }
  });
  it('left panel holds timer/gauge/goal, right panel holds shields/missions/mute', () => {
    const f = frameFor('landscape');
    const a = hudAnchors(f);
    for (const p of [a.timer, a.gauge, a.goal]) expect(p.x).toBeLessThan(f.fieldX);
    for (const p of [a.shields, a.missions, a.mute]) expect(p.x).toBeGreaterThan(f.fieldX + f.dispW);
  });
  it('panel text stays legible at 800x450 (>= 14 css px, target 20+)', () => {
    expect(MIN_PANEL_FONT * CSS_800).toBeGreaterThanOrEqual(20);
  });
});

describe('fieldFont', () => {
  it('portrait never changes the size', () => {
    expect(fieldFont(frameFor('portrait'), 34)).toBe(34);
  });
  it('landscape clamps in-field text so it renders >= 14 css px at 800x450', () => {
    const f = frameFor('landscape');
    expect(fieldFont(f, 30)).toBe(MIN_FIELD_FONT);
    expect(fieldFont(f, 110)).toBe(110);
    expect(MIN_FIELD_FONT * f.zoom * CSS_800).toBeGreaterThanOrEqual(14);
  });
});
