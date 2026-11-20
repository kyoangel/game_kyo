import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const SCANNED = ['packages/game-kit/src', 'games', 'templates/game/src'];
const BANNED: RegExp[] = [
  /\bplatform\.id\b/,
  /\bid\s*[!=]==?\s*['"](local|site|crazygames|gamedistribution)['"]/,
  /['"](local|site|crazygames|gamedistribution)['"]\s*[!=]==?\s*\w*\.?id\b/,
];

function tsFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return tsFiles(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
  });
}

describe('architecture rules', () => {
  it('game code and game-kit never branch on platform id (use platform.features)', () => {
    const violations: string[] = [];
    for (const dir of SCANNED) {
      for (const file of tsFiles(join(root, dir))) {
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          if (BANNED.some((re) => re.test(line))) violations.push(`${relative(root, file)}:${i + 1}: ${line.trim()}`);
        });
      }
    }
    expect(violations).toEqual([]);
  });

  it('the rule itself detects a violation', () => {
    expect(BANNED.some((re) => re.test("if (platform.id === 'crazygames') {"))).toBe(true);
    expect(BANNED.some((re) => re.test("if (p.features.externalLinks) {"))).toBe(false);
  });
});
