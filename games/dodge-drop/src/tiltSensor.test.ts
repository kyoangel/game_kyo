import { describe, expect, it } from 'vitest';
import { detectTilt, requestTilt, type TiltEnv } from './tiltSensor.ts';

type Listener = (e: { gamma: number | null }) => void;
function fakeEnv(opts: { coarse?: boolean; hasEvent?: boolean; permission?: 'granted' | 'denied' | 'none'; events?: Array<number | null>; afterGrant?: Array<number | null> }): TiltEnv & { fire(g: number | null): void } {
  const ls = new Set<Listener>();
  let granted = opts.permission === 'none' || opts.permission === undefined;
  const env = {
    coarsePointer: opts.coarse ?? true,
    hasOrientationEvent: opts.hasEvent ?? true,
    requestPermission: opts.permission && opts.permission !== 'none' ? async () => { granted = opts.permission === 'granted'; if (granted) for (const g of opts.afterGrant ?? []) setTimeout(() => env.fire(g), 5); return opts.permission as 'granted' | 'denied'; } : undefined,
    listen(fn: Listener) { ls.add(fn); for (const g of opts.events ?? []) if (granted) setTimeout(() => fn({ gamma: g }), 5); return () => ls.delete(fn); },
    fire(g: number | null) { for (const l of ls) l({ gamma: g }); },
    timeoutMs: 40,
  };
  return env;
}

describe('detectTilt', () => {
  it('hides on non-touch devices and when the API is missing', async () => {
    expect((await detectTilt(fakeEnv({ coarse: false, events: [5] }))).available).toBe(false);
    expect((await detectTilt(fakeEnv({ hasEvent: false, events: [5] }))).available).toBe(false);
  });
  it('shows when a non-null gamma arrives in time (Android style)', async () => {
    expect(await detectTilt(fakeEnv({ events: [null, 4] }))).toEqual({ available: true, needsPermission: false });
  });
  it('hides when only null gamma (no sensor) or nothing arrives', async () => {
    expect((await detectTilt(fakeEnv({ events: [null] }))).available).toBe(false);
    expect((await detectTilt(fakeEnv({ events: [] }))).available).toBe(false);
  });
  it('shows with needsPermission on iOS style requestPermission without firing events yet', async () => {
    expect(await detectTilt(fakeEnv({ permission: 'granted', events: [3] }))).toEqual({ available: true, needsPermission: true });
  });
});

describe('requestTilt', () => {
  it('fails on denial', async () => {
    expect(await requestTilt(fakeEnv({ permission: 'denied' }))).toBe(false);
  });
  it('succeeds when granted and events then flow', async () => {
    expect(await requestTilt(fakeEnv({ permission: 'granted', afterGrant: [2] }))).toBe(true);
  });
  it('fails when granted but no events arrive within the timeout', async () => {
    expect(await requestTilt(fakeEnv({ permission: 'granted', afterGrant: [] }))).toBe(false);
  });
  it('without a permission API, succeeds iff events arrive', async () => {
    expect(await requestTilt(fakeEnv({ events: [1] }))).toBe(true);
    expect(await requestTilt(fakeEnv({ events: [] }))).toBe(false);
  });
});
