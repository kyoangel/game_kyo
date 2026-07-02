# Pixel Squad — Character Pool + Recruitment System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the full 12-character roster, a recruitment (勸降) system, and variable party size support in BattleScene (1–5 members).

**Architecture:** `CharacterTemplate` gains `unlockMethod`/`unlockStageId` fields. `characters.ts` is rewritten with all 12 templates. `RecruitSystem.ts` contains pure probability functions. `BattleScene` gets a two-column layout for 4–5 party members and a new 勸降 action. `ResultScene` gains an optional `recruitedEnemy` field to display the new member message.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest (node environment)

**Prerequisite:** Plan `2026-06-24-pixel-squad-save-system.md` must be complete — `GameState` type must exist. Plan `2026-06-24-pixel-squad-world-map.md` must be complete — extended `Stage` type with `unlockCharacterId` must exist.

---

## File Map

| File | Action |
|------|--------|
| `workspace-pixel-squad/src/types.ts` | MODIFY — extend `CharacterTemplate`, extend `ResultSceneData`, add `recruited?: boolean` to `Character` |
| `workspace-pixel-squad/src/data/characters.ts` | REWRITE — 12 character templates |
| `workspace-pixel-squad/src/battle/RecruitSystem.ts` | CREATE — pure recruit probability functions |
| `workspace-pixel-squad/src/scenes/BattleScene.ts` | MODIFY — variable party layout, 勸降 action |
| `workspace-pixel-squad/src/scenes/ResultScene.ts` | MODIFY — show recruited member message |
| `workspace-pixel-squad/tests/unit/RecruitSystem.test.ts` | CREATE — unit tests for recruit functions |
| `workspace-pixel-squad/tests/unit/CharacterData.test.ts` | CREATE — character template shape validation |

---

### Task 1: Extend types.ts

**Files:**
- Modify: `workspace-pixel-squad/src/types.ts`

- [ ] **Step 1: Add unlockMethod/unlockStageId to CharacterTemplate, recruited to Character, recruitedEnemy to ResultSceneData**

In `workspace-pixel-squad/src/types.ts`:

Replace the `CharacterTemplate` interface:
```typescript
/** Static definition — used to instantiate Character */
export interface CharacterTemplate {
  id: string;
  name: string;
  isProtagonist: boolean;
  baseStats: StatBlock;
  skillIds: string[];
  /** Auto stat growth per level (non-protagonist only) */
  statGrowth: StatBlock;
  unlockMethod: 'start' | 'stage' | 'recruit';
  unlockStageId?: string;  // for 'stage' and 'recruit' types
}
```

Add `recruited?: boolean` to the `Character` interface (after `defending: boolean`):
```typescript
  defending: boolean;   // true = -50% damage this round
  recruited?: boolean;  // true = this enemy was convinced to join
```

Replace the `ResultSceneData` interface:
```typescript
export interface ResultSceneData {
  victory: boolean;
  playerParty: Character[];
  stageIndex: number;
  expGained: number;
  expPool?: number;
  recruitedEnemy?: Character;  // set if a recruit succeeded during battle
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: errors because `characters.ts` uses old `CharacterTemplate` shape. Fix in Task 2.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/types.ts
git commit -m "feat(pixel-squad): extend CharacterTemplate with unlockMethod, add recruited/recruitedEnemy fields"
```

---

### Task 2: Write character data tests, then rewrite characters.ts

**Files:**
- Create: `workspace-pixel-squad/tests/unit/CharacterData.test.ts`
- Modify: `workspace-pixel-squad/src/data/characters.ts`

- [ ] **Step 1: Write failing character data tests**

