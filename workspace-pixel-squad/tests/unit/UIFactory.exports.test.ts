/**
 * AC-11: UIFactory usage
 * All UI chrome (panels, buttons, HP bars) must go through UIFactory helpers.
 * This test verifies the factory module exports the required named functions
 * so scenes can use them instead of ad-hoc scene.add.rectangle calls.
 */
import { describe, it, expect } from 'vitest';
import * as UIFactory from '../../src/ui/UIFactory';

describe('UIFactory named exports', () => {
  it('exports makePanel as a function', () => {
    expect(typeof UIFactory.makePanel).toBe('function');
  });

  it('exports makeButton as a function', () => {
    expect(typeof UIFactory.makeButton).toBe('function');
  });

  it('exports makeHPBar as a function', () => {
    expect(typeof UIFactory.makeHPBar).toBe('function');
  });

  it('exports makeArchetypeBadge as a function', () => {
    expect(typeof UIFactory.makeArchetypeBadge).toBe('function');
  });

  it('exports makeBuffSlots as a function', () => {
    expect(typeof UIFactory.makeBuffSlots).toBe('function');
  });

  it('exports fadeIn as a function', () => {
    expect(typeof UIFactory.fadeIn).toBe('function');
  });

  it('exports fadeOut as a function', () => {
    expect(typeof UIFactory.fadeOut).toBe('function');
  });
});

describe('makeHPBar color thresholds', () => {
  it('exports HP_PCT_MID threshold (boundary between high and mid bar color)', async () => {
    const { HP_PCT_MID } = await import('../../src/ui/UIFactory');
    expect(typeof HP_PCT_MID).toBe('number');
    expect(HP_PCT_MID).toBeGreaterThan(0);
    expect(HP_PCT_MID).toBeLessThan(1);
  });

  it('exports HP_PCT_LOW threshold (boundary between mid and low bar color)', async () => {
    const { HP_PCT_LOW } = await import('../../src/ui/UIFactory');
    expect(typeof HP_PCT_LOW).toBe('number');
    expect(HP_PCT_LOW).toBeGreaterThan(0);
    expect(HP_PCT_LOW).toBeLessThan(1);
  });
});

describe('resolveHPBarColor (pure color-picker helper)', () => {
  it('returns HP_HIGH color when pct > HP_PCT_MID', async () => {
    const { resolveHPBarColor } = await import('../../src/ui/UIFactory');
    const color = resolveHPBarColor(0.9);
    expect(color).toBe(0x48bb78); // HP_HIGH
  });

  it('returns HP_MID color when pct is between HP_PCT_LOW and HP_PCT_MID', async () => {
    const { resolveHPBarColor, HP_PCT_MID, HP_PCT_LOW } = await import('../../src/ui/UIFactory');
    const midPct = (HP_PCT_MID + HP_PCT_LOW) / 2;
    const color = resolveHPBarColor(midPct);
    expect(color).toBe(0xed8936); // HP_MID
  });

  it('returns HP_LOW color when pct <= HP_PCT_LOW', async () => {
    const { resolveHPBarColor } = await import('../../src/ui/UIFactory');
    const color = resolveHPBarColor(0.1);
    expect(color).toBe(0xe53e3e); // HP_LOW
  });
});

describe('makeButton variant mapping', () => {
  it('exports a pure helper resolveButtonFill(variant) for each button variant', async () => {
    const { resolveButtonFill } = await import('../../src/ui/UIFactory');
    expect(resolveButtonFill('active')).toBe(0x276749);   // BUTTON_ACTIVE
    expect(resolveButtonFill('idle')).toBe(0x2d3748);     // BUTTON_IDLE
    expect(resolveButtonFill('danger')).toBe(0x742a2a);   // BUTTON_DANGER
    expect(resolveButtonFill('disabled')).toBe(0x2d3748); // BUTTON_IDLE (greyed out)
  });
});
