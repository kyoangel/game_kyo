export type BossKind = 'demon' | 'frostLich' | 'infernoTitan' | 'cyberMech' | 'voidSeraph';
export type BossPattern = 'fireball' | 'iceDual' | 'magmaVolley' | 'cyberLaser' | 'seraphBarrage';
export type ObstacleKind = 'tree-green' | 'tree-dark' | 'rock-ash' | 'tree-snow' | 'ice-crystal' | 'magma-pillar';
export type MapPoiKind = 'timeCrystal' | 'powerShrine' | 'shortcutPortal';

export interface MapPoiDef {
  kind: MapPoiKind;
  x: number;
  y: number;
}

export interface RouteSignDef {
  labelKey: 'sign.risk' | 'sign.merchant';
  x: number;
  y: number;
  color: string;
}

export interface ObstaclePlacement {
  x: number;
  y: number;
  kind: ObstacleKind;
  radius: number;
}

export interface VillagePlacement {
  id: 'oakvale' | 'ironhold' | 'dawnspire';
  x: number;
  y: number;
}

export interface BarrierRect {
  x: number;
  y: number;
  w: number;
  h: number;
  style: 'glacierCanyon' | 'magmaRiver' | 'neonWall' | 'voidChasm';
}

export interface ChapterDef {
  id: 'chrono-quest' | 'frost-chronicle' | 'inferno-saga' | 'cyber-neon' | 'celestial-fall';
  bossKind: BossKind;
  bossPattern: BossPattern;
  zoneColors: readonly [number, number, number, number];
  roadOuter: number;
  roadInner: number;
  arenaWall: number;
  arenaWindow: number;
  arenaFloor: number;
  arenaAccent: number;
  villages: readonly VillagePlacement[];
  roadPoints: readonly [number, number][];
  secondaryRoadPoints?: readonly [number, number][];
  routeSigns?: readonly RouteSignDef[];
  barriers?: readonly BarrierRect[];
  pois?: readonly MapPoiDef[];
  obstacles: readonly ObstaclePlacement[];
  enemySpawns: readonly { id: 'slime' | 'goblin' | 'skeleton'; x: number; y: number }[];
}

export const EPISODES_PER_CHAPTER = 5;
export const STAGES_PER_CYCLE = 5 * EPISODES_PER_CHAPTER;

