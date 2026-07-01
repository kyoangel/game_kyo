# Equipment System — Weapon / Armor Slots + Shop Integration

## Goal

Give every player character a weapon slot and an armor slot that grant persistent flat stat bonuses, purchasable from a new "裝備" shop section and managed from a new equip/unequip screen.

---

## Rules

### Scope decisions

- Only player characters (`isPlayer: true`) can hold equipment. Enemy `Character` instances always have `equipment: {}` and are never shown an equip UI.
- Equipment is managed outside of battle only (base/prep flow), the same restriction that already applies to the skill-scroll shop and level-up allocation. No new `BattlePhase` or `PendingCommand` fields are needed.
- Two slots per character: `weapon` and `armor`. A character can hold at most one item per slot.
- Stat bonuses are flat (not percentage) and limited to `atk`, `def`, `spd` — no `hp` bonus from gear, to avoid the extra complexity of adjusting `maxHp`/current `hp` on equip/unequip. This mirrors how `statGrowth` is flat-additive per level.
- A weapon's `statBonus` is conventionally `{ atk }` (optionally `+spd` for "light" weapons); an armor's is conventionally `{ def }` (optionally `+spd` for "light" armor). Nothing in code enforces this pairing — `EquipmentItem.statBonus` is a free `Partial<{atk,def,spd}>` bag, the convention is just how `data/equipmentItems.ts` content is authored.
- Equipment bonuses are **not** baked into `character.stats` (unlike level-up growth). They are applied live in `battle/Buffs.ts`'s `effectiveAtk`/`effectiveDef`/`effectiveSpd`, the same funnel `DamageCalc` already reads through. This means equipping/unequipping never needs to touch `stats.hp`/`stats.maxHp`/heal logic, and existing damage/heal call sites need zero changes.
- Order of operations in `effectiveStat`: gear flat bonus is added to the raw base stat **before** the existing buff-percentage multiplier and All-Rounder multiplier apply — i.e. gear is treated as a base-stat increase, so a % ATK buff also amplifies a weapon's flat bonus. This is a one-line change to what value gets passed into `effectiveStat`, not a change to `effectiveStat` itself.
- Equipment is **shared inventory**, not per-instance bound items: buying "鐵拳護手 x1" gives the party one unit of that item; equipping it onto a character consumes one unit from `GameState.equipmentInventory` and that same physical unit can't be equipped onto a second character until it's unequipped (returned to inventory) first. Buying two units lets two different characters equip the same weapon simultaneously.
- Equipping a new item into an already-occupied slot swaps: the previously-equipped item (if any) is returned to `equipmentInventory` (quantity +1) before the new item is consumed (quantity -1). This is symmetric with `useSupply`'s existing "remove entry when quantity hits 0" behavior.
- Recruited enemies (`CharacterFactory.enemyToPlayerCharacter`) start with `equipment: {}` — they never owned gear as an enemy.
- New Game+ (`startNewGamePlus`) carries `equipmentInventory` and every character's `equipment` field forward unchanged — it's a plain object spread today (`save/GameState.ts:24`) and already carries `pool`/`inventory` forward the same way, so no code change is needed there.
- `SaveSystem.saveSlot`/`loadSlot` (`save/SaveSystem.ts`) already does whole-object `JSON.stringify`/`JSON.parse` on `GameState` with no field whitelist, so the new `equipmentInventory` field and the new `Character.equipment` field persist automatically — no changes needed to `save/SaveSystem.ts`.

---

## Data Model Changes

### `types.ts`

Add new types (near `ShopItem`/`InventoryEntry`, end of file):

```typescript
export type EquipmentSlot = 'weapon' | 'armor';

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  price: number;
  description: string;
  /** Flat stat bonus while equipped. Applied live via battle/Buffs.ts, never baked into Character.stats. */
  statBonus: Partial<Record<'atk' | 'def' | 'spd', number>>;
}

export interface CharacterEquipment {
  weapon?: EquipmentItem;
  armor?: EquipmentItem;
}

export interface EquipmentInventoryEntry {
  itemId: string;   // EquipmentItem.id
  quantity: number;
}
```

