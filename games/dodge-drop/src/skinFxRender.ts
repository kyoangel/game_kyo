import Phaser from 'phaser';
import type { Fx } from '@gf/game-kit';
import type { Skin } from './economy.ts';
import { hueColor, skinFxSpec } from './skinFx.ts';

const STAR_KEY = 'dd-fx-star4';
const GOLD = 0xffe14d;
const RAINBOW_STOPS = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6].map((h) => hueColor(h));

/** Runtime-drawn 4-point twinkle star (generated once). */
export function ensureFxTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(STAR_KEY)) return;
  const g = scene.make.graphics({}, false);
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? 8 : 2;
    pts.push({ x: 8 + Math.cos(a) * r, y: 8 + Math.sin(a) * r });
  }
  g.fillStyle(0xffffff, 1);
  g.fillPoints(pts, true);
  g.generateTexture(STAR_KEY, 16, 16);
  g.destroy();
}

export interface SkinTrail {
  stop(): void;
  /** Call every frame with scene time in ms, and the normalised horizontal speed 0..1. */
  update(timeMs: number, speedN: number): void;
}

type Img = Phaser.GameObjects.Image;

/** Trail for a skin (dots / sparkle stars / hue-cycling ribbon + afterimage). Rainbow dots no longer fall back to white. */
export function startSkinTrail(scene: Phaser.Scene, target: Img, skin: Skin): SkinTrail {
  ensureFxTextures(scene);
  const spec = skinFxSpec(skin);
  const tc = spec.trailColor;
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  let ribbon: Phaser.GameObjects.Graphics | null = null;
  const hist: Array<{ x: number; y: number; t: number }> = [];
  const ghosts: Img[] = [];
  let lastGhost = 0;

  if (spec.trail === 'ribbon') {
    ribbon = scene.add.graphics().setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
  } else {
    const colorCfg = tc === 'rainbow' ? { color: RAINBOW_STOPS, colorEase: 'Linear' } : { tint: tc };
    emitter = scene.add.particles(0, 0, spec.trail === 'sparkle' ? STAR_KEY : 'gk-dot', {
      lifespan: spec.trailLifespan,
      frequency: spec.trailFreq,
      scale: spec.trail === 'sparkle' ? { start: 1.1, end: 0 } : { start: 1, end: 0 },
      alpha: { start: 0.8, end: 0 },
      ...(spec.trail === 'sparkle' ? { rotate: { start: 0, end: 180 }, x: { min: -14, max: 14 }, y: { min: -10, max: 14 } } : {}),
      ...colorCfg,
      blendMode: 'ADD',
      follow: target as unknown as Phaser.Types.Math.Vector2Like,
    } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig);
    emitter.setDepth(5);
  }
  if (spec.afterimage) {
    for (let i = 0; i < spec.afterimageMax; i++) {
      ghosts.push(scene.add.image(0, 0, target.texture.key).setVisible(false).setDepth(9).setBlendMode(Phaser.BlendModes.ADD));
    }
  }

  return {
    update(timeMs, speedN) {
      if (ribbon) {
        hist.push({ x: target.x, y: target.y, t: timeMs });
        while (hist.length > 0 && timeMs - hist[0]!.t > spec.trailLifespan) hist.shift();
        ribbon.clear();
        const n = hist.length;
        for (let i = 1; i < n; i++) {
          const k = i / n;
          ribbon.lineStyle(4 + 22 * k, hueColor(timeMs / 1400 + i * 0.035), 0.8 * k);
          ribbon.lineBetween(hist[i - 1]!.x, hist[i - 1]!.y + 14, hist[i]!.x, hist[i]!.y + 14);
        }
      }
      if (ghosts.length > 0 && speedN > 0.45 && timeMs - lastGhost > 70) {
        const g = ghosts.find((o) => !o.visible);
        if (g) {
          lastGhost = timeMs;
          g.setTexture(target.texture.key).setPosition(target.x, target.y).setScale(target.scaleX, target.scaleY).setAngle(target.angle);
          g.setTint(hueColor(timeMs / 900)).setAlpha(0.4).setVisible(true);
          scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.setVisible(false) });
        }
      }
    },
    stop() {
      for (const g of ghosts) {
        scene.tweens.killTweensOf(g);
        g.destroy();
      }
      ghosts.length = 0;
      ribbon?.destroy();
      ribbon = null;
      if (emitter) {
        const e = emitter;
        emitter = null;
        e.stop();
        setTimeout(() => e.destroy(), spec.trailLifespan + 50);
      }
    },
  };
}

