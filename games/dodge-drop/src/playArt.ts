import Phaser from 'phaser';
import { BLOCK_H, BLOCK_PAD } from './waves.ts';

export { BLOCK_PAD };
export const BLOCK_PINK = 0xff4fa3;
export const BLOCK_ORANGE = 0xffa14d;
export const WARN_H = 26;

function bucket(w: number): number {
  return Math.max(16, Math.ceil(w / 8) * 8);
}

/** Rounded-top crest (shield) outline centred on (cx, cy); scale 1 is about 40 px wide and 46 px tall. */
export function shieldPoints(cx: number, cy: number, scale: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  const v = (x: number, y: number): void => {
    pts.push(new Phaser.Math.Vector2(cx + x * scale, cy + y * scale));
  };
  v(-20, -20);
  for (let i = 0; i <= 4; i++) v(-20 + i * 10, -22 + 3 * Math.sin((i / 4) * Math.PI) * -1 + 0);
  v(20, -20);
  v(20, 2);
  for (let i = 1; i <= 5; i++) {
    const a = (i / 6) * (Math.PI / 2);
    v(20 * Math.cos(a), 2 + 21 * Math.sin(a));
  }
  v(0, 23);
  for (let i = 5; i >= 1; i--) {
    const a = (i / 6) * (Math.PI / 2);
    v(-20 * Math.cos(a), 2 + 21 * Math.sin(a));
  }
  v(-20, 2);
  return pts;
}

function gfx(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({}, false);
}

/** Glowing rounded block texture, cached per width bucket. Returns key and the body width of the texture. */
export function blockTexture(scene: Phaser.Scene, w: number, rush: boolean): { key: string; bodyW: number } {
  const bw = bucket(w);
  const key = `dd-blk-${bw}-${rush ? 'r' : 'p'}`;
  if (!scene.textures.exists(key)) {
    const color = rush ? BLOCK_ORANGE : BLOCK_PINK;
    const g = gfx(scene);
    const P = BLOCK_PAD;
    for (let i = 4; i >= 1; i--) {
      g.fillStyle(color, 0.07 * (5 - i));
      const e = (i * P) / 4;
      g.fillRoundedRect(P - e, P - e, bw + e * 2, BLOCK_H + e * 2, 12 + e);
    }
    g.fillStyle(color, 1);
    g.fillRoundedRect(P, P, bw, BLOCK_H, 12);
    g.fillStyle(0x000000, 0.16);
    g.fillRoundedRect(P + 2, P + BLOCK_H * 0.55, bw - 4, BLOCK_H * 0.45 - 2, 9);
    // lighter 2 px top edge
    g.fillStyle(0xffffff, 0.85);
    g.fillRoundedRect(P + 6, P + 1, bw - 12, 2, 1);
    g.generateTexture(key, bw + P * 2, BLOCK_H + P * 2);
    g.destroy();
  }
  return { key, bodyW: bw };
}

/** Telegraph chevron strip texture (red chevrons on a faint bar), cached per width bucket. */
export function warnTexture(scene: Phaser.Scene, w: number): string {
  const bw = bucket(w);
  const key = `dd-warn-${bw}`;
  if (scene.textures.exists(key)) return key;
  const g = gfx(scene);
  g.fillStyle(0xff3b6b, 0.28);
  g.fillRoundedRect(0, 0, bw, WARN_H, 8);
  g.lineStyle(3, 0xff3b6b, 0.9);
  g.strokeRoundedRect(1, 1, bw - 2, WARN_H - 2, 8);
  g.fillStyle(0xffffff, 0.95);
  const n = Math.max(1, Math.floor(bw / 56));
  const step = bw / n;
  for (let i = 0; i < n; i++) {
    const cx = step * (i + 0.5);
    g.fillTriangle(cx - 12, 6, cx + 12, 6, cx, 20);
  }
  g.generateTexture(key, bw, WARN_H);
  g.destroy();
  return key;
}

export function ensurePlayTextures(scene: Phaser.Scene): void {
  const tex = scene.textures;
  if (!tex.exists('dd-star')) {
    const g = gfx(scene);
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 18 : 8;
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      pts.push({ x: 24 + Math.cos(a) * r, y: 24 + Math.sin(a) * r });
    }
    for (let i = 3; i >= 1; i--) {
      g.fillStyle(0xffe14d, 0.1 * (4 - i));
      g.fillCircle(24, 24, 18 + i * 2);
    }
    g.fillStyle(0xffe14d, 1);
    g.fillPoints(pts, true);
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokePoints(pts, true);
    g.generateTexture('dd-star', 48, 48);
    g.destroy();
  }
  if (!tex.exists('dd-shield')) {
    const g = gfx(scene);
    const crest = shieldPoints(32, 32, 1);
    g.fillStyle(0x58ff9a, 0.3);
    g.fillPoints(shieldPoints(32, 32, 1.12), true);
    g.fillStyle(0x58ff9a, 1);
    g.fillPoints(crest, true);
    g.lineStyle(4, 0xffffff, 1);
    g.strokePoints(crest, true);
    g.fillStyle(0xffffff, 0.35);
    g.fillPoints(shieldPoints(32, 32, 0.55), true);
    g.generateTexture('dd-shield', 64, 64);
    g.destroy();
  }
  if (!tex.exists('dd-ring')) {
    const g = gfx(scene);
    g.lineStyle(10, 0x58ff9a, 0.25);
    g.strokeCircle(48, 48, 40);
    g.lineStyle(4, 0x58ff9a, 1);
    g.strokeCircle(48, 48, 38);
    g.fillStyle(0x58ff9a, 0.12);
    g.fillCircle(48, 48, 38);
    g.generateTexture('dd-ring', 96, 96);
    g.destroy();
  }
}

/** Currency icon: the same star as the in-game pickup, so collected stars visibly read as star coins. */
export function drawCurrencyIcon(scene: Phaser.Scene, x: number, y: number, size: number): Phaser.GameObjects.Image {
  ensurePlayTextures(scene);
  return scene.add.image(x, y, 'dd-star').setDisplaySize(size, size);
}
