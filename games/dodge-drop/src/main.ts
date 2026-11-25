import { defineGame } from '@gf/game-kit';
import manifest from '../game.json';
import { preloadArt } from './art.ts';
import { AUDIO_MANIFEST } from './audioManifest.ts';
import { ddTitleBackdrop } from './backdrop.ts';
import { frameFor, parseLayoutOverride, pickMode } from './frame.ts';
import { PlayScene } from './PlayScene.ts';
import { ddResults } from './results.ts';
import { ShopScene } from './ShopScene.ts';
import { strings } from './strings.ts';
import { ddTitleExtras } from './titleExtras.ts';

const override = typeof location === 'undefined' ? undefined : parseLayoutOverride(location.search);
const frameAt = (vw: number, vh: number) => frameFor(pickMode(vw, vh, override));

void defineGame({
  manifest,
  width: 720,
  height: 1280, // static fallback
  canvasSize: (vw, vh) => { const f = frameAt(vw, vh); return { width: f.width, height: f.height }; },
  onFrame: frameAt,
  strings,
  preload: preloadArt,
  audioManifest: AUDIO_MANIFEST,
  playScene: PlayScene,
  theme: {},
  scenes: [ShopScene],
  titleMenu: [{ labelKey: 'shop', scene: 'Shop' }],
  // Survival time is the result: results show m:ss, best = longest clock.
  scoreFormat: 'time',
  titleExtras: ddTitleExtras,
  titleBackdrop: ddTitleBackdrop,
  titleLogo: 'dd-logo',
  results: ddResults,
});
