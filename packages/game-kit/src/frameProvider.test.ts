import { describe, expect, it } from 'vitest';
import { resolveCanvasSize } from './frameProvider.ts';

const frames = (w: number, h: number) => ({ width: w, height: h });

describe('resolveCanvasSize', () => {
  it('falls back to the static size when no provider is given', () => {
    expect(resolveCanvasSize(undefined, { width: 720, height: 1280 }, 1920, 1080)).toEqual({ width: 720, height: 1280 });
  });
  it('asks the provider with the viewport', () => {
    const seen: number[] = [];
    const out = resolveCanvasSize((vw, vh) => { seen.push(vw, vh); return frames(1440, 810); }, { width: 720, height: 1280 }, 1920, 1080);
    expect(seen).toEqual([1920, 1080]);
    expect(out).toEqual({ width: 1440, height: 810 });
  });
  it('ignores a provider that returns nonsense', () => {
    expect(resolveCanvasSize(() => frames(0, -1), { width: 720, height: 1280 }, 100, 100)).toEqual({ width: 720, height: 1280 });
  });
});
