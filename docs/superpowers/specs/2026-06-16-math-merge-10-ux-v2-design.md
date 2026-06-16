# Math Merge 10 — UX Enhancement v2 Design Spec

**Date:** 2026-06-16
**Status:** Approved

---

## 概述

六項玩家體驗優化，同步進行於同一個 game 目錄（`workspace/`）。所有改動都在 TypeScript + Vite + Canvas 2D 的現有架構上擴充，不引入新 framework。

---

## Feature 1：UI 版面重構（分數 + 按鈕移至 Footer）

### 現況問題
- 分數以 `ctx.fillText()` 畫在 canvas 內部左上角（`game.ts:238–239`），遊戲格子越密越被遮蔽
- 調色盤按鈕 `#palette-toggle` 疊在 canvas 右上角（`index.html:28–38`），與格子重疊

### 目標設計

```
┌──────────────────────────────┐
│                              │
│         4×4 canvas           │  ← 純遊戲區域，無 UI 疊加
│                              │
├──────────────────────────────┤
│  Score: 0    Best: 0  🎨 🔨  │  ← footer bar (HTML，非 canvas)
└──────────────────────────────┘
```

### 技術決定

1. **移除 canvas 內部分數繪製**：刪除 `game.ts:235–239` 的 `ctx.fillText` 兩行
2. **新增 `#hud` footer bar**：HTML element，放在 `#game-container` 底部
   - `#hud-score`：顯示 `Score: N`
   - `#hud-best`：顯示 `Best: N`
   - `#hud-palette-toggle`：原調色盤按鈕移至此
   - `#hud-powerups`：道具圖示欄位（Feature 5 用）
3. **分數同步**：`setState()` 和 `handleKeydown()` 中更新 `#hud-score` DOM
4. **`#palette-toggle` 移除或保留**：舊按鈕從 canvas overlay 改為 `#hud` 內的 `#hud-palette-toggle`，完全脫離 canvas

### CSS 結構
```css
#game-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}
#hud {
  width: 100%;          /* 跟 canvas 同寬 */
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #1a1a2e;
  border-radius: 0 0 8px 8px;
}
```

---

## Feature 2：調色盤 pairHint 重設計

### 現況問題
- `pairHint` 名義上是「配對提示」，但 3+7、4+6 色系完全不同
- 沒有一組 palette 讓加到 10 的配對視覺上有關聯

### 目標設計：同色不同明暗

| 配對 | 淺色（小數字） | 深色（大數字） | 色相 |
|------|-------------|-------------|------|
| 1 + 9 | `#bfdbfe` | `#1d4ed8` | 藍 |
| 2 + 8 | `#bbf7d0` | `#15803d` | 綠 |
| 3 + 7 | `#fed7aa` | `#c2410c` | 橙 |
| 4 + 6 | `#e9d5ff` | `#7c3aed` | 紫 |
| 5 | `#fef08a` | `#854d0e` | 黃金（自配自） |

**5 的特殊處理**：5 加 5 等於 10，所以它既是「小數字」也是「大數字」。選一個中間亮度的黃金色，不需要分淺/深。

### 修改範圍
只修改 `palettes.ts` 中 `pairHint` 的 9 個顏色值。`gradient` 和 `pastel` 保持不變。

---

## Feature 3：音效系統（Web Audio API）

### 設計原則
- **無音效檔案**：全部用 Web Audio API 程式化生成，零載入時間
- **首次互動後啟用**：`AudioContext` 在第一次鍵盤/觸控操作時初始化（瀏覽器 autoplay 政策）
- **靜音開關**：在 footer 加一個 🔊/🔇 按鈕，存 localStorage

### 音效設計

