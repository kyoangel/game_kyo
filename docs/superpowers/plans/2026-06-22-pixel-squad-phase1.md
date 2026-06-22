# Pixel Squad Phase 1 — Battle Engine MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable 1-5v1-5 turn-based battle game in the browser — player squad fights 3 fixed stages, characters earn EXP and level up, protagonist allocates stat points.

**Architecture:** Standalone Vite + Phaser 3 + TypeScript workspace (`workspace-pixel-squad/`). Pure battle logic lives in framework-agnostic modules (`src/battle/`) that are unit-tested with vitest. Phaser scenes handle display and input. Three scenes: `BattleScene` → `ResultScene` → `AllocateScene` → back to `BattleScene`.

**Tech Stack:** Phaser 3.x, TypeScript 5, Vite 6, vitest 3 (unit), Playwright (E2E), deployed to `/game_kyo/pixel-squad/` via GitHub Pages.

---

## File Structure

```
workspace-pixel-squad/
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── index.html
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon.svg
│       └── apple-touch-icon.png
└── src/
    ├── main.ts                   # Phaser.Game init
    ├── types.ts                  # All shared TS interfaces
    ├── data/
    │   ├── characters.ts         # 3 player CharacterTemplates
    │   ├── skills.ts             # Skill definitions map
    │   └── stages.ts             # 3 hardcoded Stage definitions
    ├── battle/
    │   ├── CharacterFactory.ts   # Template → Character instance
    │   ├── Archetype.ts          # Derive archetype label from stats
    │   ├── TurnEngine.ts         # Sort living chars by SPD
    │   ├── DamageCalc.ts         # ATK − DEF×0.5, min 1
    │   ├── AI.ts                 # Target lowest-HP player char
    │   └── ExpSystem.ts          # EXP gain, level up, stat points
    └── scenes/
        ├── BattleScene.ts        # Main battle loop scene
        ├── ResultScene.ts        # Victory/defeat + EXP screen
        └── AllocateScene.ts      # Protagonist stat point UI

tests/
├── unit/
│   ├── TurnEngine.test.ts
│   ├── DamageCalc.test.ts
│   ├── AI.test.ts
│   └── ExpSystem.test.ts
└── e2e/
    └── pixel-squad.spec.ts
```

---

## Task 1: Project Scaffold

> TDD exception: configuration-only task, no logic to test.

**Files:**
- Create: `workspace-pixel-squad/package.json`
- Create: `workspace-pixel-squad/vite.config.ts`
- Create: `workspace-pixel-squad/vitest.config.ts`
- Create: `workspace-pixel-squad/playwright.config.ts`
- Create: `workspace-pixel-squad/tsconfig.json`
- Create: `workspace-pixel-squad/index.html`
- Create: `workspace-pixel-squad/src/main.ts`

- [ ] **Step 1: Create the workspace directory**

```bash
mkdir -p workspace-pixel-squad/src workspace-pixel-squad/public/icons workspace-pixel-squad/tests/unit workspace-pixel-squad/tests/e2e
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "pixel-squad",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test:unit": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "phaser": "^3.88.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Write vite.config.ts**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/game_kyo/pixel-squad/',
});
```

- [ ] **Step 4: Write vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Write playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 15000,
  webServer: {
    command: 'npm run dev',
    port: 5174,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:5174',
  },
});
```

Note: port 5174 avoids conflict with merge10 (5173).

- [ ] **Step 6: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 7: Write index.html**

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <title>Pixel Squad</title>
  <link rel="manifest" href="%BASE_URL%manifest.json" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Pixel Squad" />
  <link rel="apple-touch-icon" href="%BASE_URL%icons/apple-touch-icon.png" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #111;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100dvh;
      overflow: hidden;
    }
    #game canvas { display: block; }
  </style>
</head>
<body>
  <div id="game"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 8: Write src/main.ts (placeholder — real scenes added in Task 7)**

```typescript
import Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }
  create() {
    this.add.text(180, 320, 'Pixel Squad', {
      fontSize: '24px', color: '#e5e7eb',
    }).setOrigin(0.5);
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  backgroundColor: '#111827',
  parent: 'game',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  scene: [BootScene],
};

new Phaser.Game(config);
```

- [ ] **Step 9: Install dependencies and verify dev server starts**

```bash
cd workspace-pixel-squad && npm install
npm run dev
```

Expected: terminal shows `Local: http://localhost:5174/game_kyo/pixel-squad/`, browser shows "Pixel Squad" text on dark background.

- [ ] **Step 10: Commit**

```bash
git add workspace-pixel-squad/
git commit -m "feat(pixel-squad): scaffold Vite + Phaser 3 + TypeScript workspace"
```

---

## Task 2: Shared Types and Game Data

> TDD exception: pure data definitions, no logic to test.

**Files:**
- Create: `workspace-pixel-squad/src/types.ts`
- Create: `workspace-pixel-squad/src/data/skills.ts`
- Create: `workspace-pixel-squad/src/data/characters.ts`
- Create: `workspace-pixel-squad/src/data/stages.ts`

- [ ] **Step 1: Write src/types.ts**

```typescript
export type ArchetypeLabel = '坦克' | '輸出' | '狙擊' | '輔助' | '全能';
export type SkillType = 'attack' | 'heal' | 'buff';

export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  /** For attack skills: damage multiplier applied to ATK */
  multiplier: number;
  description: string;
}

export interface StatBlock {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

/** Static definition — used to instantiate Character */
export interface CharacterTemplate {
  id: string;
  name: string;
  isProtagonist: boolean;
  baseStats: StatBlock;
  skillIds: string[];
  /** Auto stat growth per level (non-protagonist only) */
  statGrowth: StatBlock;
}

/** Live combat instance */
export interface Character {
  id: string;         // unique per-battle instance
  templateId: string;
  name: string;
  isProtagonist: boolean;
  isPlayer: boolean;
  level: number;
  exp: number;
  expToNext: number;
  stats: {
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    spd: number;
  };
  skills: Skill[];
  statPoints: number;   // unspent points (protagonist only)
  archetype: ArchetypeLabel;
  alive: boolean;
  defending: boolean;   // true = -50% damage this round
}

export interface EnemyTemplate {
  id: string;
  name: string;
  baseStats: StatBlock;
  skillIds: string[];
}

export interface Stage {
  id: string;
  name: string;
  enemies: EnemyTemplate[];
  expReward: number;   // total EXP split among surviving player chars
}

export interface BattleSceneData {
  playerParty: Character[];
  stageIndex: number;
}

export interface ResultSceneData {
  victory: boolean;
  playerParty: Character[];
  stageIndex: number;
  expGained: number;
}

export interface AllocateSceneData {
  playerParty: Character[];
  stageIndex: number;
}
```