Extend `Character` (`types.ts:66`) with a new required field, defaulting to `{}`:

```typescript
export interface Character {
  // ...existing fields...
  /** Currently equipped weapon/armor, if any. Always {} for enemy characters. */
  equipment: CharacterEquipment;
}
```

Extend `GameState` (`types.ts:194`) with:

```typescript
export interface GameState {
  // ...existing fields...
  equipmentInventory: EquipmentInventoryEntry[]; // owned, currently-unequipped equipment
}
```

### `data/equipmentItems.ts` (new file)

Follows the same flat-array pattern as `data/shopItems.ts`:

```typescript
import type { EquipmentItem } from '../types';

export const EQUIPMENT_ITEMS: EquipmentItem[] = [
  { id: 'weapon_pipe', slot: 'weapon', name: '鋼管', price: 30, description: 'ATK+6', statBonus: { atk: 6 } },
  { id: 'weapon_combat_knife', slot: 'weapon', name: '戰鬥匕首', price: 45, description: 'ATK+8, SPD+2', statBonus: { atk: 8, spd: 2 } },
  { id: 'weapon_sniper_rig', slot: 'weapon', name: '狙擊改裝件', price: 65, description: 'ATK+14', statBonus: { atk: 14 } },
  { id: 'weapon_heavy_cannon', slot: 'weapon', name: '重型加農炮', price: 85, description: 'ATK+20, SPD-2', statBonus: { atk: 20, spd: -2 } },
  { id: 'armor_scrap_vest', slot: 'armor', name: '廢料背心', price: 30, description: 'DEF+6', statBonus: { def: 6 } },
  { id: 'armor_kevlar_plate', slot: 'armor', name: '凱夫拉護甲', price: 50, description: 'DEF+10', statBonus: { def: 10 } },
  { id: 'armor_light_mesh', slot: 'armor', name: '輕量網甲', price: 45, description: 'DEF+5, SPD+3', statBonus: { def: 5, spd: 3 } },
  { id: 'armor_titan_shell', slot: 'armor', name: '泰坦外殼', price: 90, description: 'DEF+16, SPD-3', statBonus: { def: 16, spd: -3 } },
];
```

(Exact prices/names are illustrative and can be tuned; the acceptance criteria only require the mechanics, not these specific values.)

### `battle/CharacterFactory.ts`

`createCharacter`, `createEnemy`, and `enemyToPlayerCharacter` each add `equipment: {}` to the returned object literal (three one-line additions, no other changes to those functions).

### `battle/Buffs.ts`

```typescript
function gearBonus(c: Character, stat: 'atk' | 'def' | 'spd'): number {
  return (c.equipment?.weapon?.statBonus[stat] ?? 0) + (c.equipment?.armor?.statBonus[stat] ?? 0);
}

export function effectiveAtk(c: Character): number {
  const base = effectiveStat(c, 'atk', c.stats.atk + gearBonus(c, 'atk'));
  const hasBurn = c.activeStatusEffects?.some(s => s.type === 'burn');
  return hasBurn ? Math.floor(base * 0.70) : base;
}

export function effectiveDef(c: Character): number {
  return effectiveStat(c, 'def', c.stats.def + gearBonus(c, 'def'));
}

export function effectiveSpd(c: Character): number {
  if (c.activeStatusEffects?.some(s => s.type === 'stun')) return 0;
  return effectiveStat(c, 'spd', c.stats.spd + gearBonus(c, 'spd'));
}
```

Only the `base`/return-expression lines change; `effectiveStat`'s own body (`battle/Buffs.ts:4-8`) is untouched.

### `battle/EquipmentSystem.ts` (new file)

Pure functions, mirroring `battle/ShopSystem.ts`'s style exactly:

