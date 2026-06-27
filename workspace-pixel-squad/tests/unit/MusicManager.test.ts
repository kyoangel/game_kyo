import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MusicManager, getMusic } from '../../src/audio/MusicManager';
import { MUSIC_KEYS, MUSIC_ASSETS, MUSIC_VOLUME, MUSIC_FADE_MS } from '../../src/data/audio';

const MUTE_STORAGE_KEY = 'pixel-squad:musicMuted';

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

class FakeSound {
  key: string;
  loop: boolean;
  volume: number;
  playCalls = 0;
  stopCalls = 0;
  destroyed = false;

  constructor(key: string, config: { loop?: boolean; volume?: number } = {}) {
    this.key = key;
    this.loop = !!config.loop;
    this.volume = config.volume ?? 1;
  }

  play(): void {
    this.playCalls += 1;
  }

  stop(): void {
    this.stopCalls += 1;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeSoundManager {
  mute = false;
  added: FakeSound[] = [];

  add(key: string, config?: { loop?: boolean; volume?: number }): FakeSound {
    const sound = new FakeSound(key, config);
    this.added.push(sound);
    return sound;
  }
}

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MusicManager default state', () => {
  it('is unmuted by default when localStorage has no entry', () => {
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);
    expect(manager.isMuted()).toBe(false);
  });

  it('reads persisted mute state from localStorage on construction', () => {
    store[MUTE_STORAGE_KEY] = 'true';
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);
    expect(manager.isMuted()).toBe(true);
  });

  it('never mutates the shared sound manager mute flag (independent from SFX)', () => {
    store[MUTE_STORAGE_KEY] = 'true';
    const sound = new FakeSoundManager();
    new MusicManager(sound as never); // eslint-disable-line no-new
    expect(sound.mute).toBe(false);
  });
});

describe('MusicManager.playTrack — track changes', () => {
  it('starts a new looping track at MUSIC_VOLUME when nothing was previously playing', () => {
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);

    manager.playTrack(MUSIC_KEYS.title);

    const created = sound.added.find((s) => s.key === MUSIC_KEYS.title);
    expect(created).toBeDefined();
    expect(created?.loop).toBe(true);
    expect(created?.playCalls).toBeGreaterThan(0);
    expect(created?.volume).toBe(MUSIC_VOLUME);
  });

  it('starts a new track at volume 0 when music is muted', () => {
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);
    manager.toggleMute();

    manager.playTrack(MUSIC_KEYS.title);

    const created = sound.added.find((s) => s.key === MUSIC_KEYS.title);
    expect(created?.volume).toBe(0);
  });

  it('is a no-op when requesting the track that is already playing (no restart)', () => {
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);

    manager.playTrack(MUSIC_KEYS.theme);
    const firstInstanceCount = sound.added.length;
    const playCallsAfterFirst = sound.added[0].playCalls;

    manager.playTrack(MUSIC_KEYS.theme);

    expect(sound.added.length).toBe(firstInstanceCount);
    expect(sound.added[0].playCalls).toBe(playCallsAfterFirst);
    expect(sound.added[0].stopCalls).toBe(0);
    expect(sound.added[0].destroyed).toBe(false);
  });

  it('crossfades to a new track: old fades out and is destroyed, new fades in, only one survives', () => {
    vi.useFakeTimers();
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);

    manager.playTrack(MUSIC_KEYS.theme);
    const themeSound = sound.added[0];

    manager.playTrack(MUSIC_KEYS.battle);
    const battleSound = sound.added.find((s) => s.key === MUSIC_KEYS.battle)!;

    vi.advanceTimersByTime(MUSIC_FADE_MS);

    expect(themeSound.destroyed).toBe(true);
    expect(battleSound.destroyed).toBe(false);
    expect(battleSound.volume).toBeCloseTo(MUSIC_VOLUME, 5);

    const aliveSounds = sound.added.filter((s) => !s.destroyed);
    expect(aliveSounds).toHaveLength(1);
    expect(aliveSounds[0]).toBe(battleSound);
  });
});

