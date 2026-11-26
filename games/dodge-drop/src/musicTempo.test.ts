import { describe, expect, it } from 'vitest';
import { MUSIC_RATE_MAX, musicRate } from './musicTempo.ts';

describe('musicRate', () => {
  it('starts at normal speed and climbs with the clock', () => {
    expect(musicRate(0)).toBe(1);
    expect(musicRate(30)).toBeGreaterThan(1);
    expect(musicRate(60)).toBeGreaterThan(musicRate(30));
    expect(musicRate(119)).toBeGreaterThan(musicRate(60));
  });
  it('tops out at Overdrive and stays a small shift (pitch rises with it)', () => {
    expect(musicRate(120)).toBeCloseTo(MUSIC_RATE_MAX, 5);
    expect(musicRate(600)).toBeCloseTo(MUSIC_RATE_MAX, 5);
    expect(MUSIC_RATE_MAX).toBeLessThanOrEqual(1.1);
  });
  it('is quantised so the audio node is not touched every frame', () => {
    expect(musicRate(10)).toBe(musicRate(10.1));
  });
});
