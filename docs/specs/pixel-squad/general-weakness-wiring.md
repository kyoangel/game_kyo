# General Enemy Weakness Wiring — Content + Discovery-on-Hit

## Goal

Give every non-boss enemy a real elemental weakness and wire the already-built (but previously unused) discovery system to it, so landing a matching elemental skill deals 1.5× damage, reveals a discovery banner + HP-bar icon, persists the discovery to the save, and feeds the existing weakness-aware auto-battle AI.

---

## Rules

### Current state (context, not part of this feature)

- `specs/pixel-squad-boss-phase-weakness.md` already wired the weakness *math* end-to-end for bosses only: `Character.weakness` (typed field), `CharacterFactory.createEnemy` copying `EnemyTemplate.weakness` onto the instance, `DamageCalc.calcDamage`'s 1.5× bonus, and `recordWeaknessDiscovery`/`GameState.discoveredWeaknesses`. That spec explicitly scoped out regular enemies (see its "Out of scope" section) and that gap is what this spec closes.
- Verified against the current code: `CharacterFactory.createEnemy` (`battle/CharacterFactory.ts:66`) already does `weakness: template.weakness` — this part of the original backlog wording is stale, no change needed there. What is still true: **no non-boss `EnemyTemplate` in `data/stages.ts` sets `weakness`**, so it is always `undefined` for every regular enemy today; `recordWeaknessDiscovery` (`save/GameState.ts:33`) is only ever called from `battle/BossWeaknessReveal.ts`, never from the general hit-resolution path; and `BattleScene.updateWeaknessIcon` (`scenes/BattleScene.ts:280`) renders `ELEMENT_ICONS[char.weakness]` **unconditionally** whenever `char.weakness` is set, with no discovery gate — if a regular `EnemyTemplate.weakness` were added today with zero other changes, the icon would spoil it from the first frame of battle, which breaks the discovery-on-hit design intent already documented in the boss spec (§"Auto-battle ... weakness-aware variant only acts on a weakness once `discoveredWeaknesses[templateId]` is set ... intentional difference from how the general (non-boss) weakness-discovery flow is *supposed* to work (discovery-on-hit)").
- `battle/SkillAI.ts` already exports `decideActionWithAwareness`, a weakness-aware variant of `decideAction` that prefers a matching elemental skill against any enemy whose `templateId` is a key in the passed `discoveredWeaknesses` map. It is fully implemented and has its own test coverage, but is **never called** anywhere in `scenes/BattleScene.ts` — `runAutoRound` (`scenes/BattleScene.ts:937`) calls plain `decideAction` for player auto-battle decisions. Until `discoveredWeaknesses` actually gets populated by this spec, this function had no data to act on anyway; now that it will, it should be wired in too, since it is the entire reason that map exists.
- Out of scope, flagged separately below: `TurnEngine.applyWeaknessBonus` (bonus action on weakness hit), `Character.knockedDown`, and all of `battle/AllOutAttack.ts` (the All-Out Attack chain-trigger) are implemented with isolated unit tests but are **never invoked from `BattleScene`** — no call site sets `knockedDown = true`, calls `applyWeaknessBonus`, checks `allEnemiesKnockedDown`, or calls `applyAllOutAttack`. The `'all-out-attack-prompt'` `BattlePhase` value is never assigned anywhere. This means weakness hits today (boss or otherwise) only ever produce the 1.5× damage multiplier — no stagger, no bonus turn, no All-Out Attack — despite the backlog already marking "連鎖攻擊：連續命中敵人弱點可觸發全體攻擊" as done. This spec does **not** fix that; it is tracked as a new backlog item (see Backlog Update) because it's a larger, separate piece of BattleScene sequencing work and isn't required to make general-enemy weakness assignment + discovery functional.

### New mechanic — weakness assignment

