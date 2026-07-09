# 戰鬥畫面吞食天地II形式復刻 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `BattleScene` 呈現層改造成 FC《天地を喰らうII》形式:5 列對峙、名字+兵力數字外側堆疊、10 段式血條、sprite 站條上、左下肖像窗、右下指令/訊息窗、地形帶,加上原作式回合演出(前進一步/前衝/閃爍/數字滾動/逐字訊息)。

**Architecture:** 版面座標與段數計算全部抽成純函式(`src/ui/` 下,真行為測試),Phaser 端只做薄繪製與 tween 編排;戰鬥邏輯(傷害/回合順序/AoA/勸降)一行不改,只重排呈現。BattleScene 佈線用既有的 source-regex 測試模式驗證。

**Tech Stack:** Phaser 3 + TypeScript + Vite + vitest。字體:Fusion Pixel Font(OFL-1.1)。

**Spec:** `docs/specs/pixel-squad/battle-screen-tenchi2-homage.md`(先整份讀完再動工)。

## Global Constraints

- 工作目錄:`workspace-pixel-squad/`(所有相對路徑以此為根;docs 在外層 repo 根)。
- 畫布 360×640 直式,`pixelArt: true`(`src/main.ts:12-24`),勿改。
- **戰鬥邏輯零變更**:傷害計算、`computeTurnOrder`、AoA 觸發、勸降條件、指令集(自動/攻擊/技能/防禦/勸降)不增不減。
- 配色 token 沿用:`TEAM_ALLY 0xf5a623`、`TEAM_ENEMY 0xb083e6`、`BG_BATTLE 0x000000`(`src/ui/theme.ts`)。
- 遊戲文字為繁體中文。AI 生圖提示詞**禁止**出現「天地を喰らう」「吞食天地」「Capcom」或原作角色名。
- 測試分工:純函式=真行為測試;BattleScene 佈線=source-regex 測試(模式見 `tests/unit/support/extractMethod.ts` 與 `tests/unit/BattleScene.retroHud.test.ts`)。
- 測試指令一律 `cd workspace-pixel-squad && npx vitest run <file>`。**若 sandbox 擋 npm/npx**(過去自動化 session 發生過):改為 static review + 把「需人工執行的指令清單」寫進回報,不要空轉重試。
- 檔內行號錨點取自 2026-07-09 HEAD,動工後會漂移——**以符號名定位,行號只是輔助**。
- 每個 task 結尾 commit;訊息用 `feat(pixel-squad): ...` / `fix(pixel-squad): ...` / `docs(pixel-squad): ...`。

---

### Task 1: 列版面純函式 `computeRowLayoutV2` + `fillSegments`

**Files:**
- Modify: `src/ui/characterRow.ts`(現有 `ROW_LAYOUT`/`computeRowAnchors` 保留不刪,新增 V2)
- Test: `tests/unit/characterRow.test.ts`(追加 describe 區塊)

**Interfaces:**
- Produces(後續 Task 5/7 依賴,簽名照抄):

```ts
export const ROW_V2 = {
  EDGE_MARGIN: 6,     // 名字距畫布邊緣
  NAME_DY: -20,       // 名字 y = cy + NAME_DY
  NUMBER_DY: -4,      // 兵力數字 y = cy + NUMBER_DY
  BAR_EDGE_INSET: 58, // 血條外側端距畫布邊緣
  SEGMENTS: 10,
  SEGMENT_W: 8,
  SEGMENT_GAP: 1,
  BAR_DY: 18,         // 血條上緣 y = cy + BAR_DY
  BAR_HEIGHT: 8,
  SPRITE_INSET: 0.8,  // sprite x 在條上靠中線 80% 處
  SPRITE_DY: -10,     // sprite 中心 y = cy + SPRITE_DY(44×56,底邊貼條上緣)
  STEP_DX: 12,        // 前進一步位移(往中線)
} as const;

export interface RowLayoutV2 {
  nameX: number;        // 名字錨點 x
  nameOriginX: 0 | 1;   // 我方 0(左對齊)、敵方 1(右對齊)
  barX: number;         // 血條最左段的左緣 x
  barWidth: number;     // 10 段總寬 = 89
  segmentXs: number[];  // 每段左緣 x,**由外側往中線排序**(我方遞增、敵方遞減)
  spriteX: number;
  stepDX: number;       // 我方 +12、敵方 -12
}

export function computeRowLayoutV2(isPlayer: boolean, canvasWidth: number): RowLayoutV2;
export function fillSegments(hp: number, maxHp: number, segments: number): number;
```

- [x] **Step 1: 寫失敗測試**(追加到 `tests/unit/characterRow.test.ts`)

