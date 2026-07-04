import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

describe('BattleScene retro battle HUD', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('imports Colors from ui/theme', () => {
    expect(source).toMatch(/import\s*\{\s*Colors\s*\}\s*from\s*'\.\.\/ui\/theme'/);
  });

  it('create() paints the battlefield with Colors.BG_BATTLE instead of a hardcoded hex', () => {
    const body = extractMethod(source, 'create');
    expect(body).toMatch(/Colors\.BG_BATTLE/);
    expect(body).not.toMatch(/0x111827/);
  });

  it('create() no longer draws the old two-tone column panels', () => {
    const body = extractMethod(source, 'create');
    expect(body).not.toMatch(/0x1f2937/);
  });
});
