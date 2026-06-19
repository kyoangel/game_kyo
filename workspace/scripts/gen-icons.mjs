import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "../public/icons/icon.svg");
const outDir = join(__dirname, "../public/icons");
const svg = readFileSync(svgPath);

await Promise.all([
  sharp(svg).resize(192, 192).png().toFile(join(outDir, "icon-192.png")),
  sharp(svg).resize(512, 512).png().toFile(join(outDir, "icon-512.png")),
  sharp(svg).resize(180, 180).png().toFile(join(outDir, "apple-touch-icon.png")),
]);
console.log("Generated: icon-192.png, icon-512.png, apple-touch-icon.png");
