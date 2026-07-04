# 戰鬥 HUD 復古風格重製

## Goal
把 BattleScene 現有「網頁風格」的角色列（monospace 字體、Tailwind 配色、血量漸層色血條）換成致敬 Famicom 時代三國志類遊戲 VS 比較畫面的復古風格：黑底、粗體點陣字、陣營色血條、角色固定站在自己血條上的靠中位置。目標是解決目前 UI「難看、不專業」的核心問題之一。

## 視覺參考
致敬對象：Famicom 時代的三國志戰力比較畫面（黑底、左右陣營對峙、角色站在分段式橫條上）。透過瀏覽器 mockup 反覆確認後鎖定的版面規則如下（見「版面規則」一節）——**這不是逐圖素描，是抽取設計語言後的重新詮釋**，同時也是唯一在這份規格中真正可行的「圖像參考」形式：AI 生圖工具無法可靠產生精確版面座標，因此版面直接用 Phaser 程式碼實作，不透過生圖。

## 現況分析（為什麼需要重構，不能只是換顏色）
`workspace-pixel-squad/src/scenes/BattleScene.ts` 的 `renderParty()`（約 226–281 行）目前對每個角色只用單一 x 座標 `cx`（玩家欄固定 `x=90`、敵方欄固定 `x=270`，畫布寬 360px），角色的頭像、名字、血條、血量文字、狀態圖示、弱點圖示、指令圖示全部以 `cx` 為錨點左右/上下微調位置。這個 `cx` 同時也是：
- 角色頭像的點擊互動熱區（`onPlayerBodyTap`）
- `CharacterAnimator` 動畫播放位置
- 飄傷害數字的錨點
- 狀態圖示、弱點圖示、指令圖示的定位基準

而本次要求的版面規則是「名字／血條／血量數字固定不動，只有角色頭像的位置會往陣營中線靠攏」。這代表**單一錨點模型不再夠用**，需要拆成兩個錨點（見下一節），這也是為什麼不能只是改改顏色跟字體了事。

## 版面規則（已在瀏覽器 mockup 反覆確認鎖定）
- 純黑背景。
- 粗體、等寬、高對比的點陣風格字體（非目前的網頁 `monospace`，見「字體」一節）。
- 陣營色即資訊：友軍＝橘色系，敵方＝紫色系，取代現在依血量百分比變色（綠/黃/紅）的血條配色。
- 每一列：名字＋血量數字固定在外側（友軍靠左、敵方靠右），血條在內側（往陣營中線方向延伸），血條容器寬度固定，長度不隨畫面靠攏程度改變，只有填色比例反映目前血量。
- 血條容器寬度較窄（不橫跨整個欄位），讓角色頭像本身維持視覺主體地位。
- 角色頭像固定貼在「自己那條血條」的 3/4 處（靠近陣營中線的一端），不隨血量變化移動；此為角色的唯一浮動位置，用來製造「兩軍逼近對峙」的張力。

## 架構：雙錨點模型
新增第二個 x 錨點，取代現有的單一 `cx`：

- **`labelX`**：沿用現有的 `cx`（玩家 `x=90`、敵方 `x=270`）。掛載名字文字、血條容器、血量數字——這些維持在原本的位置，不受本次改動影響。
- **`portraitX`**：`labelX` 往陣營中線方向的固定偏移（友軍為正偏移、敵方為負偏移），落在血條容器的 3/4 處。掛載：角色頭像（sprite/image/rectangle）、點擊互動熱區、`CharacterAnimator` 播放位置、飄傷害數字錨點、狀態圖示、弱點圖示、指令圖示——這些原本就該跟著「角色本人」走，改用 `portraitX` 定位在邏輯上更正確，不只是為了配合新版面。

實作上建議把血條容器寬度設為常數（例如 `BAR_WIDTH`），`portraitX = labelX ± BAR_WIDTH * 0.75`（正負號依 `isPlayer` 決定方向）。**確切像素數字需要在實作時對照真實 Phaser 畫布（角色 sprite 現況為 44×56px）做視覺校正**——本規格提供的是規則與起始參數，不是最終定案的像素值；實作完成後必須跑一次瀏覽器截圖確認比例，不能只憑本文的建議值。

