import type { Character, Element } from '../types';

export type BossAIType = 'normal' | 'aggressive' | 'defensive' | 'berserk' | 'desperation';

export interface BossPhase {
  hpThreshold: number;
  aiType: BossAIType;
  message?: string;
  /** Set on first entering this phase: grants the boss this elemental weakness for the rest of the battle. */
  weaknessOverride?: Element;
}

export interface BossConfig {
  templateId: string;
  phases: BossPhase[];
}

export interface BossAction {
  type: 'attack' | 'defend' | 'double_attack';
  target?: Character;
  ignoreDefense?: boolean;
}

export function getBossPhase(config: BossConfig, hpRatio: number): BossPhase {
  // Phases are in descending order of hpThreshold
  // Find the first phase where hpRatio is at or below the threshold
  for (let i = config.phases.length - 1; i >= 0; i--) {
    if (hpRatio <= config.phases[i].hpThreshold) {
      return config.phases[i];
    }
  }
  return config.phases[config.phases.length - 1];
}

function randomAlivePlayer(players: Character[]): Character | undefined {
  const alive = players.filter(p => p.alive && p.isPlayer);
  if (alive.length === 0) return undefined;
  return alive[Math.floor(Math.random() * alive.length)];
}

function lowestHpPlayer(players: Character[]): Character | undefined {
  const alive = players.filter(p => p.alive && p.isPlayer);
  if (alive.length === 0) return undefined;
  return alive.reduce((low, c) => (c.stats.hp < low.stats.hp ? c : low));
}

export function executeBossAction(
  _boss: Character,
  playerParty: Character[],
  phase: BossPhase,
): BossAction {
  switch (phase.aiType) {
    case 'normal':
      return { type: 'attack', target: randomAlivePlayer(playerParty) };
    case 'aggressive':
      return { type: 'attack', target: lowestHpPlayer(playerParty) };
    case 'defensive':
      return Math.random() < 0.5
        ? { type: 'defend' }
        : { type: 'attack', target: randomAlivePlayer(playerParty) };
    case 'berserk':
      return { type: 'attack', target: randomAlivePlayer(playerParty), ignoreDefense: true };
    case 'desperation':
      return { type: 'double_attack', target: randomAlivePlayer(playerParty) };
  }
}
