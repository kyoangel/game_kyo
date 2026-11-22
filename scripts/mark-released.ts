// Record a portal release in games/<slug>/game.json (replaces the manual "after submitting" edit).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWN_TARGETS, RELEASE_STATUSES, validateManifest } from '../packages/game-kit/src/manifest.ts';
import type { ReleaseStatus, Target } from '../packages/game-kit/src/manifest.ts';

/** Returns the new game.json text with releases[target] set to the game's current version. */
export function markReleased(text: string, target: Target, status: ReleaseStatus, date: string, reason?: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
  if (status === 'rejected' && !reason) throw new Error('rejected needs a reason');
  const g = JSON.parse(text) as { version: string; releases: Record<string, { status?: string; version?: string; submittedAt?: string; reason?: string } | undefined> };
  const prev = g.releases[target];
  // A later status (approved/live/rejected) for the same version keeps the date it was submitted.
  const submittedAt = status !== 'submitted' && prev?.version === g.version && prev.submittedAt ? prev.submittedAt : date;
  g.releases[target] = { status, version: g.version, submittedAt, ...(reason ? { reason } : {}) };
  return `${JSON.stringify(g, null, 2)}\n`;
}

const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [slug, target, status, ...rest] = process.argv.slice(2);
  const flag = (name: string) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : undefined);
  if (!slug || !(KNOWN_TARGETS as readonly string[]).includes(target) || !(RELEASE_STATUSES as readonly string[]).includes(status)) {
    console.error(`usage: npm run mark-released -- <slug> <${KNOWN_TARGETS.join('|')}> <${RELEASE_STATUSES.join('|')}> [--date YYYY-MM-DD] [--reason text]`);
    process.exit(2);
  }
  const file = resolve('games', slug, 'game.json');
  const next = markReleased(readFileSync(file, 'utf8'), target as Target, status as ReleaseStatus, flag('--date') ?? today(), flag('--reason'));
  const check = validateManifest(JSON.parse(next));
  if (!check.ok) {
    console.error(check.errors.join('\n'));
    process.exit(1);
  }
  writeFileSync(file, next);
  console.log(`[mark-released] ${slug} ${target} → ${status}`);
}
