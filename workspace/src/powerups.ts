export type PowerupId = "hammer" | "shuffle" | "addOne" | "bomb";

export interface PowerupState {
  hammer: number;
  shuffle: number;
  addOne: number;
  bomb: number;
}

export function emptyPowerups(): PowerupState {
  return { hammer: 0, shuffle: 0, addOne: 0, bomb: 0 };
}

export function computePlayCountAward(
  playCount: number,
  rng: () => number = Math.random,
): PowerupId | null {
  if (playCount % 3 === 0) return "addOne";
  if (playCount % 2 === 0) return rng() < 0.5 ? "hammer" : "shuffle";
  return null;
}

export function computeEliminationAward(
  oldTotal: number,
  newTotal: number,
): number {
  return Math.floor(newTotal / 30) - Math.floor(oldTotal / 30);
}
