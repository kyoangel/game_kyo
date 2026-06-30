# pixel-squad backlog

- [x] 角色技能系統（heal / buff 實際生效）
- [x] Archetype 效果（坦克減傷、狙擊暴擊等）
- [x] 廢土幣商店（買技能 / 補給品）
- [x] 陣型效果（位置 0 前排減傷、位置 4 後排加成）
- [x] 支線任務差異化獎勵
- [x] 通關後 New Game+ 或挑戰模式
- [x] 角色設計，主人公像素素材 
- [x] 音效
- [x] 音樂
- [x] 角色攻擊動作 (Walk, Idle, Attack, Hit, Die, Skill) 
- [x] 像素怪物素材
- [x] 技能的冷卻時間設計
- [x] UI Design

## 🐛 Bug 修復（高優先）

- [x] **勸降入伍失效**：勸降成功後敵人無法真正入伍，ResultScene 顯示「新成員加入了！」但下場戰鬥／整備找不到該角色。Spec: `specs/pixel-squad-recruit-fix.md`
  - **根因**：`VictoryProcessor.ts` line 81、`PLAYER_TEMPLATES.find(t => t.id === recruitedEnemy.templateId)` 用敵人的 `templateId`（如 `mutant`、`wolf_a`、`raider_sniper`）去 `PLAYER_TEMPLATES` 找，但敵人模板 id 不在玩家模板清單中（玩家只有 protagonist/rex/nyx/vega/ash/crow/mira/zora/rook/dex/echo/aaaa），`template` 為 undefined → 不會 push 進 pool → 靜默失敗。
  - **修復方向**：勸降入伍時不要依賴 `PLAYER_TEMPLATES` 配對。直接以 recruited enemy 的實際資料（name / baseStats / skills / 等級）建立一個 player Character（`isPlayer: true`、保留原始 `templateId` 或產生獨立 id），push 進 `pool`，再依 squad < 5 自動加入 squad。可考慮在 `CharacterFactory` 新增 `enemyToPlayerCharacter(enemy)` 之類的轉換函式。
  - **同時修**：`ResultScene.ts` line 94 的「整備」按鈕，只有在 `updatedGameState` 存在時才持久化；若 `data.gameState` 為 undefined（非章節流程進入），recruitedEnemy 完全不會被存檔。需確保任何勝利路徑下 recruitedEnemy 都會被持久化，或至少在無 gameState 時不要顯示「加入了！」誤導文案。
  - **驗收**：
    - 新增單元測試 `VictoryProcessor.recruit.test.ts`：傳入一個 templateId 不在 PLAYER_TEMPLATES 的 recruited enemy，斷言回傳的 state.pool 含有該角色且 `isPlayer === true`，squad 有空位時自動加入。
    - 斷言入伍角色保留原敵人的 name 與合理 stats（非 0／非 undefined）。
    - 既有的 recruit / VictoryProcessor 測試不得破壞。

## 下一輪優化 — 遊玩體驗提升