| 事件 | 音效類型 | 頻率 / 形狀 | 時長 |
|------|---------|------------|------|
| 移動（無消除） | 短促 click | 440Hz sine，快速 fade | 80ms |
| 消除一對 | 上升音 | 523→784Hz sine，fade out | 200ms |
| Combo ×2 | 雙音上升 | 523→659→784Hz | 300ms |
| Combo ×3+ | 三音上升 arpeggio | 523→659→784→1047Hz | 400ms |
| 生成新方塊 | 輕柔 pop | 880Hz triangle，快 | 60ms |
| 道具使用 | 特效音 | 各道具不同（見 Feature 5） |  |
| Game Over | 下降和弦 | 784→659→523→440Hz | 600ms |

### 新增檔案
`workspace/src/audio.ts`：export `AudioEngine` class，提供 `.play(event)` 方法，內部管理 `AudioContext` 生命週期。

### game.ts 整合點
- `handleKeydown()` 移動後：`audio.play("move")` 或 `audio.play("eliminate")`
- `showComboBadge()` 內：`audio.play("combo", count)`
- `setState()` 重設時：不播放（避免開始遊戲時有聲音）
- `isGameOver` 判斷後：`audio.play("gameOver")`

---

## Feature 4：碰撞動畫（格子滑動後碰撞消失）

### 現況問題
被消除的格子在**原始位置**原地閃爍消失，與「滑動後才相鄰」的邏輯不符，視覺上缺少「碰在一起才消失」的感覺。

### 目標動畫

```
ArrowLeft 按下：
  t=0:    [null, 3, null, 7]   ← 3 在 col1，7 在 col3
  t=0–150ms: 3 從 col1 滑向 col0，7 從 col3 滑向 col1（moveCells 動畫）
  t=150ms:  3 到 col0，7 到 col1，兩者相鄰 → 碰撞！
  t=150–350ms: 在 col0 和 col1 flash + shrink（eliminatingCells 動畫）
  t=350ms+: 完全消失
```

### 技術方案

**擴充 `EliminatedPair`（`grid.ts`）**：

```typescript
export interface EliminatedPair {
  a: { row: number; col: number };        // slide 前位置
  b: { row: number; col: number };        // slide 前位置
  meetA: { row: number; col: number };    // 新增：slide 後相遇位置（a 的終點）
  meetB: { row: number; col: number };    // 新增：slide 後相遇位置（b 的終點）
}
```

`slideRowLeft()` 在計算 `eliminatedIndices` 時同時計算相遇欄位（accumulated non-eliminated count 即為 meetA.col，meetA.col+1 為 meetB.col）。`slide()` 對 right/up/down 做相同的座標轉換。

**`startAnimations()` 修改（`game.ts`）**：

- `eliminatingCells` 的 key 改為 `meetA`/`meetB` 的位置，而非原始 `a`/`b` 的位置
- `startTime` 改為 `now + MOVE_DURATION_MS`（等移動動畫結束後才開始 flash）
- 消除動畫的 phantom 在 `meetA`/`meetB` 位置播放

**新增：moveCells 涵蓋消除 tile 的移動段**：

現在 `moveCells` 過濾掉了消除格子（`eliminatedPositionKeys` 排除在外）。改為：消除格子也加入 `moveCells`，方向與整體相同，但只播放到 `MOVE_DURATION_MS` 結束（然後切換到 eliminatingCells 接手）。

### 動畫時間軸
```
0ms         MOVE_DURATION_MS(150ms)     MOVE_DURATION_MS+ELIMINATE_DURATION_MS(500ms)
│──────────────────────│───────────────────────────────────│
│  moveCells（含消除格）  │  eliminatingCells（在 meet 位置）  │
```

---

## Feature 5：道具系統

### 道具清單

| 道具 | 圖示 | 效果 | 音效 |
|------|------|------|------|
| 🔨 錘子 | hammer | 點選任意方塊移除，不得分 | 金屬撞擊聲（短促高頻 clank） |
| 🔀 洗牌 | shuffle | 隨機重排現有方塊（不增減） | 洗牌音（快速連續 pop） |
| ➕ 加值 | addOne | 點選方塊 value+1（最大 9） | 上升短音 |
| 💣 炸彈 | bomb | 移除目標格子及其上下左右相鄰格子 | 爆炸音（低頻短 boom） |

