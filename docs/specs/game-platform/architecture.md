# 多平台小遊戲架構（Game Platform Architecture）設計規格

- 日期：2026-11-20
- 狀態：設計已確認，待撰寫實作計畫
- 適用：新增 `packages/`、`games/`、`site/`（既有 `workspace*/` 遊戲不受影響）

## 1. 背景與目標

目標：以「量產小遊戲」策略，同時上架**自己的網站**與 **CrazyGames、GameDistribution 等網頁遊戲平台（全部非獨佔）**，
靠廣告分潤獲利。網頁遊戲廣告收入高度集中在少數熱門作，因此架構目標是：
**每多一款遊戲、每多一個平台的邊際成本趨近於零**，再用各平台數據挑出熱門作深化。

成功標準：
1. 同一份遊戲程式碼可 build 出 `site` / `crazygames` / `gamedistribution` 等版本，各版本產物只含該平台的 SDK。
2. `npm run new-game <slug>` 產出的遊戲不需改設定即可 dev、測試、build 所有平台。
3. 新遊戲的人工/AI 工作只需寫 `game.json` + `PlayScene.ts`（+ 素材）。
4. 第 1 款新小遊戲上線自己網站，並產出可直接上傳的 CrazyGames / GameDistribution zip。

設計原則：框架為「未來的量產小遊戲」設計，**不遷就既有三款遊戲**（merge10、merge10x、pixel-squad）的需求，
也不預設特定玩家年齡層。

非目標（本版不做）：
- 會員系統、跨裝置雲端存檔、線上排行榜、造型/每日任務（有流量後另開 spec；屆時考慮 Cloudflare Workers + D1）。
- 自動上傳到各平台（各平台皆為開發者後台手動上傳）。
- 遷移既有遊戲 `workspace/`（merge10）、`workspace-merge10x/`、`workspace-pixel-squad/`：維持原樣與現有部署，大廳以外部連結卡片列出。日後若要遷移，各自另開 spec。
- 初期不買網域、不接 AdSense：先在免費 GitHub Pages 累積數款遊戲，之後再進行（§5.1）。
- 賭場類玩法（Crash、Mines、Plinko、Dice 等模擬博弈）——入口站普遍不收，且有法律風險。
- AI 生圖管線與 autonomous loop 量產整合（另開 spec，見 §9）。

## 2. 平台評估與上架策略

| 優先 | 平台 | 理由 | 注意 |
|---|---|---|---|
| 1 | 自己的網站 | 完全自主、品牌、SEO | 初期在免費 GitHub Pages、無廣告；累積數款後再買網域接 AdSense（§5.1） |
| 1 | CrazyGames | 大流量、接受非獨佔 | Basic Launch（不分潤）→ 數據達標 → Full Launch；只能用其 SDK 廣告；禁外部連結 |
| 1 | GameDistribution | 一次上傳分發到大量站點 | 分成比例低（未經官方合約證實）；禁外部連結 |
| 2 | GamePix、Playgama | 非獨佔，adapter 成熟後低成本加上 | Playgama 分成條件為其自家說法，需查證 |
| 2 | Yandex Games | 月活 >5000 萬 | 以俄語區為主，非俄羅斯開發者收款可行性需先確認 |
| 2 | itch.io | 收玩家回饋 | 無廣告分潤；AI 素材需揭露 |
| — | Poki | — | 預設網頁獨佔（含自己網站），非獨佔僅一次性授權費；與本策略衝突，熱門作再個案談 |
| — | YouTube Playables | — | 仍為 early access（interest form） |

每款遊戲上架順序：自己網站（CI 自動）→ CrazyGames + GameDistribution 同時送 →
依數據決定：表現好的推 CrazyGames Full Launch 並加上第 2 優先平台；表現差的停止投入。

## 3. 整體架構

```
game-factory/
├─ package.json            ← npm workspaces 根（packages/*, games/*, site）
├─ packages/
│  ├─ platform/            ← Platform 介面 + 各平台 adapter
│  └─ game-kit/            ← 共用 Phaser 3 外殼（defineGame、標準場景、暫停/音效、i18n、輸入）
├─ games/<slug>/           ← 每款遊戲只寫玩法
├─ site/                   ← 自己網站的大廳（取代 hub/）
└─ workspace*/             ← 既有三款遊戲，不動
```

引擎：所有新遊戲統一 Phaser 3。

### 3.1 平台抽象層（`packages/platform`）

核心原則：**遊戲不知道自己在哪個平台上。**

