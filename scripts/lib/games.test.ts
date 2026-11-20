import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadGames } from './games.ts';

const manifest = (slug: string) => ({
  slug,
  version: '0.1.0',
  title: { en: 'T' },
  description: { en: 'D' },
  instructions: { en: 'I' },
  tags: [],
  orientation: 'any',
  controls: ['mouse'],
  cover: 'cover.svg',
  targets: ['site'],
  releases: {},
});

function gamesDir(entries: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'gf-games-'));
  for (const [name, content] of Object.entries(entries)) {
    mkdirSync(join(dir, name));
    writeFileSync(join(dir, name, 'game.json'), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

describe('loadGames', () => {
  it('loads valid games sorted by directory', () => {
    const dir = gamesDir({ 'b-game': manifest('b-game'), 'a-game': manifest('a-game') });
    expect(loadGames(dir).map((g) => g.slug)).toEqual(['a-game', 'b-game']);
  });

  it('skips directories without game.json and missing games dir', () => {
    const dir = gamesDir({ 'a-game': manifest('a-game') });
    mkdirSync(join(dir, 'not-a-game'));
    expect(loadGames(dir)).toHaveLength(1);
    expect(loadGames(join(dir, 'nope'))).toEqual([]);
  });

  it('aggregates errors: invalid JSON, invalid manifest, slug/dir mismatch', () => {
    const dir = gamesDir({ broken: '{', bad: { ...manifest('bad'), version: 'x' }, wrong: manifest('other') });
    expect(() => loadGames(dir)).toThrow(/bad: version[\s\S]*broken: invalid JSON[\s\S]*wrong: slug "other"/);
  });
});
