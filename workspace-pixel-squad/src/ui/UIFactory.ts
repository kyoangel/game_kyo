import type Phaser from 'phaser';
import { Colors } from './theme';

export const HP_PCT_MID = 0.5;
export const HP_PCT_LOW = 0.25;

export function resolveHPBarColor(pct: number): number {
  if (pct > HP_PCT_MID) return Colors.HP_HIGH;
  if (pct > HP_PCT_LOW) return Colors.HP_MID;
  return Colors.HP_LOW;
}

export type ButtonVariant = 'active' | 'idle' | 'danger' | 'disabled';

export function resolveButtonFill(variant: ButtonVariant): number {
  switch (variant) {
    case 'active': return Colors.BUTTON_ACTIVE;
    case 'danger': return Colors.BUTTON_DANGER;
    case 'idle':
    case 'disabled':
    default:
      return Colors.BUTTON_IDLE;
  }
}

export function makePanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  borderColor?: number,
): Phaser.GameObjects.Container {
  const border = borderColor ?? Colors.BORDER_DIM;
  const container = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, Colors.BG_MID).setOrigin(0);
  const top    = scene.add.rectangle(0, 0, w, 2, border).setOrigin(0);
  const bottom = scene.add.rectangle(0, h - 2, w, 2, border).setOrigin(0);
  const left   = scene.add.rectangle(0, 0, 2, h, border).setOrigin(0);
  const right  = scene.add.rectangle(w - 2, 0, 2, h, border).setOrigin(0);
  container.add([bg, top, bottom, left, right]);
  return container;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  variant: ButtonVariant,
): Phaser.GameObjects.Container {
  const fill = resolveButtonFill(variant);
  const container = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, fill).setOrigin(0);
  const borderColor = variant === 'disabled' ? Colors.BORDER_DIM : Colors.BORDER_DIM;
  const top    = scene.add.rectangle(0, 0, w, 1, borderColor).setOrigin(0);
  const bottom = scene.add.rectangle(0, h - 1, w, 1, borderColor).setOrigin(0);
  const left   = scene.add.rectangle(0, 0, 1, h, borderColor).setOrigin(0);
  const right  = scene.add.rectangle(w - 1, 0, 1, h, borderColor).setOrigin(0);
  const text = scene.add.text(w / 2, h / 2, label, { fontFamily: 'monospace', fontSize: '12px', color: '#e2e8f0' }).setOrigin(0.5);
  if (variant === 'disabled') {
    container.setAlpha(0.5);
  }
  container.add([bg, top, bottom, left, right, text]);
  return container;
}

export function makeHPBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
): { bg: Phaser.GameObjects.Rectangle; bar: Phaser.GameObjects.Rectangle; update: (pct: number) => void } {
  const bg = scene.add.rectangle(x, y, w, h, 0x000000).setOrigin(0);
  const bar = scene.add.rectangle(x, y, w, h, Colors.HP_HIGH).setOrigin(0);
  const update = (pct: number) => {
    const clampedPct = Math.max(0, Math.min(1, pct));
    bar.width = w * clampedPct;
    bar.fillColor = resolveHPBarColor(clampedPct);
  };
  return { bg, bar, update };
}

export function makeArchetypeBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  archetype: string,
): Phaser.GameObjects.Container {
  const color = Colors.ARCHETYPE[archetype] ?? Colors.BORDER_DIM;
  const container = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, 40, 16, color).setOrigin(0.5);
  const label = scene.add.text(0, 0, archetype, { fontFamily: 'monospace', fontSize: '10px', color: '#e2e8f0' }).setOrigin(0.5);
  container.add([bg, label]);
  return container;
}

export function makeBuffSlots(
  scene: Phaser.Scene,
  x: number,
  y: number,
  count: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  for (let i = 0; i < count; i++) {
    const slot = scene.add.rectangle(i * 14, 0, 12, 12, Colors.BG_LIGHT).setOrigin(0);
    container.add(slot);
  }
  return container;
}

export function fadeIn(scene: Phaser.Scene, duration = 300): void {
  const cover = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000)
    .setOrigin(0)
    .setDepth(9999)
    .setAlpha(1);
  scene.tweens.add({ targets: cover, alpha: 0, duration, onComplete: () => cover.destroy() });
}

export function fadeOut(scene: Phaser.Scene, duration = 200, onComplete?: () => void): void {
  const cover = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000)
    .setOrigin(0)
    .setDepth(9999)
    .setAlpha(0);
  scene.tweens.add({ targets: cover, alpha: 1, duration, onComplete });
}