- Every non-boss `EnemyTemplate` in `data/stages.ts` gets a `weakness: Element` assigned. Boss `EnemyTemplate` entries (`vega`, `crow`, `zora`, `dex`, `aaaa`) are **unchanged** — they keep gaining their weakness mid-battle via `BossPhase.weaknessOverride`, never from the template.
- Rule for repeated ids: several enemy ids appear in more than one stage (e.g. `raider_a`, `mech_a`, `soldier_a`, `elite_a`, `elite_b`). Every occurrence of the same id across `data/stages.ts` **must** use the same `weakness` value — `discoveredWeaknesses` is keyed by `templateId`, so a player who already beat `raider_a`'s weakness out of it in chapter 2 must find it still works on `raider_a` wherever it reappears (chapter 2 again, or `SQ-2`).
- Assignment table (full coverage of every non-boss id currently in `data/stages.ts`), grouped by enemy family/theme:

  | Element | Enemy ids (all occurrences) |
  |---|---|
  | `fire` | `mutant`, `mutant_a`, `mutant_b`, `beast_a`, `beast_b`, `beast_c`, `bomber`, `shadow_a`, `shadow_b`, `shadow_c`, `ruin_deity` |
  | `ice` | `wolf_a`, `wolf_b`, `ruin_guard_a`, `ruin_guard_b`, `gargoyle`, `ancient_a`, `ancient_b` |
  | `thunder` | `mech_a`, `mech_b`, `mech_c`, `em_spider`, `franken`, `em_guard_a`, `em_guard_b`, `mech_soldier`, `forge_bot`, `elite_mech_a`, `elite_mech_b`, `elite_mech_c`, `top_samurai` |
  | `toxin` | `waste_dog`, `soldier`, `soldier_a`, `soldier_b`, `soldier_c`, `elite_guard_a`, `elite_guard_b`, `market_boss` |
  | `physical` | `raider`, `raider_a`, `raider_b`, `raider_c`, `raider_cap`, `raider_sniper`, `sniper`, `elite_a`, `elite_b`, `elite_c`, `arena_a`, `arena_b`, `arena_c`, `arena_champ` |

  Rationale for the grouping (not enforced by code, just keeps future additions consistent): mutated/organic enemies and shadow-type enemies burn (`fire`); slow/ancient stone or frost-themed enemies crack under cold (`ice`); every robotic/mechanical enemy across chapters 2 and 4 takes EMP-style bonus damage (`thunder`) — this deliberately makes chapter 4 ("機械廢都") read as a soft "bring lightning" zone, mirroring chapter 1's early `fire`-weak mutants; wasteland-irradiated/poison-adjacent enemies are extra vulnerable to toxin (`toxin`); plain human raiders/soldiers/arena fighters have no special resistance and go down to straightforward physical hits (`physical`).
- All 5 elements are reachable with the player's existing kit by the time they matter: protagonist starts with `burst_shot` (`fire`), `shield_bash`(`physical`)/`swift_strike`(`thunder`) unlock with Rex/Nyx in chapter 1, and `cryo_round`(`ice`)/`acid_splash`+`toxic_spray`(`toxin`) are purchasable shop scrolls (`data/shopItems.ts`) available from the first shop visit — no new skills need to be added for this spec.

### New mechanic — discovery on hit

