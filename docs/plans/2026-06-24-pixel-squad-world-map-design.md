# Pixel Squad — World Map + Stage Structure Design

> **Status:** Approved for implementation.

---

## Overview

5 chapters (大關), each with 5 stages (小關). The 5th stage of every chapter is a named boss. Side quests unlock after clearing specific stages. All stages are fully designed — no placeholder data.

Player navigates via `WorldMapScene`. Stages completed in any earlier session are replayable for EXP and currency.

---

## Data Structures

### Extended Stage

```typescript
// Extends existing Stage in types.ts
export interface Stage {
  id: string;
  chapterId: string;
  name: string;
  stageIndex: number;          // 0–4 within chapter
  isBoss: boolean;
  isSideQuest: boolean;
  unlockAfterStageId?: string; // side quests only
  enemies: EnemyTemplate[];
  expReward: number;
  currencyReward: number;
  unlockCharacterId?: string;  // character unlocked on first clear
}

export interface Chapter {
  id: string;
  name: string;
  stageIds: string[];          // ordered, 5 entries
  unlockAfterChapterId?: string;
}
```

---

## Chapter & Stage Data

### Chapter 1: 廢城遺跡

| Stage | Name | Enemies | EXP | 幣 | Unlock |
|-------|------|---------|-----|-----|--------|
| 1-1 | 廢城入口 | 變種人 (HP60 ATK15 DEF5 SPD8) | 40 | 20 | — |
| 1-2 | 地下水道 | 變種人×2 (HP60 ATK15 DEF5 SPD8) | 60 | 30 | Rex |
| 1-3 | 廢棄醫院 | 野狼突變種 (HP75 ATK18 DEF6 SPD12) × 2 | 80 | 40 | — |
| 1-4 | 工廠廢墟 | 掠奪者 (HP80 ATK20 DEF8 SPD12) + 掠奪者狙擊手 (HP65 ATK24 DEF5 SPD16) | 90 | 45 | Nyx |
| 1-5 | **[BOSS] 鐵拳 Vega** | Vega (HP200 ATK35 DEF15 SPD14, boss phases) | 120 | 80 | Vega (recruit) |

### Chapter 2: 破敗工廠

| Stage | Name | Enemies | EXP | 幣 | Unlock |
|-------|------|---------|-----|-----|--------|
| 2-1 | 機械墓場 | 掠奪者×2 + 廢土狗×1 (HP40 ATK12 DEF3 SPD18) | 100 | 50 | — |
| 2-2 | 鐵皮貧民窟 | 掠奪者×3 | 110 | 55 | Ash |
| 2-3 | 地下賭場 | 掠奪者×2 + 掠奪者隊長 (HP130 ATK28 DEF16 SPD11) | 130 | 65 | — |
| 2-4 | 工廠心臟 | 機械守衛 (HP110 ATK25 DEF20 SPD9)×2 + 廢土兵 (HP90 ATK22 DEF15 SPD10) | 150 | 75 | — |
| 2-5 | **[BOSS] 影鴉 Crow** | Crow (HP220 ATK38 DEF12 SPD22, boss phases) | 180 | 120 | Crow (recruit) |

### Chapter 3: 輻射荒原

| Stage | Name | Enemies | EXP | 幣 | Unlock |
|-------|------|---------|-----|-----|--------|
| 3-1 | 輻射邊境 | 變異獸 (HP95 ATK26 DEF10 SPD14)×3 | 160 | 80 | — |
| 3-2 | 廢棄研究站 | 廢土兵×2 + 科學怪人 (HP140 ATK30 DEF18 SPD8) | 180 | 90 | — |
| 3-3 | 地雷陣 | 廢土兵×3 + 爆破兵 (HP80 ATK32 DEF8 SPD13) | 200 | 100 | Mira |
| 3-4 | 指揮塔 | 精英廢土兵 (HP120 ATK28 DEF18 SPD12)×2 + 廢土狙擊手 (HP90 ATK36 DEF10 SPD20) | 220 | 110 | — |
| 3-5 | **[BOSS] 廢土聖女 Zora** | Zora (HP260 ATK32 DEF25 SPD16, boss phases) | 260 | 160 | Zora (recruit) |

### Chapter 4: 機械廢都

