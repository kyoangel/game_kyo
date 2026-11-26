import { describe, expect, it } from 'vitest';
import { buildRunConfig } from './runSetup.ts';
import { DEFAULT_ASSIST } from './progression.ts';
import { emptyWorkshop } from './workshop.ts';

const ws = (o: Partial<ReturnType<typeof emptyWorkshop>> = {}) => ({ ...emptyWorkshop(), ...o });
const base = { workshop: ws(), assist: DEFAULT_ASSIST, tier: 'none' as const, rng: () => 0.5 };

describe('buildRunConfig', () => {
  it('defaults: clock 0, no grace, no multipliers, no start shield', () => {
    expect(buildRunConfig(base)).toMatchObject({
      tier: 'none', startT: 0, grace: 0, assisted: false, speedMul: 1, intervalMul: 1,
      shieldLevel: 0, shieldCapacity: 1, startShieldHits: 0, firstShieldAt: 25, magnetRadius: 0,
      nearMissWindow: 34, grazeChompSeconds: 4, luckLevel: 0, rushIdx: 0,
    });
  });
  it('silver start: clock 30, 2 s grace, shield timing relative to start, no rush passed yet', () => {
    const c = buildRunConfig({ ...base, tier: 'silver', workshop: ws({ shield: 2 }) });
    expect(c).toMatchObject({ startT: 30, grace: 2, firstShieldAt: 30 + 19, rushIdx: 0 });
  });
  it('gold start: clock 60, past the 45 s rush', () => {
    expect(buildRunConfig({ ...base, tier: 'gold' })).toMatchObject({ startT: 60, rushIdx: 1 });
  });
  it('workshop levels feed the getters; capacity comes from Shield Stack only', () => {
    const c = buildRunConfig({ ...base, workshop: ws({ shield: 5, magnet: 3, nearMiss: 4, combo: 2, luck: 1 }) });
    expect(c).toMatchObject({ shieldCapacity: 1, magnetRadius: 220, nearMissWindow: 50, luckLevel: 1 });
    expect(c.grazeChompSeconds).toBe(5.6);
    expect(c.firstShieldAt).toBe(10);
    expect(buildRunConfig({ ...base, workshop: ws({ shieldStack: 4 }) }).shieldCapacity).toBe(5);
  });
  it('start shield is a chance roll against the rng and grants exactly 1 shield', () => {
    const lv2 = ws({ startShield: 2 });
    expect(buildRunConfig({ ...base, workshop: lv2, rng: () => 0.39 }).startShieldHits).toBe(1);
    expect(buildRunConfig({ ...base, workshop: lv2, rng: () => 0.4 }).startShieldHits).toBe(0);
    expect(buildRunConfig({ ...base, workshop: ws({ startShield: 5, shieldStack: 5 }), rng: () => 0.99 }).startShieldHits).toBe(1);
  });
  it('assist: shield held at start (no stacking), 0.85x speed, 1.25x interval', () => {
    const c = buildRunConfig({ ...base, assist: { ...DEFAULT_ASSIST, active: true }, workshop: ws({ startShield: 5, shieldStack: 3 }) });
    expect(c).toMatchObject({ assisted: true, speedMul: 0.85, intervalMul: 1.25, startShieldHits: 1 });
  });
  it('boosts: add start shields up to capacity, enable shrink scale and chomp mode', () => {
    const c = buildRunConfig({
      ...base,
      workshop: ws({ shieldStack: 2 }),
      boosts: { shields: 4, shrink: true, chomp: true },
    });
    expect(c.startShieldHits).toBe(3); // bought shields clamped to shieldCapacity(2) = 3
    expect(c.playerScale).toBeCloseTo(0.7, 9);
    expect(c.chompArmed).toBe(true);
  });
  it('free start shield stacks on top of maxed purchased shields (never wastes coins)', () => {
    const c = buildRunConfig({
      ...base,
      workshop: ws({ shieldStack: 4, startShield: 5 }), // capacity 5, 100% free start shield
      boosts: { shields: 5, shrink: false, chomp: false },
    });
    expect(c.shieldCapacity).toBe(5);
    expect(c.startShieldHits).toBe(6); // 5 bought + 1 free start shield
  });
});
