import Phaser from 'phaser';
import { addTrauma, decayTrauma, shakeOffset } from './trauma.ts';

export interface Fx {
  /** True while a hitStop is active; game update loops may skip simulation. */
  readonly frozen: boolean;
  burst(x: number, y: number, opts?: { color?: number; count?: number; speed?: number; lifespanMs?: number }): void;
  shake(trauma: number): void;
  hitStop(ms: number): Promise<void>;
  flash(color?: number, ms?: number): void;
  popText(x: number, y: number, text: string, opts?: { color?: number; size?: number }): void;
  /** Destroy any pop texts still floating (e.g. before a results overlay is shown). */
  clearPops(): void;
  trail(target: Phaser.GameObjects.Components.Transform, opts?: { color?: number }): { stop(): void };
  glow(obj: Phaser.GameObjects.GameObject, color: number, strength?: number): void;
  timeScale(scale: number, ms: number): Promise<void>;
}

const MAX_SHAKE_PX = 18;
const DECAY_PER_SEC = 1.6;

export function createFx(scene: Phaser.Scene): Fx {
  let trauma = 0;
  let baseX = 0;
  let baseY = 0;
  let shaking = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const emitters = new Set<Phaser.GameObjects.Particles.ParticleEmitter>();
  let frozen = 0;
  let slowed = 0;
  const pops = new Set<Phaser.GameObjects.Text>();

  const cam = (): Phaser.Cameras.Scene2D.Camera => scene.cameras.main;

  const onPostUpdate = (_time: number, delta: number): void => {
    if (trauma <= 0) {
      if (shaking) {
        cam().setScroll(baseX, baseY);
        shaking = false;
      }
      return;
    }
    if (!shaking) {
      baseX = cam().scrollX;
      baseY = cam().scrollY;
      shaking = true;
    }
    const o = shakeOffset(trauma, MAX_SHAKE_PX, Math.random);
    cam().setScroll(baseX + o.x, baseY + o.y);
    // real-time decay so hit-stop does not freeze the shake
    trauma = decayTrauma(trauma, delta / 1000, DECAY_PER_SEC);
  };
  scene.events.on('postupdate', onPostUpdate);

  const realTimeout = (fn: () => void, ms: number): void => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  const cleanup = (): void => {
    scene.events.off('postupdate', onPostUpdate);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const e of emitters) e.destroy();
    emitters.clear();
    if (frozen > 0) {
      scene.time.paused = false;
      scene.tweens.resumeAll();
      frozen = 0;
    }
    if (slowed > 0) {
      scene.time.timeScale = 1;
      scene.tweens.timeScale = 1;
      slowed = 0;
    }
  };
  scene.events.once('shutdown', cleanup);
  scene.events.once('destroy', cleanup);

  return {
    get frozen() {
      return frozen > 0;
    },

    burst(x, y, opts = {}) {
      const { color = 0xffffff, count = 24, speed = 420, lifespanMs = 600 } = opts;
      const e = scene.add.particles(x, y, 'gk-dot', {
        speed: { min: speed * 0.3, max: speed },
        angle: { min: 0, max: 360 },
        lifespan: lifespanMs,
        scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: color,
        blendMode: 'ADD',
        emitting: false,
      });
      e.setDepth(50);
      emitters.add(e);
      e.explode(count);
      realTimeout(() => {
        emitters.delete(e);
        e.destroy();
      }, lifespanMs + 100);
    },

    shake(amount) {
      trauma = addTrauma(trauma, amount);
    },

    hitStop(ms) {
      return new Promise<void>((resolve) => {
        frozen++;
        scene.time.paused = true;
        scene.tweens.pauseAll();
        realTimeout(() => {
          frozen = Math.max(0, frozen - 1);
          if (frozen === 0) {
            scene.time.paused = false;
            scene.tweens.resumeAll();
          }
          resolve();
        }, ms);
      });
    },

    flash(color = 0xffffff, ms = 120) {
      const { width, height } = scene.scale;
      const r = scene.add.rectangle(0, 0, width, height, color, 0.8).setOrigin(0, 0).setDepth(1000).setScrollFactor(0);
      r.setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: r, alpha: 0, duration: ms, onComplete: () => r.destroy() });
    },

    popText(x, y, text, opts = {}) {
      const { color = 0xffffff, size = 32 } = opts;
      const t = scene.add
        .text(x, y, text, {
          fontSize: `${size}px`,
          color: `#${color.toString(16).padStart(6, '0')}`,
          stroke: '#1a1033',
          strokeThickness: 4,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(60)
        .setScale(1.3);
      pops.add(t);
      scene.tweens.add({
        targets: t,
        y: y - 60,
        scale: 1,
        alpha: 0,
        duration: 700,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          pops.delete(t);
          t.destroy();
        },
      });
    },

    clearPops() {
      for (const t of pops) {
        scene.tweens.killTweensOf(t);
        t.destroy();
      }
      pops.clear();
    },

    trail(target, opts = {}) {
      const { color = 0xffffff } = opts;
      const e = scene.add.particles(0, 0, 'gk-dot', {
        lifespan: 350,
        frequency: 30,
        scale: { start: 1, end: 0 },
        alpha: { start: 0.7, end: 0 },
        tint: color,
        blendMode: 'ADD',
        follow: target as unknown as Phaser.Types.Math.Vector2Like,
      });
      e.setDepth(5);
      emitters.add(e);
      return {
        stop() {
          if (!emitters.delete(e)) return;
          e.stop();
          realTimeout(() => e.destroy(), 400);
        },
      };
    },

    glow(obj, color, strength = 4) {
      if (scene.renderer.type !== Phaser.WEBGL) return;
      const fx = (obj as unknown as { preFX?: Phaser.GameObjects.Components.FX }).preFX;
      fx?.addGlow(color, strength);
    },

    timeScale(scale, ms) {
      return new Promise<void>((resolve) => {
        slowed++;
        scene.time.timeScale = scale;
        scene.tweens.timeScale = scale;
        realTimeout(() => {
          slowed = Math.max(0, slowed - 1);
          if (slowed === 0) {
            scene.time.timeScale = 1;
            scene.tweens.timeScale = 1;
          }
          resolve();
        }, ms);
      });
    },
  };
}
