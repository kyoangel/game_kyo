import { describe, expect, it } from 'vitest';
import { fullscreenAvailable } from './fullscreenSupport.ts';

describe('fullscreenAvailable', () => {
  it('needs both the platform feature and browser support', () => {
    expect(fullscreenAvailable(true, { fullscreenEnabled: true })).toBe(true);
    expect(fullscreenAvailable(false, { fullscreenEnabled: true })).toBe(false);
    expect(fullscreenAvailable(true, { fullscreenEnabled: false })).toBe(false);
  });
  it('is hidden where the API is missing (iPhone Safari) or there is no document', () => {
    expect(fullscreenAvailable(true, {})).toBe(false);
    expect(fullscreenAvailable(true, undefined)).toBe(false);
  });
});
