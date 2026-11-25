# Neon Rush v3.2.0 - CrazyGames resubmission notes

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
