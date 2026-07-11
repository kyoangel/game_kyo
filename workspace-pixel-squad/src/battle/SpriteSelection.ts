import type { Character } from '../types';
import type { MonsterType } from '../data/sprites';
import { partySpritKey, monsterIdleKey, PARTY_MEMBER_IDS, PARTY_LPC_ANIMS, partyLpcSheetKey } from '../data/sprites';

export function shouldUseProtagonistSprite(char: Character, textureLoaded: boolean): boolean {
  return char.isProtagonist && char.isPlayer && textureLoaded;
}

export function shouldUsePartyRealSprite(char: Character, scene: { textures: { exists: (k: string) => boolean } }): boolean {
  if (!char.isPlayer || char.isProtagonist) return false;
  const id = char.templateId as string;
  if (!(PARTY_MEMBER_IDS as readonly string[]).includes(id)) return false;
  return PARTY_LPC_ANIMS.every(anim => scene.textures.exists(partyLpcSheetKey(id, anim)));
}

export function shouldUsePartySprite(char: Character, scene: { textures: { exists: (k: string) => boolean } }): boolean {
  if (!char.isPlayer || char.isProtagonist) return false;
  const id = char.templateId as string;
  return (PARTY_MEMBER_IDS as readonly string[]).includes(id) && scene.textures.exists(partySpritKey(id));
}

export function shouldUseMonsterSprite(char: Character, scene: { textures: { exists: (k: string) => boolean } }): boolean {
  if (char.isPlayer || !char._monsterType) return false;
  return scene.textures.exists(monsterIdleKey(char._monsterType as MonsterType));
}
