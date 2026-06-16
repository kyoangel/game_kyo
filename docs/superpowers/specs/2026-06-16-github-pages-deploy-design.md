# GitHub Pages 自動部署設計

**Date:** 2026-06-16
**Status:** Approved

---

## 目標

每次 push 到 `master` 後，自動跑完測試、build，並將遊戲部署到 GitHub Pages，網址為：

```
https://kyoangel.github.io/game_kyo/merge10/
```

---

## 架構

```
push to master
    │
    ▼
GitHub Actions (ubuntu-latest)
    ├── npm ci
    ├── vitest run              ← 失敗即停，不部署
    ├── playwright test         ← webServer 自動啟 dev server
    ├── vite build              ← base = '/game_kyo/merge10/'
    └── JamesIves deploy-action → gh-pages branch / merge10/
                                        │
                                        ▼
                               GitHub Pages 對外服務
```

---

## 前置作業（納入計畫，依序自動執行）

| 步驟 | 指令 | 說明 |
|------|------|------|
| 1 | `gh repo rename game_kyo --yes` | 將 GitHub repo 從 `game-factory` 改名為 `game_kyo` |
| 2 | `git remote set-url origin git@github.com:kyoangel/game_kyo.git` | 更新本地 remote URL（SSH 協定） |
| 3 | 建立空的 `gh-pages` orphan branch 並推送 | 讓 GitHub Pages 設定有 branch 可以指向 |
| 4 | `gh api repos/kyoangel/game_kyo/pages -X POST ...` | 啟用 GitHub Pages，指向 `gh-pages` branch root |

---

## 程式碼修改

### `workspace/vite.config.ts`（新增）

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/game_kyo/merge10/',
})
```

設定 Vite build 的 base path，讓所有靜態資源路徑在 subpath 下正確解析。

### `workspace/index.html`（修改 3 處）

將硬寫的絕對路徑改為 Vite 的 `%BASE_URL%` 變數，build 時自動替換為設定的 base path：

```html
<!-- 改前 -->
<link rel="manifest" href="/manifest.json" />
<link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
navigator.serviceWorker.register("/sw.js")

<!-- 改後 -->
<link rel="manifest" href="%BASE_URL%manifest.json" />
<link rel="icon" type="image/svg+xml" href="%BASE_URL%icons/icon.svg" />
navigator.serviceWorker.register("%BASE_URL%sw.js")
```

### `workspace/tests/e2e/merge-animation.spec.ts`（修改 1 處）

```ts
// 改前（硬寫 localhost，在 CI 會因 baseURL 設定衝突而行為不一致）
await page.goto("http://localhost:5173")

// 改後（使用 playwright.config.ts 的 baseURL，CI 與本地行為一致）
await page.goto("/")
```

### `.github/workflows/deploy.yml`（新增）

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: workspace/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: workspace

      - name: Unit tests
        run: npm run test:unit
        working-directory: workspace

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
        working-directory: workspace

      - name: E2E tests
        run: npm run test:e2e
        working-directory: workspace

      - name: Build
        run: npm run build
        working-directory: workspace

      - name: Deploy to GitHub Pages
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: workspace/dist
          target-folder: merge10
          branch: gh-pages
          clean: false
```

`clean: false` 確保部署時不會清掉 `gh-pages` branch 上其他遊戲的目錄（為未來多遊戲架構預留）。

---

## 驗證方式

1. Push 任意修改到 `master`
2. GitHub Actions tab 確認 workflow 全綠
3. 開啟 `https://kyoangel.github.io/game_kyo/merge10/`，遊戲正常顯示
4. 確認 PWA manifest 可讀取（Chrome DevTools → Application → Manifest）

---

## 不在此範圍

- 自訂網域（custom domain）
- PR preview deployments
- 多遊戲首頁（index at `game_kyo/`）
- Python harness 的 CI（`pytest`）
