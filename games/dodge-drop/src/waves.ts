import { spawnInterval } from './difficulty.ts';

export type WaveKind = 'rain' | 'wall' | 'stairs' | 'zigzag' | 'rainHeavy';
export interface Spawn {
  at: number;
  x: number;
  w: number;
  h: number;
  speedMul: number;
}

export const PLAYER_HITBOX_W = 44.8;
export const BLOCK_H = 40;

const GAP_W = 2.5 * PLAYER_HITBOX_W; // 112 >= 2.2 x hitbox
const MAX_GAP_SHIFT = 360;
const BREATHER = 0.6;
const RAIN_CHUNK = 4;
const CYCLE: WaveKind[] = ['wall', 'stairs', 'zigzag', 'rainHeavy'];

export function waveKindAt(t: number): WaveKind {
  if (t < 10) return 'rain';
  return CYCLE[Math.floor((t - 10) / 20) % CYCLE.length];
}

export function isRush(t: number): boolean {
  return t >= 45 && (t - 45) % 45 < 4;
}

interface Plan {
  spawns: Spawn[];
  duration: number;
  gapX?: number;
}

function rain(t: number, rng: () => number, width: number, intervalMul: number): Plan {
  const interval = spawnInterval(t) * intervalMul;
  const n = Math.max(1, Math.floor(RAIN_CHUNK / interval));
  const speedMul = t < 10 ? 0.6 : 1;
  const spawns: Spawn[] = [];
  for (let i = 0; i < n; i++) {
    const w = 60 + rng() * 100;
    const x = w / 2 + rng() * (width - w);
    spawns.push({ at: i * interval, x, w, h: BLOCK_H, speedMul });
  }
  return { spawns, duration: RAIN_CHUNK };
}

function wall(rng: () => number, width: number, prevGapX?: number): Plan {
  const margin = 20 + GAP_W / 2;
  let lo = margin;
  let hi = width - margin;
  if (prevGapX !== undefined) {
    lo = Math.max(lo, prevGapX - MAX_GAP_SHIFT);
    hi = Math.min(hi, prevGapX + MAX_GAP_SHIFT);
    if (lo > hi) lo = hi = Math.min(Math.max(prevGapX, margin), width - margin);
  }
  const gapX = lo + rng() * (hi - lo);
  const leftW = gapX - GAP_W / 2;
  const rightW = width - (gapX + GAP_W / 2);
  const spawns: Spawn[] = [
    { at: 0, x: leftW / 2, w: leftW, h: BLOCK_H, speedMul: 1 },
    { at: 0, x: width - rightW / 2, w: rightW, h: BLOCK_H, speedMul: 1 },
  ];
  return { spawns, duration: 1 + BREATHER, gapX };
}

function stairs(rng: () => number, width: number): Plan {
  const count = 5;
  const gap = 0.25;
  const w = width / 6;
  const step = (width - w) / (count - 1);
  const ltr = rng() < 0.5;
  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    const col = ltr ? i : count - 1 - i;
    spawns.push({ at: i * gap, x: w / 2 + col * step, w, h: BLOCK_H, speedMul: 1 });
  }
  return { spawns, duration: (count - 1) * gap + BREATHER };
}

function zigzag(rng: () => number, width: number): Plan {
  const count = 6;
  const gap = 0.45;
  const third = width / 3;
  let left = rng() < 0.5;
  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    const w = 100 + rng() * 80; // <= third (240 at 720)
    const base = left ? 0 : 2 * third;
    const x = base + w / 2 + rng() * Math.max(0, third - w);
    spawns.push({ at: i * gap, x, w, h: BLOCK_H, speedMul: 1 });
    left = !left;
  }
  return { spawns, duration: (count - 1) * gap + BREATHER };
}

export function planWave(kind: WaveKind, t: number, rng: () => number, width: number, prevGapX?: number): Plan {
  switch (kind) {
    case 'rain':
      return rain(t, rng, width, 1);
    case 'rainHeavy':
      return rain(t, rng, width, 0.6);
    case 'wall':
      return wall(rng, width, prevGapX);
    case 'stairs':
      return stairs(rng, width);
    case 'zigzag':
      return zigzag(rng, width);
  }
}
