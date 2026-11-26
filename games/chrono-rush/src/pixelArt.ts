import Phaser from 'phaser';
import type { ChapterDef } from './chapters.ts';
import { getArmorSpec, getShieldSpec, getWeaponSpec, type ArmorHelm, type ArmorId, type ShieldId, type WeaponId, type WeaponShape } from './gear.ts';

type Palette = Record<string, string>;

function drawPixelTexture(scene: Phaser.Scene, key: string, grid: readonly string[], palette: Palette, scale = 4): void {
  if (scene.textures.exists(key)) return;
  const rows = grid.length;
  const cols = grid[0].length;
  const tex = scene.textures.createCanvas(key, cols * scale, rows * scale);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < rows; y++) {
    const row = grid[y];
    for (let x = 0; x < cols; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  tex.refresh();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

const HERO_PALETTE: Palette = {
  K: '#120d1d', // outline
  H: '#ffd94a', // golden hair / crown
  h: '#d99a1e', // hair shade
  S: '#ffcca8', // skin
  B: '#2563eb', // tunic blue
  b: '#1d4ed8', // tunic dark
  R: '#ef4444', // red cape
  r: '#b91c1c', // cape dark
  W: '#f8fafc', // sword blade
  G: '#94a3b8', // sword edge
  Y: '#facc15', // hilt gold
  D: '#5c3a21', // boots
};

const HERO_0 = [
  '.....KKKKK......',
  '....KHHHHHK.....',
  '...KHHHHHHhK....',
  '...KSSKSSKSK..KW',
  '...KSSSSSSSK.KWG',
  '..KRKBBBBBK.KWG.',
  '.KRRKBBYBBKKWG..',
  '.KRrKBBBBBYK....',
  '.KrrKbbbbbK.....',
  '..KKKbb.bbK.....',
  '....KDD.DDK.....',
  '....KKK.KKK.....',
];

const HERO_1 = [
  '................',
  '.....KKKKK......',
  '....KHHHHHK...KW',
  '...KHHHHHHhK.KWG',
  '...KSSKSSKSKKWG.',
  '...KSSSSSSSKWG..',
  '.KRRKBBBBBYK....',
  'KRRrKBBYBBK.....',
  '.KrrKbbbbbK.....',
  '..KKKbb..bbK....',
  '...KDDK..KDDK...',
  '...KKK....KKK...',
];

const SLIME_PALETTE: Palette = {
  K: '#0f291e',
  G: '#22c55e',
  L: '#86efac',
  D: '#15803d',
  W: '#ffffff',
};

const SLIME_0 = [
  '................',
  '.....KKKKKK.....',
  '...KKGGGGGGKK...',
  '..KGGLLGGGGGGK..',
  '.KGGLWGGGGGGGGK.',
  '.KGGGGKGGGKGGGK.',
  'KGGGGGKGGGKGGGGK',
  'KGGGGGGGGGGGGGGK',
  'KGDDDDDDDDDDDDGK',
  '.KKKKKKKKKKKKKK.',
];

const SLIME_1 = [
  '................',
  '................',
  '....KKKKKKKK....',
  '..KKGGGGGGGGKK..',
  '.KGGLLGGGGGGGGK.',
  'KGGLWGGKGGGKGGGK',
  'KGGGGGGKGGGKGGGK',
  'KGDDDDDDDDDDDDGK',
  'KKKKKKKKKKKKKKKK',
  '................',
];

const GOBLIN_PALETTE: Palette = {
  K: '#141118',
  G: '#4ade80',
  g: '#16a34a',
  R: '#ef4444',
  L: '#92400e',
  l: '#78350f',
  W: '#cbd5e1',
  B: '#713f12',
};

const GOBLIN_0 = [
  '....KKKKKK...KW.',
  'K..KGGGGGGK..KWW',
  'KKKGGGRGGRGK..KB',
  '.KKGggggggGK..KB',
  '...KLLLLLLK..KB.',
  '..KGLlLLlLGKKB..',
  '..K.KLLLLK.KB...',
  '....KllllK......',
  '...Kgg..ggK.....',
  '...KKK..KKK.....',
];

const GOBLIN_1 = [
  '.............KW.',
  '....KKKKKK...KWW',
  'K..KGGGGGGK..KB.',
  'KKKGGGRGGRGKKB..',
  '.KKGggggggGKB...',
  '..KGLLLLLLKK....',
  '..K.KLlLLK......',
  '...KllllllK.....',
  '..KggK..KggK....',
  '..KKK....KKK....',
];

const SKELETON_PALETTE: Palette = {
  K: '#0e0b16',
  W: '#f1f5f9',
  G: '#94a3b8',
  R: '#f43f5e',
  C: '#991b1b',
  S: '#e2e8f0',
  B: '#334155',
};

const SKELETON_0 = [
  '....KKKKKK....KS',
  '...KWWWWWWK..KSG',
  '...KWRWWRWK.KSG.',
  '...KWWKKWWKKSG..',
  '..KCKBBBBBKGG...',
  '.KCCKBWWWBK.....',
  '.KCCKBBBBBK.....',
  '..KKKGG.GGK.....',
  '....KWW.WWK.....',
  '....KKK.KKK.....',
];

const SKELETON_1 = [
  '..............KS',
  '....KKKKKK...KSG',
  '...KWWWWWWK.KSG.',
  '...KWRWWRWKKSG..',
  '...KWWKKWWKGG...',
  '.KCCKBBBBBK.....',
  'KCCCKBWWWBK.....',
  '..KKKGG..GGK....',
  '...KWWK..KWWK...',
  '...KKK....KKK...',
];

const DEMON_PALETTE: Palette = {
  K: '#09050f',
  P: '#7e22ce', // purple armor
  p: '#4c1d95', // dark purple
  R: '#ef4444', // crimson glow
  O: '#fb923c', // flame orange
  Y: '#facc15', // crown / fire core
  H: '#e2e8f0', // horns
  C: '#991b1b', // cape
  S: '#1e1b4b', // body dark
};

const DEMON_0 = [
  '.KK..........KK..KO',
  'KHHK..KKKK..KHHKKOY',
  '.KHHKKYYYYKKHHKKOYR',
  '..KKKPPPPPPKKKKOYR.',
  '...KPPRKKRPPKKOYR..',
  '..KCKPPPPPPPKOYR...',
  '.KCCKPPYYPPPKYR....',
  'KCCCKpPPPPpPKK.....',
  'KCCCKpSSSSpPK......',
  '.KCCKPPPPPPPK......',
  '..KKKpp..ppK.......',
  '...KPPK..KPPK......',
  '...KKK....KKK......',
];

const DEMON_1 = [
  '.................KO',
  '.KK..........KK.KOY',
  'KHHK..KKKK..KHHKOYR',
  '.KHHKKYYYYKKHHKOYR.',
  '..KKKPPRRPPKKKKYR..',
  '.KCCKPPPPPPPKKK....',
  'KCCCKPPYYPPPK......',
  'KCCCKpPPPPpPK......',
  '.KCCKpSSSSpPK......',
  '..KKKpp..ppK.......',
  '..KPPK....KPPK.....',
  '..KKK......KKK.....',
  '................... ',
].map((r) => r.trimEnd().padEnd(19, '.'));

const VILLAGE_PALETTE: Palette = {
  K: '#1c1218',
  R: '#dc2626',
  r: '#991b1b',
  W: '#fef3c7',
  w: '#d6bfa0',
  Y: '#fde047',
  D: '#78350f',
  G: '#22c55e',
};

const VILLAGE_GRID = [
  '.......KK.......',
  '.....KKRRKK.....',
  '...KKRRRRRRKK...',
  '.KKRRrRRRRrRRKK.',
  'KRRRRRRRRRRRRRRK',
  'KKKKKKKKKKKKKKKK',
  '.KWWWWWWWWWWWWK.',
  '.KWWYYWDDWYYWWK.',
  '.KWWYYWDDWYYWWK.',
  '.KwwwwWDDWwwwwK.',
  'GGKKKKKKKKKKKKGG',
];

const CASTLE_PALETTE: Palette = {
  K: '#090612',
  S: '#312e81',
  s: '#1e1b4b',
  L: '#6366f1',
  R: '#ef4444',
  O: '#f97316',
  Y: '#facc15',
};

const CASTLE_GRID = [
  'KK.KK......KK.KK',
  'KSSSK..KK..KSSSK',
  'KSLSK.KRRK.KSLSK',
  'KSSSKKKSSKKKSSSK',
  'KsSSsSSSSSSsSSsK',
  'KSSSLSSSSSSLSSSK',
  'KSSSSKKRRKKSSSSK',
  'KsSSKROYYORKSSsK',
  'KSSSKROYYORKSSSK',
  'KSSSKRRRRRRKSSSK',
  'KKKKKKKKKKKKKKKK',
];

const TREE_PALETTE_GREEN: Palette = {
  K: '#0c1f14',
  G: '#16a34a',
  L: '#4ade80',
  D: '#14532d',
  T: '#78350f',
};

const TREE_PALETTE_DARK: Palette = {
  K: '#0a0f18',
  G: '#0f766e',
  L: '#2dd4bf',
  D: '#134e4a',
  T: '#451a03',
};

const TREE_GRID = [
  '....KKKK....',
  '..KKLLLLKK..',
  '.KLLGGGGGGK.',
  'KLGGGGGGGGDK',
  'KGGGGGGDDDDK',
  '.KDDDDDDDDK.',
  '..KKKTTKKK..',
  '....KTTK....',
  '....KKKK....',
];

const ROCK_PALETTE: Palette = {
  K: '#18181b',
  G: '#52525b',
  L: '#a1a1aa',
  D: '#27272a',
  R: '#ef4444',
};

const ROCK_GRID = [
  '....KKKK....',
  '..KKLLLLKK..',
  '.KLGGGGGGGK.',
  'KGGGRRGGGGDK',
  'KGGDDDDDDDDK',
  'KKKKKKKKKKKK',
];

const CRYSTAL_PALETTE: Palette = {
  K: '#1e1b4b',
  C: '#38bdf8',
  L: '#bae6fd',
  D: '#0284c7',
  W: '#ffffff',
};

const CRYSTAL_GRID = [
  '...KK...',
  '..KLLK..',
  '.KLWCCK.',
  'KLCCCCDK',
  'KCCCCDDK',
  '.KCCDDK.',
  '..KDDK..',
  '...KK...',
];

const COIN_PALETTE: Palette = {
  K: '#422006',
  Y: '#facc15',
  L: '#fef08a',
  D: '#ca8a04',
};

const COIN_GRID = [
  '..KKKK..',
  '.KLYYYK.',
  'KLYDYYDK',
  'KLYDYYDK',
  '.KYYDDK.',
  '..KKKK..',
];

const FROST_LICH_PALETTE: Palette = {
  K: '#061224',
  I: '#bae6fd', // bright ice
  C: '#38bdf8', // cyan crystal
  B: '#0284c7', // deep blue
  D: '#0f172a', // dark robe
  W: '#ffffff', // skull / highlight
  E: '#22d3ee', // glowing eyes
};

const FROST_LICH_0 = [
  '....K.K...K.K....KI',
  '...KICK.K.KICK..KIC',
  '...KIIKKIKKIIK.KICE',
  '....KKWWWWWKK..KIB.',
  '....KWEKWKEWK.KIB..',
  '...KCKWWWWWKCKIB...',
  '..KCCKBBBBBKCCK....',
  '.KCCKBBIIIBBKCK....',
  '.KBCKDDDDDDDKBK....',
  '..KKKDDCCDDDK......',
  '...KDDD..DDDK......',
  '...KBBK..KBBK......',
  '...KKK....KKK......',
];

const FROST_LICH_1 = [
  '.................KI',
  '....K.K...K.K...KIC',
  '...KICK.K.KICK.KICE',
  '...KIIKKIKKIIK.KIB.',
  '....KKWWWWWKK.KIB..',
  '...KCKWEKWEWKCKB...',
  '..KCCKBBBBBKCCK....',
  '.KCCKBBIIIBBKCK....',
  '..KCKDDDDDDDKBK....',
  '...KKDDCCDDDK......',
  '..KDDDK..KDDDK.....',
  '..KBBK....KBBK.....',
  '..KKK......KKK.....',
];

const INFERNO_TITAN_PALETTE: Palette = {
  K: '#0f0505',
  O: '#f97316', // magma orange
  Y: '#fde047', // molten yellow
  R: '#dc2626', // fire red
  D: '#292524', // volcanic rock
  S: '#57534e', // stone shade
  W: '#fef9c3', // white hot
};

const INFERNO_TITAN_0 = [
  'KK..........KK...KY',
  'KOYK..KKKK..KOYKKYO',
  '.KOYKDDDDDDKOYKKYOR',
  '..KKDDYKKYDDKKKYOR.',
  '..KDDDRKKRDDDKYOR..',
  '.KDDKDDWWDDKDDKR...',
  'KDDKDOOYYOODKDDK...',
  'KSDKDRROORRDKDSK...',
  '.KKKDDDDDDDDKKK....',
  '...KDDDOODDDK......',
  '...KDDK..KDDK......',
  '..KRRK....KRRK.....',
  '..KKK......KKK.....',
];

const INFERNO_TITAN_1 = [
  '.................KY',
  'KK..........KK..KYO',
  'KOYK..KKKK..KOYKYOR',
  '.KOYKDDDDDDKOYKYOR.',
  '..KKDDYKKYDDKKKRR..',
  '.KDDKDDWWDDKDDK....',
  'KDDKDOOYYOODKDDK...',
  'KSDKDRROORRDKDSK...',
  '..KKDDDDDDDDKK.....',
  '...KDDDOODDDK......',
  '..KDDK....KDDK.....',
  '..KRRK....KRRK.....',
  '..KKK......KKK.....',
];

const TREE_SNOW_PALETTE: Palette = {
  K: '#0c1a2e',
  G: '#0284c7',
  L: '#e0f2fe',
  D: '#1e3a8a',
  T: '#57534e',
};

const ICE_CRYSTAL_PALETTE: Palette = {
  K: '#082f49',
  L: '#e0f2fe',
  C: '#38bdf8',
  D: '#0284c7',
  W: '#ffffff',
};

const ICE_CRYSTAL_GRID = [
  '.....KK.....',
  '....KWLK....',
  '...KWLCCK...',
  '..KLLCCCCK..',
  '.KLCCWCCDDK.',
  'KLCCCCCCDDDK',
  'KCCDDDDDDDDK',
  '.KKKKKKKKKK.',
];

const MAGMA_PILLAR_PALETTE: Palette = {
  K: '#1c0a0a',
  D: '#44403c',
  S: '#292524',
  O: '#f97316',
  Y: '#fde047',
};

const MAGMA_PILLAR_GRID = [
  '..KKKKKKKK..',
  '.KDDDOODDDK.',
  '.KDSOYYOSDK.',
  '.KDDOOODDDK.',
  '.KDSDDDDOSK.',
  '.KDDDOOYDDK.',
  'KDDDDDDDDDDK',
  'KKKKKKKKKKKK',
];

function drawHeroBodyAndGear(
  ctx: CanvasRenderingContext2D,
  frame: 0 | 1,
  helm: ArmorHelm,
  shape: WeaponShape,
  hasShield: boolean,
  pal: Palette,
  scale: number,
): void {
  const px = (x: number, y: number, ch: string) => {
    const color = pal[ch];
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  };
  const rect = (x: number, y: number, w: number, h: number, ch: string) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) px(x + dx, y + dy, ch);
  };

  const bob = frame === 1 ? 1 : 0;

  // 1. Cape (behind body)
  rect(2 - bob, 7 + bob, 2, 3, 'R');
  rect(3 - bob, 9 + bob, 2, 2, 'r');
  px(1 - bob, 8 + bob, 'K');

  // 2. Torso / Tunic + Boots
  rect(5, 6 + bob, 5, 4, 'B');
  rect(5, 9 + bob, 5, 1, 'b');
  px(7, 7 + bob, 'Y'); // belt buckle
  if (frame === 0) {
    rect(5, 10, 2, 2, 'D');
    rect(8, 10, 2, 2, 'D');
  } else {
    rect(4, 11, 2, 2, 'D');
    rect(9, 11, 2, 2, 'D');
  }
  // Outline torso
  rect(4, 6 + bob, 1, 4, 'K');
  rect(10, 6 + bob, 1, 4, 'K');

  // 3. Head + Skin + Eyes
  rect(5, 3 + bob, 5, 3, 'S');
  px(6, 4 + bob, 'K');
  px(8, 4 + bob, 'K');
  rect(4, 3 + bob, 1, 3, 'K');
  rect(10, 3 + bob, 1, 3, 'K');

  // 4. Distinct Armor Headgear Silhouette!
  switch (helm) {
    case 'hair':
      rect(5, 1 + bob, 5, 2, 'H');
      px(9, 2 + bob, 'h');
      rect(5, 0 + bob, 5, 1, 'K');
      break;
    case 'hood':
      rect(4, 1 + bob, 7, 2, 'H');
      rect(3, 2 + bob, 2, 3, 'h');
      rect(5, 0 + bob, 5, 1, 'K');
      break;
    case 'visor':
      rect(4, 1 + bob, 7, 3, 'H');
      rect(5, 3 + bob, 5, 1, 'h');
      px(6, 3 + bob, 'K');
      px(8, 3 + bob, 'K');
      rect(6, 0 + bob, 3, 1, 'R'); // knight plume!
      break;
    case 'horns':
      rect(5, 1 + bob, 5, 2, 'H');
      px(3, 0 + bob, 'Y'); px(4, 1 + bob, 'Y'); // left dragon horn
      px(11, 0 + bob, 'Y'); px(10, 1 + bob, 'Y'); // right dragon horn
      break;
    case 'crownIce':
      rect(5, 2 + bob, 5, 1, 'H');
      px(5, 0 + bob, 'H'); px(7, 0 + bob, 'W'); px(9, 0 + bob, 'H');
      px(5, 1 + bob, 'H'); px(7, 1 + bob, 'H'); px(9, 1 + bob, 'H');
      break;
    case 'shadow':
      rect(4, 1 + bob, 7, 5, 'H');
      rect(5, 3 + bob, 5, 2, 'K');
      px(6, 4 + bob, 'R'); // glowing crimson eyes!
      px(8, 4 + bob, 'R');
      break;
    case 'kingCrown':
      rect(4, 1 + bob, 7, 2, 'H');
      px(4, 0 + bob, 'H'); px(7, 0 + bob, 'H'); px(10, 0 + bob, 'H');
      px(7, 1 + bob, 'R'); // royal ruby gem!
      break;
  }

  // 5. Distinct Weapon Silhouette (Right hand at x=11, y=7+bob)
  const wx = 11;
  const wy = 7 + bob;
  px(wx, wy, 'Y'); // hilt
  switch (shape) {
    case 'short':
      px(wx + 1, wy - 1, 'W');
      px(wx + 2, wy - 2, 'W');
      px(wx + 2, wy - 1, 'G');
      break;
    case 'long':
      for (let i = 1; i <= 4; i++) {
        px(wx + i, wy - i, 'W');
        px(wx + i, wy - i + 1, 'G');
      }
      break;
    case 'greatsword':
      px(wx, wy - 1, 'Y');
      px(wx + 1, wy, 'Y');
      for (let i = 1; i <= 5; i++) {
        px(wx + i, wy - i, 'W');
        px(wx + i + 1, wy - i, 'W');
        px(wx + i + 1, wy - i + 1, 'G');
      }
      break;
    case 'katana':
      px(wx + 1, wy - 1, 'W');
      px(wx + 2, wy - 2, 'W');
      px(wx + 3, wy - 3, 'W');
      px(wx + 4, wy - 4, 'W');
      px(wx + 5, wy - 4, 'G');
      px(wx + 6, wy - 5, 'W');
      break;
    case 'axe':
      // Long shaft + heavy double-bit axe head
      for (let i = 1; i <= 4; i++) px(wx + i, wy - i, 'D');
      rect(wx + 3, wy - 6, 3, 2, 'W');
      rect(wx + 4, wy - 4, 3, 2, 'G');
      px(wx + 6, wy - 5, 'W');
      break;
    case 'scythe':
      // Tall staff + curving grim reaper crescent blade
      for (let i = 0; i <= 5; i++) px(wx + 2, wy - i, 'D');
      px(wx + 3, wy - 5, 'W');
      px(wx + 4, wy - 5, 'W');
      px(wx + 5, wy - 4, 'W');
      px(wx + 6, wy - 3, 'G');
      px(wx + 5, wy - 2, 'G');
      break;
    case 'excalibur':
      // Winged crossguard + radiant long golden blade
      px(wx - 1, wy - 1, 'Y');
      px(wx + 1, wy + 1, 'Y');
      for (let i = 1; i <= 6; i++) {
        px(wx + i, wy - i, 'W');
        px(wx + i + 1, wy - i, 'G');
      }
      px(wx + 6, wy - 7, 'W');
      break;
  }

  // 6. Optional Off-Hand Shield (only when 1H weapon + Shield equipped!)
  if (hasShield) {
    rect(2, 6 + bob, 3, 4, 'Q');
    rect(3, 7 + bob, 1, 2, 'q');
    px(1, 7 + bob, 'K');
    px(1, 8 + bob, 'K');
    px(3, 10 + bob, 'K');
  }
}