```ts
import { computeRowLayoutV2, fillSegments, ROW_V2 } from '../../src/ui/characterRow';

describe('computeRowLayoutV2', () => {
  const W = 360;
  it('我方:名字左對齊在左緣、血條從 58 起、sprite 在條上 80% 處', () => {
    const r = computeRowLayoutV2(true, W);
    expect(r.nameX).toBe(6);
    expect(r.nameOriginX).toBe(0);
    expect(r.barX).toBe(58);
    expect(r.barWidth).toBe(89); // 10*8 + 9*1
    expect(r.spriteX).toBe(129); // round(58 + 89*0.8)
    expect(r.stepDX).toBe(12);
    expect(r.segmentXs).toHaveLength(10);
    expect(r.segmentXs[0]).toBe(58);            // 最外段
    expect(r.segmentXs[9]).toBe(58 + 9 * 9);    // 最內段(每段間距 9px)
  });
  it('敵方:鏡像', () => {
    const r = computeRowLayoutV2(false, W);
    expect(r.nameX).toBe(354);
    expect(r.nameOriginX).toBe(1);
    expect(r.barX).toBe(213); // 360-58-89
    expect(r.spriteX).toBe(231); // round(360-129.2)
    expect(r.stepDX).toBe(-12);
    expect(r.segmentXs[0]).toBe(213 + 9 * 9); // 最外段=最右段
    expect(r.segmentXs[9]).toBe(213);         // 最內段=最左段
  });
  it('兩側 sprite 不越過中線(含前進一步與前衝 24px)', () => {
    const p = computeRowLayoutV2(true, W);
    const e = computeRowLayoutV2(false, W);
    expect(p.spriteX + p.stepDX + 24 + 22).toBeLessThan(e.spriteX + e.stepDX - 24 - 22 + 44);
  });
});

describe('fillSegments', () => {
  it('滿血 10 段', () => expect(fillSegments(100, 100, 10)).toBe(10));
  it('過半 6 段', () => expect(fillSegments(51, 100, 10)).toBe(6));
  it('殘血至少 1 段', () => expect(fillSegments(1, 9999, 10)).toBe(1));
  it('0 血 0 段', () => expect(fillSegments(0, 100, 10)).toBe(0));
  it('負值視為 0', () => expect(fillSegments(-5, 100, 10)).toBe(0));
  it('溢血封頂', () => expect(fillSegments(150, 100, 10)).toBe(10));
});
```

- [x] **Step 2: 跑測試確認失敗**

Run: `cd workspace-pixel-squad && npx vitest run tests/unit/characterRow.test.ts`
Expected: FAIL(`computeRowLayoutV2` is not exported)

- [x] **Step 3: 實作**(追加到 `src/ui/characterRow.ts`,上方 Interfaces 區塊的 `ROW_V2`/`RowLayoutV2` 原文照貼,再加:)

```ts
export function computeRowLayoutV2(isPlayer: boolean, canvasWidth: number): RowLayoutV2 {
  const pitch = ROW_V2.SEGMENT_W + ROW_V2.SEGMENT_GAP;
  const barWidth = ROW_V2.SEGMENTS * ROW_V2.SEGMENT_W + (ROW_V2.SEGMENTS - 1) * ROW_V2.SEGMENT_GAP;
  const barX = isPlayer ? ROW_V2.BAR_EDGE_INSET : canvasWidth - ROW_V2.BAR_EDGE_INSET - barWidth;
  const segmentXs = Array.from({ length: ROW_V2.SEGMENTS }, (_, i) =>
    isPlayer ? barX + i * pitch : barX + (ROW_V2.SEGMENTS - 1 - i) * pitch
  );
  const inset = barWidth * ROW_V2.SPRITE_INSET;
  const spriteX = Math.round(isPlayer ? barX + inset : barX + barWidth - inset);
  return {
    nameX: isPlayer ? ROW_V2.EDGE_MARGIN : canvasWidth - ROW_V2.EDGE_MARGIN,
    nameOriginX: isPlayer ? 0 : 1,
    barX,
    barWidth,
    segmentXs,
    spriteX,
    stepDX: isPlayer ? ROW_V2.STEP_DX : -ROW_V2.STEP_DX,
  };
}

export function fillSegments(hp: number, maxHp: number, segments: number): number {
  if (hp <= 0 || maxHp <= 0) return 0;
  return Math.min(segments, Math.max(1, Math.ceil((hp / maxHp) * segments)));
}
```

- [x] **Step 4: 跑測試確認通過**(同 Step 2 指令,Expected: PASS,既有 `computeRowAnchors` 測試也不得壞)
- [x] **Step 5: Commit** — `git add workspace-pixel-squad/src/ui/characterRow.ts workspace-pixel-squad/tests/unit/characterRow.test.ts && git commit -m "feat(pixel-squad): add tenchi2-style row layout pure functions"`

---

### Task 2: 訊息模板 `battleMessages.ts`

**Files:**
- Create: `src/ui/battleMessages.ts`
- Test: `tests/unit/battleMessages.test.ts`

**Interfaces:**
- Produces(Task 7 依賴):

```ts
export function attackMessage(name: string): string;                 // `${name} 的攻擊!`
export function skillMessage(name: string, skill: string): string;   // `${name} 使出 ${skill}!`
export function damageMessage(name: string, dmg: number, opts?: { crit?: boolean; weakness?: boolean }): string;
export function missMessage(name: string): string;                   // `${name} 閃過了攻擊!`
export function defeatMessage(name: string): string;                 // `${name} 被擊敗了!`
export function defendMessage(name: string): string;                 // `${name} 擺出防禦姿態。`
export function healMessage(name: string, amount: number): string;   // `${name} 回復了 ${amount} 點兵力!`
```

