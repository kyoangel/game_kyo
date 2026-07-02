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
- [x] All-Out Attack BattleScene 串接：`TurnEngine.applyWeaknessBonus`（加成回合）、`Character.knockedDown`（stagger）、`battle/AllOutAttack.ts`（全體攻擊觸發）均已有獨立單元測試，但 `scenes/BattleScene.ts` 完全沒有呼叫點 —— 弱點命中從不觸發 stagger、不給予 bonus action、也不會引發 All-Out Attack，與背板「連鎖攻擊」已勾選的狀態矛盾。需要在 `executePlayerCommand` 的傷害結算後正確排序：命中弱點 → knockedDown → 判斷 allEnemiesKnockedDown → 觸發 All-Out Attack 動畫 → 移除 knockedDown 標記。Spec: `specs/pixel-squad-all-out-attack-wiring.md`

### 成長與建構
- [x] 裝備系統：武器 / 防具欄位，商店可買裝備，提供屬性加成。Spec: `specs/pixel-squad-equipment-system.md`
- [x] 技能樹：每個角色有獨立的技能解鎖路徑（3 個分支）。Spec: `specs/pixel-squad-skill-tree.md`
- [x] 技能樹重置（洗點）道具：允許玩家花費資源清空單一角色的 `unlockedSkillNodeIds` 並全額返還已花費的 `skillPoints`，修正誤點分配的問題（`specs/pixel-squad-skill-tree.md` 已定義的樹狀結構為前提）。Spec: `specs/pixel-squad-skill-tree-respec.md`
- [x] 傭兵評鑑系統：戰鬥結束依表現（傷害輸出、存活率、弱點利用）給星評分，影響獎勵。Spec: `specs/pixel-squad-mercenary-rating.md`
- [x] 傭兵評鑑歷史記錄：目前星評分只在單場戰鬥的 `ResultScene` 顯示與影響當場獎勵，不會持久化——`GameState` 未新增任何欄位記錄各關卡最佳星等。若要在世界地圖或關卡選擇畫面顯示「最佳評鑑」，需額外設計 `bestStarRatings?: Record<string, number>` 之類的持久化欄位與存檔遷移。Spec: `specs/pixel-squad-mercenary-rating-history.md`

### 探索與劇情
- [x] 隱藏關卡：符合條件（如全員存活通關）才解鎖的秘密地圖。Spec: `specs/pixel-squad-hidden-stage.md`
- [x] 角色關係系統：隊員之間的羈絆值，高羈絆觸發援護攻擊。Spec: `specs/pixel-squad-bond-system.md`
- [x] 世界末日計時器：全域倒數，時間壓力機制，逼迫玩家優先完成主線。Spec: `specs/pixel-squad-doomsday-timer.md`

### Roguelite 要素
- [x] 永久死亡模式（Hard Mode）：角色死亡後從隊伍永久消失
- [x] 隨機事件系統：行軍途中隨機觸發事件（補給、伏擊、商旅），影響資源
- [ ] Run 解鎖進度：通關後解鎖「挑戰詞條」（限制條件 + 高額獎勵）

## 🤖 Meta-Review 建議

- [ ] 🔄 spec 的 seeding 說明寫「wherever `this.gameState` is first assigned」而非直接指定方法名——建議改為「在 `create()` 的 `scenes/BattleScene.ts:117` 行 `this.gameState = data.gameState` 之後插入」，讓 Coder 不需額外 grep 確認插入位置
- [ ] 🔄 AC-9 的 regression 測試完全落在 `WeaknessDiscovery.test.ts` 的 `isWeaknessIconVisible` 單元測試已覆蓋範圍內——建議未來 regression section 只列「執行既有測試套件應通過」，不重複定義已有 gate 行為的新 AC
- [ ] 💰 `makeGameState()` factory 在 `WeaknessDiscovery.test.ts`（第 19 行）與 `GeneralWeaknessWiring.test.ts`（第 24 行）各自獨立定義、結構完全相同——建議抽取到 `tests/unit/helpers/gameState.ts` 共用，兩個檔案合計可省 ~15 行重複程式碼
- [ ] 💰 `StageData.weakness.test.ts` 的 `EXPECTED_WEAKNESS` 查找表（~50 行）完整鏡像 spec 的 assignment table——每新增一個敵人需在 spec、`stages.ts`、此表三處同步；建議改為存在性斷言（`expect(enemy.weakness).toBeDefined()`）加上抽查 3-4 個固定 id，消除維護負擔
- [ ] 🎮 沒有測試覆蓋「weakness hit 同時秒殺最後一隻敵人」的邊界情況——`delayedCall(900, () => showWeaknessRevealBanner(...))` callback 在 900ms 後可能對已轉場的 BattleScene 執行，建議在 callback 中加入 `if (!this.scene.isActive()) return` guard 並補充對應的邊界測試

