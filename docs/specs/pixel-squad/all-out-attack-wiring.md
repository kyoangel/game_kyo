# All-Out Attack — BattleScene Wiring

## Goal

Wire the already-implemented `AllOutAttack.ts` and `TurnEngine.applyWeaknessBonus` into `BattleScene`'s turn-execution loop so that a weakness hit sets `knockedDown` on the target, grants the attacker a bonus action, and—when every alive non-boss enemy is knocked down—interrupts execution to show an All-Out Attack prompt.

---

## Rules

### Current state (context, not part of this feature)

- All the business logic is already built and unit-tested in isolation. `battle/AllOutAttack.ts` exports `canKnockDown`, `allEnemiesKnockedDown`, `shouldTriggerAoa`, `calcAoaDamage`, `applyAllOutAttack`, `resetAoaRoundState`, and `AoaRoundState`. `battle/TurnEngine.ts` exports `applyWeaknessBonus`, `resetRoundFlags`, and `insertBonusAction`. The `BattlePhase` union in `types.ts:168` already includes `'all-out-attack-prompt'`.
- Zero call sites exist in `scenes/BattleScene.ts` for any of the above. `executePlayerCommand` computes `dmgResult.isWeaknessHit` (line 663) but does nothing with it beyond the discovery banner. `target.knockedDown` is never set. `applyWeaknessBonus` is never called. `shouldTriggerAoa` is never called. The `'all-out-attack-prompt'` phase is never assigned.
- The existing execution model is index-based: `executeNextInOrder(order: Character[], idx: number)` iterates by incrementing `idx`. This cannot support `applyWeaknessBonus`'s `unshift` contract, which requires a **mutable queue array** representing remaining turns. The refactor to queue-based execution is the main structural change this spec prescribes.
- `startCommandPhase` (`scenes/BattleScene.ts:301`) does not call `resetRoundFlags` or `resetAoaRoundState`, so `knockedDown` and `bonusActionUsed` flags are never cleared between rounds.

### Weakness hit → knockdown

- After a player attack resolves, if `dmgResult.isWeaknessHit` is true **and** the target survived (`hpAfterHit > 0`) **and** `canKnockDown(target)` returns true (i.e. the enemy is not a boss), set `target.knockedDown = true`.
- If the weakness hit kills the target (`hpAfterHit <= 0`), do **not** set `knockedDown`. `applyWeaknessBonus` already guards this case (it skips bonus-action when `defenderHpAfterHit <= 0`), so both flags are consistent.
- Bosses (`_monsterType === 'boss'`) are immune to knockdown: `canKnockDown` returns false, `knockedDown` is never set, and AOA can therefore never trigger while a boss is alive — `allEnemiesKnockedDown` returns false because the boss is never knocked down.

### Bonus action

- Immediately after the knockdown check, call `applyWeaknessBonus(cmd.character, hpAfterHit, dmgResult.isWeaknessHit, queue)`. This `unshift`s the attacker to the front of the remaining `queue` when all conditions are met (weakness hit, target survived, `bonusActionUsed` not already set). `applyWeaknessBonus` itself handles all guards — callers need no additional if-blocks.
- Each character earns at most one bonus action per round (`bonusActionUsed` flag). If a character uses their bonus action to land another weakness hit, they do **not** get a third turn; `applyWeaknessBonus` skips when `bonusActionUsed` is already true.
- Bonus actions and knockdown flags are reset at the start of each command phase via `resetRoundFlags([...this.playerParty, ...this.enemyParty])`.

### AOA trigger

- After every action (player or enemy) resolves and before the next queue entry executes, check `shouldTriggerAoa(this.enemyParty, this.aoaState)`. If it returns true, interrupt the queue and show the AOA prompt — do **not** advance to the next character yet.
- `shouldTriggerAoa` already handles all preconditions: no alive enemies, boss blocking, `usedThisRound` flag.

### AOA confirm path

