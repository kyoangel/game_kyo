import { describe, expect, it } from 'vitest';
import { BOOST_COSTS, buyBoost, canBuyBoost, emptyBoosts, sanitizeBoosts } from './boosts.ts';

describe('boosts', () => {
  it('sanitizeBoosts handles invalid values and clamps shields to capacity', () => {
    expect(sanitizeBoosts(null, 2)).toEqual(emptyBoosts());
    expect(sanitizeBoosts({ shields: 5, shrink: true, chomp: 'yes' }, 2)).toEqual({ shields: 2, shrink: true, chomp: false });
    expect(sanitizeBoosts({ shields: -3, shrink: false, chomp: true }, 1)).toEqual({ shields: 0, shrink: false, chomp: true });
  });

  it('buyBoost stacks shields up to shieldCap and deducts coins', () => {
    const r1 = buyBoost({ coins: 25, boosts: emptyBoosts(), shieldCap: 2 }, 'shield');
    expect(r1).toEqual({ ok: true, coins: 15, boosts: { shields: 1, shrink: false, chomp: false } });
    if (!r1.ok) return;
    const r2 = buyBoost({ coins: r1.coins, boosts: r1.boosts, shieldCap: 2 }, 'shield');
    expect(r2).toEqual({ ok: true, coins: 5, boosts: { shields: 2, shrink: false, chomp: false } });
    if (!r2.ok) return;
    expect(buyBoost({ coins: 100, boosts: r2.boosts, shieldCap: 2 }, 'shield')).toEqual({ ok: false, reason: 'maxed' });
  });

  it('buyBoost equips shrink and chomp once per run', () => {
    const r1 = buyBoost({ coins: 150, boosts: emptyBoosts(), shieldCap: 1 }, 'shrink');
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.coins).toBe(150 - BOOST_COSTS.shrink);
    expect(r1.boosts.shrink).toBe(true);
    expect(buyBoost({ coins: 150, boosts: r1.boosts, shieldCap: 1 }, 'shrink')).toEqual({ ok: false, reason: 'maxed' });

    const r2 = buyBoost({ coins: r1.coins, boosts: r1.boosts, shieldCap: 1 }, 'chomp');
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.coins).toBe(150 - BOOST_COSTS.shrink - BOOST_COSTS.chomp);
    expect(r2.boosts.chomp).toBe(true);
    expect(canBuyBoost(r2.boosts, 'chomp', 500, 1)).toBe(false);
  });

  it('rejects purchase when coins are insufficient', () => {
    expect(buyBoost({ coins: 9, boosts: emptyBoosts(), shieldCap: 2 }, 'shield')).toEqual({ ok: false, reason: 'poor' });
    expect(buyBoost({ coins: 14, boosts: emptyBoosts(), shieldCap: 2 }, 'shrink')).toEqual({ ok: false, reason: 'poor' });
    expect(buyBoost({ coins: 19, boosts: emptyBoosts(), shieldCap: 2 }, 'chomp')).toEqual({ ok: false, reason: 'poor' });
  });
});
