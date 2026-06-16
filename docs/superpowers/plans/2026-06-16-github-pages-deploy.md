# GitHub Pages 自動部署實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 每次 push 到 `master` 後，自動跑完測試、build，並將遊戲部署至 `https://kyoangel.github.io/game_kyo/merge10/`。

**Architecture:** 前兩個 Task 為 GitHub/git 基礎設施（改 repo 名稱、建 gh-pages branch、開啟 Pages），不需 TDD。後四個 Task 為程式碼修改（vite.config.ts、index.html 路徑、E2E 測試、CI workflow），每個 Task 各自 commit，最終 push 觸發第一次真實部署。

**Tech Stack:** GitHub CLI (`gh`), Git, Vite, Playwright, GitHub Actions, `JamesIves/github-pages-deploy-action@v4`

---

## File Structure

| File | 動作 | 說明 |
|------|------|------|
| `workspace/vite.config.ts` | 新增 | Vite base path = `/game_kyo/merge10/` |
| `workspace/index.html` | 修改 3 行 | 絕對路徑 → `%BASE_URL%` 前綴 |
| `workspace/tests/e2e/merge-animation.spec.ts` | 修改 1 行 | 硬寫 localhost URL → 相對 `/` |
| `.github/workflows/deploy.yml` | 新增 | test → build → deploy pipeline |

---

## Task 1：將 GitHub repo 改名為 `game_kyo` 並更新本地 remote

> **TDD 例外：** 這是 GitHub API + git config 操作，無程式碼可測試。驗證改為確認指令輸出。

**Files:** 無（git config 不追蹤）

- [x] **Step 1：在 GitHub 上將 repo 從 `game-factory` 改名為 `game_kyo`**

  從 repo 根目錄執行（`gh` 會自動抓 origin remote 對應的 repo）：

  ```bash
  gh repo rename game_kyo -y
  ```

  Expected output（包含但不限於）：
  ```
  ✓ Renamed repository kyoangel/game_kyo
  ```

- [x] **Step 2：更新本地 remote URL**

  ```bash
  git remote set-url origin git@github.com:kyoangel/game_kyo.git
  ```

- [x] **Step 3：驗證**

  ```bash
  gh repo view --json name,url && git remote -v
  ```

  Expected：
  ```json
  {"name":"game_kyo","url":"https://github.com/kyoangel/game_kyo"}
  ```
  ```
  origin  git@github.com:kyoangel/game_kyo.git (fetch)
  origin  git@github.com:kyoangel/game_kyo.git (push)
  ```

---

## Task 2：建立 `gh-pages` branch 並啟用 GitHub Pages

> **TDD 例外：** GitHub Pages 設定操作，無程式碼可測試。

**Files:** gh-pages branch（不影響 master working tree）

- [x] **Step 1：建立 orphan `gh-pages` branch 並放入 placeholder**

  ```bash
  git checkout --orphan gh-pages
  git rm --cached -r . > /dev/null
  echo "<!-- placeholder -->" > index.html
  git add index.html
  git commit -m "init: create gh-pages branch placeholder"
  ```

  `git rm --cached` 只清 index，不動磁碟上的檔案，安全。

- [x] **Step 2：推送 gh-pages branch 到 origin**

  ```bash
  git push origin gh-pages
  ```

  Expected：
  ```
  Branch 'gh-pages' set up to track remote branch 'gh-pages' from 'origin'.
  ```

- [x] **Step 3：切回 master 並清理 placeholder 檔**

  ```bash
  git checkout master
  rm -f index.html
  ```

  切回 master 後，所有原始檔案（workspace/、agents/ 等）恢復正常。

- [x] **Step 4：透過 GitHub API 啟用 GitHub Pages**

  ```bash
  gh api repos/kyoangel/game_kyo/pages \
    --method POST \
    -f 'source[branch]=gh-pages' \
    -f 'source[path]=/'
  ```

  Expected output 包含：
  ```json
  {"url":"https://api.github.com/repos/kyoangel/game_kyo/pages","status":"queued",...}
  ```

  > 若出現 `422` 錯誤（Pages 已設定），改用 PUT 更新：
  > ```bash
  > gh api repos/kyoangel/game_kyo/pages \
  >   --method PUT \
  >   -f 'source[branch]=gh-pages' \
  >   -f 'source[path]=/'
  > ```

- [x] **Step 5：驗證 Pages 已啟用**

  ```bash
  gh api repos/kyoangel/game_kyo/pages --jq '.html_url'
  ```

  Expected：
  ```
  https://kyoangel.github.io/game_kyo/
  ```

---

## Task 3：新增 `workspace/vite.config.ts` 設定 base path

> **TDD 例外：** Vite config 為純設定檔，無可撰寫的單元測試。以 build 輸出驗證。

**Files:**
- Create: `workspace/vite.config.ts`

- [x] **Step 1：建立 vite.config.ts**

  ```typescript
  import { defineConfig } from 'vite'

  export default defineConfig({
    base: '/game_kyo/merge10/',
  })
  ```

  存至 `workspace/vite.config.ts`。

- [x] **Step 2：驗證 build 輸出含正確 base path**

  ```bash
  cd workspace && npm run build 2>&1
  grep 'game_kyo/merge10' dist/index.html
  ```

  Expected（`dist/index.html` 中的 script src 應包含 base path）：
  ```
  /game_kyo/merge10/assets/index-
  ```

- [x] **Step 3：Commit**

  ```bash
  git add workspace/vite.config.ts
  git commit -m "feat: add vite.config.ts with /game_kyo/merge10/ base path for GitHub Pages"
  ```

