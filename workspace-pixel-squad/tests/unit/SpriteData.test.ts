import { describe, it, expect } from 'vitest';
import { SPRITE_KEYS, SPRITE_ASSETS } from '../../src/data/sprites';

describe('SPRITE_KEYS', () => {
  it('defines a protagonistIdle key', () => {
    expect(SPRITE_KEYS.protagonistIdle).toBe('protagonist_idle');
  });
});

describe('SPRITE_ASSETS', () => {
  it('maps the protagonist idle key to its PNG path', () => {
    expect(SPRITE_ASSETS[SPRITE_KEYS.protagonistIdle]).toBe('sprites/character_rogue.png');
  });

  it('has no leading slash so it resolves relative to the public dir', () => {
    expect(SPRITE_ASSETS[SPRITE_KEYS.protagonistIdle].startsWith('/')).toBe(false);
  });
});
