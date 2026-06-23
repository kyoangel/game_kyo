# Pixel Squad PrepScene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AllocateScene with a new PrepScene that shows a shared EXP pool, lets the player level up any party member multiple times per session, and handles both protagonist (manual stat allocation) and non-protagonist (auto-random) level-up flows.

**Architecture:** A new `LevelUpSystem.ts` pure module holds all level-up logic behind a `LevelUpConfig` object so numbers can be tweaked without touching UI code. `PrepScene.ts` consumes that module and replaces `AllocateScene.ts` entirely. `expPool` travels through the scene chain via scene data.

**Tech Stack:** Phaser 3, TypeScript, Vite, vitest (unit tests for `LevelUpSystem` only; scenes verified manually)

**Spec:** `docs/superpowers/specs/2026-06-22-pixel-squad-design.md` (Phase 2 — 整備畫面 section)

---

## File Map

| File | Change |
|------|--------|
| `workspace-pixel-squad/src/battle/LevelUpSystem.ts` | CREATE — config + pure functions |
| `workspace-pixel-squad/tests/unit/LevelUpSystem.test.ts` | CREATE — TDD |
| `workspace-pixel-squad/src/types.ts` | MODIFY — add `PrepSceneData`, add `expPool` to `BattleSceneData` + `ResultSceneData` |
| `workspace-pixel-squad/src/scenes/PrepScene.ts` | CREATE — new post-battle management screen |
| `workspace-pixel-squad/src/scenes/ResultScene.ts` | MODIFY — route to PrepScene, pass expPool |
| `workspace-pixel-squad/src/scenes/BattleScene.ts` | MODIFY — carry expPool through to ResultScene |
| `workspace-pixel-squad/src/main.ts` | MODIFY — swap AllocateScene → PrepScene |
| `workspace-pixel-squad/src/scenes/AllocateScene.ts` | DELETE |

Pure functions `ExpSystem.allocateStat` and `CharacterFactory.expToNextLevel` are **not modified** — `LevelUpSystem` uses them internally.

---

## Task 1: LevelUpSystem.ts — pure functions + tests (TDD)

**Files:**
- Create: `workspace-pixel-squad/src/battle/LevelUpSystem.ts`
- Create: `workspace-pixel-squad/tests/unit/LevelUpSystem.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `workspace-pixel-squad/tests/unit/LevelUpSystem.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { canLevelUp, applyLevelUp, DEFAULT_LEVEL_UP_CONFIG } from '../../src/battle/LevelUpSystem';
import type { Character } from '../../src/types';

function makeChar(id: string, level: number, isProtagonist: boolean, statPoints = 0): Character {
  return {
    id, templateId: id, name: id, isProtagonist, isPlayer: true,
    level, exp: 0, expToNext: level * 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 10 },
    skills: [], statPoints, archetype: '全能', alive: true, defending: false,
  };
}

const cfg = DEFAULT_LEVEL_UP_CONFIG; // expFormula: level * 50, protagonist.pointsPerLevel: 5

describe('canLevelUp', () => {
  it('returns true when pool equals cost exactly', () => {
    expect(canLevelUp(makeChar('a', 2, false), 100, cfg)).toBe(true); // 2*50=100
  });

  it('returns true when pool exceeds cost', () => {
    expect(canLevelUp(makeChar('a', 1, false), 200, cfg)).toBe(true);
  });

  it('returns false when pool is one short', () => {
    expect(canLevelUp(makeChar('a', 2, false), 99, cfg)).toBe(false);
  });

  it('returns false when pool is zero', () => {
    expect(canLevelUp(makeChar('a', 1, false), 0, cfg)).toBe(false);
  });
});

