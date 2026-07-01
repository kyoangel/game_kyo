import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

// Spec: pixel-squad-all-out-attack-wiring — AC-12
//
// If a hit kills the last alive enemy, checkBattleEnd() transitions to
// ResultScene, but any delayedCall already queued (e.g. the weakness-reveal
// banner, or the AOA confirm result) will still fire on the now-inactive
// scene. Every such callback must start with `if (!this.scene.isActive())
// return;`. This is verified by reading BattleScene.ts source text (the
// scene can't be instantiated in the Node vitest environment — see
// BattleScene.aoaWiring.test.ts header for why).

let source: string;

beforeAll(() => {
  source = readBattleSceneSource();
});

describe('AC-12: scene-active guard on delayedCall callbacks that touch scene state after checkBattleEnd may have fired', () => {
  it('the weakness-reveal delayedCall(900, ...) in executePlayerCommand bails out if the scene is inactive', () => {
    const body = extractMethod(source, 'executePlayerCommand');
    const callIdx = body.indexOf('showWeaknessRevealBanner(target.weakness!)');
    expect(callIdx, 'expected a showWeaknessRevealBanner(target.weakness!) call in executePlayerCommand').toBeGreaterThan(-1);

    const windowStart = Math.max(0, callIdx - 200);
    const precedingSegment = body.slice(windowStart, callIdx);
    expect(precedingSegment).toMatch(/delayedCall\(900/);
    expect(precedingSegment).toMatch(/if\s*\(!this\.scene\.isActive\(\)\)\s*return;/);
  });

  it('the AOA confirm delayedCall(1200, ...) in showAoaPrompt bails out if the scene is inactive', () => {
    const body = extractMethod(source, 'showAoaPrompt');
    const idx = body.indexOf('delayedCall(1200');
    expect(idx, 'expected a delayedCall(1200, ...) block in showAoaPrompt').toBeGreaterThan(-1);

    const segment = body.slice(idx, idx + 400);
    expect(segment).toMatch(/if\s*\(!this\.scene\.isActive\(\)\)\s*return;/);
    expect(segment).toMatch(/checkBattleEnd\(\)/);
  });
});
