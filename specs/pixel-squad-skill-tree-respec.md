# pixel-squad — 技能樹重置（洗點）道具

## Goal

Add a purchasable, consumable "respec" item that lets the player clear one character's `unlockedSkillNodeIds` and fully refund the skill points they spent, so a misclicked skill-tree allocation is never permanent.

## Context (existing systems this builds on top of)

- `specs/pixel-squad-skill-tree.md` already implemented `Character.skillPoints`, `Character.unlockedSkillNodeIds`, `battle/SkillTree.ts` (`getSkillTree`, `isNodeUnlocked`, `canUnlockNode`, `unlockNode`), and `scenes/SkillTreeScene.ts`. This spec only adds a reset path on top of that — the unlock flow itself is untouched.
- `data/shopItems.ts` / `battle/ShopSystem.ts` already define `ShopItemType = 'skill_scroll' | 'supply'` and a generic `gameState.inventory: InventoryEntry[]` (`{itemId, quantity}[]`) that `ShopScene` buys into and `useSupply` consumes from. The new respec item reuses this same inventory array — it does **not** need a new inventory field.
- `battle/EquipmentSystem.ts` (`addEquipmentToInventory`, private `removeOneFromInventory`) and `battle/ShopSystem.ts` (`addToInventory`) already contain two near-identical implementations of "add/remove one from a `{itemId, quantity}[]` array" — flagged as duplication in a prior meta-review pass. This spec adds a **third** consumer (removing one respec item on use), so it extracts the shared logic into a new `battle/InventoryUtils.ts` instead of writing a fourth copy.

## Rules

1. New `ShopItemType` value `'respec'`. One new `ShopItem` entry (`data/shopItems.ts`) of this type, price `80`, purchased exactly like a `supply` item today (no character picker at purchase time — the target character is chosen later, in `SkillTreeScene`). Export its id as a named constant `RESPEC_ITEM_ID` from `data/shopItems.ts` so scene code never hardcodes the string.
2. `SkillTreeScene`'s detail panel gains a "重置技能" button next to the existing "關閉" button. It is enabled only when **both** hold for the character being viewed:
   - `(character.unlockedSkillNodeIds ?? []).length > 0` (there is something to refund), and
   - `gameState.inventory` contains at least 1 of `RESPEC_ITEM_ID`.
   When either is false, the button renders in the same grey/disabled visual state already used for locked skill nodes and non-affordable shop rows, and is non-interactive.
