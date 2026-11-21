import { describe, expect, it } from 'vitest';
import { MEDALS, medalsReached, mergeMedals } from './medals.ts';

describe('medals', () => {
  it('table', () => {
    expect(MEDALS.map((m) => [m.id, m.seconds, m.color])).toEqual([
      ['bronze', 30, 0xd08a4a],
      ['silver', 60, 0xd8e0ff],
      ['gold', 90, 0xffe14d],
      ['neon', 120, 0x3ff0ff],
    ]);
  });
  it('medalsReached', () => {
    expect(medalsReached(29, 31)).toEqual(['bronze']);
    expect(medalsReached(59, 121)).toEqual(['silver', 'gold', 'neon']);
    expect(medalsReached(31, 40)).toEqual([]);
  });
  it('mergeMedals', () => {
    expect(mergeMedals('garbage', ['gold'])).toEqual(['gold']);
    expect(mergeMedals(['neon', 'bronze', 'x', 'bronze', 5], ['silver'])).toEqual(['bronze', 'silver', 'neon']);
  });
});
