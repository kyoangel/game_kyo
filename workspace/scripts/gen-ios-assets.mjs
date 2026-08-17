import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "../public/icons/icon.svg");
const outDir = join(__dirname, "../../../merge10-ios/resources");
mkdirSync(outDir, { recursive: true });

// iOS app icons must be a full opaque square with no baked-in corner
// radius — the OS applies its own mask, so strip the rx from the source.
const svg = readFileSync(svgPath, "utf-8").replace(/rx="80"/, 'rx="0"');
const bg = "#111827";

await sharp(Buffer.from(svg))
  .resize(1024, 1024)
  .flatten({ background: bg })
  .png()
  .toFile(join(outDir, "icon.png"));

// Splash: icon artwork (with its original rounded corners) centered on a
// plain full-bleed background matching the game's theme.
const roundedSvg = readFileSync(svgPath, "utf-8");
const iconForSplash = await sharp(Buffer.from(roundedSvg)).resize(760, 760).png().toBuffer();

await sharp({
  create: { width: 2732, height: 2732, channels: 4, background: bg },
})
  .composite([{ input: iconForSplash, gravity: "center" }])
  .flatten({ background: bg })
  .png()
  .toFile(join(outDir, "splash.png"));

console.log("Generated:", outDir, "-> icon.png, splash.png");