- [ ] **Step 2: Write src/data/skills.ts**

```typescript
import type { Skill } from '../types';

export const SKILLS: Record<string, Skill> = {
  burst_shot: {
    id: 'burst_shot',
    name: '爆發射擊',
    type: 'attack',
    multiplier: 1.5,
    description: 'ATK × 1.5 的傷害',
  },
  shield_bash: {
    id: 'shield_bash',
    name: '盾擊',
    type: 'attack',
    multiplier: 1.2,
    description: 'ATK × 1.2 的傷害',
  },
  swift_strike: {
    id: 'swift_strike',
    name: '迅捷突刺',
    type: 'attack',
    multiplier: 1.3,
    description: 'ATK × 1.3 的傷害',
  },
};
```

- [ ] **Step 3: Write src/data/characters.ts**

```typescript
import type { CharacterTemplate } from '../types';

export const PLAYER_TEMPLATES: CharacterTemplate[] = [
  {
    id: 'protagonist',
    name: '倖存者',
    isProtagonist: true,
    baseStats: { hp: 100, atk: 25, def: 10, spd: 15 },
    skillIds: ['burst_shot'],
    statGrowth: { hp: 0, atk: 0, def: 0, spd: 0 }, // protagonist uses manual allocation
  },
  {
    id: 'rex',
    name: 'Rex',
    isProtagonist: false,
    baseStats: { hp: 150, atk: 15, def: 25, spd: 8 },
    skillIds: ['shield_bash'],
    statGrowth: { hp: 12, atk: 2, def: 4, spd: 1 },
  },
  {
    id: 'nyx',
    name: 'Nyx',
    isProtagonist: false,
    baseStats: { hp: 70, atk: 30, def: 8, spd: 22 },
    skillIds: ['swift_strike'],
    statGrowth: { hp: 5, atk: 5, def: 1, spd: 3 },
  },
];
```

- [ ] **Step 4: Write src/data/stages.ts**

```typescript
import type { Stage } from '../types';

export const STAGES: Stage[] = [
  {
    id: 'stage_1',
    name: '廢城入口',
    enemies: [
      {
        id: 'mutant',
        name: '變種人',
        baseStats: { hp: 60, atk: 15, def: 5, spd: 8 },
        skillIds: [],
      },
    ],
    expReward: 40,
  },
  {
    id: 'stage_2',
    name: '破敗工廠',
    enemies: [
      {
        id: 'raider',
        name: '掠奪者',
        baseStats: { hp: 80, atk: 20, def: 8, spd: 12 },
        skillIds: [],
      },
      {
        id: 'raider_captain',
        name: '掠奪者隊長',
        baseStats: { hp: 110, atk: 26, def: 14, spd: 10 },
        skillIds: [],
      },
    ],
    expReward: 80,
  },
  {
    id: 'stage_3',
    name: '廢土指揮所',
    enemies: [
      {
        id: 'soldier_a',
        name: '廢土兵',
        baseStats: { hp: 90, atk: 22, def: 15, spd: 10 },
        skillIds: [],
      },
      {
        id: 'soldier_b',
        name: '廢土兵',
        baseStats: { hp: 90, atk: 22, def: 15, spd: 10 },
        skillIds: [],
      },
      {
        id: 'commander',
        name: '廢土指揮官',
        baseStats: { hp: 180, atk: 35, def: 20, spd: 14 },
        skillIds: [],
      },
    ],
    expReward: 130,
  },
];
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add workspace-pixel-squad/src/
git commit -m "feat(pixel-squad): add shared types and hardcoded game data"
```

---

## Task 3: TurnEngine

**Files:**
- Create: `workspace-pixel-squad/src/battle/TurnEngine.ts`
- Create: `workspace-pixel-squad/tests/unit/TurnEngine.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/TurnEngine.test.ts
import { describe, it, expect } from 'vitest';
import { computeTurnOrder } from '../../src/battle/TurnEngine';
import type { Character } from '../../src/types';

function makeChar(id: string, spd: number, isPlayer: boolean, alive = true): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 10, def: 5, spd },
    skills: [], statPoints: 0, archetype: '全能', alive, defending: false,
  };
}

describe('computeTurnOrder', () => {
  it('sorts living characters by SPD descending', () => {
    const chars = [makeChar('a', 10, true), makeChar('b', 20, false), makeChar('c', 15, true)];
    const order = computeTurnOrder(chars);
    expect(order.map(c => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('excludes dead characters', () => {
    const chars = [makeChar('a', 10, true), makeChar('dead', 30, false, false)];
    const order = computeTurnOrder(chars);
    expect(order).toHaveLength(1);
    expect(order[0].id).toBe('a');
  });

  it('on SPD tie: player acts before enemy', () => {
    const chars = [makeChar('enemy', 15, false), makeChar('player', 15, true)];
    const order = computeTurnOrder(chars);
    expect(order[0].id).toBe('player');
    expect(order[1].id).toBe('enemy');
  });

  it('returns empty array when all dead', () => {
    const chars = [makeChar('a', 10, true, false)];
    expect(computeTurnOrder(chars)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd workspace-pixel-squad && npm run test:unit
```

Expected: FAIL — `Cannot find module '../../src/battle/TurnEngine'`

- [ ] **Step 3: Implement TurnEngine.ts**

```typescript
// src/battle/TurnEngine.ts
import type { Character } from '../types';

export function computeTurnOrder(characters: Character[]): Character[] {
  return [...characters]
    .filter(c => c.alive)
    .sort((a, b) => {
      if (b.stats.spd !== a.stats.spd) return b.stats.spd - a.stats.spd;
      // player-friendly tie-break: player chars act before enemies
      if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
      return 0;
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:unit 2>&1 | grep -E "PASS|FAIL|✓|✗"
```

Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/battle/TurnEngine.ts workspace-pixel-squad/tests/unit/TurnEngine.test.ts
git commit -m "feat(pixel-squad): add TurnEngine with SPD-based sort and player-first tie-break"
```

---

## Task 4: DamageCalc

**Files:**
- Create: `workspace-pixel-squad/src/battle/DamageCalc.ts`
- Create: `workspace-pixel-squad/tests/unit/DamageCalc.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/DamageCalc.test.ts
import { describe, it, expect } from 'vitest';
import { calcDamage } from '../../src/battle/DamageCalc';
import type { Character, Skill } from '../../src/types';

