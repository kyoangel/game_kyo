import { describe, it, expect } from 'vitest';
import {
  SPRITE_KEYS,
  SPRITE_SHEET_ASSETS,
  LPC_DIRECTION_ROW,
  lpcRowFrameRange,
} from '../../src/data/sprites';

describe('SPRITE_KEYS', () => {
  it('defines the 4 protagonist LPC per-animation sheet keys', () => {
    expect(SPRITE_KEYS.protagonistWalkSheet).toBe('protagonist_lpc_walk');
    expect(SPRITE_KEYS.protagonistSlashSheet).toBe('protagonist_lpc_slash');
    expect(SPRITE_KEYS.protagonistHurtSheet).toBe('protagonist_lpc_hurt');
    expect(SPRITE_KEYS.protagonistIdleSheet).toBe('protagonist_lpc_idle');
  });
});

describe('SPRITE_SHEET_ASSETS — protagonist LPC per-animation sheets', () => {
  it('registers all 4 sheets at 64×64 frames under public/sprites/party-lpc/protagonist', () => {
    const expected: Record<string, string> = {
      [SPRITE_KEYS.protagonistWalkSheet]: 'sprites/party-lpc/protagonist/walk.png',
      [SPRITE_KEYS.protagonistSlashSheet]: 'sprites/party-lpc/protagonist/slash.png',
      [SPRITE_KEYS.protagonistHurtSheet]: 'sprites/party-lpc/protagonist/hurt.png',
      [SPRITE_KEYS.protagonistIdleSheet]: 'sprites/party-lpc/protagonist/idle.png',
    };
    for (const [key, path] of Object.entries(expected)) {
      const asset = SPRITE_SHEET_ASSETS[key as keyof typeof SPRITE_SHEET_ASSETS];
      expect(asset.path).toBe(path);
      expect(asset.frameWidth).toBe(64);
      expect(asset.frameHeight).toBe(64);
    }
  });
});

describe('LPC_DIRECTION_ROW', () => {
  it('matches the fixed LPC row order: up, left, down, right', () => {
    expect(LPC_DIRECTION_ROW).toEqual({ up: 0, left: 1, down: 2, right: 3 });
  });
});

describe('lpcRowFrameRange', () => {
  it('row 0 (up), 9 frames → start 0, end 8', () => {
    expect(lpcRowFrameRange(LPC_DIRECTION_ROW.up, 9)).toEqual({ start: 0, end: 8 });
  });

  it('row 3 (right), 9 frames (walk) → start 39, end 47', () => {
    expect(lpcRowFrameRange(LPC_DIRECTION_ROW.right, 9)).toEqual({ start: 39, end: 47 });
  });

  it('row 1 (left), 6 frames (slash) → start 13, end 18', () => {
    expect(lpcRowFrameRange(LPC_DIRECTION_ROW.left, 6)).toEqual({ start: 13, end: 18 });
  });

  it('row 2 (down), 2 frames (idle) → start 26, end 27', () => {
    expect(lpcRowFrameRange(LPC_DIRECTION_ROW.down, 2)).toEqual({ start: 26, end: 27 });
  });

  it('defaults to 13 columns per row (LPC standard), overridable via 3rd arg', () => {
    expect(lpcRowFrameRange(1, 3, 10)).toEqual({ start: 10, end: 12 });
  });
});
