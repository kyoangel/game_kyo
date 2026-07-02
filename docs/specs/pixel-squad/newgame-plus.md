# pixel-squad — New Game+ & 挑戰模式（Boss Rush）

## Goal
讓打完主線（5-5 擊敗 AAAA）的玩家，能在保留隊伍/等級/裝備的前提下重新挑戰強化版關卡（New Game+），或反覆挑戰五大頭目連戰（Boss Rush）來farm廢土幣與道具。

## Rules

### 通關判定
- 「通關」= `stageProgress.completedStageIds` 包含 `'5-5'`（最終頭目 AAAA）。
- 由於 NG+ 會清空 `completedStageIds`，需要一個**永不重置**的旗標記錄「玩家是否曾經通關過」，否則 NG+ 後就無法再判斷 Boss Rush 是否該解鎖。

### New Game+
1. 在基地（BaseScene）非章節模式下，若 `gameState.hasClearedGame === true` 且目前不在 NG+ 確認流程中，顯示「開啟 NG+」按鈕。
2. 點擊後彈出確認面板（仿照現有 `allocationPanel` / `supplyPanel` 的 Container 彈窗風格），文案需明確告知：
   - 會清空所有關卡（包含支線）的通關紀錄，需要重新打過。
   - 隊伍成員、等級、技能、屬性點、廢土幣、補給品庫存**全部保留**。
   - 敵人強度會隨 NG+ 週期數提升。
   - 此操作無法復原。
3. 確認後：
   - `stageProgress.completedStageIds = []`
   - `stageProgress.inChapterRun = undefined`
   - `ngPlusCycle += 1`
   - 其餘欄位（`pool` `squad` `currency` `expPool` `inventory` `hasClearedGame`）不變
   - 立即 `saveSlot` 並導向 `WorldMapScene`。
4. 敵人數值強化公式：`statMultiplier = 1 + ngPlusCycle * 0.3`（例如 NG+1 = ×1.3，NG+2 = ×1.6）。套用在 `EnemyTemplate.baseStats` 的 `hp` `atk` `def` 上，**不**套用在 `spd`（避免破壞既有出手順序平衡）。
5. 關卡獎勵強化公式：`rewardMultiplier = 1 + ngPlusCycle * 0.2`，套用在 `Stage.expReward` 與 `Stage.currencyReward`（四捨五入），在 `processVictory` 結算時依 `gameState.ngPlusCycle` 動態計算，**不**修改 `data/stages.ts` 原始資料。
6. 支線任務 `itemRewards`：因為 `completedStageIds` 被清空，NG+ 期間「首次通關」邏輯會重新成立，因此支線道具獎勵會在每個 NG+ 週期重新可領取一次——此為刻意設計（NG+ 的farm誘因），需在 spec 與 code comment 中說明用意，避免被當成 bug 修掉。
7. `unlockCharacterId`：NG+ 重新打主線/頭目關卡時，因為角色已在 `pool` 中（`processVictory` 已有 `alreadyInPool` 判斷），不會重複給角色，邏輯不需更動。
8. `Character.level` / `statPoints` 不會在 NG+ 重置，玩家用現有強度去打強化版敵人，形成正向 power curve。
9. NG+ 週期數沒有上限（玩家可以無限次开新一輪），但 UI 只需顯示目前週期數，不需要做封頂判斷。

### 挑戰模式（Boss Rush）
1. 解鎖條件：`gameState.hasClearedGame === true`（與 NG+ 共用同一個旗標，不受 NG+ 重置影響）。
2. 入口：`WorldMapScene` 頂部新增「挑戰模式」按鈕（在「基地」按鈕旁），僅在解鎖後顯示。
3. 玩法：玩家選擇出戰隊伍（重用 `BaseScene` 既有的 squad 選擇 UI，無需新建），確認後鎖定隊伍（仿照 `ChapterRunState.lockedSquad` 模式），依序與五個頭目連續戰鬥：`1-5 → 2-5 → 3-5 → 4-5 → 5-5`（依目前 `STAGES` 陣列中各章節的 boss 關卡，順序固定）。
4. 戰鬥之間**不會**自動補血/回合重置buff——隊伍以上一場結束時的 HP / `activeBuffs` 直接進入下一場（`defending` 重置為 false）。若隊伍全滅則整輪挑戰失敗。
5. 敵人強度：套用玩家當前 `ngPlusCycle` 的同一套 `statMultiplier` 公式（讓 NG+ 玩家用 Boss Rush 也能感受到對應強度），但**不**修改玩家主線進度（`stageProgress.completedStageIds` 不受影響、不會觸發 `unlockCharacterId` 或支線 `itemRewards`）。
6. 獎勵：全部五場頭目戰勝利後才結算，金額為「五場 `currencyReward` 總和 × 1.5」一次性發放廢土幣，並等機率從 `EXCLUSIVE_ITEMS` 中抽 1 個玩家尚未持有的道具（若已全部持有則改發等值廢土幣）。中途失敗則不發任何獎勵、廢土幣與道具不結算，直接回基地。
7. 可重複挑戰，沒有次數限制；每次挑戰都是獨立計算，不會疊加進度。

## Data model changes

`src/types.ts`：

```ts
export interface GameState {
  // ...existing fields
  ngPlusCycle: number;        // 0 = first playthrough; +1 each time NG+ is started
  hasClearedGame: boolean;    // true once stage '5-5' is cleared the first time; NEVER reset by NG+
  challengeRun?: ChallengeRunState; // present while a Boss Rush attempt is in progress
}

export interface ChallengeRunState {
  bossStageIds: string[];     // remaining boss stage ids to fight, in order, e.g. ['2-5','3-5','4-5','5-5']
  lockedSquad: Character[];   // squad snapshot, HP/buffs carry between fights
  accumulatedCurrency: number; // running total of currencyReward across cleared bosses this run
}
```

