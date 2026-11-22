export type MissionId =
  | 'nearMiss' | 'combo' | 'survive' | 'starsTotal' | 'starsRun' | 'shieldBreak' | 'score' | 'rush' | 'runs';
export type Tier = 1 | 2 | 3;
export interface MissionDef { id: MissionId; targets: readonly [number, number, number]; scope: 'run' | 'total' }

export const MISSION_POOL: readonly MissionDef[] = [
  { id: 'nearMiss', targets: [10, 25, 50], scope: 'total' },
  { id: 'combo', targets: [2, 3, 4], scope: 'run' },
  { id: 'survive', targets: [20, 45, 75], scope: 'run' },
  { id: 'starsTotal', targets: [5, 15, 30], scope: 'total' },
  { id: 'starsRun', targets: [3, 6, 10], scope: 'run' },
  { id: 'shieldBreak', targets: [1, 3, 6], scope: 'total' },
  { id: 'score', targets: [150, 400, 800], scope: 'run' },
  { id: 'rush', targets: [1, 2, 4], scope: 'total' },
  { id: 'runs', targets: [3, 6, 10], scope: 'total' },
];

export interface RunStats {
  nearMisses: number; maxMultiplier: number; seconds: number; stars: number;
  shieldBlocks: number; score: number; rushes: number; runs: number;
}
export function emptyStats(): RunStats {
  return { nearMisses: 0, maxMultiplier: 1, seconds: 0, stars: 0, shieldBlocks: 0, score: 0, rushes: 0, runs: 0 };
}

export interface Mission { id: MissionId; tier: Tier; progress: number; done?: boolean }
export interface MissionState {
  active: Mission[]; stars: number; rank: number; completedCount: number;
  /** Local date `YYYY-MM-DD` the active set was drawn for. */
  day: string;
  /** Swaps already used today (the first is free). */
  swapsUsed: number;
}

/** Star-coin reward for completing a mission: 20 x tier. */
export function missionReward(m: Mission): number {
  return 20 * m.tier;
}
export const SWAP_COST = 15;

