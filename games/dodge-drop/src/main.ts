import { defineGame } from '@gf/game-kit';
import manifest from '../game.json';
import { ddTitleBackdrop } from './backdrop.ts';
import { PlayScene } from './PlayScene.ts';
import { ddResults } from './results.ts';
import { ShopScene } from './ShopScene.ts';
import { strings } from './strings.ts';
import { ddTitleExtras } from './titleExtras.ts';

void defineGame({
  manifest,
  width: 720,
  height: 1280,
  strings,
  playScene: PlayScene,
  theme: {},
  scenes: [ShopScene],
  titleMenu: [{ labelKey: 'shop', scene: 'Shop' }],
  titleExtras: ddTitleExtras,
  titleBackdrop: ddTitleBackdrop,
  results: ddResults,
});
