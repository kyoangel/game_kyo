import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import { extractMethod } from './support/extractMethod';

// CharacterAnimator can't be instantiated in vitest (needs a real Phaser.Scene),
// so this asserts the fix at the source level like the BattleScene wiring tests.
// See docs/specs/pixel-squad/battle-screen-tenchi2-homage.md "戰鬥演出" (idle jitter fix)
// and the 2026-07-05 QA note in docs/specs/pixel-squad/backlog.md.

describe('CharacterAnimator.playIdleLoop — monster idle scale-jitter fix', () => {
  let source: string;

  beforeAll(() => {
    source = readFileSync(resolve(__dirname, '../../src/battle/CharacterAnimator.ts'), 'utf-8');
  });

  it('computes the breathing scaleY target relative to the body\'s current scale, not an absolute value', () => {
    const body = extractMethod(source, 'playIdleLoop');
    expect(body).not.toBe('');
    // Root cause: monster Images are scaled far below 1 via setDisplaySize()
    // (256px source down to 44x56 display), so tweening straight to the
    // absolute IDLE_CONFIG.rect.breathingScaleY (1.03) caused a dramatic pop
    // every cycle. The fix multiplies the *current* scaleY by the config
    // ratio instead of using it as an absolute target.
    expect(body).toMatch(/scaleY:\s*.*\*\s*IDLE_CONFIG\.rect\.breathingScaleY/);
    expect(body).not.toMatch(/scaleY:\s*IDLE_CONFIG\.rect\.breathingScaleY\s*,/);
  });
});
