# Boss Phase Mechanic — Berserk Weakness Reveal

## Goal

When a boss's HP drops to roughly half, it visibly transforms into a more dangerous form and exposes a previously-hidden elemental weakness that players can exploit for bonus damage and bonus actions for the rest of the fight.

---

## Rules

### Current state (context, not part of this feature)

- `battle/BossAI.ts` already defines `BossConfig`/`BossPhase` (HP-threshold-gated AI behavior changes) and `data/bossConfigs.ts` already configures phase tables for all 5 named bosses (`vega`, `crow`, `zora`, `dex`, `aaaa`). `BattleScene.executeEnemyAction` already shows a one-time taunt banner the first time a phase is entered (gated by `triggeredPhaseThresholds`). This plumbing is reused, not rebuilt.
- The elemental weakness system's **math** already exists (`DamageCalc.calcDamage` 1.5× bonus on element match, `TurnEngine.applyWeaknessBonus` bonus action, `SkillAI` AI preference for known weaknesses) but its **content wiring is incomplete**: `Character` has no `weakness` field (`DamageCalc.ts` reads `(defender as any).weakness`, an untyped cast), `CharacterFactory.createEnemy` never copies `EnemyTemplate.weakness` onto the created `Character`, no `EnemyTemplate` in `data/stages.ts` sets `weakness`, and `recordWeaknessDiscovery` (in `save/GameState.ts`) is never called anywhere. This spec finishes that wiring **only as needed for bosses** — see "Out of scope" below.

### New mechanic

- `BossPhase` gains an optional `weaknessOverride?: Element`.
- All 5 bosses start battle with **no weakness** (`EnemyTemplate.weakness` stays `undefined` for boss entries in `data/stages.ts` — unchanged). Before the berserk phase, no element deals bonus damage to them.
- Each boss has exactly one phase — the one closest to 50% HP in its existing phase table — updated to carry a `weaknessOverride`. Thresholds and `aiType` values are **unchanged**; only `weaknessOverride` is added to the existing phase object:

  | Boss | Existing phase reused | `weaknessOverride` |
  |------|------------------------|---------------------|
  | `vega` | `hpThreshold: 0.5` (`aggressive`) | `ice` |
  | `crow` | `hpThreshold: 0.6` (`defensive`) | `thunder` |
  | `zora` | `hpThreshold: 0.5` (`normal`) | `fire` |
  | `dex`  | `hpThreshold: 0.4` (`aggressive`, message "鎧甲脫了，真的開始了。") | `toxin` |
  | `aaaa` | `hpThreshold: 0.6` (`berserk`) | `ice` |

  (`dex`'s existing 0.4 message already narrates its armor coming off — the weakness reveal slots in naturally there even though it's not exactly 50%; "closest phase to 50% HP" is the rule, not an exact 0.5 requirement.)

- The first time a phase with `weaknessOverride` is entered (same one-shot trigger as the existing taunt-banner check, tracked via `triggeredPhaseThresholds`):
  1. `enemy.weakness` is set to `phase.weaknessOverride` immediately (mutates the live boss `Character`). This is permanent for the rest of the battle — later phases never clear it, even if a future boss's table defines a second `weaknessOverride` on a deeper phase (general rule, no current boss does this).
  2. If `this.gameState` is present, `recordWeaknessDiscovery(this.gameState, enemy.templateId, phase.weaknessOverride)` is called so the discovery persists to the save and is available to `SkillAI`'s auto-battle weakness preference on subsequent encounters with that boss (e.g. New Game+, Boss Rush replays).
  3. A weakness-reveal banner is shown (see UI section), distinct from and shown after the existing taunt banner.
  4. The boss's HP-bar weakness icon (new, see UI) appears immediately, even before the reveal banner finishes.
