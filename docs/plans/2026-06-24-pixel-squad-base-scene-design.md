# Pixel Squad — BaseScene Design

> **Status:** Approved for implementation.

---

## Overview

BaseScene is the player's home between stages. It has two modes depending on where the player is in the campaign:

- **Base mode** (not in a chapter run): full squad management, EXP pool level-up, and access to the world map.
- **In-chapter mode** (inside a `ChapterRunState`): level-up only using the EXP pool; squad is locked; player can continue to the next stage or abandon the run.

BaseScene receives `GameState` from the previous scene and returns an updated `GameState` to the next scene.

---

## Mode Detection

```typescript
const isInChapter = !!gameState.stageProgress.inChapterRun;
```

If `inChapterRun` is set, render in-chapter mode. Otherwise render base mode.

---

## Base Mode UI

```
┌─────────────────────────────────┐
│  基地                幣:150      │
│  EXP池: ████░░  320             │
├─────────────────────────────────┤
│  出戰中 (最多5人)               │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │倖存者│ │ Rex  │ │ Nyx  │    │
│  │Lv.5  │ │Lv.3  │ │Lv.4  │  →│  [升級] if canLevelUp
│  └──────┘ └──────┘ └──────┘    │
│                                 │
│  角色庫                         │
│  ┌──────┐ ┌──────┐              │
│  │ Ash  │ │      │              │
│  │Lv.2  │ │(鎖定)│              │
│  └──────┘ └──────┘              │
│                                 │
│          [世界地圖]              │
└─────────────────────────────────┘
```

**Squad area ("出戰中"):**
- Shows up to 5 character cards (active squad from `gameState.squad`)
- Each card: name, level, archetype label
- If `canLevelUp(char, expPool, config)` → show green [升級] button; tapping opens allocation panel (protagonist) or summary panel (non-protagonist)
- Tap card to move character to 角色庫 (bench), only if squad will still have ≥1 member

**Bench area ("角色庫"):**
- All characters in `gameState.pool` NOT in `gameState.squad`
- Locked characters shown as greyed cards: character not yet unlocked (templateId in pool as pending? No — characters never appear in pool until unlocked; locked slots shown as empty placeholders)
- Tap a bench character → moves to squad if `squad.length < 5`

**Currency display:** top right, reads `gameState.currency`

**EXP pool bar:** same display as PrepScene (green bar + number)

**世界地圖 button:** bottom center; taps → `scene.start('WorldMapScene', gameState)`

---

## In-Chapter Mode UI

```
┌─────────────────────────────────┐
│  整備                幣:150      │
│  EXP池: ████░░  320             │
│  目前章節：第2章 3/5關           │
├─────────────────────────────────┤
│  出戰中 (鎖定)                  │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │倖存者│ │ Rex  │ │ Nyx  │    │
│  │Lv.5  │ │Lv.3  │ │Lv.4  │  →│  [升級] if canLevelUp
│  └──────┘ └──────┘ └──────┘    │
│                                 │
│  [放棄本章]      [繼續]         │
└─────────────────────────────────┘
```

- Squad shows `inChapterRun.lockedSquad` — no drag/tap to rearrange
- Level-up buttons still available (EXP pool persists through chapter runs)
- Chapter progress label: `第{N}章 {stageIndex+1}/5關` (reads from `inChapterRun`)
- **繼續 button:** starts `BattleScene` with `lockedSquad`, `chapterId`, `currentStageIndex`, and current `expPool`
- **放棄本章 button:** clears `inChapterRun` from `stageProgress` → auto-save → transitions back to `WorldMapScene`

---

## Level-Up Integration

BaseScene reuses `PrepScene`'s allocation logic via the same `canLevelUp` / `applyLevelUp` calls and the same `showAllocationPanel` / `showNonProtagonistSummary` UI patterns. The allocation panel and summary panel are copy-pasted from PrepScene (no shared base class needed — keep it simple).

After level-up:
1. Update `gameState.squad[i]` (and `gameState.pool[j]` for the same character)
2. Call `saveSlot(gameState)`
3. Re-render the party list

---

## State Mutation Rules

All changes in BaseScene update `gameState` in-memory and call `saveSlot(gameState)` immediately:
- Squad change (add/remove member)
- Level-up applied
- Abandon chapter run (clear `inChapterRun`)

---

## BattleSceneData Extension

To support chapter runs, `BattleSceneData` needs:

```typescript
export interface BattleSceneData {
  playerParty: Character[];
  stageIndex: number;          // global stage index (for PrepScene legacy path)
  expPool?: number;
  // New for chapter run path:
  gameState?: GameState;       // passed through for chapter-run awareness
}
```

When `gameState` is present in `BattleSceneData`, `BattleScene` passes it through to `ResultScene`, which passes it to `BaseScene` (instead of `PrepScene`). When absent, existing `PrepScene` flow is used (backward compatible).

---

## File Map

| File | Action |
|------|--------|
| `src/scenes/BaseScene.ts` | CREATE — two-mode scene as described above |
| `src/types.ts` | MODIFY — extend `BattleSceneData` with optional `gameState?: GameState` |
| `src/main.ts` | MODIFY — register `BaseScene` |

---

## Out of Scope

- Character renaming UI (future)
- Shop / currency spending (future)
- Character dismissal from pool (future)
- Animated squad card transitions
