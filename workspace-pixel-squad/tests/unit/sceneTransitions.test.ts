/**
 * AC-8: Scene fade transitions
 * Every scene exit fades to black in 200ms before scene.start().
 * Every scene entry fades from black in 300ms (alpha 1→0).
 */
import { describe, it, expect } from 'vitest';
import { FADE_IN_DURATION_MS, FADE_OUT_DURATION_MS } from '../../src/ui/sceneTransitions';

describe('scene transition durations', () => {
  it('fade-in duration is 300ms', () => {
    expect(FADE_IN_DURATION_MS).toBe(300);
  });

  it('fade-out duration is 200ms', () => {
    expect(FADE_OUT_DURATION_MS).toBe(200);
  });

  it('fade-in is longer than fade-out (entering feels slower than leaving)', () => {
    expect(FADE_IN_DURATION_MS).toBeGreaterThan(FADE_OUT_DURATION_MS);
  });
});

describe('buildFadeInConfig', () => {
  it('produces a config starting at alpha=1 ending at alpha=0', async () => {
    const { buildFadeInConfig } = await import('../../src/ui/sceneTransitions');
    const cfg = buildFadeInConfig();
    expect(cfg.alphaFrom).toBe(1);
    expect(cfg.alphaTo).toBe(0);
  });

  it('duration equals FADE_IN_DURATION_MS', async () => {
    const { buildFadeInConfig } = await import('../../src/ui/sceneTransitions');
    const cfg = buildFadeInConfig();
    expect(cfg.duration).toBe(300);
  });

  it('cover colour is black', async () => {
    const { buildFadeInConfig } = await import('../../src/ui/sceneTransitions');
    const cfg = buildFadeInConfig();
    expect(cfg.color).toBe(0x000000);
  });
});

describe('buildFadeOutConfig', () => {
  it('produces a config starting at alpha=0 ending at alpha=1 (going to black)', async () => {
    const { buildFadeOutConfig } = await import('../../src/ui/sceneTransitions');
    const cfg = buildFadeOutConfig();
    expect(cfg.alphaFrom).toBe(0);
    expect(cfg.alphaTo).toBe(1);
  });

  it('duration equals FADE_OUT_DURATION_MS', async () => {
    const { buildFadeOutConfig } = await import('../../src/ui/sceneTransitions');
    const cfg = buildFadeOutConfig();
    expect(cfg.duration).toBe(200);
  });
});
