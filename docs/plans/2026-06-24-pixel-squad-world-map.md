# Pixel Squad — World Map + Stage Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the full world map: 25 stages across 5 chapters + 3 side quests, plus a WorldMapScene that lets the player navigate and enter stages.

**Architecture:** `types.ts` gets extended `Stage` and new `Chapter` interfaces. `stages.ts` is completely rewritten with all stage data. `chapters.ts` is a new data file. `WorldMapScene.ts` is a new Phaser scene that displays chapters/stages and launches BattleScene.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest (node environment)

**Prerequisite:** Plan `2026-06-24-pixel-squad-save-system.md` must be complete — `GameState`, `StageProgress`, and `SaveSystem` types/functions must exist.

---

## File Map

| File | Action |
|------|--------|
| `workspace-pixel-squad/src/types.ts` | MODIFY — extend `Stage`, add `Chapter` interface |
| `workspace-pixel-squad/src/data/stages.ts` | REWRITE — 25 stages + 3 side quests |
| `workspace-pixel-squad/src/data/chapters.ts` | CREATE — 5 Chapter definitions |
| `workspace-pixel-squad/src/scenes/WorldMapScene.ts` | CREATE — chapter/stage list UI |
| `workspace-pixel-squad/src/main.ts` | MODIFY — register WorldMapScene |
| `workspace-pixel-squad/tests/unit/StageData.test.ts` | CREATE — data shape validation |

---

### Task 1: Extend Stage and add Chapter interfaces in types.ts

**Files:**
- Modify: `workspace-pixel-squad/src/types.ts`

- [ ] **Step 1: Replace the Stage interface and add Chapter**

In `workspace-pixel-squad/src/types.ts`, replace:

```typescript
export interface Stage {
  id: string;
  name: string;
  enemies: EnemyTemplate[];
  expReward: number;   // total EXP split among surviving player chars
}
```

With:

```typescript
export interface Stage {
  id: string;
  chapterId: string;
  name: string;
  stageIndex: number;           // 0–4 within chapter (or 0 for side quests)
  isBoss: boolean;
  isSideQuest: boolean;
  unlockAfterStageId?: string;  // side quests only
  enemies: EnemyTemplate[];
  expReward: number;
  currencyReward: number;
  unlockCharacterId?: string;   // character unlocked on first clear
}

export interface Chapter {
  id: string;
  name: string;
  stageIds: string[];           // ordered, 5 entries
  unlockAfterChapterId?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: errors because `stages.ts` still uses old Stage shape. These will be fixed in Task 2.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/types.ts
git commit -m "feat(pixel-squad): extend Stage type and add Chapter interface"
```

---

### Task 2: Write data shape validation tests

**Files:**
- Create: `workspace-pixel-squad/tests/unit/StageData.test.ts`

- [ ] **Step 1: Write the failing test**