export function ensureHeroAppearance(
  scene: Phaser.Scene,
  weaponId: WeaponId,
  armorId: ArmorId,
  shieldId: ShieldId | null = null,
): [string, string] {
  const sTag = shieldId ?? 'none';
  const k0 = `px-hero-${weaponId}-${armorId}-${sTag}-0`;
  const k1 = `px-hero-${weaponId}-${armorId}-${sTag}-1`;
  const w = getWeaponSpec(weaponId);
  const a = getArmorSpec(armorId);
  const s = getShieldSpec(shieldId);
  const pal: Palette = {
    ...HERO_PALETTE,
    H: a.helmColor,
    h: a.helmShade,
    B: a.tunicColor,
    b: a.tunicDark,
    R: a.capeColor,
    r: a.capeDark,
    W: w.bladeColor,
    G: w.edgeColor,
    Y: w.hiltColor,
    Q: s?.mainColor ?? '#b45309',
    q: s?.rimColor ?? '#fde047',
  };
  for (const [key, frame] of [[k0, 0], [k1, 1]] as const) {
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, 20 * 4, 14 * 4);
    if (!tex) continue;
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    drawHeroBodyAndGear(ctx, frame, a.helm, w.shape, s !== null, pal, 4);
    tex.refresh();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return [k0, k1];
}

