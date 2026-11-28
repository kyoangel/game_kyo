import { describe, expect, it } from 'vitest';
import { strings } from './strings.ts';
import { MAX_LEVEL, UPGRADE_IDS } from './workshop.ts';
import { upgradeDesc } from './upgradeDesc.ts';
import { createI18n } from '../../../packages/game-kit/src/i18n.ts';
import { MISSION_POOL } from './missions.ts';

describe('dodge-drop strings', () => {
  it('en and zh-TW define the same keys', () => {
    expect(Object.keys(strings['zh-TW']!).sort()).toEqual(Object.keys(strings.en!).sort());
  });
  it('has name, desc and mission template for every id', () => {
    for (const id of UPGRADE_IDS) {
      expect(strings.en![`up.${id}.name`]).toBeTruthy();
      expect(strings.en![`up.${id}.desc`]).toBeTruthy();
      // Results "next goal" line names the upgrade with upgrade.<id> (missing key showed the raw key, v3.11.0).
      expect(strings.en![`upgrade.${id}`]).toBeTruthy();
    }
    for (const d of MISSION_POOL) expect(strings.en![`mission.${d.id}`]).toContain('{t}');
  });
  it('shop descriptions never show a zero effect and preview the next level', () => {
    for (const loc of ['en', 'zh-TW']) {
      const t = createI18n(strings, loc);
      for (const id of UPGRADE_IDS) {
        for (let level = 0; level <= MAX_LEVEL; level++) {
          const d = upgradeDesc(t, id, level);
          expect(d, `${loc} ${id} L${level}`).not.toMatch(/\b0 ?(px|%)|(^|[^\d.])0% /);
          expect(d).not.toContain('{');
        }
      }
      expect(upgradeDesc(t, 'magnet', 0)).toContain('80');
      expect(upgradeDesc(t, 'luck', 0)).toContain('7%');
      expect(upgradeDesc(t, 'startShield', 0)).toContain('20%');
      expect(upgradeDesc(t, 'magnet', 4)).not.toContain('Infinity');
      // maxed: current effect, no "next" prefix
      expect(upgradeDesc(t, 'luck', MAX_LEVEL)).toContain('35%');
      expect(upgradeDesc(t, 'luck', MAX_LEVEL)).not.toBe(upgradeDesc(t, 'luck', 0));
    }
    const en = createI18n(strings, 'en');
    expect(upgradeDesc(en, 'magnet', 0)).toBe('Next: pulls stars & shields within 80\u00a0px');
  });
});
