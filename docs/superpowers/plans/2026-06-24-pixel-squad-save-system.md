# Pixel Squad — Save System + TitleScene + GameState Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-slot auto-save system with GameState types, SaveSystem pure functions, and a TitleScene that lets players choose a save slot.

**Architecture:** GameState (interfaces) lives in `src/types.ts`. Pure save/load functions live in `src/save/SaveSystem.ts`. The `newGame()` factory that creates an initial GameState lives in `src/save/GameState.ts` (needs `createCharacter` dependency). TitleScene is a new Phaser scene registered as the first scene in `main.ts`.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest (node environment), localStorage

---

## File Map

| File | Action |
|------|--------|
| `workspace-pixel-squad/src/types.ts` | MODIFY — add `GameState`, `StageProgress`, `ChapterRunState` interfaces |
| `workspace-pixel-squad/src/save/SaveSystem.ts` | CREATE — `SlotMeta`, `saveSlot`, `loadSlot`, `deleteSlot`, `listSlots` |
| `workspace-pixel-squad/src/save/GameState.ts` | CREATE — `newGame(slot)` factory |
| `workspace-pixel-squad/src/scenes/TitleScene.ts` | CREATE — Phaser scene for slot picker |
| `workspace-pixel-squad/src/main.ts` | MODIFY — register TitleScene, make it first scene |
| `workspace-pixel-squad/tests/unit/SaveSystem.test.ts` | CREATE — unit tests for pure save functions |

---

### Task 1: Add GameState interfaces to types.ts

**Files:**
- Modify: `workspace-pixel-squad/src/types.ts`

- [ ] **Step 1: Add the three interfaces to the end of `src/types.ts`**

Open `workspace-pixel-squad/src/types.ts` and append after the last existing interface:

```typescript
export interface ChapterRunState {
  chapterId: string;
  currentStageIndex: number;   // 0–4, which stage within chapter is next
  lockedSquad: Character[];    // squad frozen for this run
}

export interface StageProgress {
  completedStageIds: string[]; // stages fully cleared (using Stage.id strings)
  inChapterRun?: ChapterRunState;
}

export interface GameState {
  slotId: 0 | 1 | 2;
  pool: Character[];           // all unlocked characters
  squad: Character[];          // active squad (max 5, subset of pool)
  expPool: number;
  currency: number;            // 廢土幣
  stageProgress: StageProgress;
  savedAt: number;             // Date.now() timestamp
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/types.ts
git commit -m "feat(pixel-squad): add GameState, StageProgress, ChapterRunState types"
```

---

### Task 2: Create SaveSystem.ts with unit tests

**Files:**
- Create: `workspace-pixel-squad/src/save/SaveSystem.ts`
- Create: `workspace-pixel-squad/tests/unit/SaveSystem.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `workspace-pixel-squad/tests/unit/SaveSystem.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { saveSlot, loadSlot, deleteSlot, listSlots } from '../../src/save/SaveSystem';
import type { GameState } from '../../src/types';

// Mock localStorage for Node environment
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  length: 0,
  key: () => null,
} as unknown as Storage;

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

function makeState(slot: 0 | 1 | 2): GameState {
  return {
    slotId: slot,
    pool: [],
    squad: [],
    expPool: 0,
    currency: 100,
    stageProgress: { completedStageIds: ['1-1', '1-2'] },
    savedAt: 1234567890,
  };
}

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
});

describe('saveSlot + loadSlot', () => {
  it('round-trips a GameState', () => {
    const state = makeState(0);
    saveSlot(state);
    const loaded = loadSlot(0);
    expect(loaded).toEqual(state);
  });

  it('stores separate keys for different slots', () => {
    saveSlot(makeState(0));
    saveSlot(makeState(1));
    expect(loadSlot(0)?.slotId).toBe(0);
    expect(loadSlot(1)?.slotId).toBe(1);
  });
});

describe('loadSlot', () => {
  it('returns null for empty slot', () => {
    expect(loadSlot(2)).toBeNull();
  });

  it('returns null for corrupted data', () => {
    store['pixelSquad_save_0'] = 'not-json{{{';
    expect(loadSlot(0)).toBeNull();
  });
});

