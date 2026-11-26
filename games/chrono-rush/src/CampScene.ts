import Phaser from 'phaser';
import { addButton, ensureTextures, getKit, type Kit } from '@gf/game-kit';
import { BALANCE, FEATURES } from './balance.ts';
import { BOOST_CATALOG, type BoostId } from './boosts.ts';
import { CHAPTERS, EPISODES_PER_CHAPTER, getChapterForLoop, getCycleForLoop, getLoopForCycleCell } from './chapters.ts';
import {
  ARMOR_CATALOG,
  armorAscendCost,
  effectiveArmorStats,
  effectiveShieldStats,
  effectiveWeaponStats,
  getWeaponSpec,
  SHIELD_CATALOG,
  shieldAscendCost,
  WEAPON_CATALOG,
  weaponAscendCost,
  type ArmorId,
  type ShieldId,
  type WeaponId,
} from './gear.ts';
import {
  activeShieldFor,
  ascendArmor,
  ascendShield,
  ascendWeapon,
  buyOrEquipArmor,
  buyOrEquipShield,
  buyOrEquipWeapon,
  buyUpgrade,
  canAscendArmors,
  canAscendShields,
  canAscendWeapons,
  defaultMeta,
  isBoostsUnlocked,
  resolveHeroAppearance,
  sanitizeMeta,
  selectArmorSkin,
  selectStageLoop,
  selectWeaponSkin,
  togglePreRunBoost,
  UPGRADES,
  upgradeCost,
  type MetaSave,
  type UpgradeId,
} from './meta.ts';
import { ensureHeroAppearance, ensurePixelArt } from './pixelArt.ts';
import { META_SAVE_KEY } from './PlayScene.ts';
import { createHeroStats } from './systems.ts';

type CampTab = 'upgrades' | 'armory' | 'skins' | 'stages';
const TABS: readonly CampTab[] =
  FEATURES.chapterSelect || FEATURES.preRunBoosts ? ['upgrades', 'armory', 'skins', 'stages'] : ['upgrades', 'armory', 'skins'];

export class CampScene extends Phaser.Scene {
  private kit!: Kit;
  private meta: MetaSave = defaultMeta();
  private tab: CampTab = 'upgrades';
  private stageCycle = 0;
  private resetConfirm = false;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private saving: Promise<void> = Promise.resolve();

  constructor() {
    super('Camp');
  }

  create(): void {
    this.kit = getKit(this);
    ensureTextures(this, this.kit.theme);
    ensurePixelArt(this);
    this.layer = [];

    const { width, height } = this.scale;
    const g = this.add.graphics();
    g.fillStyle(0x120a26, 1);
    g.fillRect(0, 0, width, height);
    g.fillStyle(0x1e1b4b, 0.55);
    g.fillRect(0, 0, width, 90);
    g.lineStyle(3, 0xfacc15, 0.65);
    g.lineBetween(0, 90, width, 90);

    addButton(this, 74, 45, this.kit.t('back'), {
      width: 112,
      height: 50,
      fill: 0x475569,
      fontSize: 20,
      onClick: () => {
        this.kit.audio.sfx('click');
        this.kit.goTo('GKTitle');
      },
    });

    addButton(this, width - 116, 45, this.kit.t('playAgain'), {
      width: 196,
      height: 52,
      fill: 0x16a34a,
      fontSize: 22,
      onClick: () => {
        this.kit.audio.sfx('medal');
        this.kit.start();
      },
    });

    let alive = true;
    this.events.once('shutdown', () => {
      alive = false;
    });

    void this.kit.save
      .getJSON<unknown>(META_SAVE_KEY, null)
      .then((raw) => {
        if (!alive) return;
        this.meta = sanitizeMeta(raw);
        this.stageCycle = getCycleForLoop(this.meta.loop);
        this.render();
      })
      .catch(() => {
        if (!alive) return;
        this.meta = defaultMeta();
        this.stageCycle = 0;
        this.render();
      });
  }

