# Pixel Squad — Boss AI Framework Design

> **Status:** Approved for implementation.

---

## Overview

Boss enemies have phase-based AI that changes behavior as their HP drops. This spec defines the framework (`BossPhase`, `BossConfig`, `getBossPhase`, `executeBossAction`) and placeholder configs for all 5 chapter bosses. Per-boss special actions and dialogue are designed in this spec; future sessions may deepen them.

---

## Data Structures

```typescript
// src/battle/BossAI.ts

export type BossAIType = 'normal' | 'aggressive' | 'defensive' | 'berserk' | 'desperation';

export interface BossPhase {
  hpThreshold: number;    // phase active when hpRatio <= this value (1.0 = 100%)
  aiType: BossAIType;
  specialAction?: string; // key for executeBossAction to dispatch
  message?: string;       // displayed when this phase triggers
}

export interface BossConfig {
  templateId: string;
  phases: BossPhase[];    // sorted descending by hpThreshold; first matching phase wins
}
```

### AI Type Behavior

| aiType | Description |
|--------|-------------|
| `normal` | Standard attack/skill selection — same as current AI |
| `aggressive` | Prefers high-damage skills; targets lowest-HP player |
| `defensive` | 50% chance to defend on turn, attacks otherwise |
| `berserk` | Always attacks; ignores DEF modifiers in damage calc (raw ATK vs player HP) |
| `desperation` | Attacks twice per turn (two separate damage rolls); triggers only below 20% HP |

---

## Core Functions

```typescript
// src/battle/BossAI.ts

export function getBossPhase(config: BossConfig, hpRatio: number): BossPhase {
  // Return first phase where hpRatio <= hpThreshold
  // Phases must be ordered highest hpThreshold first
  for (const phase of config.phases) {
    if (hpRatio <= phase.hpThreshold) return phase;
  }
  return config.phases[config.phases.length - 1]; // fallback: last phase
}

export function executeBossAction(
  boss: Character,
  playerParty: Character[],
  phase: BossPhase,
): BossAction {
  // Returns a BossAction that BattleScene executes
  // BossAction: { type: 'attack' | 'defend' | 'double_attack', target?: Character }
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

export interface BossAction {
  type: 'attack' | 'defend' | 'double_attack';
  target?: Character;
  ignoreDefense?: boolean;
}
```

---

## Phase Transition Display

When a phase transition occurs (boss crosses a HP threshold for the first time in the battle):
- Show a banner message at the top of BattleScene: `[boss.name]: [phase.message]`
- Banner auto-dismisses after 2 seconds
- Track triggered phases to avoid re-triggering (store `triggeredPhaseThresholds: Set<number>` in BattleScene)

---

## Boss Configs

All 5 chapter boss configs. Stored in `src/data/bossConfigs.ts`.

### Vega (1-5) — 鐵拳

```typescript
{ templateId: 'vega', phases: [
  { hpThreshold: 1.0,  aiType: 'normal',      message: undefined },
  { hpThreshold: 0.5,  aiType: 'aggressive',  message: '「你逼我的！」' },
  { hpThreshold: 0.2,  aiType: 'berserk',     message: '「我不會倒下的！」' },
]}
```

### Crow (2-5) — 影鴉

```typescript
{ templateId: 'crow', phases: [
  { hpThreshold: 1.0,  aiType: 'normal',      message: undefined },
  { hpThreshold: 0.6,  aiType: 'defensive',   message: '「有趣，讓我認真一點。」' },
  { hpThreshold: 0.3,  aiType: 'aggressive',  message: '「夠了，遊戲結束。」' },
]}
```

### Zora (3-5) — 廢土聖女

```typescript
{ templateId: 'zora', phases: [
  { hpThreshold: 1.0,  aiType: 'defensive',   message: undefined },
  { hpThreshold: 0.5,  aiType: 'normal',      message: '「你比我想的更頑強。」' },
  { hpThreshold: 0.25, aiType: 'aggressive',  message: '「神明保佑我！」' },
]}
```

### Dex (4-5) — 鐵壁

```typescript
{ templateId: 'dex', phases: [
  { hpThreshold: 1.0,  aiType: 'defensive',   message: undefined },
  { hpThreshold: 0.7,  aiType: 'normal',      message: '「不錯，繼續。」' },
  { hpThreshold: 0.4,  aiType: 'aggressive',  message: '「鎧甲脫了，真的開始了。」' },
  { hpThreshold: 0.15, aiType: 'berserk',     message: '「這就是最強的我！」' },
]}
```

### AAAA (5-5) — 終極boss

```typescript
{ templateId: 'aaaa', phases: [
  { hpThreshold: 1.0,  aiType: 'aggressive',  message: undefined },
  { hpThreshold: 0.6,  aiType: 'berserk',     message: '「...」' },
  { hpThreshold: 0.3,  aiType: 'desperation', message: '「...不可能...」' },
  { hpThreshold: 0.1,  aiType: 'desperation', message: '「我不會輸的...！」' },
]}
```

---

## BattleScene Integration

`BattleScene` already handles enemy turns. Integration points:

1. On init, check if current stage's enemy includes a boss templateId → load `BossConfig` from `bossConfigs.ts`
2. On enemy turn: if enemy is a boss, call `getBossPhase(config, hpRatio)` → check for phase transition → call `executeBossAction` to get `BossAction`
3. Execute `BossAction`:
   - `attack`: existing single attack logic
   - `defend`: sets `boss.defending = true` for this round (existing defend logic)
   - `double_attack`: execute attack logic twice (two separate damage rolls, two separate log lines)
   - `ignoreDefense: true`: skip target's DEF in damage formula (`damage = boss.stats.atk - 0` instead of `boss.stats.atk - target.stats.def`)
4. Non-boss enemies continue using current random AI (untouched)

---

## File Map

| File | Action |
|------|--------|
| `src/battle/BossAI.ts` | CREATE — `BossPhase`, `BossConfig`, `BossAction`, `getBossPhase`, `executeBossAction` |
| `src/data/bossConfigs.ts` | CREATE — 5 boss configs as a `Record<string, BossConfig>` |
| `src/scenes/BattleScene.ts` | MODIFY — integrate boss AI on enemy turns, phase transition banner |

---

## Out of Scope

- Per-boss unique special abilities beyond the 5 aiTypes (future deepening)
- Boss dialogue cutscenes before/after battle
- Multi-boss battles
- Boss HP bars with phase markers (visual enhancement, future)
