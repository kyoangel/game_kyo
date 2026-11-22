# CrazyGames submission checklist

Source of facts: `.superpowers/sdd/p2-research.md` (fetched 2026-11-21 from docs.crazygames.com). Items marked **UNVERIFIED** were not confirmed from an official page; verify them in the CrazyGames developer dashboard before relying on them.

Per game: run the `/publish-crazygames <slug>` skill (`.claude/skills/publish-crazygames/SKILL.md`). It runs `npm run publish:prep -- <slug>`, fills the developer portal with Claude in Chrome, and stops before Submit for your yes. The items below say what is automated and what still needs you.

## Automated (nothing to do by hand)

Produced by `npm run build:portals` (CI job `release-portals` runs the same command and attaches the zip to the GitHub Release `<slug>-v<version>`):

- Build contains only the CrazyGames adapter; no GameDistribution SDK (`scripts/check-artifact.ts` fails the build otherwise).
- Only external host the game may load at runtime is `sdk.crazygames.com`; no other absolute URLs (`check-artifact`).
- All asset paths are relative (`check-artifact` rejects root-absolute and protocol-relative `src`/`href` in `index.html`).
- Total size is within 10 MB (our own cap; CrazyGames Basic Launch allows up to 50 MB initial / 250 MB total / 1500 files).
- Adapter degrades gracefully: with ads disabled (Basic Launch) or SDK blocked, the game still boots and plays (adapter unit tests and the portal smoke test with fake SDK).
- `gameplayStart` / `gameplayStop` / `loadingStart` / `loadingStop` are wired through the platform adapter.

Produced by `npm run publish:prep -- <slug>` (writes `dist/publish/<slug>-crazygames.json` for the skill; exits 1 listing every problem):

- Unzipped upload files in `dist/portals/crazygames/<slug>/`. The upload zone rejects archives ("Archive files are not supported", confirmed 2026-11-22), and the `assets/` folder must keep its path.
- Covers via `npm run covers -- <slug>` into `games/<slug>/store/`: landscape 1920x1080, portrait 800x1200, square 800x800, sizes checked. They go in the Details page, never in the game-file upload zone.
- Preview videos via `npm run store-video -- <slug>`: portrait 1080x1620 (2:3) and landscape 1920x1080 (16:9), MP4, max 20 s (all confirmed by the Details page on 2026-11-22; a 720x1264 phone recording was rejected). Recorded from the local build with `games/<slug>/store/record.json`, or `--from <recording> [--top px] [--bottom px]` for your own recording. The whole game frame is fitted over a blurred fill, never cropped.
- Form values from `game.json`: name, progress-save option, mobile orientation, category, tags, description, controls (`store.controls` + `store.crazygames`).
- Refuses a version already submitted (bump `version` first).
- After your confirmed submit: `npm run mark-released -- <slug> crazygames submitted` sets `releases.crazygames`.

## Manual: before uploading

- [ ] Look at each cover PNG and the video frames the skill shows you (no borders, only the title text, no store logos or icons).
- [ ] If file upload from the repo is refused or flattens `assets/`, drag the contents of `dist/portals/crazygames/<slug>/` into the upload zone yourself.

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
- [ ] Real phone run via **Show QR Code** (the skill asks you; it cannot test a phone).
- [ ] Local testing alternative: `localhost` / `127.0.0.1` run the SDK in `local` mode; add `?useLocalSdk=true` on other hosts.

## Manual: after submitting

- [ ] Confirm the final Submit in chat (the skill never ticks Terms/PEGI or submits on its own); it then runs `npm run mark-released -- <slug> crazygames submitted`, commits and pushes.
- [ ] On approval run `npm run mark-released -- <slug> crazygames basic` (Basic Launch, no revenue share) or `full`; on rejection `npm run mark-released -- <slug> crazygames rejected --reason "<text>"`.
- [ ] Basic Launch has no ads or monetisation; Full Launch (selected games) requires the SDK integration above. Payout is monthly once the balance reaches EUR 100 (CrazyGames FAQ).

## Unverified facts (do not rely on them)

- Whether the SDK may be bundled instead of CDN-loaded (we load it from the CDN).
- Zip layout expected by the upload form.
- CrazyGames policy on other external network requests (docs only forbid external ads and cross-promo links).
- Sync vs async behaviour of `SDK.data.getItem` (the adapter awaits it, which works for both).