```ts
type PlatformId = 'local' | 'site' | 'crazygames' | 'gamedistribution';
type AdResult = 'shown' | 'rewarded' | 'skipped' | 'unavailable'; // 'shown' = interstitial played

interface Platform {
  readonly id: PlatformId;
  readonly features: { externalLinks: boolean; leaderboard: boolean };
  init(): Promise<void>;
  loadingProgress(ratio: number): void;   // 0..1
  loadingDone(): void;
  gameplayStart(): void;                  // player actively playing
  gameplayStop(): void;                   // pause, menu, results screen
  showInterstitial(): Promise<AdResult>;  // between rounds; adapter may decline (frequency cap)
  showRewarded(): Promise<AdResult>;
  storage: { get(key: string): Promise<string | null>; set(key: string, v: string): Promise<void> };
  locale(): string;                       // BCP-47, e.g. 'en', 'zh-TW'
  onAdPause(cb: () => void): void;
  onAdResume(cb: () => void): void;
}
```

Adapter（第一版）：

| id | 廣告 | storage | features |
|---|---|---|---|
| `local` | 假廣告（可設定回傳結果，供 dev/test） | localStorage | 全部 true |
| `site` | 第一版無廣告（一律 `unavailable`）；買網域後改接 Google AdSense H5 Games（Ad Placement API） | localStorage | externalLinks: true |
| `crazygames` | CrazyGames SDK v3（midgame / rewarded） | CrazyGames data module | externalLinks: false |
| `gamedistribution` | GD SDK | localStorage | externalLinks: false |

硬規則：
1. **廣告呼叫永不 throw**：任何失敗（SDK 未載入、adblock、逾時）一律 resolve `'unavailable'`。遊戲在無廣告下必須完整可玩。
2. **廣告期間必暫停 + 靜音**：adapter 觸發 `onAdPause/onAdResume`，由 `game-kit` 統一處理。
3. **插頁頻率限制在 adapter 內**：遊戲只標記「可插廣告的時機」，播不播由 adapter 決定。
4. **平台差異只透過 `features` 判斷**：遊戲與 game-kit 程式碼禁止出現 `platform.id === '...'` 分支（以 lint 規則或 grep 檢查強制）。

Build 選擇：Vite alias `@platform/active` → `packages/platform/src/adapters/${PLATFORM}.ts`。
環境變數 `PLATFORM` 未設時預設 `local`。產物只包含被選中的 adapter。

### 3.2 `game-kit`（共用 Phaser 外殼）

| API / 功能 | 職責 |
|---|---|
| `defineGame({ scenes, ... })` | 建立 Phaser.Game（Scale.FIT，手機/桌機皆可）、初始化 platform、回報載入進度 |
| 標準場景流程 | Preload（自動回報 loadingProgress）→ Title → 遊戲的 PlayScene → 共用 GameOver（重玩）；看廣告續命由遊戲自行以 `kit.showRewarded()` 實作 |
| `kit.start()` | 呼叫 `gameplayStart` |
| `kit.gameOver(score)` | 呼叫 `gameplayStop`、記錄本機最高分、進入 GameOver |
| `kit.breakpoint()` | 標記插頁廣告時機（呼叫 `showInterstitial`，期間暫停） |
| 暫停/音效 | 廣告期間暫停 game loop 並靜音；分頁隱藏沿用 Phaser 內建的自動暫停 |
| `t('key')` | i18n；EN 必備，繁中支援 |
| 輸入 | 點擊/觸控/鍵盤統一 |

### 3.3 遊戲資料夾與模板

```
games/<slug>/
├─ game.json          ← metadata + releases（見 §5）
├─ src/main.ts        ← defineGame({ scenes: [PlayScene] })
├─ src/PlayScene.ts   ← 玩法
├─ assets/            ← webp / ogg / mp3
├─ cover/             ← 各平台封面尺寸
└─ tests/             ← 預設沿用共用 smoke test，可選加單元測試
```

`game.json` 欄位：`slug`、`version`（semver）、`title`/`description`/`instructions`（各語系）、`tags`、
`orientation`（`landscape`|`portrait`|`any`）、`controls`（`mouse`|`touch`|`keyboard` 陣列）、`targets`（要 build 的平台）、`releases`。

`npm run new-game <slug>` 從模板產生上述結構，產出即可 dev / 測試 / build。

大小預算：每款入口站 zip ≤ 10 MB（建置檢查超過即失敗）。

## 4. 自己的網站（`site/`）

- build 時掃描 `games/*/game.json` 自動產生大廳，新增遊戲不需改網站。
- **每款遊戲獨立網址** `/<slug>/`（非 hash 路由）：外框頁含標題、說明、玩法文字（SEO），遊戲本體在 `/<slug>/game/` 以 iframe 嵌入。
- 大廳第一版：遊戲卡片、標籤篩選、繁中/EN 切換、本機最高分；既有三款遊戲以外部連結卡片列出（沿用其現有網址）。
- 第一版無廣告；`ads.txt` 於 §5.1 第二階段才加入。

## 5. 部署與上架作業

### 5.1 網域與託管（兩階段）

