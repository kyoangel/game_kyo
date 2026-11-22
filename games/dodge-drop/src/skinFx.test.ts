import { describe, expect, it } from 'vitest';
import { SKINS } from './economy.ts';
import { fxBudget, fxLineKey, hueColor, skinFxSpec, skinTier, MAX_FX_PARTICLES } from './skinFx.ts';

const byId = (id: string) => SKINS.find((s) => s.id === id)!;

describe('skinFx tiers', () => {
  it('maps cost to tier', () => {
    expect(SKINS.map((s) => skinTier(s))).toEqual(['basic', 'basic', 'basic', 'spark', 'spark', 'spark', 'star', 'prism']);
  });
  it('basic skins keep the white near-miss burst and plain death', () => {
    const f = skinFxSpec(byId('lime'));
    expect(f).toMatchObject({ trail: 'dots', nearMiss: 'white', death: 'basic', afterimage: false, extras: false });
  });
  it('spark tier gets coloured near-miss and a longer trail', () => {
    const base = skinFxSpec(byId('orb'));
    const f = skinFxSpec(byId('tri'));
    expect(f.nearMiss).toBe('spark');
    expect(f.trailLifespan).toBeGreaterThan(base.trailLifespan);
    expect(f.death).toBe('basic');
    expect(skinFxSpec(byId('diamond')).trailColor).toBe('rainbow');
  });
  it('star gets sparkle trail, star burst, firework', () => {
    expect(skinFxSpec(byId('star'))).toMatchObject({ trail: 'sparkle', nearMiss: 'star', death: 'firework', extras: true });
  });
  it('prism gets ribbon, ring, supernova, afterimage', () => {
    expect(skinFxSpec(byId('prism'))).toMatchObject({ trail: 'ribbon', nearMiss: 'ring', death: 'supernova', afterimage: true, extras: true });
  });
  it('listing key flags extras', () => {
    expect(skinFxSpec(byId('cyan')).extras).toBe(false);
  });
  it('effect line key per tier', () => {
    expect(SKINS.map((x) => fxLineKey(skinFxSpec(x)))).toEqual(['skin.fx.basic', 'skin.fx.basic', 'skin.fx.basic', 'skin.fx.mid', 'skin.fx.mid', 'skin.fx.mid', 'skin.fx.extra', 'skin.fx.extra']);
  });
  it('every skin stays within the particle budget', () => {
    for (const s of SKINS) expect(fxBudget(skinFxSpec(s))).toBeLessThanOrEqual(MAX_FX_PARTICLES);
    expect(MAX_FX_PARTICLES).toBe(60);
  });
  it('hueColor cycles and never returns white', () => {
    expect(hueColor(0)).not.toBe(0xffffff);
    expect(hueColor(0.5)).not.toBe(hueColor(0));
    expect(hueColor(1)).toBe(hueColor(0));
    for (let i = 0; i < 20; i++) expect(hueColor(i / 20)).not.toBe(0xffffff);
  });
});
