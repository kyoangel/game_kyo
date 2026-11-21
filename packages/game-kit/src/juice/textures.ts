import type Phaser from 'phaser';
import type { Theme } from '../theme.ts';
import { cssColor } from '../theme.ts';

/** Generates shared runtime textures once per game (idempotent). */
export function ensureTextures(scene: Phaser.Scene, theme: Theme): void {
  const tex = scene.textures;
  if (!tex.exists('gk-dot')) {
    const c = tex.createCanvas('gk-dot', 8, 8);
    if (c) {
      const g = c.getContext();
      const grad = g.createRadialGradient(4, 4, 0, 4, 4, 4);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.6, 'rgba(255,255,255,0.8)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 8, 8);
      c.refresh();
    }
  }
  if (!tex.exists('gk-spark')) {
    const c = tex.createCanvas('gk-spark', 4, 12);
    if (c) {
      const g = c.getContext();
      const grad = g.createLinearGradient(0, 0, 0, 12);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 4, 12);
      c.refresh();
    }
  }
  if (!tex.exists('gk-bg')) {
    const { width, height } = scene.scale;
    const c = tex.createCanvas('gk-bg', width, height);
    if (c) {
      const g = c.getContext();
      const grad = g.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, cssColor(theme.bgTop));
      grad.addColorStop(1, cssColor(theme.bgBottom));
      g.fillStyle = grad;
      g.fillRect(0, 0, width, height);
      c.refresh();
    }
  }
}

export function addBackground(scene: Phaser.Scene): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, 'gk-bg').setOrigin(0, 0).setDepth(-100);
}
