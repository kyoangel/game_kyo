// scripts/check-assets.ts
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Entry { file: string; license: string; author: string; sourceUrl: string; licenseUrl?: string; retrievedAt: string; sha256: string; notes?: string; credit?: string }

function walk(dir: string, root = dir, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue; // OS metadata such as .DS_Store is never shipped content
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, root, out);
    else out.push(relative(root, p).split(sep).join('/'));
  }
  return out;
}

export function checkAssets(assetsDir: string, manifestPath: string): string[] {
  const errors: string[] = [];
  const manifest = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { assets?: Entry[] }) : { assets: [] };
  const entries = new Map((manifest.assets ?? []).map((e) => [e.file, e]));
  const files = walk(assetsDir);
  for (const f of files) {
    const e = entries.get(f);
    if (!e) { errors.push(`${f}: no manifest entry`); continue; }
    if (e.license !== 'CC0-1.0') errors.push(`${f}: license must be CC0-1.0 (got ${e.license})`);
    if (!e.author?.trim()) errors.push(`${f}: author is required`);
    if (!/^https:\/\//.test(e.sourceUrl ?? '')) errors.push(`${f}: sourceUrl must be https`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.retrievedAt ?? '')) errors.push(`${f}: retrievedAt must be YYYY-MM-DD`);
    if (e.credit !== undefined && typeof e.credit !== 'string') errors.push(`${f}: credit must be a string`);
    const sum = createHash('sha256').update(readFileSync(join(assetsDir, f))).digest('hex');
    if (sum !== e.sha256) errors.push(`${f}: sha256 mismatch`);
  }
  for (const f of entries.keys()) if (!files.includes(f)) errors.push(`${f}: listed in manifest but missing from ${assetsDir}`);
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = checkAssets('games/dodge-drop/public/assets', 'games/dodge-drop/assets/manifest.json');
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('assets ok');
}