export function toRoman(num: number): string {
  const n = Math.max(1, Math.floor(num));
  const table: ReadonlyArray<[number, string]> = [
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let rem = n;
  let out = '';
  for (const [val, sym] of table) {
    while (rem >= val) {
      out += sym;
      rem -= val;
    }
  }
  return out;
}

export const CHAPTERS: readonly ChapterDef[] = [
  {
    id: 'chrono-quest',
    bossKind: 'demon',
    bossPattern: 'fireball',
    zoneColors: [0x2d7a3e, 0x1e5645, 0x3f3344, 0x221233],
    roadOuter: 0x9a6b3a,
    roadInner: 0xb8864b,
    arenaWall: 0x1c0f38,
    arenaWindow: 0x7f1d1d,
    arenaFloor: 0x1e1633,
    arenaAccent: 0xf43f5e,
    villages: [
      { id: 'oakvale', x: 185, y: 480 },
      { id: 'ironhold', x: 750, y: 270 },
      { id: 'dawnspire', x: 1260, y: 710 },
    ],
    roadPoints: [
      [185, 480], [480, 480], [750, 270], [1040, 480], [1260, 710], [1480, 480], [1680, 480],
    ],
    obstacles: [
      { x: 120, y: 210, kind: 'tree-green', radius: 26 },
      { x: 350, y: 210, kind: 'tree-green', radius: 26 },
      { x: 460, y: 340, kind: 'tree-green', radius: 26 },
      { x: 240, y: 720, kind: 'tree-green', radius: 26 },
      { x: 490, y: 690, kind: 'tree-green', radius: 26 },
      { x: 670, y: 420, kind: 'tree-dark', radius: 26 },
      { x: 890, y: 230, kind: 'tree-dark', radius: 26 },
      { x: 850, y: 540, kind: 'tree-dark', radius: 26 },
      { x: 980, y: 720, kind: 'tree-dark', radius: 26 },
      { x: 1200, y: 260, kind: 'rock-ash', radius: 26 },
      { x: 1360, y: 450, kind: 'rock-ash', radius: 26 },
      { x: 1470, y: 280, kind: 'rock-ash', radius: 26 },
      { x: 1460, y: 740, kind: 'rock-ash', radius: 26 },
    ],
    enemySpawns: [
      { id: 'slime', x: 380, y: 390 }, { id: 'slime', x: 410, y: 580 }, { id: 'slime', x: 540, y: 460 },
      { id: 'slime', x: 260, y: 310 }, { id: 'slime', x: 340, y: 700 }, { id: 'slime', x: 550, y: 260 },
      { id: 'goblin', x: 720, y: 520 }, { id: 'goblin', x: 840, y: 360 }, { id: 'goblin', x: 940, y: 560 },
      { id: 'goblin', x: 740, y: 690 }, { id: 'goblin', x: 1030, y: 370 },
      { id: 'skeleton', x: 1180, y: 400 }, { id: 'skeleton', x: 1290, y: 540 }, { id: 'skeleton', x: 1390, y: 310 },
      { id: 'skeleton', x: 1410, y: 630 }, { id: 'skeleton', x: 1160, y: 620 },
    ],
  },
  {
    id: 'frost-chronicle',
    bossKind: 'frostLich',
    bossPattern: 'iceDual',
    zoneColors: [0x2b5876, 0x1e3c5c, 0x263354, 0x131b3a],
    roadOuter: 0x64748b,
    roadInner: 0x94a3b8,
    arenaWall: 0x0f2544,
    arenaWindow: 0x0284c7,
    arenaFloor: 0x172554,
    arenaAccent: 0x38bdf8,
    villages: [
      { id: 'oakvale', x: 185, y: 480 },
      { id: 'ironhold', x: 760, y: 740 },
      { id: 'dawnspire', x: 1220, y: 740 },
    ],
    roadPoints: [
      [185, 480], [450, 480], [560, 740], [760, 740], [1220, 740], [1460, 480], [1680, 480],
    ],
    secondaryRoadPoints: [
      [450, 480], [560, 230], [960, 220], [1340, 240], [1460, 480],
    ],
    routeSigns: [
      { labelKey: 'sign.risk', x: 525, y: 315, color: '#fda4af' },
      { labelKey: 'sign.merchant', x: 525, y: 645, color: '#fde047' },
    ],
    barriers: [
      { x: 560, y: 410, w: 800, h: 140, style: 'glacierCanyon' },
    ],
    obstacles: [
      { x: 300, y: 260, kind: 'tree-snow', radius: 26 },
      { x: 300, y: 700, kind: 'tree-snow', radius: 26 },
      { x: 720, y: 150, kind: 'ice-crystal', radius: 26 },
      { x: 1080, y: 330, kind: 'ice-crystal', radius: 26 },
      { x: 960, y: 830, kind: 'tree-snow', radius: 26 },
      { x: 1460, y: 260, kind: 'ice-crystal', radius: 26 },
      { x: 1460, y: 710, kind: 'ice-crystal', radius: 26 },
    ],
    enemySpawns: [
      // Start zone slimes
      { id: 'slime', x: 350, y: 420 }, { id: 'slime', x: 380, y: 550 }, { id: 'slime', x: 260, y: 360 },
      // Upper RISK PATH (No villages, packed with high-XP Goblins & Skeletons!)
      { id: 'goblin', x: 640, y: 230 }, { id: 'goblin', x: 770, y: 280 }, { id: 'goblin', x: 890, y: 200 },
      { id: 'skeleton', x: 1020, y: 230 }, { id: 'skeleton', x: 1150, y: 195 }, { id: 'skeleton', x: 1260, y: 270 },
      { id: 'skeleton', x: 1360, y: 220 },
      // Lower MERCHANT PATH (Dual villages + steady gold farming)
      { id: 'slime', x: 620, y: 710 }, { id: 'goblin', x: 900, y: 690 }, { id: 'goblin', x: 1040, y: 750 },
      { id: 'skeleton', x: 1360, y: 690 },
      // Pre-castle convergence
      { id: 'skeleton', x: 1510, y: 460 }, { id: 'goblin', x: 1510, y: 560 },
    ],
  },
  {
    id: 'inferno-saga',
    bossKind: 'infernoTitan',
    bossPattern: 'magmaVolley',
    zoneColors: [0x5c2c24, 0x4a1d24, 0x3b1322, 0x240914],
    roadOuter: 0x44403c,
    roadInner: 0x78716c,
    arenaWall: 0x2a0a14,
    arenaWindow: 0xea580c,
    arenaFloor: 0x29151a,
    arenaAccent: 0xf97316,
    villages: [
      { id: 'oakvale', x: 185, y: 640 },
      { id: 'ironhold', x: 760, y: 470 },
      { id: 'dawnspire', x: 1280, y: 310 },
    ],
    roadPoints: [
      [185, 640], [480, 470], [760, 470], [1050, 620], [1280, 310], [1500, 480], [1680, 480],
    ],
    secondaryRoadPoints: [
      [480, 470], [800, 210], [1280, 310],
    ],
    routeSigns: [
      { labelKey: 'sign.risk', x: 600, y: 250, color: '#fda4af' },
      { labelKey: 'sign.merchant', x: 600, y: 540, color: '#fde047' },
    ],
    pois: [
      { kind: 'timeCrystal', x: 630, y: 175 },
      { kind: 'powerShrine', x: 1090, y: 760 },
      { kind: 'shortcutPortal', x: 980, y: 470 },
    ],
    obstacles: [
      { x: 260, y: 320, kind: 'magma-pillar', radius: 26 },
      { x: 420, y: 640, kind: 'magma-pillar', radius: 26 },
      { x: 520, y: 280, kind: 'rock-ash', radius: 26 },
      { x: 650, y: 630, kind: 'magma-pillar', radius: 26 },
      { x: 740, y: 260, kind: 'magma-pillar', radius: 26 },
      { x: 920, y: 410, kind: 'magma-pillar', radius: 26 },
      { x: 920, y: 740, kind: 'rock-ash', radius: 26 },
      { x: 1140, y: 440, kind: 'magma-pillar', radius: 26 },
      { x: 1240, y: 690, kind: 'magma-pillar', radius: 26 },
      { x: 1410, y: 360, kind: 'magma-pillar', radius: 26 },
      { x: 1440, y: 640, kind: 'magma-pillar', radius: 26 },
    ],
    enemySpawns: [
      { id: 'slime', x: 330, y: 520 }, { id: 'slime', x: 400, y: 360 }, { id: 'slime', x: 540, y: 580 },
      { id: 'slime', x: 200, y: 440 }, { id: 'slime', x: 340, y: 760 }, { id: 'slime', x: 580, y: 390 },
      { id: 'goblin', x: 680, y: 360 }, { id: 'goblin', x: 840, y: 610 }, { id: 'goblin', x: 970, y: 280 },
      { id: 'goblin', x: 770, y: 740 }, { id: 'goblin', x: 1040, y: 510 },
      { id: 'skeleton', x: 1180, y: 290 }, { id: 'skeleton', x: 1320, y: 540 }, { id: 'skeleton', x: 1420, y: 240 },
      { id: 'skeleton', x: 1380, y: 740 }, { id: 'skeleton', x: 1140, y: 600 },
    ],
  },
  {
    id: 'cyber-neon',
    bossKind: 'cyberMech',
    bossPattern: 'cyberLaser',
    zoneColors: [0x0f172a, 0x1e1b4b, 0x2e1065, 0x090514],
    roadOuter: 0x0e7490,
    roadInner: 0x22d3ee,
    arenaWall: 0x0f172a,
    arenaWindow: 0xa21caf,
    arenaFloor: 0x1e1b4b,
    arenaAccent: 0x22d3ee,
    villages: [
      { id: 'oakvale', x: 185, y: 480 },
      { id: 'ironhold', x: 840, y: 210 },
      { id: 'dawnspire', x: 1160, y: 760 },
    ],
    roadPoints: [
      [185, 480], [460, 480], [640, 210], [840, 210], [1360, 210], [1500, 480], [1680, 480],
    ],
    secondaryRoadPoints: [
      [460, 480], [640, 760], [1160, 760], [1500, 480],
    ],
    routeSigns: [
      { labelKey: 'sign.risk', x: 540, y: 310, color: '#22d3ee' },
      { labelKey: 'sign.merchant', x: 540, y: 650, color: '#f472b6' },
    ],
    barriers: [
      { x: 580, y: 360, w: 760, h: 240, style: 'neonWall' },
    ],
    pois: [
      { kind: 'timeCrystal', x: 1120, y: 210 },
      { kind: 'powerShrine', x: 820, y: 760 },
      { kind: 'shortcutPortal', x: 1350, y: 740 },
    ],
    obstacles: [
      { x: 320, y: 260, kind: 'ice-crystal', radius: 26 },
      { x: 320, y: 700, kind: 'ice-crystal', radius: 26 },
      { x: 1460, y: 260, kind: 'ice-crystal', radius: 26 },
      { x: 1460, y: 700, kind: 'ice-crystal', radius: 26 },
    ],
    enemySpawns: [
      { id: 'slime', x: 340, y: 440 }, { id: 'slime', x: 400, y: 550 }, { id: 'slime', x: 280, y: 370 },
      { id: 'goblin', x: 650, y: 210 }, { id: 'goblin', x: 980, y: 220 }, { id: 'skeleton', x: 1240, y: 220 },
      { id: 'skeleton', x: 1360, y: 280 },
      { id: 'goblin', x: 660, y: 750 }, { id: 'goblin', x: 960, y: 740 }, { id: 'skeleton', x: 1280, y: 750 },
      { id: 'skeleton', x: 1510, y: 440 }, { id: 'skeleton', x: 1510, y: 540 },
    ],
  },
  {
    id: 'celestial-fall',
    bossKind: 'voidSeraph',
    bossPattern: 'seraphBarrage',
    zoneColors: [0x1e293b, 0x334155, 0x3b0764, 0x1e1b4b],
    roadOuter: 0xca8a04,
    roadInner: 0xfef08a,
    arenaWall: 0x1e1b4b,
    arenaWindow: 0xfacc15,
    arenaFloor: 0x312e81,
    arenaAccent: 0xfacc15,
    villages: [
      { id: 'oakvale', x: 185, y: 480 },
      { id: 'ironhold', x: 940, y: 480 },
      { id: 'dawnspire', x: 1340, y: 780 },
    ],
    roadPoints: [
      [185, 480], [1680, 480],
    ],
    secondaryRoadPoints: [
      [440, 480], [560, 190], [1340, 190], [1500, 480],
    ],
    routeSigns: [
      { labelKey: 'sign.risk', x: 520, y: 250, color: '#fef08a' },
      { labelKey: 'sign.merchant', x: 520, y: 540, color: '#c084fc' },
    ],
    barriers: [
      { x: 580, y: 310, w: 720, h: 90, style: 'voidChasm' },
      { x: 580, y: 570, w: 720, h: 90, style: 'voidChasm' },
    ],
    pois: [
      { kind: 'timeCrystal', x: 940, y: 190 },
      { kind: 'powerShrine', x: 940, y: 780 },
      { kind: 'shortcutPortal', x: 1340, y: 190 },
    ],
    obstacles: [
      { x: 350, y: 260, kind: 'rock-ash', radius: 26 },
      { x: 350, y: 700, kind: 'rock-ash', radius: 26 },
      { x: 1480, y: 280, kind: 'rock-ash', radius: 26 },
      { x: 1480, y: 680, kind: 'rock-ash', radius: 26 },
    ],
    enemySpawns: [
      { id: 'slime', x: 320, y: 440 }, { id: 'slime', x: 380, y: 530 },
      { id: 'goblin', x: 660, y: 480 }, { id: 'goblin', x: 790, y: 480 }, { id: 'skeleton', x: 1120, y: 480 },
      { id: 'skeleton', x: 700, y: 190 }, { id: 'skeleton', x: 1140, y: 190 },
      { id: 'goblin', x: 700, y: 780 }, { id: 'skeleton', x: 1140, y: 780 },
      { id: 'skeleton', x: 1520, y: 460 }, { id: 'skeleton', x: 1520, y: 540 },
    ],
  },
];

export interface ChapterStageInfo {
  chapter: ChapterDef;
  chapterNumber: number; // 1-based
  episodeIndex: number; // 1..5 within this cycle
  roman: string; // Continues VI..X on 2nd cycle of a chapter!
  isFinale: boolean;
}

/** 0-based cycle index (0 = CH.1..5 / I..V, 1 = CH.6..10 / VI..X, ...). */
export function getCycleForLoop(loop: number): number {
  const safeLoop = Math.max(1, Math.floor(loop));
  return Math.floor((safeLoop - 1) / (CHAPTERS.length * EPISODES_PER_CHAPTER));
}

/** Resolves a (cycle, chapterOffset 0..4, episodeIndex 1..5) grid cell in Camp back to its 1-based loop number. */
export function getLoopForCycleCell(cycle: number, chapterOffset: number, episodeIndex: number): number {
  const safeCycle = Math.max(0, Math.floor(cycle));
  return safeCycle * CHAPTERS.length * EPISODES_PER_CHAPTER + chapterOffset * EPISODES_PER_CHAPTER + episodeIndex;
}

/** Resolves any positive loop number into its Chapter, continuing Roman numeral (I..V, VI..X...), and Finale flag. */
export function getChapterForLoop(loop: number): ChapterStageInfo {
  const safeLoop = Math.max(1, Math.floor(loop));
  const zeroBased = safeLoop - 1;
  const chapterIdx = Math.floor(zeroBased / EPISODES_PER_CHAPTER);
  const episodeIndex = (zeroBased % EPISODES_PER_CHAPTER) + 1;
  const cycleIndex = Math.floor(chapterIdx / CHAPTERS.length);
  const displayEpisodeNumber = cycleIndex * EPISODES_PER_CHAPTER + episodeIndex;
  const chapter = CHAPTERS[chapterIdx % CHAPTERS.length];
  return {
    chapter,
    chapterNumber: chapterIdx + 1,
    episodeIndex,
    roman: toRoman(displayEpisodeNumber),
    isFinale: episodeIndex === EPISODES_PER_CHAPTER,
  };
}

/** Smooth circle-vs-circle push-out so solid trees/rocks block movement while letting the hero slide cleanly around corners. */
export function resolveObstacleCollision(
  x: number,
  y: number,
  heroRadius: number,
  obstacles: readonly ObstaclePlacement[],
  barriers: readonly BarrierRect[] = [],
): { x: number; y: number } {
  let rx = x;
  let ry = y;
  for (const ob of obstacles) {
    const dx = rx - ob.x;
    const dy = ry - ob.y;
    const minDist = heroRadius + ob.radius;
    const distSq = dx * dx + dy * dy;
    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq);
      if (dist < 0.001) {
        rx += minDist;
      } else {
        const push = minDist - dist;
        rx += (dx / dist) * push;
        ry += (dy / dist) * push;
      }
    }
  }
  // Solid rectangular canyon / lava-river barriers (pushes out along shortest axis for smooth sliding)
  for (const b of barriers) {
    const minX = b.x - heroRadius;
    const maxX = b.x + b.w + heroRadius;
    const minY = b.y - heroRadius;
    const maxY = b.y + b.h + heroRadius;
    if (rx > minX && rx < maxX && ry > minY && ry < maxY) {
      const penLeft = rx - minX;
      const penRight = maxX - rx;
      const penTop = ry - minY;
      const penBottom = maxY - ry;
      const m = Math.min(penLeft, penRight, penTop, penBottom);
      if (m === penTop) ry = minY;
      else if (m === penBottom) ry = maxY;
      else if (m === penLeft) rx = minX;
      else rx = maxX;
    }
  }
  return { x: rx, y: ry };
}
