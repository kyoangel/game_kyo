import type { Character, GameState } from '../types';

/**
 * Pure function: derives a character's deathStatus from its current HP and
 * whether the run is in Hard Mode. Hard Mode deaths are permanent; standard
 * mode deaths are recoverable (knockedDown).
 */
export function applyDeathStatus(character: Character, isHardMode: boolean): Character {
  if (character.stats.hp > 0) {
    return { ...character, deathStatus: 'alive' };
  }
  return {
    ...character,
    alive: false,
    deathStatus: isHardMode ? 'permanentLoss' : 'knockedDown',
  };
}

/** True only when a non-empty party has every member flagged permanentLoss. */
export function isHardModeWipeout(party: Character[]): boolean {
  if (party.length === 0) return false;
  return party.every(c => c.deathStatus === 'permanentLoss');
}

/**
 * Strips any battleParty member with deathStatus 'permanentLoss' out of
 * gameState.pool, gameState.squad, and gameState.currentRosterIds. Pure —
 * returns a new GameState.
 */
export function removePermanentLosses(gameState: GameState, battleParty: Character[]): GameState {
  const lostIds = new Set(
    battleParty.filter(c => c.deathStatus === 'permanentLoss').map(c => c.id),
  );
  if (lostIds.size === 0) return { ...gameState };

  return {
    ...gameState,
    pool: gameState.pool.filter(c => !lostIds.has(c.id)),
    squad: gameState.squad.filter(c => !lostIds.has(c.id)),
    currentRosterIds: (gameState.currentRosterIds ?? []).filter(id => !lostIds.has(id)),
  };
}

/** True once the run's roster has been fully wiped out (definitive failure state). */
export function isRunPermanentlyOver(gameState: GameState): boolean {
  return (gameState.currentRosterIds ?? []).length === 0;
}
