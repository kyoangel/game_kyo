# Spec: 廢土幣商店（買技能 / 補給品）

## Goal

Let players spend `currency` ("廢土幣") at a new shop screen to teach skill scrolls to characters that lack skills and to buy consumable supplies that heal squad members outside of battle.

## Current state (for context)

- `GameState.currency` (`src/types.ts:156`) already accrues from `Stage.currencyReward` via `VictoryProcessor.ts:32` and is displayed in `BaseScene.ts:35` (`幣:${gameState.currency}`) and `WorldMapScene.ts:55` — it has no sink today; it only ever goes up.
- `src/data/skills.ts` defines 6 skills (`burst_shot`, `shield_bash`, `swift_strike`, `field_medic`, `combat_stim`, `iron_will`). Several non-protagonist `CharacterTemplate`s in `src/data/characters.ts` ship with `skillIds: []` (`crow`, `zora`, `rook`, `dex`, `echo`, `aaaa`) — these characters can never use the `技能` command in battle today.
- `BaseScene.ts` has two modes: `renderBaseMode()` (free roam — squad edit, level-up, "世界地圖" button) and `renderInChapterMode()` (squad locked mid-chapter-run, only "繼續"/"放棄本章"). `renderBaseMode()` is the only place where currency-spending UI should be reachable, matching the existing restriction that squad edits (`toggleSquad`) are also base-mode-only.
- `BaseScene.updateCharInState(updated)` (`src/scenes/BaseScene.ts:209`) is the existing pattern for writing a mutated `Character` back into `gameState.squad`, `gameState.pool`, and (if present) `gameState.stageProgress.inChapterRun.lockedSquad` — any code that mutates a character outside battle should reuse this exact propagation, not invent a new one.
- `SaveSystem.loadSlot()` (`src/save/SaveSystem.ts:18`) does a raw `JSON.parse` cast with no migration step — any new required `GameState` field must be defensively defaulted wherever it's read, since existing saved slots won't have it.
- No consumable/inventory concept exists anywhere in the codebase today (confirmed via search for `currency|inventory|item` across `src/`).
- Pure-logic modules with no `Math.random()`/Phaser dependency already exist for this kind of system (`RecruitSystem.ts`, `ExpSystem.ts`, `LevelUpSystem.ts`) — this spec follows the same pattern with a new `ShopSystem.ts`.

## Rules

### Shop catalog (static, no rotation/stock limits)

Two `ShopItemType`s: `skill_scroll` and `supply`. Catalog lives in a new `src/data/shopItems.ts`, exported as `SHOP_ITEMS: ShopItem[]`.

| id | type | name | price | effect |
|---|---|---|---|---|
| `scroll_burst_shot` | skill_scroll | 爆發射擊卷軸 | 40 | teaches `burst_shot` |
| `scroll_shield_bash` | skill_scroll | 盾擊卷軸 | 35 | teaches `shield_bash` |
| `scroll_swift_strike` | skill_scroll | 迅捷突刺卷軸 | 38 | teaches `swift_strike` |
| `scroll_field_medic` | skill_scroll | 戰地醫療卷軸 | 60 | teaches `field_medic` |
| `scroll_combat_stim` | skill_scroll | 戰鬥興奮劑卷軸 | 55 | teaches `combat_stim` |
| `scroll_iron_will` | skill_scroll | 鋼鐵意志卷軸 | 55 | teaches `iron_will` |
| `supply_medkit_s` | supply | 小型醫療包 | 25 | heals 50 HP |
| `supply_medkit_l` | supply | 大型醫療包 | 70 | heals 150 HP |

Prices and heal amounts are fixed game-design numbers, not derived from anything — adjustable later by editing the table, no formula needed.

### Skill scrolls

