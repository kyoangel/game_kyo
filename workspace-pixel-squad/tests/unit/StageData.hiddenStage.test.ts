import { describe, it, expect } from 'vitest';
import { STAGES } from '../../src/data/stages';
import { CHAPTERS } from '../../src/data/chapters';

// Spec: pixel-squad-hidden-stage
// AC-4/AC-5 depend on 'HS-1' existing with isHidden + unlockRequiresPerfectClear
// pointed at a real prerequisite stage, and on 'HS-1' being deliberately
// absent from CHAPTERS so WorldMapScene's per-chapter render loop never
// discovers it directly (see Background section re: the pre-existing
// SQ-*/'sq' chapterId bug this spec explicitly says not to repeat).

describe('HS-1 hidden stage data', () => {
  it('exists in STAGES', () => {
    const stage = STAGES.find((s) => s.id === 'HS-1');
    expect(stage).toBeDefined();
  });

  it('is flagged isHidden === true', () => {
    const stage = STAGES.find((s) => s.id === 'HS-1');
    expect(stage?.isHidden).toBe(true);
  });

  it('names "2-5" as its unlockRequiresPerfectClear prerequisite', () => {
    const stage = STAGES.find((s) => s.id === 'HS-1');
    expect(stage?.unlockRequiresPerfectClear).toBe('2-5');
  });
});

describe('prerequisite stage "2-5" is a real, existing stage', () => {
  it('exists in STAGES', () => {
    const prereq = STAGES.find((s) => s.id === '2-5');
    expect(prereq).toBeDefined();
  });
});

describe('rule 1: HS-1 is not reachable via the normal per-chapter render loop', () => {
  it('does not appear in any Chapter.stageIds in CHAPTERS', () => {
    const allStageIds = CHAPTERS.flatMap((c) => c.stageIds);
    expect(allStageIds).not.toContain('HS-1');
  });
});
