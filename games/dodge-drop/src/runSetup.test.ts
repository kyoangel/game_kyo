import { describe, expect, it } from 'vitest';
import { buildRunConfig } from './runSetup.ts';
import { DEFAULT_ASSIST } from './progression.ts';
import { emptyWorkshop } from './workshop.ts';

const ws = (o: Partial<ReturnType<typeof emptyWorkshop>> = {}) => ({ ...emptyWorkshop(), ...o });
const base = { workshop: ws(), assist: DEFAULT_ASSIST, tier: 'none' as const, rng: () => 0.5 };

describe('buildRunConfig', () => {
  it('defaults: clock 0, no grace, no multipliers, no start shield', () => {
    expect(buildRunConfig(base)).toMatchObject({
      tier: 'none', startT: 0, grace: 0, headStart: 0, assisted: false, speedMul: 1, intervalMul: 1,
      shieldLevel: 0, shieldCapacity: 1, startShieldHits: 0, firstShieldAt: 25, magnetRadius: 0,
      nearMissWindow: 28, comboTimeout: 2.5, luckLevel: 0, rushIdx: 0,
    });
  });
  it('silver start: clock 60, 2 s grace, head start 147, shield timing relative to start, rush index 1', () => {
    const c = buildRunConfig({ ...base, tier: 'silver', workshop: ws({ shield: 2 }) });
    expect(c).toMatchObject({ startT: 60, grace: 2, headStart: 147, firstShieldAt: 60 + 19, rushIdx: 1 });
  });
  it('workshop levels feed the getters; L5 shield holds 2 hits', () => {
    const c = buildRunConfig({ ...base, workshop: ws({ shield: 5, magnet: 3, nearMiss: 4, combo: 2, luck: 1 }) });
    expect(c).toMatchObject({ shieldCapacity: 2, magnetRadius: 100, nearMissWindow: 37, luckLevel: 1 });
    expect(c.comboTimeout).toBeCloseTo(2.8, 9);
    expect(c.firstShieldAt).toBe(10);
  });
  it('start shield is a chance roll against the rng; L5 shield start grants full capacity', () => {
    const lv2 = ws({ startShield: 2 });
    expect(buildRunConfig({ ...base, workshop: lv2, rng: () => 0.39 }).startShieldHits).toBe(1);
    expect(buildRunConfig({ ...base, workshop: lv2, rng: () => 0.4 }).startShieldHits).toBe(0);
    expect(buildRunConfig({ ...base, workshop: ws({ startShield: 5, shield: 5 }), rng: () => 0.99 }).startShieldHits).toBe(2);
  });
  it('assist: shield held at start (no stacking), 0.85x speed, 1.25x interval', () => {
    const c = buildRunConfig({ ...base, assist: { ...DEFAULT_ASSIST, active: true }, workshop: ws({ startShield: 5 }) });
    expect(c).toMatchObject({ assisted: true, speedMul: 0.85, intervalMul: 1.25, startShieldHits: 1 });
  });
});