- Every character (protagonist included) has a skill cap: `MAX_SKILLS_PER_CHARACTER = 3` (new constant in `ShopSystem.ts`). This exists purely to stop one character from eventually learning all 6 catalog skills and trivializing the `技能` submenu/AI decision logic added by the skill-effects spec — 3 keeps the skill-picker submenu (added for `skills.length > 1`) meaningfully small.
- A character is **eligible** to learn a given scroll's skill iff: `character.skills.length < MAX_SKILLS_PER_CHARACTER` AND the character does not already have a skill with that `id` in `character.skills`.
- Eligibility is checked over `gameState.pool` (every unlocked character, squad or bench) — teaching is not restricted to the active squad.
- Buying a scroll is a two-step flow: pick the scroll → pick an eligible character to teach. **Currency is only deducted once a target character is confirmed** — backing out of the character picker without confirming spends nothing.
- If zero characters in `gameState.pool` are eligible for a scroll's skill, that scroll's 購買 button is disabled (greyed, non-interactive) regardless of currency — there is nothing to buy.
- Teaching appends the skill object (looked up from `SKILLS` in `src/data/skills.ts` by `skillId`) to the end of `character.skills`. No reordering, no replacing existing skills.
- This is a permanent, one-time consumption: there is no scroll inventory — a bought scroll is immediately resolved into "skill taught to character X" and forgotten. (Differs from `supply`, which is stored — see below.)

### Supplies

