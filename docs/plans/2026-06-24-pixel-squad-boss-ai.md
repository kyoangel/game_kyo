# Pixel Squad — Boss AI Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add phase-based boss AI to BattleScene — bosses change behavior as HP drops, with per-boss configs for all 5 chapter bosses.

**Architecture:** `BossAI.ts` contains pure functions (`getBossPhase`, `executeBossAction`) plus types (`BossPhase`, `BossConfig`, `BossAction`). `bossConfigs.ts` contains the 5 boss configs. `BattleScene` detects boss enemies, uses `BossAI` for their turns, triggers phase transition banners on HP threshold crossings, and handles `double_attack` / `ignoreDefense` BossActions.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest (node environment)

**Prerequisite:** All previous Phase 2 plans complete. BattleScene should already have the variable party layout from Plan `2026-06-24-pixel-squad-character-pool.md`.

---

## File Map

| File | Action |
|------|--------|
| `workspace-pixel-squad/src/battle/BossAI.ts` | CREATE — BossPhase, BossConfig, BossAction, getBossPhase, executeBossAction |
| `workspace-pixel-squad/src/data/bossConfigs.ts` | CREATE — 5 boss configs keyed by templateId |
| `workspace-pixel-squad/src/scenes/BattleScene.ts` | MODIFY — integrate BossAI, phase transition banner, double attack |
| `workspace-pixel-squad/tests/unit/BossAI.test.ts` | CREATE — unit tests for pure BossAI functions |

---

### Task 1: Create BossAI.ts with unit tests

**Files:**
- Create: `workspace-pixel-squad/src/battle/BossAI.ts`
- Create: `workspace-pixel-squad/tests/unit/BossAI.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `workspace-pixel-squad/tests/unit/BossAI.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getBossPhase, executeBossAction } from '../../src/battle/BossAI';
import type { BossConfig, BossAction } from '../../src/battle/BossAI';
import type { Character } from '../../src/types';

function makeChar(id: string, hp: number, maxHp: number, isPlayer: boolean): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp, maxHp, atk: 20, def: 10, spd: 10 },
    skills: [], statPoints: 0, archetype: '坦克', alive: true, defending: false,
  };
}

const testConfig: BossConfig = {
  templateId: 'vega',
  phases: [
    { hpThreshold: 1.0, aiType: 'normal' },
    { hpThreshold: 0.5, aiType: 'aggressive' },
    { hpThreshold: 0.2, aiType: 'berserk', message: '最後衝刺！' },
  ],
};

describe('getBossPhase', () => {
  it('returns first phase at full HP (hpRatio = 1.0)', () => {
    const phase = getBossPhase(testConfig, 1.0);
    expect(phase.aiType).toBe('normal');
  });

  it('returns aggressive phase at exactly 50% HP', () => {
    const phase = getBossPhase(testConfig, 0.5);
    expect(phase.aiType).toBe('aggressive');
  });

  it('returns berserk phase below 20% HP', () => {
    const phase = getBossPhase(testConfig, 0.15);
    expect(phase.aiType).toBe('berserk');
  });

  it('returns berserk at exactly 20% HP', () => {
    const phase = getBossPhase(testConfig, 0.2);
    expect(phase.aiType).toBe('berserk');
  });

  it('returns last phase as fallback when none match (hpRatio 0)', () => {
    const phase = getBossPhase(testConfig, 0);
    expect(phase.aiType).toBe('berserk');
  });
});

