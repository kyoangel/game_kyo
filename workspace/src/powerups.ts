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
  if (playCount % 10 === 0) return "addOne";
  if (playCount % 5 === 0) return rng() < 0.5 ? "hammer" : "shuffle";
  return null;
}

export function computeBestScoreAward(oldBest: number, newBest: number): number {
  let bombs = 0;
  if (oldBest < 50 && newBest >= 50) bombs += 1;
  const oldHundreds = Math.floor(oldBest / 100);
  const newHundreds = Math.floor(newBest / 100);
  if (newHundreds > oldHundreds) bombs += newHundreds - oldHundreds;
  return bombs;
}
