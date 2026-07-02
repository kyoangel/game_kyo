import type { GameState, Stage } from '../types';

export const DOOMSDAY_INITIAL_DAYS = 32;
export const MAIN_STORY_DAY_COST = 1;
export const SIDE_QUEST_DAY_COST = 3;
export const HIDDEN_STAGE_DAY_COST = 4;

/** Days deducted from the clock when `stage` is cleared. */
export function getStageDoomsdayCost(stage: Stage): number {
  if (stage.isHidden) return HIDDEN_STAGE_DAY_COST;
  if (stage.isSideQuest) return SIDE_QUEST_DAY_COST;
  return MAIN_STORY_DAY_COST;
}

/** Current days remaining, defaulting a missing/legacy value to DOOMSDAY_INITIAL_DAYS. */
export function getDoomsdayDaysRemaining(gameState: GameState): number {
  return gameState.doomsdayDaysRemaining ?? DOOMSDAY_INITIAL_DAYS;
}

/** Days remaining after clearing `stage`, floored at 0. Pure — does not mutate `gameState`. */
export function tickDoomsdayClock(gameState: GameState, stage: Stage): number {
  return Math.max(0, getDoomsdayDaysRemaining(gameState) - getStageDoomsdayCost(stage));
}

/** True once the clock has hit 0 and the player has not already beaten the game. */
export function isDoomsdayExpired(gameState: GameState): boolean {
  return getDoomsdayDaysRemaining(gameState) <= 0 && !gameState.hasClearedGame;
}
