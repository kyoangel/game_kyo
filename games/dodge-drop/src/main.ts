import { defineGame } from '@gf/game-kit';
import manifest from '../game.json';
import { ddTitleBackdrop } from './backdrop.ts';
import { PlayScene } from './PlayScene.ts';
import { ddResults } from './results.ts';
import { SkinsScene } from './SkinsScene.ts';
import { strings } from './strings.ts';

void defineGame({
  manifest,
  width: 720,
  height: 1280,
  strings,
  playScene: PlayScene,
  theme: {},
  scenes: [SkinsScene],
  titleMenu: [{ labelKey: 'skins', scene: 'Skins' }],
  titleBackdrop: ddTitleBackdrop,
  results: ddResults,
});
