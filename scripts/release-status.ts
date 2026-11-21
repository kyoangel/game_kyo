import { fileURLToPath } from 'node:url';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { loadGames } from './lib/games.ts';

export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const HEADER = ['GAME', 'VERSION', 'TARGET', 'STATUS', 'RELEASED', 'SUBMITTED', 'NOTE'];

export function renderStatusTable(games: GameManifest[]): string {
  if (games.length === 0) return '(no games)';
  const rows: string[][] = [HEADER];
  let stale = 0;
  for (const g of [...games].sort((a, b) => a.slug.localeCompare(b.slug))) {
    for (const target of g.targets) {
      const rel = g.releases[target];
      let note = '';
      if (rel && compareSemver(rel.version, g.version) < 0) {
        note = `needs resubmission (game is v${g.version})`;
        stale++;
      } else if (rel?.status === 'rejected') {
        note = `rejected: ${rel.reason ?? ''}`;
      }
      rows.push([g.slug, g.version, target, rel?.status ?? '-', rel?.version ?? '-', rel?.submittedAt ?? '-', note]);
    }
  }
  const widths = HEADER.map((_, col) => Math.max(...rows.map((r) => r[col]!.length)));
  const lines = rows.map((r) => r.map((cell, col) => cell.padEnd(widths[col]!)).join('  ').trimEnd());
  if (stale > 0) lines.push('', `${stale} row(s) need resubmission`);
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(renderStatusTable(loadGames()));
}
