import { describe, expect, it } from 'vitest';
import { BOOST_COSTS, buyBoost, canBuyBoost, canToggleBoost, emptyBoosts, sanitizeBoosts, toggleBoost } from './boosts.ts';

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

  describe('toggleBoost (title / results quick-buy bar: tap again to undo)', () => {
    it('buys a boost that is not equipped', () => {
      expect(toggleBoost({ coins: 50, boosts: emptyBoosts(), shieldCap: 2 }, 'shrink')).toEqual({
        ok: true, action: 'buy', coins: 50 - BOOST_COSTS.shrink, boosts: { shields: 0, shrink: true, chomp: false },
      });
    });

    it('refunds an equipped shrink or chomp in full', () => {
      const boosts = { shields: 0, shrink: true, chomp: true };
      expect(toggleBoost({ coins: 3, boosts, shieldCap: 1 }, 'shrink')).toEqual({
        ok: true, action: 'refund', coins: 3 + BOOST_COSTS.shrink, boosts: { shields: 0, shrink: false, chomp: true },
      });
      expect(toggleBoost({ coins: 3, boosts, shieldCap: 1 }, 'chomp')).toEqual({
        ok: true, action: 'refund', coins: 3 + BOOST_COSTS.chomp, boosts: { shields: 0, shrink: true, chomp: false },
      });
    });

    it('stacks shields up to the cap, then one more tap refunds every bought shield', () => {
      const r1 = toggleBoost({ coins: 30, boosts: emptyBoosts(), shieldCap: 2 }, 'shield');
      expect(r1).toMatchObject({ ok: true, action: 'buy', coins: 20, boosts: { shields: 1 } });
      if (!r1.ok) return;
      const r2 = toggleBoost({ coins: r1.coins, boosts: r1.boosts, shieldCap: 2 }, 'shield');
      expect(r2).toMatchObject({ ok: true, action: 'buy', coins: 10, boosts: { shields: 2 } });
      if (!r2.ok) return;
      const r3 = toggleBoost({ coins: r2.coins, boosts: r2.boosts, shieldCap: 2 }, 'shield');
      expect(r3).toEqual({ ok: true, action: 'refund', coins: 30, boosts: emptyBoosts() });
    });

    it('a shield tap that cannot afford the next one refunds the held ones instead of doing nothing', () => {
      expect(toggleBoost({ coins: 4, boosts: { shields: 1, shrink: false, chomp: false }, shieldCap: 3 }, 'shield')).toEqual({
        ok: true, action: 'refund', coins: 4 + BOOST_COSTS.shield, boosts: emptyBoosts(),
      });
    });

    it('rejects an unaffordable boost that is not equipped', () => {
      expect(toggleBoost({ coins: 9, boosts: emptyBoosts(), shieldCap: 2 }, 'shield')).toEqual({ ok: false, reason: 'poor' });
      expect(canToggleBoost(emptyBoosts(), 'chomp', 19, 1)).toBe(false);
      expect(canToggleBoost({ shields: 0, shrink: false, chomp: true }, 'chomp', 0, 1)).toBe(true);
    });
  });
});