Create `workspace-pixel-squad/tests/unit/CharacterData.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PLAYER_TEMPLATES } from '../../src/data/characters';

describe('PLAYER_TEMPLATES', () => {
  it('has exactly 12 templates', () => {
    expect(PLAYER_TEMPLATES).toHaveLength(12);
  });

  it('has exactly one protagonist', () => {
    expect(PLAYER_TEMPLATES.filter(t => t.isProtagonist)).toHaveLength(1);
    expect(PLAYER_TEMPLATES[0].isProtagonist).toBe(true);
  });

  it('protagonist has unlockMethod start', () => {
    const p = PLAYER_TEMPLATES.find(t => t.isProtagonist)!;
    expect(p.unlockMethod).toBe('start');
  });

  it('all templates have required fields', () => {
    PLAYER_TEMPLATES.forEach(t => {
      expect(t.id, `${t.id} missing id`).toBeTruthy();
      expect(t.name, `${t.id} missing name`).toBeTruthy();
      expect(t.baseStats.hp, `${t.id} missing hp`).toBeGreaterThan(0);
      expect(['start', 'stage', 'recruit']).toContain(t.unlockMethod);
      if (t.unlockMethod !== 'start') {
        expect(t.unlockStageId, `${t.id} missing unlockStageId`).toBeTruthy();
      }
    });
  });

  it('template IDs are unique', () => {
    const ids = PLAYER_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('non-protagonist templates have non-zero statGrowth totals', () => {
    PLAYER_TEMPLATES.filter(t => !t.isProtagonist).forEach(t => {
      const total = t.statGrowth.hp + t.statGrowth.atk + t.statGrowth.def + t.statGrowth.spd;
      expect(total, `${t.id} has zero stat growth`).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: FAIL — template count is 3, no unlockMethod field.

- [ ] **Step 3: Rewrite characters.ts**

Replace entire contents of `workspace-pixel-squad/src/data/characters.ts`:

```typescript
import type { CharacterTemplate } from '../types';

export const PLAYER_TEMPLATES: CharacterTemplate[] = [
  {
    id: 'protagonist', name: '倖存者', isProtagonist: true,
    baseStats: { hp: 100, atk: 25, def: 10, spd: 15 },
    skillIds: ['burst_shot'],
    statGrowth: { hp: 0, atk: 0, def: 0, spd: 0 },
    unlockMethod: 'start',
  },
  {
    id: 'rex', name: 'Rex', isProtagonist: false,
    baseStats: { hp: 150, atk: 15, def: 25, spd: 8 },
    skillIds: ['shield_bash'],
    statGrowth: { hp: 12, atk: 2, def: 4, spd: 1 },
    unlockMethod: 'stage', unlockStageId: '1-2',
  },
  {
    id: 'nyx', name: 'Nyx', isProtagonist: false,
    baseStats: { hp: 70, atk: 30, def: 8, spd: 22 },
    skillIds: ['swift_strike'],
    statGrowth: { hp: 5, atk: 5, def: 1, spd: 3 },
    unlockMethod: 'stage', unlockStageId: '1-4',
  },
  {
    id: 'vega', name: 'Vega', isProtagonist: false,
    baseStats: { hp: 90, atk: 35, def: 12, spd: 16 },
    skillIds: [],
    statGrowth: { hp: 6, atk: 6, def: 2, spd: 2 },
    unlockMethod: 'recruit', unlockStageId: '1-5',
  },
  {
    id: 'ash', name: 'Ash', isProtagonist: false,
    baseStats: { hp: 110, atk: 22, def: 18, spd: 13 },
    skillIds: [],
    statGrowth: { hp: 8, atk: 4, def: 3, spd: 2 },
    unlockMethod: 'stage', unlockStageId: '2-2',
  },
  {
    id: 'crow', name: 'Crow', isProtagonist: false,
    baseStats: { hp: 75, atk: 32, def: 8, spd: 26 },
    skillIds: [],
    statGrowth: { hp: 4, atk: 6, def: 1, spd: 4 },
    unlockMethod: 'recruit', unlockStageId: '2-5',
  },
  {
    id: 'mira', name: 'Mira', isProtagonist: false,
    baseStats: { hp: 120, atk: 18, def: 28, spd: 14 },
    skillIds: [],
    statGrowth: { hp: 10, atk: 2, def: 5, spd: 2 },
    unlockMethod: 'stage', unlockStageId: '3-3',
  },
  {
    id: 'zora', name: 'Zora', isProtagonist: false,
    baseStats: { hp: 130, atk: 20, def: 30, spd: 12 },
    skillIds: [],
    statGrowth: { hp: 12, atk: 2, def: 6, spd: 1 },
    unlockMethod: 'recruit', unlockStageId: '3-5',
  },
  {
    id: 'rook', name: 'Rook', isProtagonist: false,
    baseStats: { hp: 180, atk: 18, def: 32, spd: 7 },
    skillIds: [],
    statGrowth: { hp: 15, atk: 2, def: 5, spd: 1 },
    unlockMethod: 'stage', unlockStageId: '4-2',
  },
  {
    id: 'dex', name: 'Dex', isProtagonist: false,
    baseStats: { hp: 200, atk: 22, def: 38, spd: 6 },
    skillIds: [],
    statGrowth: { hp: 18, atk: 2, def: 6, spd: 1 },
    unlockMethod: 'recruit', unlockStageId: '4-5',
  },
  {
    id: 'echo', name: 'Echo', isProtagonist: false,
    baseStats: { hp: 80, atk: 38, def: 10, spd: 28 },
    skillIds: [],
    statGrowth: { hp: 5, atk: 7, def: 1, spd: 4 },
    unlockMethod: 'stage', unlockStageId: '5-3',
  },
  {
    id: 'aaaa', name: 'AAAA', isProtagonist: false,
    baseStats: { hp: 160, atk: 48, def: 20, spd: 18 },
    skillIds: [],
    statGrowth: { hp: 10, atk: 8, def: 3, spd: 3 },
    unlockMethod: 'recruit', unlockStageId: '5-5',
  },
];
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: all CharacterData tests PASS. All other tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/data/characters.ts workspace-pixel-squad/tests/unit/CharacterData.test.ts
git commit -m "feat(pixel-squad): rewrite characters.ts with all 12 character templates"
```

---

### Task 3: Create RecruitSystem.ts with unit tests

**Files:**
- Create: `workspace-pixel-squad/src/battle/RecruitSystem.ts`
- Create: `workspace-pixel-squad/tests/unit/RecruitSystem.test.ts`

- [ ] **Step 1: Write failing tests**

Create `workspace-pixel-squad/tests/unit/RecruitSystem.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import {
  canAttemptRecruit,
  recruitChance,
  attemptRecruit,
  isNamedCharacter,
} from '../../src/battle/RecruitSystem';
import type { Character } from '../../src/types';