/** Local calendar day as `YYYY-MM-DD`. */
export function localDay(now: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
/** Milliseconds until the next local midnight. */
export function msUntilReset(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
/** Stars toward the next rank (e.g. 2/5). */
export function rankProgress(stars: number): { have: number; need: number } {
  return { have: stars % 5, need: 5 };
}
export function allDone(state: MissionState): boolean {
  return state.active.length > 0 && state.active.every((m) => m.done === true);
}

const def = (id: MissionId): MissionDef => MISSION_POOL.find((d) => d.id === id)!;
const isId = (v: unknown): v is MissionId => MISSION_POOL.some((d) => d.id === v);

export function missionTarget(m: Mission): number {
  return def(m.id).targets[m.tier - 1]!;
}
export function rankFromStars(stars: number): number {
  return Math.floor(stars / 5) + 1;
}
export function rankMultiplier(rank: number): number {
  return Math.round(Math.min(2, 1 + 0.05 * (rank - 1)) * 100) / 100;
}

export function pickTier(rank: number, rng: () => number): Tier {
  const r = rng();
  if (rank <= 3) return r < 0.7 ? 1 : 2;
  if (rank <= 7) return r < 0.4 ? 1 : r < 0.85 ? 2 : 3;
  return r < 0.2 ? 1 : r < 0.65 ? 2 : 3;
}

export function drawMission(exclude: readonly MissionId[], tier: Tier, rng: () => number): Mission {
  let cands = MISSION_POOL.filter((d) => !exclude.includes(d.id));
  if (cands.length === 0) cands = [...MISSION_POOL];
  const idx = Math.min(cands.length - 1, Math.floor(rng() * cands.length));
  return { id: cands[idx]!.id, tier, progress: 0 };
}

function drawSet(rank: number, firstEver: boolean, rng: () => number): Mission[] {
  const active: Mission[] = [];
  while (active.length < 3) active.push(drawMission(active.map((m) => m.id), firstEver ? 1 : pickTier(rank, rng), rng));
  return active;
}

export function initialMissions(rng: () => number, today: string): MissionState {
  return { active: drawSet(1, true, rng), stars: 0, rank: 1, completedCount: 0, day: today, swapsUsed: 0 };
}

/** If the saved day is not today, draw a fresh set of 3 (keeps stars/rank/completedCount). */
export function rollDay(state: MissionState, today: string, rng: () => number): MissionState {
  if (state.day === today) return state;
  return { ...state, active: drawSet(state.rank, false, rng), day: today, swapsUsed: 0 };
}

export function runValue(id: MissionId, s: RunStats): number {
  switch (id) {
    case 'nearMiss': return s.nearMisses;
    case 'combo': return s.maxMultiplier;
    case 'survive': return s.seconds;
    case 'starsTotal':
    case 'starsRun': return s.stars;
    case 'shieldBreak': return s.shieldBlocks;
    case 'score': return s.score;
    case 'rush': return s.rushes;
    case 'runs': return s.runs;
  }
}

export function liveProgress(m: Mission, s: RunStats): number {
  const v = runValue(m.id, s);
  return def(m.id).scope === 'total' ? m.progress + v : Math.max(m.progress, v);
}
export function isComplete(m: Mission, s: RunStats): boolean {
  return liveProgress(m, s) >= missionTarget(m);
}
export function newlyCompleted(state: MissionState, s: RunStats, seen: ReadonlySet<MissionId>): Mission[] {
  return state.active.filter((m) => !m.done && !seen.has(m.id) && isComplete(m, s));
}

export interface ApplyResult {
  state: MissionState; completed: Mission[];
  rankBefore: number; rankAfter: number; starsGained: number; coinsGained: number;
}

export function applyRun(state: MissionState, s: RunStats): ApplyResult {
  const completed = state.active.filter((m) => !m.done && isComplete(m, s));
  const starsGained = completed.reduce((a, m) => a + m.tier, 0);
  const coinsGained = completed.reduce((a, m) => a + missionReward(m), 0);
  const stars = state.stars + starsGained;
  const rankBefore = state.rank;
  const rankAfter = rankFromStars(stars);
  const doneIds = completed.map((m) => m.id);
  const active = state.active.map((m) => {
    if (m.done) return { ...m };
    if (doneIds.includes(m.id)) return { ...m, progress: missionTarget(m), done: true };
    return { ...m, progress: liveProgress(m, s) };
  });
  return {
    state: { ...state, active, stars, rank: rankAfter, completedCount: state.completedCount + completed.length },
    completed, rankBefore, rankAfter, starsGained, coinsGained,
  };
}

/** Coin cost of the next swap: the first each day is free. */
export function swapCost(state: MissionState): number {
  return state.swapsUsed <= 0 ? 0 : SWAP_COST;
}

export function swapMission(
  state: MissionState, index: number, coins: number, rng: () => number,
): { ok: true; state: MissionState; coins: number } | { ok: false; reason: 'poor' | 'index' | 'done' } {
  const m = state.active[index];
  if (!m) return { ok: false, reason: 'index' };
  if (m.done) return { ok: false, reason: 'done' };
  const cost = swapCost(state);
  if (coins < cost) return { ok: false, reason: 'poor' };
  const repl = drawMission(state.active.map((a) => a.id), m.tier, rng);
  const active = state.active.map((a, i) => (i === index ? repl : { ...a }));
  return { ok: true, state: { ...state, active, swapsUsed: state.swapsUsed + 1 }, coins: coins - cost };
}

const nonNegInt = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function sanitizeMissions(raw: unknown, rng: () => number, today: string): MissionState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return initialMissions(rng, today);
  const o = raw as Record<string, unknown>;
  const stars = nonNegInt(o.stars);
  const rank = rankFromStars(stars);
  const active: Mission[] = [];
  if (Array.isArray(o.active)) {
    for (const e of o.active) {
      if (active.length >= 3) break;
      if (typeof e !== 'object' || e === null) continue;
      const { id, tier, progress, done } = e as Record<string, unknown>;
      if (!isId(id) || active.some((m) => m.id === id)) continue;
      if (tier !== 1 && tier !== 2 && tier !== 3) continue;
      if (typeof progress !== 'number' || !Number.isFinite(progress)) continue;
      active.push(done === true ? { id, tier, progress: nonNegInt(progress), done: true } : { id, tier, progress: nonNegInt(progress) });
    }
  }
  while (active.length < 3) active.push(drawMission(active.map((m) => m.id), pickTier(rank, rng), rng));
  const state: MissionState = {
    active, stars, rank, completedCount: nonNegInt(o.completedCount),
    day: typeof o.day === 'string' ? o.day : '', swapsUsed: nonNegInt(o.swapsUsed),
  };
  return rollDay(state, today, rng);
}