**第一階段（現在）：免費 GitHub Pages，無廣告**
- `site` 部署於 `kyoangel.github.io/game_kyo/`。網站與遊戲內所有連結一律用相對路徑（`./`、`../`），遊戲 build 用 `base: './'`；`SITE_URL` 環境變數只用於 canonical 網址。換網域時只改 `SITE_URL`。
- 入口站（CrazyGames、GameDistribution）不受影響，可照常送審與分潤。

**第二階段（累積數款遊戲後，由使用者決定時機）：自訂網域 + AdSense**
- 自訂網域（建議 Cloudflare Registrar），指向 GitHub Pages：根網域 A 記錄 `185.199.108.153`～`185.199.111.153`，`www` CNAME → `kyoangel.github.io`；啟用 Enforce HTTPS；於 GitHub 帳號驗證網域。
- `SITE_URL=https://<domain>/`；加入 `ads.txt`；申請 AdSense H5 Games，通過後 `site` adapter 接上廣告。
- 若流量超過 GitHub Pages 軟性上限（約 100 GB/月）或觸及其商業用途條款，改用 Cloudflare Pages，網域不變。

### 5.2 CI（擴充現有 `.github/workflows/deploy.yml`）
```
push master → 偵測變更的 games/* 與 packages/*（packages 變更 = 全部遊戲）
  → 測試（adapter contract + 每款 smoke）
  ├─ build PLATFORM=site（全部遊戲 + 大廳）→ 部署 GitHub Pages
  └─ build 各入口站 target → <slug>-<target>-v<version>.zip → GitHub Release
```
既有三款遊戲（merge10、merge10x、pixel-squad）的 job 保留不動，`site` 部署不得覆蓋它們的路徑。

### 5.3 上架狀態追蹤
`game.json` 的 `releases`：
```json
"releases": {
  "site":             { "status": "live",      "version": "1.2.0" },
  "crazygames":       { "status": "basic",     "version": "1.1.0", "submittedAt": "2026-12-01" },
  "gamedistribution": { "status": "submitted", "version": "1.1.0" }
}
```
`status` ∈ `todo | submitted | basic | live | full | rejected`；`rejected` 時必填 `reason`。
`npm run release-status` 輸出所有遊戲 × 平台的狀態表。

### 5.4 送審檢查清單
`docs/specs/game-platform/checklists/<platform>.md`：能自動化的由 §7 的產物檢查涵蓋，其餘列為人工勾選項目
（例如封面尺寸、說明文字、內容分級）。

## 6. 錯誤處理

| 情境 | 行為 |
|---|---|
| 平台 SDK 載入失敗 / 逾時 | `init()` 仍 resolve，adapter 進入降級模式：廣告一律 `unavailable`，storage 退回 localStorage |
| 廣告失敗 / adblock | `unavailable`；GameOver 隱藏「看廣告續命」按鈕或顯示不可用 |
| storage 讀寫失敗（隱私模式等） | 吞掉錯誤、改用記憶體暫存，遊戲照常進行 |
| 未知 `PLATFORM` 值 | build 直接失敗並列出合法值 |

## 7. 測試策略

| 層級 | 內容 | 觸發 |
|---|---|---|
| Adapter contract test（Vitest） | 每個 adapter 以 mock SDK 跑同一組測試：廣告失敗回傳 `unavailable`、廣告期間觸發 pause/resume、storage 讀寫與失敗降級 | `packages/platform` 變更 |
| 共用 smoke test（Playwright） | 每款遊戲以 `local` adapter：啟動 → 模擬輸入 → 到達 `gameOver` → 分數回報 → console 無 error | 每款遊戲，CI |
| Build 產物檢查 | 入口站 zip：無外部 URL（白名單外）、無其他平台 SDK、≤ 10 MB；遊戲碼無 `platform.id ===` 分支 | 每次 build |
| 玩法單元測試 | 僅複雜純邏輯（如計分、合成規則） | 選擇性 |

量產時只跑 smoke + 產物檢查；遊戲進入 CrazyGames Full Launch 後再補完整測試。

## 8. 實作順序（供撰寫計畫）

1. npm workspaces 骨架 + `packages/platform`（介面、`local` adapter、contract tests）
2. `packages/game-kit` + `new-game` 模板 + 第 1 款極簡新遊戲 + 共用 smoke test
3. `site/` 大廳 + CI（site 部署）
4. `crazygames`、`gamedistribution` adapter + 產物檢查 + zip/Release
5. `release-status` 指令 + 各平台檢查清單 → 第 1 款新遊戲送審 CrazyGames / GameDistribution
6. 第二階段：網域與 AdSense（`site` adapter 廣告）——累積數款遊戲後，依使用者決定時程

## 9. 後續 spec（不在本版範圍）

- 遊戲量產管線：AI 生圖（封面、統一美術風格規範）、autonomous loop 接 `new-game`、backlog 一行一款點子。
- 線上排行榜與會員（有流量後）。
- 第 2 優先平台 adapter（GamePix、Playgama、Yandex）。
