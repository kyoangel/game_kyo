# Neon Rush v3.0.0 - CrazyGames resubmission notes

Plan: `docs/plans/2026-11-23-dodge-drop-v3-crazygames-resubmit.md`. Previous submission: v2.8.4, rejected 2026-11-22
("The overall quality of the game does not yet meet the expectations of our platform"). The rejection record stays in
`games/dodge-drop/game.json` `releases.crazygames` for history; `publish:prep` accepts a `rejected` entry
(`scripts/publish-payload.ts:58`), so it was not reset.

## Changelog

v3.0.0 - adaptive landscape/portrait layout for the 16:9 player (full play field plus readable side-panel HUD), new
authored CC0 art, music and sound effects, a visual first-run control tutorial, a persistent next-medal goal bar, bigger
touch targets, and Shop cards that describe the next upgrade level.

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
- Bigger touch targets. Buttons and menu rows meet a minimum tap size on phones.
- Clearer Shop. Upgrade cards now show what the next level gives instead of "0 px" / "0%" on level 0.

Gameplay rules, speeds and fairness are unchanged. The build is about 4.8 MB, loads to an interactive canvas in about
2 s on simulated Fast 4G, and uses no external URLs and no custom fullscreen button.

## Status

Task 4.1 verification passed (all suites green). Resubmission checklist is added in Task 4.4.