Create `workspace-pixel-squad/tests/unit/StageData.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { STAGES } from '../../src/data/stages';
import { CHAPTERS } from '../../src/data/chapters';

describe('STAGES data', () => {
  it('has exactly 28 entries (25 main + 3 side quests)', () => {
    expect(STAGES).toHaveLength(28);
  });

  it('every stage has required fields', () => {
    STAGES.forEach(s => {
      expect(s.id, `${s.id} missing id`).toBeTruthy();
      expect(s.chapterId, `${s.id} missing chapterId`).toBeTruthy();
      expect(s.name, `${s.id} missing name`).toBeTruthy();
      expect(typeof s.stageIndex).toBe('number');
      expect(typeof s.isBoss).toBe('boolean');
      expect(typeof s.isSideQuest).toBe('boolean');
      expect(s.enemies.length, `${s.id} has no enemies`).toBeGreaterThan(0);
      expect(s.expReward, `${s.id} missing expReward`).toBeGreaterThan(0);
      expect(s.currencyReward, `${s.id} missing currencyReward`).toBeGreaterThan(0);
    });
  });

  it('has 5 boss stages (one per chapter)', () => {
    const bosses = STAGES.filter(s => s.isBoss);
    expect(bosses).toHaveLength(5);
  });

  it('has 3 side quest stages', () => {
    const sideQuests = STAGES.filter(s => s.isSideQuest);
    expect(sideQuests).toHaveLength(3);
  });

  it('boss stages are at stageIndex 4', () => {
    STAGES.filter(s => s.isBoss).forEach(s => {
      expect(s.stageIndex).toBe(4);
    });
  });

  it('stage IDs are unique', () => {
    const ids = STAGES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('CHAPTERS data', () => {
  it('has exactly 5 chapters', () => {
    expect(CHAPTERS).toHaveLength(5);
  });

  it('each chapter has 5 stageIds', () => {
    CHAPTERS.forEach(ch => {
      expect(ch.stageIds, `${ch.id} wrong stageId count`).toHaveLength(5);
    });
  });

  it('chapter stageIds reference valid STAGE ids', () => {
    const stageIds = new Set(STAGES.map(s => s.id));
    CHAPTERS.forEach(ch => {
      ch.stageIds.forEach(id => {
        expect(stageIds.has(id), `${id} not found in STAGES`).toBe(true);
      });
    });
  });

  it('second through fifth chapters have unlockAfterChapterId', () => {
    CHAPTERS.slice(1).forEach(ch => {
      expect(ch.unlockAfterChapterId, `${ch.id} missing unlockAfterChapterId`).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: FAIL — stages.ts has wrong shape / chapters.ts doesn't exist.

---

### Task 3: Rewrite stages.ts with all 28 stages

**Files:**
- Modify: `workspace-pixel-squad/src/data/stages.ts`

- [ ] **Step 1: Rewrite stages.ts**

Replace the entire contents of `workspace-pixel-squad/src/data/stages.ts`:

```typescript
import type { Stage } from '../types';