---

## Task 4：修正 `workspace/index.html` 三個絕對路徑

**Files:**
- Modify: `workspace/index.html` (lines 7, 8, 165)

- [x] **Step 1：確認目前三行的內容**

  ```bash
  grep -n "manifest\|icon.svg\|sw.js" workspace/index.html
  ```

  Expected：
  ```
  7:  <link rel="manifest" href="/manifest.json" />
  8:  <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
  165:        navigator.serviceWorker.register("/sw.js");
  ```

- [x] **Step 2：修改 line 7 — manifest**

  將：
  ```html
  <link rel="manifest" href="/manifest.json" />
  ```
  改為：
  ```html
  <link rel="manifest" href="%BASE_URL%manifest.json" />
  ```

- [x] **Step 3：修改 line 8 — icon**

  將：
  ```html
  <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
  ```
  改為：
  ```html
  <link rel="icon" type="image/svg+xml" href="%BASE_URL%icons/icon.svg" />
  ```

- [x] **Step 4：修改 line 165 — service worker**

  將：
  ```javascript
  navigator.serviceWorker.register("/sw.js");
  ```
  改為：
  ```javascript
  navigator.serviceWorker.register("%BASE_URL%sw.js");
  ```

- [x] **Step 5：驗證 build 輸出路徑正確**

  ```bash
  cd workspace && npm run build 2>&1
  grep -E 'manifest|icons/icon|sw\.js' dist/index.html
  ```

  Expected（路徑含 `/game_kyo/merge10/`）：
  ```
  href="/game_kyo/merge10/manifest.json"
  href="/game_kyo/merge10/icons/icon.svg"
  register("/game_kyo/merge10/sw.js")
  ```

- [x] **Step 6：Commit**

  ```bash
  git add workspace/index.html
  git commit -m "fix: use %BASE_URL% for PWA assets to support GitHub Pages subpath"
  ```

---

## Task 5：修正 `merge-animation.spec.ts` 的硬寫 URL

**Files:**
- Modify: `workspace/tests/e2e/merge-animation.spec.ts` (line 4)

- [x] **Step 1：確認目前硬寫的 URL**

  ```bash
  grep -n "goto" workspace/tests/e2e/merge-animation.spec.ts
  ```

  Expected：
  ```
  4:  await page.goto("http://localhost:5173");
  ```

- [x] **Step 2：改為相對路徑（使用 playwright.config.ts 的 baseURL）**

  將 `workspace/tests/e2e/merge-animation.spec.ts` 第 4 行：
  ```typescript
  await page.goto("http://localhost:5173");
  ```
  改為：
  ```typescript
  await page.goto("/");
  ```

  注意：`playwright.config.ts` 已設定 `baseURL: "http://localhost:5173"` 與 `webServer`，改成相對路徑後，本地與 CI 行為完全一致。

- [x] **Step 3：執行全部 E2E 測試確認通過**

  ```bash
  cd workspace && npm run test:e2e 2>&1
  ```

  Expected（全部通過）：
  ```
  Running N tests using 1 worker
  ✓ ...
  N passed
  ```

- [x] **Step 4：Commit**

  ```bash
  git add workspace/tests/e2e/merge-animation.spec.ts
  git commit -m "fix: use relative goto('/') in merge-animation E2E tests for CI compatibility"
  ```

---

## Task 6：新增 GitHub Actions workflow 並 push 觸發首次部署

**Files:**
- Create: `.github/workflows/deploy.yml`

- [x] **Step 1：建立 `.github/workflows/` 目錄**

  ```bash
  mkdir -p .github/workflows
  ```

- [x] **Step 2：建立 `deploy.yml`**

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

  存至 `.github/workflows/deploy.yml`。

- [x] **Step 3：在本地先跑一次完整測試確認乾淨**

  ```bash
  cd workspace && npm run test:unit && npm run test:e2e && npm run build
  cd ..
  ```

  Expected：unit tests 全過、E2E 全過、build 成功。若有任何失敗，**不要繼續 push**，先修好。

- [x] **Step 4：Commit workflow 檔**

  ```bash
  git add .github/workflows/deploy.yml
  git commit -m "feat: add GitHub Actions workflow — test then deploy to GitHub Pages"
  ```

- [x] **Step 5：Push 到 origin，觸發首次部署**

  ```bash
  git push origin master
  ```

- [x] **Step 6：監看 workflow 執行狀況**

  ```bash
  gh run watch
  ```

  按 `Ctrl-C` 可退出監看，不影響 workflow 執行。

  Expected：
  ```
  ✓ Unit tests
  ✓ Install Playwright browsers
  ✓ E2E tests
  ✓ Build
  ✓ Deploy to GitHub Pages
  All jobs have completed
  ```

- [x] **Step 7：驗證遊戲已上線**

  ```bash
  curl -s -o /dev/null -w "%{http_code}" https://kyoangel.github.io/game_kyo/merge10/
  ```

  Expected：
  ```
  200
  ```

  若返回 `404`，等待 1-2 分鐘（GitHub Pages 需要時間 propagate）後再試。

---

## Success Criteria

- [x] `https://kyoangel.github.io/game_kyo/merge10/` 可正常開啟遊戲
- [x] 後續每次 `git push origin master` 都自動跑測試並部署
- [x] 測試失敗時 Actions 顯示紅色，不會部署到 Pages
- [x] Chrome DevTools → Application → Manifest 可正常讀取（PWA 路徑正確）