- [x] **Step 1: 寫失敗測試**

```ts
import { attackMessage, skillMessage, damageMessage, missMessage, defeatMessage, defendMessage, healMessage } from '../../src/ui/battleMessages';

describe('battleMessages', () => {
  it('攻擊', () => expect(attackMessage('Rex')).toBe('Rex 的攻擊!'));
  it('技能', () => expect(skillMessage('Nyx', '狙擊')).toBe('Nyx 使出 狙擊!'));
  it('傷害', () => expect(damageMessage('敵人', 142)).toBe('敵人 受到 142 點傷害!'));
  it('暴擊前綴', () => expect(damageMessage('敵人', 300, { crit: true })).toBe('會心一擊!敵人 受到 300 點傷害!'));
  it('弱點前綴', () => expect(damageMessage('敵人', 200, { weakness: true })).toBe('擊中弱點!敵人 受到 200 點傷害!'));
  it('暴擊優先於弱點', () => expect(damageMessage('敵人', 400, { crit: true, weakness: true })).toBe('會心一擊!敵人 受到 400 點傷害!'));
  it('MISS', () => expect(missMessage('Echo')).toBe('Echo 閃過了攻擊!'));
  it('擊敗', () => expect(defeatMessage('demon')).toBe('demon 被擊敗了!'));
  it('防禦', () => expect(defendMessage('Rook')).toBe('Rook 擺出防禦姿態。'));
  it('回復', () => expect(healMessage('Mira', 80)).toBe('Mira 回復了 80 點兵力!'));
});
```

- [x] **Step 2: 跑測試確認失敗** — `npx vitest run tests/unit/battleMessages.test.ts`,Expected: FAIL(module not found)
- [x] **Step 3: 實作 `src/ui/battleMessages.ts`**

```ts
export function attackMessage(name: string): string { return `${name} 的攻擊!`; }
export function skillMessage(name: string, skill: string): string { return `${name} 使出 ${skill}!`; }
export function damageMessage(name: string, dmg: number, opts?: { crit?: boolean; weakness?: boolean }): string {
  const prefix = opts?.crit ? '會心一擊!' : opts?.weakness ? '擊中弱點!' : '';
  return `${prefix}${name} 受到 ${dmg} 點傷害!`;
}
export function missMessage(name: string): string { return `${name} 閃過了攻擊!`; }
export function defeatMessage(name: string): string { return `${name} 被擊敗了!`; }
export function defendMessage(name: string): string { return `${name} 擺出防禦姿態。`; }
export function healMessage(name: string, amount: number): string { return `${name} 回復了 ${amount} 點兵力!`; }
```

- [x] **Step 4: 跑測試確認通過**
- [x] **Step 5: Commit** — `git commit -m "feat(pixel-squad): add battle message templates"`

---

### Task 3: 視窗框 `battleWindow.ts` + 地形帶 `terrainStrip.ts`

**Files:**
- Create: `src/ui/battleWindow.ts`、`src/ui/terrainStrip.ts`
- Test: `tests/unit/battleWindow.test.ts`、`tests/unit/terrainStrip.test.ts`

**Interfaces:**
- Produces(Task 6 依賴):

```ts
// battleWindow.ts — 原作式雙線白框
export interface FrameRect { x: number; y: number; w: number; h: number; }
export interface WindowFrame { bg: FrameRect; outer: FrameRect; inner: FrameRect; }
export function windowFrameRects(x: number, y: number, w: number, h: number): WindowFrame;
// bg = 整塊 (x,y,w,h);outer = 內縮 1px 的 2px 白色描邊框;inner = 內縮 5px 的 1px 白色描邊框
export function drawWindow(g: Phaser.GameObjects.Graphics, f: WindowFrame): void;

// terrainStrip.ts — 程式繪製的地形帶(無圖檔)
export interface PatternRect { x: number; y: number; w: number; h: number; color: number; }
export function terrainPattern(width: number, topY: number): PatternRect[];
// 上帶 y∈[topY, topY+24):底色 0x0a2a33 + 波紋短橫線 0x2e8ba3(每 12px 一條,奇偶列錯位 6px)
// 下帶 y∈[topY+24, topY+56):底色 0x3a2416 + 碎石點 0xb0552a(8px 網格,棋盤格取半)
export function drawTerrainStrip(g: Phaser.GameObjects.Graphics, rects: PatternRect[]): void;
```

- [x] **Step 1: 寫失敗測試**(兩個測試檔)

```ts
// tests/unit/battleWindow.test.ts
import { windowFrameRects } from '../../src/ui/battleWindow';
describe('windowFrameRects', () => {
  it('bg 為整塊、outer 內縮 1、inner 內縮 5', () => {
    const f = windowFrameRects(118, 468, 236, 104);
    expect(f.bg).toEqual({ x: 118, y: 468, w: 236, h: 104 });
    expect(f.outer).toEqual({ x: 119, y: 469, w: 234, h: 102 });
    expect(f.inner).toEqual({ x: 123, y: 473, w: 226, h: 94 });
  });
});
```