### 戰鬥深度
- [x] 元素弱點系統：每個敵人有弱點屬性，攻擊弱點觸發暴擊 + 額外回合（參考 Persona 5 Press Turn）
- [x] 連鎖攻擊：連續命中敵人弱點可觸發全體攻擊（All-Out Attack）
- [x] 狀態異常擴充：毒（持續傷害）、灼燒（攻擊力下降）、凍結（跳過回合）、眩暈（速度歸零）。Spec: `specs/pixel-squad-status-effects.md`
- [x] Boss 分段機制：Boss HP 降至 50% 時進入狂暴形態，開放新弱點。Spec: `specs/pixel-squad-boss-phase-weakness.md`
- [x] 一般弱點系統收尾：`DamageCalc`/`TurnEngine` 的元素弱點計算與加成已存在並有測試，但內容面從未串接 —— 沒有任何非 Boss `EnemyTemplate` 指派 `weakness`、`createEnemy` 不會把 weakness 複製到 `Character`、`recordWeaknessDiscovery` 從未被呼叫、也沒有對應的弱點揭露 UI。需要替一般敵人指派弱點屬性，並在命中時記錄/顯示弱點圖示（`specs/pixel-squad-boss-phase-weakness.md` 已先把這條路在 Boss 身上接通，可參考其作法）。Spec: `specs/pixel-squad-general-weakness-wiring.md`
- [ ] All-Out Attack BattleScene 串接：`TurnEngine.applyWeaknessBonus`（加成回合）、`Character.knockedDown`（stagger）、`battle/AllOutAttack.ts`（全體攻擊觸發）均已有獨立單元測試，但 `scenes/BattleScene.ts` 完全沒有呼叫點 —— 弱點命中從不觸發 stagger、不給予 bonus action、也不會引發 All-Out Attack，與背板「連鎖攻擊」已勾選的狀態矛盾。需要在 `executePlayerCommand` 的傷害結算後正確排序：命中弱點 → knockedDown → 判斷 allEnemiesKnockedDown → 觸發 All-Out Attack 動畫 → 移除 knockedDown 標記。

### 成長與建構
- [ ] 裝備系統：武器 / 防具欄位，商店可買裝備，提供屬性加成
- [ ] 技能樹：每個角色有獨立的技能解鎖路徑（3 個分支）
- [ ] 傭兵評鑑系統：戰鬥結束依表現（傷害輸出、存活率、弱點利用）給星評分，影響獎勵

### 探索與劇情
- [ ] 隱藏關卡：符合條件（如全員存活通關）才解鎖的秘密地圖
- [ ] 角色關係系統：隊員之間的羈絆值，高羈絆觸發援護攻擊
- [ ] 世界末日計時器：全域倒數，時間壓力機制，逼迫玩家優先完成主線

### Roguelite 要素
- [ ] 永久死亡模式（Hard Mode）：角色死亡後從隊伍永久消失
- [ ] 隨機事件系統：行軍途中隨機觸發事件（補給、伏擊、商旅），影響資源
- [ ] Run 解鎖進度：通關後解鎖「挑戰詞條」（限制條件 + 高額獎勵）

## 🤖 Meta-Review 建議

- [ ] 🔄 spec 的 seeding 說明寫「wherever `this.gameState` is first assigned」而非直接指定方法名——建議改為「在 `create()` 的 `scenes/BattleScene.ts:117` 行 `this.gameState = data.gameState` 之後插入」，讓 Coder 不需額外 grep 確認插入位置
- [ ] 🔄 AC-9 的 regression 測試完全落在 `WeaknessDiscovery.test.ts` 的 `isWeaknessIconVisible` 單元測試已覆蓋範圍內——建議未來 regression section 只列「執行既有測試套件應通過」，不重複定義已有 gate 行為的新 AC
- [ ] 💰 `makeGameState()` factory 在 `WeaknessDiscovery.test.ts`（第 19 行）與 `GeneralWeaknessWiring.test.ts`（第 24 行）各自獨立定義、結構完全相同——建議抽取到 `tests/unit/helpers/gameState.ts` 共用，兩個檔案合計可省 ~15 行重複程式碼
- [ ] 💰 `StageData.weakness.test.ts` 的 `EXPECTED_WEAKNESS` 查找表（~50 行）完整鏡像 spec 的 assignment table——每新增一個敵人需在 spec、`stages.ts`、此表三處同步；建議改為存在性斷言（`expect(enemy.weakness).toBeDefined()`）加上抽查 3-4 個固定 id，消除維護負擔
- [ ] 🎮 沒有測試覆蓋「weakness hit 同時秒殺最後一隻敵人」的邊界情況——`delayedCall(900, () => showWeaknessRevealBanner(...))` callback 在 900ms 後可能對已轉場的 BattleScene 執行，建議在 callback 中加入 `if (!this.scene.isActive()) return` guard 並補充對應的邊界測試
