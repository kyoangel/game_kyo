import Phaser from 'phaser';
import type { Skin } from './economy.ts';

export const SKIN_TEX = 64;

function poly(cx: number, cy: number, n: number, r: number, inner = 1, rot = -Math.PI / 2): Phaser.Types.Math.Vector2Like[] {
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  const count = inner === 1 ? n : n * 2;
  for (let i = 0; i < count; i++) {
    const rr = inner !== 1 && i % 2 === 1 ? r * inner : r;
    const a = rot + (i / count) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return pts;
}

/** Texture key for a skin; the 64x64 texture (56 px shape) is generated once per key. */
export function skinTextureKey(scene: Phaser.Scene, skin: Skin): string {
  const key = `dd-skin-${skin.id}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  const c = 32;
  const fill = skin.color === 'cycle' ? 0xffffff : skin.color;
  // baked soft glow halo (cheap on every renderer)
  for (let i = 3; i >= 1; i--) {
    g.fillStyle(fill, 0.1 * (4 - i));
    g.fillCircle(c, c, 28 + i * 1.2);
  }
  g.fillStyle(fill, 1);
  g.lineStyle(3, 0xffffff, 0.95);
  switch (skin.shape) {
    case 'square':
      g.fillRoundedRect(4, 4, 56, 56, 14);
      g.strokeRoundedRect(4, 4, 56, 56, 14);
      break;
    case 'circle':
      g.fillCircle(c, c, 28);
      g.strokeCircle(c, c, 28);
      break;
    case 'triangle': {
      const pts = [{ x: c, y: 4 }, { x: 60, y: 56 }, { x: 4, y: 56 }];
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
      break;
    }
    case 'diamond': {
      const pts = poly(c, c, 4, 30);
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
      break;
    }
    case 'hexagon': {
      const pts = poly(c, c, 6, 29, 1, 0);
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
      break;
    }
    case 'star': {
      const pts = poly(c, c, 5, 31, 0.5);
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
      break;
    }
  }
  // soft highlight
  g.fillStyle(0xffffff, 0.35);
  g.fillCircle(c - 8, c - 9, 7);
  g.generateTexture(key, SKIN_TEX, SKIN_TEX);
  g.destroy();
  return key;
}
