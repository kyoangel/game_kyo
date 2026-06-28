/**
 * AC-2: Battle — active character highlight
 * The active combatant's card must use BORDER_LIT; all others use BORDER_DIM.
 */
import { describe, it, expect } from 'vitest';
import { getCardBorderColor } from '../../src/ui/battleCardHighlight';

const BORDER_LIT = 0x68d391;
const BORDER_DIM = 0x4a5568;

describe('getCardBorderColor', () => {
  it('returns BORDER_LIT when character is the active combatant', () => {
    expect(getCardBorderColor('char-1', 'char-1')).toBe(BORDER_LIT);
  });

  it('returns BORDER_DIM for a character that is not the active combatant', () => {
    expect(getCardBorderColor('char-2', 'char-1')).toBe(BORDER_DIM);
  });

  it('returns BORDER_DIM when activeCharacterId is null (no one is acting)', () => {
    expect(getCardBorderColor('char-1', null)).toBe(BORDER_DIM);
  });

  it('returns BORDER_DIM when activeCharacterId is undefined', () => {
    expect(getCardBorderColor('char-1', undefined)).toBe(BORDER_DIM);
  });

  it('active border is exactly 2x brighter than dim — distinct colours', () => {
    expect(BORDER_LIT).not.toBe(BORDER_DIM);
  });
});

describe('getCardBorderWidth', () => {
  it('active character card border is 2px', async () => {
    const { getCardBorderWidth } = await import('../../src/ui/battleCardHighlight');
    expect(getCardBorderWidth('char-1', 'char-1')).toBe(2);
  });

  it('inactive character card border is 1px', async () => {
    const { getCardBorderWidth } = await import('../../src/ui/battleCardHighlight');
    expect(getCardBorderWidth('char-2', 'char-1')).toBe(1);
  });
});
