import { describe, it, expect } from 'vitest';
import { ANIM_STATES } from '../../src/battle/AnimationState';

// Tests fail until src/battle/AnimationState.ts is created and exports ANIM_STATES.
// AnimState covers all 6 states the animator can be in at any moment.

describe('ANIM_STATES', () => {
  it('is exported from AnimationState.ts', () => {
    expect(ANIM_STATES).toBeDefined();
  });

  it('contains exactly 6 animation states', () => {
    expect(ANIM_STATES).toHaveLength(6);
  });

  it('includes idle — default state for any alive character not currently acting', () => {
    expect(ANIM_STATES).toContain('idle');
  });

  it('includes walk — plays when a character steps up to act', () => {
    expect(ANIM_STATES).toContain('walk');
  });

  it('includes attack — lunge played immediately after walk forward leg', () => {
    expect(ANIM_STATES).toContain('attack');
  });

  it('includes hit — plays on the target when damage is applied', () => {
    expect(ANIM_STATES).toContain('hit');
  });

  it('includes die — plays once target.alive flips to false', () => {
    expect(ANIM_STATES).toContain('die');
  });

  it('includes skill — played instead of attack when cmd.action === "skill"', () => {
    expect(ANIM_STATES).toContain('skill');
  });

  it('has no duplicate states', () => {
    expect(new Set(ANIM_STATES).size).toBe(ANIM_STATES.length);
  });
});
