# PWA 修正設計 (Subsystem B)

## Summary

修正 Android PWA「加入主畫面」開啟錯誤 URL、新增 PNG 圖示、加入 iOS Safari 必要的 meta tags，並在 iOS 非 standalone 情況下顯示一次性提示 toast 引導使用者加入主畫面。

---

## 問題清單

| 問題 | 根因 |
|------|------|
| Android PWA 啟動後開啟 `kyoangel.github.io/`（空頁面） | `manifest.json` 的 `start_url: "/"` 未對應 Vite base `/game_kyo/merge10/` |
| iOS Safari 加入主畫面後圖示是白底截圖 | 缺少 `apple-touch-icon` PNG |
| iOS Chrome 找不到加入主畫面選項 | Apple 平台限制，無法繞過，改以 toast 引導 |
| PWA 圖示在手機顯示模糊 | 只有 SVG，缺少 PNG 版本 |

---

## 修正設計

### 1. `manifest.json`

```json
{
  "name": "Math Merge: 10之魔法師",
  "short_name": "Math Merge 10",
  "description": "相鄰數字相加為 10 即可消除的益智遊戲，適合學齡兒童。",
  "start_url": "/game_kyo/merge10/",
  "scope": "/game_kyo/merge10/",
  "display": "standalone",
  "background_color": "#111827",
  "theme_color": "#1a1a2e",
  "icons": [
    {
      "src": "/game_kyo/merge10/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/game_kyo/merge10/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/game_kyo/merge10/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

**注意：** icon 路徑使用絕對路徑，因為 `%BASE_URL%` 在 `manifest.json` 中不會被 Vite 替換。

---

### 2. `icon.svg` 改良

改良現有設計（保留深色背景 + 綠色「10」），提升在小尺寸的可讀性：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="80" fill="#111827" />
  <text
    x="256" y="320"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="280"
    font-weight="900"
    fill="#4ade80"
    text-anchor="middle"
  >10</text>
</svg>
```

變更點：
- viewport 改為 512×512（配合最大 PNG 輸出尺寸）
- `rx` 從 24 → 80（更符合 Android/iOS 圓角圖示比例）
- `font-size` 從 80 → 280（512px 底下的比例），`font-weight` 900
- 背景顏色從 `#222222` → `#111827`（與遊戲 HUD 一致）

---

### 3. PNG 圖示生成腳本

**新增 `workspace/scripts/gen-icons.mjs`：**

```js
import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "../public/icons/icon.svg");
const outDir = join(__dirname, "../public/icons");
const svg = readFileSync(svgPath);

await Promise.all([
  sharp(svg).resize(192, 192).png().toFile(join(outDir, "icon-192.png")),
  sharp(svg).resize(512, 512).png().toFile(join(outDir, "icon-512.png")),
  sharp(svg).resize(180, 180).png().toFile(join(outDir, "apple-touch-icon.png")),
]);
console.log("Icons generated: icon-192.png, icon-512.png, apple-touch-icon.png");
```

**`workspace/package.json` devDependencies 加入 `sharp`，並加 npm script：**
```json
"scripts": {
  "gen-icons": "node scripts/gen-icons.mjs"
},
"devDependencies": {
  "sharp": "^0.33.0"
}
```

**執行方式（在 `workspace/` 目錄下）：**
```bash
npm install && npm run gen-icons
```

PNG 生成後 commit 進 repo，不需要 CI 重跑（PNG 是靜態資產）。

---

### 4. `index.html` — iOS meta tags

在 `<head>` 的 `<link rel="manifest">` 之後加入：

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Math Merge 10" />
<link rel="apple-touch-icon" href="%BASE_URL%icons/apple-touch-icon.png" />
```

---

### 5. `index.html` — iOS 提示 toast

#### HTML element（加在 `#game-container` 之前的 `<body>` 頂層）

```html
<div id="ios-hint" style="display:none"></div>
```

#### CSS（加在 `<style>` 區塊）

```css
#ios-hint {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: #1e3a5f;
  color: #bfdbfe;
  font-family: sans-serif;
  font-size: 13px;
  border-radius: 8px;
  padding: 10px 16px;
  z-index: 100;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  cursor: pointer;
}
```

#### JavaScript（inline `<script>` 在 `</body>` 之前）

```html
<script>
(function () {
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  var isStandalone = ('standalone' in navigator) && navigator.standalone;
  var shown = localStorage.getItem('iosHintShown');
  if (!isIOS || isStandalone || shown) return;
  localStorage.setItem('iosHintShown', '1');
  setTimeout(function () {
    var el = document.getElementById('ios-hint');
    if (!el) return;
    el.textContent = '💡 用 Safari 分享 → 加入主畫面，可離線遊玩（點擊關閉）';
    el.style.display = 'block';
    el.addEventListener('click', function () { el.style.display = 'none'; });
    setTimeout(function () { el.style.display = 'none'; }, 6000);
  }, 2000);
}());
</script>
```

**行為：**
- 只在 iOS 裝置（iPhone/iPad/iPod）且非 standalone 模式觸發
- `localStorage.iosHintShown` 記錄，只顯示一次（跨 session 永久記住）
- 啟動 2 秒後出現（避免蓋住初始載入畫面）
- 6 秒後自動消失，或點擊立即關閉

---

## 不在範圍

- Service worker 更新策略（現有 `sw.js` 不修改）
- Android 安裝提示 banner（瀏覽器原生提示已足夠）
- PWA offline 快取策略改變

---

## 測試策略

| 測試 | 類型 | 驗證內容 |
|------|------|---------|
| manifest `start_url` 正確 | E2E | `GET /game_kyo/merge10/manifest.json` → `start_url === "/game_kyo/merge10/"` |
| `apple-touch-icon` link 存在 | E2E | `<link rel="apple-touch-icon">` 在 DOM 中 |
| iOS hint 僅顯示一次 | Unit | 模擬 iOS UA + localStorage 邏輯（pure function 抽出） |
| icon PNG 檔案存在且尺寸正確 | 腳本驗證 | `sharp` 讀取 PNG metadata 確認 width/height |

---

## 檔案異動清單

| 檔案 | 異動 |
|------|------|
| `workspace/public/manifest.json` | 修改 `start_url`、`scope`、`icons`、`background_color`、`theme_color` |
| `workspace/public/icons/icon.svg` | 改良設計（512×512 viewport、rx=80、font-weight 900） |
| `workspace/public/icons/icon-192.png` | 新增（gen-icons 腳本生成後 commit） |
| `workspace/public/icons/icon-512.png` | 新增（gen-icons 腳本生成後 commit） |
| `workspace/public/icons/apple-touch-icon.png` | 新增（180×180） |
| `workspace/index.html` | 加 iOS meta tags、`#ios-hint` element、CSS、inline script |
| `workspace/scripts/gen-icons.mjs` | 新增 |
| `workspace/package.json` | devDependencies 加 `sharp`，scripts 加 `gen-icons` |
