# Pixel Squad Battle Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ATB/individual-turn battle model with a Command Phase → Execution Phase model, plus Auto-battle mode and keyboard input support.

**Architecture:** Players input all commands upfront (top-to-bottom), then all characters act in SPD order. Auto-battle mode lets AI fill commands each round continuously until the player presses Stop.

**Tech Stack:** Phaser 3, TypeScript, Vite, vitest (unit tests for pure functions only; Phaser scenes verified manually in browser)

**Spec:** `docs/superpowers/specs/2026-06-22-pixel-squad-battle-redesign-design.md`

---

## File Map

| File | Change |
|------|--------|
| `workspace-pixel-squad/src/battle/AI.ts` | Update `chooseTarget()` — default random, add `aiType` param |
| `workspace-pixel-squad/tests/unit/AI.test.ts` | Update tests to match new signature |
| `workspace-pixel-squad/src/types.ts` | Add `BattlePhase`, `PendingCommand` |
| `workspace-pixel-squad/src/scenes/BattleScene.ts` | Full rewrite of battle loop |

Pure functions (`TurnEngine`, `DamageCalc`, `ExpSystem`, `CharacterFactory`, `Archetype`) are **not modified**.

---

## Task 1: Update AI.ts — random default + aiType param

**Files:**
- Modify: `workspace-pixel-squad/src/battle/AI.ts`
- Test: `workspace-pixel-squad/tests/unit/AI.test.ts`

