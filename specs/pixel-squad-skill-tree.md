# pixel-squad — 技能樹（Skill Tree）

## Goal

Give every player character an individual skill-unlock path with 3 branches (offense / control / support), gated by a new per-character `skillPoints` resource earned on level-up, so growth becomes a deliberate build choice instead of buying any scroll for any character.

## Context (existing systems this builds on top of)

- `battle/ShopSystem.ts` already lets the player buy a "skill scroll" (`SHOP_ITEMS` where `type === 'skill_scroll'`) and teach it to **any** character in `gameState.pool` via `teachSkill()`, gated only by `isEligibleForScroll()` (skill not already known, and `character.skills.length < MAX_SKILLS_PER_CHARACTER`, currently `3`). This flow is untouched by this spec — it remains the "generic" way to diversify a squad. The skill tree is an **additional**, per-character-specific path that competes for the same `skills` array and the same cap.
- `battle/CharacterFactory.ts` builds `Character.skills` once at creation from `CharacterTemplate.skillIds` (0 or 1 starting skill per template today, see `data/characters.ts`).
- `battle/ExpSystem.applyExp()` already grants `STAT_POINTS_PER_LEVEL = 3` to the protagonist on level-up, and auto-grows raw stats for non-protagonists. Neither path currently grants anything usable for a skill tree.
- All 12 `SKILLS` entries (`data/skills.ts`) already exist and are reused as the tree's node payloads — **no new skill content is authored**. They split cleanly into 3 categories of 4:
  - **offense** (pure attack, no status): `burst_shot`, `shield_bash`, `swift_strike`, `fire_grenade`
  - **control** (attack + inflicts a status effect): `cryo_round` (freeze), `acid_splash` (burn), `emp_pulse` (stun), `toxic_spray` (poison)
  - **support** (heal/buff): `field_medic`, `combat_stim`, `iron_will`, `overdrive`

## Rules

1. Each `CharacterTemplate` in `data/characters.ts` gets a `skillTree: SkillTreeNode[]` of exactly 6 nodes: 3 branches (`offense` / `control` / `support`) × 2 tiers. Tier 1 costs 1 skill point, tier 2 costs 2. Tier 2 in a branch cannot be unlocked until tier 1 in that **same branch** is unlocked, regardless of available points. The two branches are otherwise fully independent — the player can unlock tier 1 of all 3 branches before touching any tier 2.
2. `Character.skillPoints` starts at `0` and increases by exactly `+1` per level-up, for **both** protagonist and non-protagonist characters — this is a new, separate counter from `statPoints` (protagonist stat allocation) and the non-protagonist auto stat growth; neither existing mechanism changes.
3. Unlocking a node spends `node.cost` skill points and adds `node.id` to `Character.unlockedSkillNodeIds`. If the node's `skillId` is not already in `character.skills`, it is appended — reusing the exact `Skill` object from `SKILLS`, the same way `ShopSystem.teachSkill` does today.
4. `MAX_SKILLS_PER_CHARACTER` (in `ShopSystem.ts`) increases from `3` to `4` and is imported (not redefined) by the skill-tree code as the shared cap for total known skills. A node cannot be unlocked if `character.skills.length >= MAX_SKILLS_PER_CHARACTER` **and** the node's skill isn't already known — same rule `isEligibleForScroll` already applies to scrolls. Because each character's tree has 6 nodes but the cap is 4, players cannot unlock the whole tree — they must pick a subset across branches. This is intentional, not a bug.
   - If a node's skill is already known (e.g. taught earlier via a shop scroll), unlocking it still spends points and records `unlockedSkillNodeIds`, but does not duplicate the skill or count against the cap check.