const CYBER_MECH_PALETTE: Palette = {
  K: '#060913',
  S: '#64748b', // steel hull
  D: '#1e293b', // dark chassis
  C: '#22d3ee', // neon cyan visor
  M: '#e879f9', // magenta core
  W: '#f8fafc', // laser glow
};

const CYBER_MECH_0 = [
  '....KK....KK.....KW',
  '...KCCK..KCCK...KWC',
  '..KSSSKKKKSSSK.KWC.',
  '..KSDDDDDDDDSKKWC..',
  '..KSDCCCCCCDSKWC...',
  '..KSDDDDDDDDSKK....',
  '.KSSKDMMMMMDKSSK...',
  'KSSSKDDDDDDDKSSSK..',
  '.KKKSDDDDDDDSKKK...',
  '...KDDK..KDDK......',
  '..KSSSK..KSSSK.....',
  '..KKKK....KKKK.....',
  '................... ',
].map((r) => r.trimEnd().padEnd(19, '.'));

const CYBER_MECH_1 = [
  '.................KW',
  '....KK....KK....KWC',
  '...KCCK..KCCK..KWC.',
  '..KSSSKKKKSSSKKWC..',
  '..KSDCCCCCCDSKKC...',
  '.KSSKDDDDDDDKSSK...',
  'KSSSKDMMMMMDKSSSK..',
  '.KKKSDDDDDDDSKKK...',
  '...KSDDDDDDDSK.....',
  '..KDDK....KDDK.....',
  '..KSSK....KSSK.....',
  '..KKKK....KKKK.....',
  '................... ',
].map((r) => r.trimEnd().padEnd(19, '.'));

