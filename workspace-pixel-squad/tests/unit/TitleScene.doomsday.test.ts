import { describe, it, expect, beforeAll } from 'vitest';
import { readTitleSceneSource, extractMethod } from './support/extractTitleSceneMethod';

// Spec: specs/pixel-squad-doomsday-timer.md
// AC-10: handleSlotTap() must detect doomsday expiry on the loaded slot and
// show a locked-slot message instead of starting WorldMapScene/BaseScene.
// TitleScene extends Phaser.Scene and can't be instantiated in this
// project's Node vitest environment, so these wiring assertions read the
// real TitleScene.ts source text (mirrors BattleScene.aoaWiring.test.ts).
// None of this wiring exists yet, so every test below fails against
// current source.

let source: string;

beforeAll(() => {
  source = readTitleSceneSource();
});

describe('import wiring', () => {
  it('imports isDoomsdayExpired from battle/DoomsdayClock', () => {
    expect(source).toMatch(/import\s*\{\s*isDoomsdayExpired\s*\}\s*from\s*['"]\.\.\/battle\/DoomsdayClock['"]/);
  });
});

describe('AC-10: handleSlotTap checks isDoomsdayExpired before entering WorldMapScene/BaseScene', () => {
  it('calls isDoomsdayExpired(state) after loading the slot', () => {
    const body = extractMethod(source, 'handleSlotTap');
    expect(body, 'expected to find a handleSlotTap() method in TitleScene.ts').not.toBe('');
    expect(body).toMatch(/isDoomsdayExpired\(state\)/);
  });

  it('the expiry check happens before either scene.start call', () => {
    const body = extractMethod(source, 'handleSlotTap');
    const expiryIdx = body.indexOf('isDoomsdayExpired(state)');
    const worldMapIdx = body.indexOf("scene.start('WorldMapScene'");
    const baseSceneIdx = body.indexOf("scene.start('BaseScene'");

    expect(expiryIdx, 'expected an isDoomsdayExpired(state) check in handleSlotTap()').toBeGreaterThan(-1);
    expect(worldMapIdx, 'expected a scene.start(\'WorldMapScene\', ...) call').toBeGreaterThan(-1);
    expect(baseSceneIdx, 'expected a scene.start(\'BaseScene\', ...) call').toBeGreaterThan(-1);
    expect(expiryIdx).toBeLessThan(worldMapIdx);
    expect(expiryIdx).toBeLessThan(baseSceneIdx);
  });

  it('shows a locked-slot message and returns early in the expired branch', () => {
    const body = extractMethod(source, 'handleSlotTap');
    const expiryIdx = body.indexOf('isDoomsdayExpired(state)');
    expect(expiryIdx).toBeGreaterThan(-1);

    const window = body.slice(expiryIdx, expiryIdx + 200);
    expect(window).toMatch(/showDoomsdayLockedMessage\(\)/);
    expect(window).toMatch(/return;/);
  });
});

describe('showDoomsdayLockedMessage — the locked-slot message', () => {
  it('is declared as a method on TitleScene', () => {
    const body = extractMethod(source, 'showDoomsdayLockedMessage');
    expect(body).not.toBe('');
  });

  it('does not transition to any other scene (player stays on TitleScene)', () => {
    const body = extractMethod(source, 'showDoomsdayLockedMessage');
    expect(body).not.toBe('');
    expect(body).not.toMatch(/scene\.start\(/);
  });
});