建議在 `src/ui/theme.ts` 新增陣營色 token（取代 `HP_HIGH`/`HP_MID`/`HP_LOW` 這組依血量百分比變色的邏輯，僅在 `BattleScene` 血條情境下使用）：
- `TEAM_ALLY: 0xf5a623`（橘）
- `TEAM_ENEMY: 0xb083e6`（紫）
- `BG_BATTLE: 0x000000`（純黑，區別於 `BaseScene` 用的 `BG_DARK: 0x0d1117`）

上述色值取自瀏覽器 mockup 定案版本，可作為起始值，實際觀感仍以真實畫布截圖為準。

## 涵蓋範圍與邊界情況
- 我方隊伍 1–5 人、敵方 1–4 人不等（依 `stages.ts` 實際內容），垂直排列邏輯（`renderParty` 內的 `topY`/`bottomY`/`n` 計算）維持不變，只改每一列的橫向畫法。
- 血條顏色改為純陣營色（友軍橘／敵方紫），不再依血量百分比變色；血量資訊改由數字＋填色比例傳達。
- 既有的 `updateHpBar`、`updateStatusIcons`、`updateWeaknessIcon`、指令圖示（`commandIcons`）等函式需要跟著改用 `portraitX`，但函式本身的業務邏輯（血量計算、狀態判斷）不變。
- 不在本次範圍內：`TurnOrderStrip`、`ResultScene`、`WorldMapScene` 等其他畫面的視覺風格，暫不處理。

## 字體
AI 生圖工具無法產生「可用的字型檔」——遊戲需要的是每個中文字形都乾淨、間距一致、可任意組字的字型，這只能透過選用/取得現成字型檔達成,不是生圖提示詞能解決的問題。實作時需研究並選定一套授權允許用於本專案（含商用可能性）、涵蓋足夠繁體中文字的點陣風格字型，候選方向：
- Zpix（最像素浪漫風格點陣字，需確認授權條款是否符合專案需求）
- Pixel Mplus（授權明確為 M+ FONT LICENSE，寬鬆），但主要涵蓋日文漢字，需確認遊戲用字是否都在涵蓋範圍內
- 其他繁體中文點陣字型（實作時另行搜尋比較）

選定後以 web font 或 Phaser bitmap font 形式載入，取代 `BattleScene.ts`／`theme.ts` 中目前的 `fontFamily: 'monospace'`。

## 角色美術（AI 生圖提示詞的實際用武之地）
現有素材為拼湊來源（`character_rogue.png` 來自 OpenGameArt 的 Animated Rogue、怪物素材來自 CraftPix 的 RPG Monster Sprites），風格不統一。盤點需要統一重製的角色頭像：
- 12 名玩家角色（`src/data/characters.ts`）
- 6 種敵方怪物類型（`demon`／`dragon`／`jinn`／`lizard`／`medusa`／`small_dragon`，取自 `src/data/stages.ts` 的 `monsterType` 欄位；同類型共用一張頭像，不需要每個敵人實例各自一張）

共 18 張頭像需要生成，統一使用同一套復古像素風格描述（黑底陣營配色的世界觀下，角色本身走 16-bit/8-bit 像素肖像路線）。逐張提示詞見文末附錄。

**注意**：致敬對象（Famicom 三國志類 VS 畫面）只借用其 UI 呈現手法（黑底、陣營色、粗體點陣字），不代表要把 pixel-squad 的角色改成古代中國武將——角色美術仍應延續遊戲本身「廢土倖存者傭兵隊」的世界觀設定，附錄提示詞已依此方向撰寫。

## 測試
`BattleScene.ts` 現有測試多為原始碼字串的 regex/brace-matching 斷言（因為 Phaser Scene 無法在 vitest 環境真正實例化，這點在過去的 Meta-Review 建議中已被指出多次）。本次把 `labelX`/`portraitX` 的座標計算抽成不依賴 Phaser 的純函式（例如 `computeRowAnchors(cx, isPlayer, barWidth): { labelX, portraitX }`），可以寫成真正驗證輸入輸出的行為測試，取代字串比對，是這次重構的附帶效益之一。

