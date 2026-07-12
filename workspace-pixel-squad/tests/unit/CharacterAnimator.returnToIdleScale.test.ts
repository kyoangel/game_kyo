import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import { extractMethod } from './support/extractMethod';

// Bug report: enemy (and party) sprites visibly widen after attacking or
// being hit, and stay widened afterward. Root cause is the same class of
// bug already fixed once for playIdleLoop's breathing tween (see
// CharacterAnimator.idleJitter.test.ts / the "monster idle scale-jitter
// fix" comment) — an absolute scale target that's correct for legacy
// rectangle/Image bodies (which sit at scaleX=1) but wrong for real sprite
// bodies (scaled far below 1 via setDisplaySize, e.g. 44/256 ≈ 0.17).
//
// returnToIdle() is called on both the attacker and the hit target after
// every attack/hit (BattleScene.ts: `attackerView.animator.returnToIdle()`
// and `targetView.animator.playHit(isCrit, () => targetView.animator.returnToIdle())`).
// Its tween unconditionally set `scaleX: 1`, which for a sprite body
// stretches it toward native pixel width (~6x wider) — and playIdleLoop()
// never resets scale afterward, so the sprite stays stretched for the rest
// of the battle. This was never covered by the idleJitter fix because it's
// a different method.

describe('CharacterAnimator.returnToIdle — does not force sprite bodies to scaleX 1', () => {
  let source: string;
  let body: string;

  beforeAll(() => {
    source = readFileSync(resolve(__dirname, '../../src/battle/CharacterAnimator.ts'), 'utf-8');
    body = extractMethod(source, 'returnToIdle');
  });

  it('method exists', () => {
    expect(body).not.toBe('');
  });

  it('checks this.isSprite before touching scaleX, instead of resetting it unconditionally', () => {
    expect(body).toMatch(/this\.isSprite/);
  });

  it('no longer sets scaleX: 1 unconditionally on every body (sprite or not)', () => {
    expect(body).not.toMatch(/x:\s*this\.originX,\s*scaleX:\s*1,/);
  });
});
