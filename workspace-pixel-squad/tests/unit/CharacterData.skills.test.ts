import { describe, it, expect } from 'vitest';
import { PLAYER_TEMPLATES } from '../../src/data/characters';

function templateById(id: string) {
  return PLAYER_TEMPLATES.find(t => t.id === id)!;
}

describe('PLAYER_TEMPLATES — support skill assignments', () => {
  it('mira has the field_medic heal skill', () => {
    expect(templateById('mira').skillIds).toContain('field_medic');
  });

  it('ash has the iron_will buff skill', () => {
    expect(templateById('ash').skillIds).toContain('iron_will');
  });

  it('vega has the combat_stim buff skill', () => {
    expect(templateById('vega').skillIds).toContain('combat_stim');
  });

  it('crow, zora, rook, dex, echo, aaaa remain without skills (out of scope)', () => {
    ['crow', 'zora', 'rook', 'dex', 'echo', 'aaaa'].forEach(id => {
      expect(templateById(id).skillIds).toEqual([]);
    });
  });
});
