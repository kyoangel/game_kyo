---
updated: 2026-11-25
status: active
---
# game-factory

**是什麼**：多遊戲「傘型工廠」——自建的 agent 調度系統（`orchestrator.py`、
`autonomous_loop.py`、`agents/`，呼叫 LM Studio / Gemini / Claude CLI）
自動開發、QA、部署瀏覽器遊戲到 GitHub Pages `game_kyo/<game>/`。
新遊戲進同一個 repo，不另開。
**怎麼跑**：入口為 `orchestrator.py` / `run_qa_loop.py`；各遊戲在
`workspace-*` 內以 Docker sandbox 跑 npm build。
路徑 `~/Projects/Personal/game-factory`（分支 master，乾淨）。

## 現況（2026-11-22）
主力是 npm workspaces 平台（`packages/game-kit` + `games/*`，Phaser 3），dodge-drop（Neon Rush）v2.8.4 已上線
https://kyoangel.github.io/game_kyo/dodge-drop/ （僅自家網站，使用者玩過核可前不送入口站）。
進行中工作與交接細節一律看 `.superpowers/sdd/meta/progress.md`（handoff 段）與同目錄的 *-brief.md / *-report.md。
CI 規則見 `docs/ci.md`（pre-push hook、PROPERTY_SEEDS、nightly、Pages 用 Actions 部署）。

## 下一步
1. v2.8.4 於 2026-11-23 被 CrazyGames 以整體品質退件；v3.0.0 已完成，2026-11-25 再加暫停選單／開局道具再點取消／favicon 成為 v3.1.0；同日獎杯節奏改為 15/30/60 秒、用詞統一為「杯」成為 v3.2.0；同日拿掉分數/連擊、改成只看存活時間＋擦邊集氣觸發大胃王成為 v3.3.0（計畫 `docs/plans/2026-11-25-dodge-drop-time-only-graze-chomp.md`）；同日加入防龜縮（站著不動 3 秒會有瞄準方塊）＋橫向死亡紅閃滿版成為 v3.4.0；同日音樂改快（開局 120 BPM、加速/極速 160 BPM、播放速度隨時間 ×1.0→×1.25）、瞄準方塊縮為 90px 成為 v3.5.0；同日大胃王吃方塊給星星、原創歡樂大胃王音樂、加速前 3-2-1 倒數與 1 秒漸進、天賦加強（擦邊 34→54px、大胃王最長 8 秒）成為 v3.6.0；同日主題曲換成原創賽車風（`games/dodge-drop/scripts/render-run-music.ts`）、加速/極速改用原速 Space Synth Wave 成為 v3.7.0（同版：後期密度封頂、大胃王結束後擦邊冷卻 8 秒、擦邊範圍 30→45px）；2026-11-27 移除擦邊集氣／擦邊觸發大胃王與擦邊兩個天賦（星星一次退回）、主題曲換成原創流行風 140 BPM 成為 v3.8.0；2026-11-28 擦邊集氣改回、但每 8 次擦邊給 1 個護盾，獎杯目標改顯示「還差 N 秒」成為 v3.9.0；同日換成霓虹夜空主題第一階段（雷雲障礙、原創小飛機＋尾焰、背景飄雲）成為 v3.10.0，第二階段（每款造型不同飛機、大胃王外觀、商店封面影片）等使用者試玩後再做；同日寬雷雲加厚（最厚 80px、碰撞框同步）、新增天賦「擦邊充能」（3 級，8→7→6→5 次擦邊得護盾）成為 v3.11.0，已上自家網站（計畫
   `docs/plans/2026-11-23-dodge-drop-v3-crazygames-resubmit.md`）。等使用者：試聽音訊、看封面影片、
   跑 CrazyGames Preview，再用 `/publish-crazygames dodge-drop` 送審（Submit 由使用者按）。清單在
   `docs/specs/dodge-drop/v3-resubmit-notes.md`。
2. Phase 2：局內三選一 perk（完全暫停）、區域突破；未來純技術排行榜。
3. 舊的 loop-budget-efficiency worktree 仍未處理。

## 地雷
- pixel-squad 的 sandbox **跑不了 npm/npx/tsc**——該遊戲只能靜態審查，別浪費
  時間試著在 sandbox 裡 build。
- **不要派 background reviewer subagent**——會卡住數小時，reviewer 一律 inline
  （專案 memory 有此教訓）。
- 這個專案本身就是一套多模型調度系統，和全域 v3 制度同構：改其中一邊的
  升降級／reviewer 邏輯時，想想另一邊有沒有同樣的問題（交接信第一節第 3 點）。
- 部署即上線：GitHub Pages 是真的對外，push 前確認遊戲可玩。
