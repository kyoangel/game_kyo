import { describe, it, expect } from 'vitest';
import { WALK_CONFIG, ATTACK_CONFIG, IDLE_CONFIG, deriveFacing } from '../../src/battle/AnimationState';

// Tests fail until src/battle/AnimationState.ts exports
// WALK_CONFIG, ATTACK_CONFIG, IDLE_CONFIG, and deriveFacing.
//
// Spec:
//   Walk: player chars step +24px toward enemy side; enemies step -24px toward player side.
//          Duration: 220ms forward / 220ms back. Applies equally to sprite and rectangle bodies.
//   Attack: 6 frames × 60ms/frame = 360ms once. For sprite bodies this is the Attack row;
//            for rectangle bodies a scale-punch tween (same duration).
//   Idle: sprite holds gesture frame (row 9); rectangle does scaleY breathing 1.0↔1.03,
//          1200ms yoyo loop — so non-sprite characters aren't completely static.
//   Timing contract: Attack (360ms) + Hit (220ms) = 580ms < 900ms command window,
//                    so animations complete before the next command without added delay.

describe('WALK_CONFIG', () => {
  it('is exported from AnimationState.ts', () => {
    expect(WALK_CONFIG).toBeDefined();
  });

  it('step distance is 24px — same offset for both player and enemy', () => {
    expect(WALK_CONFIG.stepPx).toBe(24);
  });

  it('forward leg duration is 220ms', () => {
    expect(WALK_CONFIG.forwardDuration).toBe(220);
  });

  it('return leg duration is 220ms', () => {
    expect(WALK_CONFIG.returnDuration).toBe(220);
  });
});

describe('ATTACK_CONFIG', () => {
  it('is exported from AnimationState.ts', () => {
    expect(ATTACK_CONFIG).toBeDefined();
  });

  it('attack animation has 6 frames', () => {
    expect(ATTACK_CONFIG.frameCount).toBe(6);
  });

  it('each attack frame lasts 60ms', () => {
    expect(ATTACK_CONFIG.frameDuration).toBe(60);
  });

  it('attack total duration is 360ms (6 × 60)', () => {
    expect(ATTACK_CONFIG.totalDuration).toBe(360);
  });

  it('attack + normal hit (360 + 220 = 580ms) fits inside the 900ms command window', () => {
    const attackPlusHit = ATTACK_CONFIG.totalDuration + 220;
    expect(attackPlusHit).toBeLessThan(900);
  });
});

describe('IDLE_CONFIG (idle loop for non-acting alive characters)', () => {
  it('is exported from AnimationState.ts', () => {
    expect(IDLE_CONFIG).toBeDefined();
  });

  it('rectangle breathing max scaleY is 1.03', () => {
    expect(IDLE_CONFIG.rect.breathingScaleY).toBe(1.03);
  });

  it('rectangle breathing cycle duration is 1200ms', () => {
    expect(IDLE_CONFIG.rect.breathingDuration).toBe(1200);
  });

  it('rectangle breathing uses yoyo so scaleY returns to 1.0 each cycle', () => {
    expect(IDLE_CONFIG.rect.yoyo).toBe(true);
  });
});

describe('deriveFacing', () => {
  it('is exported from AnimationState.ts', () => {
    expect(deriveFacing).toBeDefined();
  });

  it('player characters (isPlayer = true) face right — stepping toward enemy side', () => {
    expect(deriveFacing(true)).toBe('right');
  });

  it('enemy characters (isPlayer = false) face left — stepping toward player side', () => {
    expect(deriveFacing(false)).toBe('left');
  });

  it('facing is always one of the two valid AnimRequest directions', () => {
    const validFacings = ['left', 'right'];
    expect(validFacings).toContain(deriveFacing(true));
    expect(validFacings).toContain(deriveFacing(false));
  });

  it('player and enemy face opposite directions', () => {
    expect(deriveFacing(true)).not.toBe(deriveFacing(false));
  });
});