5. Unlocking a node whose skill is already known never duplicates it in `character.skills` and never exceeds the cap (see rule 4's second bullet — same check, not a separate exemption).
6. `getSkillTree(templateId)` looks up the tree by matching `templateId` against `PLAYER_TEMPLATES` in `data/characters.ts`. Characters converted from enemies via `CharacterFactory.enemyToPlayerCharacter` (the recruit-fix flow — see `specs/pixel-squad-recruit-fix.md`) keep the **enemy's** `templateId`, which never matches a `PLAYER_TEMPLATES` entry, so `getSkillTree` returns `undefined` for them. The Skill Tree screen must handle this by showing a placeholder instead of crashing (AC-8) — this mirrors how those characters are already excluded from other template-keyed lookups.
7. Skill points and unlocked nodes must survive save/load. `SaveSystem.saveSlot`/`loadSlot` already round-trip the whole `GameState` via `JSON.stringify`/`parse`, so no migration code is needed for new saves. For saves created before this feature shipped, `Character.skillPoints` and `unlockedSkillNodeIds` will be `undefined` after `loadSlot` — every read site must default defensively (`character.skillPoints ?? 0`, `character.unlockedSkillNodeIds ?? []`), the same pattern already used for `gameState.equipmentInventory ?? []` in `EquipmentScene.ts` and `ShopScene.ts`.
8. The Skill Tree screen (`SkillTreeScene`) is reachable only from `BaseScene`'s base hub (`renderBaseMode`), not from the in-chapter-run mode (`renderInChapterMode`) — consistent with `裝備`/`商店` already being base-only there.

## Data model changes (`src/types.ts`)

```ts
export type SkillTreeBranch = 'offense' | 'control' | 'support';

export interface SkillTreeNode {
  id: string;           // `${templateId}_${branch}_${tier}`, e.g. 'rex_offense_1'
  branch: SkillTreeBranch;
  tier: 1 | 2;           // tier 2 requires tier 1 of the same branch unlocked first
  skillId: string;       // key into SKILLS
  cost: number;          // skillPoints required; 1 for tier 1, 2 for tier 2
}

export interface CharacterTemplate {
  // ...existing fields unchanged...
  skillTree: SkillTreeNode[];  // exactly 6 nodes: 3 branches × 2 tiers
}

export interface Character {
  // ...existing fields unchanged...
  skillPoints?: number;             // earned +1 per level-up; spent unlocking skill-tree nodes
  unlockedSkillNodeIds?: string[];  // SkillTreeNode.id values this character has unlocked
}
```

## Data model changes (`src/data/characters.ts`)

Add a `skillTree` array to every `PLAYER_TEMPLATES` entry using this exact assignment (node id = `${templateId}_${branch}_${tier}`, cost = 1 for tier 1 / 2 for tier 2):

| templateId | offense t1 / t2 | control t1 / t2 | support t1 / t2 |
|---|---|---|---|
| protagonist | swift_strike / fire_grenade | cryo_round / emp_pulse | combat_stim / overdrive |
| rex | burst_shot / fire_grenade | acid_splash / toxic_spray | iron_will / overdrive |
| nyx | burst_shot / fire_grenade | emp_pulse / cryo_round | combat_stim / overdrive |
| vega | shield_bash / swift_strike | acid_splash / emp_pulse | iron_will / overdrive |
| ash | shield_bash / burst_shot | toxic_spray / cryo_round | field_medic / overdrive |
| crow | swift_strike / fire_grenade | emp_pulse / acid_splash | combat_stim / iron_will |
| mira | burst_shot / shield_bash | toxic_spray / cryo_round | iron_will / combat_stim |
| zora | shield_bash / fire_grenade | cryo_round / toxic_spray | iron_will / field_medic |
| rook | shield_bash / burst_shot | emp_pulse / toxic_spray | iron_will / overdrive |
| dex | fire_grenade / shield_bash | acid_splash / cryo_round | field_medic / iron_will |
| echo | swift_strike / burst_shot | emp_pulse / acid_splash | combat_stim / overdrive |
| aaaa | fire_grenade / burst_shot | toxic_spray / cryo_round | overdrive / combat_stim |

Example for `rex` (full node array to make the pattern unambiguous):

```ts
skillTree: [
  { id: 'rex_offense_1', branch: 'offense', tier: 1, skillId: 'burst_shot', cost: 1 },
  { id: 'rex_offense_2', branch: 'offense', tier: 2, skillId: 'fire_grenade', cost: 2 },
  { id: 'rex_control_1', branch: 'control', tier: 1, skillId: 'acid_splash', cost: 1 },
  { id: 'rex_control_2', branch: 'control', tier: 2, skillId: 'toxic_spray', cost: 2 },
  { id: 'rex_support_1', branch: 'support', tier: 1, skillId: 'iron_will', cost: 1 },
  { id: 'rex_support_2', branch: 'support', tier: 2, skillId: 'overdrive', cost: 2 },
],
```

## Code changes

### `battle/ShopSystem.ts`
- Change `export const MAX_SKILLS_PER_CHARACTER = 3;` to `= 4;`.

### `tests/unit/ShopSystem.test.ts` (must be updated, not left broken)
- Line 38: `expect(MAX_SKILLS_PER_CHARACTER).toBe(3)` → `.toBe(4)`.
- Line 67-71 ("returns false when the character is at MAX_SKILLS_PER_CHARACTER"): the fixture must have 4 skills at cap, e.g. `skills: [SKILLS.burst_shot, SKILLS.shield_bash, SKILLS.swift_strike, SKILLS.cryo_round]`.

### `battle/ExpSystem.ts`
In `applyExp`'s level-up loop, add skill-point growth for both branches (protagonist and non-protagonist), alongside the existing `statPoints`/auto-growth logic — do not change the existing stat behavior:

```ts
while (c.exp >= c.expToNext) {
  c.exp -= c.expToNext;
  c.level += 1;
  c.expToNext = expToNextLevel(c.level);
  c.skillPoints = (c.skillPoints ?? 0) + 1;

  if (c.isProtagonist) {
    c.statPoints += STAT_POINTS_PER_LEVEL;
  } else {
    c.stats = { /* unchanged */ };
  }
}
```

### `battle/CharacterFactory.ts`
- `createCharacter`: initialize `skillPoints: 0, unlockedSkillNodeIds: []` on the returned `Character`.
- `enemyToPlayerCharacter`: initialize `skillPoints: 0, unlockedSkillNodeIds: []` too (defensive — its `templateId` won't match a tree, but the fields must exist for type consistency and future recruits that might).
- `createEnemy`: no change — enemies never access the skill tree, and the new `Character` fields are optional.

### New file `battle/SkillTree.ts`

```ts
import type { Character, Skill, SkillTreeNode } from '../types';
import { PLAYER_TEMPLATES } from '../data/characters';
import { SKILLS } from '../data/skills';
import { MAX_SKILLS_PER_CHARACTER } from './ShopSystem';

export function getSkillTree(templateId: string): SkillTreeNode[] | undefined {
  return PLAYER_TEMPLATES.find(t => t.id === templateId)?.skillTree;
}

export function isNodeUnlocked(character: Character, nodeId: string): boolean {
  return (character.unlockedSkillNodeIds ?? []).includes(nodeId);
}

function tierOnePrereqMet(character: Character, node: SkillTreeNode, tree: SkillTreeNode[]): boolean {
  if (node.tier === 1) return true;
  const tierOne = tree.find(n => n.branch === node.branch && n.tier === 1);
  return !!tierOne && isNodeUnlocked(character, tierOne.id);
}

export function canUnlockNode(character: Character, node: SkillTreeNode, tree: SkillTreeNode[]): boolean {
  if (isNodeUnlocked(character, node.id)) return false;
  if (!tierOnePrereqMet(character, node, tree)) return false;
  if ((character.skillPoints ?? 0) < node.cost) return false;
  const alreadyKnown = character.skills.some(s => s.id === node.skillId);
  if (!alreadyKnown && character.skills.length >= MAX_SKILLS_PER_CHARACTER) return false;
  return true;
}

export function unlockNode(character: Character, node: SkillTreeNode): Character {
  const skill: Skill = SKILLS[node.skillId];
  const alreadyKnown = character.skills.some(s => s.id === node.skillId);
  return {
    ...character,
    skillPoints: (character.skillPoints ?? 0) - node.cost,
    unlockedSkillNodeIds: [...(character.unlockedSkillNodeIds ?? []), node.id],
    skills: alreadyKnown ? character.skills : [...character.skills, skill],
  };
}
```

## UI changes

### `scenes/BaseScene.ts` — `renderBaseMode`
Reflow the 3 existing bottom buttons (currently `90`px wide at x = 70/180/290) into 4 buttons `78`px wide at x = `47`/`133`/`219`/`305`, y unchanged (`600`):

- `商店` (purple `0x7c3aed`) → `ShopScene`
- `裝備` (orange `0xb45309`) → `EquipmentScene`
- `技能樹` (teal `0x0891b2`, new) → `SkillTreeScene`, passing `{ gameState: this.gameState }`, saving via `saveSlot(this.gameState)` first (same pattern as the other two buttons)
- `世界地圖` (blue `0x1d4ed8`) → `WorldMapScene`

`renderInChapterMode` is unchanged — no skill-tree button there.

### New scene `scenes/SkillTreeScene.ts`
Modeled on `EquipmentScene.ts`'s structure (header + back button + per-character rows + a full-screen overlay panel for the detail view):

- Header: title `技能樹`, back button → `BaseScene`.
- List (one row per `gameState.squad` member): name, level, and `剩餘技能點數: {skillPoints ?? 0}`, plus a `查看` button that opens the detail panel for that character.
- Detail panel (overlay container, dismissible via a `關閉` button):
  - If `getSkillTree(char.templateId)` is `undefined` (recruited-enemy-origin character — rule 6): show only the text `此角色暫無技能樹`.
  - Otherwise render 3 columns, one per branch (`offense` / `control` / `support`), each showing its tier-1 node above its tier-2 node. Each node button shows the skill's `name` and, when locked, its `cost`. Node visual/interaction states:
    - **unlocked**: green fill, non-interactive, shows skill name only.
    - **unlockable** (`canUnlockNode` true): blue fill, interactive; tapping calls `unlockNode`, persists via `updateCharInState` + `saveSlot` (same pattern as `EquipmentScene.handleEquip`), then re-renders the panel in place so the player can keep spending points without re-opening it.
    - **locked** (`canUnlockNode` false): grey fill, non-interactive, shows skill name + cost.

## Acceptance Criteria

- **AC-1**: Given a protagonist at level 1 with `skillPoints` unset, when `applyExp` grants enough EXP to level up once, then the returned character has `skillPoints === 1` and `statPoints` increased by `STAT_POINTS_PER_LEVEL` exactly as before.
- **AC-2**: Given a non-protagonist at level 1, when `applyExp` levels them up once, then `skillPoints === 1` and their auto stat growth is unchanged from current behavior.
- **AC-3**: Given a character with `skillPoints: 1` and no unlocked nodes, when `canUnlockNode` is called for their `offense` tier-1 node, then it returns `true`; when `unlockNode` is applied, then `skillPoints === 0`, `unlockedSkillNodeIds` contains that node's id, and `skills` contains the corresponding `Skill`.
- **AC-4**: Given a character with `skillPoints: 0`, when `canUnlockNode` is called for any tier-1 node, then it returns `false` and no state changes if `unlockNode` were mistakenly called (spec only requires the `canUnlockNode` gate — the UI must not call `unlockNode` when it returns `false`).
- **AC-5**: Given a character with `skillPoints: 5` and no unlocked nodes, when `canUnlockNode` is called for a branch's tier-2 node, then it returns `false` (tier-1 prerequisite not met), even though points are sufficient; after tier-1 in that branch is unlocked, `canUnlockNode` for tier-2 returns `true`.
- **AC-6**: Given a character who already knows a skill (e.g. taught via a shop scroll) and has enough points, when `unlockNode` is called for the tree node with that same `skillId`, then `unlockedSkillNodeIds` gains the node id, `skillPoints` decreases by `node.cost`, and `skills` does **not** gain a duplicate entry.
- **AC-7**: Given a character whose `skills.length === MAX_SKILLS_PER_CHARACTER` (4) and who does not know the node's skill yet, when `canUnlockNode` is called, then it returns `false`.
- **AC-8**: Given a character whose `templateId` does not match any `PLAYER_TEMPLATES` entry (e.g. one produced by `enemyToPlayerCharacter`), when `SkillTreeScene`'s detail panel is opened for them, then it renders the `此角色暫無技能樹` placeholder and does not throw.
- **AC-9**: Given a character with `skillPoints: 3` and one unlocked node, when `gameState` is round-tripped through `saveSlot` then `loadSlot`, then the loaded character's `skillPoints` and `unlockedSkillNodeIds` are unchanged.
- **AC-10 (regression)**: The full existing test suite passes, including the updated `ShopSystem.test.ts` expectations for `MAX_SKILLS_PER_CHARACTER === 4`.

## Test plan (new/updated files)

- `tests/unit/SkillTree.test.ts` — `getSkillTree`, `isNodeUnlocked`, `canUnlockNode` (AC-3/4/5/6/7), `unlockNode` (AC-3/6).
- `tests/unit/ExpSystem.skillPoints.test.ts` — AC-1/AC-2.
- `tests/unit/CharacterFactory.skillTree.test.ts` — `createCharacter` and `enemyToPlayerCharacter` initialize `skillPoints: 0` and `unlockedSkillNodeIds: []`.
- `tests/unit/CharacterData.skillTree.test.ts` — every `PLAYER_TEMPLATES` entry has exactly 6 `skillTree` nodes (3 branches × 2 tiers), all `skillId`s resolve in `SKILLS`, and no two nodes in the same character share an `id`.
- `tests/unit/ShopSystem.test.ts` — update per "Code changes" above (AC-10).
- `tests/unit/SaveSystem.skillTree.test.ts` — AC-9 (JSON round-trip of `skillPoints`/`unlockedSkillNodeIds`).
- `tests/unit/baseUI.skillTreeButton.test.ts` or equivalent — since `BattleScene`/`BaseScene` can't be instantiated under vitest (no Phaser runtime), follow the existing pattern from `BattleScene.aoaWiring.test.ts` **only if** a pure-function extraction isn't feasible; prefer extracting the button-layout math (4× width/x positions) into a small pure helper so it can be tested with real input/output instead of source-text matching.
