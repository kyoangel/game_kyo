import type Phaser from 'phaser';
import type { Skin } from './economy.ts';
import { drawPlane } from './skyArt.ts';

export const SKIN_TEX = 64;

/** Texture key for a skin; the 64x64 texture (56 px shape) is generated once per key. */
export function skinTextureKey(scene: Phaser.Scene, skin: Skin): string {
  const key = `dd-skin-${skin.id}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  const fill = skin.color === 'cycle' ? 0xffffff : skin.color;
  // Every skin is the little plane in its colour, marked with its shape emblem; no halo/ring (only the real shield
  // ring may circle the player).
  drawPlane(g, fill, skin.shape);
  g.generateTexture(key, SKIN_TEX, SKIN_TEX);
  g.destroy();
  return key;
}
