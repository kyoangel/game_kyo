import { describe, it, expect } from 'vitest';
import {
  applyDeathStatus,
  isHardModeWipeout,
  removePermanentLosses,
  isRunPermanentlyOver,
} from '../../src/battle/HardMode';
import type { Character, GameState } from '../../src/types';
import { newGame } from '../../src/save/GameState';

// Spec: specs/pixel-squad-permanent-death-mode.md
// battle/HardMode.ts does not exist yet — every import above fails to
// resolve, which is the expected "not implemented" failure mode for this
// suite. Covers all four Acceptance Criteria at the pure-function level,
// plus the Rules describing Mode Dependency and the Character data-model
// change (deathStatus).
//
// Assumed contract (not implemented yet, defined here so the tests are
// meaningful once battle/HardMode.ts is written):
//   - applyDeathStatus(character, isHardMode): Character
//       HP > 0            -> deathStatus 'alive'
//       HP <= 0, hard mode -> deathStatus 'permanentLoss', alive=false
//       HP <= 0, standard  -> deathStatus 'knockedDown' (recoverable), alive=false
//   - isHardModeWipeout(party): boolean — true only when every member of a
//     non-empty party has deathStatus 'permanentLoss'.
//   - removePermanentLosses(gameState, battleParty): GameState — pure;
//     strips any battleParty member with deathStatus 'permanentLoss' out of
//     gameState.pool, gameState.squad, and gameState.currentRosterIds.
//   - isRunPermanentlyOver(gameState): boolean — true once
//     gameState.currentRosterIds is empty (definitive failure state).

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1', templateId: 'rex', name: 'Rex', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 5, spd: 10 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [], activeStatusEffects: [], skillCooldowns: {}, equipment: {},
    ...overrides,
  } as Character;
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(0), ...overrides };
}

describe('AC-1: HP reaching 0 in Hard Mode sets deathStatus to permanentLoss', () => {
  it('applyDeathStatus marks a 0-HP character permanentLoss when isHardMode is true', () => {
    const dead = makeChar({ stats: { hp: 0, maxHp: 100, atk: 20, def: 5, spd: 10 } });
    const result = applyDeathStatus(dead, true);
    expect((result as any).deathStatus).toBe('permanentLoss');
    expect(result.alive).toBe(false);
  });

  it('applyDeathStatus marks a negative-HP character permanentLoss when isHardMode is true', () => {
    const dead = makeChar({ stats: { hp: -5, maxHp: 100, atk: 20, def: 5, spd: 10 } });
    const result = applyDeathStatus(dead, true);
    expect((result as any).deathStatus).toBe('permanentLoss');
  });
});

describe('Rule 1/Mode Dependency: standard-mode deaths never produce permanentLoss', () => {
  it('applyDeathStatus marks a 0-HP character knockedDown (not permanentLoss) when isHardMode is false', () => {
    const dead = makeChar({ stats: { hp: 0, maxHp: 100, atk: 20, def: 5, spd: 10 } });
    const result = applyDeathStatus(dead, false);
    expect((result as any).deathStatus).toBe('knockedDown');
    expect((result as any).deathStatus).not.toBe('permanentLoss');
  });
});

describe('Rule 5/Data Model: a character above 0 HP is flagged alive regardless of mode', () => {
  it('applyDeathStatus returns deathStatus "alive" for a living character in Hard Mode', () => {
    const alive = makeChar({ stats: { hp: 42, maxHp: 100, atk: 20, def: 5, spd: 10 } });
    const result = applyDeathStatus(alive, true);
    expect((result as any).deathStatus).toBe('alive');
  });

  it('applyDeathStatus returns deathStatus "alive" for a living character in standard mode', () => {
    const alive = makeChar({ stats: { hp: 42, maxHp: 100, atk: 20, def: 5, spd: 10 } });
    const result = applyDeathStatus(alive, false);
    expect((result as any).deathStatus).toBe('alive');
  });

  it('is pure — does not mutate the input character', () => {
    const dead = makeChar({ stats: { hp: 0, maxHp: 100, atk: 20, def: 5, spd: 10 } });
    applyDeathStatus(dead, true);
    expect((dead as any).deathStatus).toBeUndefined();
  });
});

