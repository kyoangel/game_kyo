# Pixel Squad — Save System + TitleScene + GameState Design

> **Status:** Approved for implementation.

---

## Overview

Traditional 3-slot save system. Each slot auto-saves on every state change (no manual save action). Player picks a slot on the title screen; from then on all changes persist immediately to that slot via localStorage.

---

## GameState

Central state object carried through all scenes and persisted per slot.

```typescript
export interface GameState {
  slotId: 0 | 1 | 2;
  pool: Character[];           // all unlocked characters (including those not in active squad)
  squad: Character[];          // active squad, max 5, subset of pool
  expPool: number;
  currency: number;            // 廢土幣
  stageProgress: StageProgress;
  savedAt: number;             // Date.now() timestamp
}

export interface StageProgress {
  completedStageIds: string[]; // stages fully cleared
  inChapterRun?: ChapterRunState;
}

export interface ChapterRunState {
  chapterId: string;
  currentStageIndex: number;   // 0–4, which stage within chapter is next
  lockedSquad: Character[];    // squad frozen for this run
}
```

`inChapterRun` is set when the player enters a chapter run (from WorldMapScene → first stage of chapter). It is cleared when the chapter is completed or the party is wiped.

---

## SaveSystem.ts

Pure functions only, no side effects beyond localStorage.

```typescript
// src/save/SaveSystem.ts

const KEY = (slot: 0 | 1 | 2) => `pixelSquad_save_${slot}`;

export interface SlotMeta {
  slot: 0 | 1 | 2;
  empty: boolean;
  chapterName?: string;   // e.g. "第2章 破敗工廠"
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
  return [0, 1, 2].map(slot => {
    const state = loadSlot(slot as 0 | 1 | 2);
    if (!state) return { slot: slot as 0 | 1 | 2, empty: true };
    return {
      slot: slot as 0 | 1 | 2,
      empty: false,
      chapterName: state.stageProgress.inChapterRun?.chapterId ?? '基地',
      squadSize: state.squad.length,
      savedAt: state.savedAt,
    };
  });
}
```

---

## TitleScene

First scene loaded by `main.ts`. Shows 3 save slots.

**UI:**
```
┌─────────────────────────────┐
│     PIXEL SQUAD             │
│                             │
│  存檔 1  第2章  ■■□□□  xx/xx │
│  存檔 2  第1章  ■□□□□  xx/xx │
│  存檔 3  空白                │
│                             │
│  [新遊戲]                   │
└─────────────────────────────┘
```

- Tapping a filled slot → loads that save → navigates to `BaseScene` (or resumes `WorldMapScene` if `inChapterRun` is set)
- Tapping an empty slot → same as 新遊戲 for that slot
- 新遊戲 button → opens slot picker if any slot is filled; otherwise picks first empty slot automatically

**Slot picker (when 新遊戲 tapped and slots exist):**
```
選擇存檔位置：
[存檔 1 — 覆蓋？] [存檔 2 — 覆蓋？] [存檔 3 空白]
```

Confirm overwrite before destroying existing save.

---

## Initial GameState (New Game)

```typescript
export function newGame(slot: 0 | 1 | 2): GameState {
  const protagonist = createCharacter(PLAYER_TEMPLATES.find(t => t.isProtagonist)!, 1);
  return {
    slotId: slot,
    pool: [protagonist],
    squad: [protagonist],
    expPool: 0,
    currency: 0,
    stageProgress: { completedStageIds: [] },
    savedAt: Date.now(),
  };
}
```

---

## Scene Integration

Every scene that mutates state calls `saveSlot(state)` before transitioning. The active `GameState` is passed through `scene.start()` data and kept in memory; localStorage is the persistence layer, not the primary source of truth during a session.

**State flow:**
```
TitleScene (load/new) → BaseScene → WorldMapScene → BattleScene → ResultScene → BaseScene
                                                         ↓
                                                    PrepScene (in-chapter)
```

All scenes receive `GameState` via scene data and return updated `GameState` to the next scene.

---

## File Map

| File | Action |
|------|--------|
| `src/save/SaveSystem.ts` | CREATE — pure save/load functions |
| `src/save/GameState.ts` | CREATE — interfaces + `newGame()` |
| `src/scenes/TitleScene.ts` | CREATE — slot picker UI |
| `src/types.ts` | MODIFY — add `GameState`, `StageProgress`, `ChapterRunState`, `SlotMeta` imports/re-exports |
| `src/main.ts` | MODIFY — first scene is `TitleScene` |

---

## Out of Scope

- Cloud save / cross-device sync
- Save file encryption
- Export/import save
