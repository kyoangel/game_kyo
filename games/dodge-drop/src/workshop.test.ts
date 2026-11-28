import { describe, expect, it } from 'vitest';
import {
  buyUpgrade, effectValue, emptyWorkshop, magnetPulls, magnetRadius, migrateWorkshop, nextCost, sanitizeWorkshop,
  shieldAfterPickup, shieldCapacity, shieldFirstAt, shieldInterval, startShieldChance, starInterval, UPGRADE_IDS, upgradeCost,
  grazeNeeded, maxLevel,
} from './workshop.ts';

describe('workshop table', () => {
  it('lists the six upgrades in row order (Shield Stack second, Graze Charger last)', () => {
    expect(UPGRADE_IDS).toEqual(['shield', 'shieldStack', 'startShield', 'magnet', 'luck', 'grazeCharge']);
  });
  it('costs 15/24/38/61/98 per level, 236 per 5-level upgrade; Graze Charger has 3 levels (77)', () => {
    expect([1, 2, 3, 4, 5].map(upgradeCost)).toEqual([15, 24, 38, 61, 98]);
    const per = [1, 2, 3, 4, 5].reduce((s, n) => s + upgradeCost(n), 0);
    expect(per).toBe(236);
    expect(maxLevel('grazeCharge')).toBe(3);
    const total = UPGRADE_IDS.reduce((s, id) => s + Array.from({ length: maxLevel(id) }, (_, i) => upgradeCost(i + 1)).reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(1180 + 77);
    expect(upgradeCost(0)).toBe(Infinity);
    expect(upgradeCost(6)).toBe(Infinity);
  });
  it('nextCost is the cost of the next level, null when maxed', () => {
    expect(nextCost(0)).toBe(15);
    expect(nextCost(4)).toBe(98);
    expect(nextCost(5)).toBeNull();
    expect(nextCost(2, maxLevel('grazeCharge'))).toBe(38);
    expect(nextCost(3, maxLevel('grazeCharge'))).toBeNull();
  });
  it('Graze Charger: a shield needs 8/7/6/5 near misses; buying stops at level 3; saves clamp to 3', () => {
    expect([0, 1, 2, 3].map(grazeNeeded)).toEqual([8, 7, 6, 5]);
    expect(grazeNeeded(9)).toBe(5);
    expect(effectValue('grazeCharge', 2)).toBe(6);
    const levels = { ...emptyWorkshop(), grazeCharge: 3 };
    expect(buyUpgrade({ coins: 999, levels }, 'grazeCharge')).toEqual({ ok: false, reason: 'max' });
    expect(sanitizeWorkshop({ grazeCharge: 5 }).grazeCharge).toBe(3);
  });
});

describe('workshop effects', () => {
  it('shield core: first at 25-3L, interval (30..40)*0.9^L (timing only)', () => {
    expect([0, 1, 2, 3, 4, 5].map(shieldFirstAt)).toEqual([25, 22, 19, 16, 13, 10]);
    expect(shieldInterval(0, 0)).toBe(30);
    expect(shieldInterval(0, 0.9999)).toBeCloseTo(40, 2);
    expect(shieldInterval(2, 0)).toBeCloseTo(30 * 0.9 ** 2, 6);
  });
  it('shield stack: capacity is 1 + L (1..6), from the shieldStack level', () => {
    expect([0, 1, 2, 3, 4, 5].map(shieldCapacity)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(effectValue('shieldStack', 3)).toBe(4);
    expect(effectValue('shield', 5)).toBe(10);
  });
  it('a pickup adds +1 held shield, capped at capacity', () => {
    expect(shieldAfterPickup(1, 1)).toBe(1);
    expect(shieldAfterPickup(0, 1)).toBe(1);
    expect(shieldAfterPickup(1, 3)).toBe(2);
    expect(shieldAfterPickup(3, 3)).toBe(3);
  });
  it('startShield chance 20/40/60/80/100 %', () => {
    expect([0, 1, 2, 3, 4, 5].map(startShieldChance)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
  it('magnet radius 0/80/140/220/320 px, unlimited (full screen) at L5', () => {
    expect([0, 1, 2, 3, 4, 5].map(magnetRadius)).toEqual([0, 80, 140, 220, 320, Infinity]);
  });
  it('magnetPulls: stars within radius; shields only while another can be held; Infinity pulls everything', () => {
    expect(magnetPulls('star', 79, 80, 3, 1)).toBe(true);
    expect(magnetPulls('star', 81, 80, 0, 1)).toBe(false);
    expect(magnetPulls('star', 5000, Infinity, 0, 1)).toBe(true);
    expect(magnetPulls('shield', 5000, Infinity, 0, 1)).toBe(true);
    expect(magnetPulls('shield', 5000, Infinity, 1, 1)).toBe(false);
    expect(magnetPulls('shield', 100, 140, 1, 2)).toBe(true);
    expect(magnetPulls('shield', 100, 140, 2, 2)).toBe(false);
    expect(magnetPulls('star', 10, 0, 0, 1)).toBe(false);
  });
  it('star interval (6..9)*(1-0.07L)', () => {
    expect(starInterval(0, 0)).toBe(6);
    expect(starInterval(0, 1)).toBe(9);
    expect(starInterval(5, 0)).toBeCloseTo(6 * 0.65, 9);
  });
  it('clamps out-of-range levels', () => {
    expect(shieldFirstAt(-3)).toBe(25);
    expect(shieldCapacity(99)).toBe(6);
  });
  it('effectValue gives the number shown per row', () => {
    expect(effectValue('shield', 2)).toBe(19);
    expect(effectValue('startShield', 3)).toBe(60);
    expect(effectValue('magnet', 1)).toBe(80);
    expect(effectValue('magnet', 5)).toBe(Infinity);
    expect(effectValue('luck', 5)).toBe(35);
  });
});

describe('retired upgrades (v3.8.0)', () => {
  it('refunds every level bought of Daredevil and Longer Chomp, and drops them', () => {
    const r = migrateWorkshop({ shield: 2, nearMiss: 5, combo: 2 });
    expect(r).toEqual({ workshop: { ...emptyWorkshop(), shield: 2 }, refund: 236 + 15 + 24, changed: true });
  });
  it('a save without retired keys is unchanged and refunds nothing (so the refund is paid once)', () => {
    expect(migrateWorkshop({ shield: 2 })).toEqual({ workshop: { ...emptyWorkshop(), shield: 2 }, refund: 0, changed: false });
    expect(migrateWorkshop(migrateWorkshop({ nearMiss: 3 }).workshop).changed).toBe(false);
  });
  it('a retired key at level 0 or garbage is dropped without a refund', () => {
    expect(migrateWorkshop({ nearMiss: 0, combo: 'x' })).toMatchObject({ refund: 0, changed: true });
    expect(migrateWorkshop({ combo: 99 }).refund).toBe(236);
    expect(migrateWorkshop(null)).toMatchObject({ refund: 0, changed: false });
  });
});

describe('sanitize / buy', () => {
  it('missing shieldStack sanitizes to 0', () => {
    expect(sanitizeWorkshop({ shield: 2 }).shieldStack).toBe(0);
  });
  it('sanitizes unknown ids and out-of-range levels to 0..5', () => {
    expect(sanitizeWorkshop({ shield: 3, bogus: 2, magnet: 9, luck: -1, startShield: '2', shieldStack: 2.7 })).toEqual({
      shield: 3, shieldStack: 2, startShield: 0, magnet: 5, luck: 0, grazeCharge: 0,
    });
    expect(sanitizeWorkshop(null)).toEqual(emptyWorkshop());
    expect(sanitizeWorkshop([1, 2])).toEqual(emptyWorkshop());
  });
  it('buyUpgrade: ok, poor, max, unknown', () => {
    const levels = { ...emptyWorkshop(), shield: 1 };
    expect(buyUpgrade({ coins: 30, levels }, 'shield')).toEqual({ ok: true, coins: 6, levels: { ...levels, shield: 2 } });
    expect(buyUpgrade({ coins: 23, levels }, 'shield')).toEqual({ ok: false, reason: 'poor' });
    expect(buyUpgrade({ coins: 999, levels: { ...levels, shield: 5 } }, 'shield')).toEqual({ ok: false, reason: 'max' });
    expect(buyUpgrade({ coins: 999, levels }, 'dash')).toEqual({ ok: false, reason: 'unknown' });
  });
  it('shieldStack uses the same cost curve', () => {
    expect(buyUpgrade({ coins: 15, levels: emptyWorkshop() }, 'shieldStack')).toEqual({
      ok: true, coins: 0, levels: { ...emptyWorkshop(), shieldStack: 1 },
    });
  });
  it('buyUpgrade does not mutate its input', () => {
    const levels = emptyWorkshop();
    buyUpgrade({ coins: 100, levels }, 'luck');
    expect(levels.luck).toBe(0);
  });
});