const VOID_SERAPH_PALETTE: Palette = {
  K: '#090514',
  Y: '#facc15', // golden halo / lance
  W: '#fef9c3', // radiant wing
  V: '#7c3aed', // void purple robe
  D: '#3b0764', // dark void
  R: '#f43f5e', // crimson eye
};

const VOID_SERAPH_0 = [
  '....KKYYYYKK.....KY',
  '..KKWWWWWWWWKK..KYW',
  '.KWWKKVVVVKKWWKKYW.',
  'KWWK.KVRKRVK.KWWKW.',
  'KWWK.KVVVVVK.KWWK..',
  '.KKK.KVVYVVK.KKK...',
  '....KVVVVVVVK......',
  '...KVVDDDDDVVK.....',
  '...KVVDDDDDVVK.....',
  '....KKVVVVVKK......',
  '.....KVV.VVK.......',
  '.....KKK.KKK.......',
  '................... ',
].map((r) => r.trimEnd().padEnd(19, '.'));

const VOID_SERAPH_1 = [
  '.................KY',
  '....KKYYYYKK....KYW',
  '.KKWWWWWWWWWWKKKYW.',
  'KWWKKKVVVVKKKWWKKW.',
  'KWWK.KVRKRVK.KWWK..',
  '.KK..KVVYVVK..KK...',
  '....KVVVVVVVK......',
  '...KVVDDDDDVVK.....',
  '....KVDDDDDVK......',
  '.....KVVVVVK.......',
  '....KVV...VVK......',
  '....KKK...KKK......',
  '................... ',
].map((r) => r.trimEnd().padEnd(19, '.'));

