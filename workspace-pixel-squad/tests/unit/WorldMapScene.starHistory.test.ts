import { describe, it, expect, beforeAll } from 'vitest';
import { readWorldMapSceneSource, extractMethod } from './support/extractWorldMapMethod';

// Spec: pixel-squad-mercenary-rating-history
//
// WorldMapScene extends Phaser.Scene and cannot be instantiated in this
// project's Node vitest environment (see BattleScene.mercenaryRating.test.ts
// for the established precedent), so these tests read the real
// WorldMapScene.ts source and assert the exact call sites the spec
// prescribes for createStageList().

let source: string;

beforeAll(() => {
  source = readWorldMapSceneSource();
});

describe('AC-6/AC-7: createStageList reads bestRating from GameState.bestStarRatings', () => {
  it('declares bestRating as this.gameState.bestStarRatings?.[stage.id] ?? 0, right after isCompleted', () => {
    const body = extractMethod(source, 'createStageList');
    expect(body).not.toBe('');
    expect(body).toMatch(
      /const isCompleted = this\.isStageCompleted\(stage\.id\);\s*\n\s*const bestRating = this\.gameState\.bestStarRatings\?\.\[stage\.id\] \?\? 0;/
    );
  });
});

describe('AC-6/AC-8: star suffix is only concatenated into the row text when the stage is completed', () => {
  it('builds starSuffix from a ternary whose false (not-completed) branch is an empty string literal', () => {
    const body = extractMethod(source, 'createStageList');
    expect(body).toMatch(
      /const starSuffix = isCompleted\s*\n?\s*\?[^:]+:\s*'';/
    );
  });

  it('builds the suffix using \'★\'.repeat(bestRating) and \'☆\'.repeat(...) for the remainder', () => {
    const body = extractMethod(source, 'createStageList');
    expect(body).toMatch(/'★'\.repeat\(bestRating\)/);
    expect(body).toMatch(/'☆'\.repeat\(/);
  });

  it('appends starSuffix onto the same row label string (no new Text object, no layout change)', () => {
    const body = extractMethod(source, 'createStageList');
    expect(body).toMatch(/`\$\{prefix\}\$\{stage\.name\}\$\{starSuffix\}`/);
  });
});
