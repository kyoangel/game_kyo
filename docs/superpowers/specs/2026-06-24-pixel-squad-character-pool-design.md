# Pixel Squad — Character Pool + Recruitment System Design

> **Status:** Approved for implementation.

---

## Overview

The player starts with only the protagonist. Non-protagonist characters are acquired in two ways: automatic stage unlocks (cleared on first completion) and in-battle recruitment (surrender mechanic when the last enemy is below 50% HP).

All character names can be changed in future content updates — name strings live in `characters.ts` as plain data.

---

## Full Character Roster

| ID | Name | Archetype | Unlock Method | Base Stats (HP/ATK/DEF/SPD) | Growth/lvl |
|----|------|-----------|--------------|------------------------------|------------|
| protagonist | 倖存者 | 全能 | Start | 100 / 25 / 10 / 15 | manual pts |
| rex | Rex | 坦克 | Clear 1-2 | 150 / 15 / 25 / 8 | 12/2/4/1 |
| nyx | Nyx | 狙擊 | Clear 1-4 | 70 / 30 / 8 / 22 | 5/5/1/3 |
| vega | Vega | 輸出 | Recruit 1-5 | 90 / 35 / 12 / 16 | 6/6/2/2 |
| ash | Ash | 全能 | Clear 2-2 | 110 / 22 / 18 / 13 | 8/4/3/2 |
| crow | Crow | 狙擊 | Recruit 2-5 | 75 / 32 / 8 / 26 | 4/6/1/4 |
| mira | Mira | 輔助 | Clear 3-3 | 120 / 18 / 28 / 14 | 10/2/5/2 |
| zora | Zora | 輔助 | Recruit 3-5 | 130 / 20 / 30 / 12 | 12/2/6/1 |
| rook | Rook | 坦克 | Clear 4-2 | 180 / 18 / 32 / 7 | 15/2/5/1 |
| dex | Dex | 坦克 | Recruit 4-5 | 200 / 22 / 38 / 6 | 18/2/6/1 |
| echo | Echo | 狙擊 | Clear 5-3 | 80 / 38 / 10 / 28 | 5/7/1/4 |
| aaaa | AAAA | 輸出 | Recruit 5-5 | 160 / 48 / 20 / 18 | 10/8/3/3 |

All characters except protagonist use `statGrowth`-based auto level-up (handled by existing `LevelUpSystem`).

---

## CharacterTemplate Changes

```typescript
// Extend existing CharacterTemplate in types.ts
export interface CharacterTemplate {
  id: string;
  name: string;                 // changeable — plain string in data file
  isProtagonist: boolean;
  baseStats: StatBlock;
  skillIds: string[];
  statGrowth: StatBlock;        // per-level auto growth (non-protagonist)
  unlockMethod: 'start' | 'stage' | 'recruit';
  unlockStageId?: string;       // for 'stage' and 'recruit' types
}
```

---

## Variable Squad Size

- `squad: Character[]` in `GameState` — 1 to 5 members
- `BattleScene` must support variable party sizes (not hardcoded 3)
- `CharacterView` layout adapts: 1–3 chars stacked vertically left side, 4–5 chars use two-column layout
- Enemy party size set per stage (1–5 enemies)

---

## Stage Unlock Flow

When a stage is cleared for the first time:
1. Check `stage.unlockCharacterId`
2. If set and character not already in pool → create `Character` from template at Lv.1 → add to `gameState.pool`
3. Auto-save

The unlocked character is NOT automatically added to the active squad — player selects squad in BaseScene.

---

## Recruitment System

### Eligibility Check

```typescript
// src/battle/RecruitSystem.ts

export function canAttemptRecruit(enemy: Character): boolean {
  return enemy.alive && (enemy.stats.hp / enemy.stats.maxHp) < 0.5;
}
```

The "勸降" action appears in the player's action menu only when:
1. It is a player character's turn
2. There is exactly 1 alive enemy remaining
3. That enemy passes `canAttemptRecruit`

### Probability Formula

```typescript
export function recruitChance(enemy: Character, isNamedCharacter: boolean): number {
  const hpRatio = enemy.stats.hp / enemy.stats.maxHp;
  const base = Math.floor((1 - 2 * hpRatio) * 100); // 0–100
  return isNamedCharacter ? Math.floor(base / 2) : base;
}
```

Examples:
| HP ratio | Base chance | Named boss chance |
|----------|------------|-------------------|
| 50% | 0% | 0% |
| 30% | 40% | 20% |
| 10% | 80% | 40% |
| 5% | 90% | 45% |
| 1% | 98% | 49% |

### Attempt Resolution

```typescript
export function attemptRecruit(chance: number): boolean {
  return Math.random() * 100 < chance;
}
```

### BattleScene Integration

When player selects 勸降:
1. Roll `attemptRecruit(recruitChance(enemy, isNamed))`
2. **Regardless of success/failure:** enemy executes one normal attack against a random player character
3. If success: mark enemy as `recruited = true`, end battle as victory after attack
4. If failure: resume normal battle (enemy still alive)

Show result message:
- Success: `「{name}」決定加入你的隊伍！`
- Failure: `「{name}」拒絕了你的勸降！`

### Post-Battle Pool Update

On battle victory where a character was recruited:
```
ResultScene shows: "新成員：{name} 加入了！"
GameState.pool.push(newCharacter)
saveSlot(gameState)
```

---

## isNamedCharacter Detection

A character is "named" if its `templateId` matches any of the boss template IDs (vega, crow, zora, dex, aaaa, and future additions). Store this as a simple Set in `RecruitSystem.ts`:

```typescript
const NAMED_CHARACTER_IDS = new Set(['vega', 'crow', 'zora', 'dex', 'aaaa']);
export function isNamedCharacter(templateId: string): boolean {
  return NAMED_CHARACTER_IDS.has(templateId);
}
```

---

## File Map

| File | Action |
|------|--------|
| `src/data/characters.ts` | REWRITE — 12 character templates with new fields |
| `src/battle/RecruitSystem.ts` | CREATE — `canAttemptRecruit`, `recruitChance`, `attemptRecruit`, `isNamedCharacter` |
| `src/scenes/BattleScene.ts` | MODIFY — variable party layout, add 勸降 action, trigger recruit flow |
| `src/types.ts` | MODIFY — extend `CharacterTemplate` with `unlockMethod`, `unlockStageId` |

---

## Out of Scope

- Per-character custom recruitment dialogue (special named character mechanic — future design)
- Recruitment of enemy types that aren't CharacterTemplates
- Character dismissal from pool
