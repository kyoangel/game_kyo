import { describe, expect, it } from 'vitest';
import { BPM, LAYERS, stepsToSchedule } from './music.ts';

describe('music', () => {
  it('stepsToSchedule yields 16th notes at 120 BPM', () => {
    expect(BPM).toBe(120);
    const r = stepsToSchedule(0, 0.3, 0, 0);
    expect(r.map((x) => x.step)).toEqual([0, 1, 2]);
    expect(r.map((x) => x.time)).toEqual([0, 0.125, 0.25]);
  });
  it('wraps step index at 16', () => {
    expect(stepsToSchedule(0, 0.2, 0, 15).map((x) => x.step)).toEqual([15, 0]);
  });
  it('has 4 layers of 16 steps', () => {
    expect(LAYERS.map((l) => l.name)).toEqual(['bass', 'drums', 'arp', 'lead']);
    for (const l of LAYERS) expect(l.steps).toHaveLength(16);
  });
});