- `BattleScene` gains a per-battle `discoveredThisBattle: Set<string>` (keyed by `templateId`), initialized in `init()`/`create()` from `this.gameState?.discoveredWeaknesses` (every key already present in the save is pre-seeded so previously-discovered enemies show their icon from the start of a new fight, matching how a player would expect prior knowledge to carry over).
- Whenever `calcDamage` is called for a **player-initiated** attack against an enemy (`executePlayerCommand`'s basic-attack/skill path; this excludes the enemy-attacks-player direction, which can never produce `isWeaknessHit` since player `Character`s never have a `weakness`) and returns `isWeaknessHit: true`:
  1. If `target.templateId` is not already in `discoveredThisBattle`, this is a **new** discovery this battle:
     - Add it to `discoveredThisBattle`.
     - Call `recordWeaknessDiscovery(this.gameState, target.templateId, target.weakness)` if `this.gameState` is present (no-op/guarded if absent, same as the boss path).
     - Call `this.updateWeaknessIcon(target)` so the icon appears immediately.
     - Show the existing `showWeaknessRevealBanner(target.weakness)` banner (reused as-is, no boss-specific wording) after the normal damage message clears.
  2. If it was already in `discoveredThisBattle` (already revealed earlier this fight, or pre-seeded from the save), the hit still deals 1.5× damage as today — just no banner/icon-update repeat (icon is already showing).
- This applies per `templateId`, not per `Character` instance: if a stage has two `raider_a` enemies and the player hits the weakness on the first one, the second `raider_a`'s icon also appears immediately (same species, same revealed weakness) — `updateWeaknessIcon` is called for every live `Character` whose `templateId` is in `discoveredThisBattle` whenever a new discovery happens, not just the one that was hit.
- `updateWeaknessIcon` (`scenes/BattleScene.ts:280`) changes from unconditionally showing `char.weakness` to showing it only when `char.weakness` is set **and** `char.templateId` is in `discoveredThisBattle`. Bosses are unaffected by this gating change: `revealBossWeakness` already sets `enemy.weakness` and calls `recordWeaknessDiscovery` in the same beat the banner shows, so the existing call sites just also need to add the boss's `templateId` into `discoveredThisBattle` at that moment (one extra line) so the gate doesn't hide a boss weakness that was just announced.
- Where the initial per-character view is built (`scenes/BattleScene.ts:250`, `this.updateWeaknessIcon(char)` called once per character at battle start), behavior is unchanged in code — it will simply now render nothing for enemies whose `templateId` isn't pre-seeded, and the correct icon for any that are.

### New mechanic — weakness-aware auto-battle

- `runAutoRound` (`scenes/BattleScene.ts:937`) swaps its `decideAction(c, this.playerParty, this.enemyParty)` call for `decideActionWithAwareness(c, this.playerParty, this.enemyParty, this.gameState?.discoveredWeaknesses ?? {})`. This is the only call-site change needed — `decideActionWithAwareness` already falls back to plain `decideAction` internally when no enemy's `templateId` has a known weakness.
- This means: once a weakness has been discovered (this battle or a prior save), auto-battle will prefer using a matching elemental skill against that enemy if the acting character has one ready, same as it already does for bosses (boss weaknesses are recorded into the same `discoveredWeaknesses` map, so this is one unified behavior, not boss-specific).

### Out of scope (flagged, not built here)

- Wiring `TurnEngine.applyWeaknessBonus` (bonus action/extra turn), `Character.knockedDown` staggering, and `battle/AllOutAttack.ts` (All-Out Attack chain trigger) into `BattleScene`'s actual turn-execution flow. These modules exist with their own unit tests (`tests/unit/TurnEngine.bonusAction.test.ts`, `tests/unit/AllOutAttack.trigger.test.ts`) but have zero call sites in `scenes/BattleScene.ts` today, so weakness hits currently never grant a bonus action, never knock an enemy down, and can never trigger All-Out Attack, contradicting the backlog's existing "連鎖攻擊" done-checkmark. Tracked as a new backlog item below.

---

## Data Model Changes

No new types are needed — `EnemyTemplate.weakness?: Element` (`types.ts:107`) and `Character.weakness?: Element` (`types.ts:94`) already exist from the boss-phase-weakness spec. The only data-model change is populating data, not types:

### `data/stages.ts`

Add `weakness: '<element>'` to every non-boss `EnemyTemplate` object literal, per the assignment table above. Example (chapter 1, stage `1-1` and `1-2`):

```typescript
{
  id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
  isBoss: false, isSideQuest: false,
  enemies: [{ id: 'mutant', name: '變種人', baseStats: { hp: 60, atk: 15, def: 5, spd: 8 }, skillIds: [], monsterType: 'demon', weakness: 'fire' }],
  expReward: 40, currencyReward: 20,
},
{
  id: '1-2', chapterId: 'ch1', name: '地下水道', stageIndex: 1,
  isBoss: false, isSideQuest: false, unlockCharacterId: 'rex',
  enemies: [
    { id: 'mutant_a', name: '變種人', baseStats: { hp: 60, atk: 15, def: 5, spd: 8 }, skillIds: [], monsterType: 'demon', weakness: 'fire' },
    { id: 'mutant_b', name: '變種人', baseStats: { hp: 60, atk: 15, def: 5, spd: 8 }, skillIds: [], monsterType: 'demon', weakness: 'fire' },
  ],
  // ...unchanged...
},
```

Apply the same single-field addition to every other enemy object in the file, using the element from the assignment table for that id. Boss stages (`1-5`, `2-5`, `3-5`, `4-5`, `5-5`) are **not** touched.

### `scenes/BattleScene.ts`

New private field:

```typescript
private discoveredThisBattle: Set<string> = new Set();
```

Seeded in `init`/`create` (wherever `this.gameState` is first assigned, alongside the existing `this.gameState = data.gameState;` at `scenes/BattleScene.ts:117`):

```typescript
this.discoveredThisBattle = new Set(Object.keys(this.gameState?.discoveredWeaknesses ?? {}));
```

---

## UI Changes

### `updateWeaknessIcon` gating

```typescript
private updateWeaknessIcon(char: Character) {
  const view = this.views.get(char.id);
  if (!view) return;
  const revealed = !!char.weakness && this.discoveredThisBattle.has(char.templateId);
  view.weaknessIcon.setText(revealed ? ELEMENT_ICONS[char.weakness!] : '');
}
```

### Discovery hook in `executePlayerCommand`'s damage path

After computing `dmgResult` (`scenes/BattleScene.ts:659`, `const dmgResult = calcDamage(cmd.character, target, skill, isCrit);`), before calling `applyDamageAndAdvance`:

```typescript
if (dmgResult.isWeaknessHit && target.weakness && !this.discoveredThisBattle.has(target.templateId)) {
  this.discoveredThisBattle.add(target.templateId);
  if (this.gameState) recordWeaknessDiscovery(this.gameState, target.templateId, target.weakness);
  this.enemyParty
    .filter(e => e.templateId === target.templateId)
    .forEach(e => this.updateWeaknessIcon(e));
  this.time.delayedCall(900, () => this.showWeaknessRevealBanner(target.weakness!));
}
```

This fires after the normal damage message's own `900`ms delay clears (matching the boss path's existing sequencing of "damage resolves, then the reveal banner plays"). No change is needed to `showWeaknessRevealBanner` itself — it's reused exactly as written for bosses.

