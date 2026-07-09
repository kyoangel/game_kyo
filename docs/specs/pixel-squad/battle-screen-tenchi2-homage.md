# 戰鬥畫面吞食天地II形式復刻(角色自創)

## Goal
把 `BattleScene` 的呈現層全面改造成致敬 FC《天地を喰らうII 諸葛孔明伝》(1991, Capcom)戰鬥畫面的**形式**:5 列左右對峙、名字+兵力數字堆疊在外側、分段式血條、角色站在血條上、左下大頭肖像窗、右下白框指令/訊息窗、底部地形帶,以及原作式的回合演出節奏(行動者前進一步、攻擊前衝、受擊閃爍、兵力數字滾動減少、訊息窗逐字顯示)。

**角色與世界觀完全自創**:沿用 pixel-squad 既有的廢土傭兵設定,不使用任何卡普空素材(見「美術規範與版權界線」一節)。這是上一次 `battle-hud-retro-reskin.md`「設計語言重新詮釋」的升級版——這次做到「玩過原作的人一看就認出形式」的忠實度。

## 視覺參考
使用者提供的兩張原作戰鬥截圖 + 影片(https://youtu.be/m-J7UwzSa8E?t=6)。原作版面拆解:

1. 純黑背景,最多 5 列對戰行(我方左、敵方右,一列一對)
2. 名字在外側(粗體白色點陣字),兵力數字在名字正下方
3. 分段式血條從外側往中線延伸(我方橘、敵方紫),角色 sprite **站在血條上**靠中線端
4. 行動中/被下指令的角色往中線前進一步(原作另有陣形錯位,見「不做什麼」)
5. 左下:當前行動者的大頭肖像窗(白框黑底)
6. 右下:白色雙線框視窗——指令階段是選單(▶ 游標),執行階段是逐字訊息窗
7. 最底部:戰場地形帶(原作為水紋+地面圖樣橫條)

**注意**:本專案畫布為 360×640 直式(`src/main.ts:12-24`,`pixelArt: true`),原作為 256×240 橫式。版面規則照搬、座標重新配置(見「版面配置」)。

## 現況(探索結論,2026-07-09)
- `BattleScene.ts` 共 1268 行;`renderParty()`(226–285 行)已用純函式 `computeRowAnchors(cx, isPlayer)`(`src/ui/characterRow.ts:22-29`)做雙錨點排版,`ROW_LAYOUT` 常數:`BAR_WIDTH=50, BAR_GAP=14, BAR_HEIGHT=8, PORTRAIT_INSET=0.75`;玩家欄 `x=90`、敵欄 `x=270`,列高由 `topY=40, bottomY=470` 均分。
- 陣營色 token 已存在:`TEAM_ALLY 0xf5a623`、`TEAM_ENEMY 0xb083e6`、`BG_BATTLE 0x000000`(`src/ui/theme.ts`)。
- 指令輸入是逐角色流程:`startCommandPhase()` → `advanceCommandInput()` → `showCommandMenu()`(378–461 行),選單容器在 `(W/2, 590)`;項目:自動(僅首位)/攻擊/技能/防禦/勸降(條件性)。全點擊操作。總攻擊(AoA)是獨立的 `showAoaPrompt()`(892–955 行)確認流程,不在選單內。
- `CharacterAnimator` 已有:前衝 `playWalk`(±24px)、攻擊 `playAttack`、受擊紅閃+震動 `playHit`、死亡 `playDie`、施法 `playSkillCast`、回位 `returnToIdle`。**沒有**兵力數字滾動(`updateHpBar` 是瞬間 setText)。
- **像素字體從未整合**:全專案仍是 `fontFamily: 'monospace'`,`index.html` 無 webfont。
- 上一份 spec 的 18 張 AI 肖像**從未生成**;現有素材:`public/sprites/party/` 11 張 96×96(缺主角)、怪物為 CraftPix 逐幀 256×256、主角為 OpenGameArt rogue sheet 320×320。
- QA 待修(backlog 2026-07-05):敵人 sprite 朝向錯誤(應面向左/中線)、敵人 idle 有縮放抖動、美術風格不統一。前兩項屬呈現層 bug,**納入本次範圍**;風格統一由本 spec 美術節處理肖像部分,戰鬥小 sprite 統一另案。
- 測試型態:純函式(`characterRow.test.ts` 等)是真行為測試;`BattleScene` 佈線是 source-regex 測試(`readBattleSceneSource`/`extractMethod`,Phaser Scene 無法在 vitest 實例化)。本次沿用此分工。

## 版面配置(360×640,起始值,實作時需瀏覽器截圖校正)
以下座標是規則+起始參數,不是像素定案;實作完成後必須跑瀏覽器截圖確認比例(同上次 reskin spec 的原則)。

### 對戰列區(y ≈ 36–456,最多 5 列/側)
每列(我方為例,敵方鏡像):
- **名字**:左緣 `x=6` 起左對齊,`cy-20`,白色粗體點陣字,最多 4 字。
- **兵力數字**:名字正下方 `cy-4`,同字體,右對齊到固定欄寬(最高 4 位數 9999)。
- **分段血條**:上緣 `y=cy+18`,高 8px,從 `x=58` 往中線延伸,**10 段**(每段 8px 寬 + 1px 間隔,總寬約 89px);填色段數 = `ceil(hp/maxHp × 10)`(hp>0 時至少 1 段);我方 `TEAM_ALLY` 橘、敵方 `TEAM_ENEMY` 紫,空段畫暗色底(`0x2a2a2a`)。**段數固定、不隨 maxHp 改變長度**(原作條長反映兵力上限,本作簡化——見「不做什麼」)。
- **角色 sprite**:44×56,**底邊貼齊血條上緣**(sprite 中心 y = `cy+18-28`),x 錨在血條靠中線端往內 80% 處(我方約 `x=129`,敵方鏡像約 `x=231`);敵我 sprite 皆**面向中線**(此處一併修正 QA 記錄的敵方朝向 bug)。
- **前進一步**:正在被下指令或正在行動的角色,sprite x 往中線 tween +12px,結束後 tween 回原位(取代現行的 highlight 方式,與 `playWalk` 的 ±24px 前衝疊加時以 `originX` 管理,不可累積漂移)。
- **狀態圖示**:sprite 正上方(`cy-46`);**弱點圖示**:sprite 斜上外側;**已下指令小圖示**:名字右側。皆沿用現有資料函式(`battleStatusIcons` 等),只換定位。
- **移除**:列內的職業(archetype)文字——改顯示在肖像窗下方;血條不再依血量百分比變色(維持上次 reskin 決定)。

### 底部視窗帶(y ≈ 464–636)
- **肖像窗**(左下):`(6, 468)` 起 104×104,白色 2px 邊框、黑底;內放當前行動者 96×96 肖像;肖像下方一行小字顯示名字+職業。指令階段顯示被下指令的我方角色;執行階段顯示行動者(敵我皆換);無肖像素材時顯示暗色剪影方塊(fallback)。
- **指令/訊息窗**(右下):`(118, 468)` 起 236×104,**雙線白框**(外 2px、內 1px,間距 3px,原作風格)、黑底。雙用途:
  - **指令階段**:2 欄選單,▶ 游標指在待選項;項目沿用現有邏輯:`攻擊/技能/防禦/自動(首位)/勸降(條件)`——**指令集不增減,只換呈現**。點擊項目即選定(行動裝置);游標跟隨最後點擊。技能子選單(`showSkillPicker`)同樣移入此窗。
  - **執行階段**:逐字訊息窗(打字機效果,約 30 字/秒,可點擊跳過該則):`「Rex 的攻擊!」`→`「敵人受到 142 點傷害!」`→ 下一則。訊息模板抽成純函式模組(`src/ui/battleMessages.ts`)。
  - AoA 確認、勝敗訊息等既有 prompt 全部改用此窗的視覺樣式,**觸發邏輯不變**。
- **地形帶**(最底):y ≈ 580–636,用 Phaser Graphics 程式繪製兩條圖樣帶(上:暗青色波紋線、下:鏽橘色碎石格紋,廢土配色),不需新圖檔;繪製函式抽純資料(pattern 定義)+ 薄繪製層。

### 純函式改造
`computeRowAnchors` 擴充(或新增 `computeRowLayout(cx, isPlayer, opts)`)回傳上述所有定位:`nameX, nameY, numberX, numberY, barX, barY, segmentCount, spriteX, spriteY, stepOffset`,並新增 `fillSegments(hp, maxHp, segments)` 純函式。全部可寫真行為測試。

## 戰鬥演出(執行階段節奏,單次行動的時間軸)
1. 行動者 sprite 前進一步(+12px,150ms)
2. 訊息窗逐字:`「{名字} 的攻擊!」`(技能則為技能名)
3. `playWalk` 前衝 → `playAttack`(既有)
4. 受擊方 `playHit` 紅閃+震動(既有);同時:
5. **兵力數字滾動**:受擊方 HP 數字在 ~400ms 內從舊值滾到新值(tween counter),血條填色段數同步逐段熄滅
6. 訊息窗逐字:`「{名字} 受到 {n} 點傷害!」`(MISS/暴擊/弱點有對應模板)
7. 死亡則 `playDie` + `「{名字} 被擊敗了!」`
8. 行動者 `returnToIdle` 回原位 → 下一個行動者

既有的傷害結算、回合順序(`computeTurnOrder`、弱點加成、AoA)**邏輯完全不動**,只是把結果餵進上述演出管線。步驟 1、2、5、6 是新做;3、4、7、8 是既有動畫的重新編排。**一併修復** QA 記錄的敵人 idle 縮放抖動(檢查 `CharacterAnimator` idle scale tween 對 sprite 分支的處理)。

## 字體(必做,不再延期)
點陣中文字體是這個形式的靈魂,本次必須落地。首選:**Fusion Pixel Font(缝合怪像素字体,TakWolf)**——OFL-1.1 授權(可商用)、涵蓋繁體中文、12px 點陣風格,proportional 版即可;備選 Ark Pixel(方舟像素字体,同作者、OFL)。實作時需:
1. 確認授權條款與繁中覆蓋(遊戲用字全在字集內,特別是角色名/技能名)
2. 以 `@font-face` woff2 載入(`index.html` + `public/fonts/`),Phaser text style 換 `fontFamily`
3. `theme.ts` 的 `TextStyles` 統一改;本次至少覆蓋 BattleScene 全部文字,其他場景可沿用(fallback monospace 不會壞)
4. `ASSET-CREDITS.md` 加字體授權條目

## 美術規範與版權界線(角色自創的操作規則)
**可以像的**(不受著作權保護):8-bit 像素風格、有限調色盤、粗黑輪廓、Q版三頭身、角色站在橫條上的手法、大頭肖像窗構圖、黑底白框視窗、版面編排。
**絕對不碰**:卡普空的具體角色設計(原作武將的造型/配色組合)、逐像素臨摹原作 sprite、ROM 抽出圖檔、原作肖像的臉部設計。
**AI 生圖提示詞紀律**:只描述視覺特徵(如 `NES-era pixel art portrait, high-contrast dithered shading, limited palette`),**絕不出現**「天地を喰らう」「吞食天地」「Capcom」或任何原作角色名。

### 本次要生成的素材:18 張大頭肖像(96×96)
供肖像窗使用:12 名玩家角色 + 6 種怪物類型(同類型共用)。**直接沿用 `battle-hud-retro-reskin.md` 附錄的 18 條角色描述提示詞**(廢土傭兵世界觀,該附錄從未被執行),共用前綴改為大頭肖像取向:

> `8-bit NES-era pixel art face portrait, head and shoulders close-up, high-contrast dithered shading, thick black outline, limited 6-color palette, black background, post-apocalyptic wasteland survivor, single character centered, no text, no watermark, 96x96 pixel grid`

個別角色描述照該附錄逐條接在後面(12 玩家 + 6 怪物,怪物用敵對色調)。生成後裁切/統一 96×96,放 `public/sprites/portraits/{id}.png`(新目錄,與現有 `party/` 的戰鬥用圖分開);主角(protagonist)缺圖,這次一併生成。`ASSET-CREDITS.md` 視生圖工具條款更新。
**不在本次**:戰鬥小 sprite(站血條上的 44×56)的全面重製——沿用現有素材,風格統一留在 backlog 既有條目。

## 不做什麼(YAGNI)
- **陣形系統**:原作的陣形錯位不做(pixel-squad 無對應機制);layout 函式保留 `stepOffset` 參數,未來 formation-effects 落地時可掛接。
- **血條長度反映兵力上限**:固定 10 段,只變填色比例。
- **道具/退卻指令**:遊戲本來就沒有,不為了像原作而加。
- **其他場景**(WorldMap/Result/Shop 等)的視覺改版。
- **戰鬥邏輯**的任何變更:傷害計算、回合順序、AoA 觸發、勸降條件全部不動。

## 測試
沿用現有分工:純函式 → 真行為測試;BattleScene 佈線 → source-regex 測試(`extractMethod` 模式)。
- `computeRowLayout` / `fillSegments`:敵我方向、堆疊座標、段數計算(滿血 10 段、殘血 1 段、0 血 0 段、邊界值)
- `battleMessages`:各事件模板輸出(攻擊/技能/傷害/MISS/暴擊/弱點/死亡)
- 數字滾動插值(若抽成純函式)與打字機分節(若抽成純函式)
- 地形帶 pattern 資料函式
- `BattleScene` regex 測試:`renderParty` 改用新 layout 函式、`showCommandMenu` 移入右下窗容器、演出管線調用順序;**既有 12 個 BattleScene 測試檔因錨點/選單位置改變需同步更新,不得破壞既有行為斷言的意圖**
- 完成後跑一次瀏覽器截圖做視覺驗收(對照本 spec 版面規則);若 sandbox 擋 npm(見 memory),改用 static review + 使用者手動驗證清單
