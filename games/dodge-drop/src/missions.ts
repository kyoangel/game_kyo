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

export interface Mission { id: MissionId; tier: Tier; progress: number }
export interface MissionState { active: Mission[]; stars: number; rank: number; completedCount: number }

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

export function initialMissions(rng: () => number): MissionState {
  const active: Mission[] = [];
  while (active.length < 3) active.push(drawMission(active.map((m) => m.id), 1, rng));
  return { active, stars: 0, rank: 1, completedCount: 0 };
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
  return state.active.filter((m) => !seen.has(m.id) && isComplete(m, s));
}

export interface ApplyResult {
  state: MissionState; completed: Mission[]; replacements: Mission[];
  rankBefore: number; rankAfter: number; starsGained: number;
}

export function applyRun(state: MissionState, s: RunStats, rng: () => number): ApplyResult {
  const completed = state.active.filter((m) => isComplete(m, s));
  const starsGained = completed.reduce((a, m) => a + m.tier, 0);
  const stars = state.stars + starsGained;
  const rankBefore = state.rank;
  const rankAfter = rankFromStars(stars);
  const doneIds = completed.map((m) => m.id);
  const kept = state.active.map((m) => (doneIds.includes(m.id) ? null : { ...m, progress: liveProgress(m, s) }));
  const exclude: MissionId[] = [...kept.filter((m): m is Mission => m !== null).map((m) => m.id), ...doneIds];
  const replacements: Mission[] = [];
  const active = kept.map((m) => {
    if (m) return m;
    const r = drawMission(exclude, pickTier(rankAfter, rng), rng);
    exclude.push(r.id);
    replacements.push(r);
    return r;
  });
  return {
    state: { active, stars, rank: rankAfter, completedCount: state.completedCount + completed.length },
    completed, replacements, rankBefore, rankAfter, starsGained,
  };
}

export function skipCost(m: Mission): number {
  return 40 * m.tier;
}

export function skipMission(
  state: MissionState, index: number, coins: number, rng: () => number,
): { ok: true; state: MissionState; coins: number } | { ok: false; reason: 'poor' | 'index' } {
  const m = state.active[index];
  if (!m) return { ok: false, reason: 'index' };
  const cost = skipCost(m);
  if (coins < cost) return { ok: false, reason: 'poor' };
  const repl = drawMission(state.active.map((a) => a.id), m.tier, rng);
  const active = state.active.map((a, i) => (i === index ? repl : { ...a }));
  return { ok: true, state: { ...state, active }, coins: coins - cost };
}

const nonNegInt = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function sanitizeMissions(raw: unknown, rng: () => number): MissionState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return initialMissions(rng);
  const o = raw as Record<string, unknown>;
  const stars = nonNegInt(o.stars);
  const rank = rankFromStars(stars);
  const active: Mission[] = [];
  if (Array.isArray(o.active)) {
    for (const e of o.active) {
      if (active.length >= 3) break;
      if (typeof e !== 'object' || e === null) continue;
      const { id, tier, progress } = e as Record<string, unknown>;
      if (!isId(id) || active.some((m) => m.id === id)) continue;
      if (tier !== 1 && tier !== 2 && tier !== 3) continue;
      if (typeof progress !== 'number' || !Number.isFinite(progress)) continue;
      active.push({ id, tier, progress: nonNegInt(progress) });
    }
  }
  while (active.length < 3) active.push(drawMission(active.map((m) => m.id), pickTier(rank, rng), rng));
  return { active, stars, rank, completedCount: nonNegInt(o.completedCount) };
}
