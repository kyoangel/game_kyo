# Neon Swarm（霓虹蜂群）— Design Draft

Status: brainstorming paused 2026-11-21 after section 1 (user approved section 1; resume with section 2).

## Decisions so far
- Genre: survivor-like (auto-attack, swarms, level-up pick 1 of 3). Original theme/art — same genre, no copying of a specific game.
- Art: neon geometry, fully procedural (Phaser 3.88 built-in postFX glow/bloom, particles). No external art assets.
- Scope v1: single run + in-run upgrades only (no meta progression).
- Architecture approach A: shared juice layer in `@gf/game-kit` — `fx` (particles, shake, hit-stop, flash, popups, glow), `audio` (procedural WebAudio SFX + music, auto-mute on ad pause), `input` (virtual joystick + WASD/arrows). Genre-specific logic (weapons, enemies, upgrades) stays in the game folder.

## Section 1 — the game (approved)
- Slug `neon-swarm`. Player = glowing shape, joystick/keyboard move, weapons auto-fire. Enemies swarm from all sides; kills drop XP crystals; level-up = choose 1 of 3.
- Run ≈ 5 min: difficulty step every 30 s, mini-boss 2:30, boss 5:00 (kill = win).
- Content: ~6 weapons (orbit orbs, homing missiles, laser, pulse AoE, bouncing blade, mines), ~4 passives (move speed, attack speed, pickup radius, max HP), weapons up to Lv5; ~5 enemy types + 1 boss.
- Ads: rewarded revive (once per run), rewarded reroll at level-up, interstitial after run (adapter frequency cap decides).
- Orientation `any` (camera follows player).
- Perf: up to ~300 enemies, object pooling, spatial-grid collision.

## Next (when resumed)
- Section 2: game-kit fx/audio/input API design.
- Then sections: game structure, testing, error handling → spec → plan.
