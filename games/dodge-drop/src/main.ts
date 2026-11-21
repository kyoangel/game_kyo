import { defineGame } from '@gf/game-kit';
import manifest from '../game.json';
import { PlayScene } from './PlayScene.ts';
import { strings } from './strings.ts';

void defineGame({ manifest, width: 720, height: 1280, strings, playScene: PlayScene, theme: {} });
