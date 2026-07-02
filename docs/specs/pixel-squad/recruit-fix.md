# 勸降入伍失效 — 修復 Spec

## Goal

勸降成功的敵人（無論是否在 `PLAYER_TEMPLATES` 中）都必須確實進入 `pool`／`squad`，且結果畫面的入伍訊息只在角色真正被持久化時才顯示。

## 背景 / 根因

- `VictoryProcessor.ts:81` 用 `recruitedEnemy.templateId` 去 `PLAYER_TEMPLATES.find(...)` 配對。
- 只有 `vega` / `crow` / `zora` / `dex` / `aaaa`（`RecruitSystem.ts` 的 `NAMED_CHARACTER_IDS`）的 enemy template id 恰好等於某個 `PLAYER_TEMPLATES` id，這是刻意設計（具名敵人入伍後套用預先設計好的玩家版本數值/技能）。
- 一般雜兵（`mutant`、`wolf_a`、`raider_sniper` 等）的 `templateId` 不在 `PLAYER_TEMPLATES` 裡 → `template` 為 `undefined` → 不會 `push` 進 `pool` → 靜默失敗，玩家看不到任何錯誤但角色消失。
- `ResultScene.ts:66-70` 只要 `recruitedEnemy` 存在就顯示「新成員加入了！」，不檢查角色是否真的寫進 `updatedGameState.pool`，也不檢查 `gameState`／`updatedGameState` 是否存在（非章節流程進入時兩者皆為 `undefined`），因此即使入伍從未持久化，文案仍會誤導玩家。

## Rules

1. **具名角色**（`templateId` ∈ `NAMED_CHARACTER_IDS`）維持現有行為：若 `PLAYER_TEMPLATES` 中找得到對應 template，用 `createCharacter(template, level)` 建立（保留預先設計的玩家版技能/成長曲線）。
2. **一般雜兵**（`templateId` 不在 `PLAYER_TEMPLATES`）：改用敵人自身的即時資料直接轉換成可用的玩家角色，不再依賴模板查表：
   - 保留原敵人的 `name`、`templateId`、`level`（至少 1）。
   - `stats`：以敵人當前的 `atk`/`def`/`spd` 為基礎；`maxHp` 用敵人模板的滿血值（非戰鬥結束時殘餘血量），入伍角色以滿血加入。
   - `skills`：沿用敵人原本的 `skills`（敵人技能 id 應已存在於 `SKILLS` 表，因為戰鬥中已被使用過）。
   - `archetype`：用 `computeArchetype(stats)` 重新計算（敵人本身沒有這個欄位）。
   - `isPlayer: true`、`isProtagonist: false`、`alive: true`、`defending: false`、`activeBuffs: []`、`skillCooldowns: {}`、`exp: 0`、`expToNext: expToNextLevel(level)`、`statPoints: 0`。
   - `id` 用 `CharacterFactory.nextId(templateId)` 產生新的戰鬥實例 id（不可重用敵人在戰鬥中的 `id`，避免與舊敵人實例 id 衝突或被誤判為同一隻）。
3. 兩種路徑共用同一段「加入 pool / 自動入隊」邏輯：若 `pool` 中已有相同 `templateId` 的角色就不重複加入；若 `squad.length < 5` 且該角色尚未在 `squad` 中，自動加入 `squad`。
4. **持久化保證**：`recruitedEnemy` 存在但 `gameState` 為 `undefined`（非章節流程進入 ResultScene）的情況下，`processVictory` 無法執行，因此入伍不會被存檔。此時 ResultScene **不得**顯示「新成員加入了！」文案；只有在 `updatedGameState` 真正包含該角色（即 `gameState` 存在且 `processVictory` 已執行）時才顯示。
5. 不修改既有「具名角色用模板版數值」這項已驗證過的設計（仅補完雜兵路徑），避免破壞現有具名角色測試。

## Data model changes

`types.ts` 不需新增欄位。`CharacterFactory.ts` 新增一個轉換函式：