describe('applyLevelUp', () => {
  it('does nothing when pool < cost', () => {
    const char = makeChar('a', 1, false);
    const result = applyLevelUp(char, 10, cfg); // cost=50
    expect(result.character.level).toBe(1);
    expect(result.expPool).toBe(10);
  });

  it('protagonist: increments level, adds statPoints, decrements pool', () => {
    const char = makeChar('p', 1, true, 0);
    const result = applyLevelUp(char, 100, cfg); // cost=50
    expect(result.character.level).toBe(2);
    expect(result.character.statPoints).toBe(5);
    expect(result.expPool).toBe(50);
  });

  it('protagonist: updates expToNext to new level cost', () => {
    const char = makeChar('p', 1, true);
    const result = applyLevelUp(char, 100, cfg);
    expect(result.character.expToNext).toBe(cfg.expFormula(2)); // 100
  });

  it('non-protagonist: total stat gain equals pointsPerLevel', () => {
    const char = makeChar('n', 1, false);
    const before = char.stats;
    const result = applyLevelUp(char, 100, cfg);
    expect(result.character.level).toBe(2);
    const s = result.character.stats;
    const total = (s.hp - before.hp) + (s.atk - before.atk) + (s.def - before.def) + (s.spd - before.spd);
    expect(total).toBe(cfg.nonProtagonist.pointsPerLevel);
    expect(result.expPool).toBe(50);
  });

  it('non-protagonist: hp gain also increases maxHp', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // always picks hp (index 0 in statKeys)
    const char = makeChar('n', 1, false);
    const result = applyLevelUp(char, 100, cfg);
    expect(result.character.stats.hp).toBe(105);
    expect(result.character.stats.maxHp).toBe(105);
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Run — verify tests FAIL**

```bash
cd workspace-pixel-squad && npx vitest run tests/unit/LevelUpSystem.test.ts
```

Expected: module not found errors.

- [ ] **Step 3: Create LevelUpSystem.ts**

Create `workspace-pixel-squad/src/battle/LevelUpSystem.ts`:

```typescript
import type { Character } from '../types';

export interface LevelUpConfig {
  protagonist: { pointsPerLevel: number };
  nonProtagonist: { pointsPerLevel: number };
  expFormula: (level: number) => number;
}

export const DEFAULT_LEVEL_UP_CONFIG: LevelUpConfig = {
  protagonist: { pointsPerLevel: 5 },
  nonProtagonist: { pointsPerLevel: 5 },
  expFormula: (level) => level * 50,
};

export function canLevelUp(
  character: Character,
  expPool: number,
  config: LevelUpConfig,
): boolean {
  return expPool >= config.expFormula(character.level);
}

export function applyLevelUp(
  character: Character,
  expPool: number,
  config: LevelUpConfig,
): { character: Character; expPool: number } {
  const cost = config.expFormula(character.level);
  if (expPool < cost) return { character, expPool };

  const newLevel = character.level + 1;
  const newExpPool = expPool - cost;
  const newExpToNext = config.expFormula(newLevel);

  if (character.isProtagonist) {
    return {
      character: {
        ...character,
        level: newLevel,
        expToNext: newExpToNext,
        statPoints: character.statPoints + config.protagonist.pointsPerLevel,
      },
      expPool: newExpPool,
    };
  }

  const statKeys: Array<'hp' | 'atk' | 'def' | 'spd'> = ['hp', 'atk', 'def', 'spd'];
  const gains: Record<'hp' | 'atk' | 'def' | 'spd', number> = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (let i = 0; i < config.nonProtagonist.pointsPerLevel; i++) {
    gains[statKeys[Math.floor(Math.random() * statKeys.length)]]++;
  }

  return {
    character: {
      ...character,
      level: newLevel,
      expToNext: newExpToNext,
      stats: {
        hp: character.stats.hp + gains.hp,
        maxHp: character.stats.maxHp + gains.hp,
        atk: character.stats.atk + gains.atk,
        def: character.stats.def + gains.def,
        spd: character.stats.spd + gains.spd,
      },
    },
    expPool: newExpPool,
  };
}
```

- [ ] **Step 4: Run all unit tests — verify all pass**

```bash
cd workspace-pixel-squad && npx vitest run
```

Expected: 21 existing + 9 new = 30 tests pass.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/battle/LevelUpSystem.ts workspace-pixel-squad/tests/unit/LevelUpSystem.test.ts
git commit -m "feat(pixel-squad): add LevelUpSystem pure functions with configurable level-up config"
```

---

## Task 2: Add PrepSceneData and expPool to types.ts

**Files:**
- Modify: `workspace-pixel-squad/src/types.ts`

- [ ] **Step 1: Add expPool to BattleSceneData and ResultSceneData, add PrepSceneData**

In `workspace-pixel-squad/src/types.ts`, make these three changes:

**Change 1** — Update `BattleSceneData` (add `expPool`):
```typescript
export interface BattleSceneData {
  playerParty: Character[];
  stageIndex: number;
  expPool?: number;
}
```

**Change 2** — Update `ResultSceneData` (add `expPool`):
```typescript
export interface ResultSceneData {
  victory: boolean;
  playerParty: Character[];
  stageIndex: number;
  expGained: number;
  expPool?: number;
}
```

**Change 3** — Add `PrepSceneData` after `AllocateSceneData`:
```typescript
export interface PrepSceneData {
  playerParty: Character[];
  stageIndex: number;
  expPool: number;
}
```

Also remove `AllocateSceneData` interface (it will no longer be used after Task 6).

Wait — keep `AllocateSceneData` for now until AllocateScene.ts is deleted in Task 6. Remove it then.

- [ ] **Step 2: TypeScript compile check**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/types.ts
git commit -m "feat(pixel-squad): add PrepSceneData and expPool fields to scene data types"
```

---

## Task 3: Create PrepScene.ts

**Files:**
- Create: `workspace-pixel-squad/src/scenes/PrepScene.ts`

- [ ] **Step 1: Create the file**

Create `workspace-pixel-squad/src/scenes/PrepScene.ts` with the following complete implementation:

```typescript
import Phaser from 'phaser';
import type { Character, PrepSceneData } from '../types';
import { canLevelUp, applyLevelUp, DEFAULT_LEVEL_UP_CONFIG } from '../battle/LevelUpSystem';
import { allocateStat } from '../battle/ExpSystem';
import { STAGES } from '../data/stages';

export class PrepScene extends Phaser.Scene {
  private party: Character[] = [];
  private stageIndex = 0;
  private expPool = 0;

  private expPoolText!: Phaser.GameObjects.Text;
  private expPoolBar!: Phaser.GameObjects.Rectangle;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];

  private allocationPanel?: Phaser.GameObjects.Container;
  private currentAllocChar?: Character;
  private currentAllocIndex = 0;
  private pointsText?: Phaser.GameObjects.Text;
  private statValueTexts = new Map<string, Phaser.GameObjects.Text>();

  constructor() { super({ key: 'PrepScene' }); }

  create(data: PrepSceneData) {
    this.party = data.playerParty.map(c => ({ ...c, stats: { ...c.stats } }));
    this.stageIndex = data.stageIndex;
    this.expPool = data.expPool;
    this.rowObjects = [];

    const W = 360, H = 640;
    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    this.add.text(W / 2, 28, '整備', {
      fontSize: '20px', color: '#e5e7eb', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    // EXP Pool display
    this.add.text(20, 68, 'EXP池', { fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace' });
    this.add.rectangle(200, 80, 220, 12, 0x374151).setOrigin(0.5, 0.5);
    this.expPoolBar = this.add.rectangle(90, 80, 0, 10, 0x4ade80).setOrigin(0, 0.5);
    this.expPoolText = this.add.text(320, 68, '0', {
      fontSize: '12px', color: '#4ade80', fontFamily: 'monospace',
    }).setOrigin(1, 0);

    this.add.line(W / 2, 104, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);

    this.updateExpPoolDisplay();
    this.renderPartyList();

    // 出發 button
    const isLastStage = this.stageIndex >= STAGES.length - 1;
    const btnLabel = isLastStage ? '通關！再挑戰' : '出發';
    const btnColor = isLastStage ? 0x7c3aed : 0x16a34a;
    const btn = this.add.rectangle(W / 2, 590, 200, 44, btnColor)
      .setInteractive({ useHandCursor: true });
    this.add.text(W / 2, 590, btnLabel, {
      fontSize: '15px', color: '#fff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    btn.on('pointerdown', () => this.goToNextBattle());
    btn.on('pointerover', () => btn.setAlpha(0.8));
    btn.on('pointerout', () => btn.setAlpha(1));
  }

  private renderPartyList() {
    this.rowObjects.forEach(o => (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy());
    this.rowObjects = [];

    const startY = 120;
    this.party.forEach((char, i) => {
      const y = startY + i * 130;
      const cost = DEFAULT_LEVEL_UP_CONFIG.expFormula(char.level);
      const canUp = canLevelUp(char, this.expPool, DEFAULT_LEVEL_UP_CONFIG);

      const rowBg = this.add.rectangle(180, y + 45, 340, 110, canUp ? 0x1f2937 : 0x161e2e)
        .setStrokeStyle(1, canUp ? 0x4b5563 : 0x1f2937);

      const nameText = this.add.text(24, y + 14, `${char.name}  Lv.${char.level}`, {
        fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
      });

      const statsText = this.add.text(24, y + 38,
        `HP:${char.stats.hp}  ATK:${char.stats.atk}  DEF:${char.stats.def}  SPD:${char.stats.spd}`,
        { fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' });

      const costColor = canUp ? '#4ade80' : '#6b7280';
      const costLabel = canUp ? `▶ 下一級需 ${cost} EXP` : `需 ${cost} EXP（不足）`;
      const costText = this.add.text(24, y + 62, costLabel, {
        fontSize: '11px', color: costColor, fontFamily: 'monospace',
      });

      this.rowObjects.push(rowBg, nameText, statsText, costText);

      if (canUp) {
        const lvBtn = this.add.rectangle(294, y + 45, 76, 36, 0x16a34a)
          .setInteractive({ useHandCursor: true });
        const lvTxt = this.add.text(294, y + 45, '升級', {
          fontSize: '13px', color: '#fff', fontFamily: 'monospace',
        }).setOrigin(0.5);
        lvBtn.on('pointerdown', () => this.handleLevelUp(i));
        lvBtn.on('pointerover', () => lvBtn.setAlpha(0.8));
        lvBtn.on('pointerout', () => lvBtn.setAlpha(1));
        this.rowObjects.push(lvBtn, lvTxt);
      }
    });
  }

  private updateExpPoolDisplay() {
    this.expPoolText.setText(String(this.expPool));
    const maxDisplay = 500;
    const pct = Math.min(1, this.expPool / maxDisplay);
    this.expPoolBar.width = 220 * pct;
  }

  private handleLevelUp(charIndex: number) {
    if (this.allocationPanel) return; // block while panel is open
    const char = this.party[charIndex];
    const result = applyLevelUp(char, this.expPool, DEFAULT_LEVEL_UP_CONFIG);
    this.party[charIndex] = result.character;
    this.expPool = result.expPool;
    this.updateExpPoolDisplay();

    if (result.character.isProtagonist) {
      this.showAllocationPanel(result.character, charIndex);
    } else {
      this.showNonProtagonistSummary(char, result.character);
    }
  }

  private showNonProtagonistSummary(before: Character, after: Character) {
    const W = 360, H = 640;
    const panel = this.add.container(W / 2, H / 2 - 40);
    panel.setDepth(10);

    const bg = this.add.rectangle(0, 0, 300, 160, 0x1f2937).setStrokeStyle(2, 0x4b5563);
    const title = this.add.text(0, -55, `${after.name}  Lv.${before.level} → Lv.${after.level}`, {
      fontSize: '13px', color: '#a78bfa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const gainParts: string[] = [];
    if (after.stats.hp > before.stats.hp) gainParts.push(`HP+${after.stats.hp - before.stats.hp}`);
    if (after.stats.atk > before.stats.atk) gainParts.push(`ATK+${after.stats.atk - before.stats.atk}`);
    if (after.stats.def > before.stats.def) gainParts.push(`DEF+${after.stats.def - before.stats.def}`);
    if (after.stats.spd > before.stats.spd) gainParts.push(`SPD+${after.stats.spd - before.stats.spd}`);
    const gains = gainParts.join('  ') || '無成長';

    const gainText = this.add.text(0, 5, gains, {
      fontSize: '14px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const hint = this.add.text(0, 55, '（點擊繼續）', {
      fontSize: '11px', color: '#6b7280', fontFamily: 'monospace',
    }).setOrigin(0.5);

    panel.add([bg, title, gainText, hint]);
    bg.setInteractive();
    const dismiss = () => { if (panel.active) { panel.destroy(); this.renderPartyList(); } };
    bg.on('pointerdown', dismiss);
    this.time.delayedCall(2000, dismiss);
  }

  private showAllocationPanel(char: Character, charIndex: number) {
    this.currentAllocChar = char;
    this.currentAllocIndex = charIndex;
    this.statValueTexts.clear();

    const W = 360, H = 640;
    this.allocationPanel = this.add.container(W / 2, H / 2 - 20);
    this.allocationPanel.setDepth(10);

    const bg = this.add.rectangle(0, 0, 320, 360, 0x1f2937).setStrokeStyle(2, 0x7c3aed);
    const title = this.add.text(0, -155, `${char.name}  升級 Lv.${char.level}`, {
      fontSize: '13px', color: '#a78bfa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.pointsText = this.add.text(0, -125, `剩餘點數: ${char.statPoints}`, {
      fontSize: '14px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const statDefs: Array<{ key: 'hp' | 'atk' | 'def' | 'spd'; label: string; inc: string }> = [
      { key: 'hp', label: 'HP', inc: '+10' },
      { key: 'atk', label: 'ATK', inc: '+2' },
      { key: 'def', label: 'DEF', inc: '+2' },
      { key: 'spd', label: 'SPD', inc: '+2' },
    ];

    statDefs.forEach(({ key, label, inc }, i) => {
      const y = -70 + i * 60;
      const lbl = this.add.text(-130, y, label, {
        fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0, 0.5);
      const val = this.add.text(10, y, String(char.stats[key]), {
        fontSize: '13px', color: '#a78bfa', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.statValueTexts.set(key, val);
      const btn = this.add.rectangle(100, y, 64, 28, 0x374151)
        .setInteractive({ useHandCursor: true });
      const btnTxt = this.add.text(100, y, inc, {
        fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      btn.on('pointerdown', () => this.spendPoint(key));
      btn.on('pointerover', () => btn.setFillStyle(0x4b5563));
      btn.on('pointerout', () => btn.setFillStyle(0x374151));
      this.allocationPanel!.add([lbl, val, btn, btnTxt]);
    });

    const confirmBtn = this.add.rectangle(0, 140, 140, 36, 0x16a34a)
      .setInteractive({ useHandCursor: true });
    const confirmTxt = this.add.text(0, 140, '確認', {
      fontSize: '14px', color: '#fff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    confirmBtn.on('pointerdown', () => this.closeAllocationPanel());
    confirmBtn.on('pointerover', () => confirmBtn.setAlpha(0.8));
    confirmBtn.on('pointerout', () => confirmBtn.setAlpha(1));

    this.allocationPanel.add([bg, title, this.pointsText, confirmBtn, confirmTxt]);
  }

  private spendPoint(stat: 'hp' | 'atk' | 'def' | 'spd') {
    if (!this.currentAllocChar || this.currentAllocChar.statPoints <= 0) return;
    const updated = allocateStat(this.currentAllocChar, stat);
    this.currentAllocChar = updated;
    this.party[this.currentAllocIndex] = updated;
    this.pointsText?.setText(`剩餘點數: ${updated.statPoints}`);
    this.statValueTexts.get(stat)?.setText(String(updated.stats[stat]));
  }

  private closeAllocationPanel() {
    this.allocationPanel?.destroy();
    this.allocationPanel = undefined;
    this.currentAllocChar = undefined;
    this.renderPartyList();
  }

  private goToNextBattle() {
    if (this.allocationPanel) return; // must confirm allocation first
    const isLastStage = this.stageIndex >= STAGES.length - 1;
    const nextStage = isLastStage ? 0 : this.stageIndex + 1;
    this.scene.start('BattleScene', {
      playerParty: this.party,
      stageIndex: nextStage,
      expPool: this.expPool,
    });
  }
}
```

- [ ] **Step 2: TypeScript compile check**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run unit tests — still passing**

```bash
cd workspace-pixel-squad && npx vitest run
```

Expected: 30 tests pass.

- [ ] **Step 4: Commit**

```bash
git add workspace-pixel-squad/src/scenes/PrepScene.ts
git commit -m "feat(pixel-squad): add PrepScene — shared EXP pool, per-character level-up, manual protagonist allocation"
```

---

## Task 4: Update ResultScene.ts — route to PrepScene, pass expPool

**Files:**
- Modify: `workspace-pixel-squad/src/scenes/ResultScene.ts`

Current behavior: calls `applyExp` on each party member, routes to `AllocateScene` if protagonist has stat points.

New behavior: adds `expGained` to `expPool`, always routes to `PrepScene` on victory (no more conditional AllocateScene routing). EXP is no longer applied at ResultScene — the party is passed as-is to PrepScene.

- [ ] **Step 1: Rewrite ResultScene.ts**

Replace the entire contents of `workspace-pixel-squad/src/scenes/ResultScene.ts`:

```typescript
import Phaser from 'phaser';
import type { ResultSceneData } from '../types';
import { STAGES } from '../data/stages';

export class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  create(data: ResultSceneData) {
    const { victory, playerParty, stageIndex, expGained, expPool = 0 } = data;
    const W = 360, H = 640;

    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    const title = victory ? '勝利！' : '敗北...';
    const titleColor = victory ? '#4ade80' : '#ef4444';
    this.add.text(W / 2, 160, title, {
      fontSize: '36px', color: titleColor, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, 220, STAGES[stageIndex].name, {
      fontSize: '14px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (victory) {
      const newExpPool = expPool + expGained;

      this.add.text(W / 2, 270, `獲得 EXP: +${expGained}`, {
        fontSize: '16px', color: '#fde047', fontFamily: 'monospace',
      }).setOrigin(0.5);

      this.add.text(W / 2, 304, `EXP池: ${newExpPool}`, {
        fontSize: '13px', color: '#4ade80', fontFamily: 'monospace',
      }).setOrigin(0.5);

      let y = 350;
      playerParty.forEach(c => {
        this.add.text(W / 2, y, `${c.name}  Lv.${c.level}`, {
          fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace',
        }).setOrigin(0.5);
        y += 22;
      });

      this.makeButton(W / 2, 520, '整備', 0x7c3aed, () => {
        this.scene.start('PrepScene', {
          playerParty,
          stageIndex,
          expPool: newExpPool,
        });
      });
    } else {
      this.add.text(W / 2, 300, '隊伍全滅', {
        fontSize: '14px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.makeButton(W / 2, 400, '重試', 0x374151, () => {
        this.scene.start('BattleScene', { playerParty: [], stageIndex, expPool });
      });
      this.makeButton(W / 2, 460, '從第一關開始', 0x374151, () => {
        this.scene.start('BattleScene', { playerParty: [], stageIndex: 0, expPool: 0 });
      });
    }
  }

  private makeButton(x: number, y: number, label: string, color: number, cb: () => void) {
    const bg = this.add.rectangle(x, y, 180, 40, color).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, {
      fontSize: '13px', color: '#fff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    bg.on('pointerdown', cb);
    bg.on('pointerover', () => bg.setAlpha(0.8));
    bg.on('pointerout', () => bg.setAlpha(1));
  }
}
```

- [ ] **Step 2: TypeScript compile check**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/scenes/ResultScene.ts
git commit -m "feat(pixel-squad): update ResultScene to route to PrepScene with shared expPool"
```

---

## Task 5: BattleScene.ts — carry expPool through

**Files:**
- Modify: `workspace-pixel-squad/src/scenes/BattleScene.ts`

Three minimal changes: store expPool in class, read it from init data, pass it to ResultScene.

- [ ] **Step 1: Add `expPool` field to BattleScene class**

In `workspace-pixel-squad/src/scenes/BattleScene.ts`, add one line to the class fields (after `private stageIndex = 0;`):

```typescript
  private stageIndex = 0;
  private expPool = 0;
```

- [ ] **Step 2: Read expPool in init()**

In the `init()` method, add one line after `this.stageIndex = data.stageIndex ?? 0;`:

```typescript
    this.stageIndex = data.stageIndex ?? 0;
    this.expPool = data.expPool ?? 0;
```

- [ ] **Step 3: Pass expPool to ResultScene in checkBattleEnd()**

Find the `this.scene.start('ResultScene', {` call in `checkBattleEnd()` and add `expPool`:

```typescript
        this.scene.start('ResultScene', {
          victory,
          playerParty: this.playerParty,
          stageIndex: this.stageIndex,
          expGained,
          expPool: this.expPool,
        });
```

- [ ] **Step 4: TypeScript compile check + unit tests**

```bash
cd workspace-pixel-squad && npx tsc --noEmit && npx vitest run
```

Expected: no errors, 30 tests pass.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/scenes/BattleScene.ts
git commit -m "feat(pixel-squad): carry expPool through BattleScene → ResultScene"
```

---

## Task 6: Register PrepScene, remove AllocateScene

**Files:**
- Modify: `workspace-pixel-squad/src/main.ts`
- Modify: `workspace-pixel-squad/src/types.ts` (remove `AllocateSceneData`)
- Delete: `workspace-pixel-squad/src/scenes/AllocateScene.ts`

- [ ] **Step 1: Update main.ts**

Replace the entire contents of `workspace-pixel-squad/src/main.ts`:

```typescript
import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';
import { PrepScene } from './scenes/PrepScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  backgroundColor: '#111827',
  pixelArt: true,
  parent: 'game',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  scene: [BattleScene, ResultScene, PrepScene],
};

new Phaser.Game(config);
```

- [ ] **Step 2: Remove AllocateSceneData from types.ts**

In `workspace-pixel-squad/src/types.ts`, delete the `AllocateSceneData` interface:

```typescript
// DELETE these lines:
export interface AllocateSceneData {
  playerParty: Character[];
  stageIndex: number;
}
```

- [ ] **Step 3: Delete AllocateScene.ts**

```bash
rm workspace-pixel-squad/src/scenes/AllocateScene.ts
```

- [ ] **Step 4: TypeScript compile check + unit tests**

```bash
cd workspace-pixel-squad && npx tsc --noEmit && npx vitest run
```

Expected: no errors, 30 tests pass.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/main.ts workspace-pixel-squad/src/types.ts
git rm workspace-pixel-squad/src/scenes/AllocateScene.ts
git commit -m "feat(pixel-squad): swap AllocateScene for PrepScene, remove AllocateSceneData"
```

---

## Task 7: Full check + push

- [ ] **Step 1: Run full checks**

```bash
cd workspace-pixel-squad && npx vitest run && npx tsc --noEmit && npx vite build
```

Expected: 30 tests pass, no TS errors, build succeeds.

- [ ] **Step 2: Manual browser smoke test**

```bash
cd workspace-pixel-squad && npx vite
```

Open `http://localhost:5173` and verify:
- Fight a battle → win → ResultScene shows "獲得 EXP: +X" and "EXP池: X" → 整備 button
- 整備 button → PrepScene shows EXP pool bar + party list
- Click 升級 on a character with enough pool EXP:
  - Non-protagonist: summary overlay appears (auto stat gains), dismisses after 2s or tap
  - Protagonist: allocation panel appears, +hp/atk/def/spd buttons work, 確認 closes panel
- Same character can be leveled multiple times if pool allows
- 出發 button → next BattleScene (expPool carries through)
- On last stage 出發 → restarts from stage 0 with button label "通關！再挑戰"
- Defeat → retry/restart still works

- [ ] **Step 3: Push**

```bash
git push origin master
```

Expected: CI green (unit tests + build).

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|-----------------|------|
| EXP pool shared, carries across battles | Task 2 (types), Task 4 (ResultScene), Task 5 (BattleScene) |
| PrepScene replaces AllocateScene | Task 3 + Task 6 |
| Select any character to level up | Task 3 `renderPartyList` + `handleLevelUp` |
| Multiple level-ups per session | Task 3 `handleLevelUp` (no limit) |
| Protagonist: 5 pts manual allocation | Task 1 `applyLevelUp` + Task 3 `showAllocationPanel` |
| Non-protagonist: 5 pts random | Task 1 `applyLevelUp` (random distribution) |
| LevelUpConfig decoupled from UI | Task 1 `DEFAULT_LEVEL_UP_CONFIG` |
| EXP formula configurable | Task 1 `LevelUpConfig.expFormula` |
| Disable upgrade when pool insufficient | Task 3 `canLevelUp` check in `renderPartyList` |
| 出發 → next battle with expPool | Task 3 `goToNextBattle` |
| Last stage → restart from 0 | Task 3 `goToNextBattle` isLastStage check |

**No placeholders, no TBD.**

**Type consistency:** `PrepSceneData {playerParty, stageIndex, expPool}` defined in Task 2, used in Task 3 (`create(data: PrepSceneData)`). `expPool` field name consistent across all 5 tasks. `DEFAULT_LEVEL_UP_CONFIG` used in both Task 1 tests and Task 3 scene.
