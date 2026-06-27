import { describe, it, expect } from 'vitest';
import { SFX_KEYS, SFX_ASSETS } from '../../src/data/audio';

describe('SFX_KEYS', () => {
  it('defines a key for every documented cue', () => {
    const expectedNames = [
      'attack',
      'hit',
      'crit',
      'heal',
      'buff',
      'recruitSuccess',
      'recruitFail',
      'victory',
      'defeat',
      'levelUp',
      'buttonClick',
      'purchase',
    ];
    expectedNames.forEach((name) => {
      expect(SFX_KEYS).toHaveProperty(name);
      expect(typeof SFX_KEYS[name as keyof typeof SFX_KEYS]).toBe('string');
    });
  });

  it('uses unique string values for every key', () => {
    const values = Object.values(SFX_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('SFX_ASSETS', () => {
  it('has exactly one asset path per SFX key', () => {
    const keyValues = Object.values(SFX_KEYS);
    keyValues.forEach((key) => {
      expect(SFX_ASSETS).toHaveProperty(key);
      expect(typeof SFX_ASSETS[key as keyof typeof SFX_ASSETS]).toBe('string');
    });
    expect(Object.keys(SFX_ASSETS)).toHaveLength(keyValues.length);
  });

  it('points every asset under the audio/ directory', () => {
    Object.values(SFX_ASSETS).forEach((path) => {
      expect(path.startsWith('audio/')).toBe(true);
    });
  });
});
