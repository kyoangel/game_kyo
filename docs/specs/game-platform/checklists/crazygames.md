# CrazyGames submission checklist

Source of facts: `.superpowers/sdd/p2-research.md` (fetched 2026-11-21 from docs.crazygames.com). Items marked **UNVERIFIED** were not confirmed from an official page; verify them in the CrazyGames developer dashboard before relying on them.

Per game: copy this list into your notes, work top to bottom, then update `games/<slug>/game.json` `releases.crazygames` and run `npm run release-status`.

## Automated (nothing to do by hand)

Produced by `npm run build:portals` (CI job `release-portals` runs the same command and attaches the zip to the GitHub Release `<slug>-v<version>`):

- Build contains only the CrazyGames adapter; no GameDistribution SDK (`scripts/check-artifact.ts` fails the build otherwise).
- Only external host the game may load at runtime is `sdk.crazygames.com`; no other absolute URLs (`check-artifact`).
- All asset paths are relative (`check-artifact` rejects root-absolute and protocol-relative `src`/`href` in `index.html`).
- Total size is within 10 MB (our own cap; CrazyGames Basic Launch allows up to 50 MB initial / 250 MB total / 1500 files).
- Adapter degrades gracefully: with ads disabled (Basic Launch) or SDK blocked, the game still boots and plays (adapter unit tests and the portal smoke test with fake SDK).
- `gameplayStart` / `gameplayStop` / `loadingStart` / `loadingStop` are wired through the platform adapter.

## Manual: before uploading

- [ ] Zip is `dist/release/<slug>-crazygames-v<version>.zip` (download from the GitHub Release or run `npm run build:portals`). **UNVERIFIED:** whether CrazyGames wants `index.html` at the zip root (we ship it at the root); confirm on the upload form.
- [ ] Covers prepared by hand (no cover-rendering script exists yet): landscape 1920x1080, portrait 800x1200, square 800x800 (all three required; no borders, only the title text, no store logos or icons). **UNVERIFIED:** exact sizes; confirm on the upload form.
- [ ] Description and controls text entered (taken from `game.json` `description` / `instructions` / `controls`); English is required.
- [ ] Orientation chosen in the form to match `game.json` `orientation` (the dashboard setting, not game logic).
- [ ] Game is playable with mouse + keyboard, and with touch if `controls` lists touch; no custom fullscreen button.
- [ ] Legible at 16:9 iframe sizes from 907x510 up to 1920x1080 and mobile 800x450 (check in the preview).
- [ ] No other portal's branding, no cross-promotion, no store links, no external links (the adapter sets `features.externalLinks = false`; confirm the game shows none).
- [ ] If the game saves progress: tick the **Progress Save** option at submission, otherwise the data module reports `dataModuleDisabled` and saves silently fall back to localStorage. **UNVERIFIED:** exact label and location of this toggle in the dashboard.
- [ ] Mobile: `user-select: none` on body and safe-area padding (check on a phone-sized preview).
- [ ] Time to first gameplay is short (QA checks <= 20 s for externally hosted files; initial size is measured until the first `gameplayStart`).

## Manual: verify in the CrazyGames Preview tool (https://crazygames.com/preview)

- [ ] Midgame ad: game pauses and mutes at `adStarted`, resumes and unmutes at `adFinished` / `adError`; UI is blocked until one fires.
- [ ] Rewarded ad: reward granted only after `adFinished`, never on `adError`; the rewarded button is hidden or clearly unavailable when no ad can show.
- [ ] Game works with an ad blocker on (no freeze, no dead buttons, no adblock popups).
- [ ] Local testing alternative: `localhost` / `127.0.0.1` run the SDK in `local` mode; add `?useLocalSdk=true` on other hosts.

## Manual: after submitting

- [ ] Set `releases.crazygames = { "status": "submitted", "version": "<version>", "submittedAt": "<YYYY-MM-DD>" }` in `game.json`, commit, push.
- [ ] On approval set `status` to `basic` (Basic Launch, no revenue share) or `full`; on rejection set `rejected` with a `reason`.
- [ ] Basic Launch has no ads or monetisation; Full Launch (selected games) requires the SDK integration above. Payout is monthly once the balance reaches EUR 100 (CrazyGames FAQ).

## Unverified facts (do not rely on them)

- Whether the SDK may be bundled instead of CDN-loaded (we load it from the CDN).
- Zip layout expected by the upload form.
- CrazyGames policy on other external network requests (docs only forbid external ads and cross-promo links).
- Sync vs async behaviour of `SDK.data.getItem` (the adapter awaits it, which works for both).