```typescript
import type { Character, EquipmentInventoryEntry, EquipmentItem, EquipmentSlot } from '../types';
import { EQUIPMENT_ITEMS } from '../data/equipmentItems';

export function findEquipmentById(itemId: string): EquipmentItem | undefined {
  return EQUIPMENT_ITEMS.find(i => i.id === itemId);
}

export function addEquipmentToInventory(inventory: EquipmentInventoryEntry[], itemId: string): EquipmentInventoryEntry[] {
  const idx = inventory.findIndex(e => e.itemId === itemId);
  if (idx >= 0) {
    const updated = [...inventory];
    updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
    return updated;
  }
  return [...inventory, { itemId, quantity: 1 }];
}

function removeOneFromInventory(inventory: EquipmentInventoryEntry[], itemId: string): EquipmentInventoryEntry[] {
  const idx = inventory.findIndex(e => e.itemId === itemId);
  if (idx < 0) return inventory; // defensive no-op, should not happen via UI
  const newQuantity = inventory[idx].quantity - 1;
  if (newQuantity <= 0) return inventory.filter((_, i) => i !== idx);
  const updated = [...inventory];
  updated[idx] = { ...updated[idx], quantity: newQuantity };
  return updated;
}

/** Equips `item` into its slot on `character`, swapping out any previously-equipped item back into inventory. */
export function equipItem(
  character: Character,
  item: EquipmentItem,
  inventory: EquipmentInventoryEntry[]
): { character: Character; inventory: EquipmentInventoryEntry[] } {
  const previous = character.equipment[item.slot];
  let updatedInventory = removeOneFromInventory(inventory, item.id);
  if (previous) updatedInventory = addEquipmentToInventory(updatedInventory, previous.id);
  const character2: Character = { ...character, equipment: { ...character.equipment, [item.slot]: item } };
  return { character: character2, inventory: updatedInventory };
}

/** Unequips whatever is in `slot` on `character`, returning it to inventory. No-op if the slot is already empty. */
export function unequipItem(
  character: Character,
  slot: EquipmentSlot,
  inventory: EquipmentInventoryEntry[]
): { character: Character; inventory: EquipmentInventoryEntry[] } {
  const current = character.equipment[slot];
  if (!current) return { character, inventory };
  const updatedInventory = addEquipmentToInventory(inventory, current.id);
  const character2: Character = { ...character, equipment: { ...character.equipment, [slot]: undefined } };
  return { character: character2, inventory: updatedInventory };
}
```

### `save/GameState.ts`

`newGame` adds `equipmentInventory: []` to the returned object (one line, alongside the existing `inventory: []`).

---

## UI Changes

### `scenes/ShopScene.ts` — new "裝備" catalog section

`renderList` gains a third section after 補給品, iterating `EQUIPMENT_ITEMS` instead of `SHOP_ITEMS`:

```typescript
const equipLabel = this.add.text(20, y + 4, '裝備', { fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace' });
this.rowObjects.push(equipLabel);
y += 26;
EQUIPMENT_ITEMS.forEach((item) => {
  y = this.renderEquipmentRow(item, y);
});
```

`renderEquipmentRow` is a near-duplicate of `renderRow` (`scenes/ShopScene.ts:67`) but with no eligibility gate beyond affordability (any character can eventually equip any item, unlike skill scrolls which require an empty skill slot) — `canBuy = canAfford(this.gameState.currency, item.price)`. Buying an equipment item does `this.gameState.equipmentInventory = addEquipmentToInventory(this.gameState.equipmentInventory ?? [], item.id); this.gameState.currency -= item.price; saveSlot(this.gameState);` then re-renders, matching the existing supply-purchase branch in `handleBuy` (`scenes/ShopScene.ts:93`).

### New `scenes/EquipmentScene.ts`

A new scene, structurally modeled on `ShopScene`/`BaseScene`'s character-card + picker-panel pattern:

- Header: "裝備", back button to `BaseScene`, currency display (for parity with other base-adjacent screens; no purchases happen here though).
- Lists `gameState.squad` (equipping is squad-only, matching where `PrepScene`/`BaseScene` show actionable character cards — bench characters aren't equip targets until they're in the squad, avoiding a separate bench-equip affordance).
- Each character row shows name/level/archetype, current stats line (existing pattern), and two slot rows:
  - `武器: <item.name or '（無）'>` with a "更換" button.
  - `防具: <item.name or '（無）'>` with a "更換" button.
  - If a slot is filled, an additional small "卸下" button unequips it (calls `unequipItem`, updates state, saves, re-renders).
