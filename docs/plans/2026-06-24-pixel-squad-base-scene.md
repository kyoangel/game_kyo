# Pixel Squad — BaseScene + GameState Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `GameState` through the full battle flow (BattleScene → ResultScene → BaseScene) and build BaseScene with two modes: base mode (squad select + level-up) and in-chapter mode (level-up only).

**Architecture:** `BattleSceneData` gains an optional `gameState?: GameState`. BattleScene passes it to ResultScene. ResultScene gains GameState-aware victory logic: marks stage complete, checks stage unlock, handles recruit, saves. BaseScene is a new Phaser scene with two display modes driven by `inChapterRun`. Squad management (add/remove) mutates `gameState.squad` and auto-saves.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest (node environment)

**Prerequisites:**
- Plan `2026-06-24-pixel-squad-save-system.md` complete (`GameState`, `SaveSystem`, `newGame`)
- Plan `2026-06-24-pixel-squad-world-map.md` complete (extended `Stage` with `unlockCharacterId`, `STAGES`)
- Plan `2026-06-24-pixel-squad-character-pool.md` complete (`CharacterTemplate` with `unlockMethod`, 12 templates, `ResultSceneData.recruitedEnemy`)

---

## File Map

| File | Action |
|------|--------|
| `workspace-pixel-squad/src/types.ts` | MODIFY — add `gameState?: GameState` to `BattleSceneData` |
| `workspace-pixel-squad/src/scenes/BattleScene.ts` | MODIFY — store gameState, pass through to ResultScene |
| `workspace-pixel-squad/src/scenes/ResultScene.ts` | MODIFY — GameState victory logic (stage complete, unlock, recruit, save) |
| `workspace-pixel-squad/src/scenes/BaseScene.ts` | CREATE — two-mode hub scene |
| `workspace-pixel-squad/src/main.ts` | MODIFY — register BaseScene |
| `workspace-pixel-squad/tests/unit/ResultLogic.test.ts` | CREATE — unit tests for victory GameState mutation logic |

---

### Task 1: Extend BattleSceneData and pass gameState through BattleScene

**Files:**
- Modify: `workspace-pixel-squad/src/types.ts`
- Modify: `workspace-pixel-squad/src/scenes/BattleScene.ts`

- [ ] **Step 1: Add gameState to BattleSceneData in types.ts**

In `workspace-pixel-squad/src/types.ts`, replace `BattleSceneData`:

```typescript
export interface BattleSceneData {
  playerParty: Character[];
  stageIndex: number;
  expPool?: number;
  gameState?: GameState;  // passed through for GameState-aware flow
}
```

- [ ] **Step 2: Store and pass gameState in BattleScene**

In `workspace-pixel-squad/src/scenes/BattleScene.ts`:

1. Add private field after `private expPool = 0;`:
```typescript
private gameState?: GameState;
```

2. Add import at top:
```typescript
import type { GameState } from '../types';
```

3. In the `init` method, after `this.expPool = data.expPool ?? 0;`, add:
```typescript
this.gameState = data.gameState;
```

4. In `checkBattleEnd`, update the ResultScene call to include gameState:
```typescript
this.scene.start('ResultScene', {
  victory,
  playerParty: this.playerParty,
  stageIndex: this.stageIndex,
  expGained,
  expPool: this.expPool,
  recruitedEnemy: this.recruitedEnemy,
  gameState: this.gameState,
});
```

5. Also update `ResultSceneData` in `types.ts` to include `gameState?`:
```typescript
export interface ResultSceneData {
  victory: boolean;
  playerParty: Character[];
  stageIndex: number;
  expGained: number;
  expPool?: number;
  recruitedEnemy?: Character;
  gameState?: GameState;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add workspace-pixel-squad/src/types.ts workspace-pixel-squad/src/scenes/BattleScene.ts
git commit -m "feat(pixel-squad): thread GameState through BattleScene to ResultScene"
```

---

### Task 2: Extract and test ResultScene victory GameState logic

**Files:**
- Create: `workspace-pixel-squad/src/battle/VictoryProcessor.ts`
- Create: `workspace-pixel-squad/tests/unit/ResultLogic.test.ts`

