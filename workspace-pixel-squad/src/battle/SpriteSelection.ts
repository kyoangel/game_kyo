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
  // No isPlayer guard: a recruited generic (non-named) enemy is converted to
  // a player character via enemyToPlayerCharacter(), which preserves
  // _monsterType — it should keep using its real monster sprite in the
  // party row instead of falling through to the flat-color rectangle
  // fallback. Regular party members never have _monsterType set, so this
  // can't accidentally match them.
  if (!char._monsterType) return false;
  const type = char._monsterType as MonsterType;
  return (Object.keys(MONSTER_ANIM_FPS) as MonsterAnimKey[]).every(anim =>
    scene.textures.exists(monsterFrameKey(type, anim, 0)),
  );
}
