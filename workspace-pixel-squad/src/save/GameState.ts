import type { GameState } from '../types';
import { createCharacter } from '../battle/CharacterFactory';
import { PLAYER_TEMPLATES } from '../data/characters';

export function newGame(slot: 0 | 1 | 2): GameState {
  const protagonist = PLAYER_TEMPLATES.find(t => t.isProtagonist)!;
  const char = createCharacter(protagonist, 1);
  return {
    slotId: slot,
    pool: [char],
    squad: [char],
    expPool: 0,
    currency: 0,
    stageProgress: { completedStageIds: [] },
    savedAt: Date.now(),
    inventory: [],
  };
}
