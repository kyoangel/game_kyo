import type { Character } from '../types';

export function shouldUseProtagonistSprite(char: Character, textureLoaded: boolean): boolean {
  return char.isProtagonist && char.isPlayer && textureLoaded;
}
