# Status Effect Expansion

## Goal

Add four distinct status ailments — Poison (DoT), Burn (ATK down), Freeze (skip turn), Stun (acts last) — that can be applied by skills and persist across turns via a tick system that runs alongside the existing buff ticker.

---

## Rules

### Status Effect Definitions

| ID | Chinese | Trigger | Duration | Mechanical Effect |
|----|---------|---------|----------|-------------------|
| `poison` | 毒 | Start of each round | 3 turns | Deals `floor(maxHp × 0.08)` (min 1) true damage, ignoring DEF and defend stance |
| `burn` | 灼燒 | Passive until expiry | 2 turns | `effectiveAtk` reduced by 30% (multiplied by 0.70) |
| `freeze` | 凍結 | On that character's turn | 1 turn | Character's turn is skipped entirely in the execution phase |
| `stun` | 眩暈 | Passive until expiry | 1 turn | `effectiveSpd` returns 0; character acts last (still acts) |

### Application Rules

- Any attack skill may carry `appliesStatus?: StatusEffectType` on its `Skill` definition.
- Status is applied **after** damage is resolved and **only if the target survives** (hp > 0).
- Applying the same status type to an already-afflicted character **refreshes** (overwrites) the duration — effects do not stack.
- Applying two different statuses is allowed; a character can hold multiple status effects simultaneously.
- Status effects can be applied to **both player characters and enemies**.
- Status effects are applied through direct skill attacks only — basic attacks never apply status.

### Tick Timing

