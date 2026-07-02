import { describe, it, expect, beforeAll } from 'vitest';
import { readBaseSceneSource, extractMethod } from './support/extractBaseSceneMethod';

// Spec: specs/pixel-squad-doomsday-timer.md
// AC-12: BaseScene must render the doomsday countdown (via
// getDoomsdayDaysRemaining/formatDoomsdayLabel/getDoomsdayColor) next to the
// existing currency display. BaseScene extends Phaser.Scene and can't be
// instantiated in this project's Node vitest environment (see
// BaseScene.buttonLayout.test.ts for the established precedent of testing
// BaseScene indirectly), so this wiring is verified by reading the real
// BaseScene.ts source text. None of this wiring exists yet, so every test
// below fails against current source.

let source: string;

beforeAll(() => {
  source = readBaseSceneSource();
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
  it('reads days remaining via getDoomsdayDaysRemaining(gameState)', () => {
    const body = extractMethod(source, 'create');
    expect(body, 'expected to find a create() method in BaseScene.ts').not.toBe('');
    expect(body).toMatch(/getDoomsdayDaysRemaining\(gameState\)/);
  });

  it('formats the label via formatDoomsdayLabel and colors it via getDoomsdayColor', () => {
    const body = extractMethod(source, 'create');
    expect(body).toMatch(/formatDoomsdayLabel\(/);
    expect(body).toMatch(/getDoomsdayColor\(/);
  });
});
