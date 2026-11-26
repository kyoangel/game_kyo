# Chrono Rush — Game Design Specification

## 1. Core Pillar
High-speed 16-bit Pixel Action-RPG where players race against a ticking clock to level up, polish gear in villages, choose optimal overworld routes, and storm a side-scrolling Boss Throne Room. Meta-progression focuses on **horizontal build variety**, **skin mastery**, and **progressive chapter mechanics** rather than pure exponential stat inflation.

## 2. Progressive Chapter Mechanics (Extensible to 10+ Chapters)
Each Chapter consists of 5 Episodes (`I – V`), with Episode `V` serving as a Chapter Finale:

| Chapter | Loops | Title | Core Mechanics Unlocked | Boss & Pattern |
| :--- | :--- | :--- | :--- | :--- |
| **Ch. 1** | 1–5 | **Chrono Quest I–V** (時光勇者傳) | Single intuitive main road, bump combat, village blacksmith polish & paid inn heal | Dark Overlord (Ground Fireball) |
| **Ch. 2** | 6–10 | **Frost Chronicle I–V** (極凍紀元) | **Dual-Branch Routes** (Upper High-XP Risk Path vs. Lower Dual-Village Gold/Skin Path) | Frost Lich King (Alternating Low/High Ice Shards) |
| **Ch. 3** | 11–15 | **Inferno Saga I–V** (煉獄終章) | **Map Events (POIs)**: Time Crystal (`+4s`), Power Shrine (`+25% Boss DMG`), Shortcut Portal | Inferno Titan (Rapid Twin Magma Volley) |
| **Ch. 4** | 16–20 | **Cyber Neon I–V** (霓虹末日) | Neon Energy Wall dividing upper/lower paths + all 3 POIs | Cyber Mech Lord (Fast Cyan/Magenta Plasma) |
| **Ch. 5** | 21–25 | **Celestial Fall I–V** (蒼穹神域) | Twin Void Chasms creating a 3-lane sky bridge + all 3 POIs | Void Seraph (High-Low Celestial Barrage) |
| **Cycle 2+** | 26+ | **Continuing Roman Numerals (`VI–X`, `XI–XV`...)** | Cycles chapters cleanly while incrementing Roman episode numerals | Scales smoothly |

## 6. Quick Handoff & File Map (For New Conversations)
- **Game Directory**: `games/chrono-rush/` (package `@gf-game/chrono-rush`, Phaser 3 + `@gf/game-kit`)
- **Dev Server**: `npm run dev -w @gf-game/chrono-rush`
- **Verify All**: `npm run typecheck && npx vitest run games/chrono-rush && npm run build -w @gf-game/chrono-rush`
- **Key Files**:
  - `src/balance.ts` — Single source of truth for curves, sqrt Crystal economy, defeat coaching hints, and **`FEATURES` toggle flags** (Two-Way Door).
  - `src/chapters.ts` — Data-driven 5 Chapters, solid obstacles, canyon/river barriers, route signs, Map POIs, `toRoman` continuation.
  - `src/gear.ts` — 7 Weapons (`1H`/`2H` + passives), 7 Armors (unique helms + Crit/Eva), 4 Shields, loop-scaled village costs & Battle Elixir.
  - `src/boosts.ts` — 4 Toggleable Pre-Run Crystal Boosts (full refund on untoggle, consumed on run start).
  - `src/meta.ts` — Persistent save (`MetaSave`), upgrades (3×3 grid), Skins transmog, Stage Records (`S`/`A`/`B` medals), `togglePreRunBoost`, `selectStageLoop`.
  - `src/systems.ts` — Pure combat/leveling/bump/boss-dash math (100% unit-tested in `systems.test.ts` & `balance.test.ts`).
  - `src/pixelArt.ts` — 100% original procedural 16-bit sprites (unique hero weapon/helm/shield silhouettes + 5 chapter bosses + obstacles).
  - `src/fanfare.ts` — 100% original D-major 8-bit victory fanfare & defeat jingle (copyright-safe for CrazyGames).
  - `src/PlayScene.ts` — Overworld, solid obstacles/barriers, Map POIs, village hotkeys (`[1]`–`[4]` + Zhuyin IME), Pause menu (`Esc`/`P`), side-scrolling Boss Arena with telegraph lanes & Combo.
  - `src/CampScene.ts` — 4-tab Camp (`Talents`, `Armory`, `Skins`, `Stages`).
  - `src/titleExtras.ts` & `src/backdrop.ts` — Live Title Screen synced to hero Skin & Chapter Boss, scrollable Stage Dropdown with `★ S` highlights, and 4 Toggle Pre-Run Boost pills.
  - `src/results.ts` — 2-column Results panel with Speedrun Medal, Defeat Coaching Tip, and `[R]` instant retry.

## 3. Horizontal Build & Equipment System
- **Flat Late-Game Stat Ceiling, Distinct Passives**: Late-game weapons & armors share comparable base power so players choose by **playstyle**, not just strict linear replacement.
- **1-Handed + Shield vs. 2-Handed Trade-off**:
  - **1H Weapons** (Oak Blade, Iron Longsword, Frost Katana, Excalibur) allow equipping a **Shield** (adds DEF, Block %, or Reflect).
  - **2H Heavy Weapons** (Sunfire Claymore, Thunder Axe, Void Scythe) lock the Shield slot in exchange for higher Crit %, cleave/chain-lightning AoE, or life-steal/burst passives.
- **Secondary Combat Stats**:
  - **Crit Rate (%) & Crit Damage**: Triggers on both overworld bump combat and Boss dash-slashes.
  - **Evasion (%)**: Triggers `MISS!` to negate counter-hits and Boss projectiles **without breaking Boss Combo**.
- **Mastery Skins (Transmog)**:
  - Polishing any gear to `LV 5 (MAX)` in a village permanently unlocks its **Skin** (+permanent mastery stat bonus) and lets players transmog its silhouette onto any other gear.

## 4. Replayability & Post-Clear Goals
- **Chapter / Episode Selector**: Replay any cleared chapter to farm Skins, chase S-Rank Speedrun Medals, or complete Achievements.
- **Speedrun Medals (S / A / B)**: Awarded based on remaining time on victory (and No-Hit Boss bonus).
- **Endless Prestige / Affix Contracts** *(Post-Mainline)*: Opt-in difficulty modifiers for higher Crystal multipliers and leaderboard scores.

## 5. Balance & Reversibility (Two-Way Door)
- All curves, costs, and multipliers live in `games/chrono-rush/src/balance.ts`.
- Automated Vitest simulations (`balance.test.ts`) verify every Chapter/Loop remains fair and beatable after any tuning.