// ── Chapter-Themed Mob Palettes & Bespoke Cyber / Celestial Silhouettes ──

const FROST_SLIME_PALETTE: Palette = { K: '#0c2340', G: '#38bdf8', L: '#e0f2fe', D: '#0284c7', W: '#ffffff' };
const FROST_GOBLIN_PALETTE: Palette = { K: '#0f172a', G: '#bae6fd', g: '#7dd3fc', R: '#22d3ee', L: '#1e3a5f', l: '#0f2544', W: '#e0f2fe', B: '#38bdf8' };
const FROST_SKELETON_PALETTE: Palette = { K: '#0b1629', W: '#e0f2fe', G: '#7dd3fc', R: '#22d3ee', C: '#0284c7', S: '#bae6fd', B: '#1e3a8a' };

const INFERNO_SLIME_PALETTE: Palette = { K: '#260808', G: '#f97316', L: '#fef08a', D: '#b91c1c', W: '#ffffff' };
const INFERNO_GOBLIN_PALETTE: Palette = { K: '#1f0808', G: '#ef4444', g: '#b91c1c', R: '#facc15', L: '#44403c', l: '#292524', W: '#fb923c', B: '#7c2d12' };
const INFERNO_SKELETON_PALETTE: Palette = { K: '#180606', W: '#57534e', G: '#292524', R: '#facc15', C: '#dc2626', S: '#f97316', B: '#1c1917' };

