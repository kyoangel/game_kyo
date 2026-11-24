import Phaser from 'phaser';
import { ghostX, type ControlKind } from './onboarding.ts';
import { STRIP_BOTTOM, STRIP_TOP } from './layout.ts';

export interface TutorialView {
  /** Advance the animation; `elapsed` is seconds since the tutorial started. */
  update(elapsed: number): void;
  /** Fade everything out (300 ms) and destroy it. */
  dismiss(): void;
}

const GHOST_AMPLITUDE = 200;
const CAP = 96;
const DEPTH = 99;

/** Visual control hint drawn over the thumb strip (field objects only): ghost finger for touch, arrow-key caps for desktop. */
export function createTutorialView(scene: Phaser.Scene, kind: ControlKind, width: number, fontFamily: string): TutorialView {
  const midY = (STRIP_TOP + STRIP_BOTTOM) / 2;
  const objs: Phaser.GameObjects.GameObject[] = [];
  let ghost: Phaser.GameObjects.Graphics | null = null;
  const trailX: number[] = [];

  if (kind === 'touch') {
    ghost = scene.add.graphics().setDepth(DEPTH);
    objs.push(ghost);
  } else {
    for (const dir of [-1, 1]) {
      const cx = width / 2 + dir * 90;
      const g = scene.add.graphics().setDepth(DEPTH);
      g.fillStyle(0x1a1033, 0.85).fillRoundedRect(cx - CAP / 2, midY - CAP / 2, CAP, CAP, 16);
      g.lineStyle(5, 0x9ee9ff, 1).strokeRoundedRect(cx - CAP / 2, midY - CAP / 2, CAP, CAP, 16);
      const t = scene.add
        .text(cx, midY - 4, dir < 0 ? '←' : '→', { fontFamily, fontSize: '60px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(DEPTH);
      scene.tweens.add({ targets: [g, t], alpha: { from: 0.55, to: 1 }, duration: 600, yoyo: true, repeat: -1, delay: dir < 0 ? 0 : 300 });
      objs.push(g, t);
    }
  }

  return {
    update(elapsed) {
      if (!ghost) return;
      const x = ghostX(elapsed, width / 2, GHOST_AMPLITUDE);
      trailX.unshift(x);
      if (trailX.length > 12) trailX.pop();
      ghost.clear();
      for (const [i, lag] of [9, 6, 3].entries()) {
        const tx = trailX[Math.min(lag, trailX.length - 1)] ?? x;
        ghost.fillStyle(0xffffff, 0.12 + i * 0.06).fillCircle(tx, midY, 20 + i * 5);
      }
      ghost.fillStyle(0xffffff, 0.75).fillCircle(x, midY, 34);
      ghost.lineStyle(5, 0x9ee9ff, 0.9).strokeCircle(x, midY, 34);
    },
    dismiss() {
      for (const o of objs) {
        scene.tweens.killTweensOf(o);
        scene.tweens.add({ targets: o, alpha: 0, duration: 300, onComplete: () => o.destroy() });
      }
    },
  };
}
