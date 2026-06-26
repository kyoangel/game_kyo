# 支線任務差異化獎勵 (Side Quest Differentiated Rewards)

## Goal

Give each of the three side quests (SQ-1/2/3) a guaranteed, exclusive first-clear item reward — on top of EXP/currency — so side quests feel like meaningful detours instead of grindier copies of story stages.

## Rules

- Side quests already grant `expReward` + `currencyReward` on **every** clear (farmable, unchanged).
- New `itemRewards` are granted **once only**, on the side quest's first clear (`isFirstClear` in `VictoryProcessor`), matching the existing first-clear-only pattern used for `unlockCharacterId`.
- Story stages (`isSideQuest: false`) never carry `itemRewards` — this field is exclusive to side quests, enforced by convention (not by type, since `Stage` is a shared shape) and verified by a unit test.
- Two of the three rewards are **exclusive items not sold in the shop** (`ShopItem.id` not present in `SHOP_ITEMS`), so the side quest is the only source. The third reuses an existing shop scroll at a steep discount-equivalent (i.e., free) to keep the reward pool varied without requiring three brand-new skills.
- Exclusive skill scrolls teach a skill the same way `teachSkill` already does (`ShopSystem.teachSkill`) — no new code path needed, the reward is just inventory-only (the player still has to spend it via the existing prep-scene "use scroll" flow). Exclusive supply items behave like existing `supply` items (heal on use), just better stats and unobtainable elsewhere.
- If `itemRewards` references an `itemId`, that item must exist either in `SHOP_ITEMS` or in a new `EXCLUSIVE_ITEMS` data list — `ResultScene` and any inventory-rendering UI must be able to resolve the item's `name`/`description` from either source.
- Re-clearing a side quest after first clear still grants EXP + currency but shows no item-reward line in `ResultScene` (since `itemRewards` is only applied when `isFirstClear` is true).
- Multiple items per quest are allowed (`itemRewards` is an array); duplicates of the same `itemId` are not deduplicated — `addToInventory` already increments quantity correctly when called multiple times.

## Data model changes

`src/types.ts`:

```ts
export interface StageItemReward {
  itemId: string;   // resolves against SHOP_ITEMS or EXCLUSIVE_ITEMS
  quantity: number;
}

export interface Stage {
  // ...existing fields unchanged...
  itemRewards?: StageItemReward[]; // side quests only, granted on first clear
}
```