const CYBER_DRONE_PALETTE: Palette = { K: '#090514', M: '#334155', L: '#94a3b8', C: '#22d3ee', W: '#ffffff', P: '#a21caf' };
const CYBER_DRONE_0 = [
  '................',
  '....KKKKKKKK....',
  '..KKLLMMMMLLKK..',
  '.KLMMCCCCCCMMLK.',
  '.KMMCWWCCWWCMMK.',
  '.KLMMCCCCCCMMLK.',
  '..KKMMMMMMMMKK..',
  '....KK.PP.KK....',
  '......PPPP......',
  '................',
];
const CYBER_DRONE_1 = [
  '....KKKKKKKK....',
  '..KKLLMMMMLLKK..',
  '.KLMMCCCCCCMMLK.',
  '.KMMCWWCCWWCMMK.',
  '.KLMMCCCCCCMMLK.',
  '..KKMMMMMMMMKK..',
  '....KK.CC.KK....',
  '.....PCCCCP.....',
  '................',
  '................',
];

const CYBER_BOT_PALETTE: Palette = { K: '#090514', M: '#1e1b4b', L: '#6366f1', P: '#f472b6', W: '#ffffff', C: '#22d3ee', D: '#0f172a' };
const CYBER_BOT_0 = [
  '....KKKKKKKK..KC',
  '...KLLMMMMLLK.KC',
  '...KMPPPPPPMKKC.',
  '...KMMLLLLMMKC..',
  '..KDKMMMMMMKK...',
  '.KDDKMCCCCMK....',
  '..KKKDDDDDDK....',
  '....KDD..DDK....',
  '...KLLK..KLLK...',
  '...KKK....KKK...',
];
const CYBER_BOT_1 = [
  '.............KC.',
  '....KKKKKKKK.KC.',
  '...KLLMMMMLLKKC.',
  '...KMPPPPPPMKC..',
  '...KMMLLLLMMK...',
  '..KDKMMMMMMK....',
  '.KDDKMCCCCMK....',
  '..KKKDDDDDDK....',
  '..KLLK....KLLK..',
  '..KKK......KKK..',
];

const CYBER_ENFORCER_PALETTE: Palette = { K: '#05030d', M: '#0f172a', L: '#38bdf8', C: '#22d3ee', P: '#c084fc', Y: '#facc15', W: '#ffffff' };
const CYBER_ENFORCER_0 = [
  '...KKKKKKKK..KWC',
  '..KLLMMMMLLKKWC.',
  '..KMCCKMMCCKWC..',
  '..KMMYYYYMMKK...',
  '.KPKMMMMMMMMK...',
  'KPPKMLCCCCLMK...',
  'KPPKMMMMMMMMK...',
  '.KKKMM....MMK...',
  '...KLL....LLK...',
  '...KKK....KKK...',
];
const CYBER_ENFORCER_1 = [
  '.............KWC',
  '...KKKKKKKK.KWC.',
  '..KLLMMMMLLKWC..',
  '..KMCCKMMCCKK...',
  '..KMMYYYYMMK....',
  '.KPKMMMMMMMMK...',
  'KPPKMLCCCCLMK...',
  '.KKKMM....MMK...',
  '..KLLK....KLLK..',
  '..KKK......KKK..',
];

const CELESTIAL_WISP_PALETTE: Palette = { K: '#1e1b4b', Y: '#facc15', W: '#fef9c3', P: '#c084fc', V: '#7c3aed' };
const CELESTIAL_WISP_0 = [
  '......KKKK......',
  '.....KYYYYK.....',
  '...KKYWWWWYKK...',
  '..KPPYWKKWYPPK..',
  '.KPVPYWWWWYPVPK.',
  '..KPPYYYYYYPPK..',
  '...KKPVVVVPKK...',
  '.....KKPPKK.....',
  '.......KK.......',
  '................',
];
const CELESTIAL_WISP_1 = [
  '................',
  '......KKKK......',
  '....KKYYYYKK....',
  '..KKPYWWWWYPKK..',
  '.KPVPYWKKWYPVPK.',
  '..KPPYWWWWYPPK..',
  '...KKPYYYYPKK...',
  '.....KVVVVK.....',
  '......KKKK......',
  '................',
];

