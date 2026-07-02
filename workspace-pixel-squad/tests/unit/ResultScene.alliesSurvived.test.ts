import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Spec: pixel-squad-hidden-stage
//
// ResultScene extends Phaser.Scene and cannot be instantiated in this
// project's Node vitest environment (see BattleScene.mercenaryRating.test.ts
// / WorldMapScene.starHistory.test.ts for the established precedent), so
// these tests read the real ResultScene.ts source and assert the exact
// call sites the spec prescribes for create().
//
// AC-7: alliesSurvived must be false (not throw) when battleStats is absent.

const RESULT_SCENE_PATH = resolve(__dirname, '../../src/scenes/ResultScene.ts');

let source: string;

beforeAll(() => {
  source = readFileSync(RESULT_SCENE_PATH, 'utf-8');
});

describe('alliesSurvived computation', () => {
  it('declares alliesSurvived as victory && !!battleStats && battleStats.playerKOCount === 0', () => {
    expect(source).toMatch(
      /const alliesSurvived = victory && !!battleStats && battleStats\.playerKOCount === 0;/
    );
  });

  it('computes alliesSurvived immediately after the starRating computation, before it is used', () => {
    const starRatingIdx = source.indexOf('const starRating =');
    const alliesSurvivedIdx = source.indexOf('const alliesSurvived =');
    expect(starRatingIdx).toBeGreaterThan(-1);
    expect(alliesSurvivedIdx).toBeGreaterThan(-1);
    expect(alliesSurvivedIdx).toBeGreaterThan(starRatingIdx);
  });
});

describe('AC-2/AC-3: processVictory call site forwards alliesSurvived as its 7th argument', () => {
  it('passes alliesSurvived after starRating in the processVictory(...) call', () => {
    expect(source).toMatch(
      /processVictory\(gameState, stage, expGained, recruitedEnemy, undefined, starRating, alliesSurvived\)/
    );
  });
});