function makeChar(atk: number, def: number): Character {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk, def, spd: 10 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
  };
}

const attackSkill: Skill = { id: 's', name: 'S', type: 'attack', multiplier: 1.5, description: '' };

describe('calcDamage', () => {
  it('base formula: ATK − DEF×0.5, floored', () => {
    // 20 − 10×0.5 = 15
    expect(calcDamage(makeChar(20, 10), makeChar(0, 10))).toBe(15);
  });

  it('minimum damage is 1 even when DEF is very high', () => {
    expect(calcDamage(makeChar(5, 0), makeChar(0, 100))).toBe(1);
  });

  it('applies skill multiplier to ATK before subtracting DEF', () => {
    // (20×1.5) − 10×0.5 = 30 − 5 = 25
    expect(calcDamage(makeChar(20, 0), makeChar(0, 10), attackSkill)).toBe(25);
  });

  it('defending target takes half damage (rounded up)', () => {
    const defender = makeChar(0, 0);
    defender.defending = true;
    // base = 20, after defending = ceil(20/2) = 10
    expect(calcDamage(makeChar(20, 0), defender)).toBe(10);
  });

  it('minimum 1 still applies after defend halving', () => {
    const defender = makeChar(0, 100);
    defender.defending = true;
    expect(calcDamage(makeChar(5, 0), defender)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npm run test:unit 2>&1 | grep -E "PASS|FAIL|✓|✗"
```

Expected: new tests FAIL.

- [ ] **Step 3: Implement DamageCalc.ts**

```typescript
// src/battle/DamageCalc.ts
import type { Character, Skill } from '../types';

export function calcDamage(attacker: Character, defender: Character, skill?: Skill): number {
  const multiplier = skill?.type === 'attack' ? skill.multiplier : 1.0;
  const raw = attacker.stats.atk * multiplier - defender.stats.def * 0.5;
  const base = Math.max(1, Math.floor(raw));
  if (defender.defending) return Math.max(1, Math.ceil(base / 2));
  return base;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm run test:unit
```

Expected: all tests passing.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/battle/DamageCalc.ts workspace-pixel-squad/tests/unit/DamageCalc.test.ts
git commit -m "feat(pixel-squad): add DamageCalc with defend halving and skill multiplier"
```

---

## Task 5: Enemy AI

**Files:**
- Create: `workspace-pixel-squad/src/battle/AI.ts`
- Create: `workspace-pixel-squad/tests/unit/AI.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/AI.test.ts
import { describe, it, expect } from 'vitest';
import { chooseTarget } from '../../src/battle/AI';
import type { Character } from '../../src/types';

function makeChar(id: string, hp: number, alive = true): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp, maxHp: 100, atk: 10, def: 5, spd: 10 },
    skills: [], statPoints: 0, archetype: '全能', alive, defending: false,
  };
}

describe('chooseTarget', () => {
  it('targets the alive character with the lowest HP', () => {
    const chars = [makeChar('a', 80), makeChar('b', 30), makeChar('c', 50)];
    expect(chooseTarget(chars)?.id).toBe('b');
  });

  it('skips dead characters', () => {
    const chars = [makeChar('dead', 10, false), makeChar('alive', 60)];
    expect(chooseTarget(chars)?.id).toBe('alive');
  });

  it('returns null when all are dead', () => {
    const chars = [makeChar('a', 10, false)];
    expect(chooseTarget(chars)).toBeNull();
  });

  it('returns the only alive character when there is one', () => {
    expect(chooseTarget([makeChar('solo', 100)])?.id).toBe('solo');
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npm run test:unit 2>&1 | grep -E "PASS|FAIL|✓|✗"
```

Expected: new tests FAIL.

- [ ] **Step 3: Implement AI.ts**

```typescript
// src/battle/AI.ts
import type { Character } from '../types';

export function chooseTarget(characters: Character[]): Character | null {
  const alive = characters.filter(c => c.alive);
  if (alive.length === 0) return null;
  return alive.reduce((lowest, c) => (c.stats.hp < lowest.stats.hp ? c : lowest));
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm run test:unit
```

Expected: all tests passing.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/battle/AI.ts workspace-pixel-squad/tests/unit/AI.test.ts
git commit -m "feat(pixel-squad): add enemy AI — targets lowest-HP alive player character"
```

---

## Task 6: CharacterFactory, Archetype, and ExpSystem

**Files:**
- Create: `workspace-pixel-squad/src/battle/Archetype.ts`
- Create: `workspace-pixel-squad/src/battle/CharacterFactory.ts`
- Create: `workspace-pixel-squad/src/battle/ExpSystem.ts`
- Create: `workspace-pixel-squad/tests/unit/ExpSystem.test.ts`

- [ ] **Step 1: Write Archetype.ts**

```typescript
// src/battle/Archetype.ts
import type { ArchetypeLabel, StatBlock } from '../types';

export function computeArchetype(stats: StatBlock): ArchetypeLabel {
  const normHp = stats.hp / 10;
  const total = normHp + stats.atk + stats.def + stats.spd;
  if (total === 0) return '全能';
  const hp = normHp / total;
  const atk = stats.atk / total;
  const def = stats.def / total;
  const spd = stats.spd / total;
  if (hp > 0.35 && def > 0.2) return '坦克';
  if (atk > 0.4) return '輸出';
  if (spd > 0.3 && atk > 0.2) return '狙擊';
  if (def > 0.25 || hp > 0.4) return '輔助';
  return '全能';
}
```

- [ ] **Step 2: Write CharacterFactory.ts**

```typescript
// src/battle/CharacterFactory.ts
import type { Character, CharacterTemplate, EnemyTemplate } from '../types';
import { SKILLS } from '../data/skills';
import { computeArchetype } from './Archetype';

let _instanceCounter = 0;
function nextId(templateId: string): string {
  return `${templateId}_${++_instanceCounter}`;
}

export function createCharacter(template: CharacterTemplate, level: number): Character {
  const s = { ...template.baseStats };
  if (!template.isProtagonist && level > 1) {
    for (let l = 1; l < level; l++) {
      s.hp += template.statGrowth.hp;
      s.atk += template.statGrowth.atk;
      s.def += template.statGrowth.def;
      s.spd += template.statGrowth.spd;
    }
  }
  return {
    id: nextId(template.id),
    templateId: template.id,
    name: template.name,
    isProtagonist: template.isProtagonist,
    isPlayer: true,
    level,
    exp: 0,
    expToNext: expToNextLevel(level),
    stats: { hp: s.hp, maxHp: s.hp, atk: s.atk, def: s.def, spd: s.spd },
    skills: template.skillIds.map(id => SKILLS[id]).filter(Boolean),
    statPoints: 0,
    archetype: computeArchetype(s),
    alive: true,
    defending: false,
  };
}

export function createEnemy(template: EnemyTemplate): Character {
  const s = { ...template.baseStats };
  return {
    id: nextId(template.id),
    templateId: template.id,
    name: template.name,
    isProtagonist: false,
    isPlayer: false,
    level: 1,
    exp: 0,
    expToNext: expToNextLevel(1),
    stats: { hp: s.hp, maxHp: s.hp, atk: s.atk, def: s.def, spd: s.spd },
    skills: template.skillIds.map(id => SKILLS[id]).filter(Boolean),
    statPoints: 0,
    archetype: computeArchetype(s),
    alive: true,
    defending: false,
  };
}

export function expToNextLevel(level: number): number {
  return level * 50;
}
```

- [ ] **Step 3: Write failing ExpSystem tests**

```typescript
// tests/unit/ExpSystem.test.ts
import { describe, it, expect } from 'vitest';
import { applyExp, STAT_POINTS_PER_LEVEL } from '../../src/battle/ExpSystem';
import type { Character } from '../../src/types';

function makeChar(isProtagonist: boolean, level: number, exp: number): Character {
  return {
    id: 'c', templateId: 'c', name: 'c', isProtagonist, isPlayer: true,
    level, exp, expToNext: level * 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 15 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
  };
}

describe('applyExp', () => {
  it('adds exp without leveling when below threshold', () => {
    const result = applyExp(makeChar(false, 1, 0), 30);
    expect(result.exp).toBe(30);
    expect(result.level).toBe(1);
  });

  it('levels up when exp meets threshold', () => {
    const result = applyExp(makeChar(false, 1, 0), 50);
    expect(result.level).toBe(2);
    expect(result.exp).toBe(0);
  });

  it('carries over excess exp after level up', () => {
    const result = applyExp(makeChar(false, 1, 0), 70);
    expect(result.level).toBe(2);
    expect(result.exp).toBe(20);
  });

  it('non-protagonist gets auto stat boosts on level up', () => {
    const before = makeChar(false, 1, 0);
    const result = applyExp(before, 50);
    expect(result.stats.atk).toBeGreaterThan(before.stats.atk);
    expect(result.stats.hp).toBeGreaterThan(before.stats.hp);
  });

  it('protagonist gets stat points instead of auto boosts', () => {
    const before = makeChar(true, 1, 0);
    const result = applyExp(before, 50);
    expect(result.statPoints).toBe(STAT_POINTS_PER_LEVEL);
    expect(result.stats.atk).toBe(before.stats.atk); // no auto boost
  });
});
```

- [ ] **Step 4: Run to verify fail**

```bash
npm run test:unit 2>&1 | grep -E "PASS|FAIL|✓|✗"
```

Expected: new ExpSystem tests FAIL.

- [ ] **Step 5: Write ExpSystem.ts**

```typescript
// src/battle/ExpSystem.ts
import type { Character } from '../types';
import { expToNextLevel } from './CharacterFactory';

export const STAT_POINTS_PER_LEVEL = 3;

const AUTO_GROWTH = { hp: 8, maxHp: 8, atk: 3, def: 2, spd: 1 };

export function applyExp(character: Character, exp: number): Character {
  let c: Character = { ...character, stats: { ...character.stats }, exp: character.exp + exp };

  while (c.exp >= c.expToNext) {
    c.exp -= c.expToNext;
    c.level += 1;
    c.expToNext = expToNextLevel(c.level);

    if (c.isProtagonist) {
      c.statPoints += STAT_POINTS_PER_LEVEL;
    } else {
      c.stats = {
        hp: c.stats.hp + AUTO_GROWTH.hp,
        maxHp: c.stats.maxHp + AUTO_GROWTH.maxHp,
        atk: c.stats.atk + AUTO_GROWTH.atk,
        def: c.stats.def + AUTO_GROWTH.def,
        spd: c.stats.spd + AUTO_GROWTH.spd,
      };
    }
  }

  return c;
}

export function allocateStat(
  character: Character,
  stat: 'hp' | 'atk' | 'def' | 'spd',
): Character {
  if (character.statPoints <= 0) return character;
  const inc = stat === 'hp' ? 10 : 2;
  const stats = { ...character.stats, [stat]: character.stats[stat] + inc };
  if (stat === 'hp') stats.maxHp = stats.hp;
  return { ...character, stats, statPoints: character.statPoints - 1 };
}
```

- [ ] **Step 6: Run all unit tests**

```bash
npm run test:unit
```

Expected: all tests passing (TurnEngine + DamageCalc + AI + ExpSystem).

- [ ] **Step 7: Commit**

```bash
git add workspace-pixel-squad/src/battle/ workspace-pixel-squad/tests/unit/ExpSystem.test.ts
git commit -m "feat(pixel-squad): add CharacterFactory, Archetype, and ExpSystem with unit tests"
```

---

## Task 7: BattleScene — static display

> TDD exception: Phaser scene — visual rendering can't be unit-tested. E2E verifies the scene loads and characters appear.

**Files:**
- Create: `workspace-pixel-squad/src/scenes/BattleScene.ts`
- Modify: `workspace-pixel-squad/src/main.ts`
- Create: `workspace-pixel-squad/tests/e2e/pixel-squad.spec.ts` (first test)

- [ ] **Step 1: Write BattleScene.ts (full file)**

```typescript
// src/scenes/BattleScene.ts
import Phaser from 'phaser';
import type { Character, BattleSceneData } from '../types';
import { createCharacter, createEnemy } from '../battle/CharacterFactory';
import { computeTurnOrder } from '../battle/TurnEngine';
import { calcDamage } from '../battle/DamageCalc';
import { chooseTarget } from '../battle/AI';
import { STAGES } from '../data/stages';
import { PLAYER_TEMPLATES } from '../data/characters';

interface CharacterView {
  body: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  archetypeText: Phaser.GameObjects.Text;
}

export class BattleScene extends Phaser.Scene {
  private playerParty: Character[] = [];
  private enemyParty: Character[] = [];
  private turnOrder: Character[] = [];
  private turnIndex = 0;
  private stageIndex = 0;
  private views = new Map<string, CharacterView>();
  private actionMenu!: Phaser.GameObjects.Container;
  private turnQueueText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private stageNameText!: Phaser.GameObjects.Text;
  private waitingForInput = false;

  constructor() { super({ key: 'BattleScene' }); }

  init(data: BattleSceneData) {
    this.playerParty = data.playerParty?.length
      ? data.playerParty.map(c => ({ ...c, stats: { ...c.stats }, alive: true, defending: false }))
      : PLAYER_TEMPLATES.map(t => createCharacter(t, 1));
    this.stageIndex = data.stageIndex ?? 0;
    const stage = STAGES[this.stageIndex];
    this.enemyParty = stage.enemies.map(e => createEnemy(e));
    this.turnOrder = [];
    this.turnIndex = 0;
    this.views.clear();
    this.waitingForInput = false;
  }

  create() {
    const W = 360, H = 640;

    // Background panels
    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);
    this.add.rectangle(90, H / 2 - 80, 160, 440, 0x1f2937).setAlpha(0.6);
    this.add.rectangle(270, H / 2 - 80, 160, 440, 0x1f2937).setAlpha(0.6);

    // Divider line
    this.add.line(W / 2, 240, 0, -220, 0, 220, 0x374151, 0.6).setLineWidth(1);

    // Stage name
    this.stageNameText = this.add.text(W / 2, 16, STAGES[this.stageIndex].name, {
      fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Vs label
    this.add.text(W / 2, 230, 'VS', {
      fontSize: '20px', color: '#4b5563', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Turn queue text
    this.turnQueueText = this.add.text(W / 2, 488, '', {
      fontSize: '10px', color: '#6b7280', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Message text
    this.messageText = this.add.text(W / 2, 508, '', {
      fontSize: '12px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Action menu container (centered at bottom)
    this.actionMenu = this.add.container(W / 2, 590);

    // Separator lines
    this.add.line(W / 2, 482, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);
    this.add.line(W / 2, 560, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);

    // Render parties
    this.renderParty(this.playerParty, 90, true);
    this.renderParty(this.enemyParty, 270, false);

    // Start battle
    this.startNewRound();

    // Test helper
    (window as unknown as Record<string, unknown>).__getBattleState = () => ({
      playerParty: this.playerParty,
      enemyParty: this.enemyParty,
      stageIndex: this.stageIndex,
    });
  }

  private renderParty(party: Character[], x: number, isPlayer: boolean) {
    const topY = 40;
    const bottomY = 470;
    const n = Math.max(1, party.length);
    party.forEach((char, i) => {
      const cy = topY + ((bottomY - topY) * (i + 0.5)) / n;
      const color = isPlayer ? 0x3b82f6 : 0xef4444;
      const body = this.add.rectangle(x, cy, 44, 56, color).setAlpha(0.9);
      const hpBarBg = this.add.rectangle(x, cy + 34, 60, 6, 0x374151);
      const hpBar = this.add.rectangle(x - 30, cy + 34, 60, 6, 0x22c55e).setOrigin(0, 0.5);
      const nameText = this.add.text(x, cy - 36, char.name, {
        fontSize: '10px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const archetypeText = this.add.text(x, cy - 26, `[${char.archetype}]`, {
        fontSize: '8px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const hpText = this.add.text(x, cy + 44, `${char.stats.hp}/${char.stats.maxHp}`, {
        fontSize: '9px', color: '#9ca3af', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.views.set(char.id, { body, hpBarBg, hpBar, nameText, hpText, archetypeText });
    });
  }

  private updateHpBar(char: Character) {
    const view = this.views.get(char.id);
    if (!view) return;
    const pct = Math.max(0, char.stats.hp / char.stats.maxHp);
    view.hpBar.width = 60 * pct;
    view.hpBar.fillColor = pct > 0.5 ? 0x22c55e : pct > 0.25 ? 0xf59e0b : 0xef4444;
    view.hpText.setText(`${char.stats.hp}/${char.stats.maxHp}`);
    if (!char.alive) {
      view.body.setAlpha(0.2);
      view.nameText.setAlpha(0.3);
      view.archetypeText.setAlpha(0.3);
    }
  }

  private startNewRound() {
    this.playerParty.forEach(c => { c.defending = false; });
    this.enemyParty.forEach(c => { c.defending = false; });
    this.turnOrder = computeTurnOrder([...this.playerParty, ...this.enemyParty]);
    this.turnIndex = 0;
    this.processTurn();
  }

  private processTurn() {
    while (this.turnIndex < this.turnOrder.length && !this.turnOrder[this.turnIndex].alive) {
      this.turnIndex++;
    }
    if (this.turnIndex >= this.turnOrder.length) {
      this.startNewRound();
      return;
    }
    const current = this.turnOrder[this.turnIndex];
    this.updateTurnQueueDisplay();

    if (current.isPlayer) {
      this.showActionMenu(current);
    } else {
      this.time.delayedCall(700, () => this.executeEnemyTurn(current));
    }
  }

  private updateTurnQueueDisplay() {
    const upcoming = this.turnOrder
      .slice(this.turnIndex, this.turnIndex + 4)
      .filter(c => c.alive)
      .map(c => c.name)
      .join(' → ');
    this.turnQueueText.setText('Next: ' + upcoming);
  }

  private showActionMenu(character: Character) {
    this.actionMenu.removeAll(true);
    this.waitingForInput = true;

    type ActionEntry = { label: string; action: () => void };
    const entries: ActionEntry[] = [];

    if (character.isProtagonist) {
      entries.push({ label: '總攻擊', action: () => this.executeAutoAttack(character) });
    }
    entries.push(
      { label: '攻擊', action: () => this.executeNormalAttack(character) },
      { label: '技能', action: () => this.executeSkillAttack(character) },
      { label: '防禦', action: () => this.executeDefend(character) },
    );

    const btnW = 76;
    const totalW = entries.length * btnW + (entries.length - 1) * 4;
    const startX = -totalW / 2 + btnW / 2;

    entries.forEach(({ label, action }, i) => {
      const bx = startX + i * (btnW + 4);
      const bg = this.add.rectangle(bx, 0, btnW, 36, 0x374151)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(bx, 0, label, {
        fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      bg.on('pointerdown', () => {
        if (!this.waitingForInput) return;
        this.waitingForInput = false;
        this.actionMenu.removeAll(true);
        action();
      });
      bg.on('pointerover', () => bg.setFillStyle(0x4b5563));
      bg.on('pointerout', () => bg.setFillStyle(0x374151));
      this.actionMenu.add([bg, txt]);
    });
  }

  private executeNormalAttack(attacker: Character) {
    const target = chooseTarget(this.enemyParty);
    if (!target) { this.endTurn(); return; }
    const dmg = calcDamage(attacker, target);
    this.applyDamageAndAdvance(attacker, target, dmg, undefined);
  }

  private executeSkillAttack(attacker: Character) {
    const target = chooseTarget(this.enemyParty);
    if (!target) { this.endTurn(); return; }
    const skill = attacker.skills.find(s => s.type === 'attack');
    const dmg = calcDamage(attacker, target, skill);
    this.applyDamageAndAdvance(attacker, target, dmg, skill?.name);
  }

  private executeAutoAttack(attacker: Character) {
    if (Math.random() < 0.5 && attacker.skills.some(s => s.type === 'attack')) {
      this.executeSkillAttack(attacker);
    } else {
      this.executeNormalAttack(attacker);
    }
  }

  private executeDefend(character: Character) {
    character.defending = true;
    this.showMessage(`${character.name} 防禦！傷害減半`);
    this.time.delayedCall(900, () => {
      this.clearMessage();
      this.endTurn();
    });
  }

  private executeEnemyTurn(enemy: Character) {
    const target = chooseTarget(this.playerParty);
    if (!target) { this.endTurn(); return; }
    const dmg = calcDamage(enemy, target);
    this.applyDamageAndAdvance(enemy, target, dmg, undefined);
  }

  private applyDamageAndAdvance(
    attacker: Character,
    target: Character,
    dmg: number,
    skillName: string | undefined,
  ) {
    target.stats.hp = Math.max(0, target.stats.hp - dmg);
    if (target.stats.hp === 0) target.alive = false;
    this.updateHpBar(target);

    const skillLabel = skillName ? `【${skillName}】` : '';
    this.showMessage(`${attacker.name}${skillLabel} → ${target.name} -${dmg} HP`);

    this.time.delayedCall(900, () => {
      this.clearMessage();
      if (this.checkBattleEnd()) return;
      this.endTurn();
    });
  }

  private checkBattleEnd(): boolean {
    const playerAlive = this.playerParty.some(c => c.alive);
    const enemyAlive = this.enemyParty.some(c => c.alive);
    if (!playerAlive || !enemyAlive) {
      const victory = enemyAlive === false;
      const expGained = victory ? STAGES[this.stageIndex].expReward : 0;
      this.time.delayedCall(400, () => {
        this.scene.start('ResultScene', {
          victory,
          playerParty: this.playerParty,
          stageIndex: this.stageIndex,
          expGained,
        });
      });
      return true;
    }
    return false;
  }

  private endTurn() {
    this.turnIndex++;
    this.time.delayedCall(150, () => this.processTurn());
  }

  private showMessage(text: string) {
    this.messageText.setText(text);
  }

  private clearMessage() {
    this.messageText.setText('');
  }
}
```

- [ ] **Step 2: Update src/main.ts to use BattleScene**

```typescript
// src/main.ts
import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  backgroundColor: '#111827',
  parent: 'game',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  scene: [BattleScene],
};

new Phaser.Game(config);
```

- [ ] **Step 3: Write first E2E test (game loads, characters visible)**

```typescript
// tests/e2e/pixel-squad.spec.ts
import { test, expect } from '@playwright/test';

test('game loads and shows battle screen with characters', async ({ page }) => {
  await page.goto('/game_kyo/pixel-squad/');
  // Wait for Phaser canvas to appear
  await page.waitForSelector('canvas', { timeout: 8000 });
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  // Canvas should be non-trivial size
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(200);
  expect(box!.height).toBeGreaterThan(400);
});

test('battle state is accessible via test helper', async ({ page }) => {
  await page.goto('/game_kyo/pixel-squad/');
  await page.waitForSelector('canvas', { timeout: 8000 });
  await page.waitForTimeout(1500); // let Phaser finish scene init

  const state = await page.evaluate(
    () => (window as unknown as { __getBattleState: () => unknown }).__getBattleState()
  );
  expect(state).toBeTruthy();
  const s = state as { playerParty: unknown[]; enemyParty: unknown[] };
  expect(s.playerParty).toHaveLength(3);
  expect(s.enemyParty).toHaveLength(1); // stage 1 has 1 enemy
});
```

- [ ] **Step 4: Install Playwright browser and run E2E tests**

```bash
cd workspace-pixel-squad && npx playwright install --with-deps chromium
npm run test:e2e
```

Expected: 2 tests pass (game loads, state accessible).

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/scenes/BattleScene.ts workspace-pixel-squad/src/main.ts workspace-pixel-squad/tests/e2e/
git commit -m "feat(pixel-squad): add BattleScene with static left/right layout, HP bars, and action menu"
```

---

## Task 8: ResultScene and AllocateScene

**Files:**
- Create: `workspace-pixel-squad/src/scenes/ResultScene.ts`
- Create: `workspace-pixel-squad/src/scenes/AllocateScene.ts`
- Modify: `workspace-pixel-squad/src/main.ts`

- [ ] **Step 1: Write ResultScene.ts**

```typescript
// src/scenes/ResultScene.ts
import Phaser from 'phaser';
import type { ResultSceneData } from '../types';
import { applyExp } from '../battle/ExpSystem';
import { STAGES } from '../data/stages';

export class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  create(data: ResultSceneData) {
    const { victory, playerParty, stageIndex, expGained } = data;
    const W = 360, H = 640;

    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    const title = victory ? '勝利！' : '敗北...';
    const titleColor = victory ? '#4ade80' : '#ef4444';
    this.add.text(W / 2, 160, title, {
      fontSize: '36px', color: titleColor, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, 220, STAGES[stageIndex].name, {
      fontSize: '14px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (victory) {
      this.add.text(W / 2, 270, `獲得 EXP: ${expGained}`, {
        fontSize: '16px', color: '#fde047', fontFamily: 'monospace',
      }).setOrigin(0.5);

      // Apply EXP to all player characters
      const updatedParty = playerParty.map(c => applyExp(c, expGained));
      const hasProtagonistPoints = updatedParty.some(c => c.isProtagonist && c.statPoints > 0);

      let y = 310;
      updatedParty.forEach(c => {
        const leveled = c.level > (playerParty.find(p => p.id === c.id)?.level ?? 1);
        const label = leveled ? `${c.name} Lv.${c.level} ↑` : `${c.name} Lv.${c.level}`;
        this.add.text(W / 2, y, label, {
          fontSize: '13px', color: leveled ? '#a78bfa' : '#e5e7eb', fontFamily: 'monospace',
        }).setOrigin(0.5);
        y += 22;
      });

      const isLastStage = stageIndex >= STAGES.length - 1;

      if (hasProtagonistPoints) {
        this.makeButton(W / 2, 520, '分配能力點數', 0x7c3aed, () => {
          this.scene.start('AllocateScene', { playerParty: updatedParty, stageIndex });
        });
      } else if (!isLastStage) {
        this.makeButton(W / 2, 520, '下一關', 0x16a34a, () => {
          this.scene.start('BattleScene', { playerParty: updatedParty, stageIndex: stageIndex + 1 });
        });
      } else {
        this.add.text(W / 2, 500, '🎉 全部關卡通關！', {
          fontSize: '18px', color: '#fde047', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.makeButton(W / 2, 540, '再來一次', 0x374151, () => {
          this.scene.start('BattleScene', { playerParty: [], stageIndex: 0 });
        });
      }
    } else {
      this.add.text(W / 2, 300, '隊伍全滅', {
        fontSize: '14px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.makeButton(W / 2, 400, '重試', 0x374151, () => {
        this.scene.start('BattleScene', { playerParty: [], stageIndex });
      });
      this.makeButton(W / 2, 460, '從第一關開始', 0x374151, () => {
        this.scene.start('BattleScene', { playerParty: [], stageIndex: 0 });
      });
    }
  }

  private makeButton(x: number, y: number, label: string, color: number, cb: () => void) {
    const bg = this.add.rectangle(x, y, 180, 40, color).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, {
      fontSize: '13px', color: '#fff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    bg.on('pointerdown', cb);
    bg.on('pointerover', () => bg.setAlpha(0.8));
    bg.on('pointerout', () => bg.setAlpha(1));
  }
}
```

- [ ] **Step 2: Write AllocateScene.ts**

```typescript
// src/scenes/AllocateScene.ts
import Phaser from 'phaser';
import type { Character, AllocateSceneData } from '../types';
import { allocateStat } from '../battle/ExpSystem';
import { STAGES } from '../data/stages';

export class AllocateScene extends Phaser.Scene {
  private party: Character[] = [];
  private stageIndex = 0;
  private protagonist!: Character;
  private pointsText!: Phaser.GameObjects.Text;
  private statTexts: Map<string, Phaser.GameObjects.Text> = new Map();

  constructor() { super({ key: 'AllocateScene' }); }

  create(data: AllocateSceneData) {
    this.party = data.playerParty.map(c => ({ ...c, stats: { ...c.stats } }));
    this.stageIndex = data.stageIndex;
    this.protagonist = this.party.find(c => c.isProtagonist)!;
    this.statTexts.clear();

    const W = 360, H = 640;
    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    this.add.text(W / 2, 40, '分配能力點', {
      fontSize: '20px', color: '#e5e7eb', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, 70, this.protagonist.name, {
      fontSize: '14px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.pointsText = this.add.text(W / 2, 100, `剩餘點數: ${this.protagonist.statPoints}`, {
      fontSize: '16px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const stats: Array<{ key: 'hp' | 'atk' | 'def' | 'spd'; label: string; inc: string }> = [
      { key: 'hp', label: 'HP', inc: '+10' },
      { key: 'atk', label: 'ATK', inc: '+2' },
      { key: 'def', label: 'DEF', inc: '+2' },
      { key: 'spd', label: 'SPD', inc: '+2' },
    ];

    stats.forEach(({ key, label, inc }, i) => {
      const y = 180 + i * 80;
      this.add.text(60, y, label, {
        fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0, 0.5);

      const valText = this.add.text(160, y, String(this.protagonist.stats[key]), {
        fontSize: '14px', color: '#a78bfa', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.statTexts.set(key, valText);

      const btn = this.add.rectangle(260, y, 70, 32, 0x374151)
        .setInteractive({ useHandCursor: true });
      this.add.text(260, y, inc, {
        fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      btn.on('pointerdown', () => this.spend(key));
      btn.on('pointerover', () => btn.setFillStyle(0x4b5563));
      btn.on('pointerout', () => btn.setFillStyle(0x374151));
    });

    this.makeButton(W / 2, 560, '確認', 0x16a34a, () => {
      const isLastStage = this.stageIndex >= STAGES.length - 1;
      if (!isLastStage) {
        this.scene.start('BattleScene', {
          playerParty: this.party,
          stageIndex: this.stageIndex + 1,
        });
      } else {
        this.scene.start('BattleScene', { playerParty: this.party, stageIndex: 0 });
      }
    });
  }

  private spend(stat: 'hp' | 'atk' | 'def' | 'spd') {
    if (this.protagonist.statPoints <= 0) return;
    const updated = allocateStat(this.protagonist, stat);
    const idx = this.party.indexOf(this.protagonist);
    this.party[idx] = updated;
    this.protagonist = updated;
    this.pointsText.setText(`剩餘點數: ${this.protagonist.statPoints}`);
    this.statTexts.get(stat)?.setText(String(this.protagonist.stats[stat]));
  }

  private makeButton(x: number, y: number, label: string, color: number, cb: () => void) {
    const bg = this.add.rectangle(x, y, 160, 40, color).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontSize: '14px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    bg.on('pointerdown', cb);
    bg.on('pointerover', () => bg.setAlpha(0.8));
    bg.on('pointerout', () => bg.setAlpha(1));
  }
}
```

- [ ] **Step 3: Update main.ts to include all scenes**

```typescript
// src/main.ts
import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';
import { AllocateScene } from './scenes/AllocateScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  backgroundColor: '#111827',
  parent: 'game',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  scene: [BattleScene, ResultScene, AllocateScene],
};

new Phaser.Game(config);
```

- [ ] **Step 4: Add E2E test for battle flow**

Append to `tests/e2e/pixel-squad.spec.ts`:

```typescript
test('player can click 攻擊 during their turn', async ({ page }) => {
  await page.goto('/game_kyo/pixel-squad/');
  await page.waitForSelector('canvas', { timeout: 8000 });
  await page.waitForTimeout(2000); // let first player turn arrive

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas not found');

  // Action menu is at bottom of canvas (~y=590 in 640-tall logical canvas)
  // In actual rendered coords, scale by box.height/640
  const scale = box.height / 640;
  const clickX = box.x + box.width / 2;
  // Click "攻擊" button (2nd button from left if protagonist, 1st if not)
  const clickY = box.y + 590 * scale;
  await page.mouse.click(clickX - 40 * scale, clickY);
  await page.waitForTimeout(1200);

  // State should still be running (no crash)
  const state = await page.evaluate(
    () => (window as unknown as { __getBattleState?: () => unknown }).__getBattleState?.()
  );
  expect(state).toBeTruthy();
});
```

- [ ] **Step 5: Run all tests**

```bash
npm run test:unit && npm run test:e2e
```

Expected: all unit tests pass; E2E tests pass (3 tests).

- [ ] **Step 6: Commit**

```bash
git add workspace-pixel-squad/src/scenes/ workspace-pixel-squad/src/main.ts workspace-pixel-squad/tests/
git commit -m "feat(pixel-squad): add ResultScene and AllocateScene; complete 3-stage battle flow"
```

---

## Task 9: PWA Setup

> TDD exception: configuration / asset task.

**Files:**
- Create: `workspace-pixel-squad/public/manifest.json`
- Create: `workspace-pixel-squad/public/icons/icon.svg`
- Create: `workspace-pixel-squad/public/icons/apple-touch-icon.png`

- [ ] **Step 1: Write public/manifest.json**

```json
{
  "name": "Pixel Squad",
  "short_name": "PixelSquad",
  "description": "Post-apocalyptic pixel-art turn-based RPG",
  "start_url": "/game_kyo/pixel-squad/",
  "display": "standalone",
  "background_color": "#111827",
  "theme_color": "#111827",
  "orientation": "portrait",
  "icons": [
    {
      "src": "icons/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Create a placeholder icon SVG**

```svg
<!-- public/icons/icon.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="#111827"/>
  <!-- Squad silhouette: 3 pixel people -->
  <rect x="20" y="60" width="16" height="40" fill="#3b82f6"/>
  <rect x="24" y="48" width="8" height="12" fill="#3b82f6"/>
  <rect x="52" y="50" width="16" height="50" fill="#3b82f6"/>
  <rect x="56" y="36" width="8" height="14" fill="#3b82f6"/>
  <rect x="84" y="60" width="16" height="40" fill="#3b82f6"/>
  <rect x="88" y="48" width="8" height="12" fill="#3b82f6"/>
</svg>
```

- [ ] **Step 3: Create a minimal apple-touch-icon PNG**

Copy icon.svg and generate a 180×180 PNG placeholder. If ImageMagick is unavailable, copy the SVG content wrapped in a PNG shell; the browser will fall back to the SVG.

For the simplest path, copy the existing merge10 apple-touch-icon:

```bash
cp ../workspace/public/icons/apple-touch-icon.png public/icons/apple-touch-icon.png
```

If that path doesn't exist, create an empty placeholder and replace with a real icon later:

```bash
python3 -c "
import struct, zlib
def png(w,h,r,g,b):
    raw = b'\\x00' + bytes([r,g,b,255]*w)
    raw = raw * h
    def c(d): return zlib.compress(d)
    def u32(n): return struct.pack('>I',n)
    def chunk(t,d): crc=zlib.crc32(t+d)&0xffffffff; return u32(len(d))+t+d+u32(crc)
    sig=b'\\x89PNG\\r\\n\\x1a\\n'
    ihdr=chunk(b'IHDR',u32(w)+u32(h)+b'\\x08\\x02\\x00\\x00\\x00')
    idat=chunk(b'IDAT',c(raw))
    iend=chunk(b'IEND',b'')
    return sig+ihdr+idat+iend
open('public/icons/apple-touch-icon.png','wb').write(png(180,180,17,24,39))
"
```

- [ ] **Step 4: Verify manifest is served**

```bash
npm run dev
```

Open `http://localhost:5174/game_kyo/pixel-squad/manifest.json` — should return the JSON.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/public/
git commit -m "feat(pixel-squad): add PWA manifest and icons"
```

---

## Task 10: CI/CD Integration

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Read current deploy.yml to find the insertion point**

Open `.github/workflows/deploy.yml` and find the last game's deploy block (currently `merge10x`).

- [ ] **Step 2: Add pixel-squad build and deploy steps**

Insert the following block after the merge10x deploy steps and before the `Deploy hub index` step:

```yaml
      - name: Install dependencies (pixel-squad)
        run: npm ci
        working-directory: workspace-pixel-squad

      - name: Unit tests (pixel-squad)
        run: npm run test:unit
        working-directory: workspace-pixel-squad

      - name: Install Playwright browsers (pixel-squad)
        run: npx playwright install --with-deps chromium
        working-directory: workspace-pixel-squad

      - name: E2E tests (pixel-squad)
        run: npm run test:e2e
        working-directory: workspace-pixel-squad

      - name: Build (pixel-squad)
        run: npm run build
        working-directory: workspace-pixel-squad

      - name: Deploy pixel-squad to GitHub Pages
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: workspace-pixel-squad/dist
          target-folder: pixel-squad
          branch: gh-pages
          clean: false
```

- [ ] **Step 3: Add pixel-squad to hub index**

Open `hub/index.html` and add a link card for Pixel Squad alongside the existing game cards. Find the existing game cards section and add:

```html
<a href="pixel-squad/" class="game-card">
  <div class="game-title">Pixel Squad</div>
  <div class="game-desc">末日廢土回合制 RPG</div>
</a>
```

(Match the existing card markup style in hub/index.html.)

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/deploy.yml hub/index.html
git commit -m "ci: add pixel-squad build, test, and deploy pipeline"
git push origin master
```

Expected: CI runs, pixel-squad deploys to `kyoangel.github.io/game_kyo/pixel-squad/`.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in task |
|---|---|
| Phaser.js + TypeScript + Vite scaffold | Task 1 |
| PWA setup | Task 9 |
| Battle screen left/right layout | Task 7 |
| HP bars, name labels, archetype | Task 7 |
| Turn order by SPD + queue display | Task 3, Task 7 |
| Action menu: 總攻擊 / 攻擊 / 技能 / 防禦 | Task 7 |
| 總攻擊 protagonist-only | Task 7 (`character.isProtagonist` guard) |
| Damage formula ATK − DEF×0.5, min 1 | Task 4 |
| Defend: 50% damage reduction | Task 4, Task 7 |
| Enemy AI: target lowest HP | Task 5 |
| Victory/defeat result screen | Task 8 |
| EXP gain after battle | Task 6, Task 8 |
| Protagonist stat allocation screen | Task 8 |
| 3 hardcoded characters | Task 2 |
| 3 hardcoded stages | Task 2 |
| 1 attack skill per character | Task 2 |
| CI/CD deploy pipeline | Task 10 |

**Placeholder scan:** None found.

**Type consistency:** All interfaces defined in `types.ts` Task 1; all later tasks import from there. `BattleSceneData`, `ResultSceneData`, `AllocateSceneData` all typed. `allocateStat` exported from `ExpSystem.ts` and used in `AllocateScene.ts`.
