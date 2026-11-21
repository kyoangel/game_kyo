export const PENTATONIC: readonly number[] = [0, 2, 4, 7, 9];

export function pentatonic(step: number, baseHz = 440): number {
  const s = Math.min(14, Math.max(0, Math.floor(step)));
  const octave = Math.floor(s / 5);
  const semis = PENTATONIC[s % 5]! + 12 * octave;
  return baseHz * 2 ** (semis / 12);
}