| Stage | Name | Enemies | EXP | 幣 | Unlock |
|-------|------|---------|-----|-----|--------|
| 4-1 | 金屬廢墟 | 機械守衛×2 + 電磁蜘蛛 (HP70 ATK20 DEF14 SPD20) | 240 | 120 | — |
| 4-2 | 鑄造廠 | 機械守衛×3 + 鑄造機器人 (HP160 ATK28 DEF25 SPD7) | 260 | 130 | Rook |
| 4-3 | 數據中心 | 電磁守衛 (HP130 ATK32 DEF22 SPD14)×2 + 機械兵 (HP100 ATK26 DEF18 SPD12) | 280 | 140 | — |
| 4-4 | 核心艙 | 精英機械兵 (HP150 ATK34 DEF24 SPD14)×3 | 300 | 150 | — |
| 4-5 | **[BOSS] 鐵壁 Dex** | Dex (HP400 ATK40 DEF35 SPD10, boss phases) | 340 | 200 | Dex (recruit) |

### Chapter 5: 亡靈禁地

| Stage | Name | Enemies | EXP | 幣 | Unlock |
|-------|------|---------|-----|-----|--------|
| 5-1 | 禁忌邊境 | 精英廢土兵 (HP140 ATK32 DEF20 SPD14)×3 | 320 | 160 | — |
| 5-2 | 古代遺跡 | 遺跡守衛 (HP160 ATK30 DEF28 SPD10)×2 + 石像怪 (HP220 ATK35 DEF30 SPD6) | 360 | 180 | — |
| 5-3 | 暗影神殿 | 暗影刺客 (HP100 ATK40 DEF12 SPD24)×3 | 380 | 190 | Echo |
| 5-4 | 絕頂天台 | 精英守衛 (HP180 ATK36 DEF26 SPD14)×2 + 頂尖武士 (HP200 ATK42 DEF28 SPD18) | 420 | 210 | — |
| 5-5 | **[BOSS] AAAA** | AAAA (HP600 ATK50 DEF40 SPD20, boss phases) | 500 | 300 | AAAA (recruit) |

---

## Side Quests

| ID | Name | Unlocks After | Enemies | EXP | 幣 |
|----|------|--------------|---------|-----|-----|
| SQ-1 | 廢土競技場 | 1-5 cleared | 競技場鬥士 (HP90 ATK22 DEF10 SPD14)×3 + 競技場冠軍 (HP150 ATK30 DEF15 SPD12) | 160 | 200 |
| SQ-2 | 黑市突襲 | 2-3 cleared | 掠奪者×2 + 黑市老大 (HP170 ATK32 DEF18 SPD13) | 220 | 280 |
| SQ-3 | 古代遺跡探索 | 3-5 cleared | 古代守護者 (HP200 ATK34 DEF30 SPD8)×2 + 遺跡主神 (HP300 ATK38 DEF35 SPD10) | 360 | 350 |

Side quests are replayable and do not unlock characters.

---

## WorldMapScene

**Layout:**
```
┌─────────────────────────────────┐
│  世界地圖   幣:150  EXP池:320   │
├─────────────────────────────────┤
│  ▼ 第1章 廢城遺跡  ■■■■■ (完成)│
│    1-1 廢城入口      ✓ [重打]   │
│    1-2 地下水道      ✓ [重打]   │
│    ...                          │
│    1-5 [BOSS] 鐵拳  ✓ [重打]   │
│  ▼ 第2章 破敗工廠  ■■□□□       │
│    2-1 機械墓場      ✓ [重打]   │
│    2-2 鐵皮貧民窟    → [進入]   │  ← next uncompleted
│    2-3 ~ 2-5         🔒         │
│  ▶ 第3章 (鎖定)                 │
│  支線 廢土競技場     ✓ [重打]   │
└─────────────────────────────────┘
```

Tapping a stage → `StageConfirmOverlay` (enemy list, squad preview, EXP/幣 rewards) → [出擊] or [取消].

**Rules:**
- A stage is playable if: it's the next uncompleted stage in its chapter, OR it's already completed (replay).
- Chapter 2 unlocks when Chapter 1's final boss (1-5) is cleared.
- Side quests appear in a separate section below main chapters; only shown when unlocked.
- The `inChapterRun` state locks the player to the next stage of their current chapter — they cannot jump to another chapter's stage until the run ends (chapter complete or party wipe).

---

## File Map

| File | Action |
|------|--------|
| `src/data/stages.ts` | REWRITE — full 25 stages + 3 side quests using new `Stage` shape |
| `src/data/chapters.ts` | CREATE — 5 `Chapter` definitions |
| `src/types.ts` | MODIFY — add `Chapter` interface, extend `Stage` with new fields |
| `src/scenes/WorldMapScene.ts` | CREATE — chapter/stage list UI |

---

## Out of Scope

- Animated world map (positions on a map image)
- Chapter intro cutscenes
- Stage difficulty ratings
- Weather/environment effects on battle
