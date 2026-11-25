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