const CELESTIAL_ACOLYTE_PALETTE: Palette = { K: '#1e1b4b', V: '#6d28d9', P: '#a855f7', Y: '#facc15', W: '#fef9c3', D: '#3b0764' };
const CELESTIAL_ACOLYTE_0 = [
  '....KKKKKKKK..KY',
  '...KVVVVVVVVK.KW',
  '...KVYYYYYYVKKY.',
  '...KVYKYKYYVKV..',
  '..KPVVVVVVVPK...',
  '.KPPVVDYYDVPPK..',
  '..KKVVDDDDVVKK..',
  '...KVVVVVVVVK...',
  '...KDDK..KDDK...',
  '...KKK....KKK...',
];
const CELESTIAL_ACOLYTE_1 = [
  '.............KY.',
  '....KKKKKKKK.KW.',
  '...KVVVVVVVVKKY.',
  '...KVYYYYYYVKV..',
  '...KVYKYKYYVK...',
  '..KPVVVVVVVPK...',
  '.KPPVVDYYDVPPK..',
  '..KKVVDDDDVVKK..',
  '..KDDK....KDDK..',
  '..KKK......KKK..',
];

const CELESTIAL_GUARD_PALETTE: Palette = { K: '#1e1b4b', W: '#f8fafc', Y: '#facc15', G: '#cbd5e1', P: '#7c3aed', V: '#c084fc', B: '#312e81' };
const CELESTIAL_GUARD_0 = [
  '....KKYYYYKK..KY',
  '...KWWWWWWWWK.KW',
  '...KWYWWWWYWKKY.',
  '...KWWYYYYWWKY..',
  '.KPKWWWWWWWWK...',
  'KPVKWWYYYYWWK...',
  'KPPKGGGGGGGGK...',
  '.KKKBB....BBK...',
  '...KYY....YYK...',
  '...KKK....KKK...',
];
const CELESTIAL_GUARD_1 = [
  '.............KY.',
  '....KKYYYYKK.KW.',
  '...KWWWWWWWWKKY.',
  '...KWYWWWWYWKY..',
  '...KWWYYYYWWK...',
  '.KPKWWWWWWWWK...',
  'KPVKWWYYYYWWK...',
  '.KKKGG....GGK...',
  '..KYYK....KYYK..',
  '..KKK......KKK..',
];

export type OverworldMobId = 'slime' | 'goblin' | 'skeleton';

export function mobTextureKey(chapterId: ChapterDef['id'], mobId: OverworldMobId, frame: number): string {
  const f = frame % 2;
  if (chapterId === 'chrono-quest') return `px-${mobId}-${f}`;
  return `px-${chapterId}-${mobId}-${f}`;
}