- [ ] 🔄 「Scene active guard」段落先寫「All `this.time.delayedCall(...)` callbacks...must start with guard」（全域規則），但後面只列出兩個明確要加 guard 的地點——導致 `executeNextInQueue` 的凍結跳過 `delayedCall(600, ...)`、defend 的 `delayedCall(900, ...)`、`executeEnemyAction` 的 boss phase `delayedCall`（`scenes/BattleScene.ts` 現有程式碼）都沒有加 guard，卻同樣會在 checkBattleEnd 轉場後對已失效的 scene 操作。建議 spec 明確列出檔案中「每一個」需要 guard 的 delayedCall 呼叫點，或明確縮小範圍為「僅新增的呼叫點」，避免全域宣告與明確清單互相矛盾
- [ ] 🎮 `BattleScene.aoaWiring.test.ts`／`BattleScene.sceneGuard.test.ts` 全部是對原始碼文字做 regex/brace-matching 斷言（因為 Phaser Scene 無法在 Node vitest 環境實例化），而非驗證實際行為——即使邏輯錯誤（例如 queue 插入順序錯、HP 扣減錯誤）只要字串樣式吻合仍會通過，且日後單純改變數命名（如 `queue` → `remaining`）就會讓測試假性失敗。建議把 `executeNextInQueue`／`showAoaPrompt` 內的純狀態轉換（knockdown 判定、queue 插入、AOA 傷害後的 alive/hp 更新）抽成不依賴 Phaser 的純函式，讓這類 wiring 測試改用真實輸入輸出驗證，取代目前的原始碼字串比對
- [ ] 🎮 AC-7 只驗證「AOA 傷害後 `stats.hp <= 0` 的敵人會被設為 `alive = false`」，沒有規範或測試「部分知覺敵人被 AOA 打傷但沒死」的情況——這些敵人仍保留 `knockedDown = true` 直到下回合 `resetRoundFlags`，理論上若同回合又有新的 weakness hit，`shouldTriggerAoa` 會因為 `aoaState.usedThisRound = true` 被擋下，但目前沒有 AC 或測試明確驗證「AOA 未全滅時的殘存 knockedDown 狀態不會導致同回合重複觸發 AOA 提示」。建議新增 AC 明確定義此邊界情況並補測試
- [ ] 💰 spec 的「Rules」段落用文字重述 knockdown／bonus action／AOA 的條件邏輯，「UI Changes」段落再用近乎逐字的完整程式碼區塊重複同一段邏輯一次——Coder 只需依照程式碼區塊即可滿足所有 Rules 條件，文字說明沒有提供額外資訊卻佔了大量篇幅。建議 Rules 段落改為簡短條列並註明「詳細實作見 UI Changes 程式碼區塊」，省去重複描述
- [ ] 🔄 「Scene active guard」段落先寫全域規則（所有 delayedCall 都要 guard），但後面只明確列出兩個地點——導致 `executeNextInQueue` 凍結跳過的 delayedCall、defend 的 delayedCall、boss phase 的 delayedCall 都沒補 guard，規則與明確清單互相矛盾，建議 spec 列出檔案中每一個需要 guard 的呼叫點或明確縮小範圍
- [ ] 🎮 新增的兩個 wiring 測試檔全是對原始碼文字做 regex/brace-matching，並非驗證實際行為，邏輯錯誤只要字串樣式吻合仍會通過、單純改變數名就會假性失敗，建議把純狀態轉換邏輯抽成不依賴 Phaser 的純函式以便真正做行為測試
- [ ] 🎮 AC-7 沒定義「AOA 傷害未能全滅、部分敵人存活但仍標記 knockedDown」時是否會在同回合重複觸發 AOA 提示，建議補上對應 AC 與測試
- [ ] 💰 spec 的 Rules 段落與 UI Changes 段落幾乎逐字重複描述同一段邏輯，建議 Rules 改為簡短條列並指向程式碼區塊，省去重複篇幅
- [ ] 🔄 Spec 聲稱「`effectiveStat` 本體不變，只改 base 運算式」，但驗收條件 `Math.floor(26*1.2)===31` 實際上迫使 Coder 修改了 `effectiveStat` 內部（加入 `Math.floor`），造成規格文字與可驗證行為互相矛盾；未來 spec 應直接寫明「`effectiveStat` 的 buffed 計算需加上 `Math.floor`」，避免 Coder 需要自行判斷是否違反明文限制。
- [ ] 💰 `battle/EquipmentSystem.ts` 的 `addEquipmentToInventory`/`removeOneFromInventory` 與 `battle/ShopSystem.ts` 的 `addToInventory` 邏輯完全相同（都是操作 `{itemId, quantity}[]`），建議抽成共用的 generic inventory helper（例如 `battle/InventoryUtils.ts`）供兩邊 import，減少未來修改時需要同步兩份程式碼。
- [ ] 💰 `scenes/BaseScene.ts` 的 `renderCharCard` 與 `scenes/PrepScene.ts` 的 `renderPartyList` 內含逐字相同的裝備摘要區塊（`⚔${weapon.name} 🛡${armor.name}` 組字邏輯），建議抽成 `battle/EquipmentSystem.ts` 裡的 `formatGearSummary(character): string` 共用函式。
- [ ] 🎮 目前沒有測試涵蓋負數 SPD 裝備（如 `weapon_heavy_cannon` SPD-2、`armor_titan_shell` SPD-3）疊加後把 `effectiveSpd` 壓到 0 以下的情況，而 `TurnEngine.ts:8` 的出手順序排序直接使用該值相減；請在 `Buffs.equipment.test.ts` 補上低基礎 SPD 角色同時裝備這兩件負面裝備的案例，並確認 `TurnEngine` 排序在負值下仍合理。
- [ ] 🎮 `EquipmentScene.showEquipmentPicker` 的「該格位無可用裝備」placeholder 分支（`entries.length === 0` 顯示「（無可用裝備，請先至商店購買）」）目前完全沒有自動化測試覆蓋，建議至少在 `EquipmentSystem.test.ts` 新增一個案例驗證：當 `equipmentInventory` 對某個 slot 過濾後為空陣列時，呼叫端能正確取得空陣列而非 `undefined`，避免 UI 端過濾邏輯的隱性假設之後被破壞而不被發現。
- [ ] 🔄 在 spec 的 Rules 區塊中，Rule 4 與 Rule 5 對「已學會技能跳過上限檢查」描述重複兩次（"same rule... same check, not a separate exemption"），可合併成一條規則並讓 AC-6/AC-7 直接引用，減少 Coder 需要交叉比對兩處措辭是否一致的認知負擔。
- [ ] 💰 `data/characters.ts` 的技能樹指派表（12 個角色 × 3 分支）目前以 Markdown 表格 + 對應的 `buildSkillTree(...)` 呼叫重複描述兩次（表格與 code example），未來新增角色時建議只保留程式碼範例或改用更精簡的 CSV/JSON 片段，減少 spec token 量。
- [ ] 🎮 `SkillTree.ts` 缺少「skillPoints 恰好等於 node.cost」的邊界測試（`canUnlockNode` 在 `skillPoints === cost` 時應為 true），目前測試只涵蓋 `skillPoints: 1`（等於 tier1 cost）與 `skillPoints: 0`，未單獨驗證 tier2 cost=2 時 `skillPoints: 2` 恰好足夠的情況。
- [ ] 🎮 `SkillTreeScene.renderNode` 解鎖成功後只重播 `SFX_KEYS.purchase` 並重繪面板，沒有針對「剛解鎖的節點」加上短暫的高亮/縮放等視覺回饋，建議之後追蹤加入解鎖動畫，讓玩家能明顯感知哪個節點剛被點亮（尤其一次可連續解鎖多個節點時容易忽略变化）。
- [ ] 🔄 Rule 6 提到 `getSkillTree` 對 recruited-enemy 角色會回傳 `undefined` 並引用外部 spec 檔 `specs/pixel-squad-recruit-fix.md`，但沒有在 Test plan 中明確要求驗證「squad 中混合一般角色與 recruited-enemy 角色時列表渲染不出錯」的整合情境，僅涵蓋單一角色的 AC-8，建議之後補一個涵蓋混合陣容的測試案例。
- [ ] 🔄 AC-3 的措辭「reference-unchanged in content (same skill ids, same length)」混用了「參照不變」與「內容相同」兩種不同斷言，容易誤導 Coder 寫成 `toBe` 而非 `toEqual`；未來 spec 中類似的陣列/物件不變性 AC 應明確寫「內容相等（toEqual），不要求物件參照相同」以消除歧義。
- [ ] 💰 `SkillTreeScene.ts` 的 `addRespecButton`、`showRespecConfirm`、`addCloseButton` 三處重複寫死了按鈕尺寸（110x32）與顏色碼（0xb45309 橘 / 0x7f1d1d 紅 / 0x4b5563 灰），可抽成場景頂部的共用常數（如 `BUTTON_SIZE`、`COLOR_RESPEC`、`COLOR_CANCEL`、`COLOR_DISABLED`）減少重複字面值。
- [ ] 💰 `tests/unit/SkillTree.respec.test.ts` 第 12 行手動宣告 `const RESPEC_ITEM_ID = 'item_respec_module'`，而非像 `ShopData.respec.test.ts`／`SaveSystem.skillTreeRespec.test.ts` 一樣從 `data/shopItems.ts` import 匯出的常數，未來若該 id 變動，此測試不會同步反映，應改為 import。
- [ ] 🎮 `calculateRespecRefund` 對 `unlockedSkillNodeIds` 中「已不存在於目前 `getSkillTree()` 回傳陣列」的節點 id 會透過 `tree.filter` 靜默忽略其花費，若未來技能樹改版移除/改名節點，玩家洗點時會悄悄少退還點數且無任何警告；應在 `SkillTree.respec.test.ts` 新增一個「unlockedSkillNodeIds 含有 tree 中不存在的 id」情境測試，確認此行為是否為預期。
- [ ] 🎮 `showRespecConfirm` 的確認文案（`重置 ${char.name} 的技能樹？...`）沒有提及「已學會的技能不會被移除」這個 Rule 4 的關鍵限制，玩家容易誤以為洗點會連技能一起清空，建議在確認面板文字加一行提示以降低誤解與客服詢問。
- [ ] 🔄 為 AC-5（defeat 時不渲染星星）補一個 ResultScene 的原始碼斷言測試（比照 `BattleScene.mercenaryRating.test.ts` 手法），目前沒有任何測試檔案實際驗證 `ResultScene.ts` 裡 `if (victory && starRating > 0)` 這個守門條件，AC-5 只在 `resultUI.starRating.test.ts` 的純函式層級被間接覆蓋。
- [ ] 🔄 AC-7/AC-8（roundsUsed 計數不重複/不漏算）目前僅用 regex 比對原始碼結構，無法偵測執行期的實際計數錯誤；建議建立一個可在 vitest 下執行的 `BattleScene` 最小 stub（mock 掉 Phaser.Scene 依賴），改寫成真正跑完 4 個回合後斷言 `battleStats.roundsUsed === 4` 的行為測試。
- [ ] 💰 `{ playerKOCount: 0, weaknessHitCount: 0, roundsUsed: 0 }` 這個物件字面量在 `BattleScene.ts` 的欄位初始化與 `init()` reset 中重複兩次，且測試檔案裡又以完整 regex 重複比對三次；建議在 `types.ts` 加一個 `createEmptyBattleStats(): BattlePerformanceStats` 工廠函式取代重複字面量。
- [ ] 🎮 3★ 與 1★ 的差異目前只有靜默淡入的星星圖示（22px 文字），沒有任何額外音效或視覺強化，玩家很容易忽略這個最高 +20% 獎勵的達成；建議在 `starRating === 3` 時加一個獨立 SFX（如複用 `SFX_KEYS.crit` 或新增專屬音效）強化回饋。
- [ ] 🎮 目前沒有測試涵蓋「同一場戰鬥中玩家死而復生或多名隊員同時死亡」時 `playerKOCount` 是否正確累加超過 1 的情境（AC-9 只驗證 guard 邏輯，未驗證多次死亡的累加值）；建議補一則整合測試模擬兩名隊員各被擊倒一次，驗證 `playerKOCount === 2`。
- [ ] 🔄 Spec 描述「3-character star suffix」但實際程式碼是 `` `  ${'★'.repeat(bestRating)}${'☆'.repeat(...)}` ``（前面還有 2 個空格，共 5 字元），措辭與實作不符，未來 spec 應直接寫出精確字串範本（如 `` `  ★★☆` ``）而非用「3-character」這種會誤導 Coder 的字數描述。
- [ ] 🔄 Spec 沒有為 `bestStarRatings` 存到超出 1-3 合法範圍（例如手動編輯存檔或未來 bug 寫入負值）定義行為與 AC，應新增一條 AC 要求 `WorldMapScene` 在讀取 `bestRating` 時 clamp 到 `[0,3]` 區間。
- [ ] 💰 `tests/unit/support/extractMethod.ts` 與新增的 `tests/unit/support/extractWorldMapMethod.ts` 內含幾乎完全相同的 35 行大括號比對演算法（`extractMethod` 函式），應合併成單一 `extractMethod(source, methodName)` 通用工具，場景檔路徑改用參數傳入（如 `readSceneSource(path)`），供 BattleScene 與 WorldMapScene 測試共用。
- [ ] 🎮 `WorldMapScene.createStageList()` 中 `'★'.repeat(bestRating)` 沒有下限保護，若 `bestRating` 為負值（例如存檔被手動竄改或未來合併邏輯出錯寫入負數）會直接拋出 `RangeError: Invalid count value`，導致整個世界地圖畫面無法渲染；應在讀取後加上 `Math.max(0, Math.min(3, bestRating))` 並補一則「bestRating 為 -1 或 4」的邊界測試。
- [ ] 🎮 玩家重玩已通關關卡並刷新最佳星等時（例如從 1★ 進步到 3★），目前沒有任何「New Best!」提示或強化回饋，玩家可能完全沒注意到自己的紀錄被更新；建議在 `ResultScene` 偵測 `starRating > previousBest` 時加入額外文字或動畫提示。
- [ ] 🔄 spec 應明確要求 WorldMapScene.hiddenStage.test.ts 用 `stageRows.length` 差異驗證 AC-4（未解鎖時 row 數量不變）與 AC-5（解鎖後恰好 +1），目前測試計畫只做 source-text 斷言，並未真正驗證 rule 7「不影響 scroll 高度」這條最核心的行為
- [ ] 🔄 VictoryProcessor 簽名已連續兩次在末尾追加可選參數（starRating、alliesSurvived），建議之後的 spec 在 Rules 區塊固定寫明「新增參數必須是目前最後一個可選參數，禁止插入既有參數之間」，避免下一次功能疊加時位置搞錯
- [ ] 💰 WorldMapScene 的 hidden-stage render pass 幾乎完整複製了 per-chapter 迴圈裡 background/text/interactive 的建構邏輯（約 30 行），建議抽出共用 `createStageRow(stage, bgColor, textColor, prefix, isAvailable)` helper，兩處都呼叫它，減少重複並避免未來只改一處導致行為分歧
- [ ] 🎮 沒有任何測試驗證 HS-1 的 `preDialog`（'???' 說話者、三行台詞）真的會在首次進入戰鬥前顯示，建議補一個 BattleScene 或 stage-transition 測試斷言 `preDialog.lines` 被正確讀取並渲染
- [ ] 🎮 HS-1 的敵人數值（vault_keeper HP220/ATK34/DEF24）相對前置關卡 2-5（Crow boss）沒有數值比較測試來保證「隱藏關卡應更具挑戰性」的設計意圖，建議新增一個測試斷言 HS-1 敵人平均 HP/ATK 高於 2-5 的敵人平均值，把平衡意圖變成可驗證的迴歸防線
- [ ] 🎮 The current implementation of the "Survival Gate" (AC-13) requires a complex closure (`afterPrimaryHit`) to ensure the target is alive before the support attack resolves. Given this critical timing dependency, consider adding a specific combat log entry or visual cue that explicitly confirms the support attack successfully resolved *after* the primary damage calculation, especially if the target survived only due to the support attack.
- [ ] 🎮 While `calcSupportDamage` enforces a minimum of 1, if the base damage is very low (e.g., 2-3), the fixed 0.6 multiplier combined with `Math.floor` means the support attack frequently resolves to this minimum value. This might diminish the feeling of contribution; consider if a dynamic scaling factor or a small bonus range could be added to make the support damage feel more variable based on the primary attack's power.
- [ ] 🔄 The `supportUsedThisRound` flag is reset in `startCommandPhase`. To ensure absolute determinism and prevent any edge cases where a character might act in an unexpected state, explicitly verify that `startCommandPhase` is called *before* the first action of a new combat round begins, and not merely during a phase transition.
- [ ] 🎮 The bond gain is based on the pair being alive at the end of the battle. If a character survives but was near death, they are equally weighted in the bond gain calculation as someone who survived with full health. Consider if a small, non-bond related factor (e.g., percentage of HP lost) could subtly influence the bond gain to reflect shared peril, adding depth beyond simple binary survival.
- [ ] 🔄 The dependency chain where `processVictory()` handles both the game progression (setting `hasClearedGame`) and the time pressure (ticking the clock) is highly coupled. For future scalability, consider refactoring into a dedicated `DoomsdayService` that takes the current state and stage, returning a *new* resulting state object, thus isolating the complex win/tick priority logic (Rule 7).
- [ ] 💰 The `VictoryProcessor` is currently the single choke point for all progression. While the Doomsday logic is cleanly extracted into `DoomsdayClock.ts`, consider making the interaction with this clock a dedicated, atomic function call within `processVictory` (e.g., `applyDoomsdayTick(gameState, stage)`), rather than embedding the tick as the final mutation step.
- [ ] 🎮 The "Reload Guard" (Rule 9) being the *only* checkpoint outside of `processVictory` is a severe constraint. If any new transition points are added (e.g., pause screens, chapter breaks), this guard must be manually replicated or the Doomsday system will fail to detect expiry in those contexts.
- [ ] 🎮 The transition from "Doomsday Expired" to the bad ending screen is abrupt. While intentional, tracking a small buffer or visual cue (e.g., the clock ticking down to 0 while still in the main story) could enhance the feeling of inevitable pressure without compromising the hard expiry mechanic.
- [ ] 💰 The `GameState` is currently serving as both persistent save data and transient runtime status. If the game grows, consider introducing a `RunSession` object that holds volatile data like the current countdown (`doomsdayDaysRemaining`) while `GameState` remains focused purely on long-term, persistent milestones (like `bondLevels` or `ngPlusCycle`).
