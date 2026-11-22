import Phaser from 'phaser';
import { getKit } from '../kit.ts';
import { cssColor } from '../theme.ts';

const handled = new WeakMap<Phaser.Scene, boolean>();

/** Mark the current pointer as handled by a UI control so scene-wide tap handlers (e.g. tap-to-start) skip it. */
export function markButtonTap(scene: Phaser.Scene): void {
  handled.set(scene, true);
  scene.input.once('pointerup', () => setTimeout(() => handled.set(scene, false), 0));
}

/** True once if a button handled the current pointer; scene-wide tap handlers should skip when it returns true. */
export function consumeButtonTap(scene: Phaser.Scene): boolean {
  const v = handled.get(scene) === true;
  handled.set(scene, false);
  return v;
}

/** Render text at the on-screen pixel density (canvas is FIT-scaled and devices are hi-dpi) so labels stay crisp. */
export function textResolution(scene: Phaser.Scene): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const fit = scene.scale.displaySize.width / scene.scale.width || 1;
  return Math.min(3, Math.max(1, Math.ceil(dpr * fit)));
}

export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  opts: { width?: number; height?: number; fill?: number; textColor?: number; fontSize?: number; strokeThickness?: number; onClick: () => void },
): Phaser.GameObjects.Container {
  const kit = getKit(scene);
  const { theme } = kit;
  const w = opts.width ?? 320;
  const h = opts.height ?? 76;
  const g = scene.add.graphics();
  g.fillStyle(opts.fill ?? theme.primary, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: theme.font,
      fontSize: `${opts.fontSize ?? 32}px`,
      color: cssColor(opts.textColor ?? 0xffffff),
      stroke: '#1a1033',
      strokeThickness: opts.strokeThickness ?? 4,
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setResolution(textResolution(scene));
  const c = scene.add.container(x, y, [g, text]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => {
    markButtonTap(scene);
    c.setScale(0.94);
    kit.audio.sfx('click');
  });
  const release = (): void => {
    c.setScale(1);
  };
  c.on('pointerout', release);
  c.on('pointerup', () => {
    release();
    opts.onClick();
  });
  return c;
}