- `tickStatusEffects` is called at the **start of `startCommandPhase`**, immediately after `tickBuffs`, before any command input is taken.
- Poison damage is dealt during this tick. If HP drops to 0, `alive` is set to `false`.
- After applying Poison DoT, all durations are decremented by 1. Effects at 0 are removed.
- If a Freeze expires during the tick (duration counts down to 0 and is removed), the character acts **normally that round**.
- Freeze that was just applied this round takes effect **next round** (applied at end of round, ticks off at start of next round's command phase, so the character still has `turnsRemaining: 1` when their turn comes).

### Freeze and Turn Execution

- In `executeNextInOrder`, before processing a character's turn, check if they carry a `freeze` status effect.
- If frozen: show a brief message `"X 被凍結，跳過回合！"`, wait 600ms, call `next()`.
- Freeze does not remove itself mid-round — it is removed by the tick at the start of the next command phase.
- A frozen character cannot use Bonus Actions (weakness exploitation) — if they would have earned one, it is lost.

### Stun and Turn Order

- `effectiveSpd` checks `activeStatusEffects` for `stun`; if found, returns `0`.
- `computeTurnOrder` already uses `effectiveSpd`, so stunned characters naturally sort to the back.
- The existing player-friendly tie-break (`isPlayer: true` acts first at equal SPD) applies among stunned characters.

### Poison and Death

- If Poison damage kills a character, the death is processed immediately (HP → 0, `alive = false`).
- After all DoT ticks in both parties, `checkBattleEnd()` is called once.

### Enemy AI

- Enemies with skills that have `appliesStatus` will use those skills via the existing `SkillAI.ts` `decideAction` heuristic (no change needed; the skill will simply carry the new field).
- Enemy AI does not need special logic to "prefer" status-applying skills — the existing AI considers any available non-cooldown skill.

---

## Data Model Changes

### `types.ts`

**Add new types** (after existing `Element` definition):

```typescript
export type StatusEffectType = 'poison' | 'burn' | 'freeze' | 'stun';

export interface ActiveStatusEffect {
  type: StatusEffectType;
  /** Decremented by 1 at the start of each command phase tick. Removed when reaches 0. */
  turnsRemaining: number;
  sourceSkillId: string;
}
```

**Modify `Skill` interface** — add optional field:

```typescript
/** attack skills only — applied on hit if target survives */
appliesStatus?: StatusEffectType;
```

**Modify `Character` interface** — add field alongside `activeBuffs`:

```typescript
activeStatusEffects: ActiveStatusEffect[];
```

### `data/skills.ts`

**Update existing skills** to carry `appliesStatus`:

```typescript
cryo_round: {
  // ...existing fields...
  appliesStatus: 'freeze',
  description: '發射低溫冷凍彈，命中後使目標凍結1回合。',
},
acid_splash: {
  // ...existing fields...
  appliesStatus: 'burn',
  description: '噴出高濃度腐蝕液體，命中後使目標灼燒（ATK-30%）2回合。',
},
emp_pulse: {
  // ...existing fields...
  appliesStatus: 'stun',
  description: '釋放電磁脈衝，命中後使目標眩暈（速度歸零）1回合。',
},
```

**Add new skill**:

```typescript
toxic_spray: {
  id: 'toxic_spray',
  name: '毒霧噴灑',
  type: 'attack',
  target: 'enemy',
  multiplier: 0.8,
  cooldown: 2,
  element: 'toxin',
  appliesStatus: 'poison',
  description: '噴出毒霧，命中後使目標中毒（每回合損失8%最大HP）3回合。',
},
```

---

## Battle Logic Changes

### `battle/Buffs.ts`

**Modify `effectiveAtk`** to check for Burn:

```typescript
export function effectiveAtk(c: Character): number {
  let base = c.stats.atk;
  const atk = c.activeBuffs.find(b => b.stat === 'atk');
  const buffed = atk ? base * (1 + atk.amountPct) : base;
  const archetypeScaled = c.archetype === '全能' ? buffed * ALL_ROUNDER_STAT_MULT : buffed;
  const hasBurn = c.activeStatusEffects?.some(s => s.type === 'burn');
  return hasBurn ? Math.floor(archetypeScaled * 0.70) : archetypeScaled;
}
```

**Modify `effectiveSpd`** to check for Stun:

```typescript
export function effectiveSpd(c: Character): number {
  if (c.activeStatusEffects?.some(s => s.type === 'stun')) return 0;
  return effectiveStat(c, 'spd', c.stats.spd);
}
```

**Add `applyStatusEffect`**:

```typescript
export function applyStatusEffect(
  target: Character,
  type: StatusEffectType,
  turns: number,
  sourceSkillId: string,
): void {
  if (!target.activeStatusEffects) target.activeStatusEffects = [];
  const existing = target.activeStatusEffects.findIndex(s => s.type === type);
  const effect: ActiveStatusEffect = { type, turnsRemaining: turns, sourceSkillId };
  if (existing >= 0) {
    target.activeStatusEffects[existing] = effect;
  } else {
    target.activeStatusEffects.push(effect);
  }
}
```

**Add `tickStatusEffects`** (returns DoT events for display):

```typescript
export interface StatusTickEvent {
  character: Character;
  type: StatusEffectType;
  damage?: number; // poison only
}

export function tickStatusEffects(party: Character[]): StatusTickEvent[] {
  const events: StatusTickEvent[] = [];
  party.forEach(c => {
    if (!c.alive) return;
    if (!c.activeStatusEffects) { c.activeStatusEffects = []; return; }
    const poison = c.activeStatusEffects.find(s => s.type === 'poison');
    if (poison) {
      const dmg = Math.max(1, Math.floor(c.stats.maxHp * 0.08));
      c.stats.hp = Math.max(0, c.stats.hp - dmg);
      if (c.stats.hp === 0) c.alive = false;
      events.push({ character: c, type: 'poison', damage: dmg });
    }
    c.activeStatusEffects.forEach(s => { s.turnsRemaining--; });
    c.activeStatusEffects = c.activeStatusEffects.filter(s => s.turnsRemaining > 0);
  });
  return events;
}
```

### `battle/CharacterFactory.ts`

`createCharacter` and `createEnemy` must initialize `activeStatusEffects: []` alongside `activeBuffs: []`.

Also in `BattleScene.init`, the player party reset line that spreads the character must preserve (or reset) `activeStatusEffects: []`.

### `scenes/BattleScene.ts`

**`startCommandPhase`**: After calling `tickBuffs`, call `tickStatusEffects` for both parties, iterate the returned events, show each as a brief sequenced message, then call `checkBattleEnd()` in case Poison killed someone.

Since `startCommandPhase` is synchronous and messages need to be queued, the tick should happen in a new async helper `runStartOfRoundTicks(onDone)` that:
1. Calls `tickBuffs(playerParty)` and `tickBuffs(enemyParty)`
2. Calls `tickStatusEffects(playerParty)` and `tickStatusEffects(enemyParty)`, collecting all `StatusTickEvent[]`
3. If events exist: sequences them with 600ms delay each, showing messages like `"${c.name} 中毒 -${dmg} HP"`, then updates HP bars
4. After all events displayed, checks `checkBattleEnd()`; if battle ended, returns
5. Otherwise clears messages and calls `advanceCommandInput()`

**`executeNextInOrder`**: At the top of each character's execution, check if they have `freeze` status:

```typescript
const frozen = current.activeStatusEffects?.some(s => s.type === 'freeze');
if (frozen) {
  this.showMessage(`${current.name} 被凍結，跳過回合！`);
  this.time.delayedCall(600, () => { this.clearMessage(); this.executeNextInOrder(order, idx + 1); });
  return;
}
```

**`applyDamageAndAdvance`**: After target HP is updated and death is checked, if `skill?.appliesStatus` exists and target is still alive:

```typescript
if (skill?.appliesStatus && target.alive) {
  const durationMap: Record<StatusEffectType, number> = {
    poison: 3, burn: 2, freeze: 1, stun: 1,
  };
  applyStatusEffect(target, skill.appliesStatus, durationMap[skill.appliesStatus], skill.id);
  // Also append status label to the message shown
}
```

The message text should be appended with a status label, e.g.:
- `"X → Y -12 HP ⚠ 中毒！"`
- `"X → Y -8 HP ❄ 凍結！"`

---

## UI Changes

### Status Icon Strip (`ui/battleStatusIcons.ts` — new file)

A small icon row rendered below each character's HP text, showing all active status effects.

- Icon mapping:
  - `poison` → `☠` (green, `#4ade80`)
  - `burn` → `🔥` or `炎` (red-orange, `#f97316`)
  - `freeze` → `❄` (cyan, `#67e8f9`)
  - `stun` → `⚡` (yellow, `#fbbf24`)
- Each icon is a small `Phaser.GameObjects.Text` with 9px monospace, placed in a row below `hpText`.
- Refreshed by a new `updateStatusIcons(char: Character)` call after any status change.
- Called from `BattleScene` wherever `updateHpBar` is called, and after any `applyStatusEffect` call.

### Message Text

- DoT tick: `"${c.name} 中毒 -${dmg} HP"` shown in the existing `messageText` area.
- Status applied on hit: existing damage message is extended: `"X → Y -12 HP | 灼燒！"`.
- Freeze skip: `"X 被凍結，跳過回合！"` shown for 600ms.

### Existing `ui/battleBuffDisplay.ts`

If this module renders active buffs on characters, extend it to also render status effect badges, or create a separate module and render alongside it. (Coordinate with existing buff display to avoid overlap.)

---

## Acceptance Criteria

### Poison

- **Given** a character has `activeStatusEffects: [{ type: 'poison', turnsRemaining: 2 }]`  
  **When** `startCommandPhase` runs (tick phase)  
  **Then** the character loses `floor(maxHp × 0.08)` HP (min 1), the message `"X 中毒 -N HP"` displays for 600ms, and `turnsRemaining` decrements to 1.

- **Given** a Poison effect with `turnsRemaining: 1`  
  **When** the tick phase runs  
  **Then** Poison DoT is applied and then the effect is removed (turnsRemaining → 0, filtered out).

- **Given** a character already poisoned  
  **When** another Poison is applied via skill  
  **Then** duration resets to 3 (no duplicate entry in `activeStatusEffects`).

- **Given** Poison damage reduces HP to 0  
  **When** `tickStatusEffects` completes  
  **Then** `alive = false`, HP bar shows 0/maxHp, and `checkBattleEnd()` transitions to ResultScene.

### Burn

- **Given** a character has `activeStatusEffects: [{ type: 'burn', turnsRemaining: 2 }]`  
  **When** `effectiveAtk` is called  
  **Then** the result is `floor(baseAtk × buffMultiplier × 0.70)`.

- **Given** a Burned character attacks  
  **When** `calcDamage` is called  
  **Then** damage is lower than it would be without Burn.

- **Given** `acid_splash` hits and target survives  
  **When** damage is applied  
  **Then** target gains `burn` status with `turnsRemaining: 2` and the message includes `"灼燒！"`.

### Freeze

- **Given** a character has `activeStatusEffects: [{ type: 'freeze', turnsRemaining: 1 }]`  
  **When** `executeNextInOrder` reaches that character  
  **Then** the message `"X 被凍結，跳過回合！"` displays for 600ms and their turn is skipped (no attack, no skill).

- **Given** `cryo_round` hits and target survives  
  **When** damage is applied  
  **Then** target gains `freeze` status with `turnsRemaining: 1`.

- **Given** a character was Frozen last round (turnsRemaining was 1)  
  **When** `tickStatusEffects` runs at round start  
  **Then** Freeze is removed and the character acts normally.

### Stun

- **Given** a character has `activeStatusEffects: [{ type: 'stun', turnsRemaining: 1 }]`  
  **When** `effectiveSpd` is called  
  **Then** it returns `0`.

- **Given** `emp_pulse` hits and target survives  
  **When** damage is applied  
  **Then** target gains `stun` status with `turnsRemaining: 1`.

- **Given** a stunned enemy and a player character with SPD 10  
  **When** `computeTurnOrder` runs  
  **Then** the player character (SPD 10) appears before the stunned enemy (SPD 0).

- **Given** a stunned character (SPD 0)  
  **When** their turn comes in `executeNextInOrder`  
  **Then** they still act — Stun only delays, it does not skip.

### Factory / Initialization

- **Given** a new battle starts  
  **When** `createCharacter` or `createEnemy` runs  
  **Then** `activeStatusEffects` is initialized to `[]`.

- **Given** a player character carried over from the previous round  
  **When** `BattleScene.init` resets the party  
  **Then** `activeStatusEffects` is reset to `[]`.

### UI

- **Given** a character has active status effects  
  **When** the battle UI renders  
  **Then** the appropriate status icons appear below the HP text for that character.

- **Given** a status effect expires (turnsRemaining → 0)  
  **When** the tick runs  
  **Then** the corresponding icon is removed from the character's UI.
