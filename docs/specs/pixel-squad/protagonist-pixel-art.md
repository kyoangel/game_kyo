# 角色設計：主人公像素素材

## Goal

Give the protagonist (`倖存者`, template id `protagonist`) a distinctive static pixel-art sprite that replaces the generic blue rectangle currently used for all player characters in battle and prep screens.

## Background / current state

- Every character (player and enemy) is rendered as a plain `Phaser.GameObjects.Rectangle` — blue (`0x3b82f6`) for `isPlayer`, red (`0xef4444`) for enemies (`BattleScene.ts:162-163`). There is no sprite/texture loading anywhere in the codebase (`grep` for `load.image`/`load.spritesheet`/`preload` returns nothing).
- `CharacterTemplate` (`types.ts:36-46`) and `Character` (`types.ts:49-72`) have no field referencing visual assets.
- The protagonist is data-defined in `data/characters.ts:5-10` as `id: 'protagonist', name: '倖存者', isProtagonist: true`. `isProtagonist` is already used to gate stat-point allocation UI (`PrepScene.ts:122`) — this spec reuses that same flag to gate the new sprite, no new flag needed.
- Only the protagonist gets dedicated art in this item. Other party members (Rex, etc.), enemies, and animation states (Walk/Attack/Hit/Die/Skill) are explicitly out of scope — they're separate backlog items (像素怪物素材、角色攻擊動作).
- No artist/asset pipeline exists in this repo; sprites must be produced as a static PNG asset checked into `public/sprites/` (hand-authored or generated offline) and loaded via Phaser's texture loader. Pixel-art scaling must use nearest-neighbor filtering to avoid blur.

## Rules

1. The sprite depicts a single idle pose only — no animation frames in this item (animation states are a separate backlog item).
2. Sprite asset is a 32×32 (or 32×48 if a taller silhouette reads better) PNG, indexed/flat-color pixel art, transparent background, stored at `public/sprites/protagonist_idle.png`.
3. Sprite is loaded once in a scene `preload()` and reused via Phaser's texture cache (texture key: `protagonist_idle`) — do not reload per-scene if avoidable; if each scene needs its own `preload`, that's acceptable as Phaser caches by key automatically and skips re-fetching.
4. Phaser game config must set `pixelArt: true` (or per-texture `setFilter(Phaser.Textures.FilterMode.NEAREST)`) so the sprite isn't smoothed when scaled to fit the existing 44×56 character box.
5. Only the character where `character.isProtagonist === true` AND `character.isPlayer === true` uses the sprite. All other characters (allies, enemies, recruited enemies) keep the existing rectangle rendering — this item does not touch their visuals.
6. If the sprite asset fails to load (texture missing), fall back silently to the existing blue rectangle — never throw or leave a blank box. Phaser's `load.image` is the load call; check `this.textures.exists('protagonist_idle')` before deciding sprite vs. rectangle, since this is the project's only path that loads an external asset and a missing-file Vite/build edge case must not crash the scene.
7. Sprite replaces the rectangle visually but the existing HP bar, name label, level label, and turn-highlight overlay (`BattleScene.ts:164-173`, `:418`) keep working unmodified — they are positioned relative to the same `cx, cy` anchor and don't depend on the body being a `Rectangle` type.
8. Apply the same swap in `PrepScene.ts` wherever it renders the protagonist's row icon (currently no icon exists per the grep above — if `PrepScene` has no per-character icon today, this rule is void and only `BattleScene` needs the change. Confirm by reading `PrepScene.ts` rows around line 74-110 before implementing — do not add a new icon to `PrepScene` if none currently exists, to avoid scope creep beyond "replace existing visuals").

## Data model changes

No changes to `Character`, `CharacterTemplate`, or any persisted save type — sprite lookup is keyed off the existing `templateId === 'protagonist'` / `isProtagonist` flag, not stored data. This keeps old save files compatible (no migration needed).

Add one new constant module, `src/data/sprites.ts`:

```typescript
export const SPRITE_KEYS = {
  protagonistIdle: 'protagonist_idle',
} as const;

export const SPRITE_ASSETS: Record<string, string> = {
  [SPRITE_KEYS.protagonistIdle]: 'sprites/protagonist_idle.png',
};
```

This gives a single place to extend when monster/ally sprites are added later (future backlog items), without forcing this item to build a generic asset-registry abstraction.

## UI changes

**BattleScene** (`src/scenes/BattleScene.ts`):
- Add a `preload()` method (scene currently has none) that calls `this.load.image(SPRITE_KEYS.protagonistIdle, SPRITE_ASSETS[SPRITE_KEYS.protagonistIdle])`.
- In the character-rendering loop (around line 162-163), branch: if `char.isPlayer && char.isProtagonist && this.textures.exists(SPRITE_KEYS.protagonistIdle)`, render `this.add.sprite(cx, cy, SPRITE_KEYS.protagonistIdle).setDisplaySize(44, 56)` instead of the colored rectangle; otherwise keep the existing rectangle line unchanged. Store the resulting GameObject (sprite or rectangle) under the same variable name (`body`) so downstream code (turn highlight targeting, defeat fade-out, etc.) doesn't need to special-case the type.
- Phaser game config (wherever `new Phaser.Game({...})` is constructed, likely `main.ts`) gains `pixelArt: true`.

No other scene requires changes per Rule 8 unless `PrepScene` is found to already render per-character icons (verify first).

## Acceptance criteria

- **Given** the protagonist is in the player party in a battle, **when** `BattleScene` renders the combat grid, **then** the protagonist's character box shows the `protagonist_idle` sprite instead of a blue rectangle, scaled to the existing 44×56 box without blur (nearest-neighbor filtering).
- **Given** a non-protagonist ally (e.g. Rex) is in the player party, **when** `BattleScene` renders the combat grid, **then** that character still shows the existing blue rectangle, unchanged.
- **Given** the `protagonist_idle.png` asset is missing or fails to load, **when** `BattleScene` renders, **then** the protagonist falls back to the blue rectangle and the scene does not throw or crash.
- **Given** the protagonist's sprite is rendered, **when** the protagonist takes damage, defends, is defeated, or is highlighted for input (existing visual states), **then** all existing overlays (HP bar, name/level text, turn highlight, defeat fade) continue to render correctly against the sprite, since they're positioned independently of body type.
- **Given** a fresh checkout with no prior save data, **when** the game loads an existing save file (pre-this-feature), **then** nothing breaks — no data model or save-format change was made.

## Out of scope (tracked separately in backlog)

- Walk/Attack/Hit/Die/Skill animation frames.
- Monster/enemy pixel art.
- Sprites for non-protagonist allies.
