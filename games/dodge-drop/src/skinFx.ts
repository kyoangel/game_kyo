import type { Skin } from './economy.ts';

/** Pure tier -> effect mapping for skins. PlayScene and the Shop preview only render it (skinFxRender.ts). */
export type SkinTier = 'basic' | 'spark' | 'star' | 'prism';
export type TrailKind = 'dots' | 'sparkle' | 'ribbon';
export type NearMissKind = 'white' | 'spark' | 'star' | 'ring';
export type DeathKind = 'basic' | 'firework' | 'supernova';

export interface SkinFxSpec {
  tier: SkinTier;
  trail: TrailKind;
  trailColor: number | 'rainbow';
  /** Particle lifespan in ms (ribbon: how long a point stays in the ribbon). */
  trailLifespan: number;
  /** Emit interval in ms (ribbon draws every frame, 0 particles). */
  trailFreq: number;
  nearMiss: NearMissKind;
  nearMissCount: number;
  death: DeathKind;
  deathCount: number;
  /** Hue-cycling afterimage while moving fast. */
  afterimage: boolean;
  /** Pooled afterimage sprites (counted against the budget). */
  afterimageMax: number;
  /** True when the skin has near-miss/death effects beyond the basic ones (drives the preview text). */
  extras: boolean;
}

export const MAX_FX_PARTICLES = 60;

export function skinTier(skin: Skin): SkinTier {
  if (skin.cost >= 500) return 'prism';
  if (skin.cost >= 300) return 'star';
  if (skin.cost >= 100) return 'spark';
  return 'basic';
}

export function skinFxSpec(skin: Skin): SkinFxSpec {
  const tier = skinTier(skin);
  const base = { tier, trailColor: skin.trailColor, afterimage: false, afterimageMax: 0 };
  switch (tier) {
    case 'basic':
      return { ...base, trail: 'dots', trailLifespan: 350, trailFreq: 30, nearMiss: 'white', nearMissCount: 8, death: 'basic', deathCount: 40, extras: false };
    case 'spark':
      return { ...base, trail: 'dots', trailLifespan: 500, trailFreq: 35, nearMiss: 'spark', nearMissCount: 12, death: 'basic', deathCount: 40, extras: false };
    case 'star':
      return { ...base, trail: 'sparkle', trailLifespan: 600, trailFreq: 50, nearMiss: 'star', nearMissCount: 16, death: 'firework', deathCount: 30, extras: true };
    case 'prism':
      return { ...base, trail: 'ribbon', trailColor: 'rainbow', trailLifespan: 380, trailFreq: 0, nearMiss: 'ring', nearMissCount: 18, death: 'supernova', deathCount: 42, afterimage: true, afterimageMax: 6, extras: true };
  }
}

/** Worst-case extra live particles/sprites: trail + the larger of near-miss / death + afterimages. */
export function fxBudget(spec: SkinFxSpec): number {
  const trail = spec.trail === 'ribbon' ? 0 : Math.ceil(spec.trailLifespan / spec.trailFreq);
  return trail + Math.max(spec.nearMissCount, spec.deathCount) + spec.afterimageMax;
}

/** Saturated hue colour for t in [0,1) (wraps); never white. */
export function hueColor(t: number, s = 0.7, v = 1): number {
  const h = (((t % 1) + 1) % 1) * 6;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const u = v * (1 - s * (1 - f));
  const [r, g, b] = [[v, u, p], [q, v, p], [p, v, u], [p, q, v], [u, p, v], [v, p, q]][i % 6]!;
  return (Math.round(r! * 255) << 16) | (Math.round(g! * 255) << 8) | Math.round(b! * 255);
}

/** i18n key of the one-line effect list shown under the Shop preview. */
export function fxLineKey(spec: SkinFxSpec): string {
  if (spec.tier === 'basic') return 'skin.fx.basic';
  return spec.extras ? 'skin.fx.extra' : 'skin.fx.mid';
}
