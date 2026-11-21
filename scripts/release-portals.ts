import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ParsedZip {
  slug: string;
  platform: 'crazygames' | 'gamedistribution';
  version: string;
}

export interface ReleaseGroup {
  /** GitHub release tag: <slug>-v<version>. */
  tag: string;
  slug: string;
  version: string;
  zips: string[];
}

const ZIP_RE = /^(.+)-(crazygames|gamedistribution)-v(\d+\.\d+\.\d+)\.zip$/;

export function parseZipName(file: string): ParsedZip | null {
  const m = ZIP_RE.exec(basename(file));
  if (!m) return null;
  return { slug: m[1]!, platform: m[2] as ParsedZip['platform'], version: m[3]! };
}

export function groupReleases(zipPaths: string[]): ReleaseGroup[] {
  const groups = new Map<string, ReleaseGroup>();
  for (const path of [...zipPaths].sort()) {
    const parsed = parseZipName(path);
    if (!parsed) continue;
    const tag = `${parsed.slug}-v${parsed.version}`;
    const group = groups.get(tag) ?? { tag, slug: parsed.slug, version: parsed.version, zips: [] };
    group.zips.push(path);
    groups.set(tag, group);
  }
  return [...groups.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

export function releaseNotes(group: ReleaseGroup): string {
  const lines = [
    `Portal upload packages for ${group.slug} v${group.version} (built by CI from this commit).`,
    '',
    'Upload manually in each portal developer dashboard:',
    ...group.zips.map((z) => `- ${basename(z)}`),
  ];
  return lines.join('\n');
}

export function missingZips(group: ReleaseGroup, attachedNames: string[]): string[] {
  const attached = new Set(attachedNames);
  return group.zips.filter((z) => !attached.has(basename(z)));
}

/** Asset names attached to an existing release, or null when the release does not exist. */
function attachedAssets(tag: string): string[] | null {
  try {
    const out = execFileSync('gh', ['release', 'view', tag, '--json', 'assets', '--jq', '.assets[].name'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'dist/release';
  const dry = process.env.DRY_RUN === '1';
  const zips = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.zip')).map((f) => join(dir, f)) : [];
  const groups = groupReleases(zips);
  if (groups.length === 0) console.log(`[release] no portal zips in ${dir}; nothing to do`);
  for (const group of groups) {
    if (dry) {
      console.log(`[release] would create release ${group.tag} with ${group.zips.length} zip(s) (or upload missing ones if it exists)`);
      continue;
    }
    const attached = attachedAssets(group.tag);
    if (attached !== null) {
      const missing = missingZips(group, attached);
      if (missing.length === 0) {
        console.log(`[release] ${group.tag} already has all zips; nothing to do`);
      } else {
        execFileSync('gh', ['release', 'upload', group.tag, ...missing], { stdio: 'inherit' });
        console.log(`[release] ${group.tag}: uploaded ${missing.length} missing zip(s)`);
      }
      continue;
    }
    const args = ['release', 'create', group.tag, ...group.zips, '--title', `${group.slug} v${group.version}`, '--notes', releaseNotes(group)];
    if (process.env.GITHUB_SHA) args.push('--target', process.env.GITHUB_SHA);
    execFileSync('gh', args, { stdio: 'inherit' });
    console.log(`[release] created ${group.tag}`);
  }
}