- Player taps 「確認」:
  1. `applyAllOutAttack(this.playerParty, this.enemyParty)` is called. This reduces HP of all alive enemies simultaneously; it does not set `alive = false`.
  2. For every enemy whose `stats.hp <= 0` after the call, set `alive = false` and play their die animation.
  3. Update all enemy HP bars.
  4. Show a brief message "⚡ 全體攻擊！".
  5. `this.aoaState.usedThisRound = true`.
  6. After `1200ms`, call `this.checkBattleEnd()`. If the battle is over, stop. Otherwise resume `executeNextInQueue(queue)`.

### AOA decline path

- Player taps 「放棄」:
  1. `this.aoaState.usedThisRound = true` — AOA will not re-trigger this round even if another weakness hit later knocks down remaining enemies.
  2. The current `knockedDown` flags on enemies are **not** cleared by decline — they remain until the next round's `resetRoundFlags` call.
  3. Resume `executeNextInQueue(queue)` immediately.

### Round reset

- `startCommandPhase` must call `resetRoundFlags([...this.playerParty, ...this.enemyParty])` and `resetAoaRoundState(this.aoaState)` before proceeding to `advanceCommandInput`. This clears `knockedDown`, `bonusActionUsed`, and `aoaState.usedThisRound` for every new round.

### Scene active guard

- All `this.time.delayedCall(...)` callbacks that read or modify scene state (HP bars, weakness banners, AOA results) must start with `if (!this.scene.isActive()) return`. If a hit kills the last enemy, `checkBattleEnd` transitions to ResultScene; any pending `delayedCall` (e.g. `showWeaknessRevealBanner`) will fire on the now-inactive scene and must bail out immediately.

### Stagger visual on knockdown

- On knockdown, call `targetView.animator.playHit(false, () => {})` on the target (existing non-crit hit reaction: flash + shake). This is non-blocking — normal turn timing continues. No new animation primitives are needed.
- Show a brief centered banner "↓ STAGGER!" at depth 20, auto-destroyed after 800ms.

### AOA visual

1. Show a centered banner "⚡ ALL-OUT ATTACK!" (`color: '#fbbf24'`, `depth: 20`, `backgroundColor: '#111827'`, auto-destroyed after 1000ms).
2. Simultaneously play `playSkillCast('white', () => {})` on every alive player character (non-blocking).
3. Play `getSfx(this).play(SFX_KEYS.crit)` as the impact sound.
4. Apply damage, update HP bars, trigger die animations.
5. Show message "全體攻擊！" for 1200ms then clear and resume.

---

## Data Model Changes

### `BattleScene.ts` — new private field

```typescript
private aoaState: AoaRoundState = { usedThisRound: false };
```

Import `AoaRoundState` from `'../battle/AllOutAttack'`.

### `BattleScene.ts` — `init()` reset

Inside `init()`, after all the existing resets (line ~133), add:

```typescript
this.aoaState = { usedThisRound: false };
```

### No type changes

`types.ts` already contains `BattlePhase` with `'all-out-attack-prompt'`, `Character.knockedDown?: boolean`, `Character.bonusActionUsed?: boolean`. No new types are required.

---

## UI Changes

### `BattleScene.ts` — new imports

```typescript
import {
  canKnockDown,
  shouldTriggerAoa,
  applyAllOutAttack,
  resetAoaRoundState,
  type AoaRoundState,
} from '../battle/AllOutAttack';
import {
  computeTurnOrder,
  applyWeaknessBonus,
  resetRoundFlags,
} from '../battle/TurnEngine';
```

(`computeTurnOrder` is already imported; `applyWeaknessBonus` and `resetRoundFlags` are new.)

### `BattleScene.ts` — `startCommandPhase()` (line 301)

Add at the top of the method body, before `this.pendingCommands.clear()`:

```typescript
resetRoundFlags([...this.playerParty, ...this.enemyParty]);
resetAoaRoundState(this.aoaState);
```

### `BattleScene.ts` — replace `startExecution()` and `executeNextInOrder`

**`startExecution()`** — replace the `computeTurnOrder` + index call with a queue call:

```typescript
private startExecution() {
  this.phase = 'executing';
  this.actionMenu.removeAll(true);
  const queue = computeTurnOrder([...this.playerParty, ...this.enemyParty]);
  this.executeNextInQueue(queue);
}
```

**Rename and rewrite `executeNextInOrder(order, idx)` → `executeNextInQueue(queue: Character[])`**:

```typescript
private executeNextInQueue(queue: Character[]) {
  // Drain dead entries from the front
  while (queue.length > 0 && !queue[0].alive) queue.shift();

  if (queue.length === 0) {
    this.time.delayedCall(400, () => {
      if (this.phase === 'auto') {
        if (this.stopRequested) {
          this.stopRequested = false;
          this.hideStopButton();
          this.startCommandPhase();
        } else {
          this.runAutoRound();
        }
      } else {
        this.startCommandPhase();
      }
    });
    return;
  }

  const current = queue.shift()!;

  const frozen = current.activeStatusEffects?.some(s => s.type === 'freeze');
  if (frozen) {
    this.showMessage(`${current.name} 被凍結，跳過回合！`);
    this.time.delayedCall(600, () => {
      this.clearMessage();
      this.executeNextInQueue(queue);
    });
    return;
  }

  const afterAction = () => {
    if (this.checkBattleEnd()) return;
    if (shouldTriggerAoa(this.enemyParty, this.aoaState)) {
      this.showAoaPrompt(() => this.executeNextInQueue(queue));
      return;
    }
    this.executeNextInQueue(queue);
  };

  if (current.isPlayer) {
    const cmd = this.pendingCommands.get(current.id);
    if (!cmd) { this.executeNextInQueue(queue); return; }
    this.executePlayerCommand(cmd, queue, afterAction);
  } else {
    this.executeEnemyAction(current, afterAction);
  }
}
```

### `BattleScene.ts` — update `executePlayerCommand` signature and body

Change signature to receive the queue:

```typescript
private executePlayerCommand(cmd: PendingCommand, queue: Character[], next: () => void) {
```

In the damage path (after `const dmgResult = calcDamage(...)`), insert between the existing `recordHitDiscovery` call and the `applyDamageAndAdvance` call:

```typescript
const hpAfterHit = Math.max(0, target.stats.hp - dmgResult.damage);

// Knockdown stagger
if (dmgResult.isWeaknessHit && hpAfterHit > 0 && canKnockDown(target)) {
  target.knockedDown = true;
  const targetView = this.views.get(target.id);
  if (targetView) targetView.animator.playHit(false, () => {});
  this.showStaggerBanner(target);
}

// Bonus action
applyWeaknessBonus(cmd.character, hpAfterHit, dmgResult.isWeaknessHit, queue);
```

The `applyDamageAndAdvance` call signature and body are **unchanged** — it still receives `next` and calls it after its own delay.

The existing `recordHitDiscovery` + weakness-reveal-banner block (lines 663–669) is **not moved** — it stays exactly where it is now, just before these new lines.

Also add the scene-active guard to the existing `delayedCall` for the weakness reveal banner on line 668:

```typescript
this.time.delayedCall(900, () => {
  if (!this.scene.isActive()) return;
  this.showWeaknessRevealBanner(target.weakness!);
});
```

### `BattleScene.ts` — `runAutoRound()` (line 964)

`runAutoRound` calls `this.executeNextInOrder(order, 0)` at its end. Replace with:

```typescript
const queue = computeTurnOrder([...this.playerParty, ...this.enemyParty]);
this.executeNextInQueue(queue);
```

### `BattleScene.ts` — new `private showStaggerBanner(target: Character)`

```typescript
private showStaggerBanner(target: Character) {
  const view = this.views.get(target.id);
  if (!view) return;
  const W = 360;
  const banner = this.add.text(W / 2, 160, '↓ STAGGER!', {
    fontSize: '13px', color: '#facc15', fontFamily: 'monospace',
    backgroundColor: '#111827', padding: { x: 10, y: 6 },
  }).setOrigin(0.5).setDepth(20);
  this.time.delayedCall(800, () => { if (banner.active) banner.destroy(); });
}
```

### `BattleScene.ts` — new `private showAoaPrompt(onDone: () => void)`