```ts
// CharacterFactory.ts
import { computeArchetype } from './Archetype';
import { expToNextLevel } from './CharacterFactory'; // already local

/**
 * Converts a defeated-then-recruited enemy Character into a player-controlled
 * Character, for enemies that have no matching entry in PLAYER_TEMPLATES.
 * Enemy is restored to full HP and keeps its current atk/def/spd and skills.
 */
export function enemyToPlayerCharacter(enemy: Character, maxHp: number): Character {
  const level = Math.max(1, enemy.level);
  return {
    id: nextId(enemy.templateId),
    templateId: enemy.templateId,
    name: enemy.name,
    isProtagonist: false,
    isPlayer: true,
    level,
    exp: 0,
    expToNext: expToNextLevel(level),
    stats: {
      hp: maxHp,
      maxHp,
      atk: enemy.stats.atk,
      def: enemy.stats.def,
      spd: enemy.stats.spd,
    },
    skills: enemy.skills,
    statPoints: 0,
    archetype: computeArchetype({ hp: maxHp, atk: enemy.stats.atk, def: enemy.stats.def, spd: enemy.stats.spd }),
    alive: true,
    defending: false,
    activeBuffs: [],
    skillCooldowns: {},
  };
}
```

`maxHp` must be passed in by the caller because `Character.stats.maxHp` on a defeated/low-HP `recruitedEnemy` reflects the *enemy template's* max HP at the moment of battle (no level scaling for enemies), so `recruitedEnemy.stats.maxHp` is already correct and can be passed directly — no new field needed on `EnemyTemplate` or `Character`.

`VictoryProcessor.ts` recruit block becomes:

```ts
if (recruitedEnemy) {
  const alreadyInPool = state.pool.some(c => c.templateId === recruitedEnemy.templateId);
  if (!alreadyInPool) {
    const template = PLAYER_TEMPLATES.find(t => t.id === recruitedEnemy.templateId);
    const newChar = template
      ? createCharacter(template, Math.max(1, recruitedEnemy.level))
      : enemyToPlayerCharacter(recruitedEnemy, recruitedEnemy.stats.maxHp);
    state.pool.push(newChar);
  }
  const poolChar = state.pool.find(c => c.templateId === recruitedEnemy.templateId);
  if (poolChar && !state.squad.some(s => s.id === poolChar.id) && state.squad.length < 5) {
    state.squad.push(poolChar);
  }
}
```

## UI changes

`ResultScene.ts` create():

- Compute `recruitJoined` only after `processVictory` runs: a recruit is considered "joined" if `updatedGameState` exists and `updatedGameState.pool.some(c => c.templateId === recruitedEnemy.templateId && !gameState!.pool.some(p => p.templateId === c.templateId))` — simpler: reuse the same "newChar" diff pattern already used for story-join (lines 71-84), and fold recruit into that same diff instead of a separate early branch keyed only on `recruitedEnemy` truthiness.
- Concretely: remove the standalone `if (recruitedEnemy) { ... }` text block. Replace with: after computing `updatedGameState`, find `newChar = updatedGameState?.pool.find(c => !gameState?.pool.some(p => p.id === c.id))` (covers both stage-unlock and recruit cases, since both push exactly one new pool entry per victory in current design) and show the existing 「加入了小隊！／加入了基地！」 message for it. This naturally suppresses the message whenever `gameState`/`updatedGameState` is undefined, satisfying Rule 4 without a separate code path.
- No other scene changes required (PrepScene/BaseScene already read squad/pool from `GameState`, so once `pool`/`squad` are correct, the character shows up there automatically).

## Acceptance Criteria

- **Given** a recruited enemy whose `templateId` ('mutant') has no matching `PLAYER_TEMPLATES` entry, **when** `processVictory` runs, **then** the returned state's `pool` contains a character with `templateId === 'mutant'`, `isPlayer === true`, `name` equal to the enemy's name, and `stats.maxHp/atk/def/spd` all > 0.
- **Given** the same scenario and `squad.length < 5`, **when** `processVictory` runs, **then** the new character is also present in `squad`.
- **Given** `squad.length === 5`, **when** a non-named enemy is recruited, **then** the character is added to `pool` but not `squad`.
- **Given** a recruited enemy whose `templateId` IS in `PLAYER_TEMPLATES` (e.g. `vega`), **when** `processVictory` runs, **then** behavior is unchanged: the pool entry's stats/skills come from `createCharacter(template, level)`, not from `enemyToPlayerCharacter`.
- **Given** `recruitedEnemy` is set but `gameState` is `undefined` (ResultScene entered outside chapter flow), **when** ResultScene renders, **then** no 「加入了」message is shown (since persistence cannot happen).
- **Given** a successful recruit with `gameState` present, **when** the player taps 整備, **then** `BaseScene` receives the `updatedGameState` containing the recruited character in `pool`, and pool/squad show the character on subsequent screens.
- Existing `RecruitSystem.test.ts` and any existing `VictoryProcessor`/recruit tests continue to pass unmodified.
- New test file `tests/unit/VictoryProcessor.recruit.test.ts` covers the four `processVictory` cases above.