- If a phase has **both** a `message` and a `weaknessOverride` (true for all 5 entries above), the taunt banner plays first, then the weakness-reveal banner, then the boss acts. If a future boss has `weaknessOverride` with no `message`, the reveal banner plays alone before the boss acts.
- Once `enemy.weakness` is set, it behaves exactly like any other weakness: matching-element skills deal 1.5× damage (`DamageCalc`), trigger `knockedDown` stagger and a bonus action (`TurnEngine.applyWeaknessBonus`), and can trigger All-Out Attack alongside other knocked-down enemies (existing `AllOutAttack.ts` logic — unchanged, already keys off `isWeaknessHit` generically).
- Auto-battle (`SkillAI`'s weakness-aware variant) only acts on a weakness once `gameState.discoveredWeaknesses[templateId]` is set — which now happens automatically the instant the boss phase triggers, not only after a player lands a hit. This is an intentional difference from how the general (non-boss) weakness-discovery flow is *supposed* to work (discovery-on-hit) — bosses **announce** their new weakness via the cutscene-style banner, so there is no hidden-until-hit period for them.
- This mutation only applies to the single boss `Character` instance for that battle (created fresh per `BattleScene.init`); it never touches `EnemyTemplate` or any other instance. Boss Rush (`ChallengeRun`) fights each boss stage through a normal `BattleScene.init`, so each boss in a Boss Rush run independently starts weakness-less and reveals its own weakness at its own threshold — no special-casing needed.
- If a boss is successfully recruited (`enemyToPlayerCharacter`) after revealing its weakness, the new player-side `Character` does **not** carry the `weakness` field over (the function already builds an explicit field list rather than spreading the enemy, so this requires no code change — just confirm no `weakness:` line is added to it). This avoids enemy AI later getting a 1.5× bonus + bonus action against a recruited former boss.
- Stages with multiple enemies, or boss stages where `enemyParty.length !== 1`, are unaffected — `this.bossConfig` is only ever set when `stage.isBoss && enemyParty.length === 1` (existing condition, unchanged).

### Out of scope (flagged, not built here)

- Assigning `weakness` to regular (non-boss) `EnemyTemplate`s, and wiring `recordWeaknessDiscovery` into the general hit-resolution path (`applyDamageAndAdvance`) so normal enemies' weaknesses get discovered-on-hit. Tracked as a new backlog item (see backlog update below).

---

## Data Model Changes

### `types.ts`

Add `weakness` to the live `Character` interface (it already exists on `EnemyTemplate`; `Character` currently has none, forcing the `as any` cast in `DamageCalc.ts`):

```typescript
export interface Character {
  // ...existing fields...
  _monsterType?: MonsterType;
  /** Elemental weakness, if any. Copied from EnemyTemplate at creation for enemies; bosses may gain one mid-battle via BossPhase.weaknessOverride. */
  weakness?: Element;
  knockedDown?: boolean;
  bonusActionUsed?: boolean;
}
```

### `battle/BossAI.ts`

```typescript
import type { Character, Element } from '../types';

export interface BossPhase {
  hpThreshold: number;
  aiType: BossAIType;
  message?: string;
  /** Set on first entering this phase: grants the boss this elemental weakness for the rest of the battle. */
  weaknessOverride?: Element;
}
```

### `battle/CharacterFactory.ts`

`createEnemy` must copy the template's weakness onto the instance:

```typescript
const char: Character = {
  // ...existing fields...
  skillCooldowns: {},
  weakness: template.weakness,
};
```

(Boss `EnemyTemplate`s have no `weakness` set in `data/stages.ts`, so this is `undefined` at battle start — consistent with "no weakness until berserk".)

### `battle/DamageCalc.ts`

Drop the `as any` cast now that `Character.weakness` is typed:

```typescript
const isWeaknessHit = !!(skill?.element) && !!defender.weakness && skill.element === defender.weakness;
```

### `data/bossConfigs.ts`

Add `weaknessOverride` to the one phase per boss listed in the Rules table above. Example (`vega`, full file edited the same way for the other 4):

```typescript
vega: {
  templateId: 'vega',
  phases: [
    { hpThreshold: 1.0, aiType: 'normal' },
    { hpThreshold: 0.5, aiType: 'aggressive', message: '「你逼我的！」', weaknessOverride: 'ice' },
    { hpThreshold: 0.2, aiType: 'berserk',    message: '「我不會倒下的！」' },
  ],
},
```

Apply the equivalent single-field addition to `crow` (`0.6` phase → `weaknessOverride: 'thunder'`), `zora` (`0.5` phase → `weaknessOverride: 'fire'`), `dex` (`0.4` phase → `weaknessOverride: 'toxin'`), `aaaa` (`0.6` phase → `weaknessOverride: 'ice'`). No threshold, `aiType`, or message text changes.

---

## UI Changes

### Weakness-reveal banner (`BattleScene`)

New private method alongside `showPhaseBanner`:

```typescript
private showWeaknessRevealBanner(element: Element) {
  const W = 360;
  const label = ELEMENT_LABELS[element]; // '火' | '冰' | '雷' | '毒' | '物理'
  const banner = this.add.text(W / 2, 130, `💢 弱點外露：${label}屬性！`, {
    fontSize: '13px', color: '#f87171', fontFamily: 'monospace',
    backgroundColor: '#111827', padding: { x: 12, y: 8 },
  }).setOrigin(0.5).setDepth(20);
  this.time.delayedCall(1800, () => { if (banner.active) banner.destroy(); });
}
```

`ELEMENT_LABELS` is a new small `Record<Element, string>` map (add to `ui/theme.ts` or a new `ui/elementLabels.ts`): `{ fire: '火', ice: '冰', thunder: '雷', toxin: '毒', physical: '物理' }`.

### `executeEnemyAction` timing

Replace the phase-trigger gate to also fire on `weaknessOverride` (currently gated on `phase.message` alone), and sequence the two banners:

```typescript
private executeEnemyAction(enemy: Character, next: () => void) {
  if (this.bossConfig && enemy.templateId === this.bossConfig.templateId) {
    const hpRatio = enemy.stats.hp / enemy.stats.maxHp;
    const phase = getBossPhase(this.bossConfig, hpRatio);
    const isFirstEntry = (phase.message || phase.weaknessOverride) && !this.triggeredPhaseThresholds.has(phase.hpThreshold);

    if (isFirstEntry) {
      this.triggeredPhaseThresholds.add(phase.hpThreshold);

      if (phase.weaknessOverride) {
        enemy.weakness = phase.weaknessOverride;
        if (this.gameState) recordWeaknessDiscovery(this.gameState, enemy.templateId, phase.weaknessOverride);
        this.updateWeaknessIcon(enemy);
      }

      if (phase.message) this.showPhaseBanner(phase);

      const revealDelay = phase.message ? 2000 : 0;
      if (phase.weaknessOverride) {
        this.time.delayedCall(revealDelay, () => this.showWeaknessRevealBanner(phase.weaknessOverride!));
      }
      const actDelay = revealDelay + (phase.weaknessOverride ? 1800 : 0);
      this.time.delayedCall(actDelay, () => this.executeBossPhaseAction(enemy, phase, next));
      return;
    }

    this.executeBossPhaseAction(enemy, phase, next);
    return;
  }
  // ...unchanged enemy-AI branch...
}
```

### Boss HP-bar weakness icon

New `updateWeaknessIcon(char: Character)` method, mirroring the existing `updateStatusIcons` pattern: renders a small element glyph (reuse `ELEMENT_LABELS`, e.g. `❄` for ice / `🔥` for fire / `⚡` for thunder / `☠` for toxin) next to the boss's `archetypeText` line. Called once when the weakness is revealed; no-op for characters with no `weakness`. Persists for the rest of the battle (never cleared by `updateHpBar`).

---

## Acceptance Criteria

### Phase weakness reveal

- **Given** `vega` boss battle starts (HP 200/200, no `weakness`)
  **When** an ice-element skill is used against it
  **Then** no weakness bonus applies (`isWeaknessHit` is `false`, no 1.5× damage, no bonus action).

- **Given** `vega`'s HP drops to exactly 50% (100/200) for the first time
  **When** `executeEnemyAction` next runs for `vega`
  **Then** `vega.weakness` is set to `'ice'`, the taunt banner `「你逼我的！」` displays, followed by the reveal banner `💢 弱點外露：冰屬性！`, and only after both have shown does `vega` execute its `aggressive` phase action.

- **Given** `vega.weakness === 'ice'` (already revealed)
  **When** an ice-element skill subsequently hits `vega` and it survives
  **Then** `calcDamage` returns `isWeaknessHit: true`, damage is 1.5× base, `vega` is `knockedDown`, and the attacker earns a bonus action.

- **Given** `vega`'s HP later drops to 20% (the existing `berserk` phase, no `weaknessOverride`)
  **When** that phase triggers
  **Then** `vega.weakness` remains `'ice'` (unchanged) — only the taunt banner and AI behavior change.

### Discovery persistence

- **Given** a `gameState` is passed into `BattleScene` (normal stage flow, not `PLAYER_TEMPLATES.map` fallback)
  **When** `crow`'s weakness-reveal phase triggers
  **Then** `gameState.discoveredWeaknesses['crow']` equals `'thunder'` immediately, before any player skill has hit the weakness.

- **Given** `gameState` is `undefined` (e.g. boss battle launched without save context)
  **When** the weakness-reveal phase triggers
  **Then** `enemy.weakness` is still set and the banners still display; no error is thrown attempting to record discovery.

### Recruit interaction

- **Given** a boss has revealed its weakness (`enemy.weakness` set) and is then successfully recruited
  **When** `enemyToPlayerCharacter(enemy, maxHp)` runs
  **Then** the returned player `Character` has `weakness: undefined` (field is not copied).

### Regression

- **Given** the existing `BossAI.test.ts` suite (`getBossPhase`, `executeBossAction`)
  **When** these tests run unchanged
  **Then** they continue to pass — `weaknessOverride` is optional and doesn't alter `getBossPhase`/`executeBossAction` return shapes for phases that don't set it.

- **Given** a non-boss stage (`bossConfig` undefined) or a boss stage with `enemyParty.length > 1`
  **When** `executeEnemyAction` runs for any enemy there
  **Then** behavior is identical to today — no weakness banner, no `weakness` mutation, normal `decideAction` AI path.

---

## Backlog Update

This spec also surfaces a pre-existing gap worth tracking separately: the elemental-weakness system's damage math and bonus-action logic are implemented and tested, but no non-boss `EnemyTemplate` has a `weakness` assigned, `createEnemy` (pre-this-spec) never copied it onto `Character`, and `recordWeaknessDiscovery` was never called from the general hit-resolution path. A new backlog item is appended to track finishing that wiring for regular enemies, independent of this boss-specific fix.