```ts
// tests/unit/terrainStrip.test.ts
import { terrainPattern } from '../../src/ui/terrainStrip';
describe('terrainPattern', () => {
  const rects = terrainPattern(360, 580);
  it('至少有底色兩塊+圖樣', () => expect(rects.length).toBeGreaterThan(10));
  it('全部落在帶內', () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(360);
      expect(r.y).toBeGreaterThanOrEqual(580);
      expect(r.y + r.h).toBeLessThanOrEqual(580 + 56);
    }
  });
  it('確定性(同輸入同輸出)', () => expect(terrainPattern(360, 580)).toEqual(rects));
});
```

- [x] **Step 2: 跑測試確認失敗** — `npx vitest run tests/unit/battleWindow.test.ts tests/unit/terrainStrip.test.ts`
- [x] **Step 3: 實作**

```ts
// src/ui/battleWindow.ts
export interface FrameRect { x: number; y: number; w: number; h: number; }
export interface WindowFrame { bg: FrameRect; outer: FrameRect; inner: FrameRect; }

export function windowFrameRects(x: number, y: number, w: number, h: number): WindowFrame {
  return {
    bg: { x, y, w, h },
    outer: { x: x + 1, y: y + 1, w: w - 2, h: h - 2 },
    inner: { x: x + 5, y: y + 5, w: w - 10, h: h - 10 },
  };
}

export function drawWindow(g: Phaser.GameObjects.Graphics, f: WindowFrame): void {
  g.fillStyle(0x000000, 1);
  g.fillRect(f.bg.x, f.bg.y, f.bg.w, f.bg.h);
  g.lineStyle(2, 0xffffff, 1);
  g.strokeRect(f.outer.x, f.outer.y, f.outer.w, f.outer.h);
  g.lineStyle(1, 0xffffff, 1);
  g.strokeRect(f.inner.x, f.inner.y, f.inner.w, f.inner.h);
}
```

```ts
// src/ui/terrainStrip.ts
export interface PatternRect { x: number; y: number; w: number; h: number; color: number; }

export function terrainPattern(width: number, topY: number): PatternRect[] {
  const rects: PatternRect[] = [];
  rects.push({ x: 0, y: topY, w: width, h: 24, color: 0x0a2a33 });        // 水帶底色
  rects.push({ x: 0, y: topY + 24, w: width, h: 32, color: 0x3a2416 });   // 地帶底色
  for (let row = 0; row < 2; row++) {                                      // 波紋
    const y = topY + 6 + row * 12;
    const offset = row % 2 === 0 ? 0 : 6;
    for (let x = offset; x < width; x += 12) {
      rects.push({ x, y, w: 6, h: 2, color: 0x2e8ba3 });
    }
  }
  for (let row = 0; row < 4; row++) {                                      // 碎石棋盤格
    const y = topY + 26 + row * 8;
    for (let col = 0; col < Math.floor(width / 8); col++) {
      if ((row + col) % 2 === 0) continue;
      rects.push({ x: col * 8 + 2, y: y + 2, w: 3, h: 3, color: 0xb0552a });
    }
  }
  return rects;
}

export function drawTerrainStrip(g: Phaser.GameObjects.Graphics, rects: PatternRect[]): void {
  for (const r of rects) {
    g.fillStyle(r.color, 1);
    g.fillRect(r.x, r.y, r.w, r.h);
  }
}
```

- [x] **Step 4: 跑測試確認通過**
- [x] **Step 5: Commit** — `git commit -m "feat(pixel-squad): add window frame and terrain strip renderers"`

---

### Task 4: 像素中文字體整合(Fusion Pixel Font)

**Files:**
- Create: `public/fonts/fusion-pixel-12px-proportional-zh_hant.woff2`(下載)
- Modify: `index.html`、`src/ui/theme.ts`、`src/main.ts`、`ASSET-CREDITS.md`
- Test: `tests/unit/theme.font.test.ts`

**Interfaces:**
- Produces:`theme.ts` 匯出 `export const FONT_FAMILY = '"Fusion Pixel 12px Proportional", monospace';`,全部 `TextStyles` 改用它。

- [x] **Step 1: 下載字體並確認授權**

```bash
cd workspace-pixel-squad
TAG=$(gh api repos/TakWolf/fusion-pixel-font/releases/latest --jq '.tag_name')
gh release download "$TAG" -R TakWolf/fusion-pixel-font -p '*woff2*' -D /tmp/fusion-font
# 解壓後找 fusion-pixel-12px-proportional-zh_hant.woff2,複製到 public/fonts/
mkdir -p public/fonts && unzip -o /tmp/fusion-font/*.zip -d /tmp/fusion-font/out
find /tmp/fusion-font/out -name '*12px*proportional*zh_hant*.woff2' -exec cp {} public/fonts/fusion-pixel-12px-proportional-zh_hant.woff2 \;
ls -la public/fonts/
```

Expected: woff2 檔存在(數百 KB)。確認 repo 的 LICENSE 為 **OFL-1.1**(`gh api repos/TakWolf/fusion-pixel-font --jq '.license.spdx_id'` → `OFL-1.1`)。若網路被擋:記錄手動下載指令到回報,先用 fallback(`FONT_FAMILY` 仍定義,瀏覽器 fallback 到 monospace,不會壞)繼續後續 task。

