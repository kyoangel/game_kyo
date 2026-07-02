# Pixel Squad — Game Design Document

> **Status:** Phase 1 approved for implementation. Phases 2–4 recorded for future reference.

---

## Game Overview

**Name:** Pixel Squad  
**Genre:** Turn-based pixel-art RPG battle game  
**Platform:** Web browser (desktop + mobile PWA)  
**Deployment:** `kyoangel.github.io/game_kyo/pixel-squad/`  
**Repo path:** `workspace-pixel-squad/` (same monorepo as merge10 / merge10x)  
**Tech stack:** Phaser.js + TypeScript + Vite  

**Premise:** A post-apocalyptic wasteland. The player builds a squad of survivors and battles fixed enemy stages. Characters grow stronger between battles. Named enemies can be recruited after defeat.

---

## World & Theme

- **Setting:** 末日廢土 (post-apocalyptic wasteland) — collapsed cities, mutant factions, rogue AI militias
- **Visual style:** Pixel art, dark palette, neon accents (cyberpunk-meets-wasteland)
- **Tone:** Gritty but readable; HP bars and UI are clear over atmosphere

---

## Character System (all phases)

### Roster
- **1 custom protagonist** — player sets name; unique personal skill; manual stat point allocation on level up
- **Fixed survivor pool** — pre-designed NPC characters with names, backstories, fixed stat growth curves
- **Recruitable enemies** — named enemies with a face/portrait can join the pool after being defeated in battle
- Total pool size grows as the game progresses; player picks up to 5 for each battle

### Stats
| Stat | Description |
|------|-------------|
| HP | Health points; reaches 0 = knocked out |
| ATK | Determines base damage dealt |
| DEF | Reduces incoming damage |
| SPD | Higher SPD acts earlier in turn order |

### Derived Archetype Label (UI only)
The UI auto-labels each character based on their dominant stat distribution:
| Label | Condition |
|-------|-----------|
| 坦克 Tank | High HP + High DEF |
| 輸出 DPS | High ATK |
| 狙擊 Sniper | High SPD + moderate ATK |
| 輔助 Support | Balanced stats + healing/buff skill |
| 全能 All-rounder | No dominant stat |

Labels are cosmetic — stats are the source of truth.

---

## Progression System (all phases)

### Leveling
- All characters earn EXP after each battle
- EXP threshold per level scales with a simple curve
- On level up:
  - **Protagonist:** gains N stat points to allocate freely across HP/ATK/DEF/SPD
  - **Other characters:** stats grow automatically per their fixed growth curve

### Equipment (Phase 3)
- Equipment contributes ~50% of total power growth (leveling contributes the other 50%)
- Sources: stage drops, merchant shops
- Slots: weapon, armor, accessory

---

## Skill System (all phases)

### Skill Types
1. **Archetype skill** — unlocked when a stat crosses a threshold (e.g., ATK ≥ 30 → unlocks 爆發射擊 Burst Shot)
2. **Character unique skill** — each named character has one personal skill baked in

### Skill Acquisition & Swapping (Phase 3)
- Additional skills can be found as drops or purchased
- Each character has a limited number of equippable skill slots
- Skills can be swapped freely outside of battle

---

## Battle System

### Format
- **1v1 to 5v5** — variable party sizes; empty slots simply don't participate
- Player party: left side; enemy party: right side
- Characters displayed as pixel sprites standing on platforms, with name and HP bar

### Turn Order
- Each round: all living characters sorted by SPD descending
- Ties broken by: player characters act before enemies (player-friendly tie-break)
- Turn order shown in a queue display at the bottom of the screen

### Player Action Menu (per character's turn)
| Action | Description |
|--------|-------------|
| 總攻擊 | **Protagonist only.** Auto-selects randomly between normal attack or an attack skill. For fast grinding. |
| 攻擊 | Normal attack against a selected enemy |
| 技能 | Use one of the character's equipped skills |
| 防禦 | Skip attack; reduce incoming damage this round by 50% |

### Damage Formula
```
damage = ATK × 1.0 − DEF × 0.5
minimum damage = 1  (DEF can never fully negate damage)
```

### Enemy AI (Phase 1: simple)
- Targets the player character with the lowest current HP
- Always uses normal attack (Phase 1)
- Phase 2+: varied AI patterns per enemy type

### Win / Loss
- **Victory:** all enemy HP = 0
- **Defeat:** all player HP = 0
- Post-battle screen shows result + EXP gained + (Phase 2+) loot

