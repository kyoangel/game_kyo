import { describe, it, expect } from 'vitest';
import { resetAoaRoundState, shouldTriggerAoa } from '../../src/battle/AllOutAttack';
import type { Character } from '../../src/types';

function makeEnemy(overrides: Record<string, unknown> = {}): Character {
  return Object.assign(
    {
      id: 'e1', templateId: 'e1', name: 'Enemy', isProtagonist: false, isPlayer: false,
      level: 1, exp: 0, expToNext: 50,
      stats: { hp: 80, maxHp: 80, atk: 10, def: 5, spd: 5 },
      skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
      activeBuffs: [], skillCooldowns: {}, knockedDown: false,
    },
    overrides,
  ) as Character;
}

// --- resetAoaRoundState ---

describe('resetAoaRoundState — round reset (AC: usedThisRound resets each command phase)', () => {
  it('sets usedThisRound to false when it was true (after decline)', () => {
    const aoaState = { usedThisRound: true };
    resetAoaRoundState(aoaState);
    expect(aoaState.usedThisRound).toBe(false);
  });

  it('is idempotent — leaves usedThisRound false when it was already false', () => {
    const aoaState = { usedThisRound: false };
    resetAoaRoundState(aoaState);
    expect(aoaState.usedThisRound).toBe(false);
  });

  it('mutates the passed object in place', () => {
    const aoaState = { usedThisRound: true };
    const ref = aoaState;
    resetAoaRoundState(aoaState);
    expect(ref.usedThisRound).toBe(false);
  });
});

describe('Round reset — full lifecycle (AC: decline in round N, available again in round N+1)', () => {
  it('AOA becomes available again after round reset following a decline', () => {
    const allKnockedDown = [makeEnemy({ id: 'e1', knockedDown: true })];
    const aoaState = { usedThisRound: false };

    // Player declines AOA
    aoaState.usedThisRound = true;
    expect(shouldTriggerAoa(allKnockedDown, aoaState)).toBe(false);

    // New command phase starts — reset is called
    resetAoaRoundState(aoaState);

    // AOA is available again (knockedDown flags are reset separately by resetRoundFlags)
    expect(aoaState.usedThisRound).toBe(false);
    expect(shouldTriggerAoa(allKnockedDown, aoaState)).toBe(true);
  });

  it('multiple rounds — decline blocks this round only, not subsequent rounds', () => {
    const aoaState = { usedThisRound: false };

    // Round 1: player declines
    aoaState.usedThisRound = true;
    expect(aoaState.usedThisRound).toBe(true);

    // Round 2: reset fires
    resetAoaRoundState(aoaState);
    expect(aoaState.usedThisRound).toBe(false);

    // Round 3: reset fires again (idempotent)
    resetAoaRoundState(aoaState);
    expect(aoaState.usedThisRound).toBe(false);
  });
});
