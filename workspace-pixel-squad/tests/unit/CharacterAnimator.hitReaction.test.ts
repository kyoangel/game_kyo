import { describe, it, expect } from 'vitest';
import { HIT_CONFIG, CRIT_HIT_CONFIG } from '../../src/battle/AnimationState';

// Tests fail until src/battle/AnimationState.ts exports HIT_CONFIG and CRIT_HIT_CONFIG.
//
// Spec: hit reaction applies to ALL bodies (sprite or rectangle) via tint flash + shake.
// Crit: brighter flash (alpha 0.85 vs 0.6), longer duration (280ms vs 200ms),
//        one extra shake oscillation (4 vs 3).

describe('HIT_CONFIG (normal hit — non-fatal damage on any body type)', () => {
  it('is exported from AnimationState.ts', () => {
    expect(HIT_CONFIG).toBeDefined();
  });

  it('tint color is red (0xff0000) — consistent across sprite and rectangle bodies', () => {
    expect(HIT_CONFIG.tintColor).toBe(0xff0000);
  });

  it('flash alpha starts at 0.6 then fades to 0', () => {
    expect(HIT_CONFIG.flashAlpha).toBe(0.6);
  });

  it('flash fades over 200ms', () => {
    expect(HIT_CONFIG.flashDuration).toBe(200);
  });

  it('shake amplitude is ±6px', () => {
    expect(HIT_CONFIG.shakeAmplitude).toBe(6);
  });

  it('shake has 3 oscillations', () => {
    expect(HIT_CONFIG.shakeOscillations).toBe(3);
  });

  it('shake completes in 220ms total', () => {
    expect(HIT_CONFIG.shakeDuration).toBe(220);
  });
});

describe('CRIT_HIT_CONFIG (critical hit — isCrit === true)', () => {
  it('is exported from AnimationState.ts', () => {
    expect(CRIT_HIT_CONFIG).toBeDefined();
  });

  it('tint color is still red (0xff0000)', () => {
    expect(CRIT_HIT_CONFIG.tintColor).toBe(0xff0000);
  });

  it('flash alpha is brighter at 0.85', () => {
    expect(CRIT_HIT_CONFIG.flashAlpha).toBe(0.85);
  });

  it('flash duration is longer at 280ms', () => {
    expect(CRIT_HIT_CONFIG.flashDuration).toBe(280);
  });

  it('shake has one extra oscillation — 4 total', () => {
    expect(CRIT_HIT_CONFIG.shakeOscillations).toBe(4);
  });

  it('crit flash alpha is strictly greater than normal hit alpha', () => {
    expect(CRIT_HIT_CONFIG.flashAlpha).toBeGreaterThan(HIT_CONFIG.flashAlpha);
  });

  it('crit flash duration is strictly longer than normal hit duration', () => {
    expect(CRIT_HIT_CONFIG.flashDuration).toBeGreaterThan(HIT_CONFIG.flashDuration);
  });

  it('crit oscillations exceed normal by exactly one', () => {
    expect(CRIT_HIT_CONFIG.shakeOscillations).toBe(HIT_CONFIG.shakeOscillations + 1);
  });
});
