import { describe, it, expect } from 'vitest';
import { CHALLENGE_PHRASES } from '../../src/data/challengePhrases';
import { STAGES } from '../../src/data/stages';

// Spec: pixel-squad-post-clear-challenge-phrase-unlock
//
// "Phrase Structure" rule: each phrase must contain a unique identifier, a
// specific constraint, and a corresponding high-value reward structure.
// "Reward Scaling" rule: the reward must scale proportionally with the
// difficulty imposed by the constraint.
//
// CHALLENGE_PHRASES does not exist yet — this whole file fails to even
// collect until src/data/challengePhrases.ts is implemented.

describe('CHALLENGE_PHRASES catalog', () => {
  it('contains at least 3 phrases', () => {
    expect(CHALLENGE_PHRASES.length).toBeGreaterThanOrEqual(3);
  });

  it('has unique ids', () => {
    const ids = CHALLENGE_PHRASES.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every phrase has a non-empty id, name, and description', () => {
    CHALLENGE_PHRASES.forEach(p => {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    });
  });

  it('every phrase declares a constraint of type turnLimit or physicalOnly', () => {
    CHALLENGE_PHRASES.forEach(p => {
      expect(['turnLimit', 'physicalOnly']).toContain(p.constraint.type);
    });
  });

  it('every turnLimit constraint carries a positive turnLimit value', () => {
    CHALLENGE_PHRASES
      .filter(p => p.constraint.type === 'turnLimit')
      .forEach(p => {
        expect(p.constraint.turnLimit).toBeGreaterThan(0);
      });
  });

  it('every phrase declares a positive currencyBonus reward', () => {
    CHALLENGE_PHRASES.forEach(p => {
      expect(p.reward.currencyBonus).toBeGreaterThan(0);
    });
  });

  it('every phrase.unlockStageId references a real Stage in STAGES', () => {
    const stageIds = new Set(STAGES.map(s => s.id));
    CHALLENGE_PHRASES.forEach(p => {
      expect(stageIds.has(p.unlockStageId), `${p.id} references unknown stage ${p.unlockStageId}`).toBe(true);
    });
  });
});

describe('Reward Scaling rule: challenge reward must exceed the normal clear reward it replaces', () => {
  it('every phrase.reward.currencyBonus is greater than its unlock stage.currencyReward', () => {
    CHALLENGE_PHRASES.forEach(p => {
      const stage = STAGES.find(s => s.id === p.unlockStageId)!;
      expect(
        p.reward.currencyBonus,
        `${p.id} reward (${p.reward.currencyBonus}) should exceed stage ${stage.id} clear reward (${stage.currencyReward})`,
      ).toBeGreaterThan(stage.currencyReward);
    });
  });

  it('among turnLimit phrases, a stricter (lower) turn limit never yields a smaller reward than a laxer one', () => {
    const turnLimitPhrases = CHALLENGE_PHRASES.filter(p => p.constraint.type === 'turnLimit');
    expect(turnLimitPhrases.length).toBeGreaterThanOrEqual(2);

    for (const stricter of turnLimitPhrases) {
      for (const laxer of turnLimitPhrases) {
        if (stricter.constraint.turnLimit! < laxer.constraint.turnLimit!) {
          expect(
            stricter.reward.currencyBonus,
            `${stricter.id} (limit ${stricter.constraint.turnLimit}) should reward >= ${laxer.id} (limit ${laxer.constraint.turnLimit})`,
          ).toBeGreaterThanOrEqual(laxer.reward.currencyBonus);
        }
      }
    }
  });
});
