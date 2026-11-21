# GameDistribution submission checklist

Source of facts: `.superpowers/sdd/p2-research.md` (GD-HTML5 GitHub wiki, fetched 2026-11-21). Official size limits, thumbnail specs and revenue terms were NOT found; those items are **UNVERIFIED** and must be read from the dashboard (https://developer.gamedistribution.com).

Per game: work top to bottom, then update `games/<slug>/game.json` `releases.gamedistribution` and run `npm run release-status`.

## Automated (nothing to do by hand)

Produced by `npm run build:portals` (CI job `release-portals` attaches the zip to the GitHub Release `<slug>-v<version>`):

- Build contains only the GameDistribution adapter; no CrazyGames SDK (`scripts/check-artifact.ts`).
- Only external host the game loads at runtime is `html5.api.gamedistribution.com`; no other absolute URLs (`check-artifact`). The GD SDK itself loads ad-network scripts from other domains at runtime; that is outside our bundle and expected.
- All asset paths relative; total size within 10 MB (`check-artifact`).
- `GD_OPTIONS` (gameId + event handler) is set before the SDK script loads; rewards are granted only on `SDK_REWARDED_WATCH_COMPLETE`; pause/mute follows `SDK_GAME_PAUSE` / `SDK_GAME_START` (adapter unit tests + portal smoke with fake SDK).
- **A GameDistribution zip is only built for games that have `portalIds.gamedistribution` in `game.json`.** Until then `npm run build:portals` prints a SKIP warning for that game and CI stays green.

## Manual: getting a gameId and building the zip

- [ ] Create a developer account and register the game in https://developer.gamedistribution.com to obtain its **gameId** (a hash). **UNVERIFIED:** whether the id is issued before the first zip upload; if the dashboard demands a zip first, build a throwaway one with `GD_GAME_ID=placeholder node scripts/build-games.ts gamedistribution` (output in `dist/gamedistribution/<slug>`), upload it, then rebuild with the real id.
- [ ] Add the id to `games/<slug>/game.json`: `"portalIds": { "gamedistribution": "<gameId>" }`, commit, push. After the push, CI builds `<slug>-gamedistribution-v<version>.zip` and attaches it to the existing `<slug>-v<version>` release (existing zips are never overwritten, so no version bump is needed).
- [ ] Upload the zip on the Upload tab of the developer dashboard. **UNVERIFIED:** whether `index.html` must be at the zip root (we ship it at the root).
- [ ] Rewarded ads: if the game uses rewarded ads, enable the **Rewarded Ads** flag for the game in the dashboard (documented requirement); otherwise `preloadAd('rewarded')` rejects and the adapter resolves `unavailable`.

## Manual: SDK activation and listing

- [ ] Activate the SDK: in the dashboard's iframe preview, watch one video ad all the way through; the SDK flag then turns active. Disable ad blockers while doing this.
- [ ] Local testing: ads generally do not show locally; use `gdsdk.openConsole()` in the browser console (select the right frame when iframed). We never set `advertisementSettings.debug`.
- [ ] Interstitials must be triggered from a user gesture (GD docs: call `showAd()` from a mouseup / touchend handler). Confirm the game's ad moments (game over, retry) follow a tap or key press; otherwise the ad may silently not show.
- [ ] Game title, description, instructions and tags entered (from `game.json`).
- [ ] Thumbnails / screenshots uploaded. **UNVERIFIED:** required sizes (GD docs not found); prepare them by hand (no cover-rendering script exists yet).
- [ ] No other portal's branding, no external links (the adapter sets `features.externalLinks = false`).
- [ ] Game pauses and mutes during ads, and works with ads unavailable.
- [ ] Request publication. **UNVERIFIED / conflicting:** review time is "up to 2 days" (FAQ) vs "up to two weeks" (SDK wiki).

## Manual: after submitting

- [ ] Set `releases.gamedistribution = { "status": "submitted", "version": "<version>", "submittedAt": "<YYYY-MM-DD>" }` in `game.json`, commit, push. Use `live` once it is published, or `rejected` with a `reason`.

## Unverified facts (do not rely on them)

- Revenue share (a third-party source says 33% of net revenue) and payout minimum (EUR 50 per GD FAQ vs EUR 100 per a third party).
- Maximum zip size, accepted thumbnail sizes, any ban on external links.
- Raw type string for interstitial and display ads (the adapter uses the default `showAd()` with no argument for interstitials).
