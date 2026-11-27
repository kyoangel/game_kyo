import Phaser from 'phaser';
import { addButton, ensureTextures, getKit, type Fx, type GameInput, type Kit } from '@gf/game-kit';
import { BALANCE, diagnoseDefeat, FEATURES, medalForTimeLeft } from './balance.ts';
import { createBossEvoRig, formatBossName, getBossEvo, type BossEvoRig, type BossEvoSpec } from './bossEvo.ts';
import { getChapterForLoop, resolveObstacleCollision, type ChapterStageInfo, type MapPoiDef, type VillagePlacement } from './chapters.ts';
import { playDefeatJingle, playGoddessReviveChime, playVictoryFanfare } from './fanfare.ts';
import {
  armorPolishCost,
  elixirCost,
  getArmorSpec,
  getWeaponSpec,
  innHealCost,
  MAX_POLISH_LV,
  weaponPolishCost,
} from './gear.ts';
import {
  activeHeroCharacter,
  computeCrystalReward,
  computeScore,
  defaultMeta,
  HARD_MODE_LOOP,
  resolveHeroAppearance,
  sanitizeMeta,
  unlockArmorSkin,
  unlockWeaponSkin,
  type MetaSave,
  type RunSummary,
} from './meta.ts';
import { ensureHeroAppearance, ensurePixelArt, mobTextureKey, type OverworldMobId } from './pixelArt.ts';
import { isTouchMobileViewport } from './mobile.ts';
import {
  bossBonusDamageMult,
  bossComboMultiplier,
  bossFireballDamage,
  buyBattleElixir,
  buyInnHeal,
  canEasilyBeatBoss,
  createHeroStats,
  grantRewards,
  makeEnemy,
  polishArmor,
  polishWeapon,
  resolveBossDashHit,
  resolveBumpClash,
  REVIVE_BONUS_SEC,
  RUN_DURATION_SEC,
  totalAtk,
  totalDef,
  type EnemySpec,
  type HeroStats,
} from './systems.ts';

const WORLD_W = 1860;
const WORLD_H = 960;
const ARENA_GROUND_Y = 560;
const ARENA_BOSS_X = 1040;
const ARENA_BOSS_Y = ARENA_GROUND_Y - 42;

const CASTLE_POS = { x: 1690, y: 480 };

interface EnemyEntity {
  spec: EnemySpec;
  hp: number;
  maxHp: number;
  homeX: number;
  homeY: number;
  sprite: Phaser.GameObjects.Image;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  alive: boolean;
  respawnTimer: number;
  wanderPhase: number;
  bumpCooldown: number;
}

interface BossFireball {
  obj: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Arc;
  x: number;
  y: number;
  vx: number;
}

interface PoiEntity {
  def: MapPoiDef;
  used: boolean;
  ring: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.GameObject;
  label: Phaser.GameObjects.Text;
}

export const LAST_RUN_KEY = 'chronoRush:lastRun';
export const META_SAVE_KEY = 'meta';

export class PlayScene extends Phaser.Scene {
  private kit!: Kit;
  private fx!: Fx;
  private inputCtrl!: GameInput;
  private meta: MetaSave = defaultMeta();
  private hero!: HeroStats;
  private heroFrames: [string, string] = ['px-hero-0', 'px-hero-1'];
  private heroSprite!: Phaser.GameObjects.Image;
  private heroShadow!: Phaser.GameObjects.Ellipse;
  private heroHpBg!: Phaser.GameObjects.Rectangle;
  private heroHpFill!: Phaser.GameObjects.Rectangle;
  private heroReadyBang!: Phaser.GameObjects.Text;
  private bossReadyAlerted = false;

  private enemies: EnemyEntity[] = [];
  private pois: PoiEntity[] = [];
  private stage!: ChapterStageInfo;
  private bossSpec!: EnemySpec;
  private bossHp = 1;
  private bossMaxHp = 1;
  private bossPatternFlip = false;

  // Mode: overworld vs horizontal side-view Boss Arena
  private mode: 'overworld' | 'boss' = 'overworld';
  private castleReentryCooldown = 0;
  private bossArenaObjects: Phaser.GameObjects.GameObject[] = [];
  private arenaHero!: Phaser.GameObjects.Image;
  private arenaHeroShadow!: Phaser.GameObjects.Ellipse;
  private arenaHeroVx = 0;
  private arenaHeroVy = 0;
  private arenaKnockbackTimer = 0;
  private arenaBoss!: Phaser.GameObjects.Image;
  private arenaBossEvo!: BossEvoSpec;
  private arenaBossEvoRig: BossEvoRig | null = null;
  private arenaBossVolleyCount = 0;
  private arenaBossHpFill!: Phaser.GameObjects.Rectangle;
  private arenaBossHpText!: Phaser.GameObjects.Text;
  private arenaBossAttackTimer = 1.6;
  private arenaBossCharging = 0;
  private arenaBossHitCooldown = 0;
  private arenaBossAnimClock = 0;
  private arenaCombo = 0;
  private arenaComboText?: Phaser.GameObjects.Text;
  private arenaTelegraphLine?: Phaser.GameObjects.Rectangle;
  private arenaTelegraphWarn?: Phaser.GameObjects.Text;
  private arenaPendingOffsetY = 0;
  private fireballs: BossFireball[] = [];

  private timeLeft: number = RUN_DURATION_SEC;
  private kills = 0;
  private animClock = 0;
  private dashTimeLeft = 0;
  private dashCooldownLeft = 0;
  private dashDir = { x: 1, y: 0 };
  private invulnLeft = 0;
  private villageReentryCooldown = 0;
  private villageOpenedAt = 0;
  private heroPrevX = 0;
  private heroPrevY = 0;
  private activeVillage: VillagePlacement | null = null;
  private pausedByUser = false;
  private pauseOverlay: Phaser.GameObjects.GameObject[] = [];
  private defeatCutsceneObjects: Phaser.GameObjects.GameObject[] = [];
  private skinsUnlockedThisRun: string[] = [];
  private crystalReviveUsed = false;
  private runEnded = false;
  private ready = false;
  private lastMusicState = '';

