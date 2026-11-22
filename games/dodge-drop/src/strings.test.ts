import { describe, expect, it } from 'vitest';
import { strings } from './strings.ts';
import { UPGRADE_IDS } from './workshop.ts';
import { MISSION_POOL } from './missions.ts';

describe('dodge-drop strings', () => {
  it('en and zh-TW define the same keys', () => {
    expect(Object.keys(strings['zh-TW']!).sort()).toEqual(Object.keys(strings.en!).sort());
  });
  it('has name, desc and mission template for every id', () => {
    for (const id of UPGRADE_IDS) {
      expect(strings.en![`up.${id}.name`]).toBeTruthy();
      expect(strings.en![`up.${id}.desc`]).toBeTruthy();
    }
    for (const d of MISSION_POOL) expect(strings.en![`mission.${d.id}`]).toContain('{t}');
  });
});
