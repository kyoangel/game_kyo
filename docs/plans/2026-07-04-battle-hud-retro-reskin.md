# Battle HUD Retro Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin `workspace-pixel-squad`'s live battle HUD (character rows in `BattleScene.ts`) from the current mismatched "web UI" look (Tailwind hex colors, `monospace` font, HP-percentage-colored bars) to the retro VS-comparison style locked in `docs/specs/pixel-squad/battle-hud-retro-reskin.md`: pure black background, fixed team-color HP bars, and a character portrait that alone slides toward the team's centerline.

**Architecture:** Introduce a dual x-anchor model per character row — `labelX` (unchanged, hosts name/bar/HP text) and `portraitX` (offset inward, hosts the sprite, its tap hitbox, animation, status/weakness icons, and the player's command icon). The anchor math is extracted into a new pure, Phaser-free module (`src/ui/characterRow.ts`) so it can be unit tested directly, instead of joining `BattleScene.ts`'s existing source-text regex tests.

**Tech Stack:** TypeScript, Phaser 3, Vitest (unit tests only — Playwright/e2e is not touched by this plan).

**Out of scope (see spec's own scope note):** font sourcing/licensing and the 18 AI-generated character/monster portraits are tracked separately, not as TDD tasks in this plan — they don't fit a red/green code loop. This plan ships the architecture and lets the scene keep using its current sprite/color-rectangle fallbacks and `monospace` font as placeholders; swapping in the real font and art later is a drop-in change once those are ready. The "分段式橫條（梯子）" segmented-rung bar texture from the mockup is also deferred — this plan implements a solid team-color fill, which satisfies the spec's functional rule ("陣營色即資訊") without a custom Phaser texture.

---

### Task 1: Add retro battle theme tokens

**Files:**
- Modify: `workspace-pixel-squad/src/ui/theme.ts`
- Test: `workspace-pixel-squad/tests/unit/theme.constants.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `workspace-pixel-squad/tests/unit/theme.constants.test.ts` and insert the following three `it` blocks immediately after the existing `HP_LOW` test (after line 84, `});`) and before the `describe('ARCHETYPE badge colors', ...)` block:

```typescript
  it('TEAM_ALLY is 0xf5a623 (battle HUD ally bar/portrait color)', () => {
    expect(Colors.TEAM_ALLY).toBe(0xf5a623);
  });

  it('TEAM_ENEMY is 0xb083e6 (battle HUD enemy bar/portrait color)', () => {
    expect(Colors.TEAM_ENEMY).toBe(0xb083e6);
  });

  it('BG_BATTLE is 0x000000 (pure black battle background)', () => {
    expect(Colors.BG_BATTLE).toBe(0x000000);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd workspace-pixel-squad && npx vitest run tests/unit/theme.constants.test.ts`
Expected: FAIL — `expected undefined to be 4046107` (or similar) for `Colors.TEAM_ALLY`.

- [ ] **Step 3: Implement the minimal change**

In `workspace-pixel-squad/src/ui/theme.ts`, add three keys to the `Colors` object, right after `HP_LOW: 0xe53e3e,` (line 20) and before the `ARCHETYPE` key:

```typescript
  TEAM_ALLY: 0xf5a623,
  TEAM_ENEMY: 0xb083e6,
  BG_BATTLE: 0x000000,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd workspace-pixel-squad && npx vitest run tests/unit/theme.constants.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/ui/theme.ts workspace-pixel-squad/tests/unit/theme.constants.test.ts
git commit -m "feat(pixel-squad): add retro battle HUD theme tokens"
```

---

### Task 2: `computeRowAnchors` pure function

**Files:**
- Create: `workspace-pixel-squad/src/ui/characterRow.ts`
- Test: `workspace-pixel-squad/tests/unit/characterRow.test.ts`

This is the module that makes the dual-anchor math independently testable (the spec's stated goal for fixing BattleScene's regex-only test coverage).

- [ ] **Step 1: Write the failing test**

Create `workspace-pixel-squad/tests/unit/characterRow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeRowAnchors, ROW_LAYOUT } from '../../src/ui/characterRow';

describe('computeRowAnchors', () => {
  it('ally (isPlayer=true): bar and portrait extend rightward (toward centerline)', () => {
    const anchors = computeRowAnchors(90, true);
    expect(anchors.labelX).toBe(90);
    expect(anchors.barNearX).toBe(90 + ROW_LAYOUT.BAR_GAP);
    expect(anchors.barFarX).toBe(90 + ROW_LAYOUT.BAR_GAP + ROW_LAYOUT.BAR_WIDTH);
    expect(anchors.portraitX).toBe(
      90 + ROW_LAYOUT.BAR_GAP + ROW_LAYOUT.BAR_WIDTH * ROW_LAYOUT.PORTRAIT_INSET
    );
  });

  it('enemy (isPlayer=false): bar and portrait extend leftward (toward centerline)', () => {
    const anchors = computeRowAnchors(270, false);
    expect(anchors.labelX).toBe(270);
    expect(anchors.barNearX).toBe(270 - ROW_LAYOUT.BAR_GAP);
    expect(anchors.barFarX).toBe(270 - ROW_LAYOUT.BAR_GAP - ROW_LAYOUT.BAR_WIDTH);
    expect(anchors.portraitX).toBe(
      270 - ROW_LAYOUT.BAR_GAP - ROW_LAYOUT.BAR_WIDTH * ROW_LAYOUT.PORTRAIT_INSET
    );
  });

  it('ally portrait moves toward the centerline relative to labelX', () => {
    const anchors = computeRowAnchors(90, true);
    expect(anchors.portraitX).toBeGreaterThan(anchors.labelX);
  });

  it('enemy portrait moves toward the centerline relative to labelX', () => {
    const anchors = computeRowAnchors(270, false);
    expect(anchors.portraitX).toBeLessThan(anchors.labelX);
  });

  it('neither side crosses the screen centerline (x=180) at BAR_WIDTH=50/BAR_GAP=14', () => {
    const ally = computeRowAnchors(90, true);
    const enemy = computeRowAnchors(270, false);
    expect(ally.barFarX).toBeLessThan(180);
    expect(enemy.barFarX).toBeGreaterThan(180);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd workspace-pixel-squad && npx vitest run tests/unit/characterRow.test.ts`
Expected: FAIL — `Cannot find module '../../src/ui/characterRow'`.

- [ ] **Step 3: Write the minimal implementation**

Create `workspace-pixel-squad/src/ui/characterRow.ts`:

```typescript
// Battle HUD row layout — see docs/specs/pixel-squad/battle-hud-retro-reskin.md
//
// Each character row has two x-anchors instead of one:
//   labelX    — fixed, hosts name/archetype text, the HP bar, and HP number.
//   portraitX — offset toward the team's centerline, hosts the sprite, its
//               tap hitbox, animation, and the status/weakness/command icons
//               that should visually track the character, not the label.
export const ROW_LAYOUT = {
  BAR_WIDTH: 50,
  BAR_GAP: 14,
  BAR_HEIGHT: 8,
  PORTRAIT_INSET: 0.75,
} as const;

export interface RowAnchors {
  labelX: number;
  barNearX: number;
  barFarX: number;
  portraitX: number;
}

export function computeRowAnchors(cx: number, isPlayer: boolean): RowAnchors {
  const dir = isPlayer ? 1 : -1;
  const labelX = cx;
  const barNearX = cx + dir * ROW_LAYOUT.BAR_GAP;
  const barFarX = barNearX + dir * ROW_LAYOUT.BAR_WIDTH;
  const portraitX = barNearX + dir * ROW_LAYOUT.BAR_WIDTH * ROW_LAYOUT.PORTRAIT_INSET;
  return { labelX, barNearX, barFarX, portraitX };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd workspace-pixel-squad && npx vitest run tests/unit/characterRow.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/ui/characterRow.ts workspace-pixel-squad/tests/unit/characterRow.test.ts
git commit -m "feat(pixel-squad): add computeRowAnchors dual-anchor layout function"
```

---

### Task 3: Paint the battlefield background pure black

**Files:**
- Modify: `workspace-pixel-squad/src/scenes/BattleScene.ts:1-2` (imports), `:160-165` (background block in `create()`)
- Test: `workspace-pixel-squad/tests/unit/BattleScene.retroHud.test.ts` (new file, created in this task and extended in Task 4)

`BattleScene` can't be instantiated in the Node/vitest environment (no canvas — see the header comment in `tests/unit/support/extractMethod.ts`), so this task follows the project's existing pattern of asserting against the method source text via `extractMethod`/`readBattleSceneSource`, same as `BattleScene.sceneGuard.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `workspace-pixel-squad/tests/unit/BattleScene.retroHud.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd workspace-pixel-squad && npx vitest run tests/unit/BattleScene.retroHud.test.ts`
Expected: FAIL — first test fails because `Colors` isn't imported yet in `BattleScene.ts`.

- [ ] **Step 3: Write the minimal implementation**

In `workspace-pixel-squad/src/scenes/BattleScene.ts`, add this import after the existing `import { SFX_KEYS, MUSIC_KEYS } from '../data/audio';` line (line 35):

```typescript
import { Colors } from '../ui/theme';
```

Then in `create()`, replace these 4 lines (currently lines 162-165):

```typescript
    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);
    this.add.rectangle(90, H / 2 - 80, 160, 440, 0x1f2937).setAlpha(0.6);
    this.add.rectangle(270, H / 2 - 80, 160, 440, 0x1f2937).setAlpha(0.6);
    this.add.line(W / 2, 240, 0, -220, 0, 220, 0x374151, 0.6).setLineWidth(1);
```

with:

```typescript
    this.add.rectangle(W / 2, H / 2, W, H, Colors.BG_BATTLE);
    this.add.line(W / 2, 240, 0, -220, 0, 220, 0x374151, 0.6).setLineWidth(1);
```

(The two lighter column panels are removed — the spec's rule is "純黑背景，沒有漸層、沒有裝飾"; the faint centerline divider and "VS" label stay, since they read fine against pure black and are part of the two-army-facing-off framing the reference already gestures at.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd workspace-pixel-squad && npx vitest run tests/unit/BattleScene.retroHud.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/scenes/BattleScene.ts workspace-pixel-squad/tests/unit/BattleScene.retroHud.test.ts
git commit -m "feat(pixel-squad): paint battle HUD background pure black"
```

---

### Task 4: Wire `renderParty()` to the dual-anchor layout and team-color bars

**Files:**
- Modify: `workspace-pixel-squad/src/scenes/BattleScene.ts:226-281` (`renderParty`), `:283-290` (`updateHpBar`)
- Test: `workspace-pixel-squad/tests/unit/BattleScene.retroHud.test.ts` (extend from Task 3)

- [ ] **Step 1: Write the failing tests**

Append these `it` blocks inside the existing `describe('BattleScene retro battle HUD', ...)` block in `workspace-pixel-squad/tests/unit/BattleScene.retroHud.test.ts` (after the Task 3 tests, before the closing `});`):

```typescript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd workspace-pixel-squad && npx vitest run tests/unit/BattleScene.retroHud.test.ts`
Expected: FAIL — the new assertions about `computeRowAnchors`, `portraitX`, `labelX`, and `Colors.TEAM_ALLY`/`TEAM_ENEMY` all fail against the current `renderParty`/`updateHpBar` source.

- [ ] **Step 3: Write the minimal implementation**

Add this import in `workspace-pixel-squad/src/scenes/BattleScene.ts`, right after the `Colors` import added in Task 3:

```typescript
import { computeRowAnchors, ROW_LAYOUT } from '../ui/characterRow';
```

Replace the entire `renderParty` method (lines 226-281) with:

```typescript
  private renderParty(party: Character[], x: number, isPlayer: boolean) {
    const topY = 40, bottomY = 470;
    const n = Math.max(1, party.length);

    party.forEach((char, i) => {
      // Single column — position index i is the formation slot (0=front, 4=back)
      const cy = topY + ((bottomY - topY) * (i + 0.5)) / n;
      const { labelX, barNearX, portraitX } = computeRowAnchors(x, isPlayer);

      const textureLoaded = this.textures.exists(SPRITE_KEYS.protagonistSheet);
      const color = isPlayer ? 0x3b82f6 : 0xef4444;
      let body: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
      if (shouldUseProtagonistSprite(char, textureLoaded)) {
        body = this.add.sprite(portraitX, cy, SPRITE_KEYS.protagonistSheet, 90).setDisplaySize(44, 56);
      } else if (shouldUsePartySprite(char, this)) {
        body = this.add.image(portraitX, cy, partySpritKey(char.templateId)).setDisplaySize(44, 56);
      } else if (shouldUseMonsterSprite(char, this)) {
        body = this.add.image(portraitX, cy, monsterIdleKey(char._monsterType as MonsterType)).setDisplaySize(44, 56);
      } else {
        body = this.add.rectangle(portraitX, cy, 44, 56, color).setAlpha(0.9);
      }
      const useSprite = shouldUseProtagonistSprite(char, textureLoaded);
      const barOrigin = isPlayer ? 0 : 1;
      const teamColor = isPlayer ? Colors.TEAM_ALLY : Colors.TEAM_ENEMY;
      const hpBarBg = this.add.rectangle(barNearX, cy + 34, ROW_LAYOUT.BAR_WIDTH, ROW_LAYOUT.BAR_HEIGHT, 0x374151)
        .setOrigin(barOrigin, 0.5);
      const hpBar = this.add.rectangle(barNearX, cy + 34, ROW_LAYOUT.BAR_WIDTH, ROW_LAYOUT.BAR_HEIGHT, teamColor)
        .setOrigin(barOrigin, 0.5);
      const nameText = this.add.text(labelX, cy - 36, char.name, {
        fontSize: '10px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const archetypeText = this.add.text(labelX, cy - 26, `[${char.archetype}] ${ARCHETYPE_TOOLTIP[char.archetype]}`, {
        fontSize: '8px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const hpText = this.add.text(labelX, cy + 44, `${char.stats.hp}/${char.stats.maxHp}`, {
        fontSize: '9px', color: '#9ca3af', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const statusText = this.add.text(portraitX, cy + 54, '', {
        fontSize: '9px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const weaknessIcon = this.add.text(portraitX + (isPlayer ? 22 : -22), cy - 26, '', {
        fontSize: '10px', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const animator = new CharacterAnimator(this, body, useSprite);
      animator.playIdleLoop();
      this.views.set(char.id, { body, animator, hpBarBg, hpBar, nameText, hpText, archetypeText, statusText, weaknessIcon });
      this.updateStatusIcons(char);
      this.updateWeaknessIcon(char);

      if (isPlayer) {
        const icon = this.add.text(portraitX + 28, cy - 36, '', {
          fontSize: '11px', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.commandIcons.set(char.id, icon);

        body.setInteractive({ useHandCursor: true });
        body.on('pointerdown', () => this.onPlayerBodyTap(char, i));
      }
    });
  }
```

Replace the `updateHpBar` method (lines 283-290) with:

```typescript
  private updateHpBar(char: Character) {
    const view = this.views.get(char.id);
    if (!view) return;
    const pct = Math.max(0, char.stats.hp / char.stats.maxHp);
    view.hpBar.width = ROW_LAYOUT.BAR_WIDTH * pct;
    view.hpText.setText(`${char.stats.hp}/${char.stats.maxHp}`);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd workspace-pixel-squad && npx vitest run tests/unit/BattleScene.retroHud.test.ts`
Expected: PASS — all 9 tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/scenes/BattleScene.ts workspace-pixel-squad/tests/unit/BattleScene.retroHud.test.ts
git commit -m "feat(pixel-squad): dual-anchor renderParty — portrait slides in, label/bar stay fixed"
```

---

### Task 5: Full test suite, typecheck, and manual visual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `cd workspace-pixel-squad && npm run test:unit`
Expected: PASS — all suites green, including the pre-existing `BattleScene.aoaWiring.test.ts`, `BattleScene.bondWiring.test.ts`, `BattleScene.mercenaryRating.test.ts`, and `BattleScene.sceneGuard.test.ts` (none of these reference the hex values, offsets, or `renderParty` internals touched in this plan, so they should be unaffected — this run confirms that).

- [ ] **Step 2: Run the typecheck/build**

Run: `cd workspace-pixel-squad && npm run build`
Expected: PASS — `tsc` reports no type errors, `vite build` completes.

- [ ] **Step 3: Manually verify in the browser**

Run: `cd workspace-pixel-squad && npm run dev`, open the printed local URL, start a battle (any stage from the world map).

Confirm against the spec (`docs/specs/pixel-squad/battle-hud-retro-reskin.md`):
- Battlefield background is pure black, no lighter column panels.
- Ally HP bars are orange, enemy HP bars are purple — colors no longer change with HP percentage.
- Character portraits sit visibly closer to the centerline than before; name/HP text stayed in their original column position.
- Tapping a player character to select a command still works (tap hitbox followed the portrait).
- Targeting an enemy (attack/skill) still highlights the correct enemy at its new portrait position.

If the bar/portrait spacing looks cramped or crosses into the opposing column at any squad size (1 vs 5 is the tightest vertical case), adjust `BAR_WIDTH`/`BAR_GAP`/`PORTRAIT_INSET` in `workspace-pixel-squad/src/ui/characterRow.ts` and re-run Task 2's tests plus this manual check — this is expected calibration, not a bug (the spec explicitly flags these as starting values, not final pixel-perfect ones).

- [ ] **Step 4: Commit any calibration adjustments (only if Step 3 required changes)**

```bash
git add workspace-pixel-squad/src/ui/characterRow.ts
git commit -m "fix(pixel-squad): calibrate battle HUD row spacing after visual check"
```

---

## Self-Review Notes

**Spec coverage:** 版面規則 (black bg, team colors, fixed label/floating portrait, 3/4 inset, halved bar width) → Tasks 1, 3, 4. 雙錨點架構 → Task 2, 4. 涵蓋範圍 (1-5 both sides, unchanged vertical stacking, existing update functions retargeted) → Task 4 (vertical loop untouched; `updateStatusIcons`/`updateWeaknessIcon`/`setCommandIcon` needed no code change since they only look up the already-repositioned `view` objects by id, not by coordinate). 測試 (pure function extraction, replacing regex-only coverage) → Task 2. Font sourcing and the 18 art prompts are explicitly out of scope per the spec's own note — not silently dropped.

**Not carried over from the spec's original wording:** the spec's 現況分析 section listed "飄傷害數字的錨點" (floating damage number anchor) as something that needs to move to `portraitX`. Checked during planning: `src/ui/floatingNumbers.ts` exists but is never imported/called from `BattleScene.ts` — it's only exercised by its own standalone unit test. There is no live floating-damage-number feature in the scene today, so there's nothing to re-anchor; this plan doesn't invent one. Everything else the spec said tracks the character (tap hitbox, animation, target-selection highlight) already reads its position dynamically off `view.body.x`/`view.body.y` at the point of use, so moving `body`'s creation x to `portraitX` in Task 4 is sufficient — no separate wiring needed for those three.
