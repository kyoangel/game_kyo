import { describe, it, expect } from 'vitest';
import { PROTAGONIST_ANIM_KEYS } from '../../src/data/sprites';

// These tests fail until PROTAGONIST_ANIM_KEYS is exported from src/data/sprites.ts.
// Row references match the LPC layout documented at the top of sprites.ts:
//   Row 0-3: Walk (Up/Left/Down/Right, 9 frames each)
//   Row 4-7: Attack (Up/Left/Down/Right, 6 frames each)
//   Row 8: Death (6 frames)
//   Row 9: Idle/Gesture (1 frame held)

describe('PROTAGONIST_ANIM_KEYS', () => {
  it('is exported from sprites.ts', () => {
    expect(PROTAGONIST_ANIM_KEYS).toBeDefined();
  });

  it('walkRight key is protagonist_walk_right (LPC row 3, 9 frames)', () => {
    expect(PROTAGONIST_ANIM_KEYS.walkRight).toBe('protagonist_walk_right');
  });

  it('walkLeft key is protagonist_walk_left (LPC row 1, 9 frames)', () => {
    expect(PROTAGONIST_ANIM_KEYS.walkLeft).toBe('protagonist_walk_left');
  });

  it('attackRight key is protagonist_attack_right (LPC row 7, 6 frames)', () => {
    expect(PROTAGONIST_ANIM_KEYS.attackRight).toBe('protagonist_attack_right');
  });

  it('attackLeft key is protagonist_attack_left (LPC row 5, 6 frames)', () => {
    expect(PROTAGONIST_ANIM_KEYS.attackLeft).toBe('protagonist_attack_left');
  });

  it('death key is protagonist_death (LPC row 8, 6 frames)', () => {
    expect(PROTAGONIST_ANIM_KEYS.death).toBe('protagonist_death');
  });

  it('idle key is protagonist_idle_gesture (LPC row 9, single gesture frame)', () => {
    expect(PROTAGONIST_ANIM_KEYS.idle).toBe('protagonist_idle_gesture');
  });

  it('contains exactly the 6 animation keys for the LPC protagonist sheet', () => {
    expect(Object.keys(PROTAGONIST_ANIM_KEYS).sort()).toEqual(
      ['attackLeft', 'attackRight', 'death', 'idle', 'walkLeft', 'walkRight'].sort(),
    );
  });
});
