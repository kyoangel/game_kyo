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
