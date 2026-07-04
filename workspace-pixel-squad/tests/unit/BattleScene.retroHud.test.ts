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

  it('imports computeRowAnchors and ROW_LAYOUT from ui/characterRow', () => {
    expect(source).toMatch(/import\s*\{\s*computeRowAnchors,\s*ROW_LAYOUT\s*\}\s*from\s*'\.\.\/ui\/characterRow'/);
  });

  it('renderParty() computes anchors via computeRowAnchors instead of reusing a single cx', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).toMatch(/computeRowAnchors\(x,\s*isPlayer\)/);
  });

  it('renderParty() creates the body/sprite at portraitX, not the raw column x', () => {
    const body = extractMethod(source, 'renderParty');
    // Matches specifically the 4 `body = this.add.X(...)` branches (protagonist
    // sprite / party image / monster image / rectangle fallback) — deliberately
    // narrower than a generic `this.add.(sprite|image|rectangle)(` match, which
    // would also catch the unrelated hpBarBg/hpBar rectangles (correctly at
    // barNearX, not portraitX) and fail for the wrong reason.
    const bodyAssignments = body.match(/body = this\.add\.(sprite|image|rectangle)\(([^,]+),/g) ?? [];
    expect(bodyAssignments.length).toBe(4);
    bodyAssignments.forEach(call => {
      expect(call).toMatch(/portraitX/);
    });
  });

  it('renderParty() positions name/archetype/HP text at labelX', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).toMatch(/this\.add\.text\(labelX,\s*cy - 36,\s*char\.name/);
    expect(body).toMatch(/this\.add\.text\(labelX,\s*cy - 26,/);
    expect(body).toMatch(/this\.add\.text\(labelX,\s*cy \+ 44,/);
  });

  it('renderParty() colors the HP bar with a fixed team color, not a hardcoded green', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).toMatch(/Colors\.TEAM_ALLY/);
    expect(body).toMatch(/Colors\.TEAM_ENEMY/);
    expect(body).not.toMatch(/0x22c55e/);
  });

  it('updateHpBar() no longer recolors the bar by HP percentage', () => {
    const body = extractMethod(source, 'updateHpBar');
    expect(body).not.toMatch(/fillColor/);
    expect(body).not.toMatch(/0xf59e0b/);
    expect(body).not.toMatch(/0xef4444/);
    expect(body).toMatch(/ROW_LAYOUT\.BAR_WIDTH/);
  });
});