### Boss path: seed `discoveredThisBattle` alongside the existing reveal

In `executeEnemyAction`'s boss-phase branch (`scenes/BattleScene.ts:720`), add one line next to the existing `revealBossWeakness` call so the new gate doesn't hide what the boss banner just announced:

```typescript
if (phase.weaknessOverride) {
  revealBossWeakness(enemy, phase, this.gameState);
  this.discoveredThisBattle.add(enemy.templateId);
  this.updateWeaknessIcon(enemy);
}
```

### Auto-battle AI

```typescript
// runAutoRound, scenes/BattleScene.ts:937
const decision = decideActionWithAwareness(c, this.playerParty, this.enemyParty, this.gameState?.discoveredWeaknesses ?? {});
```

(Replaces the existing `decideAction(c, this.playerParty, this.enemyParty)` call; import `decideActionWithAwareness` from `../battle/SkillAI` alongside the existing `decideAction` import.)

---

## Acceptance Criteria

### Weakness assignment

- **Given** stage `1-1` starts and `mutant`'s `EnemyTemplate.weakness` is `'fire'`
  **When** the enemy `Character` is created via `createEnemy`
  **Then** `enemy.weakness === 'fire'` (already-working `createEnemy` copy behavior, just now exercised with real content).

- **Given** `raider_a` appears in stages `2-1`, `2-2`, `2-3`, and `SQ-2`
  **When** each `EnemyTemplate` object for `raider_a` is inspected
  **Then** all four set `weakness: 'physical'` — no occurrence diverges.

### Discovery on hit (new, non-boss)

- **Given** a fresh battle on stage `1-1` (`mutant`, weakness `fire`, not previously discovered) and `this.discoveredThisBattle` is empty
  **When** the protagonist attacks with `burst_shot` (`fire`) and the hit lands
  **Then** `calcDamage` returns `isWeaknessHit: true`, the damage is 1.5× base, `'mutant'` is added to `discoveredThisBattle`, `recordWeaknessDiscovery(this.gameState, 'mutant', 'fire')` is called, the mutant's weakness icon (`🔥`) appears, and the weakness-reveal banner displays after the damage message clears.

