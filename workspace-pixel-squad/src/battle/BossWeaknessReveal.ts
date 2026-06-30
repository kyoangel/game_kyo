import type { Character, GameState } from '../types';
import type { BossPhase } from './BossAI';
import { recordWeaknessDiscovery } from '../save/GameState';

/**
 * Reveals a boss's weaknessOverride on first entering a phase that carries one.
 * Mutates the live boss Character permanently and, when a GameState is
 * available, records the discovery immediately so it persists to the save.
 */
export function revealBossWeakness(boss: Character, phase: BossPhase, gameState?: GameState): void {
  if (!phase.weaknessOverride) return;
  boss.weakness = phase.weaknessOverride;
  if (gameState) recordWeaknessDiscovery(gameState, boss.templateId, phase.weaknessOverride);
}