New file `src/data/exclusiveItems.ts` (mirrors `ShopItem` shape, but never appears in `SHOP_ITEMS` so it's never purchasable):

```ts
import type { ShopItem } from '../types';

export const EXCLUSIVE_ITEMS: ShopItem[] = [
  {
    id: 'scroll_overdrive',
    type: 'skill_scroll',
    name: '超載卷軸',
    price: 0,
    description: '教導一名角色「超載」（限定）',
    skillId: 'overdrive',
  },
  {
    id: 'supply_nano_kit',
    type: 'supply',
    name: '奈米醫療包',
    price: 0,
    description: '恢復 999 HP（限定）',
    healAmount: 999,
  },
];
```

New skill in `src/data/skills.ts` (`overdrive`, used only by the exclusive scroll above):

```ts
overdrive: {
  id: 'overdrive',
  name: '超載',
  type: 'buff',
  target: 'self',
  multiplier: 0,
  buffStat: 'atk',
  buffAmountPct: 0.5,
  buffDuration: 2,
  description: '自身 ATK 提升 50%，持續 2 回合',
},
```

`src/data/stages.ts` — add `itemRewards` to the three side quests:

```ts
// SQ-1 廢土競技場
itemRewards: [{ itemId: 'scroll_overdrive', quantity: 1 }],

// SQ-2 黑市突襲
itemRewards: [{ itemId: 'supply_nano_kit', quantity: 2 }],

// SQ-3 古代遺跡探索
itemRewards: [
  { itemId: 'scroll_field_medic', quantity: 1 }, // existing shop scroll, free via quest
  { itemId: 'supply_nano_kit', quantity: 1 },
],
```

## Logic changes

`src/battle/VictoryProcessor.ts` — inside `processVictory`, after the existing currency/EXP additions and guarded by the existing `isFirstClear` flag:

```ts
if (isFirstClear && stage.itemRewards) {
  let inventory = state.inventory;
  for (const reward of stage.itemRewards) {
    for (let i = 0; i < reward.quantity; i++) {
      inventory = addToInventory(inventory, reward.itemId);
    }
  }
  state.inventory = inventory;
}
```

(Import `addToInventory` from `./ShopSystem`.) `state.inventory` must be added to the shallow-copy block at the top of `processVictory` (currently `pool`/`squad`/`stageProgress` are copied but `inventory` is passed through by reference from `gameState` — copy it defensively: `inventory: [...gameState.inventory]`).

A helper to resolve an item's display data from either source, used by `ResultScene` (and reusable later by `PrepScene`/`ShopScene` if they ever need to show exclusive items):

`src/battle/ShopSystem.ts` — add:

```ts
import { EXCLUSIVE_ITEMS } from '../data/exclusiveItems';

export function findItemById(itemId: string): ShopItem | undefined {
  return SHOP_ITEMS.find(i => i.id === itemId) ?? EXCLUSIVE_ITEMS.find(i => i.id === itemId);
}
```

(Requires importing `SHOP_ITEMS` from `../data/shopItems` into `ShopSystem.ts`, which it doesn't currently import.)

## UI changes

**ResultScene** (`src/scenes/ResultScene.ts`): when `victory` is true and `isFirstClear` produced item rewards, render one line per distinct item below the existing currency line (after the `幣: +N` text, before the recruited/new-character block), e.g.:

```
獲得：超載卷軸 ×1
```

Implementation note: `ResultScene` currently calls `processVictory` and only reads back `updatedGameState`. To know *which* items were newly granted (vs. already-owned), it should diff `stage.itemRewards` against whether `isFirstClear` held — simplest approach: `ResultScene` recomputes `isFirstClear` itself the same way `VictoryProcessor` does (`!gameState.stageProgress.completedStageIds.includes(stage.id)`) before calling `processVictory`, then only renders `stage.itemRewards` lines when that local `isFirstClear` is true. Resolve each `itemId`'s display name via `findItemById`.

No changes needed to `PrepScene`/`ShopScene` inventory lists — they already iterate `gameState.inventory` by `itemId` and would need `findItemById` if they render names from `InventoryEntry[]`. (Check at implementation time whether they currently hardcode `SHOP_ITEMS.find(...)` — if so, swap that lookup to `findItemById` so exclusive items display correctly there too.)

## Acceptance criteria

- **Given** a fresh save that has never cleared SQ-1, **when** the player wins SQ-1 for the first time, **then** `gameState.inventory` contains one `scroll_overdrive` entry and `ResultScene` displays "獲得：超載卷軸 ×1".
- **Given** a save that has already cleared SQ-1 once, **when** the player clears SQ-1 again, **then** EXP and currency are still granted but `gameState.inventory` gains no additional `scroll_overdrive` entries and `ResultScene` shows no item-reward line.
- **Given** the player wins SQ-2 for the first time, **when** `processVictory` runs, **then** `gameState.inventory` contains a `supply_nano_kit` entry with `quantity: 2`.
- **Given** the player wins SQ-3 for the first time, **when** `processVictory` runs, **then** `gameState.inventory` contains both `scroll_field_medic` (qty 1) and `supply_nano_kit` (qty 1) — and if the player already owned `scroll_field_medic` from the shop, the existing entry's quantity increments rather than creating a duplicate entry (covered by `addToInventory`'s existing merge behavior).
- **Given** `EXCLUSIVE_ITEMS`, **when** `ShopScene` renders the purchasable item list, **then** `scroll_overdrive` and `supply_nano_kit` never appear (they are not in `SHOP_ITEMS`).
- **Given** a story stage (`isSideQuest: false`), **when** reviewing `stages.ts`, **then** no story stage defines `itemRewards` (test asserts `STAGES.filter(s => !s.isSideQuest).every(s => !s.itemRewards)`).
