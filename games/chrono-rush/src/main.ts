import { defineGame } from '@gf/game-kit';
import manifest from '../game.json';
import { heroTitleBackdrop } from './backdrop.ts';
import { CampScene } from './CampScene.ts';
import { PlayScene } from './PlayScene.ts';
import { heroResults } from './results.ts';
import { strings } from './strings.ts';
import { heroTitleExtras } from './titleExtras.ts';

void defineGame({
  manifest,
  width: 1280,
  height: 720,
  backgroundColor: '#13092b',
  strings,
  playScene: PlayScene,
  scenes: [CampScene],
  titleMenu: [{ labelKey: 'camp', scene: 'Camp' }],
  titleBackdrop: heroTitleBackdrop,
  titleExtras: heroTitleExtras,
  results: heroResults,
  theme: {
    bgTop: 0x13092b,
    bgBottom: 0x26124d,
    primary: 0xd97706,
    accent: 0xfacc15,
    danger: 0xf43f5e,
    text: 0xfef9c3,
  },
});
