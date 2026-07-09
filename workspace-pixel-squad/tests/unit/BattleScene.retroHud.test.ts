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

describe('BattleScene bottom window band', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('imports window frame and terrain strip renderers', () => {
    expect(source).toMatch(/import\s*\{\s*windowFrameRects,\s*drawWindow\s*\}\s*from\s*'\.\.\/ui\/battleWindow'/);
    expect(source).toMatch(/import\s*\{\s*terrainPattern,\s*drawTerrainStrip\s*\}\s*from\s*'\.\.\/ui\/terrainStrip'/);
  });

  it('create() draws the portrait window, command window, and terrain strip', () => {
    const body = extractMethod(source, 'create');
    expect(body).toMatch(/drawWindow\(\s*\w+,\s*windowFrameRects\(PORTRAIT_WIN\.x/);
    expect(body).toMatch(/drawWindow\(\s*\w+,\s*windowFrameRects\(COMMAND_WIN\.x/);
    expect(body).toMatch(/drawTerrainStrip\(/);
  });

  it('create() anchors actionMenu to COMMAND_WIN instead of the old centered (W/2, 590) container', () => {
    const body = extractMethod(source, 'create');
    expect(body).toMatch(/this\.actionMenu = this\.add\.container\(COMMAND_WIN\.x,\s*COMMAND_WIN\.y\)/);
    expect(body).not.toMatch(/this\.add\.container\(W \/ 2, 590\)/);
  });

  it('preload() loads portrait images and tracks load failures for the silhouette fallback', () => {
    const body = extractMethod(source, 'preload');
    expect(body).toMatch(/portrait_/);
    expect(body).toMatch(/loaderror/);
  });

  it('defines showPortrait() to render the current actor into the portrait window with a silhouette fallback', () => {
    const body = extractMethod(source, 'showPortrait');
    expect(body).not.toBe('');
    expect(body).toMatch(/missingPortraits/);
  });

  it('advanceCommandInput() shows the portrait for the character currently receiving a command', () => {
    const body = extractMethod(source, 'advanceCommandInput');
    expect(body).toMatch(/showPortrait\(/);
  });

  it('showCommandMenu() and showSkillPicker() lay out entries in the command window grid via a shared helper', () => {
    const menuBody = extractMethod(source, 'showCommandMenu');
    const pickerBody = extractMethod(source, 'showSkillPicker');
    expect(menuBody).toMatch(/renderMenuEntries\(/);
    expect(pickerBody).toMatch(/renderMenuEntries\(/);
  });
});

describe('BattleScene tenchi2 presentation pipeline', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('imports the typewriter pacing helper and battle message templates', () => {
    expect(source).toMatch(/import\s*\{\s*visibleChars\s*\}\s*from\s*'\.\.\/ui\/typewriter'/);
    expect(source).toMatch(/from\s*'\.\.\/ui\/battleMessages'/);
    expect(source).toMatch(/attackMessage/);
    expect(source).toMatch(/damageMessage/);
  });

  it('defines showBattleMessage() as a typewriter reveal driven by visibleChars()', () => {
    const body = extractMethod(source, 'showBattleMessage');
    expect(body).not.toBe('');
    expect(body).toMatch(/visibleChars\(/);
  });

  it('defines rollHpNumber() as a tweened counter that updates the HP text and segments', () => {
    const body = extractMethod(source, 'rollHpNumber');
    expect(body).not.toBe('');
    expect(body).toMatch(/tweens\.addCounter\(/);
    expect(body).toMatch(/fillSegments\(/);
  });

  it('defines stepForward()/stepBack() driven by computeRowLayoutV2 stepDX, not a hardcoded pixel offset', () => {
    const forward = extractMethod(source, 'stepForward');
    const back = extractMethod(source, 'stepBack');
    expect(forward).toMatch(/computeRowLayoutV2\(/);
    expect(forward).toMatch(/stepDX/);
    expect(back).toMatch(/computeRowLayoutV2\(/);
  });

  it('advanceCommandInput() steps the current commanding character forward', () => {
    const body = extractMethod(source, 'advanceCommandInput');
    expect(body).toMatch(/stepForward\(/);
  });

  it('confirmCommand() steps the just-committed character back before advancing', () => {
    const body = extractMethod(source, 'confirmCommand');
    expect(body).toMatch(/stepBack\(/);
  });

  it('applyDamageAndAdvance() drives the attack message, HP roll, and defeat message through the new pipeline', () => {
    const body = extractMethod(source, 'applyDamageAndAdvance');
    expect(body).toMatch(/showBattleMessage\(/);
    expect(body).toMatch(/rollHpNumber\(/);
    expect(body).toMatch(/defeatMessage\(/);
    expect(body).toMatch(/stepForward\(/);
    expect(body).toMatch(/stepBack\(/);
  });

  // Found via manual browser QA (2026-07-09): the command window and the
  // typewriter message window are now the same physical window (COMMAND_WIN),
  // so a leftover in-flight message from the previous execution phase bled
  // through behind the command menu's text when the next command phase began.
  it('showCommandMenu() and showSkillPicker() clear any leftover battle message before drawing menu entries', () => {
    const menuBody = extractMethod(source, 'showCommandMenu');
    const pickerBody = extractMethod(source, 'showSkillPicker');
    expect(menuBody).toMatch(/clearBattleMessage\(\)/);
    expect(pickerBody).toMatch(/clearBattleMessage\(\)/);
  });
});
