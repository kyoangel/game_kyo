# dodge-drop assets

Only CC0-1.0 files may ship. Every file under `public/assets/` needs an entry in
`manifest.json` (`file`, `license: "CC0-1.0"`, `author`, `sourceUrl` (https),
`licenseUrl`, `retrievedAt` (YYYY-MM-DD), `sha256`; optional `notes` and `credit`
strings, e.g. an author's requested-but-optional credit line).

- Get the hash with `shasum -a 256 <file>`.
- `npm run check:assets` (also run by `npm test` via `scripts/check-assets.test.ts`) fails on any
  file without a complete entry, a wrong hash, or a non-CC0 license.
- The manifest lives outside `public/` so source URLs never enter the built artifact
  (the URL scan in `scripts/check-artifact.ts` covers `.json`).
- Extracting the template: copy `public/assets`, `assets/manifest.json`, `scripts/check-assets.ts`.
- With no assets present the checker passes and the game uses its procedural art/audio.

## Art (Task 3.2, retrieved 2026-11-25)

Packs, all by Kenney (Kenney Vleugels), each pack page and the pack's own `License.txt` say CC0:
Particle Pack 1.1 (https://kenney.nl/assets/particle-pack), Simple Space
(https://kenney.nl/assets/simple-space), UI Pack: Sci-fi 2.0 (https://kenney.nl/assets/ui-pack-sci-fi;
its Download button delivers `kenney_ui-pack-space-expansion.zip`, whose License.txt is titled
"UI Pack: Sci-fi (2.0)"). Style: white or lightly tinted glow shapes, tinted to the neon palette in code.
`scripts/lib/build-art.py` (needs Pillow) regenerates every PNG from the unzipped packs; zips and
unused pack files are not committed. The logo is own lettering rendered from Orbitron (SIL OFL 1.1,
google/fonts); the font file is not shipped.

| File | Texture key | Source |
|---|---|---|
| star.png | dd-star | Particle Pack star_06 |
| shield.png | dd-shield | Particle Pack circle_03 |
| ring.png | dd-ring | Particle Pack circle_02 |
| bg-far.png / bg-mid.png | dd-bg-far / dd-bg-mid | seamless 512x512 star tiles (Simple Space + Particle Pack) |
| panel-art.png | dd-panel-art | landscape side-panel decoration |
| ui-panel.png, ui-button.png, ui-button-depth.png | dd-panel, dd-button, dd-button-depth | UI Pack: Sci-fi |
| logo.png | dd-logo | Orbitron lettering "NEON RUSH" |

Player skins and blocks stay procedural (shape-coded, tinted per skin; plan Task 3.2 step 2).

## Music and SFX (Task 3.3, retrieved 2026-11-25)

**Needs listening check (Task 3.9): nothing below was auditioned.** Choices were made from
filenames, pack themes, duration and loudness stats only. Loudness normalisation is Task 3.9.

Music: three Pro Sensory (Alex McCulloch) synthwave tracks on OpenGameArt, each item page lists
License(s): CC0 (author asks for optional credit; recorded in `credit`). Loops are bar-aligned cuts
(tempo and beat phase estimated with a low-band onset comb), a 0.3 s equal-power crossfade of the
continuation after the cut onto the loop start, 112 kbps joint-stereo mp3. Note: mp3 encoder delay
(~25 ms) may leave a tiny gap at the loop point in WebAudio; check in 3.6/3.9.

| File | Source track (page) | Cut | Why |
|---|---|---|---|
| music-normal.mp3 (48 s) | Synth Wave (/content/synth-wave) | 24.4-72.4 s, 80 BPM | slowest track, steady mid-energy section before its breakdown |
| music-rush.mp3 (48 s) | 80's Synth Wave (/content/80s-synth-wave) | 88.5-136.5 s, 120 BPM | faster tempo, high-energy middle |
| music-overdrive.mp3 (48 s) | Space Synth Wave (/content/space-synth-wave) | 84.2-132.2 s, 160 BPM (double time of 80) | fastest pulse; this track is quieter overall, so it may need gain in 3.9 |
| music-chomp.mp3 (32 s) | 80's Synth Wave | 160.5-192.5 s, 120 BPM | loudest section, different from rush; fit for chomp is a guess |

SFX (Kenney, mono 128 kbps, leading silence trimmed), file to `SfxName`:

| SfxName | Source | Why |
|---|---|---|
| nearMiss | Digital Audio phaserUp5 (0.22 s) | shortest rising phaser; pitched via playbackRate |
| pickup | Digital Audio powerUp2 (0.35 s) | classic power-up blip |
| shield | Sci-Fi Sounds forceField_000 (0.95 s) | force-field energy hum |
| shieldBreak | Sci-Fi Sounds explosionCrunch_000 (0.78 s) | crunchy burst |
| death | Digital Audio lowDown (0.65 s) | descending tone |
| medal | Interface Sounds confirmation_002 (0.54 s) | multi-note confirm |
| click | Interface Sounds click_003 (7 ms) | UI click; very short, may be inaudible after mp3 padding |
| rush | Digital Audio highUp (0.40 s) | rising sweep |
| newBest | Digital Audio zapThreeToneUp (1.1 s) | rising three-tone fanfare |