3. Tapping the enabled button opens a confirm sub-panel (same visual pattern as `ShopScene.showCharacterPicker`'s overlay) showing the character name and the exact skill-point refund amount, with `確定`/`取消` buttons. This avoids accidentally burning a limited consumable on a single misclick.
4. Confirming performs, atomically, in one state update:
   - Consume exactly 1 `RESPEC_ITEM_ID` from `gameState.inventory` (decrement quantity; remove the entry entirely if it reaches 0) — regardless of how many nodes were unlocked. The cost is flat per reset action, not scaled by node count.
   - Set `character.unlockedSkillNodeIds` to `[]`.
   - Increase `character.skillPoints` by the sum of `node.cost` for every node whose `id` was in the character's `unlockedSkillNodeIds` **before** the reset (looked up against `getSkillTree(character.templateId)`).
   - **`character.skills` is left completely unchanged.** This is a deliberate scope limit, not an oversight: `Character.skills` does not track whether a given skill entry came from a skill-tree node or from a shop scroll (`teachSkill` and `unlockNode` both just push the same `Skill` object). Stripping skills on respec would require adding that provenance tracking and risk removing a skill the player separately bought a scroll for. The respec therefore only undoes the **point spend and tree-progress bookkeeping** — any skill already learned stays known. Re-unlocking the same node afterward still costs points again, but per the pre-existing "already known" rule (`pixel-squad-skill-tree.md` rules 4–5), it will never duplicate the skill or count against `MAX_SKILLS_PER_CHARACTER`.
   - Persist via the existing `updateCharInState` + `saveSlot` pattern, then close the confirm panel and re-render the detail panel (all nodes now show their normal locked/unlockable colors — `isNodeUnlocked` recomputes to `false` for all of them since `unlockedSkillNodeIds` is empty).
5. A character with no skill tree (`getSkillTree(templateId)` returns `undefined` — the recruited-enemy placeholder case from `pixel-squad-skill-tree.md` rule 6) never shows the reset button; the `此角色暫無技能樹` placeholder view is unchanged.
6. All new state (decremented `gameState.inventory`, cleared `unlockedSkillNodeIds`, increased `skillPoints`) round-trips through `saveSlot`/`loadSlot` for free via the existing whole-`GameState` JSON serialization — no migration code needed (same as `pixel-squad-skill-tree.md` rule 7).
7. Business logic — the refund calculation and the enable/disable predicate — must live in plain, Phaser-free functions in `battle/SkillTree.ts`, not duplicated inline in `SkillTreeScene`. This lets tests assert real input/output instead of matching scene source text (the pattern explicitly called out as a problem in prior meta-review notes on `BattleScene.aoaWiring.test.ts`).

## Data model changes (`src/types.ts`)

```ts
export type ShopItemType = 'skill_scroll' | 'supply' | 'respec';
// ShopItem itself needs no new fields — name/price/description already suffice,
// and the respec item needs no skillId/healAmount payload.
```

No changes to `Character`, `GameState`, or `InventoryEntry` — the respec item is just another `InventoryEntry` by id, exactly like a supply item.

## Data model changes (`src/data/shopItems.ts`)

```ts
export const RESPEC_ITEM_ID = 'item_respec_module';

export const SHOP_ITEMS: ShopItem[] = [
  // ...existing entries unchanged...
  { id: RESPEC_ITEM_ID, type: 'respec', name: '神經重塑模組', price: 80, description: '重置一名角色的技能樹分配，返還已花費的技能點數' },
];
```

## Code changes

### New file `battle/InventoryUtils.ts`

Generic helpers extracted from the duplicated logic in `ShopSystem.ts` / `EquipmentSystem.ts`:

```ts
export interface QuantityEntry { itemId: string; quantity: number; }

export function addOneToInventory<T extends QuantityEntry>(inventory: T[], itemId: string): T[] {
  const idx = inventory.findIndex(e => e.itemId === itemId);
  if (idx >= 0) {
    const updated = [...inventory];
    updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
    return updated;
  }
  return [...inventory, { itemId, quantity: 1 } as T];
}

export function removeOneFromInventory<T extends QuantityEntry>(inventory: T[], itemId: string): T[] {
  const idx = inventory.findIndex(e => e.itemId === itemId);
  if (idx < 0) return inventory; // defensive no-op, should not happen via UI
  const newQuantity = inventory[idx].quantity - 1;
  if (newQuantity <= 0) return inventory.filter((_, i) => i !== idx);
  const updated = [...inventory];
  updated[idx] = { ...updated[idx], quantity: newQuantity };
  return updated;
}
```

### `battle/ShopSystem.ts`
- `addToInventory` becomes a thin wrapper: `export function addToInventory(inventory: InventoryEntry[], itemId: string): InventoryEntry[] { return addOneToInventory(inventory, itemId); }`. Exported name and signature are unchanged, so no call site (`ShopScene`, tests) needs to change.

### `battle/EquipmentSystem.ts`
- `addEquipmentToInventory` and the private `removeOneFromInventory` become thin wrappers delegating to `InventoryUtils`'s generic versions, same exported name/signature for `addEquipmentToInventory`.

### `battle/SkillTree.ts` (additions)

```ts
import type { Character, InventoryEntry, SkillTreeNode } from '../types';
import { removeOneFromInventory } from './InventoryUtils';

export function calculateRespecRefund(character: Character, tree: SkillTreeNode[]): number {
  const unlockedIds = character.unlockedSkillNodeIds ?? [];
  return tree
    .filter(n => unlockedIds.includes(n.id))
    .reduce((sum, n) => sum + n.cost, 0);
}

export function resetSkillTree(character: Character, tree: SkillTreeNode[]): Character {
  const refund = calculateRespecRefund(character, tree);
  return {
    ...character,
    skillPoints: (character.skillPoints ?? 0) + refund,
    unlockedSkillNodeIds: [],
  };
}

export function canRespec(character: Character, inventory: InventoryEntry[], itemId: string): boolean {
  const hasUnlocked = (character.unlockedSkillNodeIds ?? []).length > 0;
  const owned = inventory.find(e => e.itemId === itemId)?.quantity ?? 0;
  return hasUnlocked && owned > 0;
}

export function respecCharacter(
  character: Character,
  tree: SkillTreeNode[],
  inventory: InventoryEntry[],
  itemId: string
): { character: Character; inventory: InventoryEntry[] } {
  return {
    character: resetSkillTree(character, tree),
    inventory: removeOneFromInventory(inventory, itemId),
  };
}
```

## UI changes

### `scenes/ShopScene.ts`
- `renderList`: add a third section after `裝備`, labelled `特殊道具`, iterating `SHOP_ITEMS.filter(i => i.type === 'respec')` through the existing `renderRow`.
- `handleBuy`: extend the direct-buy branch's condition from `item.type === 'supply'` to `item.type === 'supply' || item.type === 'respec'` (both buy straight into `gameState.inventory` with no picker). The `skill_scroll` branch below is unchanged.
- `renderRow`'s `eligible` computation is unchanged — its `: true` fallback for non-`skill_scroll` types already covers `respec`.

### `scenes/SkillTreeScene.ts`
- Import `resetSkillTree` → `respecCharacter`, `calculateRespecRefund`, `canRespec` from `../battle/SkillTree`, and `RESPEC_ITEM_ID` from `../data/shopItems`.
- Add `private respecConfirmPanel?: Phaser.GameObjects.Container;` alongside the existing `detailPanel` field.
- `showDetailPanel`'s bottom row: replace the single centered `addCloseButton(panel, 190)` call with two side-by-side buttons at `y = 190`:
  - `重置技能` at `x = -65`, width `110` — color `0xb45309` (orange, matches the equipment-orange convention for a "modify build" action) when `canRespec(char, gameState.inventory ?? [], RESPEC_ITEM_ID)` is true, else `0x4b5563` (grey) and non-interactive. Label includes the live refund preview when enabled: `` `重置技能\n(返還${calculateRespecRefund(char, tree)}點)` ``.
  - `關閉` at `x = 65`, width `110` — unchanged behavior, just repositioned.
  - The `getSkillTree(char.templateId) === undefined` placeholder branch keeps its existing single centered `關閉` button — no respec button there (Rule 5).
- New `showRespecConfirm(char, tree)`: overlay container (depth 10, same pattern as `ShopScene.showCharacterPicker`) showing `重置 ${char.name} 的技能樹？\n返還 ${calculateRespecRefund(char, tree)} 點技能點\n消耗 1 個 神經重塑模組`, with `確定` (calls `handleRespecConfirm`) and `取消` (destroys the panel) buttons.
- New `handleRespecConfirm(char, tree)`:
  ```ts
  private handleRespecConfirm(char: Character, tree: SkillTreeNode[]) {
    getSfx(this).play(SFX_KEYS.purchase);
    const result = respecCharacter(char, tree, this.gameState.inventory ?? [], RESPEC_ITEM_ID);
    this.updateCharInState(result.character);
    this.gameState.inventory = result.inventory;
    saveSlot(this.gameState);
    this.respecConfirmPanel?.destroy();
    this.respecConfirmPanel = undefined;
    this.closeDetailPanel();
    this.showDetailPanel(result.character);
  }
  ```

## Acceptance Criteria

- **AC-1**: Given `SHOP_ITEMS` includes the `respec`-type entry with id `RESPEC_ITEM_ID`, when `ShopScene` renders, then a row for it appears under a `特殊道具` section, and buying it (enough currency) deducts `price` from `gameState.currency` and adds 1 to `gameState.inventory` for `RESPEC_ITEM_ID` — the same behavior path as buying a `supply` item today.
- **AC-2**: Given a character with `unlockedSkillNodeIds: ['x_offense_1', 'x_control_1']` where those nodes cost `1` and `1` respectively in their tree, when `calculateRespecRefund` is called, then it returns `2`.
- **AC-3**: Given a character with `skillPoints: 0` and the `unlockedSkillNodeIds` from AC-2, when `resetSkillTree` is applied, then the returned character has `skillPoints === 2`, `unlockedSkillNodeIds === []`, and `skills` is reference-unchanged in content (same skill ids, same length) from before the call.
- **AC-4**: Given `inventory` contains `{ itemId: RESPEC_ITEM_ID, quantity: 1 }`, when `respecCharacter` is called, then the returned `inventory` no longer contains an entry for `RESPEC_ITEM_ID` (it dropped to 0 and was removed), and the returned `character` matches what `resetSkillTree` alone would produce.
- **AC-5**: Given `inventory` contains `{ itemId: RESPEC_ITEM_ID, quantity: 3 }`, when `respecCharacter` is called once, then the returned inventory has `quantity === 2` for that entry (not removed).
- **AC-6**: Given a character with `unlockedSkillNodeIds: []` (nothing to refund) OR `inventory` has no `RESPEC_ITEM_ID` entry, when `canRespec` is called, then it returns `false`; given both conditions are satisfied (≥1 unlocked node and ≥1 owned item), it returns `true`.
- **AC-7**: Given a character whose `skills` includes a skill also mapped to one of their currently-unlocked tree nodes, when `resetSkillTree` runs, then that skill entry remains present in `character.skills` afterward (skills are never removed by a respec — Rule 4).
- **AC-8 (regression)**: After extracting `battle/InventoryUtils.ts`, `ShopSystem.addToInventory` and `EquipmentSystem.addEquipmentToInventory` behave identically to before (same exported signatures, same call sites) — the full existing test suite passes unchanged.
- **AC-9**: Given a character's post-respec `skillPoints`/`unlockedSkillNodeIds` and `gameState.inventory` after consuming a respec item, when round-tripped through `saveSlot` then `loadSlot`, then all three values are unchanged.

## Test plan (new/updated files)

- `tests/unit/InventoryUtils.test.ts` — `addOneToInventory` (new entry, increment existing) and `removeOneFromInventory` (decrement, remove-at-zero, no-op when item absent).
- `tests/unit/SkillTree.respec.test.ts` — `calculateRespecRefund` (AC-2), `resetSkillTree` (AC-3, AC-7), `canRespec` (AC-6), `respecCharacter` (AC-4, AC-5).
- `tests/unit/ShopSystem.test.ts` / `tests/unit/EquipmentSystem.test.ts` — no behavioral changes expected; run as-is to confirm the `InventoryUtils` extraction didn't break them (AC-8).
- `tests/unit/ShopData.respec.test.ts` — `SHOP_ITEMS` contains exactly one `type === 'respec'` entry, its `id` matches the exported `RESPEC_ITEM_ID`, and `price > 0`.
- `tests/unit/SaveSystem.skillTreeRespec.test.ts` — AC-9 (JSON round-trip of `inventory` quantity and the reset character fields together).
- No new Phaser-scene test file is required: `canRespec`/`calculateRespecRefund` being plain functions (Rule 7) means the enable/disable behavior of the "重置技能" button is already fully covered by `SkillTree.respec.test.ts` without needing source-text matching against `SkillTreeScene.ts`.
