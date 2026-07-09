import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

describe('BattleScene tenchi2 battle HUD', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('imports Colors from ui/theme', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bColors\b[^}]*\}\s*from\s*'\.\.\/ui\/theme'/);
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

  it('imports computeRowLayoutV2, fillSegments, ROW_V2 from ui/characterRow', () => {
    expect(source).toMatch(/computeRowLayoutV2/);
    expect(source).toMatch(/fillSegments/);
    expect(source).toMatch(/ROW_V2/);
    expect(source).toMatch(/from\s*'\.\.\/ui\/characterRow'/);
  });

  it('renderParty() computes layout via computeRowLayoutV2(isPlayer, canvasWidth) instead of the old single-cx anchors', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).toMatch(/computeRowLayoutV2\(\s*isPlayer\s*,/);
    expect(body).not.toMatch(/computeRowAnchors\(/);
  });

  it('renderParty() creates the body/sprite at layout.spriteX, not a raw column x', () => {
    const body = extractMethod(source, 'renderParty');
    // Matches specifically the 4 `body = this.add.X(...)` branches (protagonist
    // sprite / party image / monster image / rectangle fallback) — deliberately
    // narrower than a generic `this.add.(sprite|image|rectangle)(` match, which
    // would also catch the unrelated hpSegments rectangles (correctly at
    // segment x positions, not spriteX) and fail for the wrong reason.
    const bodyAssignments = body.match(/body = this\.add\.(sprite|image|rectangle)\(([^,]+),/g) ?? [];
    expect(bodyAssignments.length).toBe(4);
    bodyAssignments.forEach(call => {
      expect(call).toMatch(/layout\.spriteX/);
    });
  });

  it('renderParty() flips monster images to face the centerline (fixes enemy-facing-wrong QA bug)', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).toMatch(/setFlipX\(true\)/);
  });

  it('renderParty() positions stacked name/number at layout.nameX, not labelX', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).toMatch(/layout\.nameX,\s*cy\s*\+\s*ROW_V2\.NAME_DY,\s*char\.name/);
    expect(body).toMatch(/layout\.nameX,\s*cy\s*\+\s*ROW_V2\.NUMBER_DY,/);
    expect(body).not.toMatch(/this\.add\.text\(labelX,/);
  });

  it('renderParty() no longer renders a separate archetype line in the row (moved to portrait window)', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).not.toMatch(/archetypeText/);
  });

  it('renderParty() builds a 10-segment HP bar colored with fixed team colors, not a single fill rect', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).toMatch(/Colors\.TEAM_ALLY/);
    expect(body).toMatch(/Colors\.TEAM_ENEMY/);
    expect(body).not.toMatch(/0x22c55e/);
    expect(body).toMatch(/hpSegments/);
    expect(body).toMatch(/ROW_V2\.SEGMENTS/);
  });

  it('updateHpDisplay() colors segments via fillSegments() instead of scaling a single bar width', () => {
    const body = extractMethod(source, 'updateHpDisplay');
    expect(body).not.toMatch(/fillColor/); // stray legacy percentage-color logic
    expect(body).not.toMatch(/0xf59e0b/);
    expect(body).not.toMatch(/0xef4444/);
    expect(body).toMatch(/fillSegments\(/);
    expect(body).not.toMatch(/ROW_LAYOUT\.BAR_WIDTH/);
  });

  it('updateHpBar() still exists as a thin forwarding alias so other call sites keep working', () => {
    const body = extractMethod(source, 'updateHpBar');
    expect(body).toMatch(/updateHpDisplay\(/);
  });
});
