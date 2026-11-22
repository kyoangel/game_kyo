import Phaser from 'phaser';
import { addBackground, cssColor, ensureTextures, getKit, type Fx, type GameInput, type Kit } from '@gf/game-kit';
import { Combo, horizontalGap, isNearMiss } from './combo.ts';
import { emptyStats, newlyCompleted, sanitizeMissions, type MissionId, type MissionState, type RunStats } from './missions.ts';
import { sanitizeAssist, sanitizeStartTier, DEFAULT_ASSIST } from './progression.ts';
import { buildRunConfig, GRACE_SECONDS, MAGNET_SPEED, type RunConfig } from './runSetup.ts';
import { emptyWorkshop, sanitizeWorkshop, shieldInterval, starInterval } from './workshop.ts';
import { fallSpeed, OVERDRIVE_T, overdrive, speedBoost } from './difficulty.ts';
import { EDGE_W, MAX_STREAKS, streakAlpha, streakLen, streakSpawnRate, streakSpeed, streakTint, streakWidth, streakX, vignetteAlpha } from './speedFx.ts';
import { SKINS, type Skin } from './economy.ts';
import { formatTime } from './format.ts';
import { MEDALS, mergeMedals, medalsReached, type MedalId } from './medals.ts';
import { BLOCK_ORANGE, BLOCK_PAD, BLOCK_PINK, blockTexture, ensurePlayTextures, warnTexture, WARN_H } from './playArt.ts';
import { mulberry32 } from './rng.ts';
import { RUN_STATE_KEY, type RunState } from './runState.ts';
import { skinTextureKey } from './skinArt.ts';
import { SpawnScheduler } from './schedule.ts';
import { BLOCK_H, isRush, PLAYER_HITBOX_W } from './waves.ts';

const W = 720;
const H = 1280;
const PLAYER_Y = 1100;
const PLAYER_HALF = 28;
const KEY_ACCEL = 5000;
const KEY_DECEL = 7000;
const KEY_MAX = 640;
const TELEGRAPH = 0.4;
const BLOCK_POOL = 48;
const CHEV_POOL = 48;
const PICKUP_POOL = 8;
const DOT_COUNT = 26;
const INVULN_REVIVE = 2;
const INVULN_SHIELD = 0.5;
const PRISM_STEPS = 72;

interface Pending {
  at: number;
  x: number;
  w: number;
  h: number;
  speedMul: number;
  rush: boolean;
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

  private t = 0;
  private score = 0;
  private dispScore = 0;
  private stars = 0;
  private combo = new Combo();
  private earned: MedalId[] = [];

  private skin: Skin = SKINS[0]!;
  private player!: Phaser.GameObjects.Image;
  private trail: { stop(): void } | null = null;
  private ring!: Phaser.GameObjects.Image;
  private vel = 0;
  private tiltN = 0;
  private invuln = 0;
  private shieldHits = 0;
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
  private toastQueue = 0;
  private toastCheck = 0;
  private graceBanner!: Phaser.GameObjects.Text;

  private rushIdx = 0;
  private rushWarned = false;
  private lastLayers = 0;

  private grid!: Phaser.GameObjects.Graphics;
  private gridPhase = 0;
  private dots: Phaser.GameObjects.Image[] = [];
  private dotSpeed: number[] = [];

  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private comboBar!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private rushBanner!: Phaser.GameObjects.Text;
  private lastScoreShown = -1;
  private lastSecShown = -1;
  private lastComboShown = -1;
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
    ensureTextures(this, theme);
    ensurePlayTextures(this);
    addBackground(this);

    this.runId++;
    this.ready = false;
    this.dead = false;
    this.rng = mulberry32(Date.now() >>> 0);
    this.t = 0;
    this.score = 0;
    this.dispScore = 0;
    this.stars = 0;
    this.combo = new Combo();
    this.earned = [];
    this.vel = 0;
    this.tiltN = 0;
    this.invuln = 0;
    this.shieldHits = 0;
    this.pending = [];
    this.cfg = buildRunConfig({ workshop: emptyWorkshop(), assist: DEFAULT_ASSIST, tier: 'none', rng: this.rng });
    this.runStartT = 0;
    this.stats = emptyStats();
    this.toasted = new Set();
    this.toastQueue = 0;
    this.toastCheck = 0;
    this.nextStar = 6 + this.rng() * 3;
    this.nextShield = 25;
    this.rushIdx = 0;
    this.rushWarned = false;
    this.lastLayers = 0;
    this.rushBannerUntil = 0;
    this.odShown = false;
    this.streakAcc = 0;
    this.lastScoreShown = -1;
    this.lastSecShown = -1;
    this.lastComboShown = -1;
    this.trail = null;

