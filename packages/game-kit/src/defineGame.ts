import Phaser from 'phaser';
import { createPlatform } from '@platform/active';
import { BUILTIN_STRINGS } from './builtinStrings.ts';
import { sceneList as pureSceneList } from './sceneList.ts';
import type { ResultsContext } from './results.ts';
import type { TitleExtrasContext } from './titleLayout.ts';
import { pageBackground, resolveTheme, type Theme } from './theme.ts';
import { createGameAudio, type AudioManifest } from './audio/audio.ts';
import { SaveData } from './save.ts';
import { createI18n, mergeStrings, type Strings } from './i18n.ts';
import { KIT_KEY, Kit } from './kit.ts';
import { GameOverScene } from './scenes/GameOverScene.ts';
import { PreloadScene } from './scenes/PreloadScene.ts';
import { TitleScene } from './scenes/TitleScene.ts';
import { GameSession } from './session.ts';
import { bestKeyFor, type ScoreFormat } from './scoreFormat.ts';
import { resolveCanvasSize, type CanvasSizeProvider } from './frameProvider.ts';

export interface GameDefinition {
  manifest: { slug: string; title: Record<string, string> };
  width: number;
  height: number;
  playScene: new () => Phaser.Scene;
  strings?: Strings;
  backgroundColor?: string;
  preload?: (scene: Phaser.Scene) => void;
  /** Optional CC0/own audio files; any missing or undecodable file falls back to the synth for that sound. */
  audioManifest?: AudioManifest;
  parent?: string;
  theme?: Partial<Theme>;
  scenes?: Array<new () => Phaser.Scene>;
  titleMenu?: Array<{ labelKey: string; scene: string }>;
  titleBackdrop?: (scene: Phaser.Scene) => void;
  /** Texture key of a logo image shown instead of the title text when it is loaded and the title is shown in the manifest's English form (the logo is lettered in English). */
  titleLogo?: string;
  /** Optional custom title content, drawn after the menu buttons. Use addButton so taps never start the game. */
  titleExtras?: (scene: Phaser.Scene, ctx: TitleExtrasContext) => void;
  results?: (scene: Phaser.Scene, ctx: ResultsContext) => void;
  /** Optional viewport-driven canvas size; width/height stay the static fallback. */
  canvasSize?: CanvasSizeProvider;
  /** Optional game-specific frame descriptor for the viewport, stored in the registry as `gk:frame` (kit.frame()). */
  onFrame?: (viewW: number, viewH: number) => unknown;
  /** What the score passed to kit.gameOver measures (default points). `time`: whole seconds, shown as m:ss. */
  scoreFormat?: ScoreFormat;
}

export function sceneList(def: GameDefinition): Array<new () => Phaser.Scene> {
  return pureSceneList<new () => Phaser.Scene>(def, { preload: PreloadScene, title: TitleScene, gameOver: GameOverScene });
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
  const session = new GameSession(platform, def.manifest.slug, bestKeyFor(def.manifest.slug, def.scoreFormat));
  await session.loadBest();

  const save = new SaveData(platform.storage, def.manifest.slug);
  const audio = createGameAudio(save);
  await audio.loadMuted();

  // Letterbox bars (portrait game in a 16:9 portal iframe) show the game's own gradient instead of black.
  if (typeof document !== 'undefined') document.body.style.background = pageBackground(resolveTheme(def.theme));

  const viewW = typeof window === 'undefined' ? 0 : window.innerWidth;
  const viewH = typeof window === 'undefined' ? 0 : window.innerHeight;
  const size = resolveCanvasSize(def.canvasSize, { width: def.width, height: def.height }, viewW, viewH);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: def.parent ?? 'game',
    width: size.width,
    height: size.height,
    backgroundColor: def.backgroundColor ?? '#111111',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: sceneList(def),
  });
  const kit = new Kit(game, session, platform, t, def, save, audio);
  game.registry.set(KIT_KEY, kit);
  if (def.onFrame) kit.setFrame(def.onFrame(viewW, viewH));

  // Rotation / window resize: re-pick the frame (deferred by the kit while a run is in progress).
  if (def.onFrame && typeof window !== 'undefined') {
    let timer: ReturnType<typeof setTimeout> | undefined;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => kit.onViewport(window.innerWidth, window.innerHeight), 150);
    });
  }

  // Ads: freeze the loop and mute. Tab hidden: Phaser's built-in auto-pause handles it.
  session.onPauseChange((paused) => {
    game.sound.mute = paused;
    audio.setAdPaused(paused);
    if (paused) game.loop.sleep();
    else game.loop.wake();
  });

  const unlockAudio = (): void => {
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    audio.unlock();
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  if (__GK_TEST_HOOKS__) {
    (window as unknown as { __gk: unknown }).__gk = {
      get state() { return session.state; },
      get best() { return session.best; },
      get lastScore() { return session.lastScore; },
      get frame() { return kit.frame(); },
      get audio() { return audio.state; },
      get activeScenes() { return kit.activeScenes(); },
      get pausedScenes() { return kit.pausedScenes(); },
      endRound: (score = 0) => kit.gameOver(score),
    };
  }
  return game;
}
