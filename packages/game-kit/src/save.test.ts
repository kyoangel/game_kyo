import { describe, expect, it } from 'vitest';
import { SaveData } from './save.ts';

function fake() {
  const m = new Map<string, string>();
  return {
    m,
    storage: {
      get: async (k: string) => m.get(k) ?? null,
      set: async (k: string, v: string) => void m.set(k, v),
    },
  };
}

describe('SaveData', () => {
  it('uses <slug>:<key>', async () => {
    const f = fake();
    await new SaveData(f.storage, 'dodge-drop').setNumber('coins', 5);
    expect(f.m.get('dodge-drop:coins')).toBe('5');
  });
  it('getNumber falls back on missing / invalid', async () => {
    const f = fake();
    const s = new SaveData(f.storage, 'g');
    expect(await s.getNumber('a', 7)).toBe(7);
    f.m.set('g:a', 'abc');
    expect(await s.getNumber('a', 7)).toBe(7);
    f.m.set('g:a', 'Infinity');
    expect(await s.getNumber('a', 7)).toBe(7);
    f.m.set('g:a', '3');
    expect(await s.getNumber('a', 7)).toBe(3);
  });
  it('getJSON falls back on corrupt and round-trips', async () => {
    const f = fake();
    const s = new SaveData(f.storage, 'g');
    f.m.set('g:j', '{bad');
    expect(await s.getJSON('j', { z: 1 })).toEqual({ z: 1 });
    expect(await s.getJSON('missing', 'd')).toBe('d');
    await s.setJSON('j', { a: [1, 2] });
    expect(await s.getJSON('j', null)).toEqual({ a: [1, 2] });
  });
});