export const STAGES: Stage[] = [
  // ── Chapter 1: 廢城遺跡 ──────────────────────────────────────────────────
  {
    id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [{ id: 'mutant', name: '變種人', baseStats: { hp: 60, atk: 15, def: 5, spd: 8 }, skillIds: [] }],
    expReward: 40, currencyReward: 20,
  },
  {
    id: '1-2', chapterId: 'ch1', name: '地下水道', stageIndex: 1,
    isBoss: false, isSideQuest: false, unlockCharacterId: 'rex',
    enemies: [
      { id: 'mutant_a', name: '變種人', baseStats: { hp: 60, atk: 15, def: 5, spd: 8 }, skillIds: [] },
      { id: 'mutant_b', name: '變種人', baseStats: { hp: 60, atk: 15, def: 5, spd: 8 }, skillIds: [] },
    ],
    expReward: 60, currencyReward: 30,
  },
  {
    id: '1-3', chapterId: 'ch1', name: '廢棄醫院', stageIndex: 2,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'wolf_a', name: '野狼突變種', baseStats: { hp: 75, atk: 18, def: 6, spd: 12 }, skillIds: [] },
      { id: 'wolf_b', name: '野狼突變種', baseStats: { hp: 75, atk: 18, def: 6, spd: 12 }, skillIds: [] },
    ],
    expReward: 80, currencyReward: 40,
  },
  {
    id: '1-4', chapterId: 'ch1', name: '工廠廢墟', stageIndex: 3,
    isBoss: false, isSideQuest: false, unlockCharacterId: 'nyx',
    enemies: [
      { id: 'raider', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_sniper', name: '掠奪者狙擊手', baseStats: { hp: 65, atk: 24, def: 5, spd: 16 }, skillIds: [] },
    ],
    expReward: 90, currencyReward: 45,
  },
  {
    id: '1-5', chapterId: 'ch1', name: '[BOSS] 鐵拳 Vega', stageIndex: 4,
    isBoss: true, isSideQuest: false, unlockCharacterId: 'vega',
    enemies: [{ id: 'vega', name: 'Vega', baseStats: { hp: 200, atk: 35, def: 15, spd: 14 }, skillIds: [] }],
    expReward: 120, currencyReward: 80,
  },

  // ── Chapter 2: 破敗工廠 ──────────────────────────────────────────────────
  {
    id: '2-1', chapterId: 'ch2', name: '機械墓場', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'raider_a', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_b', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'waste_dog', name: '廢土狗', baseStats: { hp: 40, atk: 12, def: 3, spd: 18 }, skillIds: [] },
    ],
    expReward: 100, currencyReward: 50,
  },
  {
    id: '2-2', chapterId: 'ch2', name: '鐵皮貧民窟', stageIndex: 1,
    isBoss: false, isSideQuest: false, unlockCharacterId: 'ash',
    enemies: [
      { id: 'raider_a', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_b', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_c', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
    ],
    expReward: 110, currencyReward: 55,
  },
  {
    id: '2-3', chapterId: 'ch2', name: '地下賭場', stageIndex: 2,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'raider_a', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_b', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_cap', name: '掠奪者隊長', baseStats: { hp: 130, atk: 28, def: 16, spd: 11 }, skillIds: [] },
    ],
    expReward: 130, currencyReward: 65,
  },
  {
    id: '2-4', chapterId: 'ch2', name: '工廠心臟', stageIndex: 3,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'mech_a', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'mech_b', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'soldier', name: '廢土兵', baseStats: { hp: 90, atk: 22, def: 15, spd: 10 }, skillIds: [] },
    ],
    expReward: 150, currencyReward: 75,
  },
  {
    id: '2-5', chapterId: 'ch2', name: '[BOSS] 影鴉 Crow', stageIndex: 4,
    isBoss: true, isSideQuest: false, unlockCharacterId: 'crow',
    enemies: [{ id: 'crow', name: 'Crow', baseStats: { hp: 220, atk: 38, def: 12, spd: 22 }, skillIds: [] }],
    expReward: 180, currencyReward: 120,
  },

  // ── Chapter 3: 輻射荒原 ──────────────────────────────────────────────────
  {
    id: '3-1', chapterId: 'ch3', name: '輻射邊境', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'beast_a', name: '變異獸', baseStats: { hp: 95, atk: 26, def: 10, spd: 14 }, skillIds: [] },
      { id: 'beast_b', name: '變異獸', baseStats: { hp: 95, atk: 26, def: 10, spd: 14 }, skillIds: [] },
      { id: 'beast_c', name: '變異獸', baseStats: { hp: 95, atk: 26, def: 10, spd: 14 }, skillIds: [] },
    ],
    expReward: 160, currencyReward: 80,
  },
  {
    id: '3-2', chapterId: 'ch3', name: '廢棄研究站', stageIndex: 1,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'soldier_a', name: '廢土兵', baseStats: { hp: 90, atk: 22, def: 15, spd: 10 }, skillIds: [] },
      { id: 'soldier_b', name: '廢土兵', baseStats: { hp: 90, atk: 22, def: 15, spd: 10 }, skillIds: [] },
      { id: 'franken', name: '科學怪人', baseStats: { hp: 140, atk: 30, def: 18, spd: 8 }, skillIds: [] },
    ],
    expReward: 180, currencyReward: 90,
  },
  {
    id: '3-3', chapterId: 'ch3', name: '地雷陣', stageIndex: 2,
    isBoss: false, isSideQuest: false, unlockCharacterId: 'mira',
    enemies: [
      { id: 'soldier_a', name: '廢土兵', baseStats: { hp: 90, atk: 22, def: 15, spd: 10 }, skillIds: [] },
      { id: 'soldier_b', name: '廢土兵', baseStats: { hp: 90, atk: 22, def: 15, spd: 10 }, skillIds: [] },
      { id: 'soldier_c', name: '廢土兵', baseStats: { hp: 90, atk: 22, def: 15, spd: 10 }, skillIds: [] },
      { id: 'bomber', name: '爆破兵', baseStats: { hp: 80, atk: 32, def: 8, spd: 13 }, skillIds: [] },
    ],
    expReward: 200, currencyReward: 100,
  },
  {
    id: '3-4', chapterId: 'ch3', name: '指揮塔', stageIndex: 3,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'elite_a', name: '精英廢土兵', baseStats: { hp: 120, atk: 28, def: 18, spd: 12 }, skillIds: [] },
      { id: 'elite_b', name: '精英廢土兵', baseStats: { hp: 120, atk: 28, def: 18, spd: 12 }, skillIds: [] },
      { id: 'sniper', name: '廢土狙擊手', baseStats: { hp: 90, atk: 36, def: 10, spd: 20 }, skillIds: [] },
    ],
    expReward: 220, currencyReward: 110,
  },
  {
    id: '3-5', chapterId: 'ch3', name: '[BOSS] 廢土聖女 Zora', stageIndex: 4,
    isBoss: true, isSideQuest: false, unlockCharacterId: 'zora',
    enemies: [{ id: 'zora', name: 'Zora', baseStats: { hp: 260, atk: 32, def: 25, spd: 16 }, skillIds: [] }],
    expReward: 260, currencyReward: 160,
  },

  // ── Chapter 4: 機械廢都 ──────────────────────────────────────────────────
  {
    id: '4-1', chapterId: 'ch4', name: '金屬廢墟', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'mech_a', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'mech_b', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'em_spider', name: '電磁蜘蛛', baseStats: { hp: 70, atk: 20, def: 14, spd: 20 }, skillIds: [] },
    ],
    expReward: 240, currencyReward: 120,
  },
  {
    id: '4-2', chapterId: 'ch4', name: '鑄造廠', stageIndex: 1,
    isBoss: false, isSideQuest: false, unlockCharacterId: 'rook',
    enemies: [
      { id: 'mech_a', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'mech_b', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'mech_c', name: '機械守衛', baseStats: { hp: 110, atk: 25, def: 20, spd: 9 }, skillIds: [] },
      { id: 'forge_bot', name: '鑄造機器人', baseStats: { hp: 160, atk: 28, def: 25, spd: 7 }, skillIds: [] },
    ],
    expReward: 260, currencyReward: 130,
  },
  {
    id: '4-3', chapterId: 'ch4', name: '數據中心', stageIndex: 2,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'em_guard_a', name: '電磁守衛', baseStats: { hp: 130, atk: 32, def: 22, spd: 14 }, skillIds: [] },
      { id: 'em_guard_b', name: '電磁守衛', baseStats: { hp: 130, atk: 32, def: 22, spd: 14 }, skillIds: [] },
      { id: 'mech_soldier', name: '機械兵', baseStats: { hp: 100, atk: 26, def: 18, spd: 12 }, skillIds: [] },
    ],
    expReward: 280, currencyReward: 140,
  },
  {
    id: '4-4', chapterId: 'ch4', name: '核心艙', stageIndex: 3,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'elite_mech_a', name: '精英機械兵', baseStats: { hp: 150, atk: 34, def: 24, spd: 14 }, skillIds: [] },
      { id: 'elite_mech_b', name: '精英機械兵', baseStats: { hp: 150, atk: 34, def: 24, spd: 14 }, skillIds: [] },
      { id: 'elite_mech_c', name: '精英機械兵', baseStats: { hp: 150, atk: 34, def: 24, spd: 14 }, skillIds: [] },
    ],
    expReward: 300, currencyReward: 150,
  },
  {
    id: '4-5', chapterId: 'ch4', name: '[BOSS] 鐵壁 Dex', stageIndex: 4,
    isBoss: true, isSideQuest: false, unlockCharacterId: 'dex',
    enemies: [{ id: 'dex', name: 'Dex', baseStats: { hp: 400, atk: 40, def: 35, spd: 10 }, skillIds: [] }],
    expReward: 340, currencyReward: 200,
  },

  // ── Chapter 5: 亡靈禁地 ──────────────────────────────────────────────────
  {
    id: '5-1', chapterId: 'ch5', name: '禁忌邊境', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'elite_a', name: '精英廢土兵', baseStats: { hp: 140, atk: 32, def: 20, spd: 14 }, skillIds: [] },
      { id: 'elite_b', name: '精英廢土兵', baseStats: { hp: 140, atk: 32, def: 20, spd: 14 }, skillIds: [] },
      { id: 'elite_c', name: '精英廢土兵', baseStats: { hp: 140, atk: 32, def: 20, spd: 14 }, skillIds: [] },
    ],
    expReward: 320, currencyReward: 160,
  },
  {
    id: '5-2', chapterId: 'ch5', name: '古代遺跡', stageIndex: 1,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'ruin_guard_a', name: '遺跡守衛', baseStats: { hp: 160, atk: 30, def: 28, spd: 10 }, skillIds: [] },
      { id: 'ruin_guard_b', name: '遺跡守衛', baseStats: { hp: 160, atk: 30, def: 28, spd: 10 }, skillIds: [] },
      { id: 'gargoyle', name: '石像怪', baseStats: { hp: 220, atk: 35, def: 30, spd: 6 }, skillIds: [] },
    ],
    expReward: 360, currencyReward: 180,
  },
  {
    id: '5-3', chapterId: 'ch5', name: '暗影神殿', stageIndex: 2,
    isBoss: false, isSideQuest: false, unlockCharacterId: 'echo',
    enemies: [
      { id: 'shadow_a', name: '暗影刺客', baseStats: { hp: 100, atk: 40, def: 12, spd: 24 }, skillIds: [] },
      { id: 'shadow_b', name: '暗影刺客', baseStats: { hp: 100, atk: 40, def: 12, spd: 24 }, skillIds: [] },
      { id: 'shadow_c', name: '暗影刺客', baseStats: { hp: 100, atk: 40, def: 12, spd: 24 }, skillIds: [] },
    ],
    expReward: 380, currencyReward: 190,
  },
  {
    id: '5-4', chapterId: 'ch5', name: '絕頂天台', stageIndex: 3,
    isBoss: false, isSideQuest: false,
    enemies: [
      { id: 'elite_guard_a', name: '精英守衛', baseStats: { hp: 180, atk: 36, def: 26, spd: 14 }, skillIds: [] },
      { id: 'elite_guard_b', name: '精英守衛', baseStats: { hp: 180, atk: 36, def: 26, spd: 14 }, skillIds: [] },
      { id: 'top_samurai', name: '頂尖武士', baseStats: { hp: 200, atk: 42, def: 28, spd: 18 }, skillIds: [] },
    ],
    expReward: 420, currencyReward: 210,
  },
  {
    id: '5-5', chapterId: 'ch5', name: '[BOSS] AAAA', stageIndex: 4,
    isBoss: true, isSideQuest: false, unlockCharacterId: 'aaaa',
    enemies: [{ id: 'aaaa', name: 'AAAA', baseStats: { hp: 600, atk: 50, def: 40, spd: 20 }, skillIds: [] }],
    expReward: 500, currencyReward: 300,
  },

  // ── Side Quests ──────────────────────────────────────────────────────────
  {
    id: 'SQ-1', chapterId: 'sq', name: '廢土競技場', stageIndex: 0,
    isBoss: false, isSideQuest: true, unlockAfterStageId: '1-5',
    enemies: [
      { id: 'arena_a', name: '競技場鬥士', baseStats: { hp: 90, atk: 22, def: 10, spd: 14 }, skillIds: [] },
      { id: 'arena_b', name: '競技場鬥士', baseStats: { hp: 90, atk: 22, def: 10, spd: 14 }, skillIds: [] },
      { id: 'arena_c', name: '競技場鬥士', baseStats: { hp: 90, atk: 22, def: 10, spd: 14 }, skillIds: [] },
      { id: 'arena_champ', name: '競技場冠軍', baseStats: { hp: 150, atk: 30, def: 15, spd: 12 }, skillIds: [] },
    ],
    expReward: 160, currencyReward: 200,
  },
  {
    id: 'SQ-2', chapterId: 'sq', name: '黑市突襲', stageIndex: 0,
    isBoss: false, isSideQuest: true, unlockAfterStageId: '2-3',
    enemies: [
      { id: 'raider_a', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'raider_b', name: '掠奪者', baseStats: { hp: 80, atk: 20, def: 8, spd: 12 }, skillIds: [] },
      { id: 'market_boss', name: '黑市老大', baseStats: { hp: 170, atk: 32, def: 18, spd: 13 }, skillIds: [] },
    ],
    expReward: 220, currencyReward: 280,
  },
  {
    id: 'SQ-3', chapterId: 'sq', name: '古代遺跡探索', stageIndex: 0,
    isBoss: false, isSideQuest: true, unlockAfterStageId: '3-5',
    enemies: [
      { id: 'ancient_a', name: '古代守護者', baseStats: { hp: 200, atk: 34, def: 30, spd: 8 }, skillIds: [] },
      { id: 'ancient_b', name: '古代守護者', baseStats: { hp: 200, atk: 34, def: 30, spd: 8 }, skillIds: [] },
      { id: 'ruin_deity', name: '遺跡主神', baseStats: { hp: 300, atk: 38, def: 35, spd: 10 }, skillIds: [] },
    ],
    expReward: 360, currencyReward: 350,
  },
];
```

- [ ] **Step 2: Run tests to verify stage data tests pass**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: StageData tests for stages PASS. Chapter tests still FAIL (chapters.ts missing).

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/data/stages.ts workspace-pixel-squad/tests/unit/StageData.test.ts
git commit -m "feat(pixel-squad): rewrite stages.ts with 25 main stages + 3 side quests"
```