`src/save/GameState.ts`（`newGame()`）：初始化新增 `ngPlusCycle: 0, hasClearedGame: false`。

`src/battle/CharacterFactory.ts`：

```ts
export function createEnemy(template: EnemyTemplate, statMultiplier = 1): Character {
  // hp/atk/def *= statMultiplier (rounded), spd unchanged
}
```

`src/battle/VictoryProcessor.ts`：
- 新增參數 `ngPlusCycle: number`，套用 `rewardMultiplier` 到 `expGained` 與 `stage.currencyReward`。
- 在 stage.id === `'5-5'` 且為勝利時，無條件設定 `state.hasClearedGame = true`（即使非首次通關也保持 true，不會被覆蓋成 false）。

`src/types.ts`：`BattleSceneData` 新增 `isChallengeRun?: boolean`，`ResultSceneData` 新增 `isChallengeRun?: boolean`。

## UI changes

- **BaseScene**：`renderBaseMode()` 在 squad 區塊下方、商店/世界地圖按鈕上方，若 `hasClearedGame` 為 true，新增一行「目前 NG+ 週期：{ngPlusCycle}」文字 + 「開啟 NG+」按鈕（樣式仿 `shopBtn`/`mapBtn`，顏色用警示色如 `0xb45309`）。點擊開啟確認 Container 面板（仿 `allocationPanel` 風格），含說明文字、「確認開啟」與「取消」兩按鈕。
- **WorldMapScene**：頂部按鈕列新增「挑戰模式」按鈕（僅 `hasClearedGame` 為 true 時顯示），點擊導向新場景 `ChallengeScene`（隊伍選擇，重用 `BaseScene` 的 toggle squad 邏輯抽成共用函式或直接複用渲染模式）。
- **新場景 `ChallengeScene`**：顯示「挑戰模式：五大頭目連戰」說明、目前出戰隊伍列表（可調整）、「開始挑戰」按鈕。確認後建立 `challengeRun` 並啟動 `BattleScene`，帶 `isChallengeRun: true` 與 `challengeRun.bossStageIds[0]` 對應的 `stageIndex`。
- **BattleScene**：勝利且 `isChallengeRun` 為 true 時，不導向 `ResultScene` 顯示單場結果，而是：
  - 若 `challengeRun.bossStageIds` 還有剩餘關卡，直接以「上一場結束時的隊伍 HP/buff」啟動下一場 `BattleScene`（顯示簡短「下一位頭目：{name}」轉場提示）。
  - 若五場全部完成，導向 `ResultScene`，顯示「挑戰模式完成」結算畫面（總廢土幣 + 抽到的道具）。
  - 若中途戰敗，導向 `ResultScene` 顯示「挑戰失敗」，無獎勵，按鈕回基地。
- **ResultScene**：新增 `isChallengeRun` 分支渲染對應文案與獎勵摘要，沿用既有的 `makeButton` helper。

## Acceptance criteria

- Given 玩家尚未通關（`hasClearedGame === false`），When 進入 BaseScene 或 WorldMapScene，Then 不顯示「開啟 NG+」與「挑戰模式」任何入口。
- Given 玩家剛擊敗 5-5 的 AAAA，When `ResultScene` 結算勝利，Then `gameState.hasClearedGame` 變為 `true` 並存檔，後續即使開啟 NG+ 清空 `completedStageIds`，`hasClearedGame` 仍為 `true`。
- Given `hasClearedGame === true` 且不在章節模式中，When 在 BaseScene 點擊「開啟 NG+」並確認，Then `stageProgress.completedStageIds` 變為空陣列、`ngPlusCycle` 增加 1、`squad`/`pool`/`currency`/`inventory`/`expPool` 數值與點擊前完全相同。
- Given `ngPlusCycle === 1`，When 進入任一關卡戰鬥並生成敵人，Then 敵人的 `hp`/`atk`/`def` 為 `data/stages.ts` 原始值的 1.3 倍（四捨五入），`spd` 不變。
- Given `ngPlusCycle === 1`，When 通關某關卡，Then 取得的 `expGained` 與 `currencyReward` 為原始值的 1.2 倍（四捨五入）。
- Given 玩家在 NG+ 週期中重新打過某個已通關過的支線任務，When 結算勝利，Then 該支線的 `itemRewards` 會再次發放進 `inventory`（視為刻意設計，非 bug）。
- Given `hasClearedGame === true`，When 進入 `ChallengeScene` 選好隊伍並開始挑戰，Then 依序與 1-5/2-5/3-5/4-5/5-5 五個頭目戰鬥，且上一場結束時的隊伍 HP 與 `activeBuffs` 會直接帶入下一場（不會被重置或回滿）。
- Given 玩家在 Boss Rush 連戰中於第 3 場（4-5）全滅，When 戰鬥結束，Then 不發放任何廢土幣或道具，`gameState.stageProgress.completedStageIds` 與 `currency` 維持挑戰開始前的數值不變。
- Given 玩家在 Boss Rush 連戰中五場全勝，When 結算，Then 一次性獲得「五場 `currencyReward` 總和 × 1.5」廢土幣，並抽到一個尚未持有的 `EXCLUSIVE_ITEMS` 道具（或等值廢土幣，若已持有全部道具）。
- Given Boss Rush 進行中，When 玩家中途離開（無放棄按鈕需求，挑戰必須打完或全滅才結束），Then 不需額外處理——此模式不提供「放棄」選項，與章節模式的 `abandonChapter` 不同。
