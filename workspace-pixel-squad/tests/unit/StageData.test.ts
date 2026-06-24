import { describe, it, expect } from 'vitest';
import { STAGES } from '../../src/data/stages';
import { CHAPTERS } from '../../src/data/chapters';

describe('STAGES data', () => {
  it('has exactly 28 entries (25 main + 3 side quests)', () => {
    expect(STAGES).toHaveLength(28);
  });

  it('every stage has required fields', () => {
    STAGES.forEach(s => {
      expect(s.id, `${s.id} missing id`).toBeTruthy();
      expect(s.chapterId, `${s.id} missing chapterId`).toBeTruthy();
      expect(s.name, `${s.id} missing name`).toBeTruthy();
      expect(typeof s.stageIndex).toBe('number');
      expect(typeof s.isBoss).toBe('boolean');
      expect(typeof s.isSideQuest).toBe('boolean');
      expect(s.enemies.length, `${s.id} has no enemies`).toBeGreaterThan(0);
      expect(s.expReward, `${s.id} missing expReward`).toBeGreaterThan(0);
      expect(s.currencyReward, `${s.id} missing currencyReward`).toBeGreaterThan(0);
    });
  });

  it('has 5 boss stages (one per chapter)', () => {
    const bosses = STAGES.filter(s => s.isBoss);
    expect(bosses).toHaveLength(5);
  });

  it('has 3 side quest stages', () => {
    const sideQuests = STAGES.filter(s => s.isSideQuest);
    expect(sideQuests).toHaveLength(3);
  });

  it('boss stages are at stageIndex 4', () => {
    STAGES.filter(s => s.isBoss).forEach(s => {
      expect(s.stageIndex).toBe(4);
    });
  });

  it('stage IDs are unique', () => {
    const ids = STAGES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('CHAPTERS data', () => {
  it('has exactly 5 chapters', () => {
    expect(CHAPTERS).toHaveLength(5);
  });

  it('each chapter has 5 stageIds', () => {
    CHAPTERS.forEach(ch => {
      expect(ch.stageIds, `${ch.id} wrong stageId count`).toHaveLength(5);
    });
  });

  it('chapter stageIds reference valid STAGE ids', () => {
    const stageIds = new Set(STAGES.map(s => s.id));
    CHAPTERS.forEach(ch => {
      ch.stageIds.forEach(id => {
        expect(stageIds.has(id), `${id} not found in STAGES`).toBe(true);
      });
    });
  });

  it('second through fifth chapters have unlockAfterChapterId', () => {
    CHAPTERS.slice(1).forEach(ch => {
      expect(ch.unlockAfterChapterId, `${ch.id} missing unlockAfterChapterId`).toBeTruthy();
    });
  });
});
