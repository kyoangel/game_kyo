import { describe, it, expect } from 'vitest';
import { STAGES } from '../../src/data/stages';

describe('side quest itemRewards data', () => {
  it('SQ-1 grants one scroll_overdrive on first clear', () => {
    const sq1 = STAGES.find(s => s.id === 'SQ-1')!;
    expect(sq1.itemRewards).toEqual([{ itemId: 'scroll_overdrive', quantity: 1 }]);
  });

  it('SQ-2 grants two supply_nano_kit on first clear', () => {
    const sq2 = STAGES.find(s => s.id === 'SQ-2')!;
    expect(sq2.itemRewards).toEqual([{ itemId: 'supply_nano_kit', quantity: 2 }]);
  });

  it('SQ-3 grants one scroll_field_medic and one supply_nano_kit on first clear', () => {
    const sq3 = STAGES.find(s => s.id === 'SQ-3')!;
    expect(sq3.itemRewards).toEqual([
      { itemId: 'scroll_field_medic', quantity: 1 },
      { itemId: 'supply_nano_kit', quantity: 1 },
    ]);
  });

  it('no story stage (isSideQuest: false, isHidden: false) defines itemRewards', () => {
    const offenders = STAGES.filter(s => !s.isSideQuest && !s.isHidden && s.itemRewards);
    expect(offenders.map(s => s.id)).toEqual([]);
  });

  it('every side quest stage defines at least one itemReward', () => {
    STAGES.filter(s => s.isSideQuest).forEach(s => {
      expect(s.itemRewards?.length, `${s.id} missing itemRewards`).toBeGreaterThan(0);
    });
  });
});
