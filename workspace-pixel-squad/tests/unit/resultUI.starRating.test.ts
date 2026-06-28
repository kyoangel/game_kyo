/**
 * AC-10: Result — star rating display
 * Stars (1–3) appear above VICTORY based on performance:
 *   1 star  = any win
 *   2 stars = win with no player KOs
 *   3 stars = win with no KOs AND completed in ≤5 turns
 * Defeat = 0 stars (no stars shown).
 */
import { describe, it, expect } from 'vitest';
import { calculateStarRating } from '../../src/ui/starRating';

describe('calculateStarRating', () => {
  it('returns 0 stars on defeat regardless of conditions', () => {
    expect(calculateStarRating(false, 0, 3)).toBe(0);
  });

  it('returns at least 1 star for any victory', () => {
    expect(calculateStarRating(true, 5, 20)).toBeGreaterThanOrEqual(1);
  });

  it('returns 1 star when victory but player had KOs', () => {
    expect(calculateStarRating(true, 1, 3)).toBe(1);
  });

  it('returns 2 stars when victory with no player KOs but over 5 turns', () => {
    expect(calculateStarRating(true, 0, 6)).toBe(2);
  });

  it('returns 3 stars when victory, no KOs, and completed in exactly 5 turns', () => {
    expect(calculateStarRating(true, 0, 5)).toBe(3);
  });

  it('returns 3 stars when victory, no KOs, and completed in fewer than 5 turns', () => {
    expect(calculateStarRating(true, 0, 2)).toBe(3);
  });

  it('returns 2 stars when victory, no KOs, and turns === 5+1', () => {
    expect(calculateStarRating(true, 0, 6)).toBe(2);
  });

  it('maximum possible rating is 3', () => {
    expect(calculateStarRating(true, 0, 1)).toBeLessThanOrEqual(3);
  });

  it('minimum possible on victory is 1', () => {
    expect(calculateStarRating(true, 99, 99)).toBeGreaterThanOrEqual(1);
  });
});

describe('star animation timing', () => {
  it('each star animates in with a 200ms sequential delay', async () => {
    const { STAR_ANIMATION_DELAY_MS } = await import('../../src/ui/starRating');
    expect(STAR_ANIMATION_DELAY_MS).toBe(200);
  });
});