export function ensurePixelArt(scene: Phaser.Scene): void {
  drawPixelTexture(scene, 'px-hero-0', HERO_0, HERO_PALETTE, 4);
  drawPixelTexture(scene, 'px-hero-1', HERO_1, HERO_PALETTE, 4);
  // CH.1 Chrono Quest (Classic Fantasy)
  drawPixelTexture(scene, 'px-slime-0', SLIME_0, SLIME_PALETTE, 3);
  drawPixelTexture(scene, 'px-slime-1', SLIME_1, SLIME_PALETTE, 3);
  drawPixelTexture(scene, 'px-goblin-0', GOBLIN_0, GOBLIN_PALETTE, 4);
  drawPixelTexture(scene, 'px-goblin-1', GOBLIN_1, GOBLIN_PALETTE, 4);
  drawPixelTexture(scene, 'px-skeleton-0', SKELETON_0, SKELETON_PALETTE, 4);
  drawPixelTexture(scene, 'px-skeleton-1', SKELETON_1, SKELETON_PALETTE, 4);
  // CH.2 Frost Chronicle (Glacial)
  drawPixelTexture(scene, 'px-frost-chronicle-slime-0', SLIME_0, FROST_SLIME_PALETTE, 3);
  drawPixelTexture(scene, 'px-frost-chronicle-slime-1', SLIME_1, FROST_SLIME_PALETTE, 3);
  drawPixelTexture(scene, 'px-frost-chronicle-goblin-0', GOBLIN_0, FROST_GOBLIN_PALETTE, 4);
  drawPixelTexture(scene, 'px-frost-chronicle-goblin-1', GOBLIN_1, FROST_GOBLIN_PALETTE, 4);
  drawPixelTexture(scene, 'px-frost-chronicle-skeleton-0', SKELETON_0, FROST_SKELETON_PALETTE, 4);
  drawPixelTexture(scene, 'px-frost-chronicle-skeleton-1', SKELETON_1, FROST_SKELETON_PALETTE, 4);
  // CH.3 Inferno Saga (Volcanic)
  drawPixelTexture(scene, 'px-inferno-saga-slime-0', SLIME_0, INFERNO_SLIME_PALETTE, 3);
  drawPixelTexture(scene, 'px-inferno-saga-slime-1', SLIME_1, INFERNO_SLIME_PALETTE, 3);
  drawPixelTexture(scene, 'px-inferno-saga-goblin-0', GOBLIN_0, INFERNO_GOBLIN_PALETTE, 4);
  drawPixelTexture(scene, 'px-inferno-saga-goblin-1', GOBLIN_1, INFERNO_GOBLIN_PALETTE, 4);
  drawPixelTexture(scene, 'px-inferno-saga-skeleton-0', SKELETON_0, INFERNO_SKELETON_PALETTE, 4);
  drawPixelTexture(scene, 'px-inferno-saga-skeleton-1', SKELETON_1, INFERNO_SKELETON_PALETTE, 4);
  // CH.4 Cyber Neon (Bespoke Mechs & Drones)
  drawPixelTexture(scene, 'px-cyber-neon-slime-0', CYBER_DRONE_0, CYBER_DRONE_PALETTE, 3);
  drawPixelTexture(scene, 'px-cyber-neon-slime-1', CYBER_DRONE_1, CYBER_DRONE_PALETTE, 3);
  drawPixelTexture(scene, 'px-cyber-neon-goblin-0', CYBER_BOT_0, CYBER_BOT_PALETTE, 4);
  drawPixelTexture(scene, 'px-cyber-neon-goblin-1', CYBER_BOT_1, CYBER_BOT_PALETTE, 4);
  drawPixelTexture(scene, 'px-cyber-neon-skeleton-0', CYBER_ENFORCER_0, CYBER_ENFORCER_PALETTE, 4);
  drawPixelTexture(scene, 'px-cyber-neon-skeleton-1', CYBER_ENFORCER_1, CYBER_ENFORCER_PALETTE, 4);
  // CH.5 Celestial Fall (Bespoke Astral & Void Guardians)
  drawPixelTexture(scene, 'px-celestial-fall-slime-0', CELESTIAL_WISP_0, CELESTIAL_WISP_PALETTE, 3);
  drawPixelTexture(scene, 'px-celestial-fall-slime-1', CELESTIAL_WISP_1, CELESTIAL_WISP_PALETTE, 3);
  drawPixelTexture(scene, 'px-celestial-fall-goblin-0', CELESTIAL_ACOLYTE_0, CELESTIAL_ACOLYTE_PALETTE, 4);
  drawPixelTexture(scene, 'px-celestial-fall-goblin-1', CELESTIAL_ACOLYTE_1, CELESTIAL_ACOLYTE_PALETTE, 4);
  drawPixelTexture(scene, 'px-celestial-fall-skeleton-0', CELESTIAL_GUARD_0, CELESTIAL_GUARD_PALETTE, 4);
  drawPixelTexture(scene, 'px-celestial-fall-skeleton-1', CELESTIAL_GUARD_1, CELESTIAL_GUARD_PALETTE, 4);
  drawPixelTexture(scene, 'px-demon-0', DEMON_0, DEMON_PALETTE, 6);
  drawPixelTexture(scene, 'px-demon-1', DEMON_1, DEMON_PALETTE, 6);
  drawPixelTexture(scene, 'px-frostLich-0', FROST_LICH_0, FROST_LICH_PALETTE, 6);
  drawPixelTexture(scene, 'px-frostLich-1', FROST_LICH_1, FROST_LICH_PALETTE, 6);
  drawPixelTexture(scene, 'px-infernoTitan-0', INFERNO_TITAN_0, INFERNO_TITAN_PALETTE, 6);
  drawPixelTexture(scene, 'px-infernoTitan-1', INFERNO_TITAN_1, INFERNO_TITAN_PALETTE, 6);
  drawPixelTexture(scene, 'px-cyberMech-0', CYBER_MECH_0, CYBER_MECH_PALETTE, 6);
  drawPixelTexture(scene, 'px-cyberMech-1', CYBER_MECH_1, CYBER_MECH_PALETTE, 6);
  drawPixelTexture(scene, 'px-voidSeraph-0', VOID_SERAPH_0, VOID_SERAPH_PALETTE, 6);
  drawPixelTexture(scene, 'px-voidSeraph-1', VOID_SERAPH_1, VOID_SERAPH_PALETTE, 6);
  drawPixelTexture(scene, 'px-village', VILLAGE_GRID, VILLAGE_PALETTE, 5);
  drawPixelTexture(scene, 'px-castle', CASTLE_GRID, CASTLE_PALETTE, 8);
  drawPixelTexture(scene, 'px-tree-green', TREE_GRID, TREE_PALETTE_GREEN, 4);
  drawPixelTexture(scene, 'px-tree-dark', TREE_GRID, TREE_PALETTE_DARK, 4);
  drawPixelTexture(scene, 'px-tree-snow', TREE_GRID, TREE_SNOW_PALETTE, 4);
  drawPixelTexture(scene, 'px-ice-crystal', ICE_CRYSTAL_GRID, ICE_CRYSTAL_PALETTE, 4);
  drawPixelTexture(scene, 'px-magma-pillar', MAGMA_PILLAR_GRID, MAGMA_PILLAR_PALETTE, 4);
  drawPixelTexture(scene, 'px-rock-ash', ROCK_GRID, ROCK_PALETTE, 4);
  drawPixelTexture(scene, 'px-crystal', CRYSTAL_GRID, CRYSTAL_PALETTE, 4);
  drawPixelTexture(scene, 'px-coin', COIN_GRID, COIN_PALETTE, 4);
}