describe('deleteSlot', () => {
  it('makes slot return null after deletion', () => {
    saveSlot(makeState(1));
    expect(loadSlot(1)).not.toBeNull();
    deleteSlot(1);
    expect(loadSlot(1)).toBeNull();
  });
});

describe('listSlots', () => {
  it('returns 3 entries with empty=true for unused slots', () => {
    const slots = listSlots();
    expect(slots).toHaveLength(3);
    expect(slots.every(s => s.empty)).toBe(true);
  });

  it('fills metadata for saved slots', () => {
    const state = makeState(0);
    state.stageProgress.inChapterRun = {
      chapterId: 'ch2',
      currentStageIndex: 2,
      lockedSquad: [],
    };
    state.squad = [{ id: 'p1' } as never, { id: 'p2' } as never];
    saveSlot(state);
    const slots = listSlots();
    expect(slots[0].empty).toBe(false);
    expect(slots[0].chapterName).toBe('ch2');
    expect(slots[0].squadSize).toBe(2);
    expect(slots[0].savedAt).toBe(1234567890);
    expect(slots[1].empty).toBe(true);
  });

  it('shows 基地 when not in chapter run', () => {
    saveSlot(makeState(2));
    const slots = listSlots();
    expect(slots[2].chapterName).toBe('基地');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: FAIL — `Cannot find module '../../src/save/SaveSystem'`

- [ ] **Step 3: Create the SaveSystem implementation**

Create `workspace-pixel-squad/src/save/SaveSystem.ts`:

```typescript
import type { GameState } from '../types';

const KEY = (slot: 0 | 1 | 2) => `pixelSquad_save_${slot}`;

export interface SlotMeta {
  slot: 0 | 1 | 2;
  empty: boolean;
  chapterName?: string;
  squadSize?: number;
  savedAt?: number;
}

export function saveSlot(state: GameState): void {
  localStorage.setItem(KEY(state.slotId), JSON.stringify(state));
}

export function loadSlot(slot: 0 | 1 | 2): GameState | null {
  const raw = localStorage.getItem(KEY(slot));
  if (!raw) return null;
  try { return JSON.parse(raw) as GameState; }
  catch { return null; }
}

export function deleteSlot(slot: 0 | 1 | 2): void {
  localStorage.removeItem(KEY(slot));
}

export function listSlots(): SlotMeta[] {
  return ([0, 1, 2] as const).map(slot => {
    const state = loadSlot(slot);
    if (!state) return { slot, empty: true };
    return {
      slot,
      empty: false,
      chapterName: state.stageProgress.inChapterRun?.chapterId ?? '基地',
      squadSize: state.squad.length,
      savedAt: state.savedAt,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: all SaveSystem tests PASS. All other unit tests also still PASS.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/save/SaveSystem.ts workspace-pixel-squad/tests/unit/SaveSystem.test.ts
git commit -m "feat(pixel-squad): add SaveSystem with save/load/delete/list for 3 slots"
```

---

### Task 3: Create GameState.ts (newGame factory)

**Files:**
- Create: `workspace-pixel-squad/src/save/GameState.ts`
- Test: `workspace-pixel-squad/tests/unit/SaveSystem.test.ts` (extend)

- [ ] **Step 1: Add newGame tests to SaveSystem.test.ts**

Append to `workspace-pixel-squad/tests/unit/SaveSystem.test.ts`:

```typescript
import { newGame } from '../../src/save/GameState';

describe('newGame', () => {
  it('creates a GameState with the given slot', () => {
    const state = newGame(1);
    expect(state.slotId).toBe(1);
  });

  it('starts with protagonist as the only pool member', () => {
    const state = newGame(0);
    expect(state.pool).toHaveLength(1);
    expect(state.pool[0].isProtagonist).toBe(true);
    expect(state.squad).toHaveLength(1);
    expect(state.squad[0].isProtagonist).toBe(true);
  });

  it('starts with zero currency and zero expPool', () => {
    const state = newGame(0);
    expect(state.currency).toBe(0);
    expect(state.expPool).toBe(0);
  });

  it('starts with empty stage progress', () => {
    const state = newGame(0);
    expect(state.stageProgress.completedStageIds).toHaveLength(0);
    expect(state.stageProgress.inChapterRun).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: FAIL — `Cannot find module '../../src/save/GameState'`

- [ ] **Step 3: Create GameState.ts**

Create `workspace-pixel-squad/src/save/GameState.ts`:

```typescript
import type { GameState } from '../types';
import { createCharacter } from '../battle/CharacterFactory';
import { PLAYER_TEMPLATES } from '../data/characters';

export function newGame(slot: 0 | 1 | 2): GameState {
  const protagonist = PLAYER_TEMPLATES.find(t => t.isProtagonist)!;
  const char = createCharacter(protagonist, 1);
  return {
    slotId: slot,
    pool: [char],
    squad: [char],
    expPool: 0,
    currency: 0,
    stageProgress: { completedStageIds: [] },
    savedAt: Date.now(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/save/GameState.ts workspace-pixel-squad/tests/unit/SaveSystem.test.ts
git commit -m "feat(pixel-squad): add newGame factory for initial GameState"
```

---

### Task 4: Create TitleScene

**Files:**
- Create: `workspace-pixel-squad/src/scenes/TitleScene.ts`

Note: Phaser scenes cannot be unit tested in the node environment. This task has no unit tests.

- [ ] **Step 1: Create TitleScene.ts**

Create `workspace-pixel-squad/src/scenes/TitleScene.ts`:

```typescript
import Phaser from 'phaser';
import { listSlots, deleteSlot } from '../save/SaveSystem';
import { newGame } from '../save/GameState';
import { saveSlot } from '../save/SaveSystem';
import type { SlotMeta } from '../save/SaveSystem';
import type { GameState } from '../types';

export class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'TitleScene' }); }

  create() {
    const W = 360, H = 640;
    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    this.add.text(W / 2, 100, 'PIXEL SQUAD', {
      fontSize: '28px', color: '#e5e7eb', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, 140, '廢土生存 RPG', {
      fontSize: '13px', color: '#6b7280', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.renderSlots();
  }

  private renderSlots() {
    const W = 360;
    const slots = listSlots();
    slots.forEach((meta, i) => {
      const y = 220 + i * 110;
      this.renderSlotCard(meta, W / 2, y);
    });

    const newBtn = this.add.rectangle(W / 2, 570, 160, 40, 0x374151)
      .setInteractive({ useHandCursor: true });
    this.add.text(W / 2, 570, '新遊戲', {
      fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
    }).setOrigin(0.5);
    newBtn.on('pointerdown', () => this.handleNewGame());
    newBtn.on('pointerover', () => newBtn.setAlpha(0.8));
    newBtn.on('pointerout', () => newBtn.setAlpha(1));
  }

  private renderSlotCard(meta: SlotMeta, x: number, y: number) {
    const bg = this.add.rectangle(x, y, 300, 90, meta.empty ? 0x1f2937 : 0x374151)
      .setStrokeStyle(1, 0x4b5563)
      .setInteractive({ useHandCursor: true });

    const slotLabel = `存檔 ${meta.slot + 1}`;
    this.add.text(x - 120, y - 26, slotLabel, {
      fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace',
    });

    if (meta.empty) {
      this.add.text(x, y, '空白', {
        fontSize: '14px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);
    } else {
      const dateStr = meta.savedAt ? new Date(meta.savedAt).toLocaleDateString('zh-TW') : '';
      this.add.text(x - 120, y - 4, `${meta.chapterName}`, {
        fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
      });
      this.add.text(x - 120, y + 20, `${meta.squadSize} 名隊員  ${dateStr}`, {
        fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace',
      });
    }

    bg.on('pointerdown', () => this.handleSlotTap(meta));
    bg.on('pointerover', () => bg.setAlpha(0.8));
    bg.on('pointerout', () => bg.setAlpha(1));
  }

  private handleSlotTap(meta: SlotMeta) {
    if (meta.empty) {
      this.startNewGameInSlot(meta.slot);
    } else {
      const { loadSlot } = require('../save/SaveSystem');
      const state: GameState | null = loadSlot(meta.slot);
      if (!state) { this.startNewGameInSlot(meta.slot); return; }
      if (state.stageProgress.inChapterRun) {
        this.scene.start('WorldMapScene', state);
      } else {
        this.scene.start('BaseScene', state);
      }
    }
  }

  private handleNewGame() {
    const slots = listSlots();
    const emptySlot = slots.find(s => s.empty);
    if (emptySlot) {
      this.startNewGameInSlot(emptySlot.slot);
    } else {
      this.showOverwritePicker();
    }
  }

  private startNewGameInSlot(slot: 0 | 1 | 2) {
    const state = newGame(slot);
    saveSlot(state);
    this.scene.start('BaseScene', state);
  }

  private showOverwritePicker() {
    const W = 360, H = 640;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7)
      .setInteractive();
    this.add.text(W / 2, H / 2 - 80, '選擇存檔位置：', {
      fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const slots = listSlots();
    slots.forEach((meta, i) => {
      const x = 60 + i * 120;
      const btn = this.add.rectangle(x, H / 2, 100, 50, 0x7c3aed)
        .setInteractive({ useHandCursor: true });
      this.add.text(x, H / 2, `存檔 ${meta.slot + 1}`, {
        fontSize: '12px', color: '#fff', fontFamily: 'monospace',
      }).setOrigin(0.5);
      btn.on('pointerdown', () => {
        overlay.destroy();
        this.startNewGameInSlot(meta.slot);
      });
    });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors (TitleScene uses dynamic require for loadSlot — if tsc complains about require, change to static import at the top of the file).

**Fix if tsc errors on `require`:** Replace the `handleSlotTap` body with:

```typescript
private handleSlotTap(meta: SlotMeta) {
  if (meta.empty) {
    this.startNewGameInSlot(meta.slot);
    return;
  }
  import('../save/SaveSystem').then(({ loadSlot }) => {
    const state: GameState | null = loadSlot(meta.slot);
    if (!state) { this.startNewGameInSlot(meta.slot); return; }
    if (state.stageProgress.inChapterRun) {
      this.scene.start('WorldMapScene', state);
    } else {
      this.scene.start('BaseScene', state);
    }
  });
}
```

Actually, just use static import at the top (cleaner). The `loadSlot` import should already be at the top with `import { listSlots, deleteSlot, saveSlot } from '../save/SaveSystem'`. Add `loadSlot` to that import:

```typescript
import { listSlots, deleteSlot, saveSlot, loadSlot } from '../save/SaveSystem';
```

Then in `handleSlotTap`:
```typescript
private handleSlotTap(meta: SlotMeta) {
  if (meta.empty) { this.startNewGameInSlot(meta.slot); return; }
  const state: GameState | null = loadSlot(meta.slot);
  if (!state) { this.startNewGameInSlot(meta.slot); return; }
  if (state.stageProgress.inChapterRun) {
    this.scene.start('WorldMapScene', state);
  } else {
    this.scene.start('BaseScene', state);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/scenes/TitleScene.ts
git commit -m "feat(pixel-squad): add TitleScene with 3-slot save picker"
```

---

### Task 5: Register TitleScene in main.ts as first scene

**Files:**
- Modify: `workspace-pixel-squad/src/main.ts`

- [ ] **Step 1: Update main.ts**

Replace the contents of `workspace-pixel-squad/src/main.ts` with:

```typescript
import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
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
  scene: [TitleScene, BattleScene, ResultScene, PrepScene],
};

new Phaser.Game(config);
```

- [ ] **Step 2: Verify TypeScript compiles and tests still pass**

```bash
cd workspace-pixel-squad && npx tsc --noEmit && npm run test:unit
```

Expected: no TypeScript errors, all unit tests PASS.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/main.ts
git commit -m "feat(pixel-squad): register TitleScene as first scene"
```

---

## Summary

After all tasks:
- `GameState`, `StageProgress`, `ChapterRunState` are in `src/types.ts`
- `SaveSystem.ts` provides `saveSlot`, `loadSlot`, `deleteSlot`, `listSlots` with localStorage
- `GameState.ts` provides `newGame(slot)` factory
- `TitleScene.ts` shows 3 save slots and handles new game / resume
- `main.ts` starts with `TitleScene`
- Unit tests: `tests/unit/SaveSystem.test.ts` covers all pure functions

**Next plan to implement:** `2026-06-24-pixel-squad-world-map.md` (adds Stage/Chapter data and WorldMapScene)
