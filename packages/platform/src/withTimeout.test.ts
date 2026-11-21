import { describe, expect, it } from 'vitest';
import { withTimeout } from './withTimeout.ts';

describe('withTimeout', () => {
  it('resolves with the promise value when it settles first', async () => {
    expect(await withTimeout(Promise.resolve('ok'), 1000, 'fallback')).toBe('ok');
  });

  it('resolves the fallback when the promise never settles', async () => {
    expect(await withTimeout(new Promise<string>(() => {}), 10, 'fallback')).toBe('fallback');
  });

  it('propagates rejections', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'fallback')).rejects.toThrow('boom');
  });
});
