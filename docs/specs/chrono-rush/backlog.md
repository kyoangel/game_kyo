# Chrono Rush — Feature Backlog

## Completed (v0.1 – v0.4)
- [x] Core 30s overworld bump combat, dash, village blacksmith polish (`[1]/[2]`), paid inn heal (`[3]`)
- [x] Side-scrolling Boss Throne Room with Dash-Slash CRIT, Jump, Combo Gauge, and Attack Telegraph lanes
- [x] Time Goddess once-per-run revive (`+10s` & Full HP) via `@gf/game-kit`
- [x] 3 extensible Chapters (`Chrono Quest`, `Frost Chronicle`, `Inferno Saga`, Loops 1–15) with solid obstacles & 3 distinct Bosses
- [x] 7 Weapons & 7 Armors with unique pixel silhouettes + LV 5 Mastery Skin unlock & transmog
- [x] Centralized `balance.ts`, Loop 1–15 automated balance tests, and Defeat Coaching Hints

## Next Milestones (Prioritized)

### Milestone 1 — Combat Depth & Horizontal Build Craft (Completed)
- [x] Add **Crit Rate (%)** and **Evasion (%)** stats + Camp talents (`鷹眼 / Crit Eye`, `疾影步 / Evasion`)
- [x] Evasion `MISS!` floating feedback (preserving Boss Combo on dodged fireballs!)
- [x] **1-Handed + Shield vs. 2-Handed** equipment slot system (4 Shields with distinct stats & off-hand pixel visuals)
- [x] Rebalance late-game weapons/armors for **horizontal sidegrade passives** (Frost slow, Thunder chain AoE, Void lifesteal, Shadow evasion)

### Milestone 2 — Progressive Chapter Map Mechanics & Gold Economy (Completed)
- [x] Scale village polish/heal gold costs with loop + add **`[4] Battle Elixir`** (`+15%` stackable Boss DMG gold sink)
- [x] **Chapter 2 (Loops 6–10)**: Upper Risk Path vs. Lower Merchant Path with dual roads & visual signposts
- [x] **Chapter 3 (Loops 11–15)**: Interactive Map POIs — **Time Crystal** (`+4s`), **Power Shrine** (`+25% Boss DMG`), **Shortcut Portal** (warp to Castle gate)

### Milestone 3 — Chapter Select, Medals & Pre-Run Boosts (Completed)
- [x] Centralized `FEATURES` toggles in `balance.ts` so any mechanic can be cleanly turned off
- [x] Sqrt Crystal curve + 4 **Pre-Run Crystal Boosts** (`Wind Pact`, `Chrono Dust`, `Slayer Oil`, `Gold Pouch`)
- [x] **Chapter / Episode Selector** in Camp (`STAGES` tab) so players can replay any unlocked episode
- [x] **S / A / B Speedrun Medals** per Episode + Best Remaining Time tracking

### Milestone 4 — CrazyGames Polish & Expansion
- [ ] Mobile touch UX polish (dedicated Jump/Dash buttons in Boss Arena or Tap-to-Move toggle)
- [ ] Chapters 4–10 content expansion + Endless Contract Affixes
- [ ] Full CrazyGames viewport RWD & E2E smoke test suite