  // HUD elements (scrollFactor 0)
  private timerText!: Phaser.GameObjects.Text;
  private timerBadge!: Phaser.GameObjects.Rectangle;
  private lvText!: Phaser.GameObjects.Text;
  private statText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpBarText!: Phaser.GameObjects.Text;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private bossArrowText!: Phaser.GameObjects.Text;
  private dashBarFill!: Phaser.GameObjects.Rectangle;
  private pausedBanner!: Phaser.GameObjects.Text;
  private controlsHintText!: Phaser.GameObjects.Text;
  private isMobile = false;
  private villageOverlay: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Play');
  }

  create(): void {
    this.kit = getKit(this);
    this.isMobile = isTouchMobileViewport();
    // Enable multi-touch (up to 3 simultaneous fingers) so left-thumb joystick + right-thumb DASH work together!
    if (this.input.manager.pointersTotal < 3) {
      this.input.addPointer(3 - this.input.manager.pointersTotal);
    }
    ensureTextures(this, this.kit.theme);
    ensurePixelArt(this);
    this.fx = this.kit.fx(this);
    this.inputCtrl = this.kit.input(this, { joystick: true, joystickRadius: 68 });

    this.enemies = [];
    this.pois = [];
    this.villageOverlay = [];
    this.pauseOverlay = [];
    this.pausedByUser = false;
    this.bossArenaObjects = [];
    this.fireballs = [];
    this.skinsUnlockedThisRun = [];
    this.crystalReviveUsed = false;
    this.activeVillage = null;
    this.mode = 'overworld';
    this.castleReentryCooldown = 0;
    this.runEnded = false;
    this.ready = false;
    this.timeLeft = RUN_DURATION_SEC;
    this.kills = 0;
    this.animClock = 0;
    this.dashTimeLeft = 0;
    this.dashCooldownLeft = 0;
    this.invulnLeft = 0;
    this.villageReentryCooldown = 0;
    this.lastMusicState = '';
    this.bossReadyAlerted = false;

    let alive = true;
    // Reliable capture-phase window keydown handler for village hotkeys (1/2/3/Space/Esc), Boss jump, and Dash
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!alive || !this.ready || this.runEnded || this.scene.isPaused()) return;
      if (this.pausedByUser) {
        if (e.code === 'Escape' || e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          this.closePauseMenu();
        } else if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R' || e.key === 'ㄐ') {
          e.preventDefault();
          this.restartFromPause();
        }
        return;
      }
      if (this.activeVillage) {
        const is1 = e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1' || e.key === 'ㄅ' || e.keyCode === 49 || e.keyCode === 97;
        const is2 = e.code === 'Digit2' || e.code === 'Numpad2' || e.key === '2' || e.key === 'ㄉ' || e.keyCode === 50 || e.keyCode === 98;
        const is3 = e.code === 'Digit3' || e.code === 'Numpad3' || e.key === '3' || e.key === 'ˇ' || e.keyCode === 51 || e.keyCode === 99;
        const is4 = e.code === 'Digit4' || e.code === 'Numpad4' || e.key === '4' || e.key === 'ˋ' || e.keyCode === 52 || e.keyCode === 100;
        if (is1) {
          e.preventDefault();
          this.handlePolishWeapon();
        } else if (is2) {
          e.preventDefault();
          this.handlePolishArmor();
        } else if (is3) {
          e.preventDefault();
          this.handleInnHeal();
        } else if (is4) {
          e.preventDefault();
          this.handleBuyElixir();
        } else if (e.code === 'Space' || e.code === 'Escape' || e.key === ' ') {
          e.preventDefault();
          this.closeVillage();
        }
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this.openPauseMenu();
        return;
      }
      if (this.mode === 'boss' && (e.code === 'KeyW' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'ㄊ')) {
        e.preventDefault();
        this.tryArenaJump();
        return;
      }
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.key === ' ') {
        e.preventDefault();
        this.tryDash();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    this.events.once('shutdown', () => {
      alive = false;
      window.removeEventListener('keydown', onKeyDown, true);
      this.kit.audio.music.stop();
    });

    const finishSetup = (raw: unknown): void => {
      if (!alive) return;
      this.meta = sanitizeMeta(raw);
      this.stage = getChapterForLoop(this.meta.loop);
      this.bossPatternFlip = false;
      this.hero = createHeroStats(this.meta);
      // Consume armed Pre-Run Boosts once applied to this run
      if (FEATURES.preRunBoosts && this.meta.activeBoosts.length > 0) {
        this.meta = { ...this.meta, activeBoosts: [] };
        void this.kit.save.setJSON(META_SAVE_KEY, this.meta);
      }
      this.timeLeft = this.hero.runDurationSec;
      this.bossSpec = makeEnemy('demonLord', this.meta.loop);
      this.bossHp = this.bossSpec.hp;
      this.bossMaxHp = this.bossSpec.hp;
      const { weaponLook, armorLook, shieldLook } = resolveHeroAppearance(this.meta);
      this.heroFrames = ensureHeroAppearance(this, weaponLook, armorLook, shieldLook, activeHeroCharacter(this.meta));
      this.buildWorld();
      this.spawnHero();
      this.spawnEntities();
      this.buildHud();
      this.setupCamera();
      this.showEpisodeTitleCard();
      this.ready = true;
      this.kit.audio.music.start();
      this.syncMusicIntensity();
      this.updateHud();
    };

    void this.kit.save
      .getJSON<unknown>(META_SAVE_KEY, null)
      .then(finishSetup)
      .catch(() => finishSetup(null));
  }

  private showEpisodeTitleCard(): void {
    const { width, height } = this.scale;
    const font = this.kit.theme.font;
    const title = `${this.kit.t(`chapter.${this.stage.chapter.id}`)} ${this.stage.roman}`;
    const sub = this.stage.isFinale ? this.kit.t('finaleTag') : `${this.kit.t('loopLabel')} ${this.meta.loop}`;
    const bg = this.add.rectangle(width / 2, height / 2 - 40, 620, 126, 0x09050f, 0.85).setStrokeStyle(4, this.stage.chapter.arenaAccent).setScrollFactor(0).setDepth(180);
    const t1 = this.add
      .text(width / 2, height / 2 - 58, title, {
        fontFamily: font,
        fontSize: '42px',
        fontStyle: 'bold',
        color: '#facc15',
        stroke: '#09050f',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(181);
    const t2 = this.add
      .text(width / 2, height / 2 - 12, sub, {
        fontFamily: font,
        fontSize: '20px',
        fontStyle: 'bold',
        color: this.stage.isFinale ? '#fda4af' : '#bae6fd',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(181);
    this.tweens.add({
      targets: [bg, t1, t2],
      alpha: 0,
      delay: 1200,
      duration: 500,
      onComplete: () => {
        bg.destroy();
        t1.destroy();
        t2.destroy();
      },
    });
  }

  private buildWorld(): void {
    const ch = this.stage.chapter;
    const g = this.add.graphics().setDepth(0);

    // 4 Chapter Biome Zones
    g.fillStyle(ch.zoneColors[0], 1);
    g.fillRect(0, 0, 620, WORLD_H);
    g.fillStyle(ch.zoneColors[1], 1);
    g.fillRect(620, 0, 500, WORLD_H);
    g.fillStyle(ch.zoneColors[2], 1);
    g.fillRect(1120, 0, 370, WORLD_H);
    g.fillStyle(ch.zoneColors[3], 1);
    g.fillRect(1490, 0, WORLD_W - 1490, WORLD_H);

    for (let x = 0; x < WORLD_W; x += 64) {
      for (let y = 0; y < WORLD_H; y += 64) {
        if ((x / 64 + y / 64) % 2 === 0) {
          g.fillStyle(0xffffff, 0.035);
          g.fillRect(x, y, 64, 64);
        }
      }
    }

    // Chapter road(s) connecting villages -> Boss Castle
    const drawRoad = (pts: readonly [number, number][], w: number, color: number, alpha: number) => {
      g.lineStyle(w, color, alpha);
      g.beginPath();
      pts.forEach(([rx, ry], idx) => {
        if (idx === 0) g.moveTo(rx, ry);
        else g.lineTo(rx, ry);
      });
      g.strokePath();
    };
    drawRoad(ch.roadPoints, 54, ch.roadOuter, 0.85);
    drawRoad(ch.roadPoints, 34, ch.roadInner, 0.65);
    if (ch.secondaryRoadPoints) {
      drawRoad(ch.secondaryRoadPoints, 46, ch.roadOuter, 0.72);
      drawRoad(ch.secondaryRoadPoints, 28, ch.roadInner, 0.55);
    }

    // Route Signposts (Chapter 2+ dual-branch paths)
    if (ch.routeSigns) {
      for (const sign of ch.routeSigns) {
        this.add
          .text(sign.x, sign.y, this.kit.t(sign.labelKey), {
            fontFamily: this.kit.theme.font,
            fontSize: '16px',
            fontStyle: 'bold',
            color: sign.color,
            stroke: '#09050f',
            strokeThickness: 4,
            backgroundColor: '#09050faa',
            padding: { x: 8, y: 4 },
          })
          .setOrigin(0.5)
          .setDepth(14);
      }
    }

    // Interactive Map POIs (Chapter 3+: Time Crystal, Power Shrine, Shortcut Portal)
    if (FEATURES.mapPois && ch.pois) {
      for (const p of ch.pois) {
        const color = p.kind === 'timeCrystal' ? 0x38bdf8 : p.kind === 'powerShrine' ? 0xfacc15 : 0xc084fc;
        const ring = this.add.circle(p.x, p.y, 32, color, 0.28).setStrokeStyle(3, color).setDepth(6);
        this.tweens.add({ targets: ring, scale: 1.15, alpha: 0.55, duration: 520, yoyo: true, repeat: -1 });
        const emoji = p.kind === 'timeCrystal' ? '⏱' : p.kind === 'powerShrine' ? '🔥' : '🌀';
        const icon = this.add
          .text(p.x, p.y, emoji, { fontSize: '28px' })
          .setOrigin(0.5)
          .setDepth(8);
        const label = this.add
          .text(p.x, p.y - 44, this.kit.t(`poi.${p.kind}`), {
            fontFamily: this.kit.theme.font,
            fontSize: '15px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#09050f',
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(15);
        this.pois.push({ def: p, used: false, ring, icon, label });
      }
    }

    // Impassable Canyon / Magma / Neon / Void Barriers (forces true route commitment!)
    if (ch.barriers) {
      for (const b of ch.barriers) {
        const rimColor =
          b.style === 'glacierCanyon' ? 0x7dd3fc : b.style === 'neonWall' ? 0x22d3ee : b.style === 'voidChasm' ? 0xfacc15 : 0xf97316;
        const wallColor =
          b.style === 'glacierCanyon' ? 0x0c4a6e : b.style === 'neonWall' ? 0x3b0764 : b.style === 'voidChasm' ? 0x312e81 : 0x7c2d12;
        const abyssColor =
          b.style === 'glacierCanyon' ? 0x041224 : b.style === 'neonWall' ? 0x090514 : b.style === 'voidChasm' ? 0x09050f : 0x2a0808;
        g.fillStyle(rimColor, 0.9);
        g.fillRoundedRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 18);
        g.fillStyle(wallColor, 1);
        g.fillRoundedRect(b.x, b.y, b.w, b.h, 14);
        g.fillStyle(abyssColor, 1);
        g.fillRoundedRect(b.x + 12, b.y + 18, b.w - 24, b.h - 36, 10);
        // Subtle depth stripes across the chasm
        g.fillStyle(rimColor, 0.14);
        for (let sx = b.x + 36; sx < b.x + b.w - 36; sx += 72) {
          g.fillRect(sx, b.y + 26, 28, b.h - 52);
        }
      }
    }

    // Solid Chapter Obstacles (trees, rocks, ice crystals, magma pillars)
    for (const ob of ch.obstacles) {
      this.add.ellipse(ob.x, ob.y + 16, 48, 16, 0x000000, 0.32).setDepth(3);
      this.add.image(ob.x, ob.y, `px-${ob.kind}`).setDepth(5);
    }

    for (const v of ch.villages) {
      this.add.ellipse(v.x, v.y + 26, 86, 24, 0x000000, 0.3).setDepth(4);
      this.add.image(v.x, v.y, 'px-village').setDepth(6);
      this.add
        .text(v.x, v.y - 44, this.kit.t(`village.${v.id}`), {
          fontFamily: this.kit.theme.font,
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#fef08a',
          stroke: '#120d1d',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(15);
    }

    // Boss Castle with chapter-colored challenge portal
    const portal = this.add.ellipse(CASTLE_POS.x, CASTLE_POS.y + 38, 148, 42, ch.arenaAccent, 0.4).setDepth(4);
    this.tweens.add({ targets: portal, alpha: 0.75, scaleX: 1.08, duration: 550, yoyo: true, repeat: -1 });
    this.add.image(CASTLE_POS.x, CASTLE_POS.y - 12, 'px-castle').setDepth(6);
    this.add
      .text(CASTLE_POS.x, CASTLE_POS.y - 84, `${this.kit.t(`boss.${ch.bossKind}`)} • ${this.kit.t('castleGate')}`, {
        fontFamily: this.kit.theme.font,
        fontSize: '19px',
        fontStyle: 'bold',
        color: '#fda4af',
        stroke: '#09050f',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(15);
  }

  private spawnHero(): void {
    const firstV = this.stage.chapter.villages[0];
    const startX = firstV.x + 100;
    const startY = firstV.y;
    const m = this.isMobile;
    this.heroShadow = this.add.ellipse(startX, startY + (m ? 28 : 22), m ? 54 : 42, m ? 18 : 14, 0x000000, 0.35).setDepth(9);
    this.heroSprite = this.add.image(startX, startY, this.heroFrames[0]).setScale(m ? 1.3 : 1).setDepth(12);
    this.heroHpBg = this.add.rectangle(startX, startY - (m ? 46 : 36), 50, m ? 9 : 7, 0x120d1d).setDepth(16);
    this.heroHpFill = this.add.rectangle(startX - 24, startY - (m ? 46 : 36), 48, m ? 7 : 5, 0x22c55e).setOrigin(0, 0.5).setDepth(17);
    this.heroReadyBang = this.add
      .text(startX, startY - (m ? 76 : 62), '!', {
        fontFamily: this.kit.theme.font,
        fontSize: m ? '42px' : '34px',
        fontStyle: 'bold',
        color: '#facc15',
        stroke: '#09050f',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);
  }

  private spawnEntities(): void {
    for (const s of this.stage.chapter.enemySpawns) {
      this.enemies.push(this.createEnemyEntity(s.id, s.x, s.y));
    }
  }

  private createEnemyEntity(id: OverworldMobId, x: number, y: number): EnemyEntity {
    const spec = makeEnemy(id, this.meta.loop);
    const m = this.isMobile;
    const sprite = this.add.image(x, y, mobTextureKey(this.stage.chapter.id, id, 0)).setScale(m ? 1.28 : 1).setDepth(10);

    const barW = m ? 56 : 44;
    const barY = y - (m ? 38 : 30);
    const hpBg = this.add.rectangle(x, barY, barW, m ? 8 : 6, 0x09050f).setDepth(15);
    const hpFill = this.add.rectangle(x - barW / 2 + 1, barY, barW - 2, m ? 6 : 4, 0xef4444).setOrigin(0, 0.5).setDepth(16);
    const label = this.add
      .text(x, barY - (m ? 15 : 11), `HP ${spec.hp}`, {
        fontFamily: this.kit.theme.font,
        fontSize: m ? '17px' : '12px',
        fontStyle: 'bold',
        color: '#e2e8f0',
        stroke: '#09050f',
        strokeThickness: m ? 4 : 3,
      })
      .setOrigin(0.5)
      .setDepth(16);

    return {
      spec,
      hp: spec.hp,
      maxHp: spec.hp,
      homeX: x,
      homeY: y,
      sprite,
      hpBg,
      hpFill,
      label,
      alive: true,
      respawnTimer: 0,
      wanderPhase: Math.random() * Math.PI * 2,
      bumpCooldown: 0,
    };
  }

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.heroSprite, true, 0.14, 0.14);
  }

  private buildHud(): void {
    const { width, height } = this.scale;
    const font = this.kit.theme.font;
    const m = this.isMobile;
    const barH = m ? 96 : 84;

    this.add.rectangle(width / 2, barH / 2, width, barH, 0x0e081f, 0.86).setScrollFactor(0).setDepth(100);
    this.add.rectangle(width / 2, barH, width, 3, 0xfacc15, 0.65).setScrollFactor(0).setDepth(100);

    this.lvText = this.add
      .text(24, m ? 14 : 16, '', { fontFamily: font, fontSize: m ? '31px' : '26px', fontStyle: 'bold', color: '#facc15', stroke: '#09050f', strokeThickness: 4 })
      .setScrollFactor(0)
      .setDepth(102);

    this.statText = this.add
      .text(m ? 156 : 145, m ? 21 : 22, '', { fontFamily: font, fontSize: m ? '21px' : '18px', fontStyle: 'bold', color: '#cbd5e1' })
      .setScrollFactor(0)
      .setDepth(102);

    this.add.rectangle(24, m ? 66 : 58, 220, m ? 24 : 18, 0x1e1b4b).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    this.hpBarFill = this.add.rectangle(26, m ? 66 : 58, 216, m ? 20 : 14, 0x22c55e).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);
    this.hpBarText = this.add
      .text(134, m ? 66 : 58, '', { fontFamily: font, fontSize: m ? '16px' : '13px', fontStyle: 'bold', color: '#ffffff', stroke: '#09050f', strokeThickness: 3 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(103);

    this.add.rectangle(256, m ? 66 : 58, 150, m ? 18 : 14, 0x1e1b4b).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    this.xpBarFill = this.add.rectangle(258, m ? 66 : 58, 0, m ? 14 : 10, 0xa78bfa).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);

    // Pause button cleanly placed between XP bar and center Timer
    const pauseBtn = addButton(this, 474, barH / 2, '⏸', {
      width: m ? 64 : 54,
      height: m ? 58 : 50,
      fill: 0x312e81,
      fontSize: m ? 28 : 24,
      onClick: () => {
        if (this.pausedByUser) this.closePauseMenu();
        else if (!this.activeVillage && !this.runEnded) this.openPauseMenu();
      },
    });
    pauseBtn.setScrollFactor(0).setDepth(102);

    this.timerBadge = this.add
      .rectangle(width / 2, barH / 2, m ? 220 : 196, m ? 72 : 64, 0x1e1b4b, 0.96)
      .setStrokeStyle(4, 0xfacc15)
      .setScrollFactor(0)
      .setDepth(101);
    this.timerText = this.add
      .text(width / 2, barH / 2, '30.0', {
        fontFamily: font,
        fontSize: m ? '48px' : '42px',
        fontStyle: 'bold',
        color: '#facc15',
        stroke: '#09050f',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102);

    this.pausedBanner = this.add
      .text(width / 2, barH + 14, '', {
        fontFamily: font,
        fontSize: m ? '21px' : '18px',
        fontStyle: 'bold',
        color: '#38bdf8',
        stroke: '#09050f',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102);

    this.add.image(width - 436, m ? 30 : 28, 'px-coin').setScale(m ? 0.85 : 0.7).setScrollFactor(0).setDepth(102);
    this.goldText = this.add
      .text(width - 414, m ? 30 : 28, '0 G', { fontFamily: font, fontSize: m ? '25px' : '21px', fontStyle: 'bold', color: '#facc15' })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(102);

    this.add
      .text(width - 24, m ? 30 : 28, `${this.kit.t(`chapter.${this.stage.chapter.id}`)} ${this.stage.roman}`, {
        fontFamily: font,
        fontSize: m ? '21px' : '18px',
        fontStyle: 'bold',
        color: '#c084fc',
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(102);

    this.bossArrowText = this.add
      .text(width - 24, m ? 68 : 60, '', { fontFamily: font, fontSize: m ? '21px' : '18px', fontStyle: 'bold', color: '#fda4af' })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(102);

    const dashW = m ? 188 : 144;
    const dashH = m ? 74 : 56;
    const dashX = m ? width - 116 : width - 96;
    const dashY = m ? height - 74 : height - 64;
    const dashBtn = addButton(this, dashX, dashY, this.kit.t('dash'), {
      width: dashW,
      height: dashH,
      fill: 0x0284c7,
      fontSize: m ? 28 : 22,
      onClick: () => {
        // Desktop click fallback; on touch/pointerdown we trigger immediately below for zero latency!
        if (!this.isMobile) this.tryDash();
      },
    });
    dashBtn.setScrollFactor(0).setDepth(102);
    // Fire Dash immediately on pointerdown (fixes multi-touch & scrolled-camera mobile taps!)
    dashBtn.on('pointerdown', () => {
      if (this.isMobile) this.tryDash();
    });
    this.add.rectangle(dashX, m ? height - 24 : height - 26, dashW - 8, m ? 10 : 8, 0x1e1b4b).setScrollFactor(0).setDepth(101);
    this.dashBarFill = this.add
      .rectangle(dashX - (dashW - 8) / 2, m ? height - 24 : height - 26, dashW - 8, m ? 8 : 6, 0x38bdf8)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(102);

    this.controlsHintText = this.add
      .text(24, height - 28, this.kit.t(m ? 'touchControlsHint' : 'controlsHint'), {
        fontFamily: font,
        fontSize: m ? '19px' : '15px',
        color: '#e2e8f0',
        stroke: '#09050f',
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setAlpha(0.9);
  }

  private syncMusicIntensity(): void {
    const isBoss = this.mode === 'boss';
    const track = isBoss ? 1 : 0;
    const mode = isBoss ? 'overdrive' : this.timeLeft <= 10 ? 'rush' : 'normal';
    const layers: 2 | 3 | 4 = isBoss || this.timeLeft <= 10 ? 4 : this.heroSprite && this.heroSprite.x >= 620 ? 3 : 2;
    const sig = `${track}:${mode}:${layers}`;
    if (sig === this.lastMusicState) return;
    this.lastMusicState = sig;
    this.kit.audio.music.setTrack(track);
    this.kit.audio.music.setMode(mode);
    this.kit.audio.music.setLayers(layers);
  }

  update(_time: number, delta: number): void {
    if (!this.ready || this.runEnded || this.fx.frozen) return;
    if (this.activeVillage || this.pausedByUser) return;
    const dt = Math.min(delta, 50) / 1000;

    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.endRun('timeUp');
      return;
    }

    this.dashTimeLeft = Math.max(0, this.dashTimeLeft - dt);
    this.dashCooldownLeft = Math.max(0, this.dashCooldownLeft - delta);
    this.invulnLeft = Math.max(0, this.invulnLeft - dt);
    this.villageReentryCooldown = Math.max(0, this.villageReentryCooldown - dt);
    this.castleReentryCooldown = Math.max(0, this.castleReentryCooldown - dt);

    if (this.mode === 'boss') {
      this.updateBossArena(dt);
    } else {
      this.updateOverworld(dt);
    }

    this.syncMusicIntensity();
    this.updateHud();
  }

  private updateOverworld(dt: number): void {
    const vec = this.inputCtrl.vector();
    let vx = vec.x;
    let vy = vec.y;
    if (Math.hypot(vx, vy) > 0.1) this.dashDir = { x: vx, y: vy };
    if (this.dashTimeLeft > 0) {
      vx = this.dashDir.x;
      vy = this.dashDir.y;
    }

    const prevX = this.heroSprite.x;
    const prevY = this.heroSprite.y;
    this.heroPrevX = prevX;
    this.heroPrevY = prevY;
    const speed = this.hero.moveSpeed * (this.dashTimeLeft > 0 ? 2.15 : 1);
    const rawX = Phaser.Math.Clamp(prevX + vx * speed * dt, 36, WORLD_W - 36);
    const rawY = Phaser.Math.Clamp(prevY + vy * speed * dt, 108, WORLD_H - 40);
    const resolved = resolveObstacleCollision(rawX, rawY, 18, this.stage.chapter.obstacles, this.stage.chapter.barriers ?? []);
    const nx = Phaser.Math.Clamp(resolved.x, 36, WORLD_W - 36);
    const ny = Phaser.Math.Clamp(resolved.y, 108, WORLD_H - 40);
    this.heroSprite.setPosition(nx, ny);
    this.heroShadow.setPosition(nx, ny + 22);
    this.heroHpBg.setPosition(nx, ny - 36);
    this.heroHpFill.setPosition(nx - 24, ny - 36);
    this.heroReadyBang.setPosition(nx, ny - 60 + Math.sin(this.time.now * 0.012) * 5);

    if (Math.abs(vx) > 0.05) this.heroSprite.setFlipX(vx < 0);
    if (Math.hypot(vx, vy) > 0.1) {
      this.animClock += dt * (this.dashTimeLeft > 0 ? 18 : 11);
      this.heroSprite.setTexture(this.heroFrames[Math.floor(this.animClock) % 2]);
      if (this.dashTimeLeft > 0 && Math.random() < 0.55) this.spawnDashAfterimage(this.heroSprite, false);
    } else {
      this.heroSprite.setTexture(this.heroFrames[0]);
    }
    this.heroSprite.setAlpha(this.invulnLeft > 0 ? (Math.floor(this.time.now / 60) % 2 === 0 ? 0.5 : 1) : 1);

    this.updateEnemies(dt);
    if (this.runEnded) return;

    if (this.villageReentryCooldown <= 0) {
      for (const v of this.stage.chapter.villages) {
        if (Phaser.Math.Distance.Between(this.heroSprite.x, this.heroSprite.y, v.x, v.y) < 56) {
          this.openVillage(v);
          return;
        }
      }
    }

    // Interactive Map POIs check
    for (const poi of this.pois) {
      if (poi.used) continue;
      if (Phaser.Math.Distance.Between(this.heroSprite.x, this.heroSprite.y, poi.def.x, poi.def.y) < 46) {
        this.triggerPoi(poi);
        if (this.mode === 'boss') return;
      }
    }

    // Touch Demon Castle -> Enter Side-Scrolling Horizontal Boss Arena!
    if (
      this.castleReentryCooldown <= 0 &&
      Phaser.Math.Distance.Between(this.heroSprite.x, this.heroSprite.y, CASTLE_POS.x, CASTLE_POS.y) < 78
    ) {
      this.enterBossArena();
    }
  }

  private triggerPoi(poi: PoiEntity): void {
    poi.used = true;
    poi.ring.setVisible(false);
    poi.icon.destroy();
    poi.label.setVisible(false);

    if (poi.def.kind === 'timeCrystal') {
      this.timeLeft += 4.0;
      this.kit.audio.sfx('newBest');
      this.fx.flash(0x38bdf8, 160);
      this.fx.burst(poi.def.x, poi.def.y, { color: 0x38bdf8, count: 24, speed: 340, lifespanMs: 500 });
      this.fx.popText(poi.def.x, poi.def.y - 36, this.kit.t('poi.timeGot'), { color: 0x38bdf8, size: 28 });
    } else if (poi.def.kind === 'powerShrine') {
      this.hero.shrineBossBonus += 0.25;
      this.kit.audio.sfx('medal');
      this.fx.flash(0xfacc15, 160);
      this.fx.burst(poi.def.x, poi.def.y, { color: 0xfacc15, count: 24, speed: 340, lifespanMs: 500 });
      this.fx.popText(poi.def.x, poi.def.y - 36, this.kit.t('poi.shrineGot'), { color: 0xfacc15, size: 26 });
    } else if (poi.def.kind === 'shortcutPortal') {
      this.kit.audio.sfx('rush');
      this.fx.flash(0xc084fc, 220);
      this.heroSprite.setPosition(CASTLE_POS.x - 115, CASTLE_POS.y);
      this.fx.popText(this.heroSprite.x, this.heroSprite.y - 54, this.kit.t('poi.warped'), { color: 0xc084fc, size: 26 });
    }
    this.updateHud();
  }

  private enterBossArena(): void {
    if (this.runEnded || this.mode === 'boss' || this.timeLeft <= 0) return;
    this.mode = 'boss';
    this.dashTimeLeft = 0;
    this.arenaHeroVx = 0;
    this.arenaHeroVy = 0;
    this.arenaKnockbackTimer = 0;
    this.arenaBossAttackTimer = 1.5;
    this.arenaBossCharging = 0;
    this.arenaBossHitCooldown = 0;
    this.arenaCombo = 0;
    this.fireballs = [];

    this.fx.flash(0xf43f5e, 240);
    this.fx.shake(0.35);
    this.kit.audio.sfx('rush');

    const { width, height } = this.scale;
    const font = this.kit.theme.font;
    const addA = <T extends Phaser.GameObjects.GameObject & { setScrollFactor?: (x: number) => T; setDepth?: (d: number) => T }>(
      o: T,
      depth: number,
    ): T => {
      if ('setScrollFactor' in o && typeof o.setScrollFactor === 'function') o.setScrollFactor(0);
      if ('setDepth' in o && typeof o.setDepth === 'function') o.setDepth(depth);
      this.bossArenaObjects.push(o);
      return o;
    };

    // Chapter-Themed Boss Throne Room Background + Episode I..V Boss Evolution
    const ch = this.stage.chapter;
    this.arenaBossEvo = getBossEvo(this.stage.episodeIndex);
    this.arenaBossVolleyCount = 0;
    const bossName = this.currentBossDisplayName();
    const bg = addA(this.add.graphics(), 40);
    bg.fillStyle(0x0b0614, 1);
    bg.fillRect(0, 0, width, height);
    bg.fillStyle(ch.arenaWall, 1);
    bg.fillRect(0, 84, width, ARENA_GROUND_Y - 84);
    bg.fillStyle(ch.arenaWindow, 0.55);
    bg.fillRoundedRect(ARENA_BOSS_X - 95, 160, 190, 320, { tl: 95, tr: 95, bl: 0, br: 0 });
    bg.lineStyle(6, ch.arenaAccent, 0.85);
    bg.strokeRoundedRect(ARENA_BOSS_X - 95, 160, 190, 320, { tl: 95, tr: 95, bl: 0, br: 0 });

    for (const px of [200, 480, 760, 1180]) {
      bg.fillStyle(0x000000, 0.25);
      bg.fillRect(px - 22, 84, 44, ARENA_GROUND_Y - 84);
      bg.fillStyle(ch.arenaAccent, 0.35);
      bg.fillRect(px - 26, ARENA_GROUND_Y - 22, 52, 22);
    }

    bg.fillStyle(ch.arenaFloor, 1);
    bg.fillRect(0, ARENA_GROUND_Y, width, height - ARENA_GROUND_Y);
    bg.fillStyle(ch.arenaAccent, 0.75);
    bg.fillRect(0, ARENA_GROUND_Y, width, 6);
    for (let x = 0; x < width; x += 64) {
      bg.fillStyle(0xffffff, 0.04);
      bg.fillRect(x, ARENA_GROUND_Y + 6, 32, 32);
      bg.fillRect(x + 32, ARENA_GROUND_Y + 38, 32, 32);
    }

    for (const tx of [200, 480, 760]) {
      const flame = addA(this.add.circle(tx, 260, 12, ch.arenaAccent, 0.9), 42);
      this.tweens.add({ targets: flame, scale: 1.35, alpha: 0.65, duration: 220, yoyo: true, repeat: -1 });
    }

    addA(this.add.rectangle(26, ARENA_GROUND_Y - 68, 48, 136, 0x09050f, 0.9).setStrokeStyle(3, 0x38bdf8), 43);
    addA(
      this.add
        .text(28, ARENA_GROUND_Y - 150, this.kit.t('retreat'), {
          fontFamily: font,
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#38bdf8',
          stroke: '#09050f',
          strokeThickness: 4,
        })
        .setOrigin(0, 0.5),
      44,
    );

    const barW = 540;
    addA(this.add.rectangle(width / 2, 118, barW + 8, 28, 0x09050f, 0.92).setStrokeStyle(3, ch.arenaAccent), 60);
    this.arenaBossHpFill = addA(
      this.add.rectangle(width / 2 - barW / 2, 118, barW * (this.bossHp / this.bossMaxHp), 20, ch.arenaAccent).setOrigin(0, 0.5),
      61,
    );
    this.arenaBossHpText = addA(
      this.add
        .text(width / 2, 118, `${bossName}  ${this.bossHp} / ${this.bossMaxHp}`, {
          fontFamily: font,
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#09050f',
          strokeThickness: 4,
        })
        .setOrigin(0.5),
      62,
    );

    this.arenaComboText = addA(
      this.add
        .text(width / 2, 158, '', {
          fontFamily: font,
          fontSize: '26px',
          fontStyle: 'bold',
          color: '#facc15',
          stroke: '#09050f',
          strokeThickness: 6,
        })
        .setOrigin(0.5),
      63,
    );

    // Boss attack telegraph lane & warning badge (hidden until boss charges)
    this.arenaTelegraphLine = addA(
      this.add.rectangle(ARENA_BOSS_X / 2, ARENA_GROUND_Y - 26, ARENA_BOSS_X - 40, 14, ch.arenaAccent, 0.32).setVisible(false),
      51,
    );
    this.arenaTelegraphWarn = addA(
      this.add
        .text(ARENA_BOSS_X - 110, ARENA_GROUND_Y - 62, this.kit.t('bossWarn'), {
          fontFamily: font,
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#fef08a',
          stroke: '#991b1b',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setVisible(false),
      64,
    );

    this.arenaHeroShadow = addA(this.add.ellipse(230, ARENA_GROUND_Y + 4, 64, 18, 0x000000, 0.45), 50);
    this.arenaHero = addA(this.add.image(230, ARENA_GROUND_Y - 34, this.heroFrames[0]).setScale(1.65), 55);

    addA(this.add.ellipse(ARENA_BOSS_X, ARENA_GROUND_Y + 6, 130, 26, 0x000000, 0.5), 50);
    this.arenaBoss = addA(this.add.image(ARENA_BOSS_X, ARENA_BOSS_Y, `px-${ch.bossKind}-0`).setScale(1.75).setFlipX(true), 54);
    this.arenaBossEvoRig?.destroy();
    this.arenaBossEvoRig = createBossEvoRig(this, this.arenaBoss, this.arenaBossEvo, {
      baseScale: 1.75,
      screenSpace: true,
      depthBehind: 53,
      depthFront: 56,
    });
    this.arenaBossEvoRig.syncPosition(this.arenaBoss.x, this.arenaBoss.y);

    // Dramatic entrance banner (+ Finale tag on Episode V!)
    const banner = addA(
      this.add
        .text(width / 2, height / 2 - 60, this.kit.t('bossEnter'), {
          fontFamily: font,
          fontSize: '46px',
          fontStyle: 'bold',
          color: '#facc15',
          stroke: '#09050f',
          strokeThickness: 7,
        })
        .setOrigin(0.5),
      80,
    );
    this.tweens.add({ targets: banner, y: banner.y - 30, alpha: 0, duration: 950, ease: 'Cubic.easeOut', onComplete: () => banner.destroy() });
    if (this.stage.isFinale) {
      const finBanner = addA(
        this.add
          .text(width / 2, height / 2 - 12, this.kit.t('finaleTag'), {
            fontFamily: font,
            fontSize: '26px',
            fontStyle: 'bold',
            color: '#fda4af',
            stroke: '#09050f',
            strokeThickness: 5,
          })
          .setOrigin(0.5),
        80,
      );
      this.tweens.add({ targets: finBanner, y: finBanner.y - 24, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => finBanner.destroy() });
    }

    this.controlsHintText.setText(this.kit.t(this.isMobile ? 'touchControlsHint' : 'bossControls'));
    this.syncMusicIntensity();
  }

  private currentBossDisplayName(): string {
    const base = this.kit.t(`boss.${this.stage.chapter.bossKind}`);
    const evo = this.arenaBossEvo ?? getBossEvo(this.stage.episodeIndex);
    const evoLabel = evo.titleKey ? this.kit.t(evo.titleKey) : '';
    return formatBossName(base, evo, evoLabel, this.stage.roman);
  }

  private exitBossArena(): void {
    this.arenaBossEvoRig?.destroy();
    this.arenaBossEvoRig = null;
    for (const fb of this.fireballs) {
      fb.obj.destroy();
      fb.glow.destroy();
    }
    this.fireballs = [];
    for (const o of this.bossArenaObjects) {
      if (o && o.active) o.destroy();
    }
    this.bossArenaObjects = [];
    this.mode = 'overworld';
    this.castleReentryCooldown = 1.6;
    this.heroSprite.setPosition(CASTLE_POS.x - 120, CASTLE_POS.y);
    this.controlsHintText.setText(this.kit.t(this.isMobile ? 'touchControlsHint' : 'controlsHint'));
    this.kit.audio.sfx('click');
    this.syncMusicIntensity();
  }

  private tryArenaJump(): void {
    if (this.mode !== 'boss' || !this.arenaHero) return;
    const grounded = this.arenaHero.y >= ARENA_GROUND_Y - 36;
    if (grounded && this.arenaKnockbackTimer <= 0) {
      this.arenaHeroVy = -570;
      this.kit.audio.sfx('click');
    }
  }

  private updateBossArena(dt: number): void {
    const vec = this.inputCtrl.vector();
    this.arenaKnockbackTimer = Math.max(0, this.arenaKnockbackTimer - dt);
    this.arenaBossHitCooldown = Math.max(0, this.arenaBossHitCooldown - dt);

    // Touch/joystick upward jump support
    if (vec.y < -0.65) this.tryArenaJump();

    // Horizontal movement or Dash-Slash!
    if (this.arenaKnockbackTimer > 0) {
      this.arenaHero.x += this.arenaHeroVx * dt;
      this.arenaHeroVx *= Math.pow(0.08, dt);
    } else if (this.dashTimeLeft > 0) {
      const dashSpeed = this.hero.moveSpeed * 2.65;
      this.arenaHero.x += dashSpeed * dt; // Horizontal dash-slash always drives aggressively right toward the Demon Lord!
      this.arenaHero.setFlipX(false);
      if (Math.random() < 0.75) this.spawnDashAfterimage(this.arenaHero, true);
    } else {
      const moveVx = vec.x * this.hero.moveSpeed * 1.15;
      this.arenaHero.x += moveVx * dt;
      if (Math.abs(vec.x) > 0.08) this.arenaHero.setFlipX(vec.x < 0);
    }

    // Gravity & Floor clamping
    this.arenaHeroVy += 1550 * dt;
    this.arenaHero.y += this.arenaHeroVy * dt;
    if (this.arenaHero.y >= ARENA_GROUND_Y - 34) {
      this.arenaHero.y = ARENA_GROUND_Y - 34;
      this.arenaHeroVy = 0;
    }

    this.arenaHero.x = Phaser.Math.Clamp(this.arenaHero.x, 42, ARENA_BOSS_X - 30);
    this.arenaHeroShadow.setPosition(this.arenaHero.x, ARENA_GROUND_Y + 4);

    // Hero animation
    if (this.dashTimeLeft > 0 || Math.abs(vec.x) > 0.1) {
      this.animClock += dt * (this.dashTimeLeft > 0 ? 20 : 12);
      this.arenaHero.setTexture(this.heroFrames[Math.floor(this.animClock) % 2]);
    } else {
      this.arenaHero.setTexture(this.heroFrames[0]);
    }
    this.arenaHero.setAlpha(this.invulnLeft > 0 ? (Math.floor(this.time.now / 60) % 2 === 0 ? 0.5 : 1) : 1);

    // Retreat check on far-left door
    if (this.arenaHero.x <= 56 && vec.x < -0.2) {
      this.exitBossArena();
      return;
    }

    // Boss hovering animation & fireball telegraph/launch
    const bKind = this.stage.chapter.bossKind;
    this.arenaBossAnimClock += dt * 3.2;
    this.arenaBoss.setTexture(`px-${bKind}-${Math.floor(this.arenaBossAnimClock) % 2}`);
    this.arenaBoss.y = ARENA_BOSS_Y + Math.sin(this.arenaBossAnimClock * 1.4) * 12;
    this.arenaBossEvoRig?.syncPosition(this.arenaBoss.x, this.arenaBoss.y);

    if (this.arenaBossCharging > 0) {
      this.arenaBossCharging -= dt;
      const blink = Math.floor(this.time.now / 65) % 2 === 0;
      this.arenaBoss.setTint(blink ? this.stage.chapter.arenaAccent : (this.arenaBossEvo?.tint ?? 0xffffff));
      const warnY = ARENA_GROUND_Y - 26 - this.arenaPendingOffsetY;
      this.arenaTelegraphLine?.setPosition(ARENA_BOSS_X / 2, warnY).setVisible(true).setAlpha(blink ? 0.45 : 0.16);
      this.arenaTelegraphWarn?.setPosition(ARENA_BOSS_X - 115, warnY - 34).setVisible(true).setAlpha(blink ? 1 : 0.55);
      if (this.arenaBossCharging <= 0) {
        if (this.arenaBossEvo?.tint != null) this.arenaBoss.setTint(this.arenaBossEvo.tint);
        else this.arenaBoss.clearTint();
        this.arenaTelegraphLine?.setVisible(false);
        this.arenaTelegraphWarn?.setVisible(false);
        this.spawnBossFireball();
      }
    } else {
      this.arenaBossAttackTimer -= dt;
      if (this.arenaBossAttackTimer <= 0) {
        const slowed = this.hero.weaponPassive === 'frostSlow';
        const evoTier = this.arenaBossEvo?.tier ?? 1;
        const loopTempo = Math.min(0.65, Math.max(0, this.meta.loop - 1) * 0.015 + (evoTier >= 4 ? 0.08 : 0));
        const baseCharge = Math.max(0.45, 0.65 - loopTempo * 0.25);
        const baseAtkCd = Math.max(1.2, 2.05 - loopTempo);
        this.arenaBossCharging = slowed ? baseCharge * 1.3 : baseCharge;
        this.arenaBossAttackTimer = slowed ? baseAtkCd * 1.3 : baseAtkCd;
        if (
          this.stage.chapter.bossPattern === 'iceDual' ||
          this.stage.chapter.bossPattern === 'seraphBarrage' ||
          evoTier >= 3
        ) {
          this.bossPatternFlip = !this.bossPatternFlip;
          this.arenaPendingOffsetY = this.bossPatternFlip ? 0 : 88;
        } else {
          this.arenaPendingOffsetY = 0;
        }
        this.kit.audio.sfx('click');
      }
    }

    // Update Boss fireballs
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      fb.x += fb.vx * dt;
      fb.obj.setPosition(fb.x, fb.y);
      fb.glow.setPosition(fb.x, fb.y);

      if (
        this.invulnLeft <= 0 &&
        this.dashTimeLeft <= 0 &&
        Phaser.Math.Distance.Between(this.arenaHero.x, this.arenaHero.y, fb.x, fb.y) < 38
      ) {
        // Aegis King armor barrier: absorbs 1 fireball completely without breaking Combo!
        if (this.hero.bossBarrierHits > 0) {
          this.hero.bossBarrierHits -= 1;
          this.invulnLeft = 0.45;
          this.kit.audio.sfx('medal');
          this.popArenaText(this.arenaHero.x, this.arenaHero.y - 46, '🛡 BARRIER!', '#facc15', 26);
          fb.obj.destroy();
          fb.glow.destroy();
          this.fireballs.splice(i, 1);
          continue;
        }
        // Evasion check: dodging a Boss fireball keeps Boss Combo alive!
        if (Math.random() < this.hero.evaChance) {
          this.invulnLeft = 0.35;
          this.kit.audio.sfx('nearMiss');
          this.popArenaText(this.arenaHero.x, this.arenaHero.y - 46, this.kit.t('missTag'), '#2dd4bf', 26);
          if (this.hero.armorPassive === 'phantom') {
            this.arenaCombo += 1;
            const heroic = this.hero.weaponPassive === 'heroic';
            const nextMult = bossComboMultiplier(this.arenaCombo, heroic);
            const maxCap = heroic ? 2.5 : 2.0;
            this.arenaComboText
              ?.setColor(nextMult >= maxCap ? '#f43f5e' : '#38bdf8')
              .setText(`🔥 ${this.arenaCombo} COMBO  •  NEXT ${nextMult.toFixed(1)}x DMG${nextMult >= maxCap ? ' MAX!' : ''}`);
          }
          if (this.hero.shieldPassive === 'reflect' && this.bossHp > 0) {
            const refDmg = Math.min(this.bossHp, Math.max(5, Math.round(totalAtk(this.hero) * 0.8)));
            this.bossHp = Math.max(0, this.bossHp - refDmg);
            this.popArenaText(ARENA_BOSS_X - 24, ARENA_BOSS_Y - 56, `🪞 -${refDmg}`, '#c084fc', 26);
            this.arenaBossHpFill.width = Math.max(0, 540 * (this.bossHp / this.bossMaxHp));
            this.arenaBossHpText.setText(`${this.kit.t(`boss.${this.stage.chapter.bossKind}`)}  ${this.bossHp} / ${this.bossMaxHp}`);
            if (this.bossHp <= 0) {
              fb.obj.destroy();
              fb.glow.destroy();
              this.fireballs.splice(i, 1);
              this.kills += 1;
              this.playBossVictoryCelebration();
              return;
            }
          }
          fb.obj.destroy();
          fb.glow.destroy();
          this.fireballs.splice(i, 1);
          continue;
        }
        const dmg = bossFireballDamage(this.hero, this.bossSpec);
        this.hero.hp = Math.max(0, this.hero.hp - dmg);
        const hadCombo = this.arenaCombo > 0;
        this.arenaCombo = 0;
        this.arenaComboText?.setText('');
        this.invulnLeft = 0.5;
        this.arenaHeroVx = -380;
        this.arenaHeroVy = -165;
        this.arenaKnockbackTimer = 0.24;
        this.fx.flash(0xf43f5e, 140);
        this.fx.shake(0.32);
        this.kit.audio.sfx('shieldBreak');
        this.popArenaText(this.arenaHero.x, this.arenaHero.y - 42, `-${dmg}`, '#f43f5e', 26);
        if (hadCombo) {
          this.popArenaText(this.arenaHero.x, this.arenaHero.y - 78, this.kit.t('comboBreak'), '#fda4af', 24);
        }
        fb.obj.destroy();
        fb.glow.destroy();
        this.fireballs.splice(i, 1);
        if (this.hero.hp <= 0) {
          this.kit.audio.sfx('death');
          this.endRun('defeated');
          return;
        }
        continue;
      }

      if (fb.x < -40) {
        fb.obj.destroy();
        fb.glow.destroy();
        this.fireballs.splice(i, 1);
      }
    }

    // Hero Horizontal Dash-Attack collision with Demon Lord!
    if (
      this.arenaBossHitCooldown <= 0 &&
      Math.abs(this.arenaHero.x - this.arenaBoss.x) < 92 &&
      Math.abs(this.arenaHero.y - this.arenaBoss.y) < 96
    ) {
      this.handleArenaBossCollision();
    }
  }

  private spawnBossFireball(): void {
    const pattern = this.stage.chapter.bossPattern;
    const evoTier = this.arenaBossEvo?.tier ?? 1;
    this.arenaBossVolleyCount += 1;
    const loopSpeedMult = 1 + Math.min(0.4, Math.max(0, this.meta.loop - 1) * 0.009) + (evoTier >= 4 ? 0.08 : 0);
    const frostMult = this.hero.weaponPassive === 'frostSlow' ? 0.7 : 1;
    const speedScale = loopSpeedMult * frostMult;
    const launchOrb = (offsetY: number, speed: number, coreColor: number, rimColor: number) => {
      const startX = ARENA_BOSS_X - 74;
      const startY = ARENA_GROUND_Y - 26 - offsetY;
      const glow = this.add.circle(startX, startY, 24, rimColor, 0.35).setScrollFactor(0).setDepth(52);
      const obj = this.add.circle(startX, startY, 14, coreColor, 1).setStrokeStyle(4, rimColor).setScrollFactor(0).setDepth(53);
      this.fireballs.push({ obj, glow, x: startX, y: startY, vx: -Math.round(speed * speedScale) });
    };

    if (pattern === 'iceDual') {
      launchOrb(this.arenaPendingOffsetY, 500, 0xe0f2fe, 0x38bdf8);
      if (evoTier >= 2 && this.arenaBossVolleyCount % 2 === 0) {
        this.time.delayedCall(260, () => {
          if (this.mode === 'boss' && !this.runEnded) launchOrb(this.arenaPendingOffsetY, 520, 0xffffff, 0x38bdf8);
        });
      }
    } else if (pattern === 'magmaVolley') {
      launchOrb(this.arenaPendingOffsetY, 520, 0xfef08a, 0xf97316);
      this.time.delayedCall(260, () => {
        if (this.mode === 'boss' && !this.runEnded) launchOrb(this.arenaPendingOffsetY === 0 ? 20 : 88, 540, 0xfef08a, 0xdc2626);
      });
    } else if (pattern === 'cyberLaser') {
      // Chapter 4 Cyber Mech: ultra-fast cyan plasma pulse!
      launchOrb(this.arenaPendingOffsetY, 620, 0xffffff, 0x22d3ee);
      this.time.delayedCall(200, () => {
        if (this.mode === 'boss' && !this.runEnded) launchOrb(this.arenaPendingOffsetY, 640, 0xf0abfc, 0xa21caf);
      });
    } else if (pattern === 'seraphBarrage') {
      // Chapter 5 Void Seraph: high-low celestial light barrage!
      launchOrb(this.arenaPendingOffsetY, 560, 0xfef08a, 0xfacc15);
      this.time.delayedCall(280, () => {
        if (this.mode === 'boss' && !this.runEnded) launchOrb(this.arenaPendingOffsetY === 0 ? 88 : 0, 560, 0xe9d5ff, 0x7c3aed);
      });
    } else {
      // Chapter 1 Demon Lord: Episode II+ fires staggered double-shot on even volleys, Episode V fires finale combo!
      launchOrb(this.arenaPendingOffsetY, 470, 0xfacc15, 0xef4444);
      if (evoTier >= 2 && (evoTier >= 5 || this.arenaBossVolleyCount % 2 === 0)) {
        const secondOffset = evoTier >= 5 ? (this.arenaPendingOffsetY === 0 ? 88 : 0) : this.arenaPendingOffsetY;
        this.time.delayedCall(260, () => {
          if (this.mode === 'boss' && !this.runEnded) launchOrb(secondOffset, 500, 0xfef08a, 0xf97316);
        });
      }
    }
    this.kit.audio.sfx('rush');
  }

  private handleArenaBossCollision(): void {
    const isDashing = this.dashTimeLeft > 0;
    const heroic = this.hero.weaponPassive === 'heroic';
    const maxCap = heroic ? 2.5 : 2.0;
    const hitMult = bossComboMultiplier(this.arenaCombo, heroic);
    const res = resolveBossDashHit(this.hero, this.bossHp, this.bossSpec, isDashing, this.arenaCombo);
    this.bossHp = res.remainingBossHp;
    this.arenaCombo += 1;
    const nextMult = bossComboMultiplier(this.arenaCombo, heroic);
    if (this.arenaComboText) {
      const color = nextMult >= maxCap ? '#f43f5e' : nextMult >= 1.6 ? '#fb923c' : '#facc15';
      const maxTag = nextMult >= maxCap ? ' MAX!' : '';
      this.arenaComboText
        .setColor(color)
        .setText(`🔥 ${this.arenaCombo} COMBO  •  NEXT ${nextMult.toFixed(1)}x DMG${maxTag}`)
        .setScale(1.32);
      this.tweens.add({ targets: this.arenaComboText, scale: 1, duration: 220, ease: 'Back.easeOut' });
    }
    if (this.invulnLeft <= 0) {
      this.hero.hp = Math.max(0, this.hero.hp - res.dmgToHero);
    }
    if (res.lifestealHealed > 0 && this.hero.hp > 0) {
      this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + res.lifestealHealed);
      this.popArenaText(this.arenaHero.x, this.arenaHero.y - 70, `+${res.lifestealHealed} HP`, '#34d399', 20);
    }
    if (res.evaded) {
      this.popArenaText(this.arenaHero.x, this.arenaHero.y - 46, this.kit.t('missTag'), '#2dd4bf', 24);
    }

    this.arenaBossHitCooldown = 0.32;
    this.dashTimeLeft = 0;

    // Dramatic knockback arc back to the left so player can dash right back in!
    this.arenaHeroVx = -540;
    this.arenaHeroVy = -260;
    this.arenaKnockbackTimer = 0.28;

    // Boss flash + recoil + sparks
    this.arenaBoss.setTintFill(0xffffff);
    this.time.delayedCall(90, () => {
      if (this.arenaBoss?.active) {
        if (this.arenaBossEvo?.tint != null) this.arenaBoss.setTint(this.arenaBossEvo.tint);
        else this.arenaBoss.clearTint();
      }
    });
    this.tweens.add({ targets: this.arenaBoss, x: ARENA_BOSS_X + 26, duration: 75, yoyo: true });

    this.fx.shake(isDashing ? 0.55 : 0.35);
    void this.fx.hitStop(isDashing ? 75 : 45);
    const multTag = hitMult > 1.01 ? ` (${hitMult.toFixed(1)}x!)` : '';
    this.popArenaText(
      ARENA_BOSS_X - 24,
      ARENA_BOSS_Y - 56,
      isDashing ? `${this.kit.t('critTag')} -${res.dmgToBoss}${multTag}` : `-${res.dmgToBoss}${multTag}`,
      isDashing ? '#facc15' : '#fef08a',
      isDashing ? 34 : 26,
    );
    if (res.dmgToHero > 0 && this.invulnLeft <= 0) {
      this.popArenaText(this.arenaHero.x, this.arenaHero.y - 46, `-${res.dmgToHero}`, '#f43f5e', 24);
    }

    // Update Boss HP bar immediately
    this.arenaBossHpFill.width = Math.max(0, 540 * (this.bossHp / this.bossMaxHp));
    this.arenaBossHpText.setText(`${this.currentBossDisplayName()}  ${this.bossHp} / ${this.bossMaxHp}`);

    if (res.bossDefeated) {
      this.kills += 1;
      this.playBossVictoryCelebration();
      return;
    }

    if (!res.heroSurvived && this.invulnLeft <= 0) {
      this.kit.audio.sfx('death');
      this.endRun('defeated');
      return;
    }

    this.kit.audio.sfx(isDashing ? 'medal' : 'shieldBreak');
  }

  private popArenaText(x: number, y: number, text: string, color: string, size: number): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: this.kit.theme.font,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#09050f',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(85);
    this.tweens.add({ targets: t, y: y - 55, alpha: 0, duration: 680, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private tryDash(): void {
    if (this.activeVillage || this.dashCooldownLeft > 0 || this.runEnded) return;
    this.dashTimeLeft = this.mode === 'boss' ? 0.26 : 0.22;
    this.dashCooldownLeft = this.hero.dashCooldownMs;
    this.kit.audio.sfx('rush');
    if (this.mode === 'overworld') {
      this.fx.burst(this.heroSprite.x, this.heroSprite.y, { color: 0x38bdf8, count: 10, speed: 220, lifespanMs: 260 });
    }
  }

  private spawnDashAfterimage(target: Phaser.GameObjects.Image, screenSpace: boolean): void {
    const ghost = this.add
      .image(target.x, target.y, target.texture.key)
      .setScale(target.scaleX, target.scaleY)
      .setFlipX(target.flipX)
      .setTint(0xfacc15)
      .setAlpha(0.55)
      .setDepth(screenSpace ? 54 : 11);
    if (screenSpace) ghost.setScrollFactor(0);
    this.tweens.add({ targets: ghost, alpha: 0, scaleX: target.scaleX * 0.9, duration: 200, onComplete: () => ghost.destroy() });
  }

  /** Shortest distance from point (px, py) to segment (ax, ay) -> (bx, by) to prevent high-speed tunneling. */
  private static distPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const abx = bx - ax;
    const aby = by - ay;
    const lenSq = abx * abx + aby * aby;
    if (lenSq <= 0.0001) return Math.hypot(px - ax, py - ay);
    const t = Phaser.Math.Clamp(((px - ax) * abx + (py - ay) * aby) / lenSq, 0, 1);
    return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
  }

  private updateEnemies(dt: number): void {
    const hitRadius = this.dashTimeLeft > 0 ? 54 : 48;
    const ax = this.heroPrevX || this.heroSprite.x;
    const ay = this.heroPrevY || this.heroSprite.y;
    const bx = this.heroSprite.x;
    const by = this.heroSprite.y;

    for (const e of this.enemies) {
      e.bumpCooldown = Math.max(0, e.bumpCooldown - dt);
      if (!e.alive) {
        e.respawnTimer -= dt;
        if (e.respawnTimer <= 0) {
          e.alive = true;
          e.hp = e.maxHp;
          e.sprite.setPosition(e.homeX, e.homeY).setVisible(true);
          e.hpBg.setVisible(true);
          e.hpFill.setVisible(true);
          e.label.setVisible(true);
          this.syncEnemyVisuals(e);
        }
        continue;
      }

      e.wanderPhase += dt * 3.2;
      const bobX = Math.sin(e.wanderPhase) * 24;
      const bobY = Math.cos(e.wanderPhase * 1.4) * 14;
      e.sprite.setPosition(e.homeX + bobX, e.homeY + bobY);

      const frame = Math.floor(e.wanderPhase * 1.5) % 2;
      e.sprite.setTexture(mobTextureKey(this.stage.chapter.id, e.spec.id as OverworldMobId, frame));
      this.syncEnemyVisuals(e);

      if (e.bumpCooldown <= 0 && PlayScene.distPointToSegment(e.sprite.x, e.sprite.y, ax, ay, bx, by) < hitRadius) {
        this.handleBump(e);
        if (this.runEnded) return;
      }
    }
  }

  private syncEnemyVisuals(e: EnemyEntity): void {
    const barW = this.isMobile ? 56 : 44;
    const barY = e.sprite.y - (this.isMobile ? 38 : 30);
    e.hpBg.setPosition(e.sprite.x, barY);
    e.hpFill.setPosition(e.sprite.x - barW / 2 + 1, barY);
    e.hpFill.width = Math.max(0, (barW - 2) * (e.hp / e.maxHp));
    e.label.setPosition(e.sprite.x, barY - (this.isMobile ? 15 : 11));
    e.label.setText(`HP ${e.hp}`);
  }

  private handleBump(e: EnemyEntity): void {
    const isDashing = this.dashTimeLeft > 0;
    const res = resolveBumpClash(this.hero, e.hp, e.spec, Math.random, isDashing);
    e.hp = res.remainingEnemyHp;
    if (this.invulnLeft <= 0) {
      this.hero.hp = Math.max(0, this.hero.hp - res.heroDamageTaken);
    }
    if (res.lifestealHealed > 0 && this.hero.hp > 0) {
      this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + res.lifestealHealed);
      this.fx.popText(this.heroSprite.x, this.heroSprite.y - 48, `+${res.lifestealHealed}`, { color: 0x34d399, size: 18 });
    }
    if (res.evaded) {
      this.fx.popText(this.heroSprite.x, this.heroSprite.y - 36, this.kit.t('missTag'), { color: 0x2dd4bf, size: 20 });
    }

    const midX = (this.heroSprite.x + e.sprite.x) / 2;
    const midY = (this.heroSprite.y + e.sprite.y) / 2;

    this.fx.burst(midX, midY, { color: res.critTriggered || isDashing || res.oneShot ? 0xfacc15 : 0xf43f5e, count: isDashing ? 18 : 14, speed: 320, lifespanMs: 360 });
    const dmgLabel = res.critTriggered
      ? `${this.kit.t('critTag')} -${res.enemyDamageDealt}!`
      : isDashing
        ? `⚡ -${res.enemyDamageDealt}!`
        : `-${res.enemyDamageDealt}`;
    this.fx.popText(e.sprite.x, e.sprite.y - 24, dmgLabel, {
      color: res.critTriggered || isDashing ? 0xfacc15 : 0xfef08a,
      size: res.critTriggered || isDashing ? 28 : 24,
    });
    if (res.heroDamageTaken > 0 && this.invulnLeft <= 0) {
      this.fx.popText(this.heroSprite.x, this.heroSprite.y - 28, `-${res.heroDamageTaken}`, { color: 0xf43f5e, size: 22 });
    }

    // Thunder Axe passive: Chain Lightning zaps up to 2 nearby mobs!
    if (this.hero.weaponPassive === 'chainLightning') {
      const zapDmg = Math.max(4, Math.round(totalAtk(this.hero) * 0.5));
      let zapped = 0;
      for (const other of this.enemies) {
        if (other === e || !other.alive || zapped >= 2) continue;
        if (Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, other.sprite.x, other.sprite.y) <= 170) {
          zapped += 1;
          const bolt = this.add.graphics().setDepth(30);
          bolt.lineStyle(4, 0xfde047, 0.95);
          bolt.lineBetween(e.sprite.x, e.sprite.y, other.sprite.x, other.sprite.y);
          this.tweens.add({ targets: bolt, alpha: 0, duration: 180, onComplete: () => bolt.destroy() });
          other.hp = Math.max(0, other.hp - zapDmg);
          this.fx.popText(other.sprite.x, other.sprite.y - 24, `⚡-${zapDmg}`, { color: 0xfde047, size: 20 });
          if (other.hp <= 0) {
            other.alive = false;
            other.respawnTimer = 5.5;
            other.sprite.setVisible(false);
            other.hpBg.setVisible(false);
            other.hpFill.setVisible(false);
            other.label.setVisible(false);
            this.kills += 1;
            grantRewards(this.hero, other.spec.xp, other.spec.gold);
          } else {
            this.syncEnemyVisuals(other);
          }
        }
      }
    }

    if (!res.oneShot) {
      const angle = Phaser.Math.Angle.Between(e.sprite.x, e.sprite.y, this.heroSprite.x, this.heroSprite.y);
      // Mutual knockback: both Hero and surviving Monster recoil cleanly apart!
      this.heroSprite.setPosition(
        Phaser.Math.Clamp(this.heroSprite.x + Math.cos(angle) * 22, 36, WORLD_W - 36),
        Phaser.Math.Clamp(this.heroSprite.y + Math.sin(angle) * 22, 108, WORLD_H - 40),
      );
      e.homeX = Phaser.Math.Clamp(e.homeX - Math.cos(angle) * 24, 60, WORLD_W - 60);
      e.homeY = Phaser.Math.Clamp(e.homeY - Math.sin(angle) * 24, 120, WORLD_H - 60);
      e.sprite.setPosition(e.homeX, e.homeY);
      e.sprite.setTintFill(0xffffff);
      this.time.delayedCall(80, () => {
        if (e.sprite.active) e.sprite.clearTint();
      });
      this.syncEnemyVisuals(e);
      e.bumpCooldown = 0.22;
      this.fx.shake(0.22);
      void this.fx.hitStop(35);
    } else {
      this.fx.shake(0.12);
    }

    if (!res.heroSurvived && this.invulnLeft <= 0) {
      this.kit.audio.sfx('death');
      this.endRun('defeated');
      return;
    }

    if (res.enemyDefeated) {
      e.alive = false;
      e.respawnTimer = 5.5;
      e.sprite.setVisible(false);
      e.hpBg.setVisible(false);
      e.hpFill.setVisible(false);
      e.label.setVisible(false);
      this.kills += 1;

      this.kit.audio.sfx('pickup');
      const { levelsGained, xpGained, goldGained } = grantRewards(this.hero, e.spec.xp, e.spec.gold);
      this.fx.popText(e.sprite.x, e.sprite.y + 8, `+${xpGained}XP +${goldGained}G`, { color: 0x86efac, size: 18 });

      if (levelsGained > 0) {
        this.kit.audio.sfx('medal');
        this.fx.flash(0xfacc15, 130);
        this.fx.burst(this.heroSprite.x, this.heroSprite.y, { color: 0xfacc15, count: 22, speed: 340, lifespanMs: 500 });
        this.fx.popText(this.heroSprite.x, this.heroSprite.y - 54, `${this.kit.t('levelUp')} LV ${this.hero.level}`, {
          color: 0xfacc15,
          size: 28,
        });
      }
    } else {
      this.kit.audio.sfx('shieldBreak');
      this.syncEnemyVisuals(e);
    }
  }

  private openVillage(v: VillagePlacement): void {
    this.activeVillage = v;
    this.villageOpenedAt = this.time.now;
    this.kit.audio.sfx('click');
    this.renderVillageOverlay();
    this.updateHud();
  }

  private renderVillageOverlay(): void {
    for (const o of this.villageOverlay) o.destroy();
    this.villageOverlay = [];
    const v = this.activeVillage;
    if (!v) return;

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2 + 28;
    const font = this.kit.theme.font;

    const addObj = <T extends Phaser.GameObjects.GameObject & { setScrollFactor?: (x: number) => T; setDepth?: (d: number) => T }>(o: T): T => {
      if ('setScrollFactor' in o && typeof o.setScrollFactor === 'function') o.setScrollFactor(0);
      if ('setDepth' in o && typeof o.setDepth === 'function') o.setDepth(200);
      this.villageOverlay.push(o);
      return o;
    };

    // Dimmed full-screen backdrop: tap/click outside the Village box to close,
    // with a 350ms grace buffer + fresh pointerdown check so lifting the virtual joystick thumb never closes it!
    const backdrop = this.add
      .rectangle(width / 2, height / 2, width, height, 0x09050f, 0.5)
      .setScrollFactor(0)
      .setDepth(198)
      .setInteractive({ useHandCursor: false });
    let backdropDownArmed = false;
    backdrop.on('pointerdown', () => {
      if (this.time.now - this.villageOpenedAt >= 350) {
        backdropDownArmed = true;
      }
    });
    backdrop.on('pointerup', () => {
      if (backdropDownArmed && this.time.now - this.villageOpenedAt >= 350) {
        this.closeVillage();
      }
      backdropDownArmed = false;
    });
    this.villageOverlay.push(backdrop);

    // Village panel absorbs taps inside the box so they never trigger backdrop close
    const panelBox = addObj(this.add.rectangle(cx, cy, 640, 424, 0x13092b, 0.95).setStrokeStyle(4, 0xfacc15));
    panelBox.setInteractive();
    addObj(
      this.add
        .text(cx, cy - 178, `${this.kit.t(`village.${v.id}`)}  •  ${this.kit.t('villageTitle')}`, {
          fontFamily: font,
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#fef08a',
        })
        .setOrigin(0.5),
    );

    const wSpec = getWeaponSpec(this.hero.weaponId);
    const wCost = weaponPolishCost(this.hero.weaponPolishLv, this.meta.loop);
    const wName = this.kit.t(`weapon.${this.hero.weaponId}`);
    const wLabel =
      wCost !== null
        ? `[1] ${this.kit.t('sharpenWeapon')}: ${wName} (${this.hero.weaponPolishLv}/${MAX_POLISH_LV}) +${wSpec.polishAtkPerLv} ATK • ${wCost}G`
        : `[1] ${wName}: ${this.kit.t('maxed')} ★`;

    const wBtn = addButton(this, cx, cy - 114, wLabel, {
      width: 580,
      height: 52,
      fill: wCost !== null && this.hero.gold >= wCost ? 0xd97706 : 0x334155,
      fontSize: 19,
      onClick: () => this.handlePolishWeapon(),
    });
    wBtn.setScrollFactor(0).setDepth(205);
    this.villageOverlay.push(wBtn);

    const aSpec = getArmorSpec(this.hero.armorId);
    const aCost = armorPolishCost(this.hero.armorPolishLv, this.meta.loop);
    const aName = this.kit.t(`armor.${this.hero.armorId}`);
    const aLabel =
      aCost !== null
        ? `[2] ${this.kit.t('fortifyArmor')}: ${aName} (${this.hero.armorPolishLv}/${MAX_POLISH_LV}) +${aSpec.polishDefPerLv} DEF • ${aCost}G`
        : `[2] ${aName}: ${this.kit.t('maxed')} ★`;

    const aBtn = addButton(this, cx, cy - 52, aLabel, {
      width: 580,
      height: 52,
      fill: aCost !== null && this.hero.gold >= aCost ? 0x0284c7 : 0x334155,
      fontSize: 19,
      onClick: () => this.handlePolishArmor(),
    });
    aBtn.setScrollFactor(0).setDepth(205);
    this.villageOverlay.push(aBtn);

    const needHeal = this.hero.hp < this.hero.maxHp;
    const hCost = innHealCost(this.hero.level, this.meta.loop);
    const hLabel = needHeal
      ? `[3] ${this.kit.t('innHeal')} (${this.hero.hp}/${this.hero.maxHp} → MAX) • ${hCost}G`
      : `[3] ${this.kit.t('fullHpLabel')}`;

    const hBtn = addButton(this, cx, cy + 10, hLabel, {
      width: 580,
      height: 52,
      fill: needHeal && this.hero.gold >= hCost ? 0x16a34a : 0x334155,
      fontSize: 19,
      onClick: () => this.handleInnHeal(),
    });
    hBtn.setScrollFactor(0).setDepth(205);
    this.villageOverlay.push(hBtn);

    const eCost = elixirCost(this.hero.elixirStacks, this.meta.loop);
    const bonusPct = Math.round((bossBonusDamageMult(this.hero) - 1) * 100);
    const eLabel = `[4] ${this.kit.t('buyElixir')} (x${this.hero.elixirStacks}${bonusPct > 0 ? ` • +${bonusPct}%` : ''}) • ${eCost}G`;
    const eBtn = addButton(this, cx, cy + 72, eLabel, {
      width: 580,
      height: 52,
      fill: this.hero.gold >= eCost ? 0x9333ea : 0x334155,
      fontSize: 19,
      onClick: () => this.handleBuyElixir(),
    });
    eBtn.setScrollFactor(0).setDepth(205);
    this.villageOverlay.push(eBtn);

    const leaveBtn = addButton(this, cx, cy + 148, this.kit.t('leave'), {
      width: 260,
      height: 50,
      fill: 0x475569,
      fontSize: 22,
      onClick: () => this.closeVillage(),
    });
    leaveBtn.setScrollFactor(0).setDepth(205);
    this.villageOverlay.push(leaveBtn);
  }

  private handlePolishWeapon(): void {
    if (!this.activeVillage) return;
    const res = polishWeapon(this.hero, this.meta.loop);
    if (!res.ok) {
      this.kit.audio.sfx('click');
      return;
    }
    this.kit.audio.sfx('medal');
    if (res.hitMax) {
      const { meta, newlyUnlocked } = unlockWeaponSkin(this.meta, this.hero.weaponId);
      if (newlyUnlocked) {
        this.meta = meta;
        const name = this.kit.t(`weapon.${this.hero.weaponId}`);
        this.skinsUnlockedThisRun.push(name);
        void this.kit.save.setJSON(META_SAVE_KEY, this.meta);
        this.kit.audio.sfx('newBest');
        this.fx.flash(0xfacc15, 200);
        this.fx.popText(this.heroSprite.x, this.heroSprite.y - 64, `★ ${this.kit.t('skinUnlocked')} ${name}`, {
          color: 0xfacc15,
          size: 26,
        });
      }
    }
    this.renderVillageOverlay();
    this.updateHud();
  }

  private handlePolishArmor(): void {
    if (!this.activeVillage) return;
    const res = polishArmor(this.hero, this.meta.loop);
    if (!res.ok) {
      this.kit.audio.sfx('click');
      return;
    }
    this.kit.audio.sfx('medal');
    if (res.hitMax) {
      const { meta, newlyUnlocked } = unlockArmorSkin(this.meta, this.hero.armorId);
      if (newlyUnlocked) {
        this.meta = meta;
        const name = this.kit.t(`armor.${this.hero.armorId}`);
        this.skinsUnlockedThisRun.push(name);
        void this.kit.save.setJSON(META_SAVE_KEY, this.meta);
        this.kit.audio.sfx('newBest');
        this.fx.flash(0xfacc15, 200);
        this.fx.popText(this.heroSprite.x, this.heroSprite.y - 64, `★ ${this.kit.t('skinUnlocked')} ${name}`, {
          color: 0xfacc15,
          size: 26,
        });
      }
    }
    this.renderVillageOverlay();
    this.updateHud();
  }

  private handleInnHeal(): void {
    if (!this.activeVillage) return;
    if (buyInnHeal(this.hero, this.meta.loop)) {
      this.kit.audio.sfx('shield');
      this.fx.burst(this.heroSprite.x, this.heroSprite.y, { color: 0x34d399, count: 16, speed: 220, lifespanMs: 380 });
      this.fx.popText(this.heroSprite.x, this.heroSprite.y - 44, this.kit.t('healed'), { color: 0x34d399, size: 24 });
      this.renderVillageOverlay();
      this.updateHud();
    } else {
      this.kit.audio.sfx('click');
    }
  }

  private handleBuyElixir(): void {
    if (!this.activeVillage) return;
    if (buyBattleElixir(this.hero, this.meta.loop)) {
      this.kit.audio.sfx('medal');
      this.fx.burst(this.heroSprite.x, this.heroSprite.y, { color: 0xc084fc, count: 16, speed: 240, lifespanMs: 380 });
      this.renderVillageOverlay();
      this.updateHud();
    } else {
      this.kit.audio.sfx('click');
    }
  }

  private openPauseMenu(): void {
    if (this.pausedByUser || this.runEnded || this.activeVillage) return;
    this.pausedByUser = true;
    this.kit.session.pauseGameplay();
    this.kit.audio.sfx('click');

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const font = this.kit.theme.font;

    const addP = <T extends Phaser.GameObjects.GameObject & { setScrollFactor?: (x: number) => T; setDepth?: (d: number) => T }>(
      o: T,
      depth: number,
    ): T => {
      if ('setScrollFactor' in o && typeof o.setScrollFactor === 'function') o.setScrollFactor(0);
      if ('setDepth' in o && typeof o.setDepth === 'function') o.setDepth(depth);
      this.pauseOverlay.push(o);
      return o;
    };

    addP(this.add.rectangle(cx, cy, width, height, 0x09050f, 0.72), 220);
    addP(this.add.rectangle(cx, cy, 420, 410, 0x160d2e, 0.97).setStrokeStyle(4, 0xfacc15), 221);
    addP(
      this.add
        .text(cx, cy - 154, this.kit.t('pausedTitle'), {
          fontFamily: font,
          fontSize: '38px',
          fontStyle: 'bold',
          color: '#facc15',
          stroke: '#09050f',
          strokeThickness: 6,
        })
        .setOrigin(0.5),
      222,
    );

    const buttons: Array<{ label: string; fill: number; fn: () => void }> = [
      { label: this.kit.t('resumeBtn'), fill: 0x16a34a, fn: () => this.closePauseMenu() },
      { label: this.kit.t('restartBtn'), fill: 0xd97706, fn: () => this.restartFromPause() },
      {
        label: this.kit.t('camp'),
        fill: 0x0284c7,
        fn: () => {
          this.clearPauseMenu();
          this.kit.audio.sfx('click');
          this.kit.goTo('Camp');
        },
      },
      {
        label: this.kit.t('homeBtn'),
        fill: 0x475569,
        fn: () => {
          this.clearPauseMenu();
          this.kit.audio.sfx('click');
          this.kit.goTo('GKTitle');
        },
      },
    ];

    buttons.forEach((b, i) => {
      const btn = addButton(this, cx, cy - 72 + i * 74, b.label, {
        width: 320,
        height: 58,
        fill: b.fill,
        fontSize: 22,
        onClick: b.fn,
      });
      btn.setScrollFactor(0).setDepth(225);
      this.pauseOverlay.push(btn);
    });
  }

  private clearPauseMenu(): void {
    for (const o of this.pauseOverlay) o.destroy();
    this.pauseOverlay = [];
    this.pausedByUser = false;
  }

  private closePauseMenu(): void {
    if (!this.pausedByUser) return;
    this.clearPauseMenu();
    this.kit.session.resumeGameplay();
    this.kit.audio.sfx('click');
  }

  private restartFromPause(): void {
    this.clearPauseMenu();
    this.kit.audio.sfx('medal');
    this.kit.start();
  }

  private closeVillage(): void {
    for (const o of this.villageOverlay) o.destroy();
    this.villageOverlay = [];
    this.activeVillage = null;
    this.villageReentryCooldown = 1.6;
    this.kit.audio.sfx('click');
    this.updateHud();
  }

  private spawnArenaBurst(x: number, y: number, colors: readonly number[], count: number, maxRadius: number, duration: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const dist = maxRadius * (0.45 + Math.random() * 0.65);
      const color = colors[i % colors.length];
      const size = 6 + Math.random() * 7;
      const shape =
        i % 3 === 0
          ? this.add.star(x, y, 4, size * 0.45, size, color, 1)
          : this.add.rectangle(x, y, size, size, color, 1);
      shape.setScrollFactor(0).setDepth(92).setAngle(Math.random() * 360);
      this.tweens.add({
        targets: shape,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist + 24,
        angle: shape.angle + (Math.random() > 0.5 ? 240 : -240),
        scale: 0.15,
        alpha: 0,
        duration: duration * (0.75 + Math.random() * 0.4),
        ease: 'Cubic.easeOut',
        onComplete: () => shape.destroy(),
      });
    }
  }

  private spawnArenaConfetti(): void {
    const { width, height } = this.scale;
    const palette = [0xfacc15, 0x38bdf8, 0xf43f5e, 0x34d399, 0xc084fc, 0xfef08a];
    for (let i = 0; i < 38; i++) {
      const startX = 60 + Math.random() * (width - 120);
      const startY = 76 + Math.random() * 40;
      const color = palette[i % palette.length];
      const w = 7 + Math.random() * 6;
      const h = 11 + Math.random() * 7;
      const piece = this.add.rectangle(startX, startY, w, h, color, 0.95).setScrollFactor(0).setDepth(94);
      const driftX = (Math.random() - 0.5) * 180;
      const delay = Math.random() * 480;
      this.tweens.add({
        targets: piece,
        x: startX + driftX,
        y: height * (0.58 + Math.random() * 0.36),
        angle: (Math.random() > 0.5 ? 1 : -1) * (240 + Math.random() * 320),
        alpha: 0,
        delay,
        duration: 1350 + Math.random() * 450,
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }

  private playBossVictoryCelebration(): void {
    if (this.runEnded) return;
    this.runEnded = true;
    this.fx.clearPops();
    this.updateHud();

    // Stop battle BGM and immediately play the triumphant 8-bit victory fanfare!
    this.kit.audio.music.stop();
    this.kit.audio.sfx('newBest');
    playVictoryFanfare(this.kit.audio.muted);

    // Clear telegraph warnings & shatter remaining fireballs into golden sparks
    this.arenaTelegraphLine?.setVisible(false);
    this.arenaTelegraphWarn?.setVisible(false);
    for (const fb of this.fireballs) {
      this.spawnArenaBurst(fb.x, fb.y, [0xfacc15, 0xfef08a, 0x38bdf8], 8, 52, 360);
      fb.obj.destroy();
      fb.glow.destroy();
    }
    this.fireballs = [];

    const { width, height } = this.scale;
    const font = this.kit.theme.font;
    const bossX = this.arenaBoss?.x ?? ARENA_BOSS_X;
    const bossY = this.arenaBoss?.y ?? ARENA_BOSS_Y;

    // 1. Impact flash + heavy shake + expanding golden shockwave from Boss
    this.fx.flash(0xfacc15, 320);
    this.fx.shake(0.85);

    const shockwave = this.add.circle(bossX, bossY, 26, 0xfacc15, 0).setStrokeStyle(8, 0xfef08a, 0.95).setScrollFactor(0).setDepth(90);
    this.tweens.add({
      targets: shockwave,
      scale: 9.5,
      alpha: 0,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => shockwave.destroy(),
    });

    // 2. Boss dramatic white-hot tremor & staggered firework bursts before vanishing
    if (this.arenaBoss?.active) {
      this.arenaBoss.setTintFill(0xffffff);
      this.tweens.add({
        targets: this.arenaBoss,
        x: bossX + 14,
        duration: 45,
        yoyo: true,
        repeat: 9,
      });
      this.tweens.add({
        targets: this.arenaBoss,
        scaleX: this.arenaBoss.scaleX * 1.35,
        scaleY: this.arenaBoss.scaleY * 1.35,
        alpha: 0,
        delay: 360,
        duration: 300,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          if (this.arenaBoss?.active) this.arenaBoss.setVisible(false);
          this.arenaBossEvoRig?.setVisible(false);
        },
      });
    }

    const burstPalette = [0xfacc15, 0xfef08a, 0x38bdf8, 0xf43f5e, 0xc084fc];
    this.spawnArenaBurst(bossX, bossY, burstPalette, 22, 165, 650);
    this.time.delayedCall(240, () => {
      if (!this.scene.isActive()) return;
      this.fx.shake(0.42);
      this.spawnArenaBurst(bossX - 42, bossY - 34, burstPalette, 18, 150, 620);
      this.spawnArenaBurst(bossX + 46, bossY + 18, burstPalette, 16, 140, 600);
    });
    this.time.delayedCall(520, () => {
      if (!this.scene.isActive()) return;
      this.fx.flash(0xffffff, 200);
      this.fx.shake(0.55);
      this.spawnArenaBurst(bossX, bossY - 12, [0xfacc15, 0xffffff, 0x38bdf8, 0x34d399], 30, 230, 780);
    });

    // 3. Hero lands cleanly, radiates golden aura, and does joyful victory hops!
    if (this.arenaHero?.active) {
      this.arenaHero.setAlpha(1).setFlipX(false).setTexture(this.heroFrames[0]);
      const heroLandX = Phaser.Math.Clamp(this.arenaHero.x, 180, width * 0.52);
      const heroGroundY = ARENA_GROUND_Y - 34;

      const aura = this.add.circle(heroLandX, heroGroundY + 16, 36, 0xfacc15, 0.25).setStrokeStyle(4, 0xfef08a, 0.9).setScrollFactor(0).setDepth(52);
      this.tweens.add({
        targets: aura,
        scale: 1.55,
        alpha: 0.08,
        duration: 420,
        yoyo: true,
        repeat: 3,
      });

      this.tweens.add({
        targets: this.arenaHero,
        x: heroLandX,
        y: heroGroundY,
        duration: 240,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          if (this.arenaHeroShadow?.active) this.arenaHeroShadow.setPosition(this.arenaHero.x, ARENA_GROUND_Y + 4);
        },
        onComplete: () => {
          if (!this.arenaHero?.active) return;
          this.tweens.add({
            targets: this.arenaHero,
            y: heroGroundY - 56,
            duration: 210,
            ease: 'Sine.easeOut',
            yoyo: true,
            repeat: 8,
            onYoyo: () => {
              if (this.arenaHero?.active) this.arenaHero.setTexture(this.heroFrames[1]);
            },
            onRepeat: () => {
              if (this.arenaHero?.active) this.arenaHero.setTexture(this.heroFrames[0]);
            },
          });
        },
      });
    }

    // 4. Celebratory Banner + Speedrun Rank Pill + Confetti & Sky Fireworks!
    this.time.delayedCall(260, () => {
      if (!this.scene.isActive()) return;
      this.kit.audio.sfx('medal');
      this.spawnArenaConfetti();

      const ribbon = this.add
        .rectangle(width / 2, height * 0.34, width, 118, 0x0f0726, 0.82)
        .setStrokeStyle(4, 0xfacc15)
        .setScrollFactor(0)
        .setDepth(95)
        .setScale(1, 0.05);
      this.tweens.add({ targets: ribbon, scaleY: 1, duration: 260, ease: 'Back.easeOut' });

      const title = this.add
        .text(width / 2, height * 0.32, `★ ${this.kit.t('victory')} ★`, {
          fontFamily: font,
          fontSize: '52px',
          fontStyle: 'bold',
          color: '#facc15',
          stroke: '#09050f',
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(96)
        .setScale(0.25);
      this.tweens.add({ targets: title, scale: 1, duration: 360, ease: 'Back.easeOut' });

      const medal = medalForTimeLeft(this.timeLeft);
      const medalColor = medal === 'S' ? '#facc15' : medal === 'A' ? '#38bdf8' : '#e2e8f0';
      const subText = this.add
        .text(width / 2, height * 0.388, `🏆 ${medal} RANK  •  ⏱ ${Math.max(0, this.timeLeft).toFixed(1)}s`, {
          fontFamily: font,
          fontSize: '24px',
          fontStyle: 'bold',
          color: medalColor,
          stroke: '#09050f',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(96)
        .setAlpha(0);
      this.tweens.add({ targets: subText, alpha: 1, y: height * 0.382, delay: 160, duration: 260, ease: 'Cubic.easeOut' });
    });

    // Extra celebratory sky fireworks & second confetti wave across the throne room
    const fireworkSpots: Array<[number, number, number]> = [
      [680, width * 0.24, height * 0.22],
      [980, width * 0.76, height * 0.2],
      [1320, width * 0.5, height * 0.18],
      [1950, width * 0.3, height * 0.24],
      [2550, width * 0.72, height * 0.22],
      [3250, width * 0.48, height * 0.19],
    ];
    for (const [delay, fxX, fxY] of fireworkSpots) {
      this.time.delayedCall(delay, () => {
        if (!this.scene.isActive()) return;
        this.spawnArenaBurst(fxX, fxY, burstPalette, 20, 130, 680);
      });
    }
    this.time.delayedCall(1900, () => {
      if (!this.scene.isActive()) return;
      this.spawnArenaConfetti();
      this.playSpeedrunCreditsRoll();
    });
  }

  /**
   * Readable 8-bit JRPG Ending Credits Roll & Post-Credits Sequel Teaser:
   * - Comfortable reading speed (~9.5s roll + ~2.4s sequel teaser)
   * - Hold [SPACE] to 3.5x fast-forward
   * - Press [ESC] or click Skip button to jump straight to Results
   * - Site-only kyoangel Time Goddess Easter egg (clean generic credit on portals)
   */
  private playSpeedrunCreditsRoll(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height * 0.61;
    const panelW = 780;
    const panelH = 320;
    const font = this.kit.theme.font;

    const curTitle = `${this.kit.t(`chapter.${this.stage.chapter.id}`)} ${this.stage.roman}`;
    const nextStage = getChapterForLoop(this.meta.loop + 1);
    const nextTitle = `${this.kit.t(`chapter.${nextStage.chapter.id}`)} ${nextStage.roman}`;
    const sameChapter = nextStage.chapter.id === this.stage.chapter.id;

    // Only show the personal kyoangel Time Goddess pun on our own site / local dev (clean generic credit on portals)
    const isOwnSite = this.kit.platform.features.externalLinks;
    const goddessCredit = this.kit.t(isOwnSite ? 'credits.goddessSite' : 'credits.goddessPortal');

    // Retro dark cosmic credits box
    const panel = this.add
      .rectangle(cx, cy, panelW, panelH, 0x090517, 0.92)
      .setStrokeStyle(3, 0xfacc15)
      .setScrollFactor(0)
      .setDepth(115)
      .setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 0.94, duration: 280 });

    // Top "CHAPTER I — THE END" header
    const header = this.add
      .text(cx, cy - panelH / 2 + 28, `${curTitle}  —  ${this.kit.t('credits.theEnd')}`, {
        fontFamily: font,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#facc15',
        stroke: '#09050f',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(117)
      .setAlpha(0);
    this.tweens.add({ targets: header, alpha: 1, duration: 280 });

    const divider = this.add
      .rectangle(cx, cy - panelH / 2 + 52, panelW - 48, 2, 0xfacc15, 0.45)
      .setScrollFactor(0)
      .setDepth(117);

    // Masked viewport for smooth upward staff roll
    const viewTop = cy - panelH / 2 + 60;
    const viewH = panelH - 122;
    const maskGfx = this.add.graphics().setScrollFactor(0).setVisible(false);
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(cx - panelW / 2 + 18, viewTop, panelW - 36, viewH);

    const startRollY = viewTop + viewH + 10;
    const roll = this.add.container(cx, startRollY).setScrollFactor(0).setDepth(116);
    roll.setMask(maskGfx.createGeometryMask());

    const lines: Array<{ text: string; color: string; size: number; gap: number }> = [
      { text: this.kit.t('credits.cast'), color: '#7dd3fc', size: 19, gap: 38 },
      { text: `${this.kit.t('credits.hero')}  ·  LV ${this.hero.level}`, color: '#ffffff', size: 20, gap: 36 },
      { text: `${this.kit.t('credits.goddess')}  ·  ${goddessCredit}`, color: '#fef08a', size: 20, gap: 38 },
      { text: `${this.kit.t('credits.smith')}  ·  ${this.kit.t('credits.smithVal')}`, color: '#cbd5e1', size: 18, gap: 36 },
      { text: `${this.kit.t('credits.mobs')}  ·  ${this.kills}`, color: '#cbd5e1', size: 18, gap: 36 },
      { text: `${this.kit.t('credits.boss')}  ·  ${this.currentBossDisplayName()} ✓`, color: '#fda4af', size: 19, gap: 46 },
      { text: this.kit.t('credits.thanks'), color: '#7dd3fc', size: 19, gap: 36 },
      { text: this.kit.t('credits.spacebar'), color: '#e2e8f0', size: 19, gap: 52 },
      { text: this.kit.t('credits.thanksPlay'), color: '#facc15', size: 28, gap: 40 },
    ];

    let yCursor = 0;
    for (const ln of lines) {
      const t = this.add
        .text(0, yCursor, ln.text, {
          fontFamily: font,
          fontSize: `${ln.size}px`,
          fontStyle: 'bold',
          color: ln.color,
          stroke: '#09050f',
          strokeThickness: 4,
        })
        .setOrigin(0.5, 0);
      roll.add(t);
      yCursor += ln.gap;
    }

    // Target Y so "★ THANKS FOR PLAYING! ★" settles cleanly right in the center of the viewport
    const targetRollY = viewTop + viewH / 2 - (yCursor - 54);
    const totalScrollDist = Math.max(1, startRollY - targetRollY);
    const baseScrollPxPerSec = totalScrollDist / 9.2; // Comfortable ~9.2s readable roll!

    let done = false;
    let fastForward = false;
    let teaserShown = false;

    // Bottom-left fast-forward hint + bottom-right Skip / Continue button (never auto-jumps to Results!)
    const fastHint = this.add
      .text(28, height - 48, this.kit.t('holdFastCredits'), {
        fontFamily: font,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#cbd5e1',
        stroke: '#09050f',
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(130);

    let actionBtn = addButton(this, width - 138, height - 52, this.kit.t('skipCredits'), {
      width: 224,
      height: 50,
      fill: 0x312e81,
      fontSize: 19,
      onClick: () => finishNow(true),
    });
    actionBtn.setScrollFactor(0).setDepth(130);

    const onKeyDown = (e: KeyboardEvent): void => {
      if (done) return;
      if (e.code === 'Escape' || e.key === 'Escape' || (teaserShown && (e.code === 'Enter' || e.key === 'Enter'))) {
        e.preventDefault();
        finishNow(true);
        return;
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        fastForward = true;
        if (fastHint.active) fastHint.setColor('#facc15');
      }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space' || e.key === ' ') {
        fastForward = false;
        if (fastHint.active) fastHint.setColor('#cbd5e1');
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);

    const tickEvent = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (done || !this.scene.isActive() || !roll.active) return;
        const stepSec = 0.016 * (fastForward ? 3.5 : 1);
        if (roll.y > targetRollY) {
          roll.y = Math.max(targetRollY, roll.y - baseScrollPxPerSec * stepSec);
        } else if (!teaserShown) {
          teaserShown = true;
          this.kit.audio.sfx('rush');
          const teaserMsg = sameChapter
            ? `${this.kit.t('credits.nextSame')}   ▶ ${nextTitle}`
            : `${this.kit.t('credits.nextChapter')}   ▶ ${nextTitle}`;
          const teaser = this.add
            .text(cx, cy + panelH / 2 - 28, teaserMsg, {
              fontFamily: font,
              fontSize: '18px',
              fontStyle: 'bold',
              color: sameChapter ? '#fda4af' : '#facc15',
              stroke: '#09050f',
              strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(118)
            .setScale(0.6)
            .setAlpha(0);
          this.tweens.add({ targets: teaser, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });

          // Replace Skip button with a prominent golden "Proceed to Results" button (waits for user!)
          if (fastHint.active) fastHint.setVisible(false);
          if (actionBtn.active) actionBtn.destroy();
          actionBtn = addButton(this, width - 144, height - 52, this.kit.t('toResultsCredits'), {
            width: 236,
            height: 52,
            fill: 0xd97706,
            fontSize: 19,
            onClick: () => finishNow(true),
          });
          actionBtn.setScrollFactor(0).setDepth(130);
        }
      },
    });

    const cleanupCredits = (): void => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      tickEvent.remove(false);
      if (actionBtn.active) actionBtn.destroy();
      if (fastHint.active) fastHint.destroy();
      maskGfx.destroy();
      divider.destroy();
    };

    const finishNow = (byUser: boolean): void => {
      if (done) return;
      done = true;
      cleanupCredits();
      if (!this.scene.isActive()) return;
      if (byUser) this.kit.audio.sfx('click');
      this.finalizeRun('victory', true);
    };

    this.events.once('shutdown', cleanupCredits);
  }

  private scheduleCutsceneFinalize(reason: RunSummary['reason'], delayMs: number): void {
    let done = false;
    let skipBtn: Phaser.GameObjects.Container | null = null;
    let autoTimer: Phaser.Time.TimerEvent | null = null;
    let graceTimer: Phaser.Time.TimerEvent | null = null;

    const cleanupSkip = (): void => {
      window.removeEventListener('keydown', onSkipKey, true);
      if (autoTimer) {
        autoTimer.remove(false);
        autoTimer = null;
      }
      if (graceTimer) {
        graceTimer.remove(false);
        graceTimer = null;
      }
      if (skipBtn?.active) {
        skipBtn.destroy();
        skipBtn = null;
      }
    };

    const finishNow = (byUser: boolean): void => {
      if (done) return;
      done = true;
      cleanupSkip();
      if (!this.scene.isActive()) return;
      if (byUser) this.kit.audio.sfx('click');
      this.finalizeRun(reason, true);
    };

    const onSkipKey = (e: KeyboardEvent): void => {
      if (done) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape' || e.key === ' ') {
        e.preventDefault();
        finishNow(true);
      }
    };

    // Short 450ms grace period so holding Space during a Dash-Slash won't accidentally skip the cutscene
    graceTimer = this.time.delayedCall(450, () => {
      if (done || !this.scene.isActive()) return;
      const { width, height } = this.scale;
      skipBtn = addButton(this, width - 146, height - 54, this.kit.t('skipCutscene'), {
        width: 244,
        height: 52,
        fill: 0x312e81,
        fontSize: 19,
        onClick: () => finishNow(true),
      });
      skipBtn.setScrollFactor(0).setDepth(130).setAlpha(0);
      this.tweens.add({ targets: skipBtn, alpha: 0.96, duration: 200 });
      window.addEventListener('keydown', onSkipKey, true);
    });

    autoTimer = this.time.delayedCall(delayMs, () => finishNow(false));
    this.events.once('shutdown', cleanupSkip);
  }

  private clearDefeatCutscene(): void {
    for (const o of this.defeatCutsceneObjects) {
      if (o.active) o.destroy();
    }
    this.defeatCutsceneObjects = [];
  }

  private playDefeatCutscene(reason: 'defeated' | 'timeUp'): void {
    this.fx.clearPops();
    this.clearDefeatCutscene();
    this.updateHud();

    // Stop battle BGM and play defeat jingle immediately during the animation
    this.kit.audio.music.stop();
    playDefeatJingle(this.kit.audio.muted);

    // Clear active boss fireballs/telegraphs so the defeat scene reads cleanly
    this.arenaTelegraphLine?.setVisible(false);
    this.arenaTelegraphWarn?.setVisible(false);
    for (const fb of this.fireballs) {
      fb.obj.destroy();
      fb.glow.destroy();
    }
    this.fireballs = [];

    const { width, height } = this.scale;
    const font = this.kit.theme.font;
    const track = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      this.defeatCutsceneObjects.push(obj);
      return obj;
    };

    const isBoss = this.mode === 'boss' && this.arenaHero?.active;
    const heroObj = isBoss ? this.arenaHero : this.heroSprite;
    const heroShadowObj = isBoss ? this.arenaHeroShadow : this.heroShadow;
    const heroScreenX = isBoss ? this.arenaHero.x : this.heroSprite.x - this.cameras.main.scrollX;
    const heroScreenY = isBoss ? this.arenaHero.y : this.heroSprite.y - this.cameras.main.scrollY;

    // Soft dramatic dim veil
    const veilColor = reason === 'defeated' ? 0x1a060e : 0x0b1024;
    const veil = track(this.add.rectangle(width / 2, height / 2, width, height, veilColor, 0).setScrollFactor(0).setDepth(90));
    this.tweens.add({ targets: veil, fillAlpha: 0.42, duration: 360, ease: 'Cubic.easeOut' });

    if (reason === 'defeated') {
      // 1A. DEFEATED: Dramatic knockback tumble + dizzy stars on the ground!
      this.fx.flash(0xf43f5e, 260);
      this.fx.shake(0.6);

      const knockDir = isBoss ? -1 : this.heroSprite.flipX ? 1 : -1;
      const startX = heroObj.x;
      const startY = heroObj.y;
      const landX = isBoss
        ? Phaser.Math.Clamp(startX + knockDir * 120, 72, ARENA_BOSS_X - 80)
        : Phaser.Math.Clamp(startX + knockDir * 84, 52, WORLD_W - 52);
      const landY = isBoss ? ARENA_GROUND_Y - 18 : startY + 14;

      heroObj.setAlpha(1).setTint(0xfda4af);
      this.spawnArenaBurst(heroScreenX, heroScreenY, [0xf43f5e, 0xfef08a, 0xffffff], 18, 125, 520);

      // Launch arc (x + angle tumble + pop up then drop flat)
      this.tweens.add({
        targets: heroObj,
        x: landX,
        angle: knockDir * 90,
        duration: 520,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          if (heroShadowObj?.active) heroShadowObj.setPosition(heroObj.x, isBoss ? ARENA_GROUND_Y + 4 : heroObj.y + 18);
          if (!isBoss) {
            this.heroHpBg.setPosition(heroObj.x, heroObj.y - 36);
            this.heroHpFill.setPosition(heroObj.x - 24, heroObj.y - 36);
          }
        },
      });
      this.tweens.add({
        targets: heroObj,
        y: startY - 68,
        duration: 210,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          if (!heroObj.active) return;
          this.tweens.add({
            targets: heroObj,
            y: landY,
            duration: 310,
            ease: 'Bounce.easeOut',
            onComplete: () => {
              if (!this.scene.isActive()) return;
              // Dust puff & dizzy stars orbiting over fallen hero!
              const landScreenX = isBoss ? heroObj.x : heroObj.x - this.cameras.main.scrollX;
              const landScreenY = isBoss ? heroObj.y : heroObj.y - this.cameras.main.scrollY;
              this.spawnArenaBurst(landScreenX, landScreenY + 10, [0xcbd5e1, 0x94a3b8], 10, 56, 380);
              for (let i = 0; i < 3; i++) {
                const a0 = (Math.PI * 2 * i) / 3;
                const star = track(
                  this.add
                    .star(landScreenX, landScreenY - 30, 5, 3, 7, 0xfacc15, 0.95)
                    .setScrollFactor(0)
                    .setDepth(96),
                );
                this.tweens.addCounter({
                  from: 0,
                  to: Math.PI * 8,
                  duration: 3400,
                  onUpdate: (tw) => {
                    if (!star.active) return;
                    const a = a0 + (tw.getValue() ?? 0);
                    star.setPosition(landScreenX + Math.cos(a) * 26, landScreenY - 30 + Math.sin(a) * 9);
                  },
                });
              }
            },
          });
        },
      });
    } else {
      // 1B. TIME UP: Timer alarm shatter + hero slumps in exhaustion with gloom sigh!
      this.kit.audio.sfx('shieldBreak');
      this.fx.flash(0xf43f5e, 180);
      this.fx.shake(0.35);

      // Top-center Timer Badge alarm shake & shattering sand sparks
      const timerX = width / 2;
      const timerY = 42;
      this.tweens.add({
        targets: [this.timerBadge, this.timerText],
        x: timerX + 10,
        duration: 48,
        yoyo: true,
        repeat: 6,
        onComplete: () => {
          this.timerBadge.setX(timerX);
          this.timerText.setX(timerX);
        },
      });
      const alarmRing = track(
        this.add.circle(timerX, timerY, 34, 0xf43f5e, 0).setStrokeStyle(5, 0xf43f5e, 0.95).setScrollFactor(0).setDepth(105),
      );
      this.tweens.add({ targets: alarmRing, scale: 3.4, alpha: 0, duration: 560, ease: 'Cubic.easeOut' });
      this.spawnArenaBurst(timerX, timerY, [0xf43f5e, 0xfacc15, 0x94a3b8], 20, 120, 620);

      // Hero slumps down with a disappointed squish + floating gloom cloud & sweatdrop
      const baseScaleY = heroObj.scaleY;
      heroObj.setAlpha(1).setTint(0x94a3b8);
      this.tweens.add({
        targets: heroObj,
        scaleY: baseScaleY * 0.8,
        y: heroObj.y + 10,
        duration: 420,
        ease: 'Sine.easeOut',
      });

      const gloom = track(
        this.add
          .text(heroScreenX, heroScreenY - 52, '💦 ...', {
            fontFamily: font,
            fontSize: '26px',
            fontStyle: 'bold',
            color: '#93c5fd',
            stroke: '#09050f',
            strokeThickness: 5,
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(96)
          .setAlpha(0),
      );
      this.tweens.add({ targets: gloom, alpha: 1, y: heroScreenY - 76, duration: 680, ease: 'Cubic.easeOut' });
    }

    // 2. Dramatic Banner (t = 220ms)
    this.time.delayedCall(220, () => {
      if (!this.scene.isActive()) return;
      const accent = reason === 'defeated' ? 0xf43f5e : 0xf59e0b;
      const ribbon = track(
        this.add
          .rectangle(width / 2, height * 0.36, width, 102, 0x13091f, 0.84)
          .setStrokeStyle(4, accent)
          .setScrollFactor(0)
          .setDepth(95)
          .setScale(1, 0.05),
      );
      this.tweens.add({ targets: ribbon, scaleY: 1, duration: 240, ease: 'Back.easeOut' });

      const icon = reason === 'defeated' ? '💀' : '⏰';
      const titleColor = reason === 'defeated' ? '#fda4af' : '#fcd34d';
      const bannerText = track(
        this.add
          .text(width / 2, height * 0.36, `${icon} ${this.kit.t(reason)}`, {
            fontFamily: font,
            fontSize: '48px',
            fontStyle: 'bold',
            color: titleColor,
            stroke: '#09050f',
            strokeThickness: 8,
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(96)
          .setScale(0.3),
      );
      this.tweens.add({ targets: bannerText, scale: 1, duration: 320, ease: 'Back.easeOut' });
    });

    // 3. Auto-transition after 3.6s, or let player skip anytime after 450ms via button / [SPACE]
    this.scheduleCutsceneFinalize(reason, 3600);
  }

  private endRun(reason: RunSummary['reason']): void {
    if (this.runEnded) return;
    this.runEnded = true;
    if (reason === 'defeated' || reason === 'timeUp') {
      this.playDefeatCutscene(reason);
      return;
    }
    this.finalizeRun(reason, false);
  }

  private showCrystalReviveOffer(reason: 'defeated' | 'timeUp', fanfarePlayed: boolean): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const font = this.kit.theme.font;
    const cost = BALANCE.crystalReviveCost;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const addO = <T extends Phaser.GameObjects.GameObject & { setScrollFactor?: (x: number) => T; setDepth?: (d: number) => T }>(
      o: T,
      depth: number,
    ): T => {
      if ('setScrollFactor' in o && typeof o.setScrollFactor === 'function') o.setScrollFactor(0);
      if ('setDepth' in o && typeof o.setDepth === 'function') o.setDepth(depth);
      objects.push(o);
      return o;
    };

    const COUNTDOWN_MS = 5000;
    let remaining = COUNTDOWN_MS;
    let decided = false;

    addO(this.add.rectangle(cx, cy, width, height, 0x09050f, 0.55), 138);
    addO(this.add.rectangle(cx, cy, 620, 420, 0x1a1033, 0.94).setStrokeStyle(4, 0xd97706), 139);

    const ringCx = cx;
    const ringCy = cy - 102;
    const ringR = 54;
    const ringGfx = addO(this.add.graphics(), 140);
    const drawRing = (): void => {
      if (!ringGfx.active) return;
      ringGfx.clear();
      ringGfx.lineStyle(12, 0x0f0726, 0.8);
      ringGfx.strokeCircle(ringCx, ringCy, ringR);
      const frac = Math.max(0, remaining / COUNTDOWN_MS);
      ringGfx.lineStyle(12, 0xfacc15, 1);
      ringGfx.beginPath();
      ringGfx.arc(ringCx, ringCy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
      ringGfx.strokePath();
    };
    drawRing();

    const numText = addO(
      this.add
        .text(ringCx, ringCy, '5', {
          fontFamily: font,
          fontSize: '46px',
          fontStyle: 'bold',
          color: '#fef9c3',
          stroke: '#09050f',
          strokeThickness: 5,
        })
        .setOrigin(0.5),
      141,
    );

    const cleanupOffer = (): void => {
      tick.remove(false);
      for (const o of objects) {
        if (o.active) o.destroy();
      }
      objects.length = 0;
    };

    const decline = (): void => {
      if (decided) return;
      decided = true;
      this.crystalReviveUsed = true;
      cleanupOffer();
      this.finalizeRun(reason, fanfarePlayed);
    };

    const accept = (): void => {
      if (decided) return;
      decided = true;
      this.crystalReviveUsed = true;
      this.meta = { ...this.meta, crystals: Math.max(0, this.meta.crystals - cost) };
      void this.kit.save.setJSON(META_SAVE_KEY, this.meta);
      cleanupOffer();
      this.playGoddessReviveCutscene();
    };

    const reviveBtn = addButton(this, cx, cy + 28, `✨ ${this.kit.t('goddessCrystalRevive')}`, {
      width: 520,
      height: 78,
      fill: 0xd97706,
      fontSize: 26,
      onClick: accept,
    });
    reviveBtn.setScrollFactor(0).setDepth(142);
    objects.push(reviveBtn);

    addO(
      this.add
        .text(cx, cy + 92, `${this.kit.t('goddessCrystalOwned')} ${this.meta.crystals}`, {
          fontFamily: font,
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#38bdf8',
          stroke: '#09050f',
          strokeThickness: 4,
        })
        .setOrigin(0.5),
      141,
    );

    const noBtn = addO(
      this.add
        .text(cx, cy + 148, this.kit.t('noThanks'), {
          fontFamily: font,
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#cbd5e1',
          stroke: '#09050f',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setPadding(24, 10, 24, 10)
        .setInteractive({ useHandCursor: true }),
      142,
    );
    noBtn.on('pointerup', () => {
      this.kit.audio.sfx('click');
      decline();
    });

    const tick = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (decided || !this.scene.isActive()) return;
        remaining = Math.max(0, remaining - 50);
        drawRing();
        if (numText.active) numText.setText(String(Math.max(0, Math.ceil(remaining / 1000))));
        if (remaining <= 0) decline();
      },
    });
    this.events.once('shutdown', cleanupOffer);
  }

  private finalizeRun(reason: RunSummary['reason'], fanfarePlayed: boolean): void {
    this.fx.clearPops();

    const bossSlain = reason === 'victory';
    // On ad-free platforms (e.g. own website), offer Time Goddess revive for 100 Crystals (once per run)!
    if (
      !bossSlain &&
      !this.kit.platform.features.rewardedAds &&
      !this.crystalReviveUsed &&
      this.meta.crystals >= BALANCE.crystalReviveCost
    ) {
      this.showCrystalReviveOffer(reason, fanfarePlayed);
      return;
    }
    this.kit.audio.music.stop();
    if (!bossSlain && !fanfarePlayed) {
      this.kit.audio.sfx('death');
    }
    const bossHpRatio = this.bossMaxHp > 0 ? this.bossHp / this.bossMaxHp : 1;
    const crystalsEarned = computeCrystalReward(
      { level: this.hero.level, kills: this.kills, bossHpRatio, bossSlain, loop: this.meta.loop },
      this.meta.ranks,
    );
    const score = computeScore({
      level: this.hero.level,
      kills: this.kills,
      bossHpRatio,
      bossSlain,
      loop: this.meta.loop,
      timeLeft: this.timeLeft,
    });

    const defeatTip = diagnoseDefeat({
      reason,
      bossHpRatio,
      weaponPolishLv: this.hero.weaponPolishLv,
      armorPolishLv: this.hero.armorPolishLv,
      ownedWeaponsCount: this.meta.ownedWeapons.length,
      ownedArmorsCount: this.meta.ownedArmors.length,
      unlockedSkinsCount: this.meta.unlockedWeaponSkins.length + this.meta.unlockedArmorSkins.length,
      atkRank: this.meta.ranks.atk,
      defRank: this.meta.ranks.def,
      spdRank: this.meta.ranks.spd,
      timeRank: this.meta.ranks.time,
    });

    const summary: RunSummary = {
      level: this.hero.level,
      kills: this.kills,
      bossHpRatio,
      bossSlain,
      loop: this.meta.loop,
      timeLeft: Math.round(Math.max(0, this.timeLeft) * 10) / 10,
      medal: bossSlain ? medalForTimeLeft(this.timeLeft) : null,
      crystalsEarned,
      skinsUnlocked: [...this.skinsUnlockedThisRun],
      defeatTip,
      reason,
      fanfarePlayed,
    };
    this.game.registry.set(LAST_RUN_KEY, summary);

    const reviveCb = bossSlain
      ? undefined
      : () => {
          this.playGoddessReviveCutscene();
        };

    void this.kit.gameOver(score, reviveCb ? { revive: reviveCb } : undefined);
  }

  private playGoddessReviveCutscene(): void {
    // Keep runEnded = true during the cutscene so timer & enemies stay frozen while Goddess casts her spell
    this.runEnded = true;
    this.time.paused = false;
    this.tweens.resumeAll();
    this.clearDefeatCutscene();

    // Clear any lingering boss fireballs/telegraphs so player resumes cleanly
    for (const fb of this.fireballs) {
      fb.obj.destroy();
      fb.glow.destroy();
    }
    this.fireballs = [];
    this.arenaBossCharging = 0;
    this.arenaBossAttackTimer = 1.8;
    this.arenaTelegraphLine?.setVisible(false);
    this.arenaTelegraphWarn?.setVisible(false);

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height * 0.44;
    const font = this.kit.theme.font;
    const cleanup: Phaser.GameObjects.GameObject[] = [];
    const track = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      cleanup.push(obj);
      return obj;
    };

    const baseTime = Math.max(0, this.timeLeft);
    const targetTime = baseTime + REVIVE_BONUS_SEC;

    // Heavenly audio chime
    playGoddessReviveChime(this.kit.audio.muted);

    // 1. Soft twilight dim veil (depth 95 -> below HUD timer at 101 so timer +10s animation shines on top!)
    const veil = track(this.add.rectangle(cx, height / 2, width, height, 0x09051f, 0).setScrollFactor(0).setDepth(95));
    this.tweens.add({ targets: veil, fillAlpha: 0.56, duration: 360, ease: 'Cubic.easeOut' });

    // Vertical divine beam of light from the heavens
    const beamOuter = track(this.add.rectangle(cx, height / 2, 220, height, 0x38bdf8, 0).setScrollFactor(0).setDepth(110));
    const beamInner = track(this.add.rectangle(cx, height / 2, 110, height, 0xfef08a, 0).setScrollFactor(0).setDepth(111));
    this.tweens.add({ targets: beamOuter, fillAlpha: 0.16, duration: 420, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: beamInner, fillAlpha: 0.22, duration: 420, ease: 'Cubic.easeOut' });

    // 2. Layered glowing halos descending with the Time Goddess from top to screen center
    // Stage 26+ (Hard Mode): Goddess A has descended as a mortal Heroine, so Astral Goddess B takes over!
    const useAstralGoddess = this.meta.loop >= HARD_MODE_LOOP;
    const goddessKey0 = useAstralGoddess ? 'px-goddess-astral-0' : 'px-goddess-0';
    const goddessKey1 = useAstralGoddess ? 'px-goddess-astral-1' : 'px-goddess-1';
    const haloPrimary = useAstralGoddess ? 0xc084fc : 0xfacc15;
    const haloSecondary = useAstralGoddess ? 0x38bdf8 : 0x38bdf8;
    const starCrestColor = useAstralGoddess ? 0xe0e7ff : 0xfef08a;

    const startY = -90;
    const glowFar = track(this.add.circle(cx, startY, 132, haloSecondary, 0.22).setScrollFactor(0).setDepth(112));
    const glowMid = track(this.add.circle(cx, startY, 92, haloPrimary, 0.28).setScrollFactor(0).setDepth(113));
    const glowCore = track(this.add.circle(cx, startY, 56, 0xffffff, 0.36).setScrollFactor(0).setDepth(114));

    const haloOuter = track(
      this.add.circle(cx, startY, 108, haloSecondary, 0).setStrokeStyle(4, haloSecondary, 0.85).setScrollFactor(0).setDepth(115),
    );
    const haloGold = track(
      this.add.circle(cx, startY, 78, haloPrimary, 0).setStrokeStyle(4, starCrestColor, 0.95).setScrollFactor(0).setDepth(116),
    );

    // Rotating celestial star-crest behind Goddess
    const starCrest = track(this.add.star(cx, startY, 8, 46, 94, starCrestColor, 0.22).setScrollFactor(0).setDepth(115));
    this.tweens.add({ targets: starCrest, angle: 360, duration: 3600, repeat: -1 });

    // Pixel-art Time Goddess sprite with gentle wing-flap animation
    const goddess = track(this.add.image(cx, startY, goddessKey0).setScale(1.25).setScrollFactor(0).setDepth(118));
    const flapTimer = this.time.addEvent({
      delay: 220,
      loop: true,
      callback: () => {
        if (goddess.active) goddess.setTexture(goddess.texture.key === goddessKey0 ? goddessKey1 : goddessKey0);
      },
    });

    const goddessGroup = [glowFar, glowMid, glowCore, haloOuter, haloGold, starCrest, goddess];
    this.tweens.add({
      targets: goddessGroup,
      y: cy,
      duration: 680,
      ease: 'Cubic.easeOut',
    });

    // Pulsing halo glow once she arrives
    this.tweens.add({ targets: [glowFar, haloOuter], scale: 1.18, alpha: 0.65, delay: 450, duration: 520, yoyo: true, repeat: 2 });
    this.tweens.add({ targets: [glowMid, haloGold], scale: 1.12, delay: 450, duration: 420, yoyo: true, repeat: 3 });

    // Orbiting celestial light motes swirling around the Goddess
    for (let i = 0; i < 8; i++) {
      const a0 = (Math.PI * 2 * i) / 8;
      const mote = track(
        this.add
          .star(cx + Math.cos(a0) * 105, cy + Math.sin(a0) * 60, 4, 3, 8, i % 2 === 0 ? 0xfef08a : 0x7dd3fc, 0)
          .setScrollFactor(0)
          .setDepth(119),
      );
      this.tweens.add({ targets: mote, alpha: 0.95, delay: 420 + i * 35, duration: 220 });
      this.tweens.addCounter({
        from: 0,
        to: Math.PI * 2,
        duration: 1600,
        delay: 420,
        onUpdate: (tw) => {
          if (!mote.active) return;
          const a = a0 + (tw.getValue() ?? 0);
          mote.setPosition(cx + Math.cos(a) * 108, cy + Math.sin(a) * 52);
        },
      });
    }

    // 3. Spell Cast Incantation (t = 680ms)
    this.time.delayedCall(680, () => {
      if (!this.scene.isActive()) return;
      this.kit.audio.sfx('medal');

      // Expanding golden spell circle
      const spellRing = track(
        this.add.circle(cx, cy, 42, 0xfacc15, 0).setStrokeStyle(6, 0xfef08a, 0.95).setScrollFactor(0).setDepth(117),
      );
      this.tweens.add({ targets: spellRing, scale: 4.8, alpha: 0, duration: 640, ease: 'Cubic.easeOut' });
      this.spawnArenaBurst(cx, cy, [0xfacc15, 0x38bdf8, 0xffffff, 0x34d399], 22, 170, 650);

      // Goddess title & incantation banner
      const banner = track(
        this.add
          .rectangle(cx, cy + 128, 560, 86, 0x13092b, 0.9)
          .setStrokeStyle(3, 0xfacc15)
          .setScrollFactor(0)
          .setDepth(120)
          .setScale(0.2, 1),
      );
      this.tweens.add({ targets: banner, scaleX: 1, duration: 260, ease: 'Back.easeOut' });

      const titleTxt = track(
        this.add
          .text(cx, cy + 106, this.kit.t('goddessTitle'), {
            fontFamily: font,
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#7dd3fc',
            stroke: '#09050f',
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(121)
          .setAlpha(0),
      );
      const spellTxt = track(
        this.add
          .text(cx, cy + 140, this.kit.t('goddessSpell'), {
            fontFamily: font,
            fontSize: '26px',
            fontStyle: 'bold',
            color: '#fef08a',
            stroke: '#09050f',
            strokeThickness: 6,
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(121)
          .setScale(0.4),
      );
      this.tweens.add({ targets: titleTxt, alpha: 1, duration: 220 });
      this.tweens.add({ targets: spellTxt, scale: 1, duration: 300, ease: 'Back.easeOut' });
    });

    // 4. Dual Blessing Animation: Revive Hero HP + Fly Chrono Orbs into Timer (+10.0s!) (t = 1220ms)
    this.time.delayedCall(1220, () => {
      if (!this.scene.isActive()) return;
      this.fx.flash(0xfef08a, 240);
      this.kit.audio.sfx('newBest');

      // Locate Hero in screen coordinates (works for both Boss Arena & Overworld!)
      const heroScreenX =
        this.mode === 'boss' && this.arenaHero?.active
          ? this.arenaHero.x
          : this.heroSprite.x - this.cameras.main.scrollX;
      const heroScreenY =
        this.mode === 'boss' && this.arenaHero?.active
          ? this.arenaHero.y
          : this.heroSprite.y - this.cameras.main.scrollY;

      // (A) Revival Blessing Orbs streaming to Hero
      for (let i = 0; i < 6; i++) {
        const orb = this.add.circle(cx, cy, 9, i % 2 === 0 ? 0x34d399 : 0xfef08a, 0.95).setScrollFactor(0).setDepth(125);
        this.tweens.add({
          targets: orb,
          x: heroScreenX + (Math.random() - 0.5) * 20,
          y: heroScreenY + (Math.random() - 0.5) * 20,
          scale: 0.4,
          delay: i * 45,
          duration: 300,
          ease: 'Cubic.easeIn',
          onComplete: () => orb.destroy(),
        });
      }

      // Hero resurrection ring + full HP refill + stand back up cleanly on orb impact!
      this.time.delayedCall(260, () => {
        if (!this.scene.isActive()) return;
        this.hero.hp = this.hero.maxHp;
        this.updateHud();

        // Restore fallen/slumped Hero back to full upright fighting stance with a little spring hop
        if (this.mode === 'boss' && this.arenaHero?.active) {
          this.arenaHero.clearTint().setAlpha(1);
          this.tweens.add({
            targets: this.arenaHero,
            angle: 0,
            scaleX: 1.65,
            scaleY: 1.65,
            y: ARENA_GROUND_Y - 34,
            duration: 240,
            ease: 'Back.easeOut',
          });
        } else if (this.heroSprite?.active) {
          this.heroSprite.clearTint().setAlpha(1);
          const s = this.isMobile ? 1.3 : 1;
          this.tweens.add({
            targets: this.heroSprite,
            angle: 0,
            scaleX: s,
            scaleY: s,
            duration: 240,
            ease: 'Back.easeOut',
          });
        }
        const revRing = this.add
          .circle(heroScreenX, heroScreenY, 18, 0x34d399, 0)
          .setStrokeStyle(6, 0x34d399, 0.95)
          .setScrollFactor(0)
          .setDepth(124);
        this.tweens.add({
          targets: revRing,
          scale: 4.5,
          alpha: 0,
          duration: 500,
          ease: 'Cubic.easeOut',
          onComplete: () => revRing.destroy(),
        });
        this.spawnArenaBurst(heroScreenX, heroScreenY, [0x34d399, 0xfacc15, 0xffffff], 20, 120, 560);
        this.popArenaText(heroScreenX, heroScreenY - 58, `✨ ${this.kit.t('healed')}`, '#34d399', 28);
      });

      // (B) Chrono Blessing Orbs arcing up into the Top-Center Timer Badge (width / 2, 42)
      const timerX = width / 2;
      const timerY = 42;
      for (let i = 0; i < 6; i++) {
        const tOrb = this.add
          .star(cx + (i - 2.5) * 18, cy - 20, 4, 4, 10, i % 2 === 0 ? 0x38bdf8 : 0xfacc15, 1)
          .setScrollFactor(0)
          .setDepth(125);
        this.tweens.add({
          targets: tOrb,
          x: timerX,
          y: timerY,
          angle: 270,
          scale: 0.5,
          delay: i * 55,
          duration: 340,
          ease: 'Cubic.easeIn',
          onComplete: () => tOrb.destroy(),
        });
      }

      // Timer badge pulse + smooth +10.0s count-up roll!
      this.time.delayedCall(280, () => {
        if (!this.scene.isActive()) return;
        this.kit.audio.sfx('medal');
        const timerRing = this.add
          .circle(timerX, timerY, 34, 0x38bdf8, 0)
          .setStrokeStyle(5, 0x38bdf8, 0.95)
          .setScrollFactor(0)
          .setDepth(124);
        this.tweens.add({
          targets: timerRing,
          scale: 3.6,
          alpha: 0,
          duration: 520,
          ease: 'Cubic.easeOut',
          onComplete: () => timerRing.destroy(),
        });
        this.spawnArenaBurst(timerX, timerY, [0x38bdf8, 0xfacc15, 0xffffff], 18, 110, 520);
        this.tweens.add({ targets: [this.timerBadge, this.timerText], scale: 1.24, duration: 180, yoyo: true, ease: 'Back.easeOut' });
        this.popArenaText(timerX, timerY + 64, `+${REVIVE_BONUS_SEC.toFixed(1)}s ⏱`, '#38bdf8', 32);

        this.tweens.addCounter({
          from: baseTime,
          to: targetTime,
          duration: 420,
          ease: 'Cubic.easeOut',
          onUpdate: (tw) => {
            if (!this.scene.isActive()) return;
            this.timeLeft = tw.getValue() ?? targetTime;
            this.updateHud();
          },
          onComplete: () => {
            if (!this.scene.isActive()) return;
            this.timeLeft = targetTime;
            this.updateHud();
          },
        });
      });
    });

    // 5. Goddess ascends in light & gameplay smoothly resumes (t = 1980ms -> 2350ms)
    this.time.delayedCall(1980, () => {
      if (!this.scene.isActive()) return;
      this.tweens.add({
        targets: goddessGroup,
        y: cy - 110,
        alpha: 0,
        duration: 360,
        ease: 'Cubic.easeIn',
      });
      this.tweens.add({
        targets: [veil, beamOuter, beamInner],
        fillAlpha: 0,
        duration: 360,
        ease: 'Cubic.easeOut',
      });
      for (const obj of cleanup) {
        if (!goddessGroup.includes(obj as never) && obj !== veil && obj !== beamOuter && obj !== beamInner && 'alpha' in obj) {
          this.tweens.add({ targets: obj, alpha: 0, duration: 280 });
        }
      }
    });

    this.time.delayedCall(2360, () => {
      flapTimer.remove(false);
      for (const obj of cleanup) {
        if (obj.active) obj.destroy();
      }
      if (!this.scene.isActive()) return;
      this.timeLeft = targetTime;
      this.hero.hp = this.hero.maxHp;
      this.invulnLeft = 2.0;
      this.runEnded = false;
      this.lastMusicState = '';
      this.kit.audio.music.start();
      this.syncMusicIntensity();
      this.updateHud();
    });
  }

  private updateHud(): void {
    const h = this.hero;
    this.lvText.setText(`${this.kit.t('levelShort')} ${h.level}`);
    this.statText.setText(`ATK ${totalAtk(h)}  DEF ${totalDef(h)}`);
    this.goldText.setText(`${h.gold} ${this.kit.t('goldShort')}`);

    const hpPct = Math.max(0, Math.min(1, h.hp / h.maxHp));
    this.hpBarFill.width = 216 * hpPct;
    this.hpBarFill.fillColor = hpPct > 0.45 ? 0x22c55e : hpPct > 0.2 ? 0xfacc15 : 0xef4444;
    this.hpBarText.setText(`HP ${h.hp} / ${h.maxHp}`);
    this.heroHpFill.width = 48 * hpPct;
    this.heroHpFill.fillColor = this.hpBarFill.fillColor;

    const xpPct = Math.max(0, Math.min(1, h.xp / h.xpToNext));
    this.xpBarFill.width = 146 * xpPct;

    const urgent = this.timeLeft <= 8;
    this.timerText.setText(this.timeLeft.toFixed(1));
    this.timerText.setColor(urgent ? '#f43f5e' : '#facc15');
    this.timerBadge.setStrokeStyle(4, urgent ? 0xf43f5e : this.activeVillage ? 0x38bdf8 : 0xfacc15);
    this.pausedBanner.setText(this.activeVillage ? '⏸ TIME PAUSED' : '');

    const readyForBoss = canEasilyBeatBoss(this.hero, this.bossHp, this.bossSpec);
    if (readyForBoss && !this.bossReadyAlerted && this.mode === 'overworld') {
      this.bossReadyAlerted = true;
      this.kit.audio.sfx('medal');
      this.fx.popText(this.heroSprite.x, this.heroSprite.y - 72, this.kit.t('bossReady'), { color: 0xfacc15, size: 24 });
    }
    this.heroReadyBang.setVisible(readyForBoss && this.mode === 'overworld');

    if (this.mode === 'boss') {
      this.bossArrowText.setColor('#fda4af');
      this.bossArrowText.setText(`⚔ ${this.currentBossDisplayName()} ${this.bossHp}/${this.bossMaxHp}`);
    } else {
      const dist = Math.max(0, Math.round((CASTLE_POS.x - this.heroSprite.x) / 4));
      this.bossArrowText.setColor(readyForBoss ? '#facc15' : '#fda4af');
      this.bossArrowText.setText(readyForBoss ? `${this.kit.t('bossReady')} (${dist}m)` : `${this.kit.t('bossDir')} ▶ ${dist}m`);
    }

    const dashReady = Math.max(0, Math.min(1, 1 - this.dashCooldownLeft / h.dashCooldownMs));
    this.dashBarFill.width = (this.isMobile ? 180 : 136) * dashReady;
    this.dashBarFill.fillColor = dashReady >= 1 ? 0x38bdf8 : 0x64748b;
  }
}
