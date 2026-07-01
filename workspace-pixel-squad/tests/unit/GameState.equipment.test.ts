import { describe, it, expect } from 'vitest';
import { newGame } from '../../src/save/GameState';

describe('newGame equipment fields', () => {
  it('initializes equipmentInventory as an empty array', () => {
    const state = newGame(0);
    expect(state.equipmentInventory).toEqual([]);
  });

  it('starting protagonist has equipment {}', () => {
    const state = newGame(0);
    expect(state.pool[0].equipment).toEqual({});
    expect(state.squad[0].equipment).toEqual({});
  });
});