    if (__GK_TEST_HOOKS__) {
      const w = window as unknown as { __dd?: { god: boolean } };
      const god = w.__dd?.god ?? false;
      w.__dd = {
        god,
        stats: () => ({
          t: this.t,
          score: this.score,
          combo: this.combo.count,
          multiplier: this.combo.multiplier,
          stars: this.stars,
          shieldHeld: this.shieldHeld,
          clock: this.t,
          startTier: this.cfg.tier,
          shieldHits: this.shieldHits,
          headStart: this.cfg.headStart,
          assisted: this.cfg.assisted,
          rush: isRush(this.t) || this.t >= OVERDRIVE_T,
          medals: [...this.earned],
          layers: this.layerCount(),
          overdrive: overdrive(this.t),
          streaks: this.streaks.filter((s) => s.active).length,
        }),
        warp: (seconds: number) => { this.t += seconds; },
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
    ]).then(([sid, rawWs, rawAssist, rawTier, rawMedals, rawMissions]) => {
      if (id !== this.runId || !this.sys.isActive()) return;
      this.skin = SKINS.find((s) => s.id === sid) ?? SKINS[0]!;
      const tier = sanitizeStartTier(rawTier, mergeMedals(rawMedals, []));
      const cfg = buildRunConfig({ workshop: sanitizeWorkshop(rawWs), assist: sanitizeAssist(rawAssist), tier, rng: this.rng });
      this.cfg = cfg;
      this.missionState = sanitizeMissions(rawMissions, this.rng);
      // Persist the drawn missions so results (and later runs) see exactly what in-run toasts referred to.
      if (rawMissions === null || JSON.stringify(rawMissions) !== JSON.stringify(this.missionState)) {
        void save.setJSON('missions', this.missionState);
      }
      this.scheduler = new SpawnScheduler(this.rng, W, true, { speedMul: cfg.speedMul, intervalMul: cfg.intervalMul, startT: cfg.startT });
      this.t = cfg.startT;
      this.runStartT = cfg.startT;
      this.score = cfg.headStart;
      this.dispScore = cfg.headStart;
      this.rushIdx = cfg.rushIdx;
      this.nextShield = cfg.firstShieldAt;
      this.nextStar = cfg.startT + starInterval(cfg.luckLevel, this.rng());
      this.shieldHits = cfg.startShieldHits;
      this.combo = new Combo(cfg.comboTimeout);
      if (cfg.grace > 0) this.graceBanner.setText(this.kit.t(`tierStart.${cfg.tier}`));
      this.buildPlayer();
      this.ready = true;
      this.kit.audio.music.start();
      this.setLayers(true);
    });
  }

  // ---------------------------------------------------------------- build

  private buildBackdrop(): void {
    this.grid = this.add.graphics().setDepth(-90);
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
    return { img: this.add.image(0, 0, key).setVisible(false).setDepth(5), active: false, x: 0, y: 0, w: 0, h: 0, speedMul: 1, checked: false };
  }

  private buildPlayer(): void {
    const key = skinTextureKey(this, this.skin);
    this.player = this.add.image(W / 2, PLAYER_Y, key).setDepth(10);
    this.ring = this.add.image(W / 2, PLAYER_Y, 'dd-ring').setDepth(11).setVisible(false);
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
    const tc = this.skin.trailColor;
    this.trail = this.fx.trail(this.player, { color: tc === 'rainbow' ? 0xffffff : tc });
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

  private buildHud(): void {
    const { theme } = this.kit;
    this.scoreText = this.add.text(24, 18, '0', this.textStyle(48, theme.text)).setDepth(100);
    this.comboText = this.add.text(24, 76, '', this.textStyle(40, theme.accent)).setDepth(100).setVisible(false);
    this.comboBar = this.add.graphics().setDepth(100);
    this.timerText = this.add.text(W - 100, 24, '0:00', this.textStyle(40, theme.text)).setOrigin(1, 0).setDepth(100);
    this.kit.addMuteButton(this, W - 48, 48).setDepth(100);
    this.hint = this.add
      .text(W / 2, 880, this.kit.t('dragHint'), this.textStyle(36, theme.muted))
      .setOrigin(0.5)
      .setDepth(100);
    this.tweens.add({ targets: this.hint, alpha: 0, delay: 3000, duration: 600 });
    this.rushBanner = this.add
      .text(W / 2, 330, this.kit.t('rush'), { ...this.textStyle(110, 0xffa14d), strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);
    this.odBanner = this.add
      .text(W / 2, 330, this.kit.t('overdrive'), { ...this.textStyle(96, 0xffa14d), strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);
    this.graceBanner = this.add
      .text(W / 2, 330, '', { ...this.textStyle(84, theme.accent), strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);
  }

  // ---------------------------------------------------------------- loop

  update(_time: number, deltaMs: number): void {
    const raw = Math.min(deltaMs, 50) / 1000;
    const dt = raw * this.time.timeScale;
    const drag = this.gin.dragDx();
    if (this.fx.frozen || !this.ready) return;

    this.updateBackdrop(dt);
    this.updateSpeedFx(dt);
    if (!this.dead) {
      const prev = this.t;
      this.t += dt;
      this.movePlayer(dt, drag);
      this.schedule();
      this.updateRush();
      this.updateOverdriveBanner();
      this.setLayers(false);
      this.combo.tick(dt);
      if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
      this.updateMedals(prev, this.t);
      this.stats.seconds = Math.floor(this.t - this.runStartT);
      this.stats.score = this.score - this.cfg.headStart;
      this.checkMissions(dt);
    }
    this.graceBanner.setVisible(this.cfg.grace > 0 && !this.dead && this.t < this.cfg.startT + GRACE_SECONDS);
    this.updateChevrons(dt);
    this.updateBlocks(dt);
    this.updatePickups(dt);
    if (!this.dead) this.updatePlayerVisual(dt);
    this.updateHud(dt);
  }

  private updateBackdrop(dt: number): void {
    const od = overdrive(this.t);
    const speed = fallSpeed(this.t) * speedBoost(this.t) * (1 + od);
    this.gridPhase = (this.gridPhase + (dt * speed * 0.3) / 160) % 1;
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
    x = Phaser.Math.Clamp(x, PLAYER_HALF, W - PLAYER_HALF);
    if (x === PLAYER_HALF || x === W - PLAYER_HALF) this.vel = 0;
    this.player.x = x;
    const eff = dt > 0 ? (x - before) / dt : 0;
    this.tiltN += (Phaser.Math.Clamp(eff / KEY_MAX, -1, 1) - this.tiltN) * Math.min(1, dt * 14);
  }

  private updatePlayerVisual(dt: number): void {
    const n = Math.abs(this.tiltN);
    this.player.setAngle(this.tiltN * 12);
    this.player.setScale(1 + 0.25 * n, 1 - 0.15 * n);
    if (this.skin.color === 'cycle') this.player.setTint(this.skinColor());
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    this.player.setAlpha(blink ? 0.35 : 1);
    this.ring.setVisible(this.shieldHeld);
    if (this.shieldHeld) {
      this.ring.setTexture(this.shieldHits >= 2 ? 'dd-ring2' : 'dd-ring');
      this.ring.setPosition(this.player.x, this.player.y);
      this.ring.setScale(1 + Math.sin(this.t * 8) * 0.04);
      this.ring.rotation += dt * 1.5;
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

  private acquireChev(p: Pending): void {
    const c = this.chevs.find((q) => !q.active);
    if (!c) return;
    c.active = true;
    c.age = 0;
    const key = warnTexture(this, p.w);
    c.img.setTexture(key).setPosition(p.x, WARN_H / 2 + 4).setVisible(true).setAlpha(1);
    c.img.setDisplaySize(p.w, WARN_H);
    c.img.setTint(p.rush ? BLOCK_ORANGE : 0xffffff);
    p.chev = c;
  }

  private spawnBlock(p: Pending, late: number): void {
    let b = this.blocks.find((q) => !q.active);
    if (!b) {
      b = this.makeBlock();
      this.blocks.push(b);
    }
    const { key, bodyW } = blockTexture(this, p.w, p.rush);
    b.active = true;
    b.checked = false;
    b.x = p.x;
    b.w = p.w;
    b.h = p.h;
    b.speedMul = p.speedMul;
    b.y = -BLOCK_H / 2 - BLOCK_PAD + late * fallSpeed(this.t) * speedBoost(this.t) * p.speedMul * this.cfg.speedMul;
    b.img.setTexture(key).setVisible(true);
    b.img.setScale(p.w / bodyW, 1);
    b.img.setPosition(b.x, b.y);
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
    p.img.setTexture(kind === 'star' ? 'dd-star' : 'dd-shield').setVisible(true).setPosition(x, p.y).setAlpha(1).setScale(1);
    return true;
  }

  // ------------------------------------------------------------- rush/music

  private updateRush(): void {
    const next = 45 + 45 * this.rushIdx;
    if (next >= OVERDRIVE_T) {
      this.rushBanner.setVisible(false);
      return;
    }
    if (!this.rushWarned && this.t >= next - 1) {
      this.rushWarned = true;
      this.rushBannerUntil = next + 0.8;
      this.kit.audio.sfx('rush');
    }
    if (this.rushWarned && this.t >= next + 4) {
      if (next >= this.runStartT) this.stats.rushes++;
      this.rushIdx++;
      this.rushWarned = false;
    }
    const show = this.rushWarned && this.t < this.rushBannerUntil;
    this.rushBanner.setVisible(show);
    if (show) {
      this.rushBanner.setScale(1 + 0.08 * Math.sin(this.t * 24));
      this.rushBanner.setAlpha(Math.floor(this.t * 10) % 2 === 0 ? 1 : 0.6);
    }
  }

  private layerCount(): 1 | 2 | 3 | 4 {
    return isRush(this.t) || this.t >= OVERDRIVE_T ? 4 : layersFor(this.t);
  }

  private updateOverdriveBanner(): void {
    if (!this.odShown && this.t >= OVERDRIVE_T && this.t < OVERDRIVE_T + 1.5) {
      this.odShown = true;
      this.kit.audio.sfx('rush');
    }
    const show = this.odShown && this.t >= OVERDRIVE_T && this.t < OVERDRIVE_T + 1.2;
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
    if (n === this.lastLayers && !force) return;
    this.lastLayers = n;
    this.kit.audio.music.setLayers(n);
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
        const dy = Math.abs(b.y - PLAYER_Y);
        const reachY = (PLAYER_HITBOX_W + b.h * 0.9) / 2;
        const gap = horizontalGap({ x: px, w: PLAYER_HITBOX_W }, { x: b.x, w: b.w * 0.9 });
        if (dy < reachY && gap <= 0 && this.invuln <= 0) {
          this.onHit(b);
          continue;
        }
        if (!b.checked && b.y >= PLAYER_Y) {
          b.checked = true;
          if (isNearMiss(gap, this.cfg.nearMissWindow)) this.onNearMiss(b);
        }
      }
      if (b.y - BLOCK_H / 2 > H + BLOCK_PAD) {
        b.active = false;
        b.img.setVisible(false);
        if (!this.dead) this.score += this.combo.multiplier;
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
      if (p.kind === 'star' && radius > 0 && !this.dead && md <= radius && md > 0) {
        const step = Math.min(md, MAGNET_SPEED * dt);
        p.x += (mdx / md) * step;
        p.y += (mdy / md) * step;
      } else {
        p.y += speed * dt;
      }
      p.img.x = p.x;
      p.img.y = p.y;
      p.img.rotation += (p.kind === 'star' ? 3 : 1.2) * dt;
      if (p.y > H + 40) {
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
    if (p.kind === 'star') {
      this.stars++;
      this.stats.stars++;
      this.score += 10;
      this.kit.audio.sfx('pickup');
      this.fx.burst(p.x, p.y, { color: 0xffe14d, count: 16, speed: 300, lifespanMs: 450 });
      this.fx.popText(p.x, p.y - 20, '+10', { color: 0xffe14d, size: 30 });
    } else {
      this.shieldHits = this.cfg.shieldCapacity;
      this.kit.audio.sfx('shield');
      this.fx.burst(p.x, p.y, { color: 0x58ff9a, count: 18, speed: 320, lifespanMs: 500 });
    }
  }

  private onNearMiss(b: Block): void {
    const pts = this.combo.hit();
    this.score += pts;
    const mult = this.combo.multiplier;
    this.stats.nearMisses++;
    this.stats.maxMultiplier = Math.max(this.stats.maxMultiplier, mult);
    const side = Math.sign(b.x - this.player.x) || 1;
    this.fx.popText(this.player.x, PLAYER_Y - 70, `+5 ×${mult}`, { color: this.kit.theme.accent, size: 34 });
    this.kit.audio.sfx('nearMiss', { step: this.combo.count });
    this.fx.burst(this.player.x + side * 24, PLAYER_Y, { color: 0xffffff, count: 8, speed: 260, lifespanMs: 300 });
  }

  private onHit(b: Block): void {
    if (this.shieldHits > 0) {
      this.shieldHits -= 1;
      this.stats.shieldBlocks++;
      this.ring.setVisible(this.shieldHits > 0);
      this.invuln = INVULN_SHIELD;
      this.combo.reset();
      b.active = false;
      b.img.setVisible(false);
      this.kit.audio.sfx('shieldBreak');
      this.fx.burst(b.x, b.y, { color: BLOCK_PINK, count: 28, speed: 480, lifespanMs: 500 });
      this.fx.burst(this.player.x, PLAYER_Y, { color: 0x58ff9a, count: 20, speed: 380, lifespanMs: 500 });
      void this.fx.hitStop(60);
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
    const label = this.add.text(-84, 0, this.kit.t(`medal.${id}`), this.textStyle(36, m.color)).setOrigin(0, 0.5);
    c.add([g, label]);
    this.tweens.add({ targets: c, y: 170, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, y: -80, delay: 1750, duration: 250, onComplete: () => c.destroy() });
  }

  private checkMissions(dt: number): void {
    this.toastCheck += dt;
    if (this.toastCheck < 0.25) return;
    this.toastCheck = 0;
    for (const m of newlyCompleted(this.missionState, this.stats, this.toasted)) {
      this.toasted.add(m.id);
      const delay = this.toastQueue;
      this.toastQueue += 1.6;
      this.time.delayedCall(delay * 1000, () => {
        this.toastQueue = Math.max(0, this.toastQueue - 1.6);
        if (this.sys.isActive()) this.showMissionToast();
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
    const label = this.add.text(0, 0, this.kit.t('missionComplete'), this.textStyle(34, accent)).setOrigin(0.5);
    c.add([g, label]);
    this.kit.audio.sfx('medal');
    this.tweens.add({ targets: c, y: 250, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, y: -80, delay: 1250, duration: 250, onComplete: () => c.destroy() });
  }

  // ----------------------------------------------------------------- death

  private async die(): Promise<void> {
    const id = this.runId;
    const col = this.skinColor();
    await this.fx.hitStop(80);
    if (id !== this.runId) return;
    this.fx.shake(0.8);
    this.fx.flash(this.kit.theme.danger, 120);
    this.fx.burst(this.player.x, PLAYER_Y, { color: col, count: 40, speed: 560, lifespanMs: 700 });
    this.player.setVisible(false);
    this.ring.setVisible(false);
    this.trail?.stop();
    this.trail = null;
    this.kit.audio.sfx('death');
    this.kit.audio.music.stop();
    await this.fx.timeScale(0.3, 500);
    if (id !== this.runId) return;
    const state: RunState = {
      score: this.score,
      seconds: Math.floor(this.t - this.runStartT),
      stars: this.stars,
      medals: [...this.earned],
      headStart: this.cfg.headStart,
      startTier: this.cfg.tier,
      stats: { ...this.stats, runs: 1 },
    };
    this.registry.set(RUN_STATE_KEY, state);
    void this.kit.gameOver(this.score, { revive: () => this.revive() });
  }

  private revive(): void {
    for (const b of this.blocks) {
      if (b.active && b.y > PLAYER_Y - 400 - b.h / 2) {
        b.active = false;
        b.img.setVisible(false);
      }
    }
    this.dead = false;
    this.clearStreaks();
    this.combo.reset();
    this.invuln = INVULN_REVIVE;
    this.vel = 0;
    this.player.setVisible(true);
    this.startTrail();
    this.kit.audio.music.start();
    this.setLayers(true);
  }

  // -------------------------------------------------------------------- hud

  private updateHud(dt: number): void {
    this.dispScore += (this.score - this.dispScore) * Math.min(1, dt * 12);
    if (this.score - this.dispScore < 0.5) this.dispScore = this.score;
    const shown = Math.round(this.dispScore);
    if (shown !== this.lastScoreShown) {
      this.lastScoreShown = shown;
      this.scoreText.setText(String(shown));
    }
    const sec = Math.floor(this.t);
    if (sec !== this.lastSecShown) {
      this.lastSecShown = sec;
      this.timerText.setText(formatTime(sec));
    }
    const c = this.combo.count;
    const mult = this.combo.multiplier;
    const key = c === 0 ? 0 : mult;
    if (key !== this.lastComboShown) {
      this.lastComboShown = key;
      this.comboText.setVisible(c > 0).setText(`×${mult}`);
      if (c > 0) this.tweens.add({ targets: this.comboText, scale: { from: 1.4, to: 1 }, duration: 160 });
    }
    this.comboBar.clear();
    if (c > 0) {
      const frac = Math.max(0, 1 - this.combo.sinceLast / this.combo.timeout);
      this.comboBar.fillStyle(0x1a1033, 0.6);
      this.comboBar.fillRoundedRect(24, 140, 170, 12, 6);
      this.comboBar.fillStyle(this.kit.theme.accent, 1);
      this.comboBar.fillRoundedRect(24, 140, 170 * frac, 12, 6);
    }
  }
}
