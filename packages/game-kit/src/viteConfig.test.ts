import { describe, expect, it } from 'vitest';
import { availablePlatforms, createGameViteConfig, resolveAdapter } from '../vite-config.ts';

describe('vite-config', () => {
  it('lists implemented adapters', () => {
    expect(availablePlatforms()).toEqual(expect.arrayContaining(['local', 'site']));
    expect(availablePlatforms().some((p) => p.endsWith('.test'))).toBe(false);
  });

  it('throws on unknown or unsafe PLATFORM, listing valid values', () => {
    expect(() => resolveAdapter('poki')).toThrow(/Unknown PLATFORM "poki". Available: .*local/);
    expect(() => resolveAdapter('../types')).toThrow(/Unknown PLATFORM/);
  });

  it('aliases @platform/active and sets test hooks only for local', () => {
    const local = createGameViteConfig('/tmp/g', { PLATFORM: 'local' });
    const site = createGameViteConfig('/tmp/g', { PLATFORM: 'site', GAME_OUT_DIR: '/tmp/out' });
    const alias = (c: typeof local) => (c.resolve?.alias as Record<string, string>)['@platform/active'];
    expect(alias(local)).toMatch(/adapters\/local\.ts$/);
    expect(alias(site)).toMatch(/adapters\/site\.ts$/);
    expect(local.define?.__GK_TEST_HOOKS__).toBe('true');
    expect(site.define?.__GK_TEST_HOOKS__).toBe('false');
    expect(local.build?.outDir).toBe('/tmp/g/dist/local');
    expect(site.build?.outDir).toBe('/tmp/out');
    expect(site.base).toBe('./');
  });

  it('defaults PLATFORM to local', () => {
    expect(createGameViteConfig('/tmp/g', {}).define?.__GK_TEST_HOOKS__).toBe('true');
  });
});
