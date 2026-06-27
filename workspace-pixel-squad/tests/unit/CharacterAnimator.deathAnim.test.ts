import { describe, it, expect } from 'vitest';
import { DIE_CONFIG } from '../../src/battle/AnimationState';

// Tests fail until src/battle/AnimationState.ts exports DIE_CONFIG.
//
// Spec: death animation plays once target.alive flips to false.
//   Sprite: Death row (row 8), 6 frames × 80ms = 480ms, hold last frame at alpha 0.3.
//   Rectangle: fade + rotate (alpha 1→0.2, rotation 0→8°) over 480ms.
//
// The advance delay is Math.max(900, dieDuration + 200).
// Since 480 + 200 = 680 < 900, the existing 900ms window already covers the death animation —
// no extra delay is added compared to the normal attack flow.

describe('DIE_CONFIG.sprite (protagonist / future sprite characters)', () => {
  it('is exported from AnimationState.ts', () => {
    expect(DIE_CONFIG).toBeDefined();
  });

  it('sprite death row has 6 frames', () => {
    expect(DIE_CONFIG.sprite.frameCount).toBe(6);
  });

  it('each sprite death frame lasts 80ms', () => {
    expect(DIE_CONFIG.sprite.frameDuration).toBe(80);
  });

  it('sprite death total duration is 480ms (6 × 80)', () => {
    expect(DIE_CONFIG.sprite.totalDuration).toBe(480);
  });

  it('sprite settles at alpha 0.3 — not the old instant 0.2 snap', () => {
    expect(DIE_CONFIG.sprite.settleAlpha).toBe(0.3);
  });

  it('sprite settle alpha differs from rectangle settle alpha (0.3 vs 0.2)', () => {
    expect(DIE_CONFIG.sprite.settleAlpha).not.toBe(DIE_CONFIG.rect.settleAlpha);
  });
});

describe('DIE_CONFIG.rect (rectangle-body fallback for recruits and enemies)', () => {
  it('rectangle death total duration matches sprite (480ms) — bodies animate in sync', () => {
    expect(DIE_CONFIG.rect.totalDuration).toBe(480);
  });

  it('rectangle settles at alpha 0.2', () => {
    expect(DIE_CONFIG.rect.settleAlpha).toBe(0.2);
  });

  it('rectangle rotation at death is 8 degrees', () => {
    expect(DIE_CONFIG.rect.rotationDeg).toBe(8);
  });
});

describe('death advance-delay gate', () => {
  it('dieDuration + 200 = 680, which is less than the base 900ms command window', () => {
    const dieDuration = DIE_CONFIG.sprite.totalDuration;
    expect(dieDuration + 200).toBeLessThan(900);
  });

  it('Math.max(900, dieDuration + 200) resolves to 900 — no extra wait beyond base window', () => {
    const dieDuration = DIE_CONFIG.sprite.totalDuration;
    expect(Math.max(900, dieDuration + 200)).toBe(900);
  });
});