The GameState mutation on victory is complex enough to extract into a pure function.

- [ ] **Step 1: Write failing tests**

Create `workspace-pixel-squad/tests/unit/ResultLogic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { GameState, Character, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

function makeGameState(): GameState {
  const state = newGame(0);
  return state;
}

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [], expReward: 40, currencyReward: 20,
    ...overrides,
  };
}

function makeEnemy(templateId: string, name: string): Character {
  return {
    id: 'e1', templateId, name, isProtagonist: false, isPlayer: false,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 0, maxHp: 100, atk: 10, def: 5, spd: 8 },
    skills: [], statPoints: 0, archetype: '坦克', alive: false, defending: false,
    recruited: true,
  };
}

describe('processVictory', () => {
  it('adds stageId to completedStageIds if not already present', () => {
    const state = makeGameState();
    const stage = makeStage({ id: '1-1', currencyReward: 20 });
    const result = processVictory(state, stage, 40, undefined);
    expect(result.stageProgress.completedStageIds).toContain('1-1');
  });

  it('does not duplicate stageId on replay', () => {
    const state = makeGameState();
    state.stageProgress.completedStageIds = ['1-1'];
    const stage = makeStage({ id: '1-1', currencyReward: 20 });
    const result = processVictory(state, stage, 40, undefined);
    expect(result.stageProgress.completedStageIds.filter(id => id === '1-1')).toHaveLength(1);
  });

  it('adds currency reward', () => {
    const state = makeGameState();
    state.currency = 100;
    const stage = makeStage({ currencyReward: 50 });
    const result = processVictory(state, stage, 40, undefined);
    expect(result.currency).toBe(150);
  });

  it('adds expGained to expPool', () => {
    const state = makeGameState();
    state.expPool = 100;
    const stage = makeStage();
    const result = processVictory(state, stage, 40, undefined);
    expect(result.expPool).toBe(140);
  });

  it('adds unlock character to pool on first clear', () => {
    const state = makeGameState();
    const stage = makeStage({ unlockCharacterId: 'rex' });
    const result = processVictory(state, stage, 0, undefined);
    const hasRex = result.pool.some(c => c.templateId === 'rex');
    expect(hasRex).toBe(true);
  });

  it('does not add unlock character if already in pool', () => {
    const state = makeGameState();
    state.stageProgress.completedStageIds = ['1-2']; // already cleared
    state.pool.push({ id: 'rex_1', templateId: 'rex' } as Character);
    const stage = makeStage({ id: '1-2', unlockCharacterId: 'rex' });
    const result = processVictory(state, stage, 0, undefined);
    expect(result.pool.filter(c => c.templateId === 'rex')).toHaveLength(1);
  });

  it('adds recruited enemy to pool', () => {
    const state = makeGameState();
    const stage = makeStage();
    const enemy = makeEnemy('vega', 'Vega');
    const result = processVictory(state, stage, 0, enemy);
    const hasVega = result.pool.some(c => c.templateId === 'vega');
    expect(hasVega).toBe(true);
  });

  it('clears inChapterRun when last stage of chapter (stageIndex 4)', () => {
    const state = makeGameState();
    state.stageProgress.inChapterRun = {
      chapterId: 'ch1', currentStageIndex: 4, lockedSquad: [],
    };
    const stage = makeStage({ id: '1-5', stageIndex: 4, chapterId: 'ch1', isBoss: true });
    const result = processVictory(state, stage, 0, undefined);
    expect(result.stageProgress.inChapterRun).toBeUndefined();
  });

  it('advances inChapterRun.currentStageIndex when not last stage', () => {
    const state = makeGameState();
    state.stageProgress.inChapterRun = {
      chapterId: 'ch1', currentStageIndex: 1, lockedSquad: [],
    };
    const stage = makeStage({ id: '1-2', stageIndex: 1, chapterId: 'ch1' });
    const result = processVictory(state, stage, 0, undefined);
    expect(result.stageProgress.inChapterRun?.currentStageIndex).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: FAIL — `Cannot find module '../../src/battle/VictoryProcessor'`

- [ ] **Step 3: Create VictoryProcessor.ts**

Create `workspace-pixel-squad/src/battle/VictoryProcessor.ts`:

```typescript
import type { Character, GameState, Stage } from '../types';
import { createCharacter } from './CharacterFactory';
import { PLAYER_TEMPLATES } from '../data/characters';