describe('MusicManager — non-looping stingers', () => {
  it('plays the victory stinger without looping', () => {
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);

    manager.playTrack(MUSIC_KEYS.victory);

    const created = sound.added.find((s) => s.key === MUSIC_KEYS.victory);
    expect(created?.loop).toBe(false);
  });

  it('plays the defeat stinger without looping', () => {
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);

    manager.playTrack(MUSIC_KEYS.defeat);

    const created = sound.added.find((s) => s.key === MUSIC_KEYS.defeat);
    expect(created?.loop).toBe(false);
  });

  it('treats a track requested after a stinger as a real track change (theme resumes after victory)', () => {
    vi.useFakeTimers();
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);

    manager.playTrack(MUSIC_KEYS.theme);
    manager.playTrack(MUSIC_KEYS.victory);
    manager.playTrack(MUSIC_KEYS.theme);
    vi.advanceTimersByTime(MUSIC_FADE_MS * 3);

    const themeInstances = sound.added.filter((s) => s.key === MUSIC_KEYS.theme);
    // theme was started fresh again after the victory stinger, not treated as a no-op
    expect(themeInstances).toHaveLength(2);
    const aliveSounds = sound.added.filter((s) => !s.destroyed);
    expect(aliveSounds).toHaveLength(1);
    expect(aliveSounds[0].key).toBe(MUSIC_KEYS.theme);
  });
});

describe('MusicManager.toggleMute', () => {
  it('flips muted state and persists it to localStorage under its own key', () => {
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);

    const nowMuted = manager.toggleMute();

    expect(nowMuted).toBe(true);
    expect(manager.isMuted()).toBe(true);
    expect(store[MUTE_STORAGE_KEY]).toBe('true');
  });

  it('never writes to the SFX mute storage key', () => {
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);
    manager.toggleMute();

    expect(store['pixel-squad:sfxMuted']).toBeUndefined();
  });

  it('never mutates the shared sound manager mute flag when toggled', () => {
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);

    manager.toggleMute();

    expect(sound.mute).toBe(false);
  });

  it('persists across separate MusicManager instances (simulating reload)', () => {
    const firstSound = new FakeSoundManager();
    const firstManager = new MusicManager(firstSound as never);
    firstManager.toggleMute();

    const secondSound = new FakeSoundManager();
    const secondManager = new MusicManager(secondSound as never);

    expect(secondManager.isMuted()).toBe(true);
  });

  it('silences the currently playing track in-place without restarting it', () => {
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);
    manager.playTrack(MUSIC_KEYS.theme);
    const playCallsBefore = sound.added[0].playCalls;

    manager.toggleMute();

    expect(sound.added).toHaveLength(1);
    expect(sound.added[0].playCalls).toBe(playCallsBefore);
    expect(sound.added[0].volume).toBe(0);
  });

  it('restores the target volume of the currently playing track when unmuted', () => {
    const sound = new FakeSoundManager();
    const manager = new MusicManager(sound as never);
    manager.playTrack(MUSIC_KEYS.theme);

    manager.toggleMute();
    manager.toggleMute();

    expect(sound.added[0].volume).toBe(MUSIC_VOLUME);
  });
});

describe('MusicManager.preload', () => {
  it('queues every music asset for loading via scene.load.audio', () => {
    const loadedKeys: string[] = [];
    const fakeScene = {
      load: {
        audio: (key: string, _path: string) => {
          loadedKeys.push(key);
        },
      },
    };

    MusicManager.preload(fakeScene as never);

    Object.keys(MUSIC_ASSETS).forEach((key) => {
      expect(loadedKeys).toContain(key);
    });
    expect(loadedKeys.length).toBe(Object.keys(MUSIC_ASSETS).length);
  });
});

describe('getMusic', () => {
  it('registers a single MusicManager instance in the game registry under "music"', () => {
    const registryStore = new Map<string, unknown>();
    const fakeScene = {
      sound: new FakeSoundManager(),
      game: {
        registry: {
          has: (key: string) => registryStore.has(key),
          set: (key: string, value: unknown) => registryStore.set(key, value),
          get: (key: string) => registryStore.get(key),
        },
      },
    };

    const first = getMusic(fakeScene as never);
    const second = getMusic(fakeScene as never);

    expect(first).toBeInstanceOf(MusicManager);
    expect(first).toBe(second);
  });
});