---

### Task 4: Create chapters.ts

**Files:**
- Create: `workspace-pixel-squad/src/data/chapters.ts`

- [ ] **Step 1: Create chapters.ts**

Create `workspace-pixel-squad/src/data/chapters.ts`:

```typescript
import type { Chapter } from '../types';

export const CHAPTERS: Chapter[] = [
  {
    id: 'ch1',
    name: '第1章 廢城遺跡',
    stageIds: ['1-1', '1-2', '1-3', '1-4', '1-5'],
  },
  {
    id: 'ch2',
    name: '第2章 破敗工廠',
    stageIds: ['2-1', '2-2', '2-3', '2-4', '2-5'],
    unlockAfterChapterId: 'ch1',
  },
  {
    id: 'ch3',
    name: '第3章 輻射荒原',
    stageIds: ['3-1', '3-2', '3-3', '3-4', '3-5'],
    unlockAfterChapterId: 'ch2',
  },
  {
    id: 'ch4',
    name: '第4章 機械廢都',
    stageIds: ['4-1', '4-2', '4-3', '4-4', '4-5'],
    unlockAfterChapterId: 'ch3',
  },
  {
    id: 'ch5',
    name: '第5章 亡靈禁地',
    stageIds: ['5-1', '5-2', '5-3', '5-4', '5-5'],
    unlockAfterChapterId: 'ch4',
  },
];
```

