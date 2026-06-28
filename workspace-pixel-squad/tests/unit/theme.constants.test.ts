/**
 * AC-1: Theme constants
 * All palette values and text style presets must be exported from src/ui/theme.ts
 * with the exact hex/string values specified in the spec.
 */
import { describe, it, expect } from 'vitest';
import { Colors, TextStyles } from '../../src/ui/theme';

describe('Colors palette', () => {
  it('BG_DARK is 0x0d1117', () => {
    expect(Colors.BG_DARK).toBe(0x0d1117);
  });

  it('BG_MID is 0x1c2333', () => {
    expect(Colors.BG_MID).toBe(0x1c2333);
  });

  it('BG_LIGHT is 0x2d3748', () => {
    expect(Colors.BG_LIGHT).toBe(0x2d3748);
  });

  it('BORDER_DIM is 0x4a5568', () => {
    expect(Colors.BORDER_DIM).toBe(0x4a5568);
  });

  it('BORDER_LIT is 0x68d391 (active/selected green)', () => {
    expect(Colors.BORDER_LIT).toBe(0x68d391);
  });

  it('BORDER_WARN is 0xf6ad55 (warning — low HP / cooldown)', () => {
    expect(Colors.BORDER_WARN).toBe(0xf6ad55);
  });

  it('TEXT_PRIMARY is 0xe2e8f0', () => {
    expect(Colors.TEXT_PRIMARY).toBe(0xe2e8f0);
  });

  it('TEXT_DIM is 0x718096', () => {
    expect(Colors.TEXT_DIM).toBe(0x718096);
  });

  it('TEXT_ACCENT is 0x68d391 (green — EXP / regen / success)', () => {
    expect(Colors.TEXT_ACCENT).toBe(0x68d391);
  });

  it('TEXT_GOLD is 0xf6e05e', () => {
    expect(Colors.TEXT_GOLD).toBe(0xf6e05e);
  });

  it('TEXT_RED is 0xfc8181 (damage / danger)', () => {
    expect(Colors.TEXT_RED).toBe(0xfc8181);
  });

  it('TEXT_PURPLE is 0xb794f4 (skill cost / archetype)', () => {
    expect(Colors.TEXT_PURPLE).toBe(0xb794f4);
  });

  it('BUTTON_IDLE is 0x2d3748', () => {
    expect(Colors.BUTTON_IDLE).toBe(0x2d3748);
  });

  it('BUTTON_HOVER is 0x4a5568', () => {
    expect(Colors.BUTTON_HOVER).toBe(0x4a5568);
  });

  it('BUTTON_ACTIVE is 0x276749', () => {
    expect(Colors.BUTTON_ACTIVE).toBe(0x276749);
  });

  it('BUTTON_DANGER is 0x742a2a', () => {
    expect(Colors.BUTTON_DANGER).toBe(0x742a2a);
  });

  it('HP_HIGH is 0x48bb78', () => {
    expect(Colors.HP_HIGH).toBe(0x48bb78);
  });

  it('HP_MID is 0xed8936', () => {
    expect(Colors.HP_MID).toBe(0xed8936);
  });

  it('HP_LOW is 0xe53e3e', () => {
    expect(Colors.HP_LOW).toBe(0xe53e3e);
  });

  describe('ARCHETYPE badge colors', () => {
    it('坦克 is 0x3182ce (blue)', () => {
      expect(Colors.ARCHETYPE['坦克']).toBe(0x3182ce);
    });

    it('輸出 is 0xe53e3e (red)', () => {
      expect(Colors.ARCHETYPE['輸出']).toBe(0xe53e3e);
    });

    it('狙擊 is 0xd69e2e (gold)', () => {
      expect(Colors.ARCHETYPE['狙擊']).toBe(0xd69e2e);
    });

    it('輔助 is 0x68d391 (green)', () => {
      expect(Colors.ARCHETYPE['輔助']).toBe(0x68d391);
    });

    it('全能 is 0xb794f4 (purple)', () => {
      expect(Colors.ARCHETYPE['全能']).toBe(0xb794f4);
    });
  });
});

describe('TextStyles presets', () => {
  it('TITLE_LG uses 20px monospace and TEXT_PRIMARY color', () => {
    expect(TextStyles.TITLE_LG.fontFamily).toBe('monospace');
    expect(TextStyles.TITLE_LG.fontSize).toBe('20px');
    expect(TextStyles.TITLE_LG.color).toBe('#e2e8f0');
  });

  it('TITLE_MD uses 16px monospace', () => {
    expect(TextStyles.TITLE_MD.fontSize).toBe('16px');
  });

  it('BODY uses 12px monospace', () => {
    expect(TextStyles.BODY.fontSize).toBe('12px');
    expect(TextStyles.BODY.fontFamily).toBe('monospace');
  });

  it('LABEL uses 10px and TEXT_DIM color', () => {
    expect(TextStyles.LABEL.fontSize).toBe('10px');
    expect(TextStyles.LABEL.color).toBe('#718096');
  });

  it('ACCENT uses green color (#68d391)', () => {
    expect(TextStyles.ACCENT.color).toBe('#68d391');
  });

  it('GOLD uses gold color (#f6e05e)', () => {
    expect(TextStyles.GOLD.color).toBe('#f6e05e');
  });

  it('DAMAGE uses 14px red (#fc8181)', () => {
    expect(TextStyles.DAMAGE.fontSize).toBe('14px');
    expect(TextStyles.DAMAGE.color).toBe('#fc8181');
  });

  it('HEAL uses 14px green (#68d391)', () => {
    expect(TextStyles.HEAL.fontSize).toBe('14px');
    expect(TextStyles.HEAL.color).toBe('#68d391');
  });
});