```typescript
private showAoaPrompt(onDone: () => void) {
  this.phase = 'all-out-attack-prompt';
  this.actionMenu.removeAll(true);
  const W = 360;

  const banner = this.add.text(W / 2, 150, '⚡ ALL-OUT ATTACK!', {
    fontSize: '15px', color: '#fbbf24', fontFamily: 'monospace',
    backgroundColor: '#111827', padding: { x: 12, y: 8 },
  }).setOrigin(0.5).setDepth(20);
  this.time.delayedCall(1000, () => { if (banner.active) banner.destroy(); });

  const confirmBtn = this.add.rectangle(-44, 0, 80, 36, 0x15803d)
    .setInteractive({ useHandCursor: true });
  const confirmTxt = this.add.text(-44, 0, '確認', {
    fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace',
  }).setOrigin(0.5);

  const declineBtn = this.add.rectangle(44, 0, 80, 36, 0x7f1d1d)
    .setInteractive({ useHandCursor: true });
  const declineTxt = this.add.text(44, 0, '放棄', {
    fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace',
  }).setOrigin(0.5);

  this.actionMenu.add([confirmBtn, confirmTxt, declineBtn, declineTxt]);

  const cleanup = () => { this.actionMenu.removeAll(true); };

  confirmBtn.once('pointerdown', () => {
    if (this.phase !== 'all-out-attack-prompt') return;
    getSfx(this).play(SFX_KEYS.crit);
    cleanup();

    // Flash all alive player characters
    this.playerParty.filter(m => m.alive).forEach(m => {
      this.views.get(m.id)?.animator.playSkillCast('white', () => {});
    });

    applyAllOutAttack(this.playerParty, this.enemyParty);

    // Post-damage: set alive=false, update bars, play die anims
    this.enemyParty.forEach(e => {
      if (e.stats.hp <= 0) {
        e.alive = false;
        this.views.get(e.id)?.animator.playDie('left', () => {});
      }
      this.updateHpBar(e);
    });

    this.aoaState.usedThisRound = true;
    this.phase = 'executing';
    this.showMessage('⚡ 全體攻擊！');

    this.time.delayedCall(1200, () => {
      if (!this.scene.isActive()) return;
      this.clearMessage();
      if (this.checkBattleEnd()) return;
      onDone();
    });
  });

  declineBtn.once('pointerdown', () => {
    if (this.phase !== 'all-out-attack-prompt') return;
    getSfx(this).play(SFX_KEYS.buttonClick);
    cleanup();
    this.aoaState.usedThisRound = true;
    this.phase = 'executing';
    onDone();
  });
}
```

---

## Acceptance Criteria

### AC-1 — Knockdown on weakness hit (enemy survives)

**Given** a player uses an elemental skill whose `element` matches `target.weakness`, and the target's HP after taking damage is > 0, and `target._monsterType !== 'boss'`.
**When** `executePlayerCommand` resolves the attack.
**Then** `target.knockedDown === true` and a stagger banner appears briefly.

### AC-2 — No knockdown when weakness hit kills the target

**Given** a player's weakness hit reduces the target's HP to exactly 0.
**When** the attack resolves.
**Then** `target.knockedDown` is not set (remains `undefined`/`false`) and no stagger banner appears.

### AC-3 — No knockdown for bosses

**Given** a player hits a boss enemy's `weakness` element.
**When** the attack resolves.
**Then** `boss.knockedDown` remains `false`/`undefined`, no stagger banner appears, and `shouldTriggerAoa` returns false.

### AC-4 — Bonus action on weakness hit (enemy survives)

**Given** a player hits an enemy's weakness and the enemy survives.
**When** the attack resolves (damage animation completes and `next` fires).
**Then** the attacker appears as the next character in the remaining turn queue, acting again before any other pending characters.

### AC-5 — No second bonus action per round

**Given** a player character already has `bonusActionUsed === true` this round.
**When** they land another weakness hit during their bonus turn.
**Then** `applyWeaknessBonus` does not insert the character again; the queue length is unchanged.

### AC-6 — AOA prompt when all alive enemies knocked down

**Given** a player's weakness hit sets `knockedDown = true` on the last remaining alive non-boss enemy.
**When** `afterAction` checks `shouldTriggerAoa` after the attack resolves.
**Then** `this.phase === 'all-out-attack-prompt'` and the 「確認」/「放棄」buttons are rendered.

### AC-7 — AOA executes on confirm

