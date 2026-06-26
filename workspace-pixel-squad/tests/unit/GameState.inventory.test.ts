import { describe, it, expect } from 'vitest';
import { newGame } from '../../src/save/GameState';

describe('newGame inventory field', () => {
  it('initializes inventory as an empty array', () => {
    const state = newGame(0);
    expect(state.inventory).toEqual([]);
  });
});
