import Phaser from 'phaser';
import { createPlatform } from '@platform/active';
import { BUILTIN_STRINGS } from './builtinStrings.ts';
import { createI18n, mergeStrings, type Strings } from './i18n.ts';
import { KIT_KEY, Kit } from './kit.ts';
import { GameOverScene } from './scenes/GameOverScene.ts';
import { PreloadScene } from './scenes/PreloadScene.ts';
import { TitleScene } from './scenes/TitleScene.ts';
import { GameSession } from './session.ts';

export interface GameDefinition {
  manifest: { slug: string; title: Record<string, string> };
  width: number;
  height: number;
  playScene: new () => Phaser.Scene;
  strings?: Strings;
  backgroundColor?: string;
  preload?: (scene: Phaser.Scene) => void;
  parent?: string;
}

function titleStrings(title: Record<string, string>): Strings {
  const out: Strings = {};
  for (const [locale, text] of Object.entries(title)) out[locale] = { title: text };
  return out;
}

export async function defineGame(def: GameDefinition): Promise<Phaser.Game> {
  const platform = createPlatform();
  await platform.init();
  const t = createI18n(mergeStrings(BUILTIN_STRINGS, titleStrings(def.manifest.title), def.strings ?? {}), platform.locale());
  const session = new GameSession(platform, def.manifest.slug);
  await session.loadBest();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: def.parent ?? 'game',
    width: def.width,
    height: def.height,
    backgroundColor: def.backgroundColor ?? '#111111',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [PreloadScene, TitleScene, def.playScene, GameOverScene],
  });
  const kit = new Kit(game, session, platform, t, def);
  game.registry.set(KIT_KEY, kit);

  // Ads: freeze the loop and mute. Tab hidden: Phaser's built-in auto-pause handles it.
  session.onPauseChange((paused) => {
    game.sound.mute = paused;
    if (paused) game.loop.sleep();
    else game.loop.wake();
  });

  if (__GK_TEST_HOOKS__) {
    (window as unknown as { __gk: unknown }).__gk = {
      get state() { return session.state; },
      get best() { return session.best; },
      get lastScore() { return session.lastScore; },
      get activeScenes() { return kit.activeScenes(); },
      endRound: (score = 0) => kit.gameOver(score),
    };
  }
  return game;
}