export function processVictory(
  gameState: GameState,
  stage: Stage,
  expGained: number,
  recruitedEnemy: Character | undefined,
): GameState {
  const state: GameState = {
    ...gameState,
    pool: [...gameState.pool],
    squad: [...gameState.squad],
    stageProgress: {
      ...gameState.stageProgress,
      completedStageIds: [...gameState.stageProgress.completedStageIds],
      inChapterRun: gameState.stageProgress.inChapterRun
        ? { ...gameState.stageProgress.inChapterRun, lockedSquad: [...gameState.stageProgress.inChapterRun.lockedSquad] }
        : undefined,
    },
  };

  // Add to completed stages (no duplicates)
  if (!state.stageProgress.completedStageIds.includes(stage.id)) {
    state.stageProgress.completedStageIds.push(stage.id);
  }

  // Add currency
  state.currency += stage.currencyReward;

  // Add EXP to pool
  state.expPool += expGained;

  // Stage unlock (only on first clear)
  const isFirstClear = !gameState.stageProgress.completedStageIds.includes(stage.id);
  if (isFirstClear && stage.unlockCharacterId) {
    const alreadyInPool = state.pool.some(c => c.templateId === stage.unlockCharacterId);
    if (!alreadyInPool) {
      const template = PLAYER_TEMPLATES.find(t => t.id === stage.unlockCharacterId);
      if (template) {
        state.pool.push(createCharacter(template, 1));
      }
    }
  }

  // Recruit: add recruited enemy to pool
  if (recruitedEnemy) {
    const alreadyInPool = state.pool.some(c => c.templateId === recruitedEnemy.templateId);
    if (!alreadyInPool) {
      const template = PLAYER_TEMPLATES.find(t => t.id === recruitedEnemy.templateId);
      if (template) {
        state.pool.push(createCharacter(template, Math.max(1, recruitedEnemy.level)));
      }
    }
  }

  // Update chapter run state
  if (state.stageProgress.inChapterRun?.chapterId === stage.chapterId) {
    if (stage.stageIndex >= 4) {
      // Last stage of chapter — clear run
      state.stageProgress.inChapterRun = undefined;
    } else {
      state.stageProgress.inChapterRun.currentStageIndex = stage.stageIndex + 1;
    }
  }

  state.savedAt = Date.now();
  return state;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: all VictoryProcessor tests PASS. All other tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/battle/VictoryProcessor.ts workspace-pixel-squad/tests/unit/ResultLogic.test.ts
git commit -m "feat(pixel-squad): add VictoryProcessor for GameState mutation on battle victory"
```

---

### Task 3: Update ResultScene to use VictoryProcessor

**Files:**
- Modify: `workspace-pixel-squad/src/scenes/ResultScene.ts`

- [ ] **Step 1: Rewrite ResultScene.create with GameState-aware victory path**

Replace the entire `ResultScene.ts` content:

```typescript
import Phaser from 'phaser';
import type { ResultSceneData } from '../types';
import { STAGES } from '../data/stages';
import { saveSlot } from '../save/SaveSystem';
import { processVictory } from '../battle/VictoryProcessor';

export class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  create(data: ResultSceneData) {
    const { victory, playerParty, stageIndex, expGained, expPool = 0, recruitedEnemy, gameState } = data;
    const W = 360, H = 640;

    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    const title = victory ? '勝利！' : '敗北...';
    const titleColor = victory ? '#4ade80' : '#ef4444';
    this.add.text(W / 2, 160, title, {
      fontSize: '36px', color: titleColor, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    const stage = STAGES[stageIndex];
    this.add.text(W / 2, 220, stage.name, {
      fontSize: '14px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (victory) {
      // Process GameState if available
      let updatedGameState = gameState;
      if (gameState && stage) {
        updatedGameState = processVictory(gameState, stage, expGained, recruitedEnemy);
        saveSlot(updatedGameState);
      }
      const newExpPool = updatedGameState?.expPool ?? (expPool + expGained);

      this.add.text(W / 2, 270, `獲得 EXP: +${expGained}`, {
        fontSize: '16px', color: '#fde047', fontFamily: 'monospace',
      }).setOrigin(0.5);

      this.add.text(W / 2, 300, `EXP池: ${newExpPool}`, {
        fontSize: '13px', color: '#4ade80', fontFamily: 'monospace',
      }).setOrigin(0.5);

      if (stage?.currencyReward) {
        this.add.text(W / 2, 322, `幣: +${stage.currencyReward}`, {
          fontSize: '13px', color: '#fde047', fontFamily: 'monospace',
        }).setOrigin(0.5);
      }

      if (recruitedEnemy) {
        this.add.text(W / 2, 346, `新成員：${recruitedEnemy.name} 加入了！`, {
          fontSize: '14px', color: '#a78bfa', fontFamily: 'monospace',
        }).setOrigin(0.5);
      }

      let y = 374;
      playerParty.forEach(c => {
        this.add.text(W / 2, y, `${c.name}  Lv.${c.level}`, {
          fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace',
        }).setOrigin(0.5);
        y += 22;
      });

      this.makeButton(W / 2, 530, '整備', 0x7c3aed, () => {
        if (updatedGameState) {
          this.scene.start('BaseScene', updatedGameState);
        } else {
          // Legacy path (no GameState)
          this.scene.start('PrepScene', {
            playerParty,
            stageIndex,
            expPool: newExpPool,
          });
        }
      });
    } else {
      this.add.text(W / 2, 300, '隊伍全滅', {
        fontSize: '14px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);

      // If in chapter run, clear it on wipe
      if (gameState?.stageProgress.inChapterRun) {
        const clearedState = {
          ...gameState,
          stageProgress: {
            ...gameState.stageProgress,
            inChapterRun: undefined,
          },
        };
        saveSlot(clearedState);
      }

      this.makeButton(W / 2, 400, '重試', 0x374151, () => {
        if (gameState) {
          this.scene.start('BaseScene', gameState);
        } else {
          this.scene.start('BattleScene', { playerParty: [], stageIndex, expPool });
        }
      });
      this.makeButton(W / 2, 460, '世界地圖', 0x374151, () => {
        if (gameState) {
          this.scene.start('WorldMapScene', gameState);
        } else {
          this.scene.start('BattleScene', { playerParty: [], stageIndex: 0, expPool: 0 });
        }
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

- [ ] **Step 2: Verify TypeScript compiles and all tests pass**

```bash
cd workspace-pixel-squad && npx tsc --noEmit && npm run test:unit
```

Expected: no errors, all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/scenes/ResultScene.ts
git commit -m "feat(pixel-squad): update ResultScene with GameState-aware victory processing"
```

---

### Task 4: Create BaseScene

**Files:**
- Create: `workspace-pixel-squad/src/scenes/BaseScene.ts`

Note: BaseScene is a Phaser scene — no unit tests. The level-up logic is handled by the existing pure functions `canLevelUp` / `applyLevelUp` / `allocateStat`.

- [ ] **Step 1: Create BaseScene.ts**

Create `workspace-pixel-squad/src/scenes/BaseScene.ts`:

```typescript
import Phaser from 'phaser';
import type { Character, GameState } from '../types';
import { canLevelUp, applyLevelUp, DEFAULT_LEVEL_UP_CONFIG } from '../battle/LevelUpSystem';
import { allocateStat } from '../battle/ExpSystem';
import { saveSlot } from '../save/SaveSystem';
import { CHAPTERS } from '../data/chapters';

export class BaseScene extends Phaser.Scene {
  private gameState!: GameState;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private expPoolText!: Phaser.GameObjects.Text;
  private expPoolBar!: Phaser.GameObjects.Rectangle;
  private currencyText!: Phaser.GameObjects.Text;

  private allocationPanel?: Phaser.GameObjects.Container;
  private currentAllocChar?: Character;
  private currentAllocIndex = 0;
  private pointsText?: Phaser.GameObjects.Text;
  private statValueTexts = new Map<string, Phaser.GameObjects.Text>();

  constructor() { super({ key: 'BaseScene' }); }

  create(gameState: GameState) {
    this.gameState = gameState;
    this.rowObjects = [];

    const W = 360, H = 640;
    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    const isInChapter = !!gameState.stageProgress.inChapterRun;
    const title = isInChapter ? '整備' : '基地';
    this.add.text(W / 2, 24, title, {
      fontSize: '20px', color: '#e5e7eb', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Currency display
    this.currencyText = this.add.text(320, 24, `幣:${gameState.currency}`, {
      fontSize: '12px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(1, 0.5);

    // EXP Pool bar
    this.add.text(20, 48, 'EXP池', { fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace' });
    this.add.rectangle(200, 60, 220, 12, 0x374151).setOrigin(0.5, 0.5);
    this.expPoolBar = this.add.rectangle(90, 60, 0, 10, 0x4ade80).setOrigin(0, 0.5);
    this.expPoolText = this.add.text(320, 48, '0', {
      fontSize: '12px', color: '#4ade80', fontFamily: 'monospace',
    }).setOrigin(1, 0);

    this.updateExpPoolDisplay();

    if (isInChapter) {
      this.renderInChapterMode();
    } else {
      this.renderBaseMode();
    }
  }

  private updateExpPoolDisplay() {
    this.expPoolText.setText(String(this.gameState.expPool));
    const pct = Math.min(1, this.gameState.expPool / 500);
    this.expPoolBar.width = 220 * pct;
  }

  // ─── Base Mode ────────────────────────────────────────────────────────────

  private renderBaseMode() {
    const W = 360;
    this.add.line(W / 2, 84, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);

    this.add.text(20, 90, '出戰中 (最多5人)', {
      fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace',
    });

    this.renderSquadSection(100);

    // 世界地圖 button
    const mapBtn = this.add.rectangle(W / 2, 600, 200, 40, 0x1d4ed8)
      .setInteractive({ useHandCursor: true });
    this.add.text(W / 2, 600, '世界地圖', {
      fontSize: '15px', color: '#fff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    mapBtn.on('pointerdown', () => {
      saveSlot(this.gameState);
      this.scene.start('WorldMapScene', this.gameState);
    });
    mapBtn.on('pointerover', () => mapBtn.setAlpha(0.8));
    mapBtn.on('pointerout', () => mapBtn.setAlpha(1));
  }

  private renderSquadSection(startY: number) {
    this.rowObjects.forEach(o => (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy());
    this.rowObjects = [];

    const W = 360;
    let y = startY;

    // Active squad
    this.gameState.squad.forEach((char, i) => {
      y = this.renderCharCard(char, i, y, true);
    });

    // Bench section
    const bench = this.gameState.pool.filter(
      p => !this.gameState.squad.some(s => s.id === p.id)
    );
    if (bench.length > 0) {
      const sep = this.add.text(20, y + 4, '角色庫', {
        fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace',
      });
      this.rowObjects.push(sep);
      y += 22;
      bench.forEach((char, i) => {
        y = this.renderCharCard(char, i, y, false);
      });
    }
  }

  private renderCharCard(char: Character, _index: number, y: number, inSquad: boolean): number {
    const W = 360;
    const cost = DEFAULT_LEVEL_UP_CONFIG.expFormula(char.level);
    const canUp = canLevelUp(char, this.gameState.expPool, DEFAULT_LEVEL_UP_CONFIG);

    const rowBg = this.add.rectangle(180, y + 42, 340, 76, inSquad ? 0x1f2937 : 0x161e2e)
      .setStrokeStyle(1, inSquad ? 0x4b5563 : 0x1f2937);
    const nameText = this.add.text(24, y + 14, `${char.name}  Lv.${char.level}  ${char.archetype}`, {
      fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace',
    });
    const statsText = this.add.text(24, y + 34, `HP:${char.stats.hp}  ATK:${char.stats.atk}  DEF:${char.stats.def}  SPD:${char.stats.spd}`, {
      fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace',
    });
    this.rowObjects.push(rowBg, nameText, statsText);

    // Level up button
    if (canUp) {
      const lvBtn = this.add.rectangle(260, y + 42, 66, 32, 0x16a34a)
        .setInteractive({ useHandCursor: true });
      const lvTxt = this.add.text(260, y + 42, '升級', {
        fontSize: '12px', color: '#fff', fontFamily: 'monospace',
      }).setOrigin(0.5);
      lvBtn.on('pointerdown', () => this.handleLevelUp(char));
      lvBtn.on('pointerover', () => lvBtn.setAlpha(0.8));
      lvBtn.on('pointerout', () => lvBtn.setAlpha(1));
      this.rowObjects.push(lvBtn, lvTxt);
    }

    // Add/remove squad button (base mode only, not in-chapter)
    if (!this.gameState.stageProgress.inChapterRun) {
      const toggleLabel = inSquad ? '移出' : '加入';
      const toggleColor = inSquad ? 0x7f1d1d : 0x16a34a;
      const canToggle = inSquad
        ? this.gameState.squad.length > 1
        : this.gameState.squad.length < 5;
      if (canToggle) {
        const toggleBtn = this.add.rectangle(320, y + 42, 50, 32, toggleColor)
          .setInteractive({ useHandCursor: true });
        const toggleTxt = this.add.text(320, y + 42, toggleLabel, {
          fontSize: '11px', color: '#fff', fontFamily: 'monospace',
        }).setOrigin(0.5);
        toggleBtn.on('pointerdown', () => this.toggleSquad(char, inSquad));
        toggleBtn.on('pointerover', () => toggleBtn.setAlpha(0.8));
        toggleBtn.on('pointerout', () => toggleBtn.setAlpha(1));
        this.rowObjects.push(toggleBtn, toggleTxt);
      }
    }

    const _ = cost; // suppress unused warning
    return y + 84;
  }

  private toggleSquad(char: Character, isInSquad: boolean) {
    if (this.allocationPanel) return;
    if (isInSquad) {
      if (this.gameState.squad.length <= 1) return;
      this.gameState.squad = this.gameState.squad.filter(c => c.id !== char.id);
    } else {
      if (this.gameState.squad.length >= 5) return;
      this.gameState.squad = [...this.gameState.squad, char];
    }
    saveSlot(this.gameState);
    this.renderSquadSection(100);
  }

  // ─── In-Chapter Mode ──────────────────────────────────────────────────────

  private renderInChapterMode() {
    const W = 360;
    const run = this.gameState.stageProgress.inChapterRun!;
    const chapter = CHAPTERS.find(c => c.id === run.chapterId);
    const chapterName = chapter?.name ?? run.chapterId;
    const stageLabel = `${chapterName} ${run.currentStageIndex + 1}/5關`;

    this.add.text(W / 2, 84, stageLabel, {
      fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.line(W / 2, 100, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);

    this.add.text(20, 106, '出戰中 (鎖定)', {
      fontSize: '12px', color: '#6b7280', fontFamily: 'monospace',
    });

    // Render locked squad (level-up buttons only, no add/remove)
    let y = 118;
    run.lockedSquad.forEach(char => {
      y = this.renderCharCard(char, 0, y, true);
    });

    // 繼續 and 放棄本章 buttons
    const continueBtn = this.add.rectangle(240, 600, 130, 40, 0x16a34a)
      .setInteractive({ useHandCursor: true });
    this.add.text(240, 600, '繼續', {
      fontSize: '14px', color: '#fff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    continueBtn.on('pointerdown', () => this.continueChapter());
    continueBtn.on('pointerover', () => continueBtn.setAlpha(0.8));
    continueBtn.on('pointerout', () => continueBtn.setAlpha(1));

    const abandonBtn = this.add.rectangle(100, 600, 130, 40, 0x7f1d1d)
      .setInteractive({ useHandCursor: true });
    this.add.text(100, 600, '放棄本章', {
      fontSize: '14px', color: '#fff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    abandonBtn.on('pointerdown', () => this.abandonChapter());
    abandonBtn.on('pointerover', () => abandonBtn.setAlpha(0.8));
    abandonBtn.on('pointerout', () => abandonBtn.setAlpha(1));
  }

  private continueChapter() {
    if (this.allocationPanel) return;
    const run = this.gameState.stageProgress.inChapterRun!;
    const { STAGES } = require('../data/stages');
    const stageArrayIndex = STAGES.findIndex(
      (s: { chapterId: string; stageIndex: number }) =>
        s.chapterId === run.chapterId && s.stageIndex === run.currentStageIndex
    );
    if (stageArrayIndex < 0) return;
    saveSlot(this.gameState);
    this.scene.start('BattleScene', {
      playerParty: run.lockedSquad,
      stageIndex: stageArrayIndex,
      expPool: this.gameState.expPool,
      gameState: this.gameState,
    });
  }

  private abandonChapter() {
    this.gameState.stageProgress.inChapterRun = undefined;
    saveSlot(this.gameState);
    this.scene.start('WorldMapScene', this.gameState);
  }

  // ─── Level-Up (shared between modes) ─────────────────────────────────────

  private handleLevelUp(char: Character) {
    if (this.allocationPanel) return;
    const result = applyLevelUp(char, this.gameState.expPool, DEFAULT_LEVEL_UP_CONFIG);

    // Update char in both squad and pool
    this.updateCharInState(result.character);
    this.gameState.expPool = result.expPool;
    this.updateExpPoolDisplay();
    saveSlot(this.gameState);

    if (result.character.isProtagonist) {
      this.showAllocationPanel(result.character);
    } else {
      this.showNonProtagonistSummary(char, result.character);
    }
  }

  private updateCharInState(updated: Character) {
    const squadIdx = this.gameState.squad.findIndex(c => c.id === updated.id);
    if (squadIdx >= 0) this.gameState.squad[squadIdx] = updated;
    const poolIdx = this.gameState.pool.findIndex(c => c.id === updated.id);
    if (poolIdx >= 0) this.gameState.pool[poolIdx] = updated;

    // Also update lockedSquad if in chapter
    if (this.gameState.stageProgress.inChapterRun) {
      const run = this.gameState.stageProgress.inChapterRun;
      const lockedIdx = run.lockedSquad.findIndex(c => c.id === updated.id);
      if (lockedIdx >= 0) run.lockedSquad[lockedIdx] = updated;
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
    const dismiss = () => {
      if (panel.active) {
        panel.destroy();
        const isInChapter = !!this.gameState.stageProgress.inChapterRun;
        if (isInChapter) { this.renderInChapterMode(); } else { this.renderSquadSection(100); }
      }
    };
    bg.on('pointerdown', dismiss);
    this.time.delayedCall(2000, dismiss);
  }

  private showAllocationPanel(char: Character) {
    this.currentAllocChar = char;
    this.statValueTexts.clear();

    const W = 360, H = 640;
    this.allocationPanel = this.add.container(W / 2, H / 2 - 20);
    this.allocationPanel.setDepth(10);

    const bg = this.add.rectangle(0, 0, 320, 360, 0x1f2937).setStrokeStyle(2, 0x7c3aed);
    this.allocationPanel.add(bg);

    const title = this.add.text(0, -155, `${char.name}  升級 Lv.${char.level}`, {
      fontSize: '14px', color: '#a78bfa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.pointsText = this.add.text(0, -125, `剩餘點數: ${char.statPoints}`, {
      fontSize: '15px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.allocationPanel.add([title, this.pointsText]);

    const statDefs: Array<{ key: 'hp' | 'atk' | 'def' | 'spd'; label: string; inc: string }> = [
      { key: 'hp', label: 'HP', inc: '+10' },
      { key: 'atk', label: 'ATK', inc: '+2' },
      { key: 'def', label: 'DEF', inc: '+2' },
      { key: 'spd', label: 'SPD', inc: '+2' },
    ];

    statDefs.forEach(({ key, label, inc }, i) => {
      const y = -70 + i * 60;
      const lbl = this.add.text(-130, y, label, {
        fontSize: '15px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0, 0.5);
      const val = this.add.text(10, y, String(char.stats[key]), {
        fontSize: '15px', color: '#a78bfa', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.statValueTexts.set(key, val);
      const btn = this.add.rectangle(100, y, 70, 32, 0x374151)
        .setInteractive({ useHandCursor: true });
      const btnTxt = this.add.text(100, y, inc, {
        fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      btn.on('pointerdown', () => this.spendPoint(key));
      btn.on('pointerover', () => btn.setFillStyle(0x4b5563));
      btn.on('pointerout', () => btn.setFillStyle(0x374151));
      this.allocationPanel!.add([lbl, val, btn, btnTxt]);
    });

    const confirmBtn = this.add.rectangle(0, 140, 160, 40, 0x16a34a)
      .setInteractive({ useHandCursor: true });
    const confirmTxt = this.add.text(0, 140, '確認', {
      fontSize: '16px', color: '#fff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    confirmBtn.on('pointerdown', () => this.closeAllocationPanel());
    confirmBtn.on('pointerover', () => confirmBtn.setAlpha(0.8));
    confirmBtn.on('pointerout', () => confirmBtn.setAlpha(1));
    this.allocationPanel.add([confirmBtn, confirmTxt]);
  }

  private spendPoint(stat: 'hp' | 'atk' | 'def' | 'spd') {
    if (!this.currentAllocChar || this.currentAllocChar.statPoints <= 0) return;
    const updated = allocateStat(this.currentAllocChar, stat);
    this.currentAllocChar = updated;
    this.updateCharInState(updated);
    this.pointsText?.setText(`剩餘點數: ${updated.statPoints}`);
    this.statValueTexts.get(stat)?.setText(String(updated.stats[stat]));
    saveSlot(this.gameState);
  }

  private closeAllocationPanel() {
    this.allocationPanel?.destroy();
    this.allocationPanel = undefined;
    this.currentAllocChar = undefined;
    const isInChapter = !!this.gameState.stageProgress.inChapterRun;
    if (isInChapter) { this.renderInChapterMode(); } else { this.renderSquadSection(100); }
  }
}
```

**Note:** The `require` call in `continueChapter` is for runtime import to avoid circular dependencies. If TypeScript complains, replace with a static import: add `import { STAGES } from '../data/stages';` at the top of the file and remove the `require` call.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

If there are `require` errors, add the static STAGES import and remove the require call as noted above.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/scenes/BaseScene.ts
git commit -m "feat(pixel-squad): add BaseScene with base/in-chapter modes and squad management"
```

---

### Task 5: Register BaseScene in main.ts

**Files:**
- Modify: `workspace-pixel-squad/src/main.ts`

- [ ] **Step 1: Update main.ts**

Replace `workspace-pixel-squad/src/main.ts`:

```typescript
import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { BaseScene } from './scenes/BaseScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';
import { PrepScene } from './scenes/PrepScene';
import { WorldMapScene } from './scenes/WorldMapScene';

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
  scene: [TitleScene, BaseScene, BattleScene, ResultScene, PrepScene, WorldMapScene],
};

new Phaser.Game(config);
```

- [ ] **Step 2: Verify TypeScript and tests**

```bash
cd workspace-pixel-squad && npx tsc --noEmit && npm run test:unit
```

Expected: no errors, all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/main.ts
git commit -m "feat(pixel-squad): register BaseScene in main.ts"
```

---

## Summary

After all tasks:
- `BattleSceneData` + `ResultSceneData` carry `gameState?: GameState`
- `VictoryProcessor.ts` handles all GameState mutations on victory (stage complete, currency, EXP, unlock, recruit, chapter run state)
- `ResultScene` uses VictoryProcessor, saves state, routes to `BaseScene` or legacy `PrepScene`
- `BaseScene` shows base mode (squad select + level-up + world map) or in-chapter mode (level-up + continue/abandon)
- Unit tests: `ResultLogic.test.ts` covers VictoryProcessor (9 tests)

**Next plan to implement:** `2026-06-24-pixel-squad-boss-ai.md`
