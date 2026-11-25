import Phaser from 'phaser';
import { addBackground, addButton, cssColor, ensureTextures, getKit, markButtonTap, type Fx, type GameInput, type Kit, type MusicMode, TRACKS } from '@gf/game-kit';
import { CHOMP_DURATION, CHOMP_EXIT_INVULN, emptyBoosts, sanitizeBoosts } from './boosts.ts';
import { addParallax, type Parallax } from './backdrop.ts';
import { artImage, artScale, styleArt, usedArtKeys } from './art.ts';
import { CAMP_BLOCK_W, campBlockX, CampTracker } from './camp.ts';
import { horizontalGap, isNearMiss } from './combo.ts';
import { addGraze, GRAZE_FULL } from './graze.ts';
import { emptyStats, liveProgress, newlyCompleted, sanitizeMissions, type MissionId, type MissionState, type RunStats } from './missions.ts';
import { rushStartAt, sanitizeAssist, sanitizeStartTier, DEFAULT_ASSIST } from './progression.ts';
import { buildRunConfig, GRACE_SECONDS, MAGNET_SPEED, type RunConfig } from './runSetup.ts';
import { emptyWorkshop, magnetPulls, sanitizeWorkshop, shieldAfterPickup, shieldCapacity, shieldInterval, starInterval } from './workshop.ts';
import { fallSpeed, OVERDRIVE_T, overdrive, speedBoost } from './difficulty.ts';
import { EDGE_W, MAX_STREAKS, streakAlpha, streakLen, streakSpawnRate, streakSpeed, streakTint, streakWidth, streakX, vignetteAlpha } from './speedFx.ts';
import { SKINS, type Skin } from './economy.ts';
import { formatTime } from './format.ts';
import { nextGoal, type Goal } from './goalBar.ts';
import { MEDALS, mergeMedals, medalsReached, type MedalId } from './medals.ts';
import { BLOCK_ORANGE, BLOCK_PAD, BLOCK_PINK, blockTexture, boostIconKey, edibleBlockTexture, ensurePlayTextures, warnTexture, WARN_H } from './playArt.ts';
import { mulberry32 } from './rng.ts';
import { RUN_STATE_KEY, type RunState } from './runState.ts';
import { skinTextureKey } from './skinArt.ts';
import { playDeath, playNearMiss, startSkinTrail, type SkinTrail } from './skinFxRender.ts';
import { SpawnScheduler } from './schedule.ts';
import { dragToDx, PLAYER_Y, STRIP_BOTTOM, STRIP_TOP } from './layout.ts';
import { FIELD_H, FIELD_W, type Frame } from './frame.ts';
import { getFrame } from './frameAccess.ts';
import { fieldFont, hudAnchors, MIN_PANEL_FONT, MISSION_PANEL_FONT, GOAL_PANEL_FONT, type HudAnchors } from './hudLayout.ts';
import { missionPanelText } from './missionLabel.ts';
import { controlKind, onTutorialInput, onTutorialShown, sanitizeOnboarding, shouldShowTutorial, tutorialEnded, type ControlKind, type LastInput, type Onboarding } from './onboarding.ts';
import { createTutorialView, type TutorialView } from './tutorialView.ts';
import { tiltToVelocity } from './tilt.ts';
import { TiltReader } from './tiltSensor.ts';
import { nextToastSlot, rushBannerUntil } from './toastSlot.ts';
import { BLOCK_H, isRush, PLAYER_HITBOX_W } from './waves.ts';

const W = 720;
const H = 1280;
/** Big centre banners (tier start, RUSH, OVERDRIVE) share one slot, below the medal (170) and mission (250) toasts; chomp sits under it. */
const BANNER_Y = 380;
const CHOMP_BANNER_Y = 520;
const PLAYER_HALF = 28;
const KEY_ACCEL = 5000;
const KEY_DECEL = 7000;
const KEY_MAX = 640;
const TELEGRAPH = 0.4;
/** No aimed blocks during the first seconds of a run (the player is still getting their bearings). */
const CAMP_WARMUP = 2;
const BLOCK_POOL = 48;
const CHEV_POOL = 48;
const PICKUP_POOL = 8;
const DOT_COUNT = 26;
const INVULN_REVIVE = 2;
const HINT_SECONDS = 4;
const INVULN_SHIELD = 0.5;
const PRISM_STEPS = 72;

interface Pending {
  at: number;
  x: number;
  w: number;
  h: number;
  speedMul: number;
  rush: boolean;
  /** Anti-camping block aimed at a player who stood still; its warning chevron is red. */
  aimed?: boolean;
  chev: Chev | null;
}
interface Chev {
  img: Phaser.GameObjects.Image;
  active: boolean;
  age: number;
}
interface Block {
  img: Phaser.GameObjects.Image;
  active: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  speedMul: number;
  rush: boolean;
  checked: boolean;
}
interface Pickup {
  img: Phaser.GameObjects.Image;
  active: boolean;
  kind: 'star' | 'shield';
  y: number;
  x: number;
}

function layersFor(t: number): 1 | 2 | 3 | 4 {
  if (t >= 60) return 4;
  if (t >= 30) return 3;
  if (t >= 10) return 2;
  return 1;
}

export class PlayScene extends Phaser.Scene {
  private kit!: Kit;
  private fx!: Fx;
  private gin!: GameInput;
  private rng: () => number = Math.random;
  private runId = 0;
  private ready = false;
  private dead = false;
  /** Pause menu open: the run loop, tweens and timers are frozen. */
  private paused = false;
  private pauseObjs: Phaser.GameObjects.GameObject[] = [];
  private pauseBtn: Phaser.GameObjects.Container | null = null;

  private t = 0;
  private stars = 0;
  /** Graze gauge: near misses toward the next Chomp (0..GRAZE_FULL-1). */
  private graze = 0;
  /** Length of the current Chomp, for the draining gauge. */
  private chompTotal = 0;
  private camp = new CampTracker();
  private aimedTotal = 0;
  private earned: MedalId[] = [];

  private skin: Skin = SKINS[0]!;
  private player!: Phaser.GameObjects.Image;
  private trail: SkinTrail | null = null;
  private ring!: Phaser.GameObjects.Image;
  private chompRing!: Phaser.GameObjects.Image;
  private chompBanner!: Phaser.GameObjects.Text;
  private shieldHudIcons: Phaser.GameObjects.Image[] = [];
  private vel = 0;
  private tiltN = 0;
  private invuln = 0;
  private shieldHits = 0;
  private chompArmed = false;
  private chompTimer = 0;
  private chompBannerUntil = 0;
  private ghostMode: 'none' | 'blue' | 'white' = 'none';
  private prism: number[] = [];

  private blocks: Block[] = [];
  private chevs: Chev[] = [];
  private pending: Pending[] = [];
  private pickups: Pickup[] = [];
  private scheduler!: SpawnScheduler;
  private nextStar = 7;
  private nextShield = 25;
  private cfg: RunConfig = buildRunConfig({ workshop: emptyWorkshop(), assist: DEFAULT_ASSIST, tier: 'none', rng: () => 0.5 });
  private runStartT = 0;
  private stats: RunStats = emptyStats();
  private missionState: MissionState = { active: [], stars: 0, rank: 1, completedCount: 0 };
  private toasted = new Set<MissionId>();
  private tilt = new TiltReader();
  private tiltNeutral: number | null = null;
  private useTilt = false;
  private toastFreeAt = 0;
  private lastNearPopT = -1;
  private toastCheck = 0;
  private graceBanner!: Phaser.GameObjects.Text;

  private rushIdx = 0;
  private rushWarned = false;
  private lastLayers = 0;
  private lastMode: MusicMode = 'normal';

  private grid!: Phaser.GameObjects.Graphics;
  private gridPhase = 0;
  private parallax: Parallax | null = null;
  /** Loaded ring art is larger than the procedural ring; this keeps the on-screen footprint. */
  private ringArtScale = 1;
  private dots: Phaser.GameObjects.Image[] = [];
  private dotSpeed: number[] = [];