The current `chooseTarget()` always picks the lowest-HP alive character. The spec requires the default to be **random** (so enemies don't always focus the weakest player). Specific enemy types can pass `'lowest-hp'` or `'highest-atk'`.

- [ ] **Step 1: Update the tests first (RED)**

Replace the entire contents of `workspace-pixel-squad/tests/unit/AI.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { chooseTarget } from '../../src/battle/AI';
import type { Character } from '../../src/types';

function makeChar(id: string, hp: number, atk = 10, alive = true): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp, maxHp: 100, atk, def: 5, spd: 10 },
    skills: [], statPoints: 0, archetype: '全能', alive, defending: false,
  };
}

describe('chooseTarget', () => {
  it('default (no aiType) returns an alive character', () => {
    const chars = [makeChar('a', 80), makeChar('b', 30), makeChar('c', 50)];
    const result = chooseTarget(chars);
    expect(result).not.toBeNull();
    expect(result!.alive).toBe(true);
  });

  it('default skips dead characters', () => {
    const chars = [makeChar('dead', 10, 10, false), makeChar('alive', 60)];
    expect(chooseTarget(chars)?.id).toBe('alive');
  });

  it('returns null when all are dead', () => {
    const chars = [makeChar('a', 10, 10, false)];
    expect(chooseTarget(chars)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(chooseTarget([])).toBeNull();
  });

  it('lowest-hp aiType returns the alive character with least HP', () => {
    const chars = [makeChar('a', 80), makeChar('b', 30), makeChar('c', 50)];
    expect(chooseTarget(chars, 'lowest-hp')?.id).toBe('b');
  });

  it('lowest-hp skips dead characters', () => {
    const chars = [makeChar('dead', 5, 10, false), makeChar('alive', 60)];
    expect(chooseTarget(chars, 'lowest-hp')?.id).toBe('alive');
  });

  it('highest-atk aiType returns the alive character with most ATK', () => {
    const chars = [makeChar('a', 50, 20), makeChar('b', 50, 35), makeChar('c', 50, 10)];
    expect(chooseTarget(chars, 'highest-atk')?.id).toBe('b');
  });
});
```

- [ ] **Step 2: Run — verify tests FAIL**

```bash
cd workspace-pixel-squad && npx vitest run tests/unit/AI.test.ts
```

Expected: several failures (`chooseTarget` doesn't accept `aiType` yet).

- [ ] **Step 3: Update AI.ts**

Replace the entire contents of `workspace-pixel-squad/src/battle/AI.ts`:

```typescript
import type { Character } from '../types';

export type EnemyAIType = 'random' | 'lowest-hp' | 'highest-atk';

export function chooseTarget(
  characters: Character[],
  aiType: EnemyAIType = 'random',
): Character | null {
  const alive = characters.filter(c => c.alive);
  if (alive.length === 0) return null;

  if (aiType === 'lowest-hp') {
    return alive.reduce((lowest, c) => (c.stats.hp < lowest.stats.hp ? c : lowest));
  }
  if (aiType === 'highest-atk') {
    return alive.reduce((highest, c) => (c.stats.atk > highest.stats.atk ? c : highest));
  }
  return alive[Math.floor(Math.random() * alive.length)];
}
```

- [ ] **Step 4: Run all unit tests — verify all pass**

```bash
cd workspace-pixel-squad && npx vitest run
```

Expected: 18 existing tests + 7 AI tests = 21 tests pass (4 old AI tests removed, 7 new ones added). Net total 21.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/battle/AI.ts workspace-pixel-squad/tests/unit/AI.test.ts
git commit -m "feat(pixel-squad): update chooseTarget to random default with aiType param"
```

---

## Task 2: Add PendingCommand and BattlePhase to types.ts

**Files:**
- Modify: `workspace-pixel-squad/src/types.ts`

- [ ] **Step 1: Add types**

Add the following at the end of `workspace-pixel-squad/src/types.ts` (after the existing `AllocateSceneData` interface):

```typescript
export type BattlePhase = 'command' | 'executing' | 'auto';

export interface PendingCommand {
  character: Character;
  action: 'attack' | 'skill' | 'defend';
  target?: Character; // undefined for 防禦
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add workspace-pixel-squad/src/types.ts
git commit -m "feat(pixel-squad): add BattlePhase and PendingCommand types"
```

---

## Task 3: BattleScene — Command Phase core

**Files:**
- Modify: `workspace-pixel-squad/src/scenes/BattleScene.ts`

This task replaces `startNewRound` / `processTurn` / `showActionMenu` with the new command-phase system. Target selection (pointer) is wired in Task 4; this task uses a temporary auto-confirm for attack/skill to allow incremental testing.

- [ ] **Step 1: Replace BattleScene.ts with the command-phase skeleton**

Replace the entire contents of `workspace-pixel-squad/src/scenes/BattleScene.ts`:

```typescript
import Phaser from 'phaser';
import type { Character, BattleSceneData, BattlePhase, PendingCommand } from '../types';
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
  private stageIndex = 0;
  private views = new Map<string, CharacterView>();
  private actionMenu!: Phaser.GameObjects.Container;
  private messageText!: Phaser.GameObjects.Text;
  private phase: BattlePhase = 'command';

  // Command phase state
  private pendingCommands = new Map<string, PendingCommand>();
  private commandIndex = 0;
  private commandIcons = new Map<string, Phaser.GameObjects.Text>();

  // Auto mode state
  private stopRequested = false;
  private stopButton?: Phaser.GameObjects.Container;

  // Target selection state
  private targetHighlights = new Map<string, Phaser.GameObjects.Rectangle>();
  private targetSelectActive = false;
  private targetSelectChars: Character[] = [];
  private targetSelectIndex = 0;
  private targetSelectCallback?: (target: Character) => void;

  // Keyboard state
  private keyboardActionIndex = 0;
  private keyboardActions: string[] = [];

  constructor() { super({ key: 'BattleScene' }); }

  init(data: BattleSceneData) {
    this.playerParty = data.playerParty?.length
      ? data.playerParty.map(c => ({ ...c, stats: { ...c.stats, hp: c.stats.maxHp }, alive: true, defending: false }))
      : PLAYER_TEMPLATES.map(t => createCharacter(t, 1));
    this.stageIndex = data.stageIndex ?? 0;
    const stage = STAGES[this.stageIndex];
    this.enemyParty = stage.enemies.map(e => createEnemy(e));
    this.views.clear();
    this.pendingCommands.clear();
    this.commandIcons.clear();
    this.targetHighlights.clear();
    this.phase = 'command';
    this.commandIndex = 0;
    this.stopRequested = false;
    this.targetSelectActive = false;
  }

  create() {
    const W = 360, H = 640;

    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);
    this.add.rectangle(90, H / 2 - 80, 160, 440, 0x1f2937).setAlpha(0.6);
    this.add.rectangle(270, H / 2 - 80, 160, 440, 0x1f2937).setAlpha(0.6);
    this.add.line(W / 2, 240, 0, -220, 0, 220, 0x374151, 0.6).setLineWidth(1);

    this.add.text(W / 2, 16, STAGES[this.stageIndex].name, {
      fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 230, 'VS', {
      fontSize: '20px', color: '#4b5563', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.messageText = this.add.text(W / 2, 508, '', {
      fontSize: '12px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    this.actionMenu = this.add.container(W / 2, 590);

    this.add.line(W / 2, 482, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);
    this.add.line(W / 2, 560, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);

    this.renderParty(this.playerParty, 90, true);
    this.renderParty(this.enemyParty, 270, false);

    this.setupKeyboard();
    this.startCommandPhase();

    (window as unknown as Record<string, unknown>).__getBattleState = () => ({
      playerParty: this.playerParty,
      enemyParty: this.enemyParty,
      stageIndex: this.stageIndex,
    });
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  private renderParty(party: Character[], x: number, isPlayer: boolean) {
    const topY = 40, bottomY = 470;
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

      if (isPlayer) {
        // Command icon placeholder (empty until command set)
        const icon = this.add.text(x + 28, cy - 36, '', {
          fontSize: '11px', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.commandIcons.set(char.id, icon);

        // Tap to revise already-set command
        body.setInteractive({ useHandCursor: true });
        body.on('pointerdown', () => this.onPlayerBodyTap(char, i));
      }
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

  private setCommandIcon(char: Character, action: PendingCommand['action']) {
    const icon = this.commandIcons.get(char.id);
    if (!icon) return;
    icon.setText(action === 'attack' ? '⚔' : action === 'skill' ? '技' : '🛡');
  }

  private clearCommandIcons() {
    this.commandIcons.forEach(icon => icon.setText(''));
  }

  // ─── Command Phase ────────────────────────────────────────────────────────

  private startCommandPhase() {
    this.phase = 'command';
    this.pendingCommands.clear();
    this.commandIndex = 0;
    this.playerParty.forEach(c => { c.defending = false; });
    this.enemyParty.forEach(c => { c.defending = false; });
    this.clearCommandIcons();
    this.advanceCommandInput();
  }

  private advanceCommandInput() {
    // skip dead players
    while (
      this.commandIndex < this.playerParty.length &&
      !this.playerParty[this.commandIndex].alive
    ) {
      this.commandIndex++;
    }
    if (this.commandIndex >= this.playerParty.length) {
      this.startExecution();
      return;
    }
    this.showCommandMenu(this.playerParty[this.commandIndex]);
  }

  private showCommandMenu(character: Character) {
    this.actionMenu.removeAll(true);
    this.waitingForInput = true;

    const isFirstAlive = character === this.playerParty.find(c => c.alive);

    type Entry = { label: string; action: () => void };
    const entries: Entry[] = [];

    if (isFirstAlive) {
      entries.push({ label: '自動', action: () => this.enterAutoMode() });
    }
    entries.push(
      {
        label: '攻擊', action: () => {
          this.actionMenu.removeAll(true);
          this.enterTargetSelection(character, 'attack', this.enemyParty.filter(e => e.alive), (target) => {
            this.confirmCommand({ character, action: 'attack', target });
          });
        }
      },
      {
        label: '技能', action: () => {
          this.actionMenu.removeAll(true);
          this.enterTargetSelection(character, 'skill', this.enemyParty.filter(e => e.alive), (target) => {
            this.confirmCommand({ character, action: 'skill', target });
          });
        }
      },
      { label: '防禦', action: () => this.confirmCommand({ character, action: 'defend' }) },
    );

    this.keyboardActions = entries.map(e => e.label);
    this.keyboardActionIndex = isFirstAlive ? 1 : 0; // default focus: 攻擊

    const btnW = 76;
    const totalW = entries.length * btnW + (entries.length - 1) * 4;
    const startX = -totalW / 2 + btnW / 2;

    entries.forEach(({ label, action }, i) => {
      const bx = startX + i * (btnW + 4);
      const isFocused = i === this.keyboardActionIndex;
      const bg = this.add.rectangle(bx, 0, btnW, 36, isFocused ? 0x4b5563 : 0x374151)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(bx, 0, label, {
        fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      bg.on('pointerdown', () => {
        if (this.phase !== 'command') return;
        action();
      });
      bg.on('pointerover', () => bg.setFillStyle(0x4b5563));
      bg.on('pointerout', () => bg.setFillStyle(isFocused ? 0x4b5563 : 0x374151));
      this.actionMenu.add([bg, txt]);
      (bg as Phaser.GameObjects.Rectangle & { _actionCb: () => void })._actionCb = action;
    });
  }

  private confirmCommand(cmd: PendingCommand) {
    this.pendingCommands.set(cmd.character.id, cmd);
    this.setCommandIcon(cmd.character, cmd.action);
    this.commandIndex++;
    this.advanceCommandInput();
  }

  private onPlayerBodyTap(char: Character, partyIndex: number) {
    if (this.phase !== 'command') return;
    if (!this.pendingCommands.has(char.id)) return; // not yet set, ignore (current flow handles it)
    if (this.targetSelectActive) return; // busy in target selection

    // Revise: remove existing command, restart from this character
    this.pendingCommands.delete(char.id);
    this.setCommandIcon(char, 'defend'); // clear by setting blank — actually clear:
    const icon = this.commandIcons.get(char.id);
    if (icon) icon.setText('');
    this.commandIndex = partyIndex;
    this.actionMenu.removeAll(true);
    this.advanceCommandInput();
  }

  // ─── Target Selection ─────────────────────────────────────────────────────

  private enterTargetSelection(
    _character: Character,
    _action: 'attack' | 'skill',
    targets: Character[],
    onConfirm: (target: Character) => void,
  ) {
    if (targets.length === 0) return; // no valid targets
    this.targetSelectActive = true;
    this.targetSelectChars = targets;
    this.targetSelectIndex = 0;
    this.targetSelectCallback = onConfirm;

    // Highlight all targets
    targets.forEach((t, i) => {
      const view = this.views.get(t.id);
      if (!view) return;
      const highlight = this.add.rectangle(
        view.body.x, view.body.y, 52, 64, 0xf97316, 0,
      ).setStrokeStyle(2, 0xf97316);
      highlight.setAlpha(i === 0 ? 1 : 0.4);
      this.targetHighlights.set(t.id, highlight);

      view.body.setInteractive({ useHandCursor: true });
      view.body.once('pointerdown', () => {
        if (!this.targetSelectActive) return;
        this.confirmTargetSelection(t);
      });
    });
  }

  private confirmTargetSelection(target: Character) {
    this.clearTargetHighlights();
    this.targetSelectActive = false;
    const cb = this.targetSelectCallback;
    this.targetSelectCallback = undefined;
    if (cb) cb(target);
  }

  private cancelTargetSelection() {
    this.clearTargetHighlights();
    this.targetSelectActive = false;
    this.targetSelectCallback = undefined;
    // Re-show command menu for the same character
    this.showCommandMenu(this.playerParty[this.commandIndex]);
  }

  private clearTargetHighlights() {
    this.targetHighlights.forEach(h => h.destroy());
    this.targetHighlights.clear();
    // Remove pointer listeners from enemy bodies
    this.enemyParty.forEach(e => {
      const view = this.views.get(e.id);
      if (view) view.body.removeAllListeners('pointerdown');
    });
  }

  // ─── Execution Phase ──────────────────────────────────────────────────────

  private startExecution() {
    this.phase = 'executing';
    this.actionMenu.removeAll(true);
    const order = computeTurnOrder([...this.playerParty, ...this.enemyParty]);
    this.executeNextInOrder(order, 0);
  }

  private executeNextInOrder(order: Character[], idx: number) {
    // Skip dead characters
    while (idx < order.length && !order[idx].alive) idx++;

    if (idx >= order.length) {
      // Round complete
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

    const current = order[idx];

    if (current.isPlayer) {
      const cmd = this.pendingCommands.get(current.id);
      if (!cmd) {
        this.executeNextInOrder(order, idx + 1);
        return;
      }
      this.executePlayerCommand(cmd, () => {
        if (this.checkBattleEnd()) return;
        this.executeNextInOrder(order, idx + 1);
      });
    } else {
      this.executeEnemyAction(current, () => {
        if (this.checkBattleEnd()) return;
        this.executeNextInOrder(order, idx + 1);
      });
    }
  }

  private executePlayerCommand(cmd: PendingCommand, next: () => void) {
    if (cmd.action === 'defend') {
      cmd.character.defending = true;
      this.showMessage(`${cmd.character.name} 防禦！傷害減半`);
      this.time.delayedCall(900, () => { this.clearMessage(); next(); });
      return;
    }

    // attack or skill — resolve target, retarget if dead
    let target = cmd.target;
    if (!target || !target.alive) {
      const aliveEnemies = this.enemyParty.filter(e => e.alive);
      if (aliveEnemies.length === 0) { next(); return; }
      target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    }

    const skill = cmd.action === 'skill'
      ? cmd.character.skills.find(s => s.type === 'attack')
      : undefined;
    const dmg = calcDamage(cmd.character, target, skill);
    this.applyDamageAndAdvance(cmd.character, target, dmg, skill?.name, next);
  }

  private executeEnemyAction(enemy: Character, next: () => void) {
    const target = chooseTarget(this.playerParty); // default: random
    if (!target) { next(); return; }
    const dmg = calcDamage(enemy, target);
    this.applyDamageAndAdvance(enemy, target, dmg, undefined, next);
  }

  private applyDamageAndAdvance(
    attacker: Character,
    target: Character,
    dmg: number,
    skillName: string | undefined,
    next: () => void,
  ) {
    target.stats.hp = Math.max(0, target.stats.hp - dmg);
    if (target.stats.hp === 0) target.alive = false;
    this.updateHpBar(target);

    const label = skillName ? `【${skillName}】` : '';
    this.showMessage(`${attacker.name}${label} → ${target.name} -${dmg} HP`);

    this.time.delayedCall(900, () => {
      this.clearMessage();
      next();
    });
  }

  private checkBattleEnd(): boolean {
    const playerAlive = this.playerParty.some(c => c.alive);
    const enemyAlive = this.enemyParty.some(c => c.alive);
    if (!playerAlive || !enemyAlive) {
      const victory = !enemyAlive;
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

  // ─── Auto-battle Mode ─────────────────────────────────────────────────────

  private enterAutoMode() {
    this.phase = 'auto';
    this.actionMenu.removeAll(true);
    this.showStopButton();
    this.runAutoRound();
  }

  private runAutoRound() {
    this.pendingCommands.clear();
    this.clearCommandIcons();

    this.playerParty.filter(c => c.alive).forEach(c => {
      const aliveEnemies = this.enemyParty.filter(e => e.alive);
      if (aliveEnemies.length === 0) return;
      const useSkill = Math.random() < 0.5 && c.skills.some(s => s.type === 'attack');
      const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      this.pendingCommands.set(c.id, {
        character: c,
        action: useSkill ? 'skill' : 'attack',
        target,
      });
    });

    const order = computeTurnOrder([...this.playerParty, ...this.enemyParty]);
    this.executeNextInOrder(order, 0);
  }

  private showStopButton() {
    this.stopButton = this.add.container(0, 0);
    const bg = this.add.rectangle(0, 0, 120, 36, 0x7f1d1d)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(0, 0, '■ 停止', {
      fontSize: '14px', color: '#fca5a5', fontFamily: 'monospace',
    }).setOrigin(0.5);
    bg.on('pointerdown', () => { this.stopRequested = true; });
    bg.on('pointerover', () => bg.setFillStyle(0x991b1b));
    bg.on('pointerout', () => bg.setFillStyle(0x7f1d1d));
    this.stopButton.add([bg, txt]);
    this.actionMenu.add(this.stopButton);
  }

  private hideStopButton() {
    if (this.stopButton) {
      this.stopButton.destroy();
      this.stopButton = undefined;
    }
  }

  // ─── Keyboard Input ───────────────────────────────────────────────────────

  // waitingForInput tracks whether command menu is shown (keyboard active)
  private waitingForInput = false;

  private setupKeyboard() {
    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.onKeyLeft());
    kb.on('keydown-RIGHT', () => this.onKeyRight());
    kb.on('keydown-UP', () => this.onKeyUp());
    kb.on('keydown-DOWN', () => this.onKeyDown());
    kb.on('keydown-ENTER', () => this.onKeyEnter());
    kb.on('keydown-ESC', () => this.onKeyEsc());
  }

  private onKeyLeft() {
    if (!this.waitingForInput || this.targetSelectActive) return;
    const children = this.actionMenu.getAll() as Phaser.GameObjects.Rectangle[];
    const btns = children.filter(c => c instanceof Phaser.GameObjects.Rectangle) as Phaser.GameObjects.Rectangle[];
    if (btns.length === 0) return;
    btns[this.keyboardActionIndex]?.setFillStyle(0x374151);
    this.keyboardActionIndex = (this.keyboardActionIndex - 1 + btns.length) % btns.length;
    btns[this.keyboardActionIndex]?.setFillStyle(0x4b5563);
  }

  private onKeyRight() {
    if (!this.waitingForInput || this.targetSelectActive) return;
    const children = this.actionMenu.getAll();
    const btns = children.filter(c => c instanceof Phaser.GameObjects.Rectangle) as Phaser.GameObjects.Rectangle[];
    if (btns.length === 0) return;
    btns[this.keyboardActionIndex]?.setFillStyle(0x374151);
    this.keyboardActionIndex = (this.keyboardActionIndex + 1) % btns.length;
    btns[this.keyboardActionIndex]?.setFillStyle(0x4b5563);
  }

  private onKeyUp() {
    if (!this.targetSelectActive) return;
    this.moveTargetFocus(-1);
  }

  private onKeyDown() {
    if (!this.targetSelectActive) return;
    this.moveTargetFocus(1);
  }

  private moveTargetFocus(delta: number) {
    const prev = this.targetSelectChars[this.targetSelectIndex];
    this.targetHighlights.get(prev.id)?.setAlpha(0.4);
    this.targetSelectIndex = (this.targetSelectIndex + delta + this.targetSelectChars.length) % this.targetSelectChars.length;
    const next = this.targetSelectChars[this.targetSelectIndex];
    this.targetHighlights.get(next.id)?.setAlpha(1);
  }

  private onKeyEnter() {
    if (this.targetSelectActive) {
      const target = this.targetSelectChars[this.targetSelectIndex];
      if (target) this.confirmTargetSelection(target);
      return;
    }
    if (!this.waitingForInput) return;
    // Trigger the focused action button
    const children = this.actionMenu.getAll();
    const btns = children.filter(c => c instanceof Phaser.GameObjects.Rectangle) as Array<Phaser.GameObjects.Rectangle & { _actionCb?: () => void }>;
    btns[this.keyboardActionIndex]?._actionCb?.();
  }

  private onKeyEsc() {
    if (this.targetSelectActive) {
      this.cancelTargetSelection();
      return;
    }
    if (!this.waitingForInput) return;
    // Go back to the previous character's command input
    if (this.commandIndex > 0) {
      // find previous alive player
      let prev = this.commandIndex - 1;
      while (prev > 0 && !this.playerParty[prev].alive) prev--;
      if (this.playerParty[prev]?.alive) {
        const prevChar = this.playerParty[prev];
        this.pendingCommands.delete(prevChar.id);
        const icon = this.commandIcons.get(prevChar.id);
        if (icon) icon.setText('');
        this.commandIndex = prev;
        this.actionMenu.removeAll(true);
        this.advanceCommandInput();
      }
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private showMessage(text: string) { this.messageText.setText(text); }
  private clearMessage() { this.messageText.setText(''); }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run unit tests — still all passing**

```bash
cd workspace-pixel-squad && npx vitest run
```

Expected: 21 tests pass.

- [ ] **Step 4: Manual browser check**

```bash
cd workspace-pixel-squad && npx vite
```

Open `http://localhost:5173`. Verify:
- Battle screen loads
- 命令輸入 shows action menu at bottom for first player character
- First character shows 自動 button
- 攻擊 button opens orange-highlighted enemies for target selection
- Clicking an enemy confirms the command and moves to next character
- After all 3 characters set commands, execution phase runs in SPD order
- 防禦 button confirms immediately without target selection
- After execution, command phase restarts
- Tap 自動 on first character → round executes automatically → 停止 button appears → press 停止 → after round ends, command phase returns

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/scenes/BattleScene.ts
git commit -m "feat(pixel-squad): rewrite BattleScene with command/execution phases and auto-battle mode"
```

---

## Task 4: Fix waitingForInput and keyboard button focus

**Files:**
- Modify: `workspace-pixel-squad/src/scenes/BattleScene.ts`

After Task 3, two issues need fixing: (1) `waitingForInput` is declared after it's used in `showCommandMenu`, and (2) the keyboard button focus highlighting uses `_actionCb` which requires a cast. This task cleans up both.

- [ ] **Step 1: Move `waitingForInput` declaration to top of class**

In `BattleScene.ts`, find:

```typescript
  // ─── Keyboard Input ───────────────────────────────────────────────────────

  // waitingForInput tracks whether command menu is shown (keyboard active)
  private waitingForInput = false;
```

Delete these 3 lines from their current location and add `private waitingForInput = false;` to the class field declarations section at the top (alongside the other `private` fields, after `private targetSelectCallback`):

```typescript
  private targetSelectCallback?: (target: Character) => void;
  private waitingForInput = false;
```

- [ ] **Step 2: Fix showCommandMenu to set waitingForInput**

In `showCommandMenu`, the first line sets `this.waitingForInput = true;` — verify it is already there after Task 3. Also ensure `confirmCommand` and `enterAutoMode` and `enterTargetSelection` set it to false:

Add `this.waitingForInput = false;` as the first line of `enterTargetSelection`, `confirmCommand`, and `enterAutoMode`:

```typescript
  private enterTargetSelection(...) {
    this.waitingForInput = false;
    // ... rest unchanged
  }

  private confirmCommand(cmd: PendingCommand) {
    this.waitingForInput = false;
    // ... rest unchanged
  }

  private enterAutoMode() {
    this.waitingForInput = false;
    // ... rest unchanged
  }
```

- [ ] **Step 3: TypeScript compile check**

```bash
cd workspace-pixel-squad && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
cd workspace-pixel-squad && npx vitest run
```

Expected: 21 tests pass.

- [ ] **Step 5: Commit**

```bash
git add workspace-pixel-squad/src/scenes/BattleScene.ts
git commit -m "fix(pixel-squad): fix waitingForInput placement and target selection state transitions"
```

---

## Task 5: Push and verify CI

**Files:** none (CI verification only)

- [ ] **Step 1: Run full local checks**

```bash
cd workspace-pixel-squad && npx vitest run && npx tsc --noEmit && npx vite build
```

Expected: tests pass, no TS errors, build succeeds with output in `dist/`.

- [ ] **Step 2: Push**

```bash
git push origin master
```

- [ ] **Step 3: Confirm CI passes**

Watch GitHub Actions. The pixel-squad job should:
- Install → unit tests (21 pass) → build → deploy

Expected: green CI.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Command phase: top-to-bottom input | Task 3 `advanceCommandInput` |
| 自動 button on first alive player only | Task 3 `showCommandMenu` |
| 攻擊/技能 → target selection | Task 3 `enterTargetSelection` |
| 防禦 → no target, direct confirm | Task 3 `confirmCommand` |
| Command icons on set characters | Task 3 `setCommandIcon` |
| Tap to revise → continue forward | Task 3 `onPlayerBodyTap` |
| SPD-order execution | Task 3 `startExecution` + `executeNextInOrder` |
| Dead target → random alive enemy | Task 3 `executePlayerCommand` |
| Enemy AI → random alive player | Task 3 `executeEnemyAction` + Task 1 `chooseTarget` |
| Auto mode → AI fills commands | Task 3 `enterAutoMode` / `runAutoRound` |
| 停止 button → stop after round | Task 3 `showStopButton` + `stopRequested` flag |
| Keyboard ←→ action, ↑↓ target | Task 3 `setupKeyboard`, `onKey*` |
| Esc → cancel target / prev char | Task 3 `onKeyEsc` + `cancelTargetSelection` |
| `chooseTarget` default = random | Task 1 |
| `EnemyAIType` for future enemy AI | Task 1 |
| `PendingCommand`, `BattlePhase` types | Task 2 |

No gaps found.

**Placeholder scan:** No TBD/TODO in plan.

**Type consistency:** `PendingCommand` defined in Task 2, used in Task 3 with matching field names (`character`, `action`, `target`). `BattlePhase` values `'command' | 'executing' | 'auto'` consistent throughout Task 3.
