import type { Character, Element, GameState } from '../types';
import { recordWeaknessDiscovery } from '../save/GameState';

/** Builds the per-battle discovery set from a save's persisted discoveries. */
export function seedDiscoveredThisBattle(discoveredWeaknesses: Record<string, Element> | undefined): Set<string> {
  return new Set(Object.keys(discoveredWeaknesses ?? {}));
}

/**
 * Records a weakness discovery from a hit, if it's a new one.
 * Returns true when this call is the first discovery of target's templateId this battle.
 */
export function recordHitDiscovery(
  isWeaknessHit: boolean,
  target: Character,
  discoveredThisBattle: Set<string>,
  gameState: GameState | undefined,
): boolean {
  if (!isWeaknessHit || !target.weakness) return false;
  if (discoveredThisBattle.has(target.templateId)) return false;
  discoveredThisBattle.add(target.templateId);
  if (gameState) recordWeaknessDiscovery(gameState, target.templateId, target.weakness);
  return true;
}

/** Whether char's weakness icon should be shown given what's been discovered this battle. */
export function isWeaknessIconVisible(char: Character, discoveredThisBattle: Set<string>): boolean {
  return !!char.weakness && discoveredThisBattle.has(char.templateId);
}
