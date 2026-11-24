import { describe, expect, it } from 'vitest';
import { PLAYER_Y as FAIR_Y } from './fairness.ts';
import { dragToDx, PLAYER_Y, STRIP_TOP } from './layout.ts';

describe('layout', () => {
  it('player sits at y 1000, above the control strip, and the validator uses the same value', () => {
    expect(PLAYER_Y).toBe(1000);
    expect(FAIR_Y).toBe(PLAYER_Y);
    expect(STRIP_TOP).toBeGreaterThan(PLAYER_Y);
  });
  it('drag is relative with 1.5x sensitivity', () => {
    expect(dragToDx(100)).toBe(150);
    expect(dragToDx(-40)).toBe(-60);
  });
  it('dragToDx compensates for the camera zoom so on-screen follow ratio is constant', () => {
    expect(dragToDx(100)).toBe(150);
    expect(dragToDx(100, 0.5)).toBe(300);
    expect(dragToDx(100, 0)).toBe(150); // guard against a zero zoom
  });
});
