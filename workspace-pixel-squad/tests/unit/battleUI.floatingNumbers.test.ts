/**
 * AC-5: Battle — floating damage numbers
 * When an attack resolves, a floating number config is created at the target's
 * position and rises 30px over 600ms, fading from alpha 1 to 0.
 * Damage uses TEXT_RED colour; healing uses TEXT_ACCENT (green).
 */
import { describe, it, expect } from 'vitest';
import { createFloatingNumberConfig } from '../../src/ui/floatingNumbers';

const TEXT_RED    = 0xfc8181;
const TEXT_ACCENT = 0x68d391;

describe('createFloatingNumberConfig', () => {
  it('returns a config object with a text field showing the amount', () => {
    const cfg = createFloatingNumberConfig(42, false, 100, 200);
    expect(cfg.text).toContain('42');
  });

  it('damage numbers use TEXT_RED color', () => {
    const cfg = createFloatingNumberConfig(50, false, 0, 0);
    expect(cfg.color).toBe(TEXT_RED);
  });

  it('healing numbers use TEXT_ACCENT (green) color', () => {
    const cfg = createFloatingNumberConfig(20, true, 0, 0);
    expect(cfg.color).toBe(TEXT_ACCENT);
  });

  it('starting position matches the target x,y coordinates', () => {
    const cfg = createFloatingNumberConfig(10, false, 150, 320);
    expect(cfg.x).toBe(150);
    expect(cfg.y).toBe(320);
  });

  it('target y is 30px above the spawn y (float up 30px)', () => {
    const cfg = createFloatingNumberConfig(10, false, 0, 200);
    expect(cfg.targetY).toBe(200 - 30);
  });

  it('animation duration is 600ms', () => {
    const cfg = createFloatingNumberConfig(10, false, 0, 0);
    expect(cfg.duration).toBe(600);
  });

  it('alpha starts at 1 and ends at 0', () => {
    const cfg = createFloatingNumberConfig(10, false, 0, 0);
    expect(cfg.alphaFrom).toBe(1);
    expect(cfg.alphaTo).toBe(0);
  });

  it('miss result shows "MISS" text and uses TEXT_DIM color', async () => {
    const { createMissConfig } = await import('../../src/ui/floatingNumbers');
    const cfg = createMissConfig(100, 200);
    expect(cfg.text).toBe('MISS');
    const TEXT_DIM = 0x718096;
    expect(cfg.color).toBe(TEXT_DIM);
  });
});