describe('AC-2: a permanent loss with the rest of the party surviving does not end the run', () => {
  it('isHardModeWipeout is false when only one of three characters is permanentLoss', () => {
    const party = [
      makeChar({ id: 'a', deathStatus: 'permanentLoss' } as any),
      makeChar({ id: 'b' }),
      makeChar({ id: 'c' }),
    ];
    expect(isHardModeWipeout(party)).toBe(false);
  });

  it('removePermanentLosses removes only the permanently-lost member, keeping survivors in squad/pool', () => {
    const survivor = makeChar({ id: 'b' });
    const lost = makeChar({ id: 'a', deathStatus: 'permanentLoss' } as any);
    const state = makeGameState({
      pool: [lost, survivor],
      squad: [lost, survivor],
      currentRosterIds: ['a', 'b'],
    } as any);

    const result = removePermanentLosses(state, [lost, survivor]);

    expect(result.pool.map(c => c.id)).toEqual(['b']);
    expect(result.squad.map(c => c.id)).toEqual(['b']);
    expect((result as any).currentRosterIds).toEqual(['b']);
  });
});

describe('AC-3: a full party wipeout in Hard Mode is a definitive failure state', () => {
  it('isHardModeWipeout is true when every character in the party is permanentLoss', () => {
    const party = [
      makeChar({ id: 'a', deathStatus: 'permanentLoss' } as any),
      makeChar({ id: 'b', deathStatus: 'permanentLoss' } as any),
    ];
    expect(isHardModeWipeout(party)).toBe(true);
  });

  it('isHardModeWipeout is false for an empty party (no false-positive game over)', () => {
    expect(isHardModeWipeout([])).toBe(false);
  });

  it('isRunPermanentlyOver is true once currentRosterIds has been emptied by a full wipe', () => {
    const state = makeGameState({ currentRosterIds: [] } as any);
    expect(isRunPermanentlyOver(state)).toBe(true);
  });

  it('isRunPermanentlyOver is false while at least one roster member remains', () => {
    const state = makeGameState({ currentRosterIds: ['a'] } as any);
    expect(isRunPermanentlyOver(state)).toBe(false);
  });

  it('removePermanentLosses can drive currentRosterIds to empty, producing a permanently-over run', () => {
    const a = makeChar({ id: 'a', deathStatus: 'permanentLoss' } as any);
    const b = makeChar({ id: 'b', deathStatus: 'permanentLoss' } as any);
    const state = makeGameState({
      pool: [a, b],
      squad: [a, b],
      currentRosterIds: ['a', 'b'],
    } as any);

    const result = removePermanentLosses(state, [a, b]);

    expect((result as any).currentRosterIds).toEqual([]);
    expect(isRunPermanentlyOver(result)).toBe(true);
  });
});

describe('AC-4: roster persistence — GameState reflects a reduced roster after permanent losses', () => {
  it('a gameState with one prior permanent loss carries a currentRosterIds shorter than pool would otherwise imply', () => {
    const survivor = makeChar({ id: 'b' });
    const state = makeGameState({
      pool: [survivor],
      squad: [survivor],
      currentRosterIds: ['b'],
    } as any);

    expect((state as any).currentRosterIds).toHaveLength(1);
    expect((state as any).currentRosterIds).not.toContain('a');
  });

  it('removePermanentLosses is a no-op (returns an equivalent state) when nobody was permanently lost', () => {
    const survivor = makeChar({ id: 'b' });
    const state = makeGameState({
      pool: [survivor],
      squad: [survivor],
      currentRosterIds: ['b'],
    } as any);

    const result = removePermanentLosses(state, [survivor]);

    expect(result.pool.map(c => c.id)).toEqual(['b']);
    expect((result as any).currentRosterIds).toEqual(['b']);
  });
});