**Given** the AOA prompt is showing.
**When** the player taps 「確認」.
**Then** `applyAllOutAttack(playerParty, enemyParty)` is called, all enemy HP bars are updated, enemies with `stats.hp <= 0` have `alive = false`, and die animations play.

### AC-8 — Battle ends normally after AOA kills all enemies

**Given** the AOA prompt fires and the player taps 「確認」, and all enemies die from AOA damage.
**When** the `1200ms` delay fires.
**Then** `checkBattleEnd()` returns true and `ResultScene` is started with `victory: true`.

### AC-9 — AOA decline: execution resumes, no re-trigger this round

**Given** the AOA prompt is showing.
**When** the player taps 「放棄」.
**Then** `aoaState.usedThisRound` becomes true, the phase returns to `'executing'`, and subsequent weakness hits this round do not re-trigger the prompt.

### AC-10 — Round reset clears knockdown, bonus action, and AOA state

**Given** a round ended with some enemies having `knockedDown = true` and some players having `bonusActionUsed = true`, and `aoaState.usedThisRound = true`.
**When** `startCommandPhase()` fires.
**Then** every character has `knockedDown === false` and `bonusActionUsed === false`, and `aoaState.usedThisRound === false`.

### AC-11 — AOA triggers again in a new round after prior-round decline

**Given** the player declined AOA in round N.
**When** round N+1 begins and a weakness hit knocks all enemies down.
**Then** the AOA prompt appears again.

### AC-12 — Scene active guard prevents stale-scene crashes

**Given** a weakness hit kills the last alive enemy (triggering `checkBattleEnd` → scene transition) and a `delayedCall` for `showWeaknessRevealBanner` is pending.
**When** the callback fires after the scene has transitioned.
**Then** `if (!this.scene.isActive()) return` prevents any scene-object access and no error is thrown.

### AC-13 — Bonus action inserts into queue (not a new round)

**Given** turn order is `[A, B, Enemy]` and A lands a weakness hit against a surviving enemy.
**When** `applyWeaknessBonus` is called.
**Then** the queue becomes `[A, B, Enemy]` → `[A, B, Enemy]` with A unshifted before B, i.e. `[A, B, Enemy]`. Specifically: the queue after A's turn is `[B, Enemy]`; after `applyWeaknessBonus`, it becomes `[A, B, Enemy]`, so A acts next, then B, then Enemy.

### AC-14 — Existing unit tests pass unchanged

**Given** the test suites for `AllOutAttack.*`, `TurnEngine.bonusAction.*`, `WeaknessDiscovery.*`, and all related tests.
**When** they run after this implementation.
**Then** all pass without modification — no business logic in those modules changes; only `BattleScene` adds call sites.

---

## New Tests Required

### `tests/unit/BattleScene.aoaWiring.test.ts`

Because `BattleScene` is a Phaser scene and cannot be instantiated in a Node test environment, the AOA wiring integration cannot be unit-tested directly. All individual engine functions are already covered:

- `AllOutAttack.damage.test.ts` — `calcAoaDamage`, `applyAllOutAttack`
- `AllOutAttack.knockdown.test.ts` — `canKnockDown`, `allEnemiesKnockedDown`
- `AllOutAttack.trigger.test.ts` — `shouldTriggerAoa`
- `AllOutAttack.roundState.test.ts` — `resetAoaRoundState`
- `TurnEngine.bonusAction.test.ts` — `applyWeaknessBonus`, `resetRoundFlags`, `insertBonusAction`

**Required new test: `tests/unit/BattleScene.sceneGuard.test.ts`** — extract `showWeaknessRevealBanner`'s guard condition into a pure helper and test it:

Since the actual guard is an inline `if (!this.scene.isActive()) return` in a Phaser callback, this AC is verified by code review of the implementation (the guard must be present at each `delayedCall` callback site) rather than a unit test. The spec requires the guard to appear at:
1. The existing weakness reveal `delayedCall` in `executePlayerCommand` (line ~668).
2. The `1200ms` AOA confirm result `delayedCall` in `showAoaPrompt`.

**Note**: If at a future point BattleScene is refactored to separate pure state-update helpers from Phaser-side effects, those helpers would become directly testable. For now, integration is verified by manual playthrough.
