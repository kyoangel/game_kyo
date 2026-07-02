/**
 * Spec: pixel-squad-mercenary-rating
 * Result — star rating display
 * Stars (1–3) appear above VICTORY based on performance:
 *   1 star  = any win with playerKOs > 0 (survival gate fails)
 *   2 stars = win with no player KOs, and (roundsUsed > 5 OR weaknessHitCount === 0)
 *   3 stars = win with no player KOs, roundsUsed <= 5, AND weaknessHitCount >= 1
 * Defeat = 0 stars (no stars shown).
 */
import { describe, it, expect } from 'vitest';
import { calculateStarRating } from '../../src/ui/starRating';

describe('calculateStarRating', () => {
  it('AC-5: returns 0 stars on defeat regardless of conditions', () => {
    expect(calculateStarRating(false, 0, 3, 0)).toBe(0);
  });

  it('AC-4: returns 1 star when victory but player had KOs (KO gate overrides everything else)', () => {
    expect(calculateStarRating(true, 1, 3, 1)).toBe(1);
  });

  it('AC-3: returns 2 stars when victory, no KOs, >=1 weakness hit, but rounds > 5 (rounds gate caps it)', () => {
    expect(calculateStarRating(true, 0, 6, 1)).toBe(2);
  });

  it('AC-1: returns 2 stars when victory, no KOs, fast rounds, but zero weakness hits (weakness gate caps it)', () => {
    expect(calculateStarRating(true, 0, 3, 0)).toBe(2);
  });

  it('AC-2: returns 3 stars when victory, no KOs, exactly 5 rounds (inclusive boundary), and >=1 weakness hit', () => {
    expect(calculateStarRating(true, 0, 5, 1)).toBe(3);
  });

  it('AC-2: returns 3 stars when victory, no KOs, fewer than 5 rounds, and >=1 weakness hit', () => {
    expect(calculateStarRating(true, 0, 2, 1)).toBe(3);
  });

  it('AC-4: KO gate wins regardless of rounds/weakness stats', () => {
    expect(calculateStarRating(true, 99, 99, 0)).toBe(1);
  });
});

describe('star animation timing', () => {
  it('each star animates in with a 200ms sequential delay', async () => {
    const { STAR_ANIMATION_DELAY_MS } = await import('../../src/ui/starRating');
    expect(STAR_ANIMATION_DELAY_MS).toBe(200);
  });
});
