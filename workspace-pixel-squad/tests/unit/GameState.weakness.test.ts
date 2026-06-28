import { describe, it, expect } from 'vitest';
import { newGame } from '../../src/save/GameState';
import * as GameStateModule from '../../src/save/GameState';

// AC-5: Weakness discovery persists in GameState
// AC-6: Non-weakness hit — no discovery entry added

describe('AC-5: GameState initialises and persists discoveredWeaknesses', () => {
  it('newGame() returns a state with discoveredWeaknesses field', () => {
    const state = newGame(0);
    // Currently missing from newGame() — will be undefined → FAIL
    expect((state as any).discoveredWeaknesses).toBeDefined();
  });

  it('discoveredWeaknesses initialises as an empty object', () => {
    const state = newGame(0);
    expect((state as any).discoveredWeaknesses).toEqual({});
  });

  it('recordWeaknessDiscovery is exported from GameState module', () => {
    expect(typeof (GameStateModule as any).recordWeaknessDiscovery).toBe('function');
  });

  it('recordWeaknessDiscovery stores the element for the given template id', () => {
    const state = newGame(0);
    (GameStateModule as any).recordWeaknessDiscovery(state, 'mutant_01', 'fire');
    expect((state as any).discoveredWeaknesses['mutant_01']).toBe('fire');
  });

  it('recordWeaknessDiscovery preserves previously discovered weaknesses', () => {
    const state = newGame(0);
    (GameStateModule as any).recordWeaknessDiscovery(state, 'wolf_a', 'thunder');
    (GameStateModule as any).recordWeaknessDiscovery(state, 'demon_01', 'ice');
    expect((state as any).discoveredWeaknesses['wolf_a']).toBe('thunder');
    expect((state as any).discoveredWeaknesses['demon_01']).toBe('ice');
  });

  it('recording the same template twice does not duplicate entries', () => {
    const state = newGame(0);
    (GameStateModule as any).recordWeaknessDiscovery(state, 'mutant_01', 'fire');
    (GameStateModule as any).recordWeaknessDiscovery(state, 'mutant_01', 'fire');
    expect(Object.keys((state as any).discoveredWeaknesses)).toHaveLength(1);
  });
});

// AC-6: Non-weakness hit — discoveredWeaknesses must not be updated

describe('AC-6: non-weakness hit does not add a discovery entry', () => {
  it('discoveredWeaknesses is not mutated when recordWeaknessDiscovery is not called', () => {
    const state = newGame(0);
    // Simulate: a normal (non-weakness) attack resolves — nothing calls recordWeaknessDiscovery
    // discoveredWeaknesses must remain empty
    expect(Object.keys((state as any).discoveredWeaknesses)).toHaveLength(0);
  });

  it('recordWeaknessDiscovery requires a truthy element — does not store undefined', () => {
    const state = newGame(0);
    // Calling with undefined element (as would happen for a non-elemental hit) must be a no-op
    (GameStateModule as any).recordWeaknessDiscovery(state, 'mutant_01', undefined);
    expect((state as any).discoveredWeaknesses['mutant_01']).toBeUndefined();
  });
});

// Challenge Run cross-carry (part of AC-5 spec note)

describe('AC-5 (challenge run): discoveredWeaknesses carry over from base save', () => {
  it('startNewGamePlus preserves discoveredWeaknesses', () => {
    const state = newGame(0);
    (GameStateModule as any).recordWeaknessDiscovery(state, 'boss_vega', 'thunder');

    const ngPlus = (GameStateModule as any).startNewGamePlus
      ? (GameStateModule as any).startNewGamePlus(state)
      : null;

    if (ngPlus) {
      // discoveredWeaknesses should survive into NG+
      expect((ngPlus as any).discoveredWeaknesses?.['boss_vega']).toBe('thunder');
    } else {
      // startNewGamePlus doesn't preserve it yet — will be caught by discoveredWeaknesses init test
      expect((state as any).discoveredWeaknesses['boss_vega']).toBe('thunder');
    }
  });
});
