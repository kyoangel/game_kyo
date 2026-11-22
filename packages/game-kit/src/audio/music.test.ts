import { describe, expect, it } from 'vitest';
import { BPM, CHOMP_TRACK, LAYERS, modeBpm, RUSH_DRUMS, stepsToSchedule, TRACKS } from './music.ts';

describe('music', () => {
  it('stepsToSchedule yields 16th notes at 120 BPM', () => {
    expect(BPM).toBe(120);
    const r = stepsToSchedule(0, 0.3, 0, 0);
    expect(r.map((x) => x.step)).toEqual([0, 1, 2]);
    expect(r.map((x) => x.time)).toEqual([0, 0.125, 0.25]);
  });
  it('wraps step index at 16 (and supports custom length)', () => {
    expect(stepsToSchedule(0, 0.2, 0, 15).map((x) => x.step)).toEqual([15, 0]);
    expect(stepsToSchedule(0, 0.2, 0, 63, 0.125, 64).map((x) => x.step)).toEqual([63, 0]);
  });
  it('has 4 layers of 16 steps in legacy export', () => {
    expect(LAYERS.map((l) => l.name)).toEqual(['bass', 'drums', 'arp', 'lead']);
    for (const l of LAYERS) expect(l.steps).toHaveLength(16);
  });
  it('provides 3 distinct 64-step main tracks plus a 64-step chomp track', () => {
    expect(TRACKS).toHaveLength(3);
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(3);
    for (const track of [...TRACKS, CHOMP_TRACK]) {
      expect(track.layers.map((l) => l.name)).toEqual(['bass', 'drums', 'arp', 'lead']);
      for (const l of track.layers) expect(l.steps).toHaveLength(64);
    }
    expect(RUSH_DRUMS).toHaveLength(16);
  });
  it('speeds up BPM for rush, overdrive, and chomp modes', () => {
    const t = TRACKS[0]!;
    expect(modeBpm(t, 'normal')).toBe(t.bpm);
    expect(modeBpm(t, 'rush')).toBeGreaterThan(t.bpm);
    expect(modeBpm(t, 'overdrive')).toBeGreaterThan(modeBpm(t, 'rush'));
    expect(modeBpm(t, 'chomp')).toBe(CHOMP_TRACK.bpm);
  });
});