---

## Campaign Structure (all phases)

| Phase | Content |
|-------|---------|
| Phase 1 | 3 fixed test stages, linear, hardcoded |
| Phase 2 | Main story chapters (linear) |
| Phase 3 | Side locations on world map (optional, branching) |
| Phase 4 | Endless challenge mode — unlocked after all side content cleared |

---

## Phase Roadmap

### Phase 1 — Battle Engine MVP ✅ (current)
**Goal:** Core battle loop running end-to-end in browser.

In scope:
- Phaser.js + TypeScript + Vite project scaffolding in `workspace-pixel-squad/`
- PWA setup (manifest.json, apple-touch-icon, viewport meta)
- Battle screen: left/right layout, pixel sprites (placeholder art), HP bars, name labels
- Turn order system (SPD-based) with queue display
- Player action menu: 總攻擊 (protagonist only) / 攻擊 / 技能 / 防禦
- Damage formula: `ATK − DEF×0.5`, min 1
- Simple enemy AI (target lowest-HP player, normal attack only)
- Victory / defeat result screen
- 3 hardcoded test characters (protagonist + 2 survivors)
- 3 hardcoded test stages (difficulty ramp)
- 1 archetype-based skill per character (attack type)
- EXP gain after battle + protagonist stat allocation screen (basic)
- CI/CD: add pixel-squad build + deploy step to `deploy.yml`

Out of scope for Phase 1:
- Equipment system
- Skill acquisition / swapping
- Enemy recruitment
- World map
- Story text / dialogue
- Merchant / shop
- Sound effects / music
- Full pixel art (placeholder art acceptable)

### Phase 2 — Progression Redesign + Campaign

#### 整備畫面（PrepScene）— replaces AllocateScene

**Flow:** ResultScene → PrepScene → BattleScene

**Experience Pool:**
- All battle EXP goes into a shared `expPool: number` (carried in playerParty data)
- On victory: `expPool += stage.expReward`
- PrepScene consumes expPool to level up characters

**Level-up mechanics (decoupled from UI via `LevelUpConfig`):**
```
LevelUpConfig:
  protagonist:
    pointsPerLevel: 5          ← freely allocated by player
  nonProtagonist:
    pointsPerLevel: 5          ← all random; future: support { min: 3, max: 6 } range
  expFormula: (level) => level * 50
```
- Player may level the same character multiple times in one prep session (if pool allows)
- Protagonist → manual point allocation panel
- Non-protagonist → 5 points randomly distributed across hp/atk/def/spd, shown as summary

**PrepScene UI:**
```
┌─────────────────────────┐
│  整備                    │
│  經驗池：[████░░] 320 EXP│
├─────────────────────────┤
│  [角色1] Lv3  需 150 EXP │  ← tap to level up (repeatable)
│  [角色2] Lv2  需 100 EXP │
│  [角色3] Lv1  需  50 EXP │
├─────────────────────────┤
│         [出發]           │
└─────────────────────────┘
```
- Character rows show current level + EXP needed for next level
- Insufficient EXP → button disabled, "EXP 不足" indicator
- 出發 → proceeds to next BattleScene regardless of leftover pool EXP

**Deferred features (unlock via in-game events/rewards in later phases):**
- 許願屬性（Wish Stat）: per-character guaranteed stat direction on level-up; reserved for event/reward unlock

#### Campaign
- Multiple story chapters with stage select
- Pre-battle squad selection screen (pick 5 from pool)
- Post-battle loot (basic drops)
- Survivor pool (5–10 pre-designed characters)
- Enemy AI improvements (varies by enemy type)

### Phase 3 — Equipment + Skills + Recruitment
- Equipment system (weapon/armor/accessory slots)
- Skill drop system + swapping UI
- Named enemy recruitment after defeat
- World map with side locations
- Merchant/shop screen

### Phase 4 — Endgame + Polish
- Endless challenge mode (post all-side-content)
- Full pixel art for all characters
- Sound effects + background music
- Save/load (localStorage)
- Balance pass across all stages

---

## Technical Notes

- `workspace-pixel-squad/` is a fully isolated Vite workspace; no shared dependencies with merge10 or merge10x
- Phaser.js version: 3.x (latest stable)
- Deploy target: `kyoangel.github.io/game_kyo/pixel-squad/`
- Vite base: `/game_kyo/pixel-squad/`
- PWA: same pattern as merge10 (manifest.json, icons/, apple-touch-icon)
- `.superpowers/` added to `.gitignore`