- [x] **Step 2: 寫失敗測試** `tests/unit/theme.font.test.ts`

```ts
import { FONT_FAMILY, TextStyles } from '../../src/ui/theme';
describe('pixel font integration', () => {
  it('FONT_FAMILY 指向 Fusion Pixel 並保留 monospace fallback', () => {
    expect(FONT_FAMILY).toContain('Fusion Pixel');
    expect(FONT_FAMILY).toContain('monospace');
  });
  it('所有 TextStyles 都使用 FONT_FAMILY', () => {
    for (const style of Object.values(TextStyles)) {
      expect((style as { fontFamily?: string }).fontFamily).toBe(FONT_FAMILY);
    }
  });
});
```

- [x] **Step 3: 跑測試確認失敗** — `npx vitest run tests/unit/theme.font.test.ts`(FONT_FAMILY not exported)
- [x] **Step 4: 實作**
  - `index.html` `<head>` 內加:

```html
<style>
  @font-face {
    font-family: 'Fusion Pixel 12px Proportional';
    src: url('/game_kyo/pixel-squad/fonts/fusion-pixel-12px-proportional-zh_hant.woff2') format('woff2');
    font-display: swap;
  }
</style>
```

  (注意 `vite.config.ts` 的 `base: '/game_kyo/pixel-squad/'`;本地 dev 時 Vite 會處理 base,若路徑 404 改用相對路徑 `fonts/...` 並以 dev server 實測為準。)
  - `src/ui/theme.ts`:加 `export const FONT_FAMILY = '"Fusion Pixel 12px Proportional", monospace';`,把 `TextStyles` 內所有 `fontFamily: 'monospace'` 換成 `fontFamily: FONT_FAMILY`。
  - `src/main.ts`:在 `new Phaser.Game(config)` 前確保字體載入(避免首屏文字量錯):

```ts
const boot = () => new Phaser.Game(config);
if (document.fonts?.load) {
  Promise.race([
    document.fonts.load('12px "Fusion Pixel 12px Proportional"'),
    new Promise((r) => setTimeout(r, 1500)),
  ]).then(boot);
} else {
  boot();
}
```

  - `ASSET-CREDITS.md` 加一條:`Fusion Pixel Font (TakWolf, https://github.com/TakWolf/fusion-pixel-font) — SIL OFL-1.1, used for all in-game text.`
- [x] **Step 5: 跑測試確認通過**;再跑 `npx vitest run` 全套確認無其他測試因 theme 改動而壞(有 regex 測試檢查 `fontFamily: 'monospace'` 的話同步更新其斷言)
- [x] **Step 6: Commit** — `git commit -m "feat(pixel-squad): integrate Fusion Pixel CJK font (OFL-1.1)"`

---

### Task 5: `renderParty()` 改用 V2 版面(名字堆疊/分段血條/sprite 站條/朝向修正)

**Files:**
- Modify: `src/scenes/BattleScene.ts`(`renderParty()` :226-285、`updateHpBar()` :287-293、欄位宣告)
- Modify/Test: `tests/unit/BattleScene.retroHud.test.ts` 及其他受錨點影響的 regex 測試(共 12 檔,跑全套找出)

**Interfaces:**
- Consumes:Task 1 的 `computeRowLayoutV2`、`fillSegments`、`ROW_V2`。
- Produces:BattleScene 內每個角色的 render 資料改存 `hpSegments: Phaser.GameObjects.Rectangle[]`(取代單一 fill bar)與 `hpText`;`updateHpDisplay(character)` 取代 `updateHpBar`(舊名可保留為轉呼叫)。sprite `originX` 概念不變(`CharacterAnimator` 依 `originX` 回位)。

- [x] **Step 1: 先讀後改** — 通讀 `renderParty()`、`updateHpBar()`、`onPlayerBodyTap` 佈線(:281-282)、`setCommandIcon`(:308-312),列出所有引用 `computeRowAnchors` 回傳值的地方。
- [x] **Step 2: 更新 regex 測試為新期望**(先紅):`BattleScene.retroHud.test.ts` 改斷言 `renderParty()` 內出現 `computeRowLayoutV2(`、`fillSegments(`、`ROW_V2`,且不再出現 `archetype` 文字建立(職業字樣移到肖像窗,Task 6)。跑 `npx vitest run tests/unit/BattleScene.retroHud.test.ts` 確認 FAIL。
- [x] **Step 3: 改 `renderParty()`**,每列改為:

```ts
const layout = computeRowLayoutV2(isPlayer, this.scale.width);
// 名字(外側,堆疊上行)
const nameText = this.add.text(layout.nameX, cy + ROW_V2.NAME_DY, c.name, TextStyles.BATTLE_NAME)
  .setOrigin(layout.nameOriginX, 0.5);
// 兵力數字(名字正下方,同錨點同對齊)
const hpText = this.add.text(layout.nameX, cy + ROW_V2.NUMBER_DY, String(c.hp), TextStyles.BATTLE_NAME)
  .setOrigin(layout.nameOriginX, 0.5);
// 分段血條:10 段個別 Rectangle,存進 render 資料
const teamColor = isPlayer ? Colors.TEAM_ALLY : Colors.TEAM_ENEMY;
const hpSegments = layout.segmentXs.map((sx) =>
  this.add.rectangle(sx, cy + ROW_V2.BAR_DY, ROW_V2.SEGMENT_W, ROW_V2.BAR_HEIGHT, teamColor)
    .setOrigin(0, 0)
);
// sprite 站在條上
// body 建立邏輯照舊(sprite/image/rect 分支),但位置改 (layout.spriteX, cy + ROW_V2.SPRITE_DY)
// 敵方朝向修正:if (!isPlayer && body.setFlipX) body.setFlipX(true);
//   → 實作前先目視確認 monster 素材原始朝向(開 dev server 或看 PNG),
//     原則:敵我 sprite 皆面向中線;若 CraftPix 原圖已面向左則不需 flip。
//     同步檢查 AnimationState.deriveFacing(:68-76) 讓 walk/attack 位移方向與朝向一致。
```

  狀態圖示 y 改 `cy - 46`(sprite 正上方,x 用 `layout.spriteX`);弱點圖示 `layout.spriteX ± 22, cy - 30`(外側斜上);指令小圖示改掛名字右側(`nameText` 右緣 + 10)。初始 fill:`hpSegments` 依 `fillSegments(c.hp, c.maxHp, ROW_V2.SEGMENTS)`,超過的段 `setFillStyle(0x2a2a2a)`。
- [x] **Step 4: 改 `updateHpDisplay(character)`**(取代 `updateHpBar` 內容,舊名轉呼叫新名以免其他 call site 壞):

```ts
private updateHpDisplay(c: BattleCharacter): void {
  const r = this.renderData.get(c.id); // 依實際的 render 資料結構名稱調整
  if (!r) return;
  r.hpText.setText(String(Math.max(0, c.hp)));
  const filled = fillSegments(c.hp, c.maxHp, ROW_V2.SEGMENTS);
  const teamColor = c.isPlayer ? Colors.TEAM_ALLY : Colors.TEAM_ENEMY;
  r.hpSegments.forEach((seg, i) => seg.setFillStyle(i < filled ? teamColor : 0x2a2a2a));
}
```

- [x] **Step 5: 跑全套測試** — `npx vitest run`。逐一修正因錨點/字樣改變而壞的 regex 測試(**保留其原始意圖**:例如 tap 選人測試改斷言 `layout.spriteX`,不是刪測試)。Expected: 全綠。
- [x] **Step 6: Commit** — `git commit -m "feat(pixel-squad): rebuild battle rows in tenchi2 layout (stacked labels, segmented bars, sprite-on-bar, enemy facing fix)"`

---

### Task 6: 底部視窗帶(肖像窗/指令窗/地形帶)+ 選單搬遷

**Files:**
- Modify: `src/scenes/BattleScene.ts`(`create()`、`showCommandMenu()` :378-461、`showSkillPicker`、`showAoaPrompt()` :892-955、preload)
- Create: `public/sprites/portraits/.gitkeep`
- Test: 更新 `tests/unit/BattleScene.retroHud.test.ts` + 相關 regex 測試

**Interfaces:**
- Consumes:Task 3 的 `windowFrameRects/drawWindow/terrainPattern/drawTerrainStrip`。
- Produces:場景方法 `showPortrait(c: BattleCharacter): void`、常數 `PORTRAIT_WIN = { x: 6, y: 468, w: 104, h: 104 }`、`COMMAND_WIN = { x: 118, y: 468, w: 236, h: 104 }`、`TERRAIN_TOP = 580`(供 Task 7 的訊息窗共用 `COMMAND_WIN`)。

- [x] **Step 1: 更新 regex 測試為新期望**(先紅):`create()` 內出現 `drawWindow(`、`drawTerrainStrip(`;`showCommandMenu` 內容器座標不再是 `(W/2, 590)` 而是 `COMMAND_WIN`。
- [x] **Step 2: `preload()` 加肖像載入(容錯)**

```ts
const portraitIds = [...PARTY_IDS, ...MONSTER_TYPES]; // 依 src/data/characters.ts 與 stages.ts 的實際匯出取得 18 個 id
for (const id of portraitIds) {
  this.load.image(`portrait_${id}`, `sprites/portraits/${id}.png`);
}
this.load.on('loaderror', (file: Phaser.Loader.File) => {
  if (file.key.startsWith('portrait_')) this.missingPortraits.add(file.key);
});
```

- [x] **Step 3: `create()` 繪製底部帶**

```ts
const g = this.add.graphics().setDepth(5);
drawWindow(g, windowFrameRects(PORTRAIT_WIN.x, PORTRAIT_WIN.y, PORTRAIT_WIN.w, PORTRAIT_WIN.h));
drawWindow(g, windowFrameRects(COMMAND_WIN.x, COMMAND_WIN.y, COMMAND_WIN.w, COMMAND_WIN.h));
drawTerrainStrip(g, terrainPattern(this.scale.width, TERRAIN_TOP));
```

