// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdEvents } from './adEvents.ts';
import { createIntervalGate } from './intervalGate.ts';
import { createSafeLocalStorage } from './storage.ts';

afterEach(() => vi.unstubAllGlobals());

describe('createSafeLocalStorage', () => {
  it('prefixes keys in localStorage', async () => {
    const s = createSafeLocalStorage('gk:');
    await s.set('a', '1');
    expect(localStorage.getItem('gk:a')).toBe('1');
    expect(await s.get('a')).toBe('1');
  });

  it('returns null for missing keys', async () => {
    expect(await createSafeLocalStorage('gk:').get(`missing-${Math.random()}`)).toBeNull();
  });

  it('falls back to memory when localStorage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
    });
    const s = createSafeLocalStorage('gk:');
    await s.set('b', '2');
    expect(await s.get('b')).toBe('2');
  });
});

describe('createAdEvents', () => {
  it('notifies listeners and survives a throwing listener', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ev = createAdEvents();
    const log: string[] = [];
    ev.onPause(() => { throw new Error('boom'); });
    ev.onPause(() => log.push('pause'));
    ev.onResume(() => log.push('resume'));
    ev.emitPause();
    ev.emitResume();
    expect(log).toEqual(['pause', 'resume']);
    expect(errSpy).toHaveBeenCalledOnce();
    errSpy.mockRestore();
  });
});

describe('createIntervalGate', () => {
  it('passes first call, blocks within interval, passes after', () => {
    let t = 1000;
    const gate = createIntervalGate(500, () => t);
    expect(gate.tryPass()).toBe(true);
    t = 1400;
    expect(gate.tryPass()).toBe(false);
    t = 1500;
    expect(gate.tryPass()).toBe(true);
  });

  it('with 0 interval always passes', () => {
    const gate = createIntervalGate(0, () => 5);
    expect(gate.tryPass()).toBe(true);
    expect(gate.tryPass()).toBe(true);
  });
});