function makeEnemy(hp: number, maxHp: number): Character {
  return {
    id: 'e1', templateId: 'mutant', name: '變種人', isProtagonist: false, isPlayer: false,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp, maxHp, atk: 10, def: 5, spd: 8 },
    skills: [], statPoints: 0, archetype: '坦克', alive: true, defending: false,
  };
}

describe('canAttemptRecruit', () => {
  it('returns true when hp is below 50% of maxHp', () => {
    expect(canAttemptRecruit(makeEnemy(49, 100))).toBe(true);
  });

  it('returns false at exactly 50% hp', () => {
    expect(canAttemptRecruit(makeEnemy(50, 100))).toBe(false);
  });

  it('returns false when hp is above 50%', () => {
    expect(canAttemptRecruit(makeEnemy(80, 100))).toBe(false);
  });

  it('returns false when enemy is dead', () => {
    const enemy = makeEnemy(0, 100);
    enemy.alive = false;
    expect(canAttemptRecruit(enemy)).toBe(false);
  });
});

describe('recruitChance', () => {
  it('returns 0 at exactly 50% hp (boundary)', () => {
    expect(recruitChance(makeEnemy(50, 100), false)).toBe(0);
  });

  it('returns ~80 at 10% hp for non-named', () => {
    // hpRatio = 0.1, base = Math.floor((1 - 2*0.1)*100) = Math.floor(80) = 80
    expect(recruitChance(makeEnemy(10, 100), false)).toBe(80);
  });

  it('returns ~90 at 5% hp for non-named', () => {
    // hpRatio = 0.05, base = Math.floor((1 - 2*0.05)*100) = Math.floor(90) = 90
    expect(recruitChance(makeEnemy(5, 100), false)).toBe(90);
  });

  it('halves the chance for named characters', () => {
    const base = recruitChance(makeEnemy(10, 100), false);
    const named = recruitChance(makeEnemy(10, 100), true);
    expect(named).toBe(Math.floor(base / 2));
  });

  it('returns 40 at 30% hp for non-named', () => {
    // hpRatio = 0.3, base = Math.floor((1 - 0.6)*100) = 40
    expect(recruitChance(makeEnemy(30, 100), false)).toBe(40);
  });
});

