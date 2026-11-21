export interface Skin {
  id: string;
  shape: 'square' | 'circle' | 'triangle' | 'diamond' | 'hexagon' | 'star';
  color: number | 'cycle';
  trail: 'dots' | 'sparks';
  trailColor: number | 'rainbow';
  cost: number;
}

export const SKINS: readonly Skin[] = [
  { id: 'cyan', shape: 'square', color: 0x3ff0ff, trail: 'dots', trailColor: 0x3ff0ff, cost: 0 },
  { id: 'lime', shape: 'square', color: 0x7dff5a, trail: 'dots', trailColor: 0x7dff5a, cost: 30 },
  { id: 'orb', shape: 'circle', color: 0xff7ad9, trail: 'dots', trailColor: 0xff7ad9, cost: 60 },
  { id: 'tri', shape: 'triangle', color: 0xffa14d, trail: 'sparks', trailColor: 0xffa14d, cost: 100 },
  { id: 'diamond', shape: 'diamond', color: 0xffffff, trail: 'dots', trailColor: 'rainbow', cost: 150 },
  { id: 'hex', shape: 'hexagon', color: 0xb98cff, trail: 'sparks', trailColor: 0xb98cff, cost: 200 },
  { id: 'star', shape: 'star', color: 0xffe14d, trail: 'sparks', trailColor: 0xffe14d, cost: 300 },
  { id: 'prism', shape: 'diamond', color: 'cycle', trail: 'sparks', trailColor: 'rainbow', cost: 500 },
];

export function coinsForRun(score: number, stars: number): number {
  return stars + Math.floor(score / 25);
}

export function buySkin(
  state: { coins: number; owned: string[] },
  id: string,
): { ok: true; coins: number; owned: string[] } | { ok: false; reason: 'owned' | 'poor' | 'unknown' } {
  const skin = SKINS.find((s) => s.id === id);
  if (!skin) return { ok: false, reason: 'unknown' };
  if (state.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (state.coins < skin.cost) return { ok: false, reason: 'poor' };
  return { ok: true, coins: state.coins - skin.cost, owned: [...state.owned, id] };
}
