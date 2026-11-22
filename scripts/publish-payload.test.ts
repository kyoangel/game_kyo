import { describe, expect, it } from 'vitest';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { crazyGamesPayload } from './publish-payload.ts';

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
