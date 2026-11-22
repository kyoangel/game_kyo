import { describe, expect, it } from 'vitest';
import {
  buyUpgrade, comboTimeout, effectValue, emptyWorkshop, magnetRadius, nearMissWindow, nextCost, sanitizeWorkshop,
  shieldCapacity, shieldFirstAt, shieldInterval, startShieldChance, starInterval, UPGRADE_IDS, upgradeCost,
} from './workshop.ts';

describe('workshop table', () => {
  it('lists the six upgrades in row order', () => {
    expect(UPGRADE_IDS).toEqual(['shield', 'startShield', 'magnet', 'nearMiss', 'combo', 'luck']);
  });
  it('costs 15/24/38/61/98 per level, 236 per upgrade, 1416 total', () => {
    expect([1, 2, 3, 4, 5].map(upgradeCost)).toEqual([15, 24, 38, 61, 98]);
    const per = [1, 2, 3, 4, 5].reduce((s, n) => s + upgradeCost(n), 0);
    expect(per).toBe(236);
    expect(per * UPGRADE_IDS.length).toBe(1416);
    expect(upgradeCost(0)).toBe(Infinity);
    expect(upgradeCost(6)).toBe(Infinity);
  });
  it('nextCost is the cost of the next level, null when maxed', () => {
    expect(nextCost(0)).toBe(15);
    expect(nextCost(4)).toBe(98);
    expect(nextCost(5)).toBeNull();
  });
});

describe('workshop effects', () => {
  it('shield: first at 25-3L, interval (30..40)*0.92^L, capacity 2 only at L5', () => {
    expect([0, 1, 2, 3, 4, 5].map(shieldFirstAt)).toEqual([25, 22, 19, 16, 13, 10]);
    expect(shieldInterval(0, 0)).toBe(30);
    expect(shieldInterval(0, 0.9999)).toBeCloseTo(40, 2);
    expect(shieldInterval(2, 0)).toBeCloseTo(30 * 0.92 ** 2, 6);
    expect([0, 1, 2, 3, 4, 5].map(shieldCapacity)).toEqual([1, 1, 1, 1, 1, 2]);
  });
  it('startShield chance 20/40/60/80/100 %', () => {
    expect([0, 1, 2, 3, 4, 5].map(startShieldChance)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
  it('magnet radius 40/70/100/130/160 px', () => {
    expect([0, 1, 2, 3, 4, 5].map(magnetRadius)).toEqual([0, 40, 70, 100, 130, 160]);
  });
  it('near-miss window 28 -> 30/32/35/37/39 px', () => {
    expect([0, 1, 2, 3, 4, 5].map(nearMissWindow)).toEqual([28, 30, 32, 35, 37, 39]);
  });
  it('combo timeout 2.5 + 0.15L', () => {
    expect(comboTimeout(0)).toBe(2.5);
    expect(comboTimeout(5)).toBeCloseTo(3.25, 9);
  });
  it('star interval (6..9)*(1-0.07L)', () => {
    expect(starInterval(0, 0)).toBe(6);
    expect(starInterval(0, 1)).toBe(9);
    expect(starInterval(5, 0)).toBeCloseTo(6 * 0.65, 9);
  });
  it('clamps out-of-range levels', () => {
    expect(shieldFirstAt(-3)).toBe(25);
    expect(nearMissWindow(99)).toBe(39);
    expect(shieldCapacity(99)).toBe(2);
  });
  it('effectValue gives the number shown per row', () => {
    expect(effectValue('shield', 2)).toBe(19);
    expect(effectValue('startShield', 3)).toBe(60);
    expect(effectValue('magnet', 1)).toBe(40);
    expect(effectValue('nearMiss', 3)).toBe(35);
    expect(effectValue('combo', 4)).toBeCloseTo(3.1, 9);
    expect(effectValue('luck', 5)).toBe(35);
  });
});

describe('sanitize / buy', () => {
  it('sanitizes unknown ids and out-of-range levels to 0..5', () => {
    expect(sanitizeWorkshop({ shield: 3, bogus: 2, magnet: 9, luck: -1, combo: '2', nearMiss: 2.7 })).toEqual({
      shield: 3, startShield: 0, magnet: 5, nearMiss: 2, combo: 0, luck: 0,
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
  it('buyUpgrade does not mutate its input', () => {
    const levels = emptyWorkshop();
    buyUpgrade({ coins: 100, levels }, 'luck');
    expect(levels.luck).toBe(0);
  });
});
