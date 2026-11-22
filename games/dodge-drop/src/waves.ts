import { OVERDRIVE_T, isSurge, spawnInterval } from './difficulty.ts';

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
export const BLOCK_PAD = 14;
/** Centre y at which a block appears (just above the screen). */
export const SPAWN_Y = -BLOCK_H / 2 - BLOCK_PAD;

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
  return isSurge(t) || (t >= 45 && t < OVERDRIVE_T && (t - 45) % 45 < 4);
}

interface Plan {
  spawns: Spawn[];
  duration: number;
  gapX?: number;
}

/** Density curve: single-block rows through Bronze & Silver (wider single blocks), multi-block from Gold (90 s) -> Legend (240 s). */
const DENSITY_T0 = 30;
const DENSITY_MULTI_T = 90;
const DENSITY_T1 = 120;
const DENSITY_T2 = 180;
const DENSITY_T3 = 240; // Legend: density stops rising

function lerp(t: number, t0: number, t1: number, a: number, b: number): number {
  if (t <= t0) return a;
  if (t >= t1) return b;
  return a + ((b - a) * (t - t0)) / (t1 - t0);
}

/** Expected blocks per rain row: 1 through Silver (<= 90 s), 1.4 at 120 s, 2.0 at 180 s, 2.6 from 240 s. */
export function rainRowExpected(t: number): number {
  if (t <= DENSITY_MULTI_T) return 1;
  if (t <= DENSITY_T1) return lerp(t, DENSITY_MULTI_T, DENSITY_T1, 1, 1.4);
  return t <= DENSITY_T2 ? lerp(t, DENSITY_T1, DENSITY_T2, 1.4, 2.0) : lerp(t, DENSITY_T2, DENSITY_T3, 2.0, 2.6);
}

export function rainRowBlocks(t: number, rng: () => number): number {
  const e = rainRowExpected(t);
  const base = Math.floor(e);
  const frac = e - base;
  return Math.min(3, base + (frac > 0 && rng() < frac ? 1 : 0));
}

export function rainWidthRange(t: number): { min: number; max: number } {
  if (t <= DENSITY_MULTI_T) {
    return { min: lerp(t, DENSITY_T0, DENSITY_MULTI_T, 60, 110), max: lerp(t, DENSITY_T0, DENSITY_MULTI_T, 160, 250) };
  }
  if (t <= DENSITY_T1) {
    return { min: lerp(t, DENSITY_MULTI_T, DENSITY_T1, 110, 80), max: lerp(t, DENSITY_MULTI_T, DENSITY_T1, 250, 180) };
  }
  return { min: 80, max: 180 };
}

export function stairsWidth(t: number, width: number): number {
  return lerp(t, DENSITY_T0, DENSITY_T3, width / 6, 160);
}

export function zigzagWidthRange(t: number): { min: number; max: number } {
  return { min: lerp(t, DENSITY_T0, DENSITY_T3, 100, 120), max: lerp(t, DENSITY_T0, DENSITY_T3, 180, 200) };
}

const MIN_ROW_GAP = 2.2 * PLAYER_HITBOX_W;
const ROW_ATTEMPTS = 12;

/** True when blocks (any order) leave a gap >= MIN_ROW_GAP between blocks or screen edges. */
export function rowHasGap(blocks: readonly { x: number; w: number }[], width: number): boolean {
  const sorted = [...blocks].sort((a, b) => a.x - b.x);
  let edge = 0;
  for (const b of sorted) {
    if (b.x - b.w / 2 - edge >= MIN_ROW_GAP - 1e-9) return true;
    edge = b.x + b.w / 2;
  }
  return width - edge >= MIN_ROW_GAP - 1e-9;
}

function rowOverlaps(blocks: readonly { x: number; w: number }[]): boolean {
  const sorted = [...blocks].sort((a, b) => a.x - b.x);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1]!.x + sorted[i - 1]!.w / 2 > sorted[i]!.x - sorted[i]!.w / 2 - 1e-9) return true;
  }
  return false;
}

/** One rain row: k non-overlapping blocks that always leave a >= 2.2 x hitbox gap. */
export function rainRow(t: number, rng: () => number, width: number): { x: number; w: number }[] {
  const k = rainRowBlocks(t, rng);
  const { min, max } = rainWidthRange(t);
  let blocks: { x: number; w: number }[] = [];
  for (let attempt = 0; attempt < ROW_ATTEMPTS; attempt++) {
    blocks = [];
    for (let i = 0; i < k; i++) {
      const w = min + rng() * (max - min);
      blocks.push({ x: w / 2 + rng() * (width - w), w });
    }
    if (!rowOverlaps(blocks) && rowHasGap(blocks, width)) return blocks;
  }
  while (blocks.length > 1 && (rowOverlaps(blocks) || !rowHasGap(blocks, width))) blocks.pop();
  return blocks;
}

function rain(t: number, rng: () => number, width: number, intervalMul: number): Plan {
  const interval = spawnInterval(t) * intervalMul;
  const n = Math.max(1, Math.floor(RAIN_CHUNK / interval));
  const speedMul = t < 10 ? 0.6 : 1;
  const spawns: Spawn[] = [];
  for (let i = 0; i < n; i++) {
    for (const b of rainRow(t, rng, width)) spawns.push({ at: i * interval, x: b.x, w: b.w, h: BLOCK_H, speedMul });
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

function stairs(t: number, rng: () => number, width: number, intervalMul: number): Plan {
  const count = 5;
  const gap = 0.25 * intervalMul;
  const w = stairsWidth(t, width);
  const step = (width - w) / (count - 1);
  const ltr = rng() < 0.5;
  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    const col = ltr ? i : count - 1 - i;
    spawns.push({ at: i * gap, x: w / 2 + col * step, w, h: BLOCK_H, speedMul: 1 });
  }
  return { spawns, duration: (count - 1) * gap + BREATHER };
}

function zigzag(t: number, rng: () => number, width: number, intervalMul: number): Plan {
  const count = 6;
  const gap = 0.45 * intervalMul;
  const third = width / 3;
  let left = rng() < 0.5;
  const { min, max } = zigzagWidthRange(t);
  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    const w = Math.min(third, min + rng() * (max - min)); // <= third (240 at 720)
    const base = left ? 0 : 2 * third;
    const x = base + w / 2 + rng() * Math.max(0, third - w);
    spawns.push({ at: i * gap, x, w, h: BLOCK_H, speedMul: 1 });
    left = !left;
  }
  return { spawns, duration: (count - 1) * gap + BREATHER };
}

export function planWave(
  kind: WaveKind,
  t: number,
  rng: () => number,
  width: number,
  prevGapX?: number,
  intervalMul = 1,
): Plan {
  switch (kind) {
    case 'rain':
      return rain(t, rng, width, intervalMul);
    case 'rainHeavy':
      return rain(t, rng, width, 0.6 * intervalMul);
    case 'wall':
      return wall(rng, width, prevGapX);
    case 'stairs':
      return stairs(t, rng, width, intervalMul);
    case 'zigzag':
      return zigzag(t, rng, width, intervalMul);
  }
}