- [ ] **Step 2: Run tests to verify all StageData tests pass**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: all 7 StageData tests PASS. All other existing tests still PASS.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add workspace-pixel-squad/src/data/chapters.ts
git commit -m "feat(pixel-squad): add chapters.ts with 5 chapter definitions"
```

---

### Task 5: Create WorldMapScene

**Files:**
- Create: `workspace-pixel-squad/src/scenes/WorldMapScene.ts`
- Modify: `workspace-pixel-squad/src/main.ts`

Note: Phaser scene UI cannot be unit tested. This task has no unit tests.

- [ ] **Step 1: Create WorldMapScene.ts**

Create `workspace-pixel-squad/src/scenes/WorldMapScene.ts`:

```typescript
import Phaser from 'phaser';
import { STAGES } from '../data/stages';
import { CHAPTERS } from '../data/chapters';
import { saveSlot } from '../save/SaveSystem';
import type { GameState, Stage } from '../types';

export class WorldMapScene extends Phaser.Scene {
  private gameState!: GameState;
  private scrollY = 0;
  private contentContainer!: Phaser.GameObjects.Container;

  constructor() { super({ key: 'WorldMapScene' }); }

  create(gameState: GameState) {
    this.gameState = gameState;
    const W = 360, H = 640;

    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    // Header
    this.add.text(W / 2, 20, '世界地圖', {
      fontSize: '18px', color: '#e5e7eb', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.add.text(20, 20, `幣:${gameState.currency}`, {
      fontSize: '12px', color: '#fde047', fontFamily: 'monospace',
    });

    this.add.text(200, 20, `EXP池:${gameState.expPool}`, {
      fontSize: '12px', color: '#4ade80', fontFamily: 'monospace',
    });

    // 基地 button
    const baseBtn = this.add.rectangle(W - 50, 20, 80, 28, 0x374151)
      .setInteractive({ useHandCursor: true }).setOrigin(0.5, 0);
    this.add.text(W - 50, 26, '基地', {
      fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace',
    }).setOrigin(0.5);
    baseBtn.on('pointerdown', () => this.scene.start('BaseScene', this.gameState));

    this.add.line(W / 2, 50, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);

    // Scrollable content
    this.contentContainer = this.add.container(0, 52);
    this.renderMap();

    // Scroll input
    this.input.on('wheel', (_ptr: unknown, _gos: unknown, _dx: number, dy: number) => {
      this.scrollY = Math.max(0, Math.min(this.maxScrollY(), this.scrollY + dy * 0.5));
      this.contentContainer.setY(52 - this.scrollY);
    });
  }

  private maxScrollY(): number {
    const totalH = this.estimatedContentHeight();
    return Math.max(0, totalH - 580);
  }

  private estimatedContentHeight(): number {
    const mainH = CHAPTERS.length * (32 + 5 * 48) + 20;
    const sqCount = STAGES.filter(s => s.isSideQuest).length;
    return mainH + sqCount * 48 + 60;
  }

  private renderMap() {
    let y = 0;
    const W = 360;
    const completed = new Set(this.gameState.stageProgress.completedStageIds);
    const inRun = this.gameState.stageProgress.inChapterRun;

    CHAPTERS.forEach(chapter => {
      const chLocked = chapter.unlockAfterChapterId
        ? !completed.has(chapter.unlockAfterChapterId + '-5')
        : false;

      // Chapter header
      const headerBg = this.add.rectangle(W / 2, y + 16, W - 20, 30, chLocked ? 0x111827 : 0x1f2937)
        .setStrokeStyle(1, 0x374151);
      this.contentContainer.add(headerBg);

      const headerLabel = chLocked ? `▶ ${chapter.name} (鎖定)` : `▼ ${chapter.name}`;
      const headerColor = chLocked ? '#4b5563' : '#e5e7eb';
      const headerText = this.add.text(20, y + 16, headerLabel, {
        fontSize: '13px', color: headerColor, fontFamily: 'monospace',
      }).setOrigin(0, 0.5);
      this.contentContainer.add(headerText);
      y += 34;

      if (!chLocked) {
        const stages = STAGES.filter(s => s.chapterId === chapter.id);
        stages.forEach(stage => {
          y = this.renderStageRow(stage, y, completed, inRun, W);
        });
      }
    });

    // Side quests section
    const unlockedSideQuests = STAGES.filter(s =>
      s.isSideQuest && (!s.unlockAfterStageId || completed.has(s.unlockAfterStageId))
    );
    if (unlockedSideQuests.length > 0) {
      y += 10;
      const sqHeader = this.add.text(20, y + 8, '支線任務', {
        fontSize: '13px', color: '#a78bfa', fontFamily: 'monospace',
      });
      this.contentContainer.add(sqHeader);
      y += 26;
      unlockedSideQuests.forEach(stage => {
        y = this.renderStageRow(stage, y, completed, inRun, W);
      });
    }
  }

  private renderStageRow(
    stage: Stage,
    y: number,
    completed: Set<string>,
    inRun: GameState['stageProgress']['inChapterRun'],
    W: number,
  ): number {
    const isDone = completed.has(stage.id);
    const isLocked = this.isLocked(stage, completed);
    const isInRunNext = inRun?.chapterId === stage.chapterId &&
      STAGES.filter(s => s.chapterId === stage.chapterId)[inRun.currentStageIndex]?.id === stage.id;

    const rowBg = this.add.rectangle(W / 2, y + 20, W - 30, 38, isLocked ? 0x0a0f1a : 0x1f2937)
      .setStrokeStyle(1, isLocked ? 0x1f2937 : 0x374151);
    this.contentContainer.add(rowBg);

    const nameColor = isLocked ? '#374151' : stage.isBoss ? '#f59e0b' : '#e5e7eb';
    const nameText = this.add.text(28, y + 20,
      `${isDone ? '✓' : isLocked ? '🔒' : '→'} ${stage.name}`,
      { fontSize: '12px', color: nameColor, fontFamily: 'monospace' }
    ).setOrigin(0, 0.5);
    this.contentContainer.add(nameText);

    if (!isLocked) {
      const btnLabel = isDone ? '重打' : '進入';
      const btnColor = isInRunNext ? 0x7c3aed : isDone ? 0x374151 : 0x16a34a;
      const btn = this.add.rectangle(W - 40, y + 20, 60, 28, btnColor)
        .setInteractive({ useHandCursor: true });
      const btnTxt = this.add.text(W - 40, y + 20, btnLabel, {
        fontSize: '11px', color: '#fff', fontFamily: 'monospace',
      }).setOrigin(0.5);
      btn.on('pointerdown', () => this.onStageSelect(stage));
      btn.on('pointerover', () => btn.setAlpha(0.8));
      btn.on('pointerout', () => btn.setAlpha(1));
      this.contentContainer.add([btn, btnTxt]);
    }

    return y + 44;
  }

  private isLocked(stage: Stage, completed: Set<string>): boolean {
    if (stage.isSideQuest) {
      return !!stage.unlockAfterStageId && !completed.has(stage.unlockAfterStageId);
    }
    const chapterStages = STAGES
      .filter(s => s.chapterId === stage.chapterId && !s.isSideQuest)
      .sort((a, b) => a.stageIndex - b.stageIndex);
    const stageIdx = chapterStages.findIndex(s => s.id === stage.id);
    if (stageIdx === 0) return false;
    return !completed.has(chapterStages[stageIdx - 1].id);
  }

  private onStageSelect(stage: Stage) {
    const inRun = this.gameState.stageProgress.inChapterRun;
    if (inRun && (inRun.chapterId !== stage.chapterId || stage.isSideQuest)) {
      this.showMessage('請先完成當前章節或放棄！');
      return;
    }

    const stageArrayIndex = STAGES.findIndex(s => s.id === stage.id);
    if (!inRun && !stage.isSideQuest) {
      const chapterStages = STAGES.filter(s => s.chapterId === stage.chapterId);
      this.gameState.stageProgress.inChapterRun = {
        chapterId: stage.chapterId,
        currentStageIndex: stage.stageIndex,
        lockedSquad: [...this.gameState.squad],
      };
    }
    saveSlot(this.gameState);
    this.scene.start('BattleScene', {
      playerParty: inRun ? inRun.lockedSquad : this.gameState.squad,
      stageIndex: stageArrayIndex,
      expPool: this.gameState.expPool,
      gameState: this.gameState,
    });
  }

  private showMessage(msg: string) {
    const W = 360;
    const txt = this.add.text(W / 2, 320, msg, {
      fontSize: '13px', color: '#fde047', fontFamily: 'monospace',
      backgroundColor: '#111827',
      padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setDepth(20);
    this.time.delayedCall(2000, () => txt.destroy());
  }
}
```

- [ ] **Step 2: Register WorldMapScene in main.ts**

Update `workspace-pixel-squad/src/main.ts`:

```typescript
import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
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
  scene: [TitleScene, BattleScene, ResultScene, PrepScene, WorldMapScene],
};

new Phaser.Game(config);
```

- [ ] **Step 3: Verify TypeScript compiles and all tests pass**

```bash
cd workspace-pixel-squad && npx tsc --noEmit && npm run test:unit
```

Expected: no errors, all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add workspace-pixel-squad/src/scenes/WorldMapScene.ts workspace-pixel-squad/src/main.ts
git commit -m "feat(pixel-squad): add WorldMapScene with chapter/stage navigation"
```

---

## Summary

After all tasks:
- `Stage` is extended with `chapterId`, `stageIndex`, `isBoss`, `isSideQuest`, `currencyReward`, `unlockCharacterId`
- `Chapter` interface added to `types.ts`
- `stages.ts` has all 28 stages (25 main + 3 side quests) with full enemy data
- `chapters.ts` has 5 chapter definitions
- `WorldMapScene.ts` shows chapter list, stage rows, locked/completed states, and launches battles
- Unit tests in `StageData.test.ts` validate data integrity

**Next plan to implement:** `2026-06-24-pixel-squad-character-pool.md`