describe('executeBossAction', () => {
  const boss = makeChar('boss', 100, 200, false);
  const players = [
    makeChar('p1', 80, 100, true),
    makeChar('p2', 30, 100, true),
  ];

  it('normal: returns attack action', () => {
    const phase = { hpThreshold: 1.0, aiType: 'normal' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.type).toBe('attack');
    expect(action.target).toBeTruthy();
  });

  it('aggressive: targets the lowest HP player', () => {
    const phase = { hpThreshold: 0.5, aiType: 'aggressive' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.type).toBe('attack');
    expect(action.target?.id).toBe('p2'); // p2 has lower HP (30 vs 80)
  });

  it('defensive: returns defend ~50% of the time', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3); // < 0.5 → defend
    const phase = { hpThreshold: 0.6, aiType: 'defensive' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.type).toBe('defend');
    vi.restoreAllMocks();
  });

  it('defensive: attacks the other 50%', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.7); // >= 0.5 → attack
    const phase = { hpThreshold: 0.6, aiType: 'defensive' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.type).toBe('attack');
    vi.restoreAllMocks();
  });

  it('berserk: returns attack with ignoreDefense = true', () => {
    const phase = { hpThreshold: 0.2, aiType: 'berserk' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.type).toBe('attack');
    expect(action.ignoreDefense).toBe(true);
  });

  it('desperation: returns double_attack', () => {
    const phase = { hpThreshold: 0.3, aiType: 'desperation' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.type).toBe('double_attack');
    expect(action.target).toBeTruthy();
  });

  it('returns attack targeting a random alive player when all alive', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // picks first alive player
    const phase = { hpThreshold: 1.0, aiType: 'normal' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.target).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('skips dead players for target selection', () => {
    const deadPlayers = [
      { ...makeChar('p1', 0, 100, true), alive: false },
      makeChar('p2', 30, 100, true),
    ];
    const phase = { hpThreshold: 1.0, aiType: 'normal' as const };
    const action: BossAction = executeBossAction(boss, deadPlayers, phase);
    expect(action.target?.id).toBe('p2');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: FAIL — `Cannot find module '../../src/battle/BossAI'`

- [ ] **Step 3: Create BossAI.ts**

Create `workspace-pixel-squad/src/battle/BossAI.ts`:

```typescript
import type { Character } from '../types';

export type BossAIType = 'normal' | 'aggressive' | 'defensive' | 'berserk' | 'desperation';

export interface BossPhase {
  hpThreshold: number;
  aiType: BossAIType;
  message?: string;
}

export interface BossConfig {
  templateId: string;
  phases: BossPhase[];  // sorted descending by hpThreshold; first matching wins
}

export interface BossAction {
  type: 'attack' | 'defend' | 'double_attack';
  target?: Character;
  ignoreDefense?: boolean;
}

export function getBossPhase(config: BossConfig, hpRatio: number): BossPhase {
  for (const phase of config.phases) {
    if (hpRatio <= phase.hpThreshold) return phase;
  }
  return config.phases[config.phases.length - 1];
}

function randomAlivePlayer(players: Character[]): Character | undefined {
  const alive = players.filter(p => p.alive && p.isPlayer);
  if (alive.length === 0) return undefined;
  return alive[Math.floor(Math.random() * alive.length)];
}

function lowestHpPlayer(players: Character[]): Character | undefined {
  const alive = players.filter(p => p.alive && p.isPlayer);
  if (alive.length === 0) return undefined;
  return alive.reduce((low, c) => (c.stats.hp < low.stats.hp ? c : low));
}

export function executeBossAction(
  _boss: Character,
  playerParty: Character[],
  phase: BossPhase,
): BossAction {
  switch (phase.aiType) {
    case 'normal':
      return { type: 'attack', target: randomAlivePlayer(playerParty) };
    case 'aggressive':
      return { type: 'attack', target: lowestHpPlayer(playerParty) };
    case 'defensive':
      return Math.random() < 0.5
        ? { type: 'defend' }
        : { type: 'attack', target: randomAlivePlayer(playerParty) };
    case 'berserk':
      return { type: 'attack', target: randomAlivePlayer(playerParty), ignoreDefense: true };
    case 'desperation':
      return { type: 'double_attack', target: randomAlivePlayer(playerParty) };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: all BossAI tests PASS. All other tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/battle/BossAI.ts workspace-pixel-squad/tests/unit/BossAI.test.ts
git commit -m "feat(pixel-squad): add BossAI framework with getBossPhase and executeBossAction"
```

---

### Task 2: Create bossConfigs.ts

**Files:**
- Create: `workspace-pixel-squad/src/data/bossConfigs.ts`

- [ ] **Step 1: Create bossConfigs.ts**

Create `workspace-pixel-squad/src/data/bossConfigs.ts`:

```typescript
import type { BossConfig } from '../battle/BossAI';

export const BOSS_CONFIGS: Record<string, BossConfig> = {
  vega: {
    templateId: 'vega',
    phases: [
      { hpThreshold: 1.0, aiType: 'normal' },
      { hpThreshold: 0.5, aiType: 'aggressive', message: '「你逼我的！」' },
      { hpThreshold: 0.2, aiType: 'berserk',    message: '「我不會倒下的！」' },
    ],
  },
  crow: {
    templateId: 'crow',
    phases: [
      { hpThreshold: 1.0, aiType: 'normal' },
      { hpThreshold: 0.6, aiType: 'defensive',  message: '「有趣，讓我認真一點。」' },
      { hpThreshold: 0.3, aiType: 'aggressive', message: '「夠了，遊戲結束。」' },
    ],
  },
  zora: {
    templateId: 'zora',
    phases: [
      { hpThreshold: 1.0, aiType: 'defensive' },
      { hpThreshold: 0.5, aiType: 'normal',     message: '「你比我想的更頑強。」' },
      { hpThreshold: 0.25, aiType: 'aggressive', message: '「神明保佑我！」' },
    ],
  },
  dex: {
    templateId: 'dex',
    phases: [
      { hpThreshold: 1.0,  aiType: 'defensive' },
      { hpThreshold: 0.7,  aiType: 'normal',      message: '「不錯，繼續。」' },
      { hpThreshold: 0.4,  aiType: 'aggressive',  message: '「鎧甲脫了，真的開始了。」' },
      { hpThreshold: 0.15, aiType: 'berserk',     message: '「這就是最強的我！」' },
    ],
  },
  aaaa: {
    templateId: 'aaaa',
    phases: [
      { hpThreshold: 1.0, aiType: 'aggressive' },
      { hpThreshold: 0.6, aiType: 'berserk',      message: '「...」' },
      { hpThreshold: 0.3, aiType: 'desperation',  message: '「...不可能...」' },
      { hpThreshold: 0.1, aiType: 'desperation',  message: '「我不會輸的...！」' },
    ],
  },
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/data/bossConfigs.ts
git commit -m "feat(pixel-squad): add boss configs for all 5 chapter bosses"
```

---

### Task 3: Integrate BossAI into BattleScene

**Files:**
- Modify: `workspace-pixel-squad/src/scenes/BattleScene.ts`

This task modifies BattleScene enemy turn logic and adds phase transition banner support.

- [ ] **Step 1: Add BossAI imports and boss tracking fields**

At the top of `workspace-pixel-squad/src/scenes/BattleScene.ts`, add:

```typescript
import { getBossPhase, executeBossAction, type BossConfig, type BossPhase } from '../battle/BossAI';
import { BOSS_CONFIGS } from '../data/bossConfigs';
```

Add private fields to the `BattleScene` class (after `private recruitedEnemy?: Character;`):

```typescript
private bossConfig?: BossConfig;
private triggeredPhaseThresholds = new Set<number>();
```

- [ ] **Step 2: Load boss config in init**

In `BattleScene.init`, after `this.enemyParty = stage.enemies.map(e => createEnemy(e));`, add:

```typescript
this.bossConfig = undefined;
this.triggeredPhaseThresholds = new Set<number>();
// Load boss config if the stage has a single boss enemy
if (stage.isBoss && this.enemyParty.length === 1) {
  const bossTemplateId = this.enemyParty[0].templateId;
  this.bossConfig = BOSS_CONFIGS[bossTemplateId];
}
```

Note: `stage` is `STAGES[this.stageIndex]`. You need to cast STAGES from the new Stage shape:

```typescript
const stage = STAGES[this.stageIndex] as import('../types').Stage;
```

If `STAGES` is already typed as `Stage[]` (from the extended types), no cast is needed.

- [ ] **Step 3: Replace executeEnemyAction with boss-aware version**

Replace the existing `executeEnemyAction` method:

```typescript
private executeEnemyAction(enemy: Character, next: () => void) {
  // Use boss AI if this enemy has a config
  if (this.bossConfig && enemy.templateId === this.bossConfig.templateId) {
    const hpRatio = enemy.stats.hp / enemy.stats.maxHp;
    const phase = getBossPhase(this.bossConfig, hpRatio);

    // Check for phase transition (first time crossing a threshold)
    if (phase.message && !this.triggeredPhaseThresholds.has(phase.hpThreshold)) {
      this.triggeredPhaseThresholds.add(phase.hpThreshold);
      this.showPhaseBanner(phase);
      this.time.delayedCall(2000, () => this.executeBossPhaseAction(enemy, phase, next));
      return;
    }

    this.executeBossPhaseAction(enemy, phase, next);
    return;
  }

  // Non-boss: existing random AI
  const target = chooseTarget(this.playerParty);
  if (!target) { next(); return; }
  const dmg = calcDamage(enemy, target);
  this.applyDamageAndAdvance(enemy, target, dmg, undefined, next);
}

private executeBossPhaseAction(enemy: Character, phase: BossPhase, next: () => void) {
  const action = executeBossAction(enemy, this.playerParty, phase);

  if (action.type === 'defend') {
    enemy.defending = true;
    this.showMessage(`${enemy.name} 進入防禦姿態！`);
    this.time.delayedCall(900, () => { this.clearMessage(); next(); });
    return;
  }

  if (!action.target) { next(); return; }

  if (action.type === 'double_attack') {
    const target = action.target;
    const dmg1 = action.ignoreDefense
      ? Math.max(1, enemy.stats.atk)
      : calcDamage(enemy, target);
    this.applyDamageAndAdvance(enemy, target, dmg1, '連擊①', () => {
      if (!target.alive) { next(); return; }
      const dmg2 = action.ignoreDefense
        ? Math.max(1, enemy.stats.atk)
        : calcDamage(enemy, target);
      this.applyDamageAndAdvance(enemy, target, dmg2, '連擊②', next);
    });
    return;
  }

  // Single attack (normal / aggressive / berserk)
  const dmg = action.ignoreDefense
    ? Math.max(1, enemy.stats.atk)
    : calcDamage(enemy, action.target);
  this.applyDamageAndAdvance(enemy, action.target, dmg, undefined, next);
}

private showPhaseBanner(phase: BossPhase) {
  const W = 360;
  const banner = this.add.text(W / 2, 100, phase.message!, {
    fontSize: '14px', color: '#f59e0b', fontFamily: 'monospace',
    backgroundColor: '#111827',
    padding: { x: 12, y: 8 },
  }).setOrigin(0.5).setDepth(20);
  this.time.delayedCall(1800, () => {
    if (banner.active) banner.destroy();
  });
}
```

- [ ] **Step 4: Import Stage type for isBoss check (if needed)**

If `STAGES[this.stageIndex]` doesn't have `.isBoss` (old Stage type), ensure `Stage` is imported from types and used correctly. The new `Stage` type has `isBoss: boolean`, so `STAGES[this.stageIndex].isBoss` should work after Plan 2 is done.

If there's a type error on `.isBoss`, add a type assertion:
```typescript
const stage = STAGES[this.stageIndex] as import('../types').Stage & { isBoss?: boolean };
const isBoss = 'isBoss' in stage ? stage.isBoss : false;
```

- [ ] **Step 5: Verify TypeScript compiles and tests pass**

```bash
cd workspace-pixel-squad && npx tsc --noEmit && npm run test:unit
```

Expected: no TypeScript errors, all unit tests PASS.

- [ ] **Step 6: Commit**

```bash
git add workspace-pixel-squad/src/scenes/BattleScene.ts
git commit -m "feat(pixel-squad): integrate BossAI phase system into BattleScene enemy turns"
```

---

## Summary

After all tasks:
- `BossAI.ts` provides `getBossPhase`, `executeBossAction`, `BossAction` with 5 AI types
- `bossConfigs.ts` has configs for Vega, Crow, Zora, Dex, AAAA with phase thresholds and messages
- `BattleScene` loads boss config on init, uses phase-based AI for boss turns, shows phase transition banners, handles double attack and ignore-defense
- Unit tests: `BossAI.test.ts` covers all 5 AI types and phase selection (9 tests)

**All 5 Phase 2 plans are now complete. Implementation can begin with subagent-driven-development, starting from Plan 1 (save system) through Plan 5 (boss AI) in order.**