### 取得方式

```
遊玩次數（playCount，存 localStorage）：
  每 5 局 → 隨機獲得 1 個道具（錘子或洗牌）
  每 10 局 → 獲得 1 個加值

最高分里程碑（bestScore，已存在）：
  首次達到 50 分 → 獲得 1 個炸彈
  每達到新的 100 分倍數 → 1 個炸彈

預留廣告鉤子（不實作，只留空函式）：
  rewardAd() → 返回 PowerupId，待接入廣告 SDK
```

### 狀態擴充

```typescript
// grid.ts 新增
export interface PowerupState {
  hammer: number;
  shuffle: number;
  addOne: number;
  bomb: number;
}

// game.ts
let powerups: PowerupState = loadPowerups();
let activePowerup: keyof PowerupState | null = null;
```

### 互動模式

1. 玩家點擊 footer 道具圖示 → `activePowerup` 設為該道具，canvas 外框變色（提示選取模式）
2. 玩家點擊/觸控 canvas 上的格子 → 根據 `activePowerup` 執行效果
3. 執行完畢 → `activePowerup = null`，canvas 恢復
4. 再次點擊同一道具圖示 → 取消選取模式

### 洗牌的隨機重排
使用現有 `rng` 函式（`game.ts:52`）對現有非 null 方塊做 Fisher-Yates shuffle，放回相同位置的格子（維持 null 格數量不變）。

---

## Feature 6：RWD + 手機觸控

### Canvas 自適應尺寸

```typescript
function resizeCanvas(): void {
  const HUD_HEIGHT = 56;          // footer bar 高度
  const PADDING = 16;             // 上下左右各 8px
  const available = Math.min(
    window.innerWidth - PADDING,
    window.innerHeight - HUD_HEIGHT - PADDING
  );
  const size = Math.min(available, 500);  // 最大 500px，桌機不放大

  canvas.width = size;
  canvas.height = size;
  render();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();  // 初始化時執行一次
```

`cellSize = canvas.width / GRID_SIZE` 已在 `render()` 中動態計算，RWD 後自動縮放。

### viewport meta（`index.html`）

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
```

加 `user-scalable=no` 防止手機雙指縮放干擾遊戲。

### 觸控滑動（Swipe）

```typescript
let touchStart: { x: number; y: number } | null = null;
const SWIPE_MIN_PX = 30;

canvas.addEventListener("touchstart", (e) => {
  if (activePowerup !== null) return;  // 道具模式：改為取座標點格子
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

canvas.addEventListener("touchend", (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;

  if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) return;
  const direction = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? "right" : "left")
    : (dy > 0 ? "down" : "up");

  handleMove(direction);  // 抽出 handleKeydown 的核心邏輯為共用函式
}, { passive: true });
```

**道具模式下的觸控點選**：`touchend` 時計算觸控點對應的 row/col，執行道具效果。

### 最小 touch target

Footer 道具圖示按鈕：`min-width: 44px; min-height: 44px;`（Apple HIG 標準）

---

## 實作順序建議

| 優先 | Feature | 原因 |
|------|---------|------|
| 1 | F1（版面重構）+ F2（pairHint） | 基礎，後續 feature 都依賴新版面 |
| 2 | F6（RWD + Swipe） | 與版面耦合，一起做最省重工 |
| 3 | F3（音效） | 獨立模組，隨時可加 |
| 4 | F4（碰撞動畫） | 需改 `grid.ts` interface，影響測試 |
| 5 | F5（道具系統） | 最大，依賴 F1 的 footer layout |

---

## 不在此範圍

- 多人/排行榜
- 廣告 SDK 接入（預留 `rewardAd()` hook 但不實作）
- 新遊戲模式（計時模式、無盡模式）
- PWA push notifications