  private frame!: Frame;
  private anchors!: HudAnchors;
  /** Second camera for the side panels (landscape only). */
  private uiCam: Phaser.Cameras.Scene2D.Camera | null = null;
  private buildingHud = false;
  private missionsText: Phaser.GameObjects.Text | null = null;
  private lastMissionsShown = '';
  private gaugeLabel: Phaser.GameObjects.Text | null = null;
  private gaugeBar!: Phaser.GameObjects.Graphics;
  private goalText!: Phaser.GameObjects.Text;
  private goalBar!: Phaser.GameObjects.Graphics;
  private goalState: Goal = { kind: 'none' };
  private lastGoalKey = '';
  private timerText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private hintDone = false;
  private onboarding: Onboarding = { shown: 0, completed: false };
  private tutorialOn = false;
  private tutorialKind: ControlKind = 'keys';
  private tutorialStartT = 0;
  private tutorialView: TutorialView | null = null;
  private lastInput: LastInput = null;
  private toastObjs = new Set<Phaser.GameObjects.Container>();
  private rushBanner!: Phaser.GameObjects.Text;
  private lastSecShown = -1;
  private lastGaugeKey = '';
  private rushBannerUntil = 0;
  private odBanner!: Phaser.GameObjects.Text;
  private odShown = false;
  private streaks: { img: Phaser.GameObjects.Image; active: boolean; speed: number }[] = [];
  private streakAcc = 0;
  private streakN = 0;
  private vignettes: Phaser.GameObjects.Image[] = [];

  private get shieldHeld(): boolean {
    return this.shieldHits > 0;
  }

  constructor() {
    super('Play');
  }

