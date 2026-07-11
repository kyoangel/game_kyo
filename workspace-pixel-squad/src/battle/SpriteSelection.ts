import type { Character } from '../types';
import type { MonsterType, MonsterAnimKey } from '../data/sprites';
import { partySpritKey, monsterFrameKey, MONSTER_ANIM_FPS, PARTY_MEMBER_IDS, PARTY_LPC_ANIMS, partyLpcSheetKey } from '../data/sprites';

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
  const type = char._monsterType as MonsterType;
  return (Object.keys(MONSTER_ANIM_FPS) as MonsterAnimKey[]).every(anim =>
    scene.textures.exists(monsterFrameKey(type, anim, 0)),
  );
}