describe('attemptRecruit', () => {
  it('returns true when random is below chance/100', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 50% < 80
    expect(attemptRecruit(80)).toBe(true);
    vi.restoreAllMocks();
  });

  it('returns false when random is at or above chance/100', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // 0.8 * 100 = 80, NOT < 80
    expect(attemptRecruit(80)).toBe(false);
    vi.restoreAllMocks();
  });

  it('always returns false at 0% chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(attemptRecruit(0)).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('isNamedCharacter', () => {
  it('returns true for vega', () => { expect(isNamedCharacter('vega')).toBe(true); });
  it('returns true for crow', () => { expect(isNamedCharacter('crow')).toBe(true); });
  it('returns true for zora', () => { expect(isNamedCharacter('zora')).toBe(true); });
  it('returns true for dex', () => { expect(isNamedCharacter('dex')).toBe(true); });
  it('returns true for aaaa', () => { expect(isNamedCharacter('aaaa')).toBe(true); });
  it('returns false for regular enemy', () => { expect(isNamedCharacter('mutant')).toBe(false); });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: FAIL — `Cannot find module '../../src/battle/RecruitSystem'`

- [ ] **Step 3: Create RecruitSystem.ts**

Create `workspace-pixel-squad/src/battle/RecruitSystem.ts`:

```typescript
import type { Character } from '../types';

const NAMED_CHARACTER_IDS = new Set(['vega', 'crow', 'zora', 'dex', 'aaaa']);

export function isNamedCharacter(templateId: string): boolean {
  return NAMED_CHARACTER_IDS.has(templateId);
}

export function canAttemptRecruit(enemy: Character): boolean {
  return enemy.alive && (enemy.stats.hp / enemy.stats.maxHp) < 0.5;
}

export function recruitChance(enemy: Character, isNamed: boolean): number {
  const hpRatio = enemy.stats.hp / enemy.stats.maxHp;
  const base = Math.floor((1 - 2 * hpRatio) * 100);
  return isNamed ? Math.floor(base / 2) : base;
}

export function attemptRecruit(chance: number): boolean {
  return Math.random() * 100 < chance;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: all RecruitSystem tests PASS. All other tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/battle/RecruitSystem.ts workspace-pixel-squad/tests/unit/RecruitSystem.test.ts
git commit -m "feat(pixel-squad): add RecruitSystem with recruit chance and named character detection"
```

---

### Task 4: Modify BattleScene for variable party layout (1–5)

**Files:**
- Modify: `workspace-pixel-squad/src/scenes/BattleScene.ts`

Note: BattleScene is a Phaser scene — no unit tests. Verify visually by running `npm run dev`.

- [ ] **Step 1: Update the `renderParty` method to support 4–5 chars in two columns**

In `workspace-pixel-squad/src/scenes/BattleScene.ts`, replace the existing `renderParty` method:

```typescript
private renderParty(party: Character[], x: number, isPlayer: boolean) {
  const topY = 40, bottomY = 470;
  const n = Math.max(1, party.length);
  const useTwoCol = n >= 4;
  const colOffset = 26; // left col at x-26, right col at x+26

  party.forEach((char, i) => {
    let cx: number;
    let cy: number;

    if (useTwoCol) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const rows = Math.ceil(n / 2);
      cy = topY + ((bottomY - topY) * (row + 0.5)) / rows;
      cx = x + (col === 0 ? -colOffset : colOffset);
    } else {
      cy = topY + ((bottomY - topY) * (i + 0.5)) / n;
      cx = x;
    }

    const color = isPlayer ? 0x3b82f6 : 0xef4444;
    const body = this.add.rectangle(cx, cy, 44, 56, color).setAlpha(0.9);
    const hpBarBg = this.add.rectangle(cx, cy + 34, 60, 6, 0x374151);
    const hpBar = this.add.rectangle(cx - 30, cy + 34, 60, 6, 0x22c55e).setOrigin(0, 0.5);
    const nameText = this.add.text(cx, cy - 36, char.name, {
      fontSize: '10px', color: '#e5e7eb', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    const hpText = this.add.text(cx, cy - 2, `${char.stats.hp}/${char.stats.maxHp}`, {
      fontSize: '9px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5);
    const archetypeText = this.add.text(cx, cy + 16, char.archetype, {
      fontSize: '8px', color: '#6b7280', fontFamily: 'monospace',
    }).setOrigin(0.5);

    hpBar.width = char.stats.maxHp > 0 ? (char.stats.hp / char.stats.maxHp) * 60 : 0;

    this.views.set(char.id, { body, hpBarBg, hpBar, nameText, hpText, archetypeText });

    if (!char.alive) {
      body.setAlpha(0.3);
      nameText.setColor('#4b5563');
    }
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/scenes/BattleScene.ts
git commit -m "feat(pixel-squad): support variable party size 1-5 in BattleScene (two-column for 4-5)"
```

---

### Task 5: Add 勸降 action to BattleScene

**Files:**
- Modify: `workspace-pixel-squad/src/scenes/BattleScene.ts`

- [ ] **Step 1: Add recruit tracking fields and imports**

At the top of `BattleScene.ts`, add these imports:

```typescript
import { canAttemptRecruit, recruitChance, attemptRecruit, isNamedCharacter } from '../battle/RecruitSystem';
import { createCharacter } from '../battle/CharacterFactory';
import { PLAYER_TEMPLATES } from '../data/characters';
```

(Note: `createCharacter` and `PLAYER_TEMPLATES` may already be imported — if so, skip those.)

Add a private field to the `BattleScene` class (after `private stopRequested = false;`):

```typescript
private recruitedEnemy?: Character;
```

- [ ] **Step 2: Add the 勸降 button conditionally in the command action menu**

Find the `showActionMenu` method (or wherever 攻擊/技能/防禦/自動 buttons are added). After the 防禦 button and before/after the 自動 button, add:

```typescript
// 勸降 — only show when exactly 1 alive enemy remains and it's below 50% HP
const aliveEnemies = this.enemyParty.filter(e => e.alive);
const canRecruit = aliveEnemies.length === 1 && canAttemptRecruit(aliveEnemies[0]);
if (canRecruit) {
  const recruitX = /* position next to 防禦, e.g. */ -90; // adjust to fit layout
  const recruitBtn = this.add.rectangle(recruitX, 0, 64, 34, 0x7c3aed)
    .setInteractive({ useHandCursor: true });
  const recruitTxt = this.add.text(recruitX, 0, '勸降', {
    fontSize: '13px', color: '#fff', fontFamily: 'monospace',
  }).setOrigin(0.5);
  recruitBtn.on('pointerdown', () => this.attemptRecruitAction(char, aliveEnemies[0]));
  recruitBtn.on('pointerover', () => recruitBtn.setAlpha(0.8));
  recruitBtn.on('pointerout', () => recruitBtn.setAlpha(1));
  this.actionMenu.add([recruitBtn, recruitTxt]);
  this.keyboardActions.push({ label: '勸降', action: () => this.attemptRecruitAction(char, aliveEnemies[0]) });
}
```

**Note for implementer:** Find exactly where in `BattleScene` the action menu buttons are rendered (search for `攻擊` string). The variable `char` refers to the current player character taking their turn. Adjust `recruitX` coordinate to fit in the available space without overlapping existing buttons.

- [ ] **Step 3: Add attemptRecruitAction method**

Add this method to `BattleScene` (before the `executeEnemyAction` method):

```typescript
private attemptRecruitAction(attacker: Character, enemy: Character) {
  if (!this.waitingForInput) return;
  this.waitingForInput = false;
  this.actionMenu.removeAll(true);

  const isNamed = isNamedCharacter(enemy.templateId);
  const chance = recruitChance(enemy, isNamed);
  const success = attemptRecruit(chance);

  const resultMsg = success
    ? `「${enemy.name}」決定加入你的隊伍！`
    : `「${enemy.name}」拒絕了你的勸降！`;

  if (success) {
    this.recruitedEnemy = enemy;
    enemy.recruited = true;
  }

  this.showMessage(resultMsg);

  // Enemy always attacks back regardless of success
  this.time.delayedCall(600, () => {
    this.clearMessage();
    const target = this.playerParty.filter(p => p.alive)[
      Math.floor(Math.random() * this.playerParty.filter(p => p.alive).length)
    ];
    if (!target) {
      this.checkBattleEnd();
      return;
    }
    const dmg = this.calcDamageFromBattle(enemy, target);
    this.applyDamageAndAdvance(enemy, target, dmg, undefined, () => {
      if (success) {
        // End battle as victory — mark enemy as "dead" for battle end check
        enemy.alive = false;
        this.checkBattleEnd();
      } else {
        this.startNewRound();
      }
    });
  });
}
```

**Note:** `calcDamageFromBattle` is a reference to `calcDamage` from `DamageCalc`. If `calcDamage` is imported at the top of BattleScene (it is: `import { calcDamage } from '../battle/DamageCalc'`), replace `this.calcDamageFromBattle` with `calcDamage`. Also add a `startNewRound` helper or reuse `this.startCommandPhase()`.

Specifically, replace `this.calcDamageFromBattle(enemy, target)` with `calcDamage(enemy, target)`.

Replace `this.startNewRound()` with `this.startCommandPhase()` (or the correct method name for restarting the command phase for the next round).

- [ ] **Step 4: Pass recruitedEnemy through to ResultScene in checkBattleEnd**

In `checkBattleEnd`, when sending to ResultScene, include `recruitedEnemy`:

```typescript
this.scene.start('ResultScene', {
  victory,
  playerParty: this.playerParty,
  stageIndex: this.stageIndex,
  expGained,
  expPool: this.expPool,
  recruitedEnemy: this.recruitedEnemy,
});
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add workspace-pixel-squad/src/scenes/BattleScene.ts
git commit -m "feat(pixel-squad): add 勸降 recruit action to BattleScene with probability system"
```

---

### Task 6: Update ResultScene to show recruited member

**Files:**
- Modify: `workspace-pixel-squad/src/scenes/ResultScene.ts`

- [ ] **Step 1: Add recruited member display in ResultScene**

In `workspace-pixel-squad/src/scenes/ResultScene.ts`, in the `create` method, after victory EXP display and before the party list, add:

```typescript
if (data.recruitedEnemy) {
  this.add.text(W / 2, 338, `新成員：${data.recruitedEnemy.name} 加入了！`, {
    fontSize: '15px', color: '#a78bfa', fontFamily: 'monospace',
  }).setOrigin(0.5);
}
```

Adjust the `y` offset for the party list that follows so it doesn't overlap this new line (shift it down by ~28px when `recruitedEnemy` is present, or simply move the existing party list `y` start down unconditionally).

- [ ] **Step 2: Verify TypeScript compiles and all tests pass**

```bash
cd workspace-pixel-squad && npx tsc --noEmit && npm run test:unit
```

Expected: no errors, all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/scenes/ResultScene.ts
git commit -m "feat(pixel-squad): show recruited member name in ResultScene"
```

---

## Summary

After all tasks:
- `CharacterTemplate` has `unlockMethod` + `unlockStageId`; `Character` has `recruited?`; `ResultSceneData` has `recruitedEnemy?`
- `characters.ts` has all 12 character templates with growth rates and unlock info
- `RecruitSystem.ts` provides `canAttemptRecruit`, `recruitChance`, `attemptRecruit`, `isNamedCharacter`
- `BattleScene` supports 1–5 party members (two-column layout at 4–5), and has a 勸降 action button
- `ResultScene` shows recruited member message
- Unit tests: `RecruitSystem.test.ts` (10 tests), `CharacterData.test.ts` (5 tests)

**Note:** The actual `GameState.pool` update when a recruit or stage unlock occurs is wired up in Plan `2026-06-24-pixel-squad-base-scene.md`, once `gameState` flows through BattleScene.

**Next plan to implement:** `2026-06-24-pixel-squad-base-scene.md`
