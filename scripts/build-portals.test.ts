import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { gameEnv, selectGames, SMOKE_GD_ID, zipDirectory, zipName } from './build-portals.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function game(over: Partial<GameManifest> & { slug: string }): GameManifest {
  return {
    version: '1.2.3',
    title: { en: over.slug },
    description: { en: 'd' },
    instructions: { en: 'i' },
    tags: [],
    orientation: 'any',
    controls: ['mouse'],
    cover: 'cover.svg',
    targets: ['site', 'crazygames', 'gamedistribution'],
    releases: {},
    ...over,
  };
}

describe('zipName', () => {
  it('is <slug>-<platform>-v<version>.zip', () => {
    expect(zipName('dodge-drop', 'crazygames', '1.0.0')).toBe('dodge-drop-crazygames-v1.0.0.zip');
  });
});

describe('selectGames', () => {
  const withId = game({ slug: 'a', portalIds: { gamedistribution: 'gd-a' } });
  const noId = game({ slug: 'b' });
  const siteOnly = game({ slug: 'c', targets: ['site'] });

  it('builds crazygames for every game that targets it', () => {
    const r = selectGames('crazygames', [withId, noId, siteOnly]);
    expect(r.build.map((g) => g.slug)).toEqual(['a', 'b']);
    expect(r.skipped).toEqual([]);
  });

  it('skips gamedistribution games without a gameId, with a clear reason', () => {
    const r = selectGames('gamedistribution', [withId, noId, siteOnly]);
    expect(r.build.map((g) => g.slug)).toEqual(['a']);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0]!.slug).toBe('b');
    expect(r.skipped[0]!.reason).toMatch(/portalIds\.gamedistribution/);
  });

  it('fakeGdId (smoke) builds games without a gameId', () => {
    const r = selectGames('gamedistribution', [noId], { fakeGdId: true });
    expect(r.build.map((g) => g.slug)).toEqual(['b']);
    expect(r.skipped).toEqual([]);
  });
});

describe('gameEnv', () => {
  it('passes the per-game GD id only for gamedistribution', () => {
    const g = game({ slug: 'a', portalIds: { gamedistribution: 'gd-a' } });
    expect(gameEnv('gamedistribution', g, false)).toEqual({ GD_GAME_ID: 'gd-a' });
    expect(gameEnv('crazygames', g, false)).toEqual({});
  });

  it('uses the smoke id when faking and the game has none', () => {
    expect(gameEnv('gamedistribution', game({ slug: 'b' }), true)).toEqual({ GD_GAME_ID: SMOKE_GD_ID });
    expect(gameEnv('gamedistribution', game({ slug: 'b' }), false)).toEqual({ GD_GAME_ID: '' });
  });
});

describe('zipDirectory', () => {
  it('puts index.html at the zip root with no directory entries and replaces an existing zip', () => {
    const root = mkdtempSync(join(tmpdir(), 'gk-zip-'));
    dirs.push(root);
    const src = join(root, 'src');
    mkdirSync(join(src, 'assets'), { recursive: true });
    writeFileSync(join(src, 'index.html'), '<html></html>');
    writeFileSync(join(src, 'assets', 'a.js'), 'x');
    const zip = join(root, 'out', 'g.zip');
    zipDirectory(src, zip);
    writeFileSync(join(src, 'assets', 'b.js'), 'y');
    zipDirectory(src, zip);
    const names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean).sort();
    expect(names).toEqual(['assets/a.js', 'assets/b.js', 'index.html']);
  });
});
