import { describe, it, expect, beforeAll } from 'vitest';
import { readWorldMapSceneSource, extractMethod } from './support/extractWorldMapMethod';

// Spec: specs/pixel-squad-doomsday-timer.md
// AC-12: WorldMapScene must render the doomsday countdown (via
// getDoomsdayDaysRemaining/formatDoomsdayLabel/getDoomsdayColor) next to the
// existing currency display. WorldMapScene extends Phaser.Scene and can't be
// instantiated in this project's Node vitest environment (see
// WorldMapScene.hiddenStage.test.ts for the established precedent), so this
// wiring is verified by reading the real WorldMapScene.ts source text. None
// of this wiring exists yet, so every test below fails against current
// source.

let source: string;

beforeAll(() => {
  source = readWorldMapSceneSource();
});

describe('import wiring', () => {
  it('imports getDoomsdayColor and formatDoomsdayLabel from ui/doomsdayDisplay', () => {
    expect(source).toMatch(/from\s*['"]\.\.\/ui\/doomsdayDisplay['"]/);
    expect(source).toMatch(/getDoomsdayColor/);
    expect(source).toMatch(/formatDoomsdayLabel/);
  });

  it('imports getDoomsdayDaysRemaining from battle/DoomsdayClock', () => {
    expect(source).toMatch(/getDoomsdayDaysRemaining/);
    expect(source).toMatch(/from\s*['"]\.\.\/battle\/DoomsdayClock['"]/);
  });
});

describe('AC-12: create() renders the doomsday countdown next to the currency display', () => {
  it('reads days remaining via getDoomsdayDaysRemaining(this.gameState)', () => {
    const body = extractMethod(source, 'create');
    expect(body, 'expected to find a create() method in WorldMapScene.ts').not.toBe('');
    expect(body).toMatch(/getDoomsdayDaysRemaining\(this\.gameState\)/);
  });

  it('formats the label via formatDoomsdayLabel and colors it via getDoomsdayColor', () => {
    const body = extractMethod(source, 'create');
    expect(body).toMatch(/formatDoomsdayLabel\(/);
    expect(body).toMatch(/getDoomsdayColor\(/);
  });
});