function alive(scene: Phaser.Scene): boolean {
  return scene.sys.isActive();
}

function starBurst(scene: Phaser.Scene, x: number, y: number, color: number | number[], count: number, speed: number, life: number): void {
  const e = scene.add.particles(x, y, STAR_KEY, {
    speed: { min: speed * 0.35, max: speed },
    angle: { min: 0, max: 360 },
    lifespan: life,
    scale: { start: 1.5, end: 0 },
    alpha: { start: 1, end: 0 },
    rotate: { start: 0, end: 240 },
    ...(Array.isArray(color) ? { color, colorEase: 'Linear' } : { tint: color }),
    blendMode: 'ADD',
    emitting: false,
  } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig);
  e.setDepth(50);
  e.explode(count);
  setTimeout(() => e.destroy(), life + 100);
}

/** Thin expanding rainbow shockwave ring: crisp stroke that grows and fades, clearly not a shield. */
function ring(scene: Phaser.Scene, x: number, y: number, hue: number, maxScale: number, ms: number): void {
  const g = scene.add.graphics({ x, y }).setDepth(49);
  for (let i = 0; i < 3; i++) {
    g.lineStyle(3, hueColor(hue + i * 0.12, 1), 1);
    g.strokeCircle(0, 0, 28 + i * 5);
  }
  g.setScale(0.25);
  scene.tweens.add({ targets: g, scale: maxScale, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
}

function later(scene: Phaser.Scene, ms: number, fn: () => void): void {
  setTimeout(() => { if (alive(scene)) fn(); }, ms);
}

/** Near-miss effect for a skin. `color` is the skin's current colour (prism cycles). */
export function playNearMiss(scene: Phaser.Scene, fx: Fx, skin: Skin, px: number, y: number, side: number, color: number): void {
  ensureFxTextures(scene);
  const spec = skinFxSpec(skin);
  const x = spec.nearMiss === 'ring' ? px : px + side * 24;
  const base = skin.color === 'cycle' ? color : (skin.color === 0xffffff ? 0xffffff : skin.color);
  switch (spec.nearMiss) {
    case 'white':
      fx.burst(x, y, { color: 0xffffff, count: spec.nearMissCount, speed: 260, lifespanMs: 300 });
      break;
    case 'spark':
      fx.burst(x, y, { color: base, count: spec.nearMissCount, speed: 300, lifespanMs: 380 });
      break;
    case 'star':
      fx.burst(x, y, { color: GOLD, count: 8, speed: 320, lifespanMs: 380 });
      starBurst(scene, x, y, GOLD, 8, 340, 450);
      break;
    case 'ring':
      ring(scene, x, y, color === 0xffffff ? 0 : (scene.time.now / 900) % 1, 3.4, 460);
      for (let i = 0; i < 3; i++) fx.burst(x, y, { color: hueColor(i / 3 + scene.time.now / 1200), count: 6, speed: 380, lifespanMs: 400 });
      break;
  }
}

/** Death effect for a skin (caller keeps the shake / red flash). */
export function playDeath(scene: Phaser.Scene, fx: Fx, skin: Skin, x: number, y: number, color: number): void {
  ensureFxTextures(scene);
  const spec = skinFxSpec(skin);
  switch (spec.death) {
    case 'basic':
      fx.burst(x, y, { color, count: spec.deathCount, speed: 560, lifespanMs: 700 });
      break;
    case 'firework':
      fx.burst(x, y, { color: GOLD, count: 12, speed: 300, lifespanMs: 500 });
      later(scene, 220, () => {
        fx.burst(x, y - 20, { color: GOLD, count: 10, speed: 520, lifespanMs: 650 });
        starBurst(scene, x, y - 20, 0xffffff, 8, 560, 700);
      });
      break;
    case 'supernova':
      {
        const core = scene.add.circle(x, y, 36, 0xffffff, 0.55).setDepth(48).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: core, scale: 5, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => core.destroy() });
      }
      ring(scene, x, y, 0, 6, 700);
      later(scene, 110, () => ring(scene, x, y, 0.33, 7.5, 750));
      later(scene, 220, () => ring(scene, x, y, 0.66, 9, 800));
      for (let i = 0; i < 3; i++) fx.burst(x, y, { color: hueColor(i / 3), count: 12, speed: 620, lifespanMs: 750 });
      starBurst(scene, x, y, RAINBOW_STOPS, 6, 480, 750);
      break;
  }
}
