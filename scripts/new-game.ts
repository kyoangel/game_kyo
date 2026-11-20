import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSlug } from '../packages/game-kit/src/manifest.ts';

const TEXT_FILE = /\.(ts|json|html|svg|md|css)$/;

export function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function replaceInTree(dir: string, replacements: Record<string, string>): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      replaceInTree(path, replacements);
      continue;
    }
    if (!TEXT_FILE.test(name)) continue;
    let text = readFileSync(path, 'utf8');
    for (const [from, to] of Object.entries(replacements)) text = text.split(from).join(to);
    writeFileSync(path, text);
  }
}

export function scaffoldGame(slug: string, opts: { templateDir: string; gamesDir: string }): string {
  const err = validateSlug(slug);
  if (err) throw new Error(err);
  const dest = join(opts.gamesDir, slug);
  if (existsSync(dest)) throw new Error(`games/${slug} already exists`);
  cpSync(opts.templateDir, dest, {
    recursive: true,
    filter: (src) => !/[/\\](node_modules|dist)([/\\]|$)/.test(src),
  });
  replaceInTree(dest, { __SLUG__: slug, __TITLE__: titleFromSlug(slug) });
  return dest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: npm run new-game -- <slug>');
    process.exit(1);
  }
  try {
    const dest = scaffoldGame(slug, { templateDir: resolve('templates/game'), gamesDir: resolve('games') });
    console.log(`Created ${dest}\nNext: npm install && npm run dev -w @gf-game/${slug}`);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
