import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, "../dist-ios/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

// dist-ios/manifest.json is copied verbatim from public/manifest.json,
// which hardcodes the GitHub Pages deploy path (/game_kyo/merge10/) —
// required there for the live PWA's start_url/scope, and asserted by
// tests/unit/manifest.test.ts. That path doesn't exist inside the
// Capacitor-bundled app, so rewrite this build-output copy only.
const prefix = "/game_kyo/merge10/";
const stripPrefix = (p) => (p.startsWith(prefix) ? "./" + p.slice(prefix.length) : p);

manifest.start_url = "./";
manifest.scope = "./";
manifest.icons = manifest.icons.map((icon) => ({ ...icon, src: stripPrefix(icon.src) }));

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("Fixed dist-ios/manifest.json paths for native bundling");
