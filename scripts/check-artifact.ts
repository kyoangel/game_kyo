import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export type PortalPlatform = 'crazygames' | 'gamedistribution';

export const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;

/** Art + audio under `assets/` (the Vite bundle is JS/CSS and is covered by the total cap, not this budget). */
export const ASSET_BUDGET_BYTES = 8 * 1024 * 1024;

const MEDIA_EXT = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.woff', '.woff2', '.ttf']);

const mb = (bytes: number): string => (bytes / 1024 / 1024).toFixed(2);

export const SDK_HOSTS: Record<PortalPlatform, string> = {
  crazygames: 'sdk.crazygames.com',
  gamedistribution: 'html5.api.gamedistribution.com',
};

const FOREIGN_SDK_HOST: Record<PortalPlatform, string> = {
  crazygames: SDK_HOSTS.gamedistribution,
  gamedistribution: SDK_HOSTS.crazygames,
};

/**
 * Exact URLs (prefixes) that appear as inert text inside the bundled Phaser library (license headers, credits,
 * XML/SVG namespaces). Found by scanning a real build of dodge-drop; none is ever fetched at runtime. Whole hosts
 * are NOT allowed (e.g. a real github.com link in a game must still be rejected, portals ban external links).
 * A prefix matches only at a boundary: the URL must equal it or continue with one of "/ | ? #".
 * Keep this list minimal: add an entry only after inspecting its context in the bundle.
 */
export const INERT_URL_PREFIXES: readonly string[] = [
  'https://opensource.org/licenses/MIT',
  'https://github.com/photonstorm/phaser3-plugin-template/blob/master/LICENSE',
  'https://github.com/photonstorm/phaser/blob/master/license.txt',
  'https://github.com/niklasvh/base64-arraybuffer',
  'https://phaser.io',
  'http://prunegames.com',
  'http://steffe.se',
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xhtml',
];

function isInertUrl(url: string): boolean {
  return INERT_URL_PREFIXES.some((prefix) => {
    if (!url.startsWith(prefix)) return false;
    const next = url.charAt(prefix.length);
    return next === '' || '/|?#'.includes(next);
  });
}

const TEXT_EXT = new Set(['.html', '.js', '.css', '.json']);
const URL_RE = /https?:\/\/[^\s"'`<>()\\]+/gi;
const HOST_RE = /^https?:\/\/([^/:?#]+)/i;
const VALID_HOST_RE = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const ROOT_ABSOLUTE_RE = /\b(?:src|href)\s*=\s*["']\/(?:[^/]|\/)/i;

interface FileInfo {
  rel: string;
  abs: string;
  size: number;
}

function walk(root: string, errors: string[]): FileInfo[] {
  const out: FileInfo[] = [];
  const visit = (abs: string): void => {
    for (const name of readdirSync(abs).sort()) {
      const p = join(abs, name);
      const rel = relative(root, p).split(sep).join('/');
      const st = lstatSync(p);
      if (st.isSymbolicLink()) {
        errors.push(`symlink not allowed: ${rel}`);
        continue;
      }
      if (st.isDirectory()) visit(p);
      else if (st.isFile()) out.push({ rel, abs: p, size: st.size });
    }
  };
  visit(root);
  return out;
}

/** Returns a list of human-readable errors; an empty list means the artifact is acceptable for `platform`. */
export function checkArtifact(dir: string, platform: PortalPlatform): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [`artifact directory does not exist: ${dir}`];
  const errors: string[] = [];
  const files = walk(dir, errors);

  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_ARTIFACT_BYTES) {
    errors.push(`total size ${mb(total)} MB exceeds the 10 MB limit`);
  }
  const media = files
    .filter((f) => f.rel.startsWith('assets/') && MEDIA_EXT.has(extname(f.rel).toLowerCase()))
    .reduce((sum, f) => sum + f.size, 0);
  if (media > ASSET_BUDGET_BYTES) errors.push(`assets exceed 8 MB budget (${mb(media)} MB of art/audio under assets/)`);
  if (!files.some((f) => f.rel === 'index.html')) errors.push('index.html missing at the artifact root');

  const allowed = new Set<string>([SDK_HOSTS[platform]]);
  const foreign = FOREIGN_SDK_HOST[platform];
  const seen = new Set<string>();

  for (const file of files) {
    if (!TEXT_EXT.has(extname(file.rel).toLowerCase())) continue;
    const text = readFileSync(file.abs, 'utf8');

    if (text.includes(foreign)) errors.push(`foreign portal SDK reference "${foreign}" found in ${file.rel}`);
    if (file.rel === 'index.html' && ROOT_ABSOLUTE_RE.test(text)) {
      errors.push('index.html uses a root-absolute or protocol-relative src/href (use relative paths)');
    }

    for (const url of text.match(URL_RE) ?? []) {
      const host = HOST_RE.exec(url)?.[1]?.toLowerCase();
      if (!host || !VALID_HOST_RE.test(host)) continue;
      if (allowed.has(host) || host === foreign || isInertUrl(url)) continue;
      const key = `${host}|${file.rel}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push(`external URL "${url}" (host "${host}") is not allowed for ${platform} (in ${file.rel})`);
    }
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, platform] = process.argv.slice(2);
  if (!dir || (platform !== 'crazygames' && platform !== 'gamedistribution')) {
    console.error('usage: node scripts/check-artifact.ts <dir> <crazygames|gamedistribution>');
    process.exit(2);
  }
  const errors = checkArtifact(dir, platform);
  if (errors.length > 0) {
    for (const e of errors) console.error(`[check-artifact] ${e}`);
    process.exit(1);
  }
  console.log(`[check-artifact] ${dir} OK for ${platform}`);
}