- Buying a supply item is single-step: deduct currency immediately, increment that item's quantity in `gameState.inventory`. No target selection at purchase time.
- `gameState.inventory: InventoryEntry[]` — sparse list, one entry per item id ever bought, `{ itemId, quantity }`. Buying an item already in inventory increments `quantity`; buying one not yet present appends a new entry with `quantity: 1`.
- Supplies are **used** later, from `BaseScene`'s base mode, by selecting an inventory entry then a target squad member. Using one: clamps `target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + item.healAmount)`, decrements `quantity` by 1, and removes the entry from `gameState.inventory` entirely if `quantity` reaches 0.
- A supply can only target a character that is `alive === true` and currently below `maxHp` (`stats.hp < stats.maxHp`) — no overheal, no reviving the dead (consistent with the skill-effects spec's "no revive mechanic in this spec" rule for `field_medic`). If no squad member qualifies, that inventory entry's "使用" affordance is disabled.
- Using a supply targets `gameState.squad` members only (bench characters can't be healed by supplies — only active-squad characters need pre-battle topping-up).

### Access restriction

- The shop is reachable only from `BaseScene.renderBaseMode()` (i.e. `!gameState.stageProgress.inChapterRun`) — same restriction as squad editing. This avoids having to reconcile shop purchases against a locked `lockedSquad` mid-run; players top up and re-skill between chapters, not mid-run.
- Leaving the shop returns to `BaseScene` (`renderBaseMode`), not `WorldMapScene`.

### Save compatibility

- `gameState.inventory` is a new required `GameState` field, but old saved slots (`localStorage`) predate it. Every read site must use `gameState.inventory ?? []` defensively. `SaveSystem.loadSlot` itself is not changed (no migration layer exists in this codebase) — defaulting happens at the call sites that consume `inventory` (`BaseScene`, `ShopSystem`).
- `newGame()` (`src/save/GameState.ts`) initializes `inventory: []` for new games.

## Data model changes

`src/types.ts` additions:

```ts
export type ShopItemType = 'skill_scroll' | 'supply';

export interface ShopItem {
  id: string;
  name: string;
  type: ShopItemType;
  price: number;
  description: string;
  skillId?: string;      // skill_scroll only — id into SKILLS
  healAmount?: number;   // supply only — flat HP restored
}

export interface InventoryEntry {
  itemId: string;        // ShopItem.id, supply items only
  quantity: number;
}
```

`GameState` (`src/types.ts:151`) gains:

```ts
export interface GameState {
  // ...existing fields...
  inventory: InventoryEntry[];
}
```

New file `src/data/shopItems.ts`:

```ts
import type { ShopItem } from '../types';

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'scroll_burst_shot', type: 'skill_scroll', name: '爆發射擊卷軸', price: 40, description: '教導一名角色「爆發射擊」', skillId: 'burst_shot' },
  { id: 'scroll_shield_bash', type: 'skill_scroll', name: '盾擊卷軸', price: 35, description: '教導一名角色「盾擊」', skillId: 'shield_bash' },
  { id: 'scroll_swift_strike', type: 'skill_scroll', name: '迅捷突刺卷軸', price: 38, description: '教導一名角色「迅捷突刺」', skillId: 'swift_strike' },
  { id: 'scroll_field_medic', type: 'skill_scroll', name: '戰地醫療卷軸', price: 60, description: '教導一名角色「戰地醫療」', skillId: 'field_medic' },
  { id: 'scroll_combat_stim', type: 'skill_scroll', name: '戰鬥興奮劑卷軸', price: 55, description: '教導一名角色「戰鬥興奮劑」', skillId: 'combat_stim' },
  { id: 'scroll_iron_will', type: 'skill_scroll', name: '鋼鐵意志卷軸', price: 55, description: '教導一名角色「鋼鐵意志」', skillId: 'iron_will' },
  { id: 'supply_medkit_s', type: 'supply', name: '小型醫療包', price: 25, description: '恢復 50 HP', healAmount: 50 },
  { id: 'supply_medkit_l', type: 'supply', name: '大型醫療包', price: 70, description: '恢復 150 HP', healAmount: 150 },
];
```

New file `src/battle/ShopSystem.ts` — pure functions, no Phaser/Math.random dependency:

```ts
export const MAX_SKILLS_PER_CHARACTER = 3;

export function canAfford(currency: number, price: number): boolean;

// gameState.pool, not squad — teaching isn't squad-restricted
export function isEligibleForScroll(character: Character, skillId: string): boolean;
export function hasAnyEligibleCharacter(pool: Character[], skillId: string): boolean;

// Returns a new Character with the skill appended; caller still owns currency deduction
export function teachSkill(character: Character, skillId: string): Character;

export function addToInventory(inventory: InventoryEntry[], itemId: string): InventoryEntry[];

export function canUseSupply(target: Character): boolean; // alive && hp < maxHp

// Returns new Character (healed) + new inventory (decremented/entry removed at 0)
export function useSupply(
  inventory: InventoryEntry[],
  itemId: string,
  healAmount: number,
  target: Character
): { character: Character; inventory: InventoryEntry[] };
```

`src/save/GameState.ts`: `newGame()` adds `inventory: []` to the returned object.

## UI changes

### BaseScene (`src/scenes/BaseScene.ts`)

- `renderBaseMode()`: the existing single centered "世界地圖" button (`mapBtn` at `(W/2, 600)`) becomes two side-by-side buttons at `y=600`: "商店" at `x=120` (navigates to `ShopScene` passing `{ gameState }`) and "世界地圖" at `x=240` (unchanged behavior, just repositioned). Both call `saveSlot(this.gameState)` before transitioning, matching the existing map button's behavior.
- New section `renderInventorySection(startY)`, rendered between the squad/pool list and the bottom buttons, only when `(gameState.inventory ?? []).length > 0` and `!inChapterRun`. One row per inventory entry: item name (looked up from `SHOP_ITEMS`), `x${quantity}`, and a "使用" button. Tapping "使用" opens a small target picker (same visual pattern as `showAllocationPanel`'s container-on-top-of-bg) listing `gameState.squad` members for whom `canUseSupply(member)` is true; tapping a member applies `useSupply(...)`, updates state via `updateCharInState`, writes `gameState.inventory`, calls `saveSlot`, closes the picker, and re-renders.
- `renderInChapterMode()` is unchanged — no shop/inventory access mid-run.

### ShopScene (new file `src/scenes/ShopScene.ts`)

- `create(data: { gameState: GameState })`. Same 360×640 dark background convention as other scenes.
- Header: "商店" title, currency display (`幣:${gameState.currency}`) top-right (same style as `BaseScene`'s), "返回" button top-left → `this.scene.start('BaseScene', this.gameState)`.
- Two labeled sections, "技能卷軸" then "補給品", each listing its `SHOP_ITEMS` rows: name, description, price, and a "購買" button.
  - `skill_scroll` row's button is disabled (grey, not interactive) when `!canAfford(currency, price) || !hasAnyEligibleCharacter(pool, skillId)`.
  - `supply` row's button is disabled when `!canAfford(currency, price)`.
- Tapping "購買" on a `skill_scroll` row opens a character-picker overlay (container + bg, same z-order convention as `BaseScene.showAllocationPanel`) listing every `gameState.pool` character with `isEligibleForScroll(char, skillId)` true, one row per character with a "教學" button. Tapping "教學": deducts `price` from `gameState.currency`, calls `teachSkill`, propagates via the same squad/pool/lockedSquad update logic as `BaseScene.updateCharInState` (shop is base-mode-only so `lockedSquad` is always undefined here, but the helper is reused for consistency), `saveSlot`, closes overlay, re-renders the shop list (so the currency display and now-possibly-disabled buttons update). A "取消" button on the overlay closes it with no charge.
- Tapping "購買" on a `supply` row has no overlay: immediately deducts `price`, calls `addToInventory`, `saveSlot`, re-renders the list.

## Acceptance criteria

- **Given** the player is in `BaseScene` base mode (not in a chapter run), **when** the screen renders, **then** both "商店" and "世界地圖" buttons are visible and tapping "商店" navigates to `ShopScene`.
- **Given** the player is in `BaseScene` in-chapter mode (`stageProgress.inChapterRun` set), **when** the screen renders, **then** no shop entry point or inventory section appears anywhere on screen.
- **Given** `gameState.currency` is less than a scroll's price, **when** `ShopScene` renders that scroll's row, **then** its "購買" button is disabled even if an eligible character exists.
- **Given** every character in `gameState.pool` already has the skill from a given scroll, or every character is at `skills.length === MAX_SKILLS_PER_CHARACTER`, **when** `ShopScene` renders that scroll's row, **then** its "購買" button is disabled even with sufficient currency.
- **Given** a scroll is affordable and at least one eligible character exists, **when** the player taps "購買" then taps "教學" on an eligible character, **then** `currency` decreases by the scroll's price exactly once, the character's `skills` array gains the skill, and the change is reflected in `squad`/`pool` and persisted via `saveSlot`.
- **Given** the character-picker overlay is open for a scroll purchase, **when** the player taps "取消" instead of choosing a character, **then** `currency` is unchanged and no skill is taught.
- **Given** a supply item is affordable, **when** the player taps "購買" on it, **then** `currency` decreases by its price immediately (no character-picker step) and `gameState.inventory` gains/increments an entry for that item id.
- **Given** `gameState.inventory` has an entry with `quantity: 2` for `supply_medkit_s`, **when** the player uses it once on a squad member below max HP, **then** that member's `stats.hp` increases by 50 (clamped to `maxHp`) and the inventory entry's `quantity` becomes 1.
- **Given** an inventory entry's `quantity` reaches 0 after a use, **when** `BaseScene` re-renders the inventory section, **then** that entry no longer appears in the list.
- **Given** every squad member is either dead or at full HP, **when** the player attempts to use a supply, **then** the "使用" action is disabled / no target is offered, and nothing is deducted from inventory.
- **Given** a save slot written before this feature exists (no `inventory` field in its stored JSON), **when** that slot is loaded and `BaseScene`/`ShopScene` read `gameState.inventory`, **then** it is treated as `[]` with no runtime error.

## Implementation notes (out of scope for this feature, future backlog candidates)

- No restocking/rotating catalog, no per-item purchase limits, no selling characters' items back.
- No battle-time item use (supplies are base-screen-only, pre-battle) — adding an `item` command to `BattleScene`'s command menu would be a separate spec.
- No visual icons for shop items in this pass — text rows only, consistent with the rest of the UI's current text-first style.
