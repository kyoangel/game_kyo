import { fallSpeed, speedBoost } from './difficulty.ts';
import type { Spawn } from './waves.ts';
import { PLAYER_HITBOX_W, SPAWN_Y } from './waves.ts';

export type Scheduled = Spawn;

export interface FieldOptions {
  /** Global block speed multiplier (default 1). */
  speedMul?: number;
}

export const PLAYER_Y = 1100;
/** Conservative player speed (keyboard max is 640). */
export const SAFE_PLAYER_SPEED = 520;
const DT = 1 / 60;
const CELL = 4;
const SAFETY = 6;
const HIT_SCALE = 0.9;

/** Cumulative fall distance per frame at speed multiplier 1; grown on demand and shared across calls. */
let distCache = new Float64Array(1);
let distFilled = 1;
function distanceTable(len: number): Float64Array {
  if (len > distCache.length) {
    const grown = new Float64Array(Math.max(len, distCache.length * 2));
    grown.set(distCache.subarray(0, distFilled));
    distCache = grown;
  }
  for (; distFilled < len; distFilled++) {
    const t = (distFilled - 1) * DT;
    distCache[distFilled] = distCache[distFilled - 1]! + fallSpeed(t) * speedBoost(t) * DT;
  }
  return distCache;
}

/**
 * Simulates the real motion model (per-frame integration of fallSpeed * speedBoost * speedMul) and
 * a player moving at most SAFE_PLAYER_SPEED. Returns the time at which no x position is
 * safe any more, or null. The player may start anywhere in [fromT]; blocks are simulated
 * from their spawn so earlier blocks still constrain the window.
 */
export function firstDeadEnd(
  spawns: Scheduled[],
  width: number,
  fromT: number,
  toT: number,
  opts?: FieldOptions,
): number | null {
  const sm = opts?.speedMul ?? 1;
  const kStart = Math.max(0, Math.floor(fromT / DT));
  const kEnd = Math.floor(toT / DT);
  if (kEnd < kStart) return null;
  const D = distanceTable(kEnd + 2);

  const n = Math.floor((width - PLAYER_HITBOX_W) / CELL) + 1;
  const x0 = PLAYER_HITBOX_W / 2;
  const perStep: number[][] = [];
  for (let k = kStart; k <= kEnd; k++) perStep.push([]);
  const lo: number[] = [];
  const hi: number[] = [];

  for (const s of spawns) {
    const ks = Math.ceil(s.at / DT);
    if (ks > kEnd) continue;
    const reach = (PLAYER_HITBOX_W + s.h * HIT_SCALE) / 2;
    const half = (s.w * HIT_SCALE) / 2 + PLAYER_HITBOX_W / 2 + SAFETY;
    // y(k) = SPAWN_Y + speedMul * (D[k] - D[ks]); monotonic in k, find the band [first, last].
    const yAt = (k: number): number => SPAWN_Y + s.speedMul * sm * (D[k]! - D[ks]!);
    let a = ks;
    let b = kEnd + 1;
    while (a < b) {
      const m = (a + b) >> 1;
      if (yAt(m) > PLAYER_Y - reach) b = m;
      else a = m + 1;
    }
    const first = a;
    a = first;
    b = kEnd + 1;
    while (a < b) {
      const m = (a + b) >> 1;
      if (yAt(m) >= PLAYER_Y + reach) b = m;
      else a = m + 1;
    }
    const last = a - 1;
    if (first > kEnd || last < kStart) continue;
    let i0 = Math.ceil((s.x - half - x0) / CELL + 1e-9);
    let i1 = Math.floor((s.x + half - x0) / CELL - 1e-9);
    i0 = Math.max(0, i0);
    i1 = Math.min(n - 1, i1);
    if (i1 < i0) continue;
    const idx = lo.length;
    lo.push(i0);
    hi.push(i1);
    for (let k = Math.max(first, kStart); k <= Math.min(last, kEnd); k++) perStep[k - kStart]!.push(idx);
  }

  const R = Math.floor((SAFE_PLAYER_SPEED * DT) / CELL);
  let cur = new Uint8Array(n).fill(1);
  let nxt = new Uint8Array(n);
  for (let k = kStart; k <= kEnd; k++) {
    const blocked = perStep[k - kStart]!;
    if (blocked.length === 0 && cur.every((v) => v === 1)) continue;
    // dilate by R cells
    let last = -Infinity;
    for (let i = 0; i < n; i++) {
      if (cur[i]) last = i;
      nxt[i] = i - last <= R ? 1 : 0;
    }
    last = Infinity;
    for (let i = n - 1; i >= 0; i--) {
      if (cur[i]) last = i;
      if (last - i <= R) nxt[i] = 1;
    }
    for (const idx of blocked) nxt.fill(0, lo[idx]!, hi[idx]! + 1);
    let any = false;
    for (let i = 0; i < n; i++) if (nxt[i]) { any = true; break; }
    if (!any) return k * DT;
    const tmp = cur;
    cur = nxt;
    nxt = tmp;
  }
  return null;
}