  create(): void {
    this.kit = getKit(this);
    this.fx = this.kit.fx(this);
    this.gin = this.kit.input(this, { joystick: false });
    const { theme } = this.kit;
    this.setupCameras();
    ensureTextures(this, theme);
    ensurePlayTextures(this);
    // The kit backdrop texture is canvas-sized (1440x810 in landscape); stretch it over the 720x1280 logic field
    // the zoomed field camera shows, or everything below logic y 810 is bare. Portrait: canvas == field, no-op.
    addBackground(this).setDisplaySize(FIELD_W, FIELD_H);

    this.runId++;
    this.ready = false;
    this.dead = false;
    this.paused = false;
    this.pauseObjs = [];
    this.pauseBtn = null;
    this.rng = mulberry32(Date.now() >>> 0);
    this.t = 0;
    this.stars = 0;
    this.graze = 0;
    this.chompTotal = 0;
    this.camp.reset();
    this.aimedTotal = 0;
    this.earned = [];
    this.vel = 0;
    this.tiltN = 0;
    this.invuln = 0;
    this.shieldHits = 0;
    this.chompArmed = false;
    this.chompTimer = 0;
    this.chompBannerUntil = 0;
    this.ghostMode = 'none';
    this.pending = [];
    this.cfg = buildRunConfig({ workshop: emptyWorkshop(), assist: DEFAULT_ASSIST, tier: 'none', rng: this.rng });
    this.runStartT = 0;
    this.stats = emptyStats();
    this.toasted = new Set();
    this.tilt.stop();
    this.useTilt = false;
    this.tiltNeutral = null;
    this.events.once('shutdown', () => this.tilt.stop());
    this.tutorialOn = false;
    this.tutorialView = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.lastInput = p.wasTouch ? 'touch' : 'mouse'; });
    this.input.keyboard?.on('keydown', () => { this.lastInput = 'key'; });
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard?.on('keydown-P', () => this.togglePause());
    // Leaving the tab / app mid-run opens the pause menu, so coming back never drops the player into live blocks.
    const autoPause = (): void => this.openPause();
    this.game.events.on(Phaser.Core.Events.BLUR, autoPause);
    this.game.events.on(Phaser.Core.Events.HIDDEN, autoPause);
    this.events.once('shutdown', () => {
      this.game.events.off(Phaser.Core.Events.BLUR, autoPause);
      this.game.events.off(Phaser.Core.Events.HIDDEN, autoPause);
    });
    this.toastFreeAt = 0;
    this.lastNearPopT = -1;
    this.fx?.clearPops();
    this.toastCheck = 0;
    this.nextStar = 6 + this.rng() * 3;
    this.nextShield = 25;
    this.rushIdx = 0;
    this.rushWarned = false;
    this.lastLayers = 0;
    this.lastMode = 'normal';
    this.rushBannerUntil = 0;
    this.odShown = false;
    this.streakAcc = 0;
    this.lastSecShown = -1;
    this.lastGaugeKey = '';
    this.trail = null;

    if (__GK_TEST_HOOKS__) {
      const w = window as unknown as { __dd?: { god: boolean } };
      const god = w.__dd?.god ?? false;
      w.__dd = {
        god,
        stats: () => ({
          t: this.t,
          graze: this.graze,
          aimed: this.aimedTotal,
          chomping: this.chompTimer > 0,
          nearMisses: this.stats.nearMisses,
          dead: this.dead,
          stars: this.stars,
          shieldHeld: this.shieldHeld,
          clock: this.t,
          startTier: this.cfg.tier,
          shieldHits: this.shieldHits,
          assisted: this.cfg.assisted,
          rush: isRush(this.t) || this.t >= OVERDRIVE_T,
          medals: [...this.earned],
          layers: this.layerCount(),
          overdrive: overdrive(this.t),
          streaks: this.streaks.filter((s) => s.active).length,
          paused: this.paused,
        }),
        /** Test hook: canvas position of the pause button, or null before the run is ready. */
        pauseButton: () => (this.pauseBtn ? { x: this.pauseBtn.x, y: this.pauseBtn.y } : null),
        /** Test hook: canvas positions of the pause menu buttons while it is open. */
        pauseMenu: () => (this.paused ? this.pauseMenuReport() : null),
        warp: (seconds: number) => { this.t += seconds; },
        /** Test hook: one near miss beside the player (charges the graze gauge). */
        nearMiss: () => this.onNearMiss({ x: this.player.x + 60 } as Block),
        /** Test hook: adds one held shield (capped like a pickup). */
        giveShield: () => this.addShield(),
        /** Test hook: spawns a pickup at the top of the screen at column x. */
        spawnPickup: (kind: 'star' | 'shield', x: number) => this.spawnPickup(kind, x),
        /** Test hook: HUD text objects with effective canvas position and font size. */
        hud: () => this.hudReport(),
        /** Test hook: current goal bar label and progress. */
        goal: () => ({ text: this.goalText.text, frac: this.goalState.kind === 'none' ? 0 : this.goalState.frac, id: this.goalState.kind === 'medal' ? this.goalState.id : this.goalState.kind }),
        /** Test hook: every registered texture key. */
        textures: () => Object.keys(this.textures.list),
        /** Test hook: art keys actually drawn by this scene. */
        art: () => usedArtKeys(this),
        /** Test hook: first-run tutorial state. */
        tutorial: () => ({ visible: this.tutorialOn, kind: this.tutorialKind }),
      } as { god: boolean };
    }

    this.buildBackdrop();
    this.buildPools();
    this.buildHud();
    this.buildSpeedFx();

    const id = this.runId;
    const save = this.kit.save;
    void Promise.all([
      save.getJSON<string>('skin', 'cyan'),
      save.getJSON<unknown>('workshop', {}),
      save.getJSON<unknown>('assist', {}),
      save.getJSON<unknown>('startTier', 'none'),
      save.getJSON<unknown>('medals', []),
      save.getJSON<unknown>('missions', null),
      save.getJSON<unknown>('control', 'drag'),
      save.getJSON<unknown>('boosts', null),
      save.getJSON<unknown>('onboarding', null),
    ]).then(([sid, rawWs, rawAssist, rawTier, rawMedals, rawMissions, rawControl, rawBoosts, rawOnboarding]) => {
      if (id !== this.runId || !this.sys.isActive()) return;
      if (rawControl === 'tilt') {
        this.useTilt = true;
        this.tilt.start();
      }
      this.skin = SKINS.find((s) => s.id === sid) ?? SKINS[0]!;
      const tier = sanitizeStartTier(rawTier, mergeMedals(rawMedals, []));
      const ws = sanitizeWorkshop(rawWs);
      const boosts = sanitizeBoosts(rawBoosts, shieldCapacity(ws.shieldStack));
      if (boosts.shields > 0 || boosts.shrink || boosts.chomp) {
        void save.setJSON('boosts', emptyBoosts());
      }
      const cfg = buildRunConfig({ workshop: ws, assist: sanitizeAssist(rawAssist), tier, rng: this.rng, boosts });
      this.cfg = cfg;
      this.missionState = sanitizeMissions(rawMissions, this.rng);
      // Persist the drawn missions so results (and later runs) see exactly what in-run toasts referred to.
      if (rawMissions === null || JSON.stringify(rawMissions) !== JSON.stringify(this.missionState)) {
        void save.setJSON('missions', this.missionState);
      }
      this.scheduler = new SpawnScheduler(this.rng, W, true, { speedMul: cfg.speedMul, intervalMul: cfg.intervalMul, startT: cfg.startT });
      this.t = cfg.startT;
      this.runStartT = cfg.startT;
      this.rushIdx = cfg.rushIdx;
      this.nextShield = cfg.firstShieldAt;
      this.nextStar = cfg.startT + starInterval(cfg.luckLevel, this.rng());
      this.shieldHits = cfg.startShieldHits;
      this.chompArmed = cfg.chompArmed;
      if (cfg.grace > 0) this.graceBanner.setText(this.kit.t(`tierStart.${cfg.tier}`));
      this.buildPlayer();
      this.syncShieldHud();
      this.onboarding = sanitizeOnboarding(rawOnboarding);
      if (shouldShowTutorial(this.onboarding)) {
        this.onboarding = onTutorialShown(this.onboarding); // count the show now so a reload mid-run still counts
        void save.setJSON('onboarding', this.onboarding);
        this.startTutorial();
      }
      this.ready = true;
      // Random track per run: any track on the first run, never the same one twice in a row after that.
      if (this.runId > 1) this.kit.audio.music.randomTrack();
      else this.kit.audio.music.setTrack(Math.floor(Math.random() * TRACKS.length));
      this.kit.audio.music.start();
      this.setLayers(true);
    });
  }

  // ---------------------------------------------------------------- build

  private buildBackdrop(): void {
    this.grid = this.add.graphics().setDepth(-90);
    this.parallax = addParallax(this, W, H);
    if (this.parallax) this.grid.setAlpha(0.35);
    this.gridPhase = 0;
    this.dots = [];
    this.dotSpeed = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      const d = this.add
        .image(this.rng() * W, this.rng() * H, 'gk-dot')
        .setDepth(-80)
        .setAlpha(0.12 + this.rng() * 0.25)
        .setScale(0.6 + this.rng() * 1.2);
      this.dots.push(d);
      this.dotSpeed.push(8 + this.rng() * 30);
    }
  }

  private buildPools(): void {
    this.blocks = [];
    for (let i = 0; i < BLOCK_POOL; i++) this.blocks.push(this.makeBlock());
    this.chevs = [];
    for (let i = 0; i < CHEV_POOL; i++) {
      this.chevs.push({ img: this.add.image(0, 0, warnTexture(this, 16)).setVisible(false).setDepth(4), active: false, age: 0 });
    }
    this.pickups = [];
    for (let i = 0; i < PICKUP_POOL; i++) {
      this.pickups.push({ img: this.add.image(0, 0, 'dd-star').setVisible(false).setDepth(6), active: false, kind: 'star', y: 0, x: 0 });
    }
  }

  private makeBlock(): Block {
    const { key } = blockTexture(this, 80, false);
    return { img: this.add.image(0, 0, key).setVisible(false).setDepth(5), active: false, x: 0, y: 0, w: 0, h: 0, speedMul: 1, rush: false, checked: false };
  }

  private buildPlayer(): void {
    const key = skinTextureKey(this, this.skin);
    this.player = this.add.image(W / 2, PLAYER_Y, key).setDepth(10);
    this.ring = styleArt(this, this.add.image(W / 2, PLAYER_Y, 'dd-ring'), 'dd-ring').setDepth(11).setVisible(false);
    this.ringArtScale = artScale(this, 'dd-ring');
    this.chompRing = this.add.image(W / 2, PLAYER_Y, 'dd-chomp-ring').setDepth(11).setVisible(false);
    if (this.skin.color === 'cycle') {
      this.prism = [];
      for (let i = 0; i < PRISM_STEPS; i++) {
        const c = Phaser.Display.Color.HSVToRGB(i / PRISM_STEPS, 0.65, 1) as Phaser.Types.Display.ColorObject;
        this.prism.push(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      }
    }
    this.startTrail();
  }

  private skinColor(): number {
    if (this.skin.color !== 'cycle') return this.skin.color;
    return this.prism.length > 0 ? this.prism[Math.floor(this.t * 20) % PRISM_STEPS]! : 0xffffff;
  }

  private startTrail(): void {
    this.trail = startSkinTrail(this, this.player, this.skin);
  }

  /** Landscape: zoomed field camera in the centre plus a UI camera over the whole canvas for the side panels. */
  private setupCameras(): void {
    this.frame = getFrame(this);
    this.anchors = hudAnchors(this.frame);
    this.uiCam = null;
    this.buildingHud = false;
    if (this.frame.mode !== 'landscape') return;
    const f = this.frame;
    const cam = this.cameras.main;
    cam.setViewport(f.fieldX, 0, f.dispW, f.dispH);
    cam.setZoom(f.zoom);
    cam.centerOn(W / 2, H / 2);
    const ui = this.cameras.add(0, 0, f.width, f.height);
    this.uiCam = ui;
    // Field objects are drawn by the main camera only; objects built while buildingHud is set only by the UI camera.
    const route = (o: Phaser.GameObjects.GameObject): void => {
      if (this.buildingHud) cam.ignore(o);
      else ui.ignore(o);
    };
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, route);
    this.events.once('shutdown', () => this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, route));
  }

  /** One text style helper: panel text is clamped up in landscape, in-field text via fieldFont. */
  private textStyleFor(kind: 'panel' | 'field', size: number, color: number): Phaser.Types.GameObjects.Text.TextStyle {
    const landscape = this.frame.mode === 'landscape';
    const px = kind === 'panel' ? (landscape ? Math.max(size, MIN_PANEL_FONT) : size) : fieldFont(this.frame, size);
    return this.textStyle(px, color);
  }

  private hudReport(): { name: string; x: number; y: number; fontPx: number; inField: boolean }[] {
    const f = this.frame;
    const out: { name: string; x: number; y: number; fontPx: number; inField: boolean }[] = [];
    const add = (name: string, t: Phaser.GameObjects.Text | null, inField: boolean): void => {
      if (!t || !t.visible || t.alpha === 0) return;
      const size = parseFloat(String(t.style.fontSize));
      out.push({
        name,
        x: inField ? f.fieldX + t.x * f.zoom : t.x,
        y: inField ? f.fieldY + t.y * f.zoom : t.y,
        fontPx: inField ? size * f.zoom : size,
        inField,
      });
    };
    add('gauge', this.gaugeLabel, false);
    add('timer', this.timerText, false);
    add('missions', this.missionsText, false);
    add('goal', this.goalText, false);
    add('hint', this.hint, true);
    add('tutorial', this.tutorialOn ? this.hint : null, true);
    add('rush', this.rushBanner, true);
    add('overdrive', this.odBanner, true);
    add('grace', this.graceBanner, true);
    add('chomp', this.chompBanner, true);
    return out;
  }

  private textStyle(size: number, color: number): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: this.kit.theme.font,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color: cssColor(color),
      stroke: '#1a1033',
      strokeThickness: 6,
    };
  }

  /** Faint thumb strip below the player: track line plus "<- drag ->" chevrons. Dragging works anywhere. */
  private buildStrip(): void {
    const g = this.add.graphics().setDepth(2);
    const mid = (STRIP_TOP + STRIP_BOTTOM) / 2;
    g.fillStyle(0xffffff, 0.04);
    g.fillRect(0, STRIP_TOP, W, STRIP_BOTTOM - STRIP_TOP);
    g.lineStyle(2, 0x9ee9ff, 0.18);
    g.lineBetween(0, STRIP_TOP, W, STRIP_TOP);
    g.lineStyle(4, 0x9ee9ff, 0.22);
    g.lineBetween(120, mid, W - 120, mid);
    g.fillStyle(0x9ee9ff, 0.28);
    g.fillTriangle(70, mid, 106, mid - 22, 106, mid + 22);
    g.fillTriangle(W - 70, mid, W - 106, mid - 22, W - 106, mid + 22);
    g.fillCircle(W / 2, mid, 14);
  }

  /** Runs fn with new objects routed to the UI camera (landscape side panels). */
  private inPanel<T>(fn: () => T): T {
    this.buildingHud = true;
    try {
      return fn();
    } finally {
      this.buildingHud = false;
    }
  }

  private buildPanels(): void {
    const f = this.frame;
    const g = this.add.graphics().setDepth(-100);
    const rightX = f.fieldX + f.dispW;
    if (this.textures.exists('dd-panel-art')) {
      const k = (f.height / 900) * 0.95;
      this.add.image(f.fieldX / 2, f.height / 2, 'dd-panel-art').setDepth(-99).setAlpha(0.2).setScale(k);
      this.add.image(rightX + (f.width - rightX) / 2, f.height / 2, 'dd-panel-art').setDepth(-99).setAlpha(0.2).setScale(k).setFlipX(true);
    }
    for (const [x0, w] of [[0, f.fieldX], [rightX, f.width - rightX]] as const) {
      g.fillGradientStyle(0x1a1033, 0x1a1033, 0x0b0720, 0x0b0720, 1);
      g.fillRect(x0, 0, w, f.height);
    }
    g.lineStyle(2, 0x9ee9ff, 0.25);
    g.lineBetween(f.fieldX, 0, f.fieldX, f.height);
    g.lineBetween(rightX, 0, rightX, f.height);
  }

  private buildHud(): void {
    const { theme } = this.kit;
    const a = this.anchors;
    const landscape = this.frame.mode === 'landscape';
    this.buildStrip();
    if (landscape) this.inPanel(() => this.buildPanels());
    const panelHud = (): void => {
      // The run clock is the headline result (medals, best time).
      this.timerText = this.add.text(a.timer.x, a.timer.y, '0:00', { ...this.textStyleFor('panel', 60, theme.text), strokeThickness: 7 }).setOrigin(a.timer.originX ?? 0, 0).setDepth(100);
      // Landscape: a text label over the gauge; portrait: a small Chomp icon in front of it.
      this.gaugeLabel = landscape
        ? this.add.text(a.gauge.x, a.gauge.y, this.kit.t('grazeGauge'), this.textStyle(GOAL_PANEL_FONT, 0x3ff0ff)).setDepth(100)
        : null;
      if (!landscape) artImage(this, a.gauge.x + 12, a.gauge.y + 8, boostIconKey('chomp')).setDisplaySize(26, 26).setDepth(100);
      this.gaugeBar = this.add.graphics().setDepth(100);
      const goalStyle = landscape ? this.textStyle(GOAL_PANEL_FONT, theme.text) : this.textStyleFor('panel', 26, theme.text);
      this.goalText = this.add.text(a.goal.x, a.goal.y, '', goalStyle).setOrigin(a.goal.originX ?? 0, 0).setDepth(100).setVisible(false);
      this.goalBar = this.add.graphics().setDepth(100);
      // Shield icon row (up to 7 icons, growing rightward).
      this.shieldHudIcons = [];
      for (let i = 0; i < 7; i++) {
        this.shieldHudIcons.push(
          artImage(this, a.shields.x + i * 30, a.shields.y, 'dd-shield').setDisplaySize(28, 28).setDepth(100).setVisible(false),
        );
      }
      // Icon row (right to left): mute, fullscreen (when available), pause.
      const icons = this.kit.fullscreenAvailable ? 2 : 1;
      this.kit.addMuteButton(this, a.mute.x, a.mute.y).setDepth(100);
      this.kit.addFullscreenButton(this, a.mute.x - 76, a.mute.y)?.setDepth(100);
      this.pauseBtn = this.addPauseButton(a.mute.x - 76 * icons, a.mute.y).setDepth(100);
      if (landscape) {
        this.missionsText = this.add
          .text(a.missions.x, a.missions.y, '', { ...this.textStyle(MISSION_PANEL_FONT, theme.muted), lineSpacing: 4 })
          .setDepth(100);
      }
    };
    if (landscape) this.inPanel(panelHud);
    else panelHud();
    this.hint = this.add
      .text(W / 2, 800, this.kit.t('dragHint'), this.textStyleFor('field', 36, theme.muted))
      .setOrigin(0.5)
      .setDepth(100);
    this.hintDone = false;
    this.toastObjs = new Set();
    this.rushBanner = this.add
      .text(W / 2, BANNER_Y, this.kit.t('rush'), { ...this.textStyleFor('field', 110, 0xffa14d), strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);
    this.odBanner = this.add
      .text(W / 2, BANNER_Y, this.kit.t('overdrive'), { ...this.textStyleFor('field', 96, 0xffa14d), strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);
    this.graceBanner = this.add
      .text(W / 2, BANNER_Y, '', { ...this.textStyleFor('field', 84, theme.accent), strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);
    this.chompBanner = this.add
      .text(W / 2, CHOMP_BANNER_Y, this.kit.t('chompBanner'), { ...this.textStyleFor('field', 82, 0x3ff0ff), strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);
  }

  // ---------------------------------------------------------------- loop

  update(_time: number, deltaMs: number): void {
    const raw = Math.min(deltaMs, 50) / 1000;
    const dt = raw * this.time.timeScale;
    const drag = dragToDx(this.gin.dragDx(), this.frame.zoom);
    if (this.fx.frozen || !this.ready || this.paused) return;
    this.updateHint(drag);
    this.updateTutorial(drag);

    this.updateBackdrop(dt);
    this.updateSpeedFx(dt);
    if (!this.dead) {
      const prev = this.t;
      this.t += dt;
      this.movePlayer(dt, drag);
      this.updateCamp(dt);
      this.schedule();
      this.updateRush();
      this.updateOverdriveBanner();
      this.setLayers(false);
      if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
      if (this.chompTimer > 0) {
        this.chompTimer = Math.max(0, this.chompTimer - dt);
        if (this.chompTimer === 0) {
          this.player.setTexture(skinTextureKey(this, this.skin));
          this.invuln = Math.max(this.invuln, CHOMP_EXIT_INVULN);
        }
        this.syncGhostBlocks();
      }
      this.chompBanner.setVisible(this.t < this.chompBannerUntil);
      this.updateMedals(prev, this.t);
      this.stats.seconds = Math.floor(this.t - this.runStartT);
      this.checkMissions(dt);
    }
    this.graceBanner.setVisible(this.graceBannerVisible() && !this.dead);
    this.updateChevrons(dt);
    this.updateBlocks(dt);
    this.updatePickups(dt);
    if (!this.dead) this.updatePlayerVisual(dt);
    this.updateHud(dt);
  }

  /** First-run visual control tutorial: drawn over the thumb strip, the hint text becomes its caption. */
  private startTutorial(): void {
    const touch = this.sys.game.device.input.touch && !this.sys.game.device.os.desktop;
    this.tutorialKind = controlKind(this.lastInput, touch);
    this.tutorialOn = true;
    this.tutorialStartT = this.t;
    this.hint.setText(this.kit.t(`tutorial.${this.tutorialKind}`)).setY(1085).setColor(cssColor(this.kit.theme.text));
    this.tutorialView = createTutorialView(this, this.tutorialKind, W, this.kit.theme.font);
  }

  private updateTutorial(drag: number): void {
    if (!this.tutorialOn || this.dead) return;
    const got = drag !== 0 || this.gin.vector().x !== 0;
    const elapsed = this.t - this.tutorialStartT;
    if (!tutorialEnded(elapsed, got)) {
      this.tutorialView?.update(elapsed);
      return;
    }
    this.tutorialOn = false;
    this.hintDone = true;
    this.tutorialView?.dismiss();
    this.tutorialView = null;
    this.tweens.add({ targets: this.hint, alpha: 0, duration: 300 });
    if (got) {
      this.onboarding = onTutorialInput(this.onboarding);
      void this.kit.save.setJSON('onboarding', this.onboarding);
    }
  }

  /** Fade the drag hint after the first input or 4 s of run time, whichever comes first. */
  private updateHint(drag: number): void {
    if (this.hintDone || this.dead || this.tutorialOn) return;
    if (drag !== 0 || this.gin.vector().x !== 0 || this.t - this.runStartT >= HINT_SECONDS) {
      this.hintDone = true;
      this.tweens.add({ targets: this.hint, alpha: 0, duration: 300 });
    }
  }

  private updateBackdrop(dt: number): void {
    const od = overdrive(this.t);
    const speed = fallSpeed(this.t) * speedBoost(this.t) * (1 + od);
    this.gridPhase = (this.gridPhase + (dt * speed * 0.3) / 160) % 1;
    this.parallax?.update(dt, speed);
    const g = this.grid;
    g.clear();
    const vpX = W / 2;
    const rows = 14;
    for (let i = 0; i < rows; i++) {
      const d = (i + this.gridPhase) / rows;
      const y = d * d * H;
      g.lineStyle(2, 0x9ee9ff, 0.05 + 0.12 * d);
      g.lineBetween(0, y, W, y);
    }
    g.lineStyle(2, 0x9ee9ff, 0.1);
    for (let i = -6; i <= 6; i++) {
      g.lineBetween(vpX + i * 8, 0, vpX + i * 160, H);
    }
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i]!;
      d.y += this.dotSpeed[i]! * (1 + 4 * od) * dt;
      if (d.y > H + 10) {
        d.y = -10;
        d.x = this.rng() * W;
      }
    }
  }

  private movePlayer(dt: number, drag: number): void {
    const before = this.player.x;
    let x = before + drag;
    const dir = this.gin.vector().x;
    if (dir !== 0) {
      if (Math.sign(dir) !== Math.sign(this.vel) && this.vel !== 0) this.vel += Math.sign(dir) * KEY_DECEL * dt;
      this.vel = Phaser.Math.Clamp(this.vel + Math.sign(dir) * KEY_ACCEL * dt, -KEY_MAX, KEY_MAX);
    } else if (this.vel !== 0) {
      const dv = KEY_DECEL * dt;
      this.vel = Math.abs(this.vel) <= dv ? 0 : this.vel - Math.sign(this.vel) * dv;
    }
    x += this.vel * dt;
    if (this.useTilt && this.tilt.latest !== null) {
      // Neutral = how the phone is held when the run starts (re-captured after a revive).
      this.tiltNeutral ??= this.tilt.latest;
      x += tiltToVelocity(this.tilt.latest, this.tiltNeutral) * dt;
    }
    x = Phaser.Math.Clamp(x, PLAYER_HALF, W - PLAYER_HALF);
    if (x === PLAYER_HALF || x === W - PLAYER_HALF) this.vel = 0;
    this.player.x = x;
    const eff = dt > 0 ? (x - before) / dt : 0;
    this.tiltN += (Phaser.Math.Clamp(eff / KEY_MAX, -1, 1) - this.tiltN) * Math.min(1, dt * 14);
  }

  private updatePlayerVisual(dt: number): void {
    const n = Math.abs(this.tiltN);
    const chomping = this.chompTimer > 0;
    const baseScale = chomping ? 1.15 : this.cfg.playerScale;
    this.player.setAngle(this.tiltN * 12);
    this.player.setScale(baseScale * (1 + 0.25 * n), baseScale * (1 - 0.15 * n));
    if (chomping) {
      const open = Math.floor(this.t * 12) % 2 === 0;
      const want = open ? 'dd-chomp-open' : 'dd-chomp-closed';
      if (this.player.texture.key !== want) this.player.setTexture(want);
      this.player.clearTint();
    } else if (this.skin.color === 'cycle') {
      this.player.setTint(this.skinColor());
    }
    this.trail?.update(this.t * 1000, n);
    const blink = !chomping && this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    this.player.setAlpha(blink ? 0.35 : 1);
    this.ring.setVisible(this.shieldHeld);
    this.chompRing.setVisible(this.chompArmed && !chomping);
    if (this.shieldHeld) {
      this.ring.setPosition(this.player.x, this.player.y);
      this.ring.setScale(baseScale * this.ringArtScale * (1 + Math.sin(this.t * 8) * 0.04));
      this.ring.rotation += dt * 1.5;
    }
    if (this.chompArmed && !chomping) {
      this.chompRing.setPosition(this.player.x, this.player.y);
      this.chompRing.setScale(baseScale * (1.08 + Math.sin(this.t * 6) * 0.05));
      this.chompRing.rotation -= dt * 1.2;
    }
  }

  // ------------------------------------------------------------ scheduler

  private schedule(): void {
    const t = this.t;
    for (const sp of this.scheduler.planUntil(t + 2.5)) {
      this.pending.push({ at: sp.at, x: sp.x, w: sp.w, h: sp.h, speedMul: sp.speedMul, rush: isRush(sp.at) || sp.at >= OVERDRIVE_T, chev: null });
    }

    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]!;
      if (p.chev === null && t >= p.at - TELEGRAPH) this.acquireChev(p);
      if (t >= p.at) {
        this.spawnBlock(p, t - p.at);
        if (p.chev) p.chev.active = false;
        if (p.chev) p.chev.img.setVisible(false);
        this.pending[i] = this.pending[this.pending.length - 1]!;
        this.pending.pop();
      }
    }

    if (t >= this.nextStar) {
      if (this.spawnStar()) this.nextStar = t + starInterval(this.cfg.luckLevel, this.rng());
      else this.nextStar = t + 0.4;
    }
    if (t >= this.nextShield && this.shieldHits < this.cfg.shieldCapacity && !this.pickups.some((p) => p.active && p.kind === 'shield')) {
      if (this.spawnPickup('shield', 60 + this.rng() * (W - 120))) this.nextShield = t + shieldInterval(this.cfg.shieldLevel, this.rng());
    }
  }

  /** Anti-camping: standing still for CAMP_SECONDS drops one telegraphed block on the player's spot. */
  private updateCamp(dt: number): void {
    // Test hook: __dd.noCamp keeps stationary test players from drawing aimed blocks.
    const noCamp = __GK_TEST_HOOKS__ && (window as unknown as { __dd?: { noCamp?: boolean } }).__dd?.noCamp === true;
    if (noCamp || this.chompTimer > 0 || this.tutorialOn || this.t - this.runStartT < CAMP_WARMUP) {
      this.camp.reset();
      return;
    }
    if (!this.camp.update(this.player.x, dt)) return;
    const at = this.t + TELEGRAPH;
    const sp = { at, x: campBlockX(this.player.x, W), w: CAMP_BLOCK_W, h: BLOCK_H, speedMul: 1 };
    if (!this.scheduler.inject(sp)) {
      this.camp.retrySoon();
      return;
    }
    this.aimedTotal++;
    this.pending.push({ ...sp, rush: isRush(at) || at >= OVERDRIVE_T, aimed: true, chev: null });
  }

  private acquireChev(p: Pending): void {
    const c = this.chevs.find((q) => !q.active);
    if (!c) return;
    c.active = true;
    c.age = 0;
    const key = warnTexture(this, p.w);
    c.img.setTexture(key).setPosition(p.x, WARN_H / 2 + 4).setVisible(true).setAlpha(1);
    c.img.setDisplaySize(p.w, WARN_H);
    c.img.setTint(p.aimed ? this.kit.theme.danger : p.rush ? BLOCK_ORANGE : 0xffffff);
    p.chev = c;
  }

  private spawnBlock(p: Pending, late: number): void {
    let b = this.blocks.find((q) => !q.active);
    if (!b) {
      b = this.makeBlock();
      this.blocks.push(b);
    }
    const tex =
      this.ghostMode === 'none'
        ? blockTexture(this, p.w, p.rush)
        : edibleBlockTexture(this, p.w, this.ghostMode === 'white');
    b.active = true;
    b.checked = false;
    b.x = p.x;
    b.w = p.w;
    b.h = p.h;
    b.speedMul = p.speedMul;
    b.rush = p.rush;
    b.y = -BLOCK_H / 2 - BLOCK_PAD + late * fallSpeed(this.t) * speedBoost(this.t) * p.speedMul * this.cfg.speedMul;
    b.img.setTexture(tex.key).setVisible(true);
    b.img.setScale(p.w / tex.bodyW, 1);
    b.img.setPosition(b.x, b.y);
  }

  private syncShieldHud(): void {
    for (let i = 0; i < this.shieldHudIcons.length; i++) {
      this.shieldHudIcons[i]!.setVisible(!this.dead && i < this.shieldHits);
    }
  }

  private syncGhostBlocks(): void {
    const want: 'none' | 'blue' | 'white' =
      this.chompTimer <= 0
        ? 'none'
        : this.chompTimer < 1.5 && Math.floor(this.t * 10) % 2 === 0
          ? 'white'
          : 'blue';
    if (want === this.ghostMode) return;
    this.ghostMode = want;
    for (const b of this.blocks) {
      if (!b.active) continue;
      const tex =
        want === 'none'
          ? blockTexture(this, b.w, b.rush)
          : edibleBlockTexture(this, b.w, want === 'white');
      b.img.setTexture(tex.key);
      b.img.setScale(b.w / tex.bodyW, 1);
    }
  }

  private spawnStar(): boolean {
    for (let tries = 0; tries < 8; tries++) {
      const x = 60 + this.rng() * (W - 120);
      if (this.starLaneFree(x)) return this.spawnPickup('star', x);
    }
    return false;
  }

  /** True if no wall/block is about to occupy this x at the top of the screen. */
  private starLaneFree(x: number): boolean {
    for (const b of this.blocks) {
      if (b.active && b.y < 420 && Math.abs(b.x - x) < b.w / 2 + 50) return false;
    }
    for (const p of this.pending) {
      if (p.at < this.t + 1.2 && Math.abs(p.x - x) < p.w / 2 + 50) return false;
    }
    return true;
  }

  private spawnPickup(kind: 'star' | 'shield', x: number): boolean {
    const p = this.pickups.find((q) => !q.active);
    if (!p) return false;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = -30;
    const key = kind === 'star' ? 'dd-star' : 'dd-shield';
    styleArt(this, p.img.setTexture(key), key).setVisible(true).setPosition(x, p.y).setAlpha(1).setScale(artScale(this, key));
    return true;
  }

  // ------------------------------------------------------------- rush/music

  private updateRush(): void {
    const next = rushStartAt(this.rushIdx);
    if (!this.rushWarned && this.t >= next - 1) {
      this.rushWarned = true;
      // A rush that starts inside the tier-start banner's window shows its banner right after it (never on top of it).
      const graceEnd = this.cfg.grace > 0 ? this.cfg.startT + GRACE_SECONDS : 0;
      this.rushBannerUntil = rushBannerUntil(next, graceEnd);
      this.kit.audio.sfx('rush');
    }
    if (this.rushWarned && this.t >= next + 4) {
      if (next >= this.runStartT) this.stats.rushes++;
      this.rushIdx++;
      this.rushWarned = false;
    }
    const show = this.rushWarned && this.t < this.rushBannerUntil && !this.graceBannerVisible();
    this.rushBanner.setVisible(show);
    if (show) {
      this.rushBanner.setScale(1 + 0.08 * Math.sin(this.t * 24));
      this.rushBanner.setAlpha(Math.floor(this.t * 10) % 2 === 0 ? 1 : 0.6);
    }
  }

  private graceBannerVisible(): boolean {
    return this.cfg.grace > 0 && this.t < this.cfg.startT + GRACE_SECONDS;
  }

  private layerCount(): 1 | 2 | 3 | 4 {
    return this.chompTimer > 0 || isRush(this.t) || this.t >= OVERDRIVE_T ? 4 : layersFor(this.t);
  }

  private musicMode(): MusicMode {
    if (this.chompTimer > 0) return 'chomp';
    if (this.t >= OVERDRIVE_T) return 'overdrive';
    if (isRush(this.t)) return 'rush';
    return 'normal';
  }

  private updateOverdriveBanner(): void {
    if (!this.odShown && this.t >= OVERDRIVE_T && this.t < OVERDRIVE_T + 1.5) {
      this.odShown = true;
      this.kit.audio.sfx('rush');
    }
    const show = this.odShown && this.t >= OVERDRIVE_T && this.t < OVERDRIVE_T + 1.2 && !this.graceBannerVisible();
    this.odBanner.setVisible(show);
    if (show) {
      this.odBanner.setScale(1 + 0.08 * Math.sin(this.t * 24));
      this.odBanner.setAlpha(Math.floor(this.t * 10) % 2 === 0 ? 1 : 0.6);
    }
  }

  // ------------------------------------------------------------ speed fx

  private buildSpeedFx(): void {
    if (!this.textures.exists('dd-streak')) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture('dd-streak', 4, 4);
      g.destroy();
    }
    if (!this.textures.exists('dd-vignette')) {
      const tex = this.textures.createCanvas('dd-vignette', EDGE_W + 20, 4);
      if (tex) {
        const ctx = tex.getContext();
        const grad = ctx.createLinearGradient(0, 0, EDGE_W + 20, 0);
        grad.addColorStop(0, 'rgba(26,16,51,1)');
        grad.addColorStop(1, 'rgba(26,16,51,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, EDGE_W + 20, 4);
        tex.refresh();
      }
    }
    this.streaks = [];
    this.streakAcc = 0;
    for (let i = 0; i < MAX_STREAKS; i++) {
      this.streaks.push({ img: this.add.image(0, 0, 'dd-streak').setVisible(false).setDepth(48), active: false, speed: 0 });
    }
    const left = this.add.image(0, 0, 'dd-vignette').setOrigin(0, 0).setDisplaySize(EDGE_W + 20, H).setDepth(50).setAlpha(0);
    const right = this.add.image(W, 0, 'dd-vignette').setOrigin(1, 0).setFlipX(true).setDisplaySize(EDGE_W + 20, H).setDepth(50).setAlpha(0);
    this.vignettes = [left, right];
  }

  private clearStreaks(): void {
    for (const s of this.streaks) {
      s.active = false;
      s.img.setVisible(false);
    }
    this.streakAcc = 0;
  }

  private updateSpeedFx(dt: number): void {
    const od = overdrive(this.t);
    for (const v of this.vignettes) v.setAlpha(vignetteAlpha(od));
    const blockSpeed = fallSpeed(this.t) * speedBoost(this.t);
    for (const s of this.streaks) {
      if (!s.active) continue;
      s.img.y += streakSpeed(blockSpeed) * dt;
      if (s.img.y - s.img.displayHeight / 2 > H) {
        s.active = false;
        s.img.setVisible(false);
      }
    }
    if (od <= 0 || this.dead) return;
    this.streakAcc += streakSpawnRate(od) * dt;
    while (this.streakAcc >= 1) {
      this.streakAcc -= 1;
      const s = this.streaks.find((q) => !q.active);
      if (!s) break;
      const sizeR = this.rng();
      const len = streakLen(sizeR);
      s.active = true;
      s.img.setVisible(true)
        .setPosition(streakX(this.rng() < 0.5 ? 0 : 1, this.rng(), W), -len / 2 - this.rng() * 200)
        .setDisplaySize(streakWidth(this.rng()), len)
        .setAlpha(streakAlpha(od, this.rng()))
        .setTint(streakTint(this.streakN++));
    }
  }

  private setLayers(force: boolean): void {
    const n = this.layerCount();
    const mode = this.musicMode();
    if (n !== this.lastLayers || force) {
      this.lastLayers = n;
      this.kit.audio.music.setLayers(n);
    }
    if (mode !== this.lastMode || force) {
      this.lastMode = mode;
      this.kit.audio.music.setMode(mode);
    }
  }

  // ------------------------------------------------------------ simulation

  private updateChevrons(dt: number): void {
    for (const c of this.chevs) {
      if (!c.active) continue;
      c.age += dt;
      c.img.setAlpha(Math.floor(c.age * 20) % 2 === 0 ? 1 : 0.3);
    }
  }

  private updateBlocks(dt: number): void {
    const base = fallSpeed(this.t) * speedBoost(this.t);
    const px = this.dead ? 0 : this.player.x;
    for (const b of this.blocks) {
      if (!b.active) continue;
      b.y += base * b.speedMul * this.cfg.speedMul * dt;
      b.img.y = b.y;
      if (!this.dead) {
        const hitW = PLAYER_HITBOX_W * (this.chompTimer > 0 ? 1.15 : this.cfg.playerScale);
        const dy = Math.abs(b.y - PLAYER_Y);
        const reachY = (hitW + b.h * 0.9) / 2;
        const gap = horizontalGap({ x: px, w: hitW }, { x: b.x, w: b.w * 0.9 });
        if (dy < reachY && gap <= 0) {
          if (this.chompTimer > 0) {
            this.eatBlock(b);
            continue;
          }
          if (this.invuln <= 0) {
            this.onHit(b);
            continue;
          }
        }
        if (!b.checked && b.y >= PLAYER_Y) {
          b.checked = true;
          if (isNearMiss(gap, this.cfg.nearMissWindow)) this.onNearMiss(b);
        }
      }
      if (b.y - BLOCK_H / 2 > H + BLOCK_PAD) {
        b.active = false;
        b.img.setVisible(false);
      }
    }
  }

  private updatePickups(dt: number): void {
    const speed = fallSpeed(this.t) * speedBoost(this.t) * 0.9;
    for (const p of this.pickups) {
      if (!p.active) continue;
      const radius = this.cfg.magnetRadius;
      const mdx = this.dead ? 0 : this.player.x - p.x;
      const mdy = this.dead ? 0 : PLAYER_Y - p.y;
      const md = Math.hypot(mdx, mdy);
      const pulled = !this.dead && md > 0 && magnetPulls(p.kind, md, radius, this.shieldHits, this.cfg.shieldCapacity);
      if (pulled) {
        const step = Math.min(md, MAGNET_SPEED * dt);
        p.x += (mdx / md) * step;
        p.y += (mdy / md) * step;
      } else {
        p.y += speed * dt;
      }
      p.img.x = p.x;
      p.img.y = p.y;
      p.img.rotation += (p.kind === 'star' ? 3 : 1.2) * dt;
      // A pickup the magnet is pulling is never culled (full-screen pull can start far above the player).
      if (!pulled && p.y > H + 40) {
        p.active = false;
        p.img.setVisible(false);
        continue;
      }
      if (this.dead) continue;
      const half = (p.kind === 'star' ? 36 : 40) * 1.4 * 0.5;
      if (Math.abs(p.y - PLAYER_Y) < half + PLAYER_HITBOX_W / 2 && Math.abs(p.x - this.player.x) < half + PLAYER_HITBOX_W / 2) {
        p.active = false;
        p.img.setVisible(false);
        this.collect(p);
      }
    }
  }

  private collect(p: Pickup): void {
    if (this.dead) return;
    if (p.kind === 'star') {
      this.stars++;
      this.stats.stars++;
      this.kit.audio.sfx('pickup');
      this.fx.burst(p.x, p.y, { color: 0xffe14d, count: 16, speed: 300, lifespanMs: 450 });
      this.fx.popText(p.x, p.y - 20, '+1★', { color: 0xffe14d, size: fieldFont(this.frame, 30) });
    } else {
      this.addShield();
      this.kit.audio.sfx('shield');
      this.fx.burst(p.x, p.y, { color: 0x58ff9a, count: 18, speed: 320, lifespanMs: 500 });
    }
  }

  /** +1 held shield up to the Shield Stack capacity; keeps the top HUD shield icons in sync. */
  private addShield(): void {
    this.shieldHits = shieldAfterPickup(this.shieldHits, this.cfg.shieldCapacity);
    this.syncShieldHud();
  }

  private onNearMiss(b: Block): void {
    this.stats.nearMisses++;
    // Test hook: __dd.noGraze keeps the gauge empty (tests that warp through rushes must not drift into Chomp).
    const noGraze = __GK_TEST_HOOKS__ && (window as unknown as { __dd?: { noGraze?: boolean } }).__dd?.noGraze === true;
    const chomping = this.chompTimer > 0 || noGraze;
    const g = addGraze(this.graze, chomping);
    this.graze = g.gauge;
    const side = Math.sign(b.x - this.player.x) || 1;
    // Two blocks passing on both sides in the same row must not stack two pops on top of each other.
    if (!chomping && this.t - this.lastNearPopT >= 0.2) {
      this.lastNearPopT = this.t;
      this.fx.popText(this.player.x, PLAYER_Y - 70, this.kit.t('graze'), { color: 0x3ff0ff, size: fieldFont(this.frame, 34) });
    }
    // Pitch climbs with the gauge so the player hears it filling.
    this.kit.audio.sfx('nearMiss', { step: g.trigger ? GRAZE_FULL : this.graze });
    if (g.trigger) {
      this.stats.grazeChomps++;
      this.startChomp(this.cfg.grazeChompSeconds);
    }
    playNearMiss(this, this.fx, this.skin, this.player.x, PLAYER_Y, side, this.skinColor());
  }

  /** Enter Chomp mode (graze gauge full, or the bought Chomp boost on a fatal hit): blocks turn edible. */
  private startChomp(seconds: number): void {
    this.chompTimer = Math.max(this.chompTimer, seconds);
    this.chompTotal = this.chompTimer;
    this.chompBannerUntil = this.t + 1.5;
    this.kit.audio.sfx('rush');
    this.setLayers(false);
    this.syncGhostBlocks();
  }

  private eatBlock(b: Block): void {
    b.active = false;
    b.img.setVisible(false);
    this.stats.chompEats++;
    this.kit.audio.sfx('pickup');
    this.fx.burst(b.x, b.y, { color: 0x3b7bff, count: 18, speed: 420, lifespanMs: 420 });
    this.fx.burst(b.x, b.y, { color: 0xffe14d, count: 12, speed: 360, lifespanMs: 380 });
    this.fx.shake(0.2);
  }

  private onHit(b: Block): void {
    if (this.shieldHits > 0) {
      this.shieldHits -= 1;
      this.stats.shieldBlocks++;
      this.ring.setVisible(this.shieldHits > 0);
      this.syncShieldHud();
      this.invuln = INVULN_SHIELD;
      b.active = false;
      b.img.setVisible(false);
      this.kit.audio.sfx('shieldBreak');
      this.fx.burst(b.x, b.y, { color: BLOCK_PINK, count: 28, speed: 480, lifespanMs: 500 });
      this.fx.burst(this.player.x, PLAYER_Y, { color: 0x58ff9a, count: 20, speed: 380, lifespanMs: 500 });
      void this.fx.hitStop(60);
      return;
    }
    if (this.chompArmed) {
      this.chompArmed = false;
      this.chompRing.setVisible(false);
      this.startChomp(CHOMP_DURATION);
      this.eatBlock(b);
      this.syncGhostBlocks();
      return;
    }
    if (__GK_TEST_HOOKS__ && (window as unknown as { __dd?: { god: boolean } }).__dd?.god) {
      b.active = false;
      b.img.setVisible(false);
      return;
    }
    if (this.dead) return;
    this.dead = true;
    void this.die();
  }

  // ----------------------------------------------------------------- medals

  private updateMedals(prev: number, now: number): void {
    for (const id of medalsReached(prev, now)) {
      this.earned.push(id);
      this.kit.audio.sfx('medal');
      this.fx.burst(W / 2, 170, { color: MEDALS.find((m) => m.id === id)!.color, count: 30, speed: 420, lifespanMs: 700 });
      this.showMedalToast(id);
      void this.kit.save.getJSON<unknown>('medals', []).then((saved) => this.kit.save.setJSON('medals', mergeMedals(saved, [id])));
    }
  }

  private trackToast(c: Phaser.GameObjects.Container): void {
    this.toastObjs.add(c);
  }

  private dropToast(c: Phaser.GameObjects.Container): void {
    this.toastObjs.delete(c);
    c.destroy();
  }

  private showMedalToast(id: MedalId): void {
    const m = MEDALS.find((q) => q.id === id)!;
    const c = this.add.container(W / 2, -60).setDepth(110);
    const g = this.add.graphics();
    g.fillStyle(0x1a1033, 0.85);
    g.fillRoundedRect(-170, -38, 340, 76, 38);
    g.lineStyle(4, m.color, 1);
    g.strokeRoundedRect(-170, -38, 340, 76, 38);
    g.fillStyle(m.color, 1);
    g.fillCircle(-126, 0, 24);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(-133, -7, 8);
    const label = this.add.text(-84, 0, this.kit.t(`medal.${id}`), this.textStyleFor('field', 36, m.color)).setOrigin(0, 0.5);
    this.trackToast(c);
    c.add([g, label]);
    this.tweens.add({ targets: c, y: 170, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, y: -80, delay: 1750, duration: 250, onComplete: () => this.dropToast(c) });
  }

  private checkMissions(dt: number): void {
    this.toastCheck += dt;
    if (this.toastCheck < 0.25) return;
    this.toastCheck = 0;
    for (const m of newlyCompleted(this.missionState, this.stats, this.toasted)) {
      this.toasted.add(m.id);
      const slot = nextToastSlot(this.time.now, this.toastFreeAt, 1600);
      this.toastFreeAt = slot.freeAt;
      this.time.delayedCall(slot.showAt - this.time.now, () => {
        if (this.sys.isActive() && !this.dead) this.showMissionToast();
      });
    }
  }

  private showMissionToast(): void {
    const { accent } = this.kit.theme;
    const c = this.add.container(W / 2, -60).setDepth(110);
    const g = this.add.graphics();
    g.fillStyle(0x1a1033, 0.85);
    g.fillRoundedRect(-200, -38, 400, 76, 38);
    g.lineStyle(4, accent, 1);
    g.strokeRoundedRect(-200, -38, 400, 76, 38);
    const label = this.add.text(0, 0, this.kit.t('missionComplete'), this.textStyleFor('field', 34, accent)).setOrigin(0.5);
    this.trackToast(c);
    c.add([g, label]);
    this.kit.audio.sfx('medal');
    this.tweens.add({ targets: c, y: 250, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, y: -80, delay: 1250, duration: 250, onComplete: () => this.dropToast(c) });
  }

  // ----------------------------------------------------------------- death

  /** Ends the run. `quit`: chosen from the pause menu, so no death effects and no revive offer. */
  private async die(quit = false): Promise<void> {
    const id = this.runId;
    const col = this.skinColor();
    if (!quit) {
      await this.fx.hitStop(80);
      if (id !== this.runId) return;
      this.fx.shake(0.8);
      // Landscape: built for the UI camera, which spans the whole canvas (side panels included), not just the field.
      this.inPanel(() => this.fx.flash(this.kit.theme.danger, 120));
      playDeath(this, this.fx, this.skin, this.player.x, PLAYER_Y, col);
    }
    this.hintDone = true;
    this.tutorialOn = false;
    this.tutorialView?.dismiss();
    this.tutorialView = null;
    this.tweens.killTweensOf(this.hint);
    this.hint.setVisible(false);
    this.fx.clearPops();
    for (const c of [...this.toastObjs]) {
      this.tweens.killTweensOf(c);
      this.dropToast(c);
    }
    this.player.setVisible(false);
    this.ring.setVisible(false);
    this.chompRing.setVisible(false);
    this.chompBanner.setVisible(false);
    this.syncShieldHud();
    this.trail?.stop();
    this.trail = null;
    this.kit.audio.music.stop();
    if (!quit) {
      this.kit.audio.sfx('death');
      await this.fx.timeScale(0.3, 500);
      if (id !== this.runId) return;
    }
    this.fx.clearPops();
    const clock = Math.floor(this.t);
    const state: RunState = {
      clock,
      seconds: Math.floor(this.t - this.runStartT),
      stars: this.stars,
      medals: [...this.earned],
      startTier: this.cfg.tier,
      stats: { ...this.stats, runs: 1 },
    };
    this.registry.set(RUN_STATE_KEY, state);
    void this.kit.gameOver(clock, quit ? undefined : { revive: () => this.revive() });
  }

  // ----------------------------------------------------------------- pause

  private addPauseButton(x: number, y: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(0x1a1033, 0.5);
    g.fillCircle(0, 0, 28);
    g.fillStyle(this.kit.theme.text, 1);
    g.fillRoundedRect(-11, -13, 8, 26, 2);
    g.fillRoundedRect(3, -13, 8, 26, 2);
    const c = this.add.container(x, y, [g]);
    // Same 76 px hit area as the kit's mute / fullscreen icons.
    c.setSize(76, 76);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      markButtonTap(this);
      this.openPause();
    });
    return c;
  }

  private togglePause(): void {
    if (this.paused) this.resumeRun();
    else this.openPause();
  }

  private canPause(): boolean {
    return this.ready && !this.dead && !this.paused && this.sys.isActive() && this.kit.session.state === 'playing';
  }

  private openPause(): void {
    if (!this.canPause()) return;
    this.paused = true;
    this.tweens.pauseAll();
    this.time.paused = true;
    this.kit.audio.music.stop();
    this.kit.session.pauseGameplay();
    const build = (): void => {
      const { theme } = this.kit;
      const f = this.frame;
      const cx = f.width / 2;
      const cy = f.height / 2;
      const land = f.mode === 'landscape';
      const dim = this.add.rectangle(0, 0, f.width, f.height, 0x0b0720, 0.72).setOrigin(0).setDepth(2000).setInteractive();
      // Swallow taps on the backdrop so they never reach the field (drag) underneath.
      dim.on('pointerdown', () => markButtonTap(this));
      const title = this.add.text(cx, cy - (land ? 190 : 230), this.kit.t('paused'), { ...this.textStyle(land ? 84 : 96, theme.text), strokeThickness: 10 }).setOrigin(0.5).setDepth(2001);
      const resume = addButton(this, cx, cy - (land ? 40 : 50), this.kit.t('resume'), {
        width: 360, height: land ? 100 : 110, fontSize: 44, fill: theme.primary, textColor: 0xffffff,
        onClick: () => this.resumeRun(),
      }).setDepth(2001);
      const end = addButton(this, cx, cy + (land ? 100 : 120), this.kit.t('endRun'), {
        width: 360, height: land ? 90 : 96, fontSize: 38, fill: theme.muted, textColor: 0xffffff,
        onClick: () => this.endRunFromPause(),
      }).setDepth(2001);
      const note = this.add.text(cx, cy + (land ? 172 : 200), this.kit.t('endRunNote'), this.textStyle(land ? MIN_PANEL_FONT - 8 : 26, theme.muted)).setOrigin(0.5).setDepth(2001);
      this.pauseObjs = [dim, title, resume, end, note];
    };
    if (this.frame.mode === 'landscape') this.inPanel(build);
    else build();
  }

  private closePauseMenu(): void {
    for (const o of this.pauseObjs) o.destroy();
    this.pauseObjs = [];
    this.paused = false;
    this.tweens.resumeAll();
    this.time.paused = false;
    // Held keys / drag motion from before the pause must not carry the player on resume.
    this.vel = 0;
  }

  private resumeRun(): void {
    if (!this.paused) return;
    this.closePauseMenu();
    this.kit.session.resumeGameplay();
    this.kit.audio.music.start();
  }

  private endRunFromPause(): void {
    if (!this.paused || this.dead) return;
    this.closePauseMenu();
    this.dead = true;
    void this.die(true);
  }

  private pauseMenuReport(): { resume: { x: number; y: number }; end: { x: number; y: number } } {
    const [, , resume, end] = this.pauseObjs as Phaser.GameObjects.Container[];
    return { resume: { x: resume!.x, y: resume!.y }, end: { x: end!.x, y: end!.y } };
  }

  private revive(): void {
    for (const b of this.blocks) {
      if (b.active && b.y > PLAYER_Y - 400 - b.h / 2) {
        b.active = false;
        b.img.setVisible(false);
      }
    }
    this.dead = false;
    this.tiltNeutral = null;
    this.clearStreaks();
    this.invuln = INVULN_REVIVE;
    this.vel = 0;
    this.player.setVisible(true);
    this.startTrail();
    this.kit.audio.music.start();
    this.setLayers(true);
  }

  // -------------------------------------------------------------------- hud

  /** Next-medal label + progress bar; redraws only when the label or a 1 % bar step changes. */
  private updateGoal(): void {
    const g = nextGoal(this.t, this.kit.session.best);
    this.goalState = g;
    if (g.kind === 'none') {
      if (this.goalText.visible) { this.goalText.setVisible(false); this.goalBar.clear(); this.lastGoalKey = ''; }
      return;
    }
    const pct = Math.round(g.frac * 100);
    const label = g.kind === 'medal'
      ? this.kit.t('goal.medal').replace('{medal}', this.kit.t(`medal.${g.id}`)).replace('{n}', String(g.targetSec))
      : this.kit.t('goal.best').replace('{n}', String(g.percent));
    const key = `${label}|${pct}`;
    if (key === this.lastGoalKey) return;
    this.lastGoalKey = key;
    this.goalText.setText(label).setVisible(true);
    const landscape = this.frame.mode === 'landscape';
    const bw = landscape ? 380 : 220;
    const bh = landscape ? 14 : 6;
    const by = this.anchors.goal.y + (landscape ? 52 : 38);
    const color = g.kind === 'medal' ? (MEDALS.find((m) => m.id === g.id)?.color ?? this.kit.theme.accent) : this.kit.theme.accent;
    this.goalBar.clear();
    this.goalBar.fillStyle(0x3a2f66, 0.85).fillRoundedRect(this.anchors.goal.x, by, bw, bh, bh / 2);
    if (g.frac > 0) this.goalBar.fillStyle(color, 1).fillRoundedRect(this.anchors.goal.x, by, Math.max(bh, bw * g.frac), bh, bh / 2);
  }

  private updateHud(dt: number): void {
    const sec = Math.floor(this.t);
    if (sec !== this.lastSecShown) {
      this.lastSecShown = sec;
      this.timerText.setText(formatTime(sec));
    }
    if (this.missionsText) {
      // Landscape panel: label line + progress line per mission, one blank line between missions.
      const lines = this.missionState.active.map((m) => missionPanelText(this.kit.t(`mission.${m.id}`), m, liveProgress(m, this.stats)));
      const txt = lines.join('\n\n');
      if (txt !== this.lastMissionsShown) {
        this.lastMissionsShown = txt;
        this.missionsText.setText(txt);
      }
    }
    this.updateGoal();
    this.updateGauge();
  }

  /** Graze gauge: GRAZE_FULL segments filling with near misses; while Chomp runs, one bar draining with its time. */
  private updateGauge(): void {
    const chomping = this.chompTimer > 0 && this.chompTotal > 0;
    const drain = chomping ? Math.round((this.chompTimer / this.chompTotal) * 100) : -1;
    const key = `${this.graze}|${drain}`;
    if (key === this.lastGaugeKey) return;
    this.lastGaugeKey = key;
    const landscape = this.frame.mode === 'landscape';
    const x = this.anchors.gauge.x + (landscape ? 0 : 32);
    const y = this.anchors.gauge.y + (landscape ? 50 : 0);
    const w = landscape ? 380 : 136;
    const h = landscape ? 20 : 16;
    const g = this.gaugeBar;
    g.clear();
    if (chomping) {
      g.fillStyle(0x3a2f66, 0.85).fillRoundedRect(x, y, w, h, h / 2);
      g.fillStyle(0x3b7bff, 1).fillRoundedRect(x, y, Math.max(h, (w * drain) / 100), h, h / 2);
      return;
    }
    const gap = 4;
    const seg = (w - gap * (GRAZE_FULL - 1)) / GRAZE_FULL;
    for (let i = 0; i < GRAZE_FULL; i++) {
      g.fillStyle(i < this.graze ? 0x3ff0ff : 0x3a2f66, i < this.graze ? 1 : 0.85);
      g.fillRoundedRect(x + i * (seg + gap), y, seg, h, Math.min(4, h / 2));
    }
  }
}