- **Given** the same battle, immediately after the discovery above
  **When** the protagonist attacks the same `mutant` with `burst_shot` again
  **Then** the hit is still 1.5×, but no second banner plays and no duplicate `recordWeaknessDiscovery` call changes the stored value (idempotent — same as the existing `GameState.weakness.test.ts` "recording the same template twice does not duplicate entries" guarantee).

- **Given** a non-weakness hit (e.g. `swift_strike`/`thunder` used against `mutant`, weakness `fire`)
  **When** the attack resolves
  **Then** `isWeaknessHit` is `false`, no entry is added to `discoveredThisBattle`, and the weakness icon stays hidden.

### Discovery persists and carries forward

- **Given** the player has previously discovered `raider_a`'s weakness (`gameState.discoveredWeaknesses['raider_a'] === 'physical'` from an earlier stage clear) and now starts stage `SQ-2` (which also contains `raider_a`)
  **When** the battle scene initializes
  **Then** `discoveredThisBattle` is pre-seeded with `'raider_a'` and that enemy's weakness icon (`⚔`) is visible from the very first frame, with no hit required.

### Same-species reveal within one battle

- **Given** a stage with two `raider_a` instances (e.g. `2-1`, ids `raider_a_1`/`raider_a_2` but both `templateId: 'raider_a'`) and neither previously discovered
  **When** the player lands a `shield_bash` (`physical`) hit on `raider_a_1`
  **Then** both `raider_a_1`'s and `raider_a_2`'s weakness icons appear simultaneously (same `templateId` membership check), even though only the first instance was actually hit.

### Auto-battle uses discovered weaknesses

- **Given** `gameState.discoveredWeaknesses['mech_a'] === 'thunder'` and the player taps "Auto" during a stage `4-1` battle, and a player character with `swift_strike` (`thunder`, off cooldown) is acting
  **When** `runAutoRound` decides that character's action
  **Then** it selects `swift_strike` targeting a `mech_a` enemy in preference to a random/non-elemental choice (via `decideActionWithAwareness`), matching the existing test expectations in `tests/unit/SkillAI.elemental.test.ts`.

### Regression

- **Given** a boss battle (e.g. `vega`, stage `1-5`)
  **When** the existing berserk-phase weakness reveal triggers (per `pixel-squad-boss-phase-weakness.md`)
  **Then** behavior is unchanged end-to-end: the taunt banner, reveal banner, icon, and `gameState.discoveredWeaknesses['vega']` all still work exactly as before — the only addition is `'vega'` also being added to `discoveredThisBattle` so the new icon gate doesn't suppress it.

- **Given** the existing `tests/unit/DamageCalc.weakness.test.ts`, `tests/unit/CharacterFactory.weakness.test.ts`, `tests/unit/GameState.weakness.test.ts`, `tests/unit/BossWeaknessReveal.test.ts`, and `tests/unit/BossConfigs.weaknessOverride.test.ts` suites
  **When** these run unchanged after this spec's implementation
  **Then** they continue to pass — nothing in this spec changes `DamageCalc`, `CharacterFactory`, `BossWeaknessReveal`, or `bossConfigs.ts`.

---

## Backlog Update

This spec surfaces one more pre-existing gap worth tracking separately, found while verifying what's actually wired into `BattleScene` versus only unit-tested in isolation: weakness hits today (boss and general alike) only ever apply the 1.5× damage multiplier. `TurnEngine.applyWeaknessBonus` (bonus action), `Character.knockedDown` (stagger), and all of `battle/AllOutAttack.ts` (the All-Out Attack chain trigger) have no call sites anywhere in `scenes/BattleScene.ts`, so none of that ever fires in an actual playthrough — despite the backlog already marking "連鎖攻擊：連續命中敵人弱點可觸發全體攻擊" as done. A new backlog item is appended to track actually wiring that sequencing into the turn-execution flow.
