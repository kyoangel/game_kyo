import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

// Bug report: after the portrait finally started loading (see the resized
// public/sprites/portraits/*.png fix), it visibly overflowed the top of
// PORTRAIT_WIN and overlapped portraitCaption at the bottom. Root cause:
// showPortrait() sized the image at a hardcoded 96x96 centered at
// PORTRAIT_WIN.y + 40, but PORTRAIT_WIN is only 104 tall with a 5px inner
// border on every side (windowFrameRects) and portraitCaption reserves a
// ~14px strip at the bottom — 96 didn't fit above the caption line, let
// alone within the window at all once you account for the border.

function extractConstNumber(source: string, name: string): number {
  const m = new RegExp(`const ${name}\\s*=\\s*(\\d+)`).exec(source);
  if (!m) throw new Error(`${name} not found as a numeric const in source`);
  return Number(m[1]);
}

function extractObjectField(source: string, constName: string, field: string): number {
  const m = new RegExp(`const ${constName}\\s*=\\s*\\{[^}]*\\b${field}:\\s*(\\d+)`).exec(source);
  if (!m) throw new Error(`${constName}.${field} not found`);
  return Number(m[1]);
}

describe('BattleScene portrait — image size fits inside PORTRAIT_WIN above the caption', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('showPortrait() no longer hardcodes the old 96x96 / 80x80 sizes', () => {
    const body = extractMethod(source, 'showPortrait');
    expect(body).not.toMatch(/setDisplaySize\(96,\s*96\)/);
    expect(body).not.toMatch(/this\.add\.rectangle\(cx,\s*cy,\s*80,\s*80/);
  });

  it('sizes both the real portrait and its silhouette fallback off the same PORTRAIT_IMAGE_SIZE constant', () => {
    const body = extractMethod(source, 'showPortrait');
    expect(body).toMatch(/setDisplaySize\(PORTRAIT_IMAGE_SIZE,\s*PORTRAIT_IMAGE_SIZE\)/);
    expect(body).toMatch(/this\.add\.rectangle\(cx,\s*cy,\s*PORTRAIT_IMAGE_SIZE,\s*PORTRAIT_IMAGE_SIZE/);
  });

  it('PORTRAIT_IMAGE_SIZE leaves room for the window border (5px/side) and the caption strip (~14px)', () => {
    const imageSize = extractConstNumber(source, 'PORTRAIT_IMAGE_SIZE');
    const winH = extractObjectField(source, 'PORTRAIT_WIN', 'h');
    // 10px = 5px inner border top + bottom, 14px = caption line + a little
    // breathing room — matches the reserved space showPortrait()'s cy
    // calculation and portraitCaption's fixed y actually leave available.
    expect(imageSize).toBeLessThanOrEqual(winH - 10 - 14);
  });

  it('keys the portrait off _monsterType whenever it is set, not just for non-player enemies', () => {
    // Bug: a recruited generic enemy (isPlayer: true, no PLAYER_TEMPLATES
    // entry — see CharacterFactory.enemyToPlayerCharacter) keeps its
    // original _monsterType but its templateId is the enemy's own id
    // (e.g. 'mutant_a'), which has no matching portrait file — only
    // per-monster-*type* portraits exist (portrait_demon.png etc.), not
    // per-specific-enemy-instance ones. The old
    // `char.isPlayer ? char.templateId : (char._monsterType ?? '')`
    // ternary always picked templateId for isPlayer characters, so a
    // recruited monster's portrait never resolved and fell back to the
    // silhouette. _monsterType must take priority whenever it's set,
    // regardless of isPlayer.
    const body = extractMethod(source, 'showPortrait');
    expect(body).toMatch(/char\._monsterType\s*\?\?\s*char\.templateId/);
    expect(body).not.toMatch(/char\.isPlayer\s*\?\s*char\.templateId\s*:/);
  });
});
