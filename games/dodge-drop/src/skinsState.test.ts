import { describe, expect, it } from 'vitest';
import { skinAction } from './skinsState.ts';

describe('skinAction', () => {
  const owned = ['cyan', 'lime'];
  it('owned and not in use -> use', () => {
    expect(skinAction({ owned, inUse: 'cyan', coins: 0 }, 'lime')).toEqual({ kind: 'use' });
  });
  it('owned and in use -> inuse', () => {
    expect(skinAction({ owned, inUse: 'lime', coins: 0 }, 'lime')).toEqual({ kind: 'inuse' });
  });
  it('locked and affordable -> buy with cost', () => {
    expect(skinAction({ owned, inUse: 'cyan', coins: 60 }, 'orb')).toEqual({ kind: 'buy', cost: 60 });
  });
  it('locked and short -> poor with missing amount', () => {
    expect(skinAction({ owned, inUse: 'cyan', coins: 45 }, 'orb')).toEqual({ kind: 'poor', need: 15 });
  });
  it('unknown id -> inuse-like no-op', () => {
    expect(skinAction({ owned, inUse: 'cyan', coins: 999 }, 'nope')).toEqual({ kind: 'inuse' });
  });
});
