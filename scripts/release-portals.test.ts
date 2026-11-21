import { describe, expect, it } from 'vitest';
import { groupReleases, missingZips, parseZipName, releaseNotes } from './release-portals.ts';

describe('parseZipName', () => {
  it('parses slug, platform and version from a path', () => {
    expect(parseZipName('dist/release/dodge-drop-crazygames-v1.2.3.zip')).toEqual({
      slug: 'dodge-drop',
      platform: 'crazygames',
      version: '1.2.3',
    });
    expect(parseZipName('a-b-c-gamedistribution-v0.1.0.zip')?.slug).toBe('a-b-c');
  });

  it.each(['foo.zip', 'x-poki-v1.0.0.zip', 'x-crazygames-v1.0.zip', 'x-crazygames-v1.0.0.tar'])('rejects %s', (f) =>
    expect(parseZipName(f)).toBeNull(),
  );
});

describe('groupReleases', () => {
  it('groups both portals of one slug/version under one tag, sorted', () => {
    const groups = groupReleases([
      'dist/release/zeta-gamedistribution-v1.0.0.zip',
      'dist/release/alpha-gamedistribution-v2.0.0.zip',
      'dist/release/alpha-crazygames-v2.0.0.zip',
      'dist/release/alpha-crazygames-v1.0.0.zip',
      'dist/release/ignore-me.zip',
    ]);
    expect(groups.map((g) => g.tag)).toEqual(['alpha-v1.0.0', 'alpha-v2.0.0', 'zeta-v1.0.0']);
    expect(groups[1]!.zips).toEqual([
      'dist/release/alpha-crazygames-v2.0.0.zip',
      'dist/release/alpha-gamedistribution-v2.0.0.zip',
    ]);
    expect(groups[1]).toMatchObject({ slug: 'alpha', version: '2.0.0' });
  });

  it('returns an empty list when there are no zips', () => expect(groupReleases([])).toEqual([]));
});

describe('missingZips', () => {
  it('returns only zips whose file name is not attached yet', () => {
    const [g] = groupReleases([
      'dist/release/alpha-crazygames-v1.0.0.zip',
      'dist/release/alpha-gamedistribution-v1.0.0.zip',
    ]);
    expect(missingZips(g!, ['alpha-crazygames-v1.0.0.zip'])).toEqual(['dist/release/alpha-gamedistribution-v1.0.0.zip']);
    expect(missingZips(g!, ['alpha-crazygames-v1.0.0.zip', 'alpha-gamedistribution-v1.0.0.zip'])).toEqual([]);
  });
});

describe('releaseNotes', () => {
  it('lists the portal zips for manual upload', () => {
    const [g] = groupReleases(['dist/release/alpha-crazygames-v1.0.0.zip']);
    const notes = releaseNotes(g!);
    expect(notes).toMatch(/alpha v1\.0\.0/);
    expect(notes).toMatch(/alpha-crazygames-v1\.0\.0\.zip/);
  });
});
