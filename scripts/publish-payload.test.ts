import { describe, expect, it } from 'vitest';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { crazyGamesPayload, preflightProblems } from './publish-payload.ts';

const m = (): GameManifest => ({
  slug: 'neo',
  version: '1.2.3',
  title: { en: 'Neo' },
  description: { en: 'Desc' },
  instructions: { en: 'Inst' },
  tags: ['arcade'],
  orientation: 'portrait',
  controls: ['mouse'],
  cover: 'cover.svg',
  targets: ['crazygames'],
  releases: {},
  store: { controls: { en: '- Drag' }, crazygames: { category: 'Arcade', tags: ['Avoid'], progressSave: 'sdk' } },
});

describe('crazyGamesPayload', () => {
  const p = crazyGamesPayload(m(), '/repo');
  it('maps form values', () =>
    expect(p.form).toEqual({
      gameName: 'Neo',
      engine: 'HTML5',
      progressSave: 'Yes, using the Data Module from the CrazyGames SDK',
      supportsMobile: true,
      mobileOrientation: 'PORTRAIT',
      category: 'Arcade',
      tags: ['Avoid'],
      description: 'Desc',
      controls: '- Drag',
      tools: 'Phaser',
    }));
  it('points at the unzipped build and store assets', () => {
    expect(p.uploadDir).toBe('/repo/dist/portals/crazygames/neo');
    expect(p.covers).toEqual({
      landscape: '/repo/games/neo/store/landscape-1920x1080.png',
      portrait: '/repo/games/neo/store/portrait-800x1200.png',
      square: '/repo/games/neo/store/square-800x800.png',
    });
    expect(p.videos).toEqual({
      landscape: '/repo/dist/store/neo/video-landscape-1920x1080.mp4',
      portrait: '/repo/dist/store/neo/video-portrait-1080x1620.mp4',
    });
  });
  it('maps orientation any to BOTH', () =>
    expect(crazyGamesPayload({ ...m(), orientation: 'any' }, '/r').form.mobileOrientation).toBe('BOTH'));
  it('throws without store.crazygames', () =>
    expect(() => crazyGamesPayload({ ...m(), store: undefined }, '/r')).toThrow(/store\.crazygames/));
});

describe('preflightProblems', () => {
  const p = crazyGamesPayload(m(), '/repo');
  const all = () => true;
  const size = (f: string): [number, number] =>
    f.includes('1920x1080') ? [1920, 1080] : f.includes('800x1200') ? [800, 1200] : [800, 800];
  it('passes when everything exists', () => expect(preflightProblems(p, m(), all, size)).toEqual([]));
  it('lists missing files with the command that makes them', () =>
    expect(preflightProblems(p, m(), (f) => !f.endsWith('.mp4'), size)).toEqual([
      `missing ${p.videos.landscape} (run npm run store-video -- neo)`,
      `missing ${p.videos.portrait} (run npm run store-video -- neo)`,
    ]));
  it('flags wrong cover sizes', () => expect(preflightProblems(p, m(), all, () => [100, 100])).toHaveLength(3));
  it('refuses a version already submitted', () =>
    expect(
      preflightProblems(p, { ...m(), releases: { crazygames: { status: 'submitted', version: '1.2.3' } } }, all, size),
    ).toEqual(['crazygames already submitted at 1.2.3; bump version first']));
  it('allows resubmitting a rejected version', () =>
    expect(
      preflightProblems(p, { ...m(), releases: { crazygames: { status: 'rejected', version: '1.2.3', reason: 'x' } } }, all, size),
    ).toEqual([]));
});
