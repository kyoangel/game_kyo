# Neon Rush v3.6.0 - CrazyGames resubmission notes

Plan: `docs/plans/2026-11-23-dodge-drop-v3-crazygames-resubmit.md`. Previous submission: v2.8.4, rejected 2026-11-22
("The overall quality of the game does not yet meet the expectations of our platform"). The rejection record stays in
`games/dodge-drop/game.json` `releases.crazygames` for history; `publish:prep` accepts a `rejected` entry
(`scripts/publish-payload.ts:58`), so it was not reset.

## Changelog

v3.0.0 - adaptive landscape/portrait layout for the 16:9 player (full play field plus readable side-panel HUD), new
authored CC0 art, music and sound effects, a visual first-run control tutorial, a persistent next-medal goal bar, bigger
touch targets, and Shop cards that describe the next upgrade level.

v3.1.0 - in-run pause menu (pause button, Esc / P, auto-pause when the tab or app loses focus) with Resume and End run
(settles to the results, stars kept); title and results quick-buy boosts can be undone with a second tap for a full
refund; web favicon and apple-touch-icon.

v3.2.0 - faster medal pacing: Bronze at 15 s, Silver at 30 s, Gold at one minute (start tiers follow); start chips read
"Bronze / Silver / Gold start"; zh-TW medal names unified as 銅杯 / 銀杯 / 金杯 / 霓虹杯 / 鑽石杯 / 傳奇杯.

v3.3.0 - survival time is the only result (no score, no combo multiplier): the HUD headline is the run clock, results
show the time and best time, star coins = stars + 1 per 5 s survived. Near misses fill an 8-segment graze gauge; a full
gauge turns the player into Chomp mode (4 s, +0.5 s per "Longer Chomp" level, which replaces "Steady Combo"). Score and
combo missions replaced by "Chomp N times in one run" and "Eat N blocks in one run". Head-start points removed.

v3.4.0 - no more wall camping: standing still for 3 s drops one block aimed at the player's spot (red warning chevron,
only placed when a way through remains). The death flash covers the whole landscape screen, side panels included.

v3.5.0 - music with a sense of speed: runs open on the 120 BPM synthwave loop (the 80 BPM loop is gone), rushes and
Overdrive use the 160 BPM loop, and the music tempo rises with the run (x1.0 to x1.25 by Overdrive). Aimed block
narrowed to 90 px.

v3.6.0 - every block eaten in Chomp is a star; Chomp plays an original upbeat chiptune; a 3-2-1 countdown (banner
and ticks) before every rush, surge and Overdrive, and rushes ease in over 1 s instead of jumping; stronger upgrades:
graze window 34 px base (54 px at max), Longer Chomp +0.8 s per level (8 s at max), Shield Core interval x0.9 per level.
Plan: `docs/plans/2026-11-25-dodge-drop-time-only-graze-chomp.md`.

## What changed since v2.8.4 (paste into the portal notes)

Thank you for the feedback on v2.8.4. We treated "overall quality" as a call for a clearly better game, not a small
tweak, and rebuilt the parts a new player sees first:

- Landscape and portrait layouts. On a 16:9 desktop player the whole play field stays centred at full height and the
  score, timer, combo, goal bar, missions and shields move into large, readable side panels (checked from 800x450 to
  1920x1080). Phones in portrait keep the familiar thumb-friendly layout.
- New art, music and sound effects. Authored, consistent neon look with a new logo, parallax backdrop and panel art;
  four music loops and a full set of sound effects, levelled to a consistent volume. All assets are CC0 and recorded in a
  license manifest.
- First-run tutorial. A short on-screen demonstration (ghost finger on touch, arrow keys on desktop) shows how to move,
  then disappears on the first input and is never shown again once the controls have been used.
- Next-medal goal bar. During every run a progress bar shows the next medal (Bronze, Silver, ...) and how close you are.
  Medals come quickly at first (Bronze 15 s, Silver 30 s, Gold 1 min) so a new player earns one in the first run.
- Bigger touch targets. Buttons and menu rows meet a minimum tap size on phones.
- Pause menu. A pause button next to the sound icon (or Esc / P) freezes the run; leaving the tab or app pauses it
  automatically. Resume continues, End run goes straight to the results and keeps the stars collected.
- Time is the score. No abstract points: the big number is how long you survived, and grazing blocks charges a gauge
  that turns you into a block-eating Chomper, so taking risks pays off in play instead of in points.
- Undo for boosts. Tapping an equipped next-run boost again refunds it, so a mis-tap never costs stars.
- Clearer Shop. Upgrade cards now show what the next level gives instead of "0 px" / "0%" on level 0.

Gameplay rules, speeds and fairness are unchanged. The build is about 4.8 MB, loads to an interactive canvas in about
2 s on simulated Fast 4G, and uses no external URLs and no custom fullscreen button.

## Status

Task 4.1 verification passed (all suites green; independent haiku run, PROPERTY_SEEDS=300). Store videos re-recorded
without the local-build fullscreen button; landscape field backdrop bug fixed (commit 190a78a). Nothing submitted.

## Resubmission checklist (the user does each step; Claude stops before Submit)

- [ ] Listening check: `games/dodge-drop/assets/README.md` "Listening checklist (Task 3.9)" on
      https://kyoangel.github.io/game_kyo/dodge-drop/ (music seams, rush/overdrive switches, each SFX).
- [ ] Look at the store media: `games/dodge-drop/store/*.png` and `dist/store/dodge-drop/*.mp4`
      (re-create videos with `npm run store-video -- dodge-drop` if `dist/` was cleaned).
- [ ] CrazyGames Preview tool (https://crazygames.com/preview): portrait and landscape, 800x450 and 1920x1080
      iframe sizes, ad blocker on, mobile via QR.
- [ ] Progress Save option ticked ("Yes, using the Data Module"), orientation BOTH.
- [ ] Upload `dist/portals/crazygames/dodge-drop/` (or `dist/release/dodge-drop-crazygames-v3.0.0.zip`), assets/ path preserved.
- [ ] Covers and videos attached; "What changed since v2.8.4" pasted into the submission notes.
- [ ] Confirm whether the old listing/slug is reused and any cooldown (UNVERIFIED): developer portal or CrazyGames support.
- [ ] Run `/publish-crazygames dodge-drop` (it fills the portal and stops before Submit); the USER clicks Submit.
- [ ] After submit: `npm run mark-released -- dodge-drop crazygames submitted`; on the result
      `npm run mark-released -- dodge-drop crazygames basic|full` or `rejected --reason "<text>"`.
- [ ] Optional (gap analysis): 3-5 unseen players for 5 minutes each; record findings here.

Known leftovers (not blocking): portrait goal label ~13.5 css px on a 375 px phone; unused shipped PNGs
(`star.png`, `shield.png`, `ui-*.png`) and `sfx-click.mp3` (synth click is used) could be removed to trim ~100 KB.
