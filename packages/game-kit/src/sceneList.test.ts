import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));

import { sceneList } from './sceneList.ts';
import { Kit } from './kit.ts';
import { SaveData } from './save.ts';
import { resolveTheme } from './theme.ts';

class A {}
class B {}
class P {}
class X {}
class Y {}

describe('sceneList', () => {
  it('orders preload, title, play, extras, gameover', () => {
    const def = { playScene: P, scenes: [X, Y] } as never;
    expect(sceneList(def, { preload: A, title: B, gameOver: Object })).toEqual([A, B, P, X, Y, Object]);
  });
  it('works without extra scenes', () => {
    expect(sceneList({ playScene: P } as never, { preload: A, title: B, gameOver: X })).toEqual([A, B, P, X]);
  });
});

describe('Kit wiring', () => {
  it('exposes save, audio and resolved theme', () => {
    const m = new Map<string, string>();
    const save = new SaveData({ get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v) }, 'slug');
    const audio = {} as never;
    const kit = new Kit({} as never, {} as never, {} as never, (k) => k, { theme: { primary: 1 } } as never, save, audio);
    expect(kit.save).toBe(save);
    expect(kit.audio).toBe(audio);
    expect(kit.theme).toEqual(resolveTheme({ primary: 1 }));
  });
});
