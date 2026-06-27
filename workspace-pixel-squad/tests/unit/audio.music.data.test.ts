import { describe, it, expect } from 'vitest';
import {
  MUSIC_KEYS,
  MUSIC_ASSETS,
  MUSIC_LOOP_KEYS,
  MUSIC_VOLUME,
  MUSIC_FADE_MS,
} from '../../src/data/audio';

describe('MUSIC_KEYS', () => {
  it('defines a key for every documented track/stinger', () => {
    const expectedNames = ['title', 'theme', 'battle', 'victory', 'defeat'];
    expectedNames.forEach((name) => {
      expect(MUSIC_KEYS).toHaveProperty(name);
      expect(typeof MUSIC_KEYS[name as keyof typeof MUSIC_KEYS]).toBe('string');
    });
  });

  it('uses unique string values for every key', () => {
    const values = Object.values(MUSIC_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('MUSIC_ASSETS', () => {
  it('has exactly one asset path per music key', () => {
    const keyValues = Object.values(MUSIC_KEYS);
    keyValues.forEach((key) => {
      expect(MUSIC_ASSETS).toHaveProperty(key);
      expect(typeof MUSIC_ASSETS[key as keyof typeof MUSIC_ASSETS]).toBe('string');
    });
    expect(Object.keys(MUSIC_ASSETS)).toHaveLength(keyValues.length);
  });

  it('points every asset under the audio/ directory', () => {
    Object.values(MUSIC_ASSETS).forEach((path) => {
      expect(path.startsWith('audio/')).toBe(true);
    });
  });
});

describe('MUSIC_LOOP_KEYS', () => {
  it('marks title, theme and battle as looping tracks', () => {
    expect(MUSIC_LOOP_KEYS.has(MUSIC_KEYS.title)).toBe(true);
    expect(MUSIC_LOOP_KEYS.has(MUSIC_KEYS.theme)).toBe(true);
    expect(MUSIC_LOOP_KEYS.has(MUSIC_KEYS.battle)).toBe(true);
  });

  it('does not mark victory or defeat stingers as looping', () => {
    expect(MUSIC_LOOP_KEYS.has(MUSIC_KEYS.victory)).toBe(false);
    expect(MUSIC_LOOP_KEYS.has(MUSIC_KEYS.defeat)).toBe(false);
  });
});

describe('MUSIC_VOLUME and MUSIC_FADE_MS', () => {
  it('exposes a numeric target playback volume', () => {
    expect(typeof MUSIC_VOLUME).toBe('number');
    expect(MUSIC_VOLUME).toBeGreaterThan(0);
    expect(MUSIC_VOLUME).toBeLessThanOrEqual(1);
  });

  it('exposes a 500ms crossfade duration', () => {
    expect(MUSIC_FADE_MS).toBe(500);
  });
});