- Tapping "更換" opens a picker panel (same container/bg/row-button pattern as `ShopScene.showCharacterPicker`) listing every `EquipmentInventoryEntry` in `gameState.equipmentInventory` whose `findEquipmentById(entry.itemId)!.slot` matches the slot being edited, showing `name` + `description` (stat bonus) + `x{quantity}`. Tapping a row calls `equipItem(character, item, gameState.equipmentInventory)`, applies the returned `{character, inventory}` back into `gameState` (via the same `updateCharInState` sync-across-`squad`/`pool`/`lockedSquad` helper already duplicated in `ShopScene`/`BaseScene` — copy it into `EquipmentScene` too, consistent with the existing per-scene duplication rather than introducing a new shared module), sets `gameState.equipmentInventory = result.inventory`, calls `saveSlot(gameState)`, closes the picker, and re-renders.
- If `equipmentInventory` has zero entries matching that slot, the picker still opens but shows a "（無可用裝備，請先至商店購買）" placeholder row instead of an empty panel (avoids a dead/confusing empty picker).
- Entry point: `scenes/BaseScene.ts`'s `renderBaseMode` (`scenes/BaseScene.ts:68`) gains a third button, "裝備", next to the existing 商店/世界地圖 buttons, opening `scene.start('EquipmentScene', { gameState: this.gameState })` (same `saveSlot` guard before transition as the other two buttons).
- `main.ts` registers the new scene alongside the existing scene list.

### Character card stat lines gain equipped-gear indicator

`BaseScene.renderCharCard` (`scenes/BaseScene.ts:195`) and `PrepScene.renderPartyList` (`scenes/PrepScene.ts:69`) both append a short gear summary line under the existing stats line when either slot is filled, e.g. `⚔${weapon.name} 🛡${armor.name}` (omit whichever slot is empty; omit the whole line if both are empty) — purely informational, no interaction added to these two existing screens (equip/unequip stays exclusive to `EquipmentScene`).

---

## Acceptance Criteria

### Data & persistence

- **Given** a fresh save via `newGame(0)`
  **When** the returned `GameState` is inspected
  **Then** `equipmentInventory` is `[]` and the starting protagonist's `equipment` is `{}`.

- **Given** a `GameState` with a non-empty `equipmentInventory` and a squad character with `equipment.weapon` set
  **When** the state round-trips through `saveSlot`/`loadSlot`
  **Then** both `equipmentInventory` and the character's `equipment.weapon` are preserved unchanged (plain JSON round-trip, no new serialization code required).

### Buying equipment

- **Given** `gameState.currency >= EQUIPMENT_ITEMS[0].price` and `gameState.equipmentInventory` has no entry for that item
  **When** the player buys `EQUIPMENT_ITEMS[0]` from the new 裝備 shop section
  **Then** `currency` decreases by the price and `equipmentInventory` gains one entry `{ itemId, quantity: 1 }`.

- **Given** the player already owns one unit of an equipment item
  **When** they buy the same item again
  **Then** the existing `equipmentInventory` entry's `quantity` increments to 2 rather than a duplicate entry being created (mirrors `addToInventory`'s existing increment behavior).

### Equipping / unequipping

- **Given** a character with `equipment.weapon` unset and `equipmentInventory` containing one `weapon_pipe`
  **When** `equipItem(character, weaponPipeItem, inventory)` is called
  **Then** the returned character has `equipment.weapon.id === 'weapon_pipe'` and the returned inventory no longer has a `weapon_pipe` entry (quantity dropped from 1 to 0 and removed).

- **Given** a character already has `weapon_pipe` equipped and `equipmentInventory` contains one `weapon_combat_knife`
  **When** `equipItem(character, weaponCombatKnifeItem, inventory)` is called
  **Then** the returned character's `equipment.weapon.id === 'weapon_combat_knife'`, and the returned inventory has `weapon_pipe` back at quantity 1 with `weapon_combat_knife` consumed (quantity 0 / entry removed).

