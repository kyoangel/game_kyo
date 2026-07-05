# pixel-squad backlog

- [x] Battle HUD 復古改版收尾：戰場背景改純黑 + `renderParty()` 接上 `computeRowAnchors` 雙錨點排版與隊伍色條（spec: `battle-hud-retro-reskin.md`，plan: `docs/plans/2026-07-04-battle-hud-retro-reskin.md` Task 3–5，含瀏覽器視覺驗證，已完成）
- [ ] 戰鬥角色美術/動畫問題（2026-07-05 手動驗證時發現，待排期）：
  - 敵人 sprite 朝向錯誤，應該面向左邊（面向我方/中線）
  - 敵人 idle 動畫有明顯的忽大忽小縮放跳動，需檢查 `CharacterAnimator`/monster idle 動畫的 scale tween
  - 敵人美術風格與主角（protagonist sprite sheet）差異很大，整體不協調，需要統一風格或至少收斂色調/像素密度
  - 目前角色美術（含玩家隊伍）視覺品質偏低，需要重新檢視素材來源或美術規格
