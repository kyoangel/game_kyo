import { describe, it, expect, beforeAll } from 'vitest';
import { readWorldMapSceneSource, extractMethod } from './support/extractWorldMapMethod';

// Spec: pixel-squad-hidden-stage
//
// WorldMapScene extends Phaser.Scene and cannot be instantiated in this
// project's Node vitest environment (see BattleScene.mercenaryRating.test.ts
// for the established precedent), so these tests read the real
// WorldMapScene.ts source and assert the exact call sites the spec
// prescribes for isStageAvailable() and createStageList().

let source: string;

beforeAll(() => {
  source = readWorldMapSceneSource();
});

describe('isHiddenStageUnlocked helper', () => {
  it('is declared next to isStageCompleted, returning false when unlockRequiresPerfectClear is unset', () => {
    expect(source).toMatch(
      /private\s+isHiddenStageUnlocked\(stage: Stage\): boolean\s*\{\s*\n\s*if \(!stage\.unlockRequiresPerfectClear\) return false;/
    );
  });

  it('checks gameState.perfectClearStageIds for the prerequisite id, defaulting a missing array to []', () => {
    expect(source).toMatch(
      /return \(this\.gameState\.perfectClearStageIds \?\? \[\]\)\.includes\(stage\.unlockRequiresPerfectClear\);/
    );
  });
});

describe('AC-4/AC-5: isStageAvailable delegates hidden stages to isHiddenStageUnlocked', () => {
  it('has an early "if (stage.isHidden) return this.isHiddenStageUnlocked(stage);" branch as the first statement', () => {
    const body = extractMethod(source, 'isStageAvailable');
    expect(body).not.toBe('');
    const trimmed = body.replace(/^[^{]*\{/, '').trim();
    expect(trimmed).toMatch(/^if \(stage\.isHidden\) return this\.isHiddenStageUnlocked\(stage\);/);
  });
});

describe('AC-4: createStageList renders hidden stages via a dedicated filter pass', () => {
  it('contains a STAGES.filter((s) => s.isHidden) pass', () => {
    const body = extractMethod(source, 'createStageList');
    expect(body).not.toBe('');
    expect(body).toMatch(/STAGES\.filter\(\(s\) => s\.isHidden\)\.forEach\(\(stage\) => \{/);
  });

  it('early-returns before pushing a row when the hidden stage is not yet unlocked', () => {
    const body = extractMethod(source, 'createStageList');
    const filterIdx = body.indexOf('STAGES.filter((s) => s.isHidden)');
    expect(filterIdx).toBeGreaterThan(-1);
    const afterFilter = body.slice(filterIdx);
    expect(afterFilter).toMatch(/if \(!this\.isHiddenStageUnlocked\(stage\)\) return;/);
  });
});

describe('AC-5: hidden-stage rows are pushed into the same this.stageRows array as normal rows', () => {
  it('the hidden-stage pass calls this.stageRows.push(...) with background/text/stage', () => {
    const body = extractMethod(source, 'createStageList');
    const filterIdx = body.indexOf('STAGES.filter((s) => s.isHidden)');
    expect(filterIdx).toBeGreaterThan(-1);
    const afterFilter = body.slice(filterIdx);
    expect(afterFilter).toMatch(/this\.stageRows\.push\(\{\s*background,\s*text,\s*stage\s*\}\);/);
  });
});

describe('AC-5/AC-6: hidden-stage row styling uses the 🌟 prefix family', () => {
  it('uses "🌟▶ " for an unlocked-but-unplayed hidden stage', () => {
    const body = extractMethod(source, 'createStageList');
    const filterIdx = body.indexOf('STAGES.filter((s) => s.isHidden)');
    const afterFilter = body.slice(filterIdx);
    expect(afterFilter).toMatch(/'🌟▶ '/);
  });

  it('uses "🌟✅ " for a completed hidden stage', () => {
    const body = extractMethod(source, 'createStageList');
    const filterIdx = body.indexOf('STAGES.filter((s) => s.isHidden)');
    const afterFilter = body.slice(filterIdx);
    expect(afterFilter).toMatch(/'🌟✅ '/);
  });
});
