import { describe, expect, it } from 'vitest';
import { MEDALS, medalsReached, mergeMedals } from './medals.ts';

describe('medals', () => {
  it('table', () => {
    expect(MEDALS.map((m) => [m.id, m.seconds, m.color])).toEqual([
      ['bronze', 15, 0xd08a4a],
      ['silver', 30, 0xd8e0ff],
      ['gold', 60, 0xffe14d],
      ['neon', 120, 0x3ff0ff],
      ['diamond', 180, 0xc8f4ff],
      ['legend', 240, 0xff7ad9],
    ]);
  });
  it('medalsReached', () => {
    expect(medalsReached(14, 16)).toEqual(['bronze']);
    expect(medalsReached(29, 121)).toEqual(['silver', 'gold', 'neon']);
    expect(medalsReached(16, 29)).toEqual([]);
    expect(medalsReached(59, 61)).toEqual(['gold']);
    expect(medalsReached(119, 241)).toEqual(['neon', 'diamond', 'legend']);
    expect(medalsReached(179, 181)).toEqual(['diamond']);
  });
  it('mergeMedals', () => {
    expect(mergeMedals('garbage', ['gold'])).toEqual(['gold']);
    expect(mergeMedals(['neon', 'bronze', 'x', 'bronze', 5], ['silver'])).toEqual(['bronze', 'silver', 'neon']);
  });
});
