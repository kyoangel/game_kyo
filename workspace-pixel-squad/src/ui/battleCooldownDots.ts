import type { Character } from '../types';

export interface CooldownDotState {
  skillId: string;
  ready: boolean;
  remainingTurns: number;
}

export function getCooldownDotStates(char: Character): CooldownDotState[] {
  return char.skills.map(skill => {
    const remaining = char.skillCooldowns[skill.id] ?? 0;
    return {
      skillId: skill.id,
      ready: remaining <= 0,
      remainingTurns: remaining > 0 ? remaining : 0,
    };
  });
}