  private addObj<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.push(o);
    return o;
  }

  private persistMeta(next: MetaSave): void {
    this.meta = next;
    this.saving = this.saving.then(() => this.kit.save.setJSON(META_SAVE_KEY, this.meta));
    this.render();
  }

  private render(): void {
    for (const o of this.layer) o.destroy();
    this.layer = [];
    const { width } = this.scale;
    const font = this.kit.theme.font;

    // Tabs in header (compact spacing so 4 tabs, crystals & chapter title never overlap)
    TABS.forEach((id, i) => {
      const sel = this.tab === id;
      this.addObj(
        addButton(this, 206 + i * 136, 45, this.kit.t(`tab.${id}`), {
          width: 128,
          height: 48,
          fill: sel ? 0xfacc15 : 0x312e81,
          textColor: sel ? 0x13092b : 0xffffff,
          strokeThickness: sel ? 0 : 3,
          fontSize: 17,
          onClick: () => {
            if (this.tab === id) return;
            this.tab = id;
            this.resetConfirm = false;
            this.kit.audio.sfx('click');
            this.render();
          },
        }),
      );
    });

    // Balance (left of chapter title, plenty of horizontal room)
    this.addObj(this.add.image(716, 45, 'px-crystal').setScale(0.8));
    this.addObj(
      this.add
        .text(738, 45, `${this.meta.crystals}`, {
          fontFamily: font,
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#38bdf8',
          stroke: '#09050f',
          strokeThickness: 4,
        })
        .setOrigin(0, 0.5),
    );

    const stage = getChapterForLoop(this.meta.loop);
    this.addObj(
      this.add
        .text(width - 224, 45, `${this.kit.t(`chapter.${stage.chapter.id}`)} ${stage.roman}`, {
          fontFamily: font,
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#c084fc',
        })
        .setOrigin(1, 0.5),
    );

    if (this.tab === 'upgrades') this.renderUpgrades();
    else if (this.tab === 'armory') this.renderArmory();
    else if (this.tab === 'skins') this.renderSkins();
    else this.renderStagesAndBoosts();
  }

  private renderHeroPreview(): void {
    const font = this.kit.theme.font;
    const cx = 128;
    const cy = 395;

    this.addObj(this.add.rectangle(cx, cy, 206, 520, 0x1a1236, 0.94).setStrokeStyle(3, 0x475569));
    this.addObj(
      this.add
        .text(cx, cy - 224, this.kit.t('skins.preview'), {
          fontFamily: font,
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#facc15',
        })
        .setOrigin(0.5),
    );

    const { weaponLook, armorLook, shieldLook } = resolveHeroAppearance(this.meta);
    const [k0] = ensureHeroAppearance(this, weaponLook, armorLook, shieldLook);
    this.addObj(this.add.ellipse(cx, cy - 28, 96, 26, 0x000000, 0.45));
    const sprite = this.addObj(this.add.image(cx, cy - 78, k0).setScale(2.5));
    this.tweens.add({ targets: sprite, y: sprite.y - 8, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const previewStats = createHeroStats(this.meta);
    const activeShield = activeShieldFor(this.meta);
    const wHands = getWeaponSpec(this.meta.equippedWeapon).hands;
    const lines = [
      `⚔ ${this.kit.t(`weapon.${this.meta.equippedWeapon}`)} (${wHands}H)`,
      `🛡 ${this.kit.t(`armor.${this.meta.equippedArmor}`)}`,
      activeShield ? `🔰 ${this.kit.t(`shield.${activeShield}`)}` : wHands === 2 ? `🔒 ${this.kit.t('armory.locked2H')}` : `🔰 ${this.kit.t('shield.none')}`,
      '',
      `CRIT ${Math.round(previewStats.critChance * 100)}% • EVA ${Math.round(previewStats.evaChance * 100)}%`,
      `⏱ ${previewStats.runDurationSec}s`,
    ];
    this.addObj(
      this.add
        .text(cx, cy + 94, lines.join('\n'), {
          fontFamily: font,
          fontSize: '14px',
          color: '#e2e8f0',
          align: 'center',
          lineSpacing: 5,
        })
        .setOrigin(0.5),
    );

    this.addObj(
      addButton(this, cx, cy + 226, this.kit.t(this.resetConfirm ? 'camp.resetConfirm' : 'camp.resetSave'), {
        width: 172,
        height: 32,
        fill: this.resetConfirm ? 0xdc2626 : 0x334155,
        fontSize: 13,
        onClick: () => {
          if (!this.resetConfirm) {
            this.resetConfirm = true;
            this.kit.audio.sfx('click');
            this.render();
            return;
          }
          this.resetConfirm = false;
          this.stageCycle = 0;
          this.kit.audio.sfx('shieldBreak');
          this.persistMeta(defaultMeta());
        },
      }),
    );
  }

  private renderUpgrades(): void {
    const { width } = this.scale;
    const font = this.kit.theme.font;
    // Crisp 3x3 grid for all 9 Camp Talents
    const cols = 3;
    const cardW = 368;
    const cardH = 178;
    const gapX = 24;
    const gapY = 18;
    const startX = width / 2 - (cardW + gapX);
    const startY = 202;

    UPGRADES.forEach((spec, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);
      const rank = this.meta.ranks[spec.id];
      const maxed = rank >= spec.maxRank;
      const cost = maxed ? 0 : upgradeCost(spec, rank);
      const affordable = !maxed && this.meta.crystals >= cost;

      this.addObj(this.add.rectangle(cx, cy, cardW, cardH, 0x1e163b, 0.96).setStrokeStyle(3, affordable ? spec.color : 0x334155));
      this.addObj(this.add.rectangle(cx, cy - cardH / 2 + 5, cardW - 6, 8, spec.color, 0.85));
      this.addObj(
        this.add.text(cx, cy - 56, this.kit.t(`upg.${spec.id}.name`), { fontFamily: font, fontSize: '21px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5),
      );
      this.addObj(
        this.add.text(cx, cy - 26, this.kit.t(`upg.${spec.id}.desc`), { fontFamily: font, fontSize: '15px', color: '#cbd5e1' }).setOrigin(0.5),
      );

      const pipW = Math.min(20, Math.floor(240 / spec.maxRank) - 4);
      const totalPipW = spec.maxRank * (pipW + 4) - 4;
      const pipStartX = cx - totalPipW / 2 + pipW / 2;
      for (let i = 0; i < spec.maxRank; i++) {
        this.addObj(this.add.rectangle(pipStartX + i * (pipW + 4), cy + 2, pipW, 10, i < rank ? spec.color : 0x0f172a));
      }

      this.addObj(
        this.add.text(cx, cy + 22, `LV ${rank} / ${spec.maxRank}`, { fontFamily: font, fontSize: '14px', fontStyle: 'bold', color: '#94a3b8' }).setOrigin(0.5),
      );

      const btnLabel = maxed ? this.kit.t('maxed') : `💎 ${cost}`;
      this.addObj(
        addButton(this, cx, cy + 58, btnLabel, {
          width: 196,
          height: 40,
          fill: maxed ? 0x334155 : affordable ? spec.color : 0x1e293b,
          fontSize: 18,
          onClick: () => this.tryBuyUpgrade(spec.id),
        }),
      );
    });
  }

  private renderArmory(): void {
    this.renderHeroPreview();
    const font = this.kit.theme.font;

    // Row 1: Weapons (7 compact cards with 1H/2H & passive badges)
    const weaponsAscendOpen = canAscendWeapons(this.meta);
    this.addObj(
      this.add
        .text(
          252,
          112,
          `${this.kit.t('armory.weapons')}${weaponsAscendOpen ? '' : `  •  🔒 ${this.kit.t('armory.ascendLockHint')}`}`,
          { fontFamily: font, fontSize: '16px', fontStyle: 'bold', color: '#fef08a' },
        )
        .setOrigin(0, 0.5),
    );

    const cardW = 138;
    const cardH = 166;
    const gap = 8;
    const startX = 248 + cardW / 2;

    WEAPON_CATALOG.forEach((w, i) => {
      const cx = startX + i * (cardW + gap);
      const cy = 212;
      const owned = this.meta.ownedWeapons.includes(w.id);
      const equipped = this.meta.equippedWeapon === w.id;
      const hasSkin = this.meta.unlockedWeaponSkins.includes(w.id);
      const ascCost = weaponAscendCost(w.id);
      const isAscended = ascCost === 0 || this.meta.ascendedWeapons.includes(w.id);
      const canAscend = weaponsAscendOpen && owned && !isAscended;
      const canAffordAsc = canAscend && this.meta.crystals >= ascCost;
      const canBuy = !owned && this.meta.crystals >= w.unlockCost;
      const eff = effectiveWeaponStats(w.id, isAscended);

      this.addObj(
        this.add
          .rectangle(cx, cy, cardW, cardH, 0x1e163b, 0.96)
          .setStrokeStyle(3, equipped ? 0xfacc15 : isAscended && owned ? 0xa855f7 : canBuy ? 0xd97706 : 0x334155),
      );
      this.addObj(
        this.add
          .text(cx - 58, cy - 68, `${w.hands}H`, {
            fontFamily: font,
            fontSize: '12px',
            fontStyle: 'bold',
            color: w.hands === 2 ? '#fb923c' : '#38bdf8',
          })
          .setOrigin(0, 0.5),
      );
      if (hasSkin) {
        this.addObj(
          this.add.text(cx + 58, cy - 68, '★', { fontFamily: font, fontSize: '15px', fontStyle: 'bold', color: '#facc15' }).setOrigin(1, 0.5),
        );
      }
      this.addObj(this.add.rectangle(cx, cy - 66, 40, 10, Phaser.Display.Color.HexStringToColor(w.bladeColor).color).setStrokeStyle(1, 0x09050f));
      this.addObj(
        this.add
          .text(cx, cy - 44, this.kit.t(`weapon.${w.id}`), { fontFamily: font, fontSize: '13px', fontStyle: 'bold', color: '#ffffff', align: 'center' })
          .setOrigin(0.5),
      );
      this.addObj(
        this.add
          .text(cx, cy - 22, `ATK +${eff.baseAtk} (+${eff.polishAtkPerLv}/LV)`, {
            fontFamily: font,
            fontSize: '11px',
            fontStyle: 'bold',
            color: isAscended && owned ? '#e9d5ff' : '#cbd5e1',
            align: 'center',
          })
          .setOrigin(0.5),
      );
      this.addObj(
        this.add
          .text(cx, cy - 4, this.kit.t(`passive.${w.passive}`), {
            fontFamily: font,
            fontSize: '11px',
            color: '#fef08a',
            align: 'center',
          })
          .setOrigin(0.5),
      );

      const label = equipped ? this.kit.t('armory.equipped') : owned ? this.kit.t('armory.equip') : `💎 ${w.unlockCost}`;
      if (canAscend) {
        this.addObj(
          addButton(this, cx, cy + 24, label, {
            width: 118,
            height: 28,
            fill: equipped ? 0x16a34a : 0x3b82f6,
            fontSize: 13,
            onClick: () => this.tryWeapon(w.id),
          }),
        );
        this.addObj(
          addButton(this, cx, cy + 58, `↑ 💎 ${ascCost}`, {
            width: 118,
            height: 28,
            fill: canAffordAsc ? 0x9333ea : 0x1e293b,
            fontSize: 12,
            onClick: () => this.tryAscendWeapon(w.id),
          }),
        );
      } else {
        if (owned && isAscended) {
          this.addObj(
            this.add
              .text(cx, cy + 16, this.kit.t('armory.maxTier'), { fontFamily: font, fontSize: '11px', fontStyle: 'bold', color: '#c084fc' })
              .setOrigin(0.5),
          );
        }
        this.addObj(
          addButton(this, cx, cy + 50, label, {
            width: 118,
            height: 34,
            fill: equipped ? 0x16a34a : owned ? 0x3b82f6 : canBuy ? 0xd97706 : 0x1e293b,
            fontSize: 14,
            onClick: () => this.tryWeapon(w.id),
          }),
        );
      }
    });

    // Row 2: Armors (7 compact cards with unique passives & Ascension)
    const armorsAscendOpen = canAscendArmors(this.meta);
    this.addObj(
      this.add
        .text(
          252,
          318,
          `${this.kit.t('armory.armors')}${armorsAscendOpen ? '' : `  •  🔒 ${this.kit.t('armory.ascendLockHint')}`}`,
          { fontFamily: font, fontSize: '16px', fontStyle: 'bold', color: '#7dd3fc' },
        )
        .setOrigin(0, 0.5),
    );

    ARMOR_CATALOG.forEach((a, i) => {
      const cx = startX + i * (cardW + gap);
      const cy = 418;
      const owned = this.meta.ownedArmors.includes(a.id);
      const equipped = this.meta.equippedArmor === a.id;
      const hasSkin = this.meta.unlockedArmorSkins.includes(a.id);
      const ascCost = armorAscendCost(a.id);
      const isAscended = ascCost === 0 || this.meta.ascendedArmors.includes(a.id);
      const canAscend = armorsAscendOpen && owned && !isAscended;
      const canAffordAsc = canAscend && this.meta.crystals >= ascCost;
      const canBuy = !owned && this.meta.crystals >= a.unlockCost;
      const eff = effectiveArmorStats(a.id, isAscended);

      this.addObj(
        this.add
          .rectangle(cx, cy, cardW, cardH, 0x1e163b, 0.96)
          .setStrokeStyle(3, equipped ? 0x38bdf8 : isAscended && owned ? 0xa855f7 : canBuy ? 0x0284c7 : 0x334155),
      );
      if (hasSkin) {
        this.addObj(
          this.add.text(cx + 58, cy - 68, '★', { fontFamily: font, fontSize: '15px', fontStyle: 'bold', color: '#facc15' }).setOrigin(1, 0.5),
        );
      }
      this.addObj(this.add.rectangle(cx - 12, cy - 66, 20, 12, Phaser.Display.Color.HexStringToColor(a.tunicColor).color).setStrokeStyle(1, 0x09050f));
      this.addObj(this.add.rectangle(cx + 12, cy - 66, 20, 12, Phaser.Display.Color.HexStringToColor(a.capeColor).color).setStrokeStyle(1, 0x09050f));
      this.addObj(
        this.add
          .text(cx, cy - 44, this.kit.t(`armor.${a.id}`), { fontFamily: font, fontSize: '13px', fontStyle: 'bold', color: '#ffffff', align: 'center' })
          .setOrigin(0.5),
      );
      this.addObj(
        this.add
          .text(cx, cy - 22, `DEF +${eff.baseDef} HP +${eff.baseHp}`, {
            fontFamily: font,
            fontSize: '11px',
            fontStyle: 'bold',
            color: isAscended && owned ? '#e9d5ff' : '#cbd5e1',
            align: 'center',
          })
          .setOrigin(0.5),
      );
      this.addObj(
        this.add
          .text(cx, cy - 4, this.kit.t(`armorPassive.${a.passive}`), {
            fontFamily: font,
            fontSize: '11px',
            color: '#7dd3fc',
            align: 'center',
          })
          .setOrigin(0.5),
      );

      const label = equipped ? this.kit.t('armory.equipped') : owned ? this.kit.t('armory.equip') : `💎 ${a.unlockCost}`;
      if (canAscend) {
        this.addObj(
          addButton(this, cx, cy + 24, label, {
            width: 118,
            height: 28,
            fill: equipped ? 0x16a34a : 0x0284c7,
            fontSize: 13,
            onClick: () => this.tryArmor(a.id),
          }),
        );
        this.addObj(
          addButton(this, cx, cy + 58, `↑ 💎 ${ascCost}`, {
            width: 118,
            height: 28,
            fill: canAffordAsc ? 0x9333ea : 0x1e293b,
            fontSize: 12,
            onClick: () => this.tryAscendArmor(a.id),
          }),
        );
      } else {
        if (owned && isAscended) {
          this.addObj(
            this.add
              .text(cx, cy + 16, this.kit.t('armory.maxTier'), { fontFamily: font, fontSize: '11px', fontStyle: 'bold', color: '#c084fc' })
              .setOrigin(0.5),
          );
        }
        this.addObj(
          addButton(this, cx, cy + 50, label, {
            width: 118,
            height: 34,
            fill: equipped ? 0x16a34a : owned ? 0x0284c7 : canBuy ? 0x0284c7 : 0x1e293b,
            fontSize: 14,
            onClick: () => this.tryArmor(a.id),
          }),
        );
      }
    });

    // Row 3: Off-hand Shields (Active when 1H Weapon equipped!)
    const is2H = getWeaponSpec(this.meta.equippedWeapon).hands === 2;
    const shieldsAscendOpen = canAscendShields(this.meta);
    this.addObj(
      this.add
        .text(
          252,
          524,
          `${this.kit.t('armory.shields')}${is2H ? `  •  🔒 ${this.kit.t('armory.locked2H')}` : shieldsAscendOpen ? '' : `  •  🔒 ${this.kit.t('armory.ascendLockHint')}`}`,
          { fontFamily: font, fontSize: '16px', fontStyle: 'bold', color: is2H ? '#fb923c' : '#34d399' },
        )
        .setOrigin(0, 0.5),
    );

    const sCardW = 246;
    const sCardH = 128;
    const sGap = 10;
    const sStartX = 248 + sCardW / 2;

    SHIELD_CATALOG.forEach((s, i) => {
      const cx = sStartX + i * (sCardW + sGap);
      const cy = 608;
      const owned = this.meta.ownedShields.includes(s.id);
      const equipped = this.meta.equippedShield === s.id;
      const activeEquipped = equipped && !is2H;
      const ascCost = shieldAscendCost(s.id);
      const isAscended = ascCost === 0 || this.meta.ascendedShields.includes(s.id);
      const canAscend = shieldsAscendOpen && owned && !isAscended;
      const canAffordAsc = canAscend && this.meta.crystals >= ascCost;
      const canBuy = !owned && this.meta.crystals >= s.unlockCost;
      const eff = effectiveShieldStats(s.id, isAscended);

      this.addObj(
        this.add
          .rectangle(cx, cy, sCardW, sCardH, 0x1e163b, is2H ? 0.55 : 0.96)
          .setStrokeStyle(3, activeEquipped ? 0x34d399 : isAscended && owned ? 0xa855f7 : canBuy ? 0x059669 : 0x334155),
      );
      this.addObj(
        this.add
          .rectangle(cx - 94, cy - 38, 22, 22, Phaser.Display.Color.HexStringToColor(s.mainColor).color)
          .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(s.rimColor).color),
      );
      this.addObj(
        this.add
          .text(cx - 72, cy - 38, this.kit.t(`shield.${s.id}`), { fontFamily: font, fontSize: '15px', fontStyle: 'bold', color: '#ffffff' })
          .setOrigin(0, 0.5),
      );
      if (owned && isAscended) {
        this.addObj(
          this.add
            .text(cx + 112, cy - 38, '✦ MAX', { fontFamily: font, fontSize: '11px', fontStyle: 'bold', color: '#c084fc' })
            .setOrigin(1, 0.5),
        );
      }
      this.addObj(
        this.add
          .text(cx, cy - 16, `DEF +${eff.defBonus}  HP +${eff.hpBonus}`, {
            fontFamily: font,
            fontSize: '12px',
            fontStyle: 'bold',
            color: isAscended && owned ? '#e9d5ff' : '#cbd5e1',
          })
          .setOrigin(0.5),
      );
      this.addObj(
        this.add
          .text(cx, cy + 2, this.kit.t(`shieldPassive.${s.passive}`), {
            fontFamily: font,
            fontSize: '11px',
            color: '#6ee7b7',
          })
          .setOrigin(0.5),
      );

      const label = activeEquipped
        ? this.kit.t('armory.equipped')
        : equipped && is2H
          ? `🔒 ${this.kit.t('armory.locked2H')}`
          : owned
            ? this.kit.t('armory.equip')
            : `💎 ${s.unlockCost}`;
      const btnFill = activeEquipped
        ? 0x16a34a
        : is2H && owned
          ? 0x475569
          : owned
            ? 0x059669
            : canBuy
              ? 0x059669
              : 0x1e293b;
      if (canAscend) {
        this.addObj(
          addButton(this, cx - 56, cy + 36, label, {
            width: 106,
            height: 34,
            fill: btnFill,
            fontSize: 12,
            onClick: () => this.tryShield(s.id),
          }),
        );
        this.addObj(
          addButton(this, cx + 56, cy + 36, `↑ 💎 ${ascCost}`, {
            width: 106,
            height: 34,
            fill: canAffordAsc ? 0x9333ea : 0x1e293b,
            fontSize: 13,
            onClick: () => this.tryAscendShield(s.id),
          }),
        );
      } else {
        this.addObj(
          addButton(this, cx, cy + 36, label, {
            width: 152,
            height: 34,
            fill: btnFill,
            fontSize: 13,
            onClick: () => this.tryShield(s.id),
          }),
        );
      }
    });
  }

  private renderSkins(): void {
    this.renderHeroPreview();
    const font = this.kit.theme.font;

    const atkBonus = Math.round(this.meta.unlockedWeaponSkins.length * BALANCE.weaponSkinAtkPct * 100);
    const defBonus = Math.round(this.meta.unlockedArmorSkins.length * BALANCE.armorSkinDefHpPct * 100);
    this.addObj(
      this.add
        .text(
          255,
          118,
          `${this.kit.t('skins.weapons')}   •   ${this.kit.t('skins.bonus')}: ATK +${atkBonus}%  DEF/HP +${defBonus}%`,
          { fontFamily: font, fontSize: '19px', fontStyle: 'bold', color: '#fef08a' },
        )
        .setOrigin(0, 0.5),
    );

    const cardW = 120;
    const cardH = 210;
    const gap = 7;
    const startX = 248 + cardW / 2;

    const weaponOptions: Array<WeaponId | null> = [null, ...WEAPON_CATALOG.map((w) => w.id)];
    weaponOptions.forEach((id, i) => {
      const cx = startX + i * (cardW + gap);
      const cy = 248;
      const unlocked = id === null || this.meta.unlockedWeaponSkins.includes(id);
      const selected = this.meta.equippedWeaponSkin === id;

      this.addObj(
        this.add
          .rectangle(cx, cy, cardW, cardH, 0x1e163b, unlocked ? 0.96 : 0.55)
          .setStrokeStyle(3, selected ? 0xfacc15 : unlocked ? 0x475569 : 0x1e293b),
      );
      if (id !== null) {
        const w = WEAPON_CATALOG.find((x) => x.id === id)!;
        this.addObj(this.add.rectangle(cx, cy - 66, 44, 14, Phaser.Display.Color.HexStringToColor(w.bladeColor).color).setAlpha(unlocked ? 1 : 0.35));
      }
      const title = id === null ? this.kit.t('skins.matchGear') : this.kit.t(`weapon.${id}`);
      this.addObj(
        this.add
          .text(cx, cy - 22, title, { fontFamily: font, fontSize: '14px', fontStyle: 'bold', color: unlocked ? '#ffffff' : '#64748b', align: 'center', wordWrap: { width: 110 } })
          .setOrigin(0.5),
      );

      const btnLabel = selected ? this.kit.t('armory.equipped') : unlocked ? this.kit.t('armory.equip') : '🔒 LV 5';
      this.addObj(
        addButton(this, cx, cy + 62, btnLabel, {
          width: 104,
          height: 40,
          fill: selected ? 0x16a34a : unlocked ? 0xd97706 : 0x1e293b,
          fontSize: 13,
          onClick: () => {
            const next = selectWeaponSkin(this.meta, id);
            if (!next) {
              this.kit.audio.sfx('click');
              return;
            }
            this.kit.audio.sfx('medal');
            this.persistMeta(next);
          },
        }),
      );
    });

    // Armor Skins Row (Match Gear + 7 Armor Skins)
    this.addObj(
      this.add
        .text(255, 396, this.kit.t('skins.armors'), { fontFamily: font, fontSize: '20px', fontStyle: 'bold', color: '#7dd3fc' })
        .setOrigin(0, 0.5),
    );

    const armorOptions: Array<ArmorId | null> = [null, ...ARMOR_CATALOG.map((a) => a.id)];
    armorOptions.forEach((id, i) => {
      const cx = startX + i * (cardW + gap);
      const cy = 530;
      const unlocked = id === null || this.meta.unlockedArmorSkins.includes(id);
      const selected = this.meta.equippedArmorSkin === id;

      this.addObj(
        this.add
          .rectangle(cx, cy, cardW, cardH, 0x1e163b, unlocked ? 0.96 : 0.55)
          .setStrokeStyle(3, selected ? 0x38bdf8 : unlocked ? 0x475569 : 0x1e293b),
      );
      if (id !== null) {
        const a = ARMOR_CATALOG.find((x) => x.id === id)!;
        this.addObj(this.add.rectangle(cx - 12, cy - 66, 20, 14, Phaser.Display.Color.HexStringToColor(a.tunicColor).color).setAlpha(unlocked ? 1 : 0.35));
        this.addObj(this.add.rectangle(cx + 12, cy - 66, 20, 14, Phaser.Display.Color.HexStringToColor(a.capeColor).color).setAlpha(unlocked ? 1 : 0.35));
      }
      const title = id === null ? this.kit.t('skins.matchGear') : this.kit.t(`armor.${id}`);
      this.addObj(
        this.add
          .text(cx, cy - 22, title, { fontFamily: font, fontSize: '14px', fontStyle: 'bold', color: unlocked ? '#ffffff' : '#64748b', align: 'center', wordWrap: { width: 110 } })
          .setOrigin(0.5),
      );

      const btnLabel = selected ? this.kit.t('armory.equipped') : unlocked ? this.kit.t('armory.equip') : '🔒 LV 5';
      this.addObj(
        addButton(this, cx, cy + 62, btnLabel, {
          width: 104,
          height: 40,
          fill: selected ? 0x16a34a : unlocked ? 0x0284c7 : 0x1e293b,
          fontSize: 13,
          onClick: () => {
            const next = selectArmorSkin(this.meta, id);
            if (!next) {
              this.kit.audio.sfx('click');
              return;
            }
            this.kit.audio.sfx('medal');
            this.persistMeta(next);
          },
        }),
      );
    });
  }

  private renderStagesAndBoosts(): void {
    const font = this.kit.theme.font;

    // Top section: Chapter & Episode Selector with S/A/B Speedrun Medals (supports infinite Cycles)
    if (FEATURES.chapterSelect) {
      const maxCycle = getCycleForLoop(this.meta.maxUnlockedLoop);
      this.stageCycle = Phaser.Math.Clamp(this.stageCycle, 0, maxCycle);
      const firstCh = this.stageCycle * CHAPTERS.length + 1;
      const lastCh = firstCh + CHAPTERS.length - 1;

      this.addObj(
        this.add
          .text(48, 120, this.kit.t('stages.title'), { fontFamily: font, fontSize: '20px', fontStyle: 'bold', color: '#fef08a' })
          .setOrigin(0, 0.5),
      );

      // Cycle pager (right-aligned with the 5th stage column at x=1179)
      const canPrev = this.stageCycle > 0;
      const canNext = this.stageCycle < maxCycle;
      const badgeCx = 1039;
      this.addObj(
        this.add
          .rectangle(badgeCx, 120, 190, 34, 0x1e163b, 0.96)
          .setStrokeStyle(2, maxCycle > 0 ? 0xfacc15 : 0x475569),
      );
      this.addObj(
        this.add
          .text(badgeCx, 120, `${this.kit.t('stages.cycle')} ${this.stageCycle + 1}/${maxCycle + 1} • CH.${firstCh}–${lastCh}`, {
            fontFamily: font,
            fontSize: '14px',
            fontStyle: 'bold',
            color: maxCycle > 0 ? '#fef08a' : '#94a3b8',
          })
          .setOrigin(0.5),
      );

      this.addObj(
        addButton(this, 919, 120, '◀', {
          width: 40,
          height: 34,
          fill: canPrev ? 0x4338ca : 0x1e293b,
          fontSize: 16,
          onClick: () => {
            if (!canPrev) {
              this.kit.audio.sfx('click');
              return;
            }
            this.stageCycle -= 1;
            this.kit.audio.sfx('click');
            this.render();
          },
        }),
      );
      this.addObj(
        addButton(this, 1159, 120, '▶', {
          width: 40,
          height: 34,
          fill: canNext ? 0x4338ca : 0x1e293b,
          fontSize: 16,
          onClick: () => {
            if (!canNext) {
              this.kit.audio.sfx('click');
              return;
            }
            this.stageCycle += 1;
            this.kit.audio.sfx('click');
            this.render();
          },
        }),
      );

      CHAPTERS.forEach((ch, chIdx) => {
        const rowY = 164 + chIdx * 62;
        const chapterNum = this.stageCycle * CHAPTERS.length + chIdx + 1;
        this.addObj(
          this.add
            .text(48, rowY, `CH.${chapterNum}  ${this.kit.t(`chapter.${ch.id}`)}`, {
              fontFamily: font,
              fontSize: '18px',
              fontStyle: 'bold',
              color: '#e2e8f0',
            })
            .setOrigin(0, 0.5),
        );

        for (let ep = 1; ep <= EPISODES_PER_CHAPTER; ep++) {
          const loopNum = getLoopForCycleCell(this.stageCycle, chIdx, ep);
          const unlocked = loopNum <= this.meta.maxUnlockedLoop;
          const selected = loopNum === this.meta.loop;
          const rec = this.meta.stageRecords[String(loopNum)];
          const info = getChapterForLoop(loopNum);
          const bx = 430 + (ep - 1) * 168;

          const medalTxt = rec ? `★${rec.medal} ${rec.bestTimeLeft.toFixed(1)}s` : unlocked ? 'OPEN' : '🔒';
          const sep = info.roman.length >= 4 ? ' ' : '  ';
          const btnText = `${info.roman}${sep}${medalTxt}`;
          const fill = selected ? 0xd97706 : rec?.medal === 'S' ? 0x15803d : unlocked ? 0x312e81 : 0x1e293b;

          this.addObj(
            addButton(this, bx, rowY, btnText, {
              width: 154,
              height: 48,
              fill,
              fontSize: 14,
              onClick: () => {
                if (!unlocked) {
                  this.kit.audio.sfx('click');
                  return;
                }
                const next = selectStageLoop(this.meta, loopNum);
                if (!next) {
                  this.kit.audio.sfx('click');
                  return;
                }
                this.kit.audio.sfx('medal');
                this.persistMeta(next);
              },
            }),
          );
        }
      });
    }

    // Bottom section: Pre-Run Crystal Boosts (Unlocked at Hard Mode / Loop 26+)
    if (FEATURES.preRunBoosts) {
      const boostsUnlocked = isBoostsUnlocked(this.meta);
      this.addObj(
        this.add
          .text(48, 468, this.kit.t('stages.boosts'), {
            fontFamily: font,
            fontSize: '20px',
            fontStyle: 'bold',
            color: boostsUnlocked ? '#38bdf8' : '#94a3b8',
          })
          .setOrigin(0, 0.5),
      );

      if (!boostsUnlocked) {
        this.addObj(
          this.add
            .rectangle(614, 584, 1132, 160, 0x1a1236, 0.85)
            .setStrokeStyle(3, 0x475569),
        );
        this.addObj(
          this.add
            .text(614, 584, this.kit.t('stages.boostsLocked'), {
              fontFamily: font,
              fontSize: '21px',
              fontStyle: 'bold',
              color: '#fef08a',
              align: 'center',
            })
            .setOrigin(0.5),
        );
      } else {
        const cardW = 280;
        const cardH = 176;
        const gap = 20;
        const startX = 48 + cardW / 2;

        BOOST_CATALOG.forEach((b, i) => {
          const cx = startX + i * (cardW + gap);
          const cy = 584;
          const armed = this.meta.activeBoosts.includes(b.id);
          const affordable = !armed && this.meta.crystals >= b.cost;

          this.addObj(
            this.add
              .rectangle(cx, cy, cardW, cardH, 0x1e163b, 0.96)
              .setStrokeStyle(3, armed ? 0x22c55e : affordable ? b.color : 0x334155),
          );
          this.addObj(this.add.rectangle(cx, cy - cardH / 2 + 5, cardW - 6, 8, b.color, 0.85));
          this.addObj(
            this.add
              .text(cx, cy - 48, `${b.icon} ${this.kit.t(`boost.${b.id}.name`)}`, {
                fontFamily: font,
                fontSize: '20px',
                fontStyle: 'bold',
                color: '#ffffff',
              })
              .setOrigin(0.5),
          );
          this.addObj(
            this.add
              .text(cx, cy - 12, this.kit.t(`boost.${b.id}.desc`), {
                fontFamily: font,
                fontSize: '14px',
                color: '#cbd5e1',
                align: 'center',
              })
              .setOrigin(0.5),
          );

          const label = armed ? `✓ ${this.kit.t('stages.armed')}` : `💎 ${b.cost}`;
          this.addObj(
            addButton(this, cx, cy + 46, label, {
              width: 184,
              height: 44,
              fill: armed ? 0x16a34a : affordable ? b.color : 0x1e293b,
              fontSize: 18,
              onClick: () => this.tryBoost(b.id),
            }),
          );
        });
      }
    }
  }

  private tryBoost(id: BoostId): void {
    const wasArmed = this.meta.activeBoosts.includes(id);
    const next = togglePreRunBoost(this.meta, id);
    if (!next) {
      this.kit.audio.sfx('click');
      return;
    }
    this.kit.audio.sfx(wasArmed ? 'click' : 'medal');
    this.persistMeta(next);
  }

  private tryBuyUpgrade(id: UpgradeId): void {
    const next = buyUpgrade(this.meta, id);
    if (!next) {
      this.kit.audio.sfx('click');
      return;
    }
    this.kit.audio.sfx('medal');
    this.persistMeta(next);
  }

  private tryWeapon(id: WeaponId): void {
    const next = buyOrEquipWeapon(this.meta, id);
    if (!next) {
      this.kit.audio.sfx('click');
      return;
    }
    this.kit.audio.sfx('medal');
    this.persistMeta(next);
  }

  private tryArmor(id: ArmorId): void {
    const next = buyOrEquipArmor(this.meta, id);
    if (!next) {
      this.kit.audio.sfx('click');
      return;
    }
    this.kit.audio.sfx('medal');
    this.persistMeta(next);
  }

  private tryShield(id: ShieldId): void {
    const next = buyOrEquipShield(this.meta, id);
    if (!next) {
      this.kit.audio.sfx('click');
      return;
    }
    this.kit.audio.sfx('medal');
    this.persistMeta(next);
  }

  private tryAscendWeapon(id: WeaponId): void {
    const next = ascendWeapon(this.meta, id);
    if (!next) {
      this.kit.audio.sfx('click');
      return;
    }
    this.kit.audio.sfx('medal');
    this.persistMeta(next);
  }

  private tryAscendArmor(id: ArmorId): void {
    const next = ascendArmor(this.meta, id);
    if (!next) {
      this.kit.audio.sfx('click');
      return;
    }
    this.kit.audio.sfx('medal');
    this.persistMeta(next);
  }

  private tryAscendShield(id: ShieldId): void {
    const next = ascendShield(this.meta, id);
    if (!next) {
      this.kit.audio.sfx('click');
      return;
    }
    this.kit.audio.sfx('medal');
    this.persistMeta(next);
  }
}
