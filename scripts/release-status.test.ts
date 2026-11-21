import { describe, expect, it } from 'vitest';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { compareSemver, renderStatusTable } from './release-status.ts';

const game = (over: Partial<GameManifest> & { slug: string; version: string }): GameManifest => ({
  title: { en: over.slug },
  description: { en: 'd' },
  instructions: { en: 'i' },
  tags: [],
  orientation: 'any',
  controls: ['mouse'],
  cover: 'cover.svg',
  targets: ['site', 'crazygames'],
  releases: {},
  ...over,
});

describe('compareSemver', () => {
  it('orders numerically, not lexically', () => {
    expect(compareSemver('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });
});

describe('renderStatusTable', () => {
  it('prints a header and one row per game x target', () => {
    const out = renderStatusTable([
      game({
        slug: 'dodge-drop',
        version: '1.0.0',
        releases: { crazygames: { status: 'submitted', version: '1.0.0', submittedAt: '2026-12-01' } },
      }),
    ]);
    const lines = out.split('\n');
    expect(lines[0]).toMatch(/GAME\s+VERSION\s+TARGET\s+STATUS\s+RELEASED\s+SUBMITTED\s+NOTE/);
    expect(out).toMatch(/dodge-drop\s+1\.0\.0\s+crazygames\s+submitted\s+1\.0\.0\s+2026-12-01/);
    expect(out).toMatch(/dodge-drop\s+1\.0\.0\s+site\s+-\s+-\s+-/);
    expect(out).not.toMatch(/need resubmission/);
  });

  it('flags rows whose released version is older than the game version', () => {
    const out = renderStatusTable([
      game({
        slug: 'a',
        version: '1.1.0',
        releases: { crazygames: { status: 'basic', version: '1.0.0', submittedAt: '2026-12-01' } },
      }),
    ]);
    expect(out).toMatch(/a\s+1\.1\.0\s+crazygames\s+basic\s+1\.0\.0\s+2026-12-01\s+needs resubmission \(game is v1\.1\.0\)/);
    expect(out).toMatch(/1 row\(s\) need resubmission/);
  });

  it('shows the reason for rejected releases', () => {
    const out = renderStatusTable([
      game({ slug: 'a', version: '1.0.0', releases: { crazygames: { status: 'rejected', version: '1.0.0', reason: 'too short' } } }),
    ]);
    expect(out).toMatch(/rejected: too short/);
  });

  it('sorts games by slug and handles no games', () => {
    const out = renderStatusTable([game({ slug: 'b', version: '1.0.0' }), game({ slug: 'a', version: '1.0.0' })]);
    expect(out.indexOf('a ')).toBeLessThan(out.indexOf('\nb '));
    expect(renderStatusTable([])).toBe('(no games)');
  });
});