新增/調整測試涵蓋：
- `computeRowAnchors` 對友軍／敵方回傳正確方向的偏移
- 血條填色比例計算（沿用現有邏輯，只改配色來源，需確認既有測試仍通過）
- 既有的 `BattleScene` 相關測試（tap 選人、飄字、狀態圖示）需要因為錨點改變而更新對應的座標斷言，不得破壞既有行為

## 附錄：角色頭像 AI 生圖提示詞

共用風格前綴（每張都加在個別描述前面，確保 18 張風格統一）：

> `16-bit pixel art portrait, waist-up bust, post-apocalyptic wasteland survivor RPG, thick black outline, limited muted color palette (dust brown / rust / faded olive), transparent background, SNES-era JRPG character portrait style, single character centered, no text, no watermark`

### 玩家角色（12）

| 角色 | 提示詞（接在共用前綴後） |
|------|--------------------------|
| 倖存者（protagonist，平衡型） | weary young wasteland survivor, scavenged leather jacket, makeshift pistol holstered, determined expression, improvised bandana |
| Rex（坦克，高防禦） | heavyset wasteland tank, bulky scavenged riot armor plating, round riot shield, stoic expression, welded metal shoulder guards |
| Nyx（高輸出/高速，脆皮） | lean wasteland scout sniper, tight tactical gear, long-barrel rifle over shoulder, sharp focused eyes, short cropped hair |
| Vega（輔助/BUFF） | wasteland field support specialist, chest rig with stim canisters, goggles pushed up on forehead, calm confident stance |
| Ash（防禦型輔助） | rugged wasteland medic-guard hybrid, patched armor vest, red cross tape on sleeve, watchful protective posture |
| Crow（高速刺客型） | agile wasteland raider-turned-ally, hooded scavenged cloak, dual short blades, sly smirking expression |
| Mira（防禦型醫療） | sturdy wasteland combat medic, reinforced apron over armor, medkit strapped to thigh, gentle but firm expression |
| Zora（重坦） | armored wasteland bulwark, scrap-metal full body plating, heavy stance, faceplate helmet with narrow visor slit |
| Rook（極重坦） | massive wasteland juggernaut, thick layered scrap armor, oversized tower shield, immovable heavy stance |
| Dex（最高防禦/最低速） | slow lumbering wasteland defender, thickest scavenged armor plating in the squad, riveted metal helmet, unshakable expression |
| Echo（最高速） | fastest wasteland scout, lightweight streamlined gear, twin daggers, dynamic alert crouched pose |
| AAAA（最高輸出） | fierce wasteland striker, heavy improvised gauntlets, scarred face, aggressive battle-ready stance |

### 敵方怪物類型（6，同類型共用一張，不需每個敵人實例各自生成）

| monsterType | 提示詞（接在共用前綴後，改用「敵對陣營」色調） |
|-------------|------------------------------------------------|
| demon | mutated humanoid wasteland abomination, radiation-scarred skin, glowing red eyes, twisted clawed hands |
| dragon | large irradiated reptilian wasteland mutant, scaled hide with radiation burns, elongated jaw, menacing posture |
| jinn | ghostly irradiated energy mutant, semi-transparent glowing form, wisps of toxic smoke, unsettling floating pose |
| lizard | feral irradiated reptile mutant, rough scaled skin, low aggressive crouch, sharp teeth bared |
| medusa | serpentine wasteland mutant, writhing tendrils in place of hair, cold predatory stare, toxic green undertones |
| small_dragon | juvenile irradiated reptilian mutant, smaller wiry frame, quick darting posture, faint scale glow |

實作備註：生成後仍需裁切/去背/統一尺寸，並依現有 `shouldUsePartySprite`／`shouldUseMonsterSprite`（`BattleScene.ts`）的載入邏輯放進 `public/sprites/party/` 與 `public/sprites/monsters/` 對應路徑，取代現有素材；`ASSET-CREDITS.md` 需同步移除舊素材來源、視生圖工具授權條款決定是否需要新增條目。
