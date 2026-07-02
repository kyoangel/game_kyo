import type { GameState, Element } from '../types';
import { createCharacter } from '../battle/CharacterFactory';
import { PLAYER_TEMPLATES } from '../data/characters';
import { DOOMSDAY_INITIAL_DAYS } from '../battle/DoomsdayClock';

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
    ngPlusCycle: 0,
    hasClearedGame: false,
    discoveredWeaknesses: {},
    equipmentInventory: [],
    bestStarRatings: {},
    perfectClearStageIds: [],
    doomsdayDaysRemaining: DOOMSDAY_INITIAL_DAYS,
    currentRosterIds: [char.id],
    unlockedChallengePhraseIds: [],
  };
}

export function startNewGamePlus(gameState: GameState): GameState {
  return {
    ...gameState,
    stageProgress: { completedStageIds: [], inChapterRun: undefined },
    ngPlusCycle: gameState.ngPlusCycle + 1,
    doomsdayDaysRemaining: DOOMSDAY_INITIAL_DAYS,
    savedAt: Date.now(),
  };
}

/** Records a weakness discovery for the given enemy template id. No-op if element is falsy. */
export function recordWeaknessDiscovery(state: GameState, templateId: string, element: Element | undefined): void {
  if (!element) return;
  if (!state.discoveredWeaknesses) state.discoveredWeaknesses = {};
  state.discoveredWeaknesses[templateId] = element;
}
