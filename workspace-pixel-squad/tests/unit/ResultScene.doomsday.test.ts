import { describe, it, expect, beforeAll } from 'vitest';
import { readResultSceneSource, extractMethod } from './support/extractResultSceneMethod';

// Spec: specs/pixel-squad-doomsday-timer.md
// AC-7/AC-8/AC-9: ResultScene must check isDoomsdayExpired() right after
// saveSlot(updatedGameState) in the victory branch and, when true, render a
// bad-ending screen (no reward summary, no "整備" button) instead of the
// normal victory continuation. ResultScene extends Phaser.Scene and can't be
// instantiated in this project's Node vitest environment (see
// BattleScene.aoaWiring.test.ts for the established precedent), so these
// wiring assertions read the real ResultScene.ts source text. None of this
// wiring exists yet, so every test below fails against current source.

let source: string;

beforeAll(() => {
  source = readResultSceneSource();
});

describe('import wiring', () => {
  it('imports isDoomsdayExpired from battle/DoomsdayClock', () => {
    expect(source).toMatch(/import\s*\{\s*isDoomsdayExpired\s*\}\s*from\s*['"]\.\.\/battle\/DoomsdayClock['"]/);
  });
});

describe('AC-7/AC-8/AC-9: create() checks isDoomsdayExpired right after saveSlot in the victory branch', () => {
  it('calls isDoomsdayExpired(updatedGameState) after saveSlot(updatedGameState)', () => {
    const body = extractMethod(source, 'create');
    expect(body, 'expected to find a create() method in ResultScene.ts').not.toBe('');

    const saveIdx = body.indexOf('saveSlot(updatedGameState)');
    expect(saveIdx, 'expected a saveSlot(updatedGameState) call in create()').toBeGreaterThan(-1);

    const afterSave = body.slice(saveIdx);
    expect(afterSave).toMatch(/isDoomsdayExpired\(updatedGameState\)/);
  });

  it('the expiry check happens before the "整備" button is rendered', () => {
    const body = extractMethod(source, 'create');
    const expiryIdx = body.indexOf('isDoomsdayExpired(updatedGameState)');
    const buttonIdx = body.indexOf("'整備'");

    expect(expiryIdx, 'expected an isDoomsdayExpired(updatedGameState) check in create()').toBeGreaterThan(-1);
    expect(buttonIdx, 'expected a 整備 button rendered in create()').toBeGreaterThan(-1);
    expect(expiryIdx).toBeLessThan(buttonIdx);
  });

  it('renders the doomsday ending and returns early when expired, skipping reward rendering', () => {
    const body = extractMethod(source, 'create');
    const expiryIdx = body.indexOf('isDoomsdayExpired(updatedGameState)');
    expect(expiryIdx).toBeGreaterThan(-1);

    const window = body.slice(expiryIdx, expiryIdx + 200);
    expect(window).toMatch(/renderDoomsdayEnding\(\)/);
    expect(window).toMatch(/return;/);
  });
});

describe('renderDoomsdayEnding — the bad-ending screen', () => {
  it('is declared as a method on ResultScene', () => {
    const body = extractMethod(source, 'renderDoomsdayEnding');
    expect(body).not.toBe('');
  });

  it('offers only a return-to-TitleScene action, with no 整備 button', () => {
    const body = extractMethod(source, 'renderDoomsdayEnding');
    expect(body).not.toBe('');
    expect(body).toMatch(/scene\.start\(['"]TitleScene['"]\)/);
    expect(body).not.toMatch(/整備/);
  });
});
