import type { Character, Skill } from '../types';

/** Returns true if the skill is currently available (not on cooldown). */
export function isSkillReady(char: Character, skill: Skill): boolean {
  return ((char.skillCooldowns ?? {})[skill.id] ?? 0) === 0;
}

/** Call immediately after a character uses a skill. */
export function triggerCooldown(char: Character, skill: Skill): void {
  if (skill.cooldown) {
    char.skillCooldowns[skill.id] = skill.cooldown;
  }
}

/** Call at the start of each command phase, for every character in the battle. */
export function tickCooldowns(characters: Character[]): void {
  for (const char of characters) {
    if (!char.alive) continue;
    for (const id of Object.keys(char.skillCooldowns)) {
      if (char.skillCooldowns[id] > 0) {
        char.skillCooldowns[id]--;
      }
    }
  }
}
