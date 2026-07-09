# pixel-squad backlog

- [x] Battle HUD 復古改版收尾：戰場背景改純黑 + `renderParty()` 接上 `computeRowAnchors` 雙錨點排版與隊伍色條（spec: `battle-hud-retro-reskin.md`，plan: `docs/plans/2026-07-04-battle-hud-retro-reskin.md` Task 3–5，含瀏覽器視覺驗證，已完成）
- [x] 戰鬥畫面吞食天地II形式復刻（2026-07-09 需求，已完成，含瀏覽器視覺驗證）：版面（名字+兵力堆疊、10 段血條、sprite 站條上、肖像窗、指令/訊息窗、地形帶）＋回合演出（前進一步/前衝/閃爍/數字滾動/逐字訊息）＋像素中文字體整合（Fusion Pixel Font, OFL-1.1）＋18 張自創肖像提示詞（尚待外部生圖工具產出實際圖檔，缺圖時已有剪影 fallback，不影響遊玩）（spec: `battle-screen-tenchi2-homage.md`，plan: `docs/plans/2026-07-09-battle-screen-tenchi2-homage.md`；順帶修復下方美術/動畫問題的前兩個子項，並修掉一個實作中發現的迴歸——指令選單與逐字訊息共用同一視窗後，換場時舊訊息殘留疊字）
- [ ] 戰鬥角色美術/動畫問題（2026-07-05 手動驗證時發現，待排期）：
  - ~~敵人 sprite 朝向錯誤，應該面向左邊（面向我方/中線）~~ 已於 2026-07-09 tenchi2 復刻修復（monster image 統一 `setFlipX(true)`）
  - ~~敵人 idle 動畫有明顯的忽大忽小縮放跳動，需檢查 `CharacterAnimator`/monster idle 動畫的 scale tween~~ 已於 2026-07-09 修復（breathing scaleY 改為相對目前 scale 的比例，而非絕對值）
  - 敵人美術風格與主角（protagonist sprite sheet）差異很大，整體不協調，需要統一風格或至少收斂色調/像素密度
  - 目前角色美術（含玩家隊伍）視覺品質偏低，需要重新檢視素材來源或美術規格；18 張自創肖像提示詞已備妥（見 `battle-screen-tenchi2-homage.md` 美術規範節），待實際生圖並放入 `public/sprites/portraits/`