- [x] **Step 4: `showPortrait(c)`** — 窗內 96×96:有 `portrait_${id}` 貼圖且不在 `missingPortraits` → `add.image` 置中;否則暗色剪影(`add.rectangle(cx, cy, 80, 80, 0x1a1a1a)`)。下方一行小字 `${c.name}·${c.archetype}`(這裡接手 Task 5 移除的職業字樣)。指令階段在 `advanceCommandInput()` 對當前角色呼叫;執行階段在每個行動者開演出時呼叫(敵我皆換,Task 7 接手)。
- [x] **Step 5: 選單搬進指令窗** — `showCommandMenu()` 容器改 `(COMMAND_WIN.x, COMMAND_WIN.y)`;項目 2 欄排列:欄 x = 16 / 124,列 y = 22 / 48 / 74;每項左側 `▶` 游標 text(預設隱藏,pointerover/最後點擊顯示)。**項目與 handler 完全沿用既有邏輯**(自動/攻擊/技能/防禦/勸降)。`showSkillPicker` 同法移入同窗。`showAoaPrompt` 只換視覺(在 `COMMAND_WIN` 內畫,套 `drawWindow` 風格),觸發與 handler 不動。
- [x] **Step 6: 跑全套測試修 regex 斷言;Commit** — `git commit -m "feat(pixel-squad): bottom window band (portrait / command window / terrain strip)"`

---

### Task 7: 戰鬥演出管線(逐字訊息/數字滾動/前進一步/idle 抖動修復)

**Files:**
- Create: `src/ui/typewriter.ts`
- Modify: `src/scenes/BattleScene.ts`(執行階段:`startExecution`/`executePlayerCommand` :659 附近、`applyDamageAndAdvance` :927 附近、`advanceCommandInput` :364-376)、`src/battle/CharacterAnimator.ts`(`playIdleLoop` :25-42)
- Test: `tests/unit/typewriter.test.ts`、更新 BattleScene regex 測試

**Interfaces:**
- Consumes:Task 2 訊息模板、Task 5 `updateHpDisplay`、Task 6 `COMMAND_WIN`/`showPortrait`。
- Produces:

```ts
// src/ui/typewriter.ts
export function visibleChars(elapsedMs: number, cps: number, total: number): number;
// = Math.min(total, Math.floor((elapsedMs / 1000) * cps)),cps=30
// BattleScene 方法
private showBattleMessage(text: string, onDone: () => void): void; // 逐字顯示於 COMMAND_WIN,點擊跳過該則
private rollHpNumber(c: BattleCharacter, from: number, to: number, onDone: () => void): void; // ~400ms tween counter,onUpdate 呼叫 updateHpDisplay 風格的顯示
private stepForward(c: BattleCharacter): void;  // sprite x tween +layout.stepDX,150ms
private stepBack(c: BattleCharacter): void;     // tween 回 originX
```

- [x] **Step 1: `visibleChars` 失敗測試 → 實作 → 綠**

```ts
// tests/unit/typewriter.test.ts
import { visibleChars } from '../../src/ui/typewriter';
describe('visibleChars', () => {
  it('0ms 顯示 0 字', () => expect(visibleChars(0, 30, 10)).toBe(0));
  it('1 秒 30 字', () => expect(visibleChars(1000, 30, 100)).toBe(30));
  it('封頂於總長', () => expect(visibleChars(9999, 30, 10)).toBe(10));
});
```

- [x] **Step 2: 場景方法實作**
  - `showBattleMessage`:在 `COMMAND_WIN` 內建 text(自動換行 `wordWrap: { width: COMMAND_WIN.w - 32 }`),用 `this.time.addEvent` 每 33ms 依 `visibleChars` 更新 `setText(text.slice(0, n))`;整窗 `setInteractive` 一次點擊 → 直接顯示全文,再點或 600ms 後 `onDone()`。一次只有一則(新訊息先清舊 timer)。
  - `rollHpNumber`:`this.tweens.addCounter({ from, to, duration: 400, onUpdate: ... })`,onUpdate 時 setText 四捨五入值並依比例更新 `hpSegments` 填色(用 `fillSegments(當前值, maxHp, 10)`);onComplete 呼叫 `updateHpDisplay(c)` 對齊最終態後 `onDone()`。
  - `stepForward/stepBack`:tween body.x 到 `originX ± stepDX` / 回 `originX`,150ms。**注意與 `CharacterAnimator.playWalk`(±24px)和 `returnToIdle` 的 originX 互動**:先讀 `CharacterAnimator.ts` 確認 originX 儲存位置,step 位移必須以「不污染 originX」的方式做(tween 目標值計算自 originX,結束一定回 originX),避免累積漂移。
- [x] **Step 3: 編排單次行動時間軸**(改 `executePlayerCommand`/敵方行動的對應方法與 `applyDamageAndAdvance`,先讀完現有 callback 鏈再插入):

