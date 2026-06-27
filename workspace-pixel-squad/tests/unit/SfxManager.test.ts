import { describe, it, expect, beforeEach } from 'vitest';
import { SfxManager } from '../../src/audio/SfxManager';
import { SFX_KEYS } from '../../src/data/audio';

const MUTE_STORAGE_KEY = 'pixel-squad:sfxMuted';

// Mock localStorage for Node environment
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  length: 0,
  key: () => null,
} as unknown as Storage;

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

class FakeSoundManager {
  mute = false;
  playCalls: string[] = [];
  play(key: string): void {
    this.playCalls.push(key);
  }
}

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

describe('SfxManager default state', () => {
  it('is unmuted by default when localStorage has no entry', () => {
    const sound = new FakeSoundManager();
    const manager = new SfxManager(sound as never);
    expect(manager.isMuted()).toBe(false);
    expect(sound.mute).toBe(false);
  });

  it('reads persisted mute state from localStorage on construction', () => {
    store[MUTE_STORAGE_KEY] = 'true';
    const sound = new FakeSoundManager();
    const manager = new SfxManager(sound as never);
    expect(manager.isMuted()).toBe(true);
    expect(sound.mute).toBe(true);
  });
});

describe('SfxManager.toggleMute', () => {
  it('flips muted state and persists it to localStorage', () => {
    const sound = new FakeSoundManager();
    const manager = new SfxManager(sound as never);

    const nowMuted = manager.toggleMute();

    expect(nowMuted).toBe(true);
    expect(manager.isMuted()).toBe(true);
    expect(sound.mute).toBe(true);
    expect(store[MUTE_STORAGE_KEY]).toBe('true');
  });

  it('persists across separate SfxManager instances (simulating reload)', () => {
    const firstSound = new FakeSoundManager();
    const firstManager = new SfxManager(firstSound as never);
    firstManager.toggleMute();

    const secondSound = new FakeSoundManager();
    const secondManager = new SfxManager(secondSound as never);

    expect(secondManager.isMuted()).toBe(true);
    expect(secondSound.mute).toBe(true);
  });

  it('is independent of any save-slot data (no GameState involved)', () => {
    const sound = new FakeSoundManager();
    const manager = new SfxManager(sound as never);
    manager.toggleMute();

    expect(Object.keys(store)).toEqual([MUTE_STORAGE_KEY]);
  });
});

describe('SfxManager.play', () => {
  it('forwards a named cue to the underlying sound manager', () => {
    const sound = new FakeSoundManager();
    const manager = new SfxManager(sound as never);

    manager.play(SFX_KEYS.hit);

    expect(sound.playCalls).toEqual([SFX_KEYS.hit]);
  });

  it('does not throw when playing while muted', () => {
    const sound = new FakeSoundManager();
    const manager = new SfxManager(sound as never);
    manager.toggleMute();

    expect(() => manager.play(SFX_KEYS.buttonClick)).not.toThrow();
  });

  it('issues a separate play call for each overlapping trigger (no cutoff)', () => {
    const sound = new FakeSoundManager();
    const manager = new SfxManager(sound as never);

    manager.play(SFX_KEYS.hit);
    manager.play(SFX_KEYS.hit);

    expect(sound.playCalls).toEqual([SFX_KEYS.hit, SFX_KEYS.hit]);
  });

  it('does not throw when the underlying sound manager has no matching key (missing asset)', () => {
    const sound = new FakeSoundManager();
    sound.play = () => {
      // Phaser logs a console warning and no-ops for a missing key
    };
    const manager = new SfxManager(sound as never);

    expect(() => manager.play(SFX_KEYS.victory)).not.toThrow();
  });
});

describe('SfxManager.preload', () => {
  it('queues every SFX asset for loading via scene.load.audio', () => {
    const loadedKeys: string[] = [];
    const fakeScene = {
      load: {
        audio: (key: string, _path: string) => {
          loadedKeys.push(key);
        },
      },
    };

    SfxManager.preload(fakeScene as never);

    expect(loadedKeys).toContain(SFX_KEYS.attack);
    expect(loadedKeys).toContain(SFX_KEYS.victory);
    expect(loadedKeys).toContain(SFX_KEYS.defeat);
    expect(loadedKeys.length).toBe(Object.keys(SFX_KEYS).length);
  });
});