- **Given** a character has `equipment.armor` set to some item and `equipmentInventory` is `[]`
  **When** `unequipItem(character, 'armor', inventory)` is called
  **Then** the returned character's `equipment.armor` is `undefined` and the returned inventory gains one entry for that item's id at quantity 1.

- **Given** a character has no item equipped in `weapon`
  **When** `unequipItem(character, 'weapon', inventory)` is called
  **Then** it returns the same character and inventory unchanged (no-op, per the documented guard).

### Stat bonuses apply live

- **Given** a character with `stats.atk === 20` and `equipment.weapon.statBonus === { atk: 6 }`, no active buffs, non-全能 archetype
  **When** `effectiveAtk(character)` is called
  **Then** it returns `26`.

- **Given** the same character additionally has an active `+20%` ATK buff
  **When** `effectiveAtk(character)` is called
  **Then** it returns `Math.floor(26 * 1.2) === 31` (gear bonus is added to base before the percentage buff multiplies, not after).

- **Given** a character with `equipment.armor.statBonus === { def: 10 }`
  **When** `calcDamage` is computed against that character with a matching skill
  **Then** the higher `effectiveDef` value reduces the resulting damage exactly as an equivalent flat increase to `stats.def` would (i.e. `calcDamage` needs no changes — it already reads through `effectiveDef`).

- **Given** a character with no `equipment.weapon`/`equipment.armor` set (both `undefined`)
  **When** `effectiveAtk`/`effectiveDef`/`effectiveSpd` are called
  **Then** they return exactly what they returned before this feature (gear bonus contributes `0`), so all existing `Buffs.test.ts`/`DamageCalc.test.ts` assertions keep passing unmodified.

### Enemy/recruit isolation

- **Given** an enemy `Character` created via `createEnemy`
  **When** the instance is inspected
  **Then** `equipment` is `{}` and neither `effectiveAtk`/`effectiveDef`/`effectiveSpd` nor any UI ever attempts to read gear off it beyond the always-safe optional-chained lookups.

- **Given** a recruited enemy converted via `enemyToPlayerCharacter`
  **When** the resulting player `Character` is inspected
  **Then** `equipment` is `{}` (recruits start ungeared, purchasable/equippable like any other roster member from then on).

### Regression

- **Given** the existing test suites `Buffs.test.ts`, `Buffs.statusEffects.test.ts`, `DamageCalc.test.ts`, `DamageCalc.weakness.test.ts`, `DamageCalc.burn.test.ts`, `CharacterFactory.*.test.ts`, `GameState.inventory.test.ts`, `SaveSystem.test.ts`, `ShopSystem.test.ts`
  **When** they run unchanged after this feature's implementation
  **Then** they continue to pass — this feature only adds new optional-chained reads (`c.equipment?.weapon?.statBonus[stat] ?? 0`) to `Buffs.ts` and new fields/files elsewhere, it does not alter any existing behavior when `equipment` is absent or `{}`.

---

## New unit test files (suggested, matching existing naming conventions)

- `EquipmentSystem.test.ts` — `equipItem`/`unequipItem`/`addEquipmentToInventory`/`findEquipmentById` pure-function behavior (swap, no-op unequip, quantity increment/removal).
- `Buffs.equipment.test.ts` — `effectiveAtk`/`effectiveDef`/`effectiveSpd` gear-bonus arithmetic and ordering relative to buffs/archetype, following the pattern of `Buffs.statusEffects.test.ts`.
- `EquipmentItemsData.test.ts` — existence/shape assertions over `EQUIPMENT_ITEMS`, following `ExclusiveItemsData.test.ts`'s pattern (every item has a valid `slot`, positive `price`, non-empty `statBonus`).
- `GameState.equipment.test.ts` — `newGame` initializes `equipmentInventory: []`, following `GameState.inventory.test.ts`'s pattern.
- `CharacterFactory.equipment.test.ts` — `createCharacter`/`createEnemy`/`enemyToPlayerCharacter` all default `equipment: {}`, following `CharacterFactory.weakness.test.ts`'s pattern.