```
showPortrait(actor) → stepForward(actor)
→ showBattleMessage(attackMessage/skillMessage/defendMessage(...))
→ [攻擊/技能才有] animator.playWalk → playAttack → 目標 playHit(既有)
   同時 rollHpNumber(target, oldHp, newHp)
→ showBattleMessage(damageMessage/missMessage(...))
→ [死亡] playDie + showBattleMessage(defeatMessage(...))
→ stepBack(actor) → 原本的 next()/onDone() 繼續
```

  傷害數值**取自既有結算結果**,不重算。防禦/自動/勸降走各自既有分支,只包 `showBattleMessage`。指令階段:`advanceCommandInput()` 對當前角色 `stepForward`,選定指令後 `stepBack`。
- [x] **Step 4: idle 抖動修復(`CharacterAnimator.playIdleLoop` :25-42)** — 先重現:讀該方法,確認 monster(Image fallback)走 scaleY 呼吸 tween 分支;QA 記錄「忽大忽小跳動」的可能原因是 tween 目標用**絕對 scale 值**而 monster 原始 scale ≠ 1(256×256 縮到 44×56)。修法:呼吸幅度改**相對**目前 scale(`scaleY: body.scaleY * 1.03`,yoyo),且開始前若已有 idle tween 先 kill。**先確認再改**,若實因不同(例如 anims 與 tween 雙重套用)按實因修,並在 commit message 寫明根因。
- [x] **Step 5: 更新 regex 測試**:斷言執行階段出現 `showBattleMessage(`、`rollHpNumber(`、`stepForward(`;`playIdleLoop` 內出現相對 scale 計算。跑全套 `npx vitest run` 至全綠。
- [x] **Step 6: Commit** — `git commit -m "feat(pixel-squad): tenchi2-style battle presentation pipeline (typewriter, hp roll, step-forward) + fix monster idle jitter"`

---

### Task 8: 肖像素材管線(18 張,生成為使用者協作步驟)

**Files:**
- Modify: `docs/specs/pixel-squad/battle-screen-tenchi2-homage.md`(如提示詞有微調,回寫)
- Create: `public/sprites/portraits/*.png`(若本 session 有生圖工具;否則交付提示詞清單)

- [x] **Step 1:** 檢查本 session 是否有可用的圖像生成工具。**有** → 用 spec「美術規範」節的共用前綴 + `battle-hud-retro-reskin.md` 附錄的 18 條個別描述逐張生成,裁切為 96×96、檔名 `{id}.png`(id 對照 `src/data/characters.ts` 的 12 角色 id 與 6 個 monsterType)。**沒有** → 產出一份可直接複製的 18 條完整提示詞清單(前綴+個別描述拼好)到回報,請使用者用外部工具生成後放入 `public/sprites/portraits/`;fallback 剪影(Task 6)保證缺圖不壞。
- [x] **Step 2:** 提示詞紀律自檢:18 條中不得出現「天地を喰らう」「吞食天地」「Capcom」或任何三國人名。
- [ ] **Step 3:** 有產出圖檔才做:`ASSET-CREDITS.md` 依生圖工具條款加註;commit `feat(pixel-squad): add generated battle portraits`。

---

### Task 9: 視覺驗收 + 文件收尾

**Files:**
- Modify: `docs/specs/pixel-squad/backlog.md`、本 plan 檔(勾選進度)

- [x] **Step 1: build 驗證** — `cd workspace-pixel-squad && npx tsc --noEmit && npx vitest run`。Expected: 0 error、全綠。
- [x] **Step 2: 瀏覽器截圖驗收** — `npm run dev` 開 dev server,進入一場戰鬥,對照 spec「版面配置」節逐項檢查:名字/數字堆疊、10 段血條、sprite 站條上且面向中線、前進一步、肖像窗、指令窗雙線框、逐字訊息、數字滾動、地形帶、像素字體生效、敵人 idle 不再抖動。截圖存 `test-results/tenchi2-visual/`。**若 sandbox 擋 npm**:改交付「人工驗收清單」(上列各項)給使用者。
- [x] **Step 3: backlog 更新** — `docs/specs/pixel-squad/backlog.md` 的「戰鬥角色美術/動畫問題」條目:朝向與 idle 抖動兩個子項標記完成(註明由本 plan 修復),美術統一子項保留;本功能條目(commit 時已加,見下)勾選。
- [x] **Step 4: 最終 commit + push** — `git add -A && git commit -m "docs(pixel-squad): tenchi2 battle screen — visual QA results and backlog update" && git push origin master`

---

## Self-Review 紀錄(計劃完成時已檢)
- Spec 覆蓋:版面(T1/T5/T6)、演出(T7)、字體(T4)、訊息(T2)、視窗/地形(T3)、肖像+版權紀律(T6/T8)、QA 兩 bug(T5 朝向/T7 抖動)、測試策略(各 task)、瀏覽器驗收(T9)——無缺口。「不做什麼」各項無任何 task 觸碰。
- 型別一致:`computeRowLayoutV2/fillSegments/ROW_V2`(T1→T5/T7)、`windowFrameRects/drawWindow/terrainPattern/drawTerrainStrip`(T3→T6)、`COMMAND_WIN`(T6→T7)、訊息函式(T2→T7)簽名逐一核對相符。
- 已知不確定點(executor 需現場確認,plan 已標注):monster 素材原始朝向(T5)、idle 抖動根因(T7)、render 資料結構實際欄位名(T5)、字體檔於 release zip 內的確切檔名(T4)。
