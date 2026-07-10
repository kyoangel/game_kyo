# 角色動畫化 進度筆記

追蹤「讓所有隊友/怪物取得跟主角一樣的真動畫（逐幀 walk/attack/death/idle）」這件事的研究結論與待辦。不是正式 spec，是給下一次繼續處理這件事時的備忘——真的要動工時仍要走 spec/plan 流程。

## 目標

現況：只有主角（`character_rogue.png`）是真正的逐幀 sprite sheet 動畫；11 名隊友和 6 種怪物都是單張靜態圖，靠 `CharacterAnimator` 的 tween（位移/縮放/閃色）做假動畫。目標是讓隊友和怪物也變成真動畫。

## 現況盤點

- **主角**：`public/sprites/character_rogue.png`，320×320，10 欄×10 列、每格 32×32（LPC 排版），`BattleScene.ts create()` 內硬寫死 `walkRight: 30-38`／`walkLeft: 10-18`／`attackRight: 70-75`／`attackLeft: 50-55`／`death: 80-85`／`idle: 90` 這些幀編號建立 Phaser animation。
- **隊友**（`public/sprites/party/{id}.png`，11 張，96×96）：單張靜態圖，`CharacterAnimator` 的 `isSprite=false` 分支處理（呼吸縮放、位移前衝、色閃、死亡淡出/旋轉，都是 tween，不是換幀）。
- **怪物**（CraftPix 素材，`src/data/sprites.ts` 的 `MONSTER_FRAMES`）：**素材本身其實已經有完整逐幀動畫**——每種怪物都有 idle(3幀)/walk(4-6幀)/attack(3-6幀)/hurt(2幀)/death(4-6幀)的個別 PNG 檔——但 `monsterIdlePath()` 目前只取 `idle[0]` 當成單張靜態圖用，其餘幀完全沒被讀取。

## 兩軌結論

### A. 12 名隊友（含主角，若要重做） → LPC Universal Spritesheet Character Generator

- 網址：https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/
- 免費、開源（Liberated Pixel Cup 素材庫，CC-BY-SA/GPL3 混合授權，頁面明講 "You must credit the authors"）
- 2026-07-10 用 Claude in Chrome 實際打開頁面確認過的分類結構：
  - **Body Type**：Male / Female / Teen / Child / Muscular / Pregnant
  - **Body、Head、Hair、Headwear、Arms**
  - **Torso** 底下：Shirts / Aprons / Jacket / Vest / Armour / Waist / Cape / Backpack / Chainmail / Bandages
  - **Legs、Feet、Tools**
  - **Weapons** 底下：Shields / Ranged / Sword / Blunt / Polearm / Magic
  - 右側「Animation Preview」可即時預覽走路/攻擊等動畫；左上「Download」區有 `Spritesheet (PNG)`、`Credits (TXT/CSV)`、`Export/Import to Clipboard (JSON)`（可保存/複製整套選擇組合，方便之後重現或微調）
- **風格落差要注意**：LPC 是中世紀奇幻素材庫（劍、長矛、法杖、斗篷、鎖甲），沒有「手槍」「步槍」「戰術背心」這類寫實現代裝備。現在的主角圖（Animated Rogue）其實也是走這個路線（兜帽斗篷、皮衣），只是遊戲敘事上把它詮釋成「廢土倖存者」。所以幫隊友選裝備時，**用最接近的奇幻類比**即可，不用執著找到 1:1 對應的現代裝備：
  - 「手槍/步槍」→ Weapons → Ranged（弓）或直接不裝武器用 Arms 的持握姿勢
  - 「戰術背心/胸掛」→ Torso → Vest 或 Armour
  - 「兜帽斗篷」→ Cape、Headwear
  - 「重型盔甲」→ Torso → Armour + Chainmail，Weapons → Shields
  - 「雙短刀」→ Weapons → Sword（挑短刃款式）
- **重要落差（之後要處理，不是使用者的工作）**：LPC 產生器匯出的表格幀佈局（每個動作幾格、frame index）**不會**跟現在寫死在 `BattleScene.ts create()` 的 `animDefs` 對上。使用者只需要生圖存檔，**佈局重新對應、程式碼串接是之後的實作任務**，屆時要看實際拿到的圖表版面才能定案。
- **不適用怪物**：LPC 只有人形素體（男/女/壯碩/孩童/孕婦），沒有惡魔、龍、蜥蜴人這類生物素體（只有像 `tail_lizard` 這種能加在人形上的配件），所以怪物不能用這個工具。

### B. 6 種怪物 → 不需要新美術，是純程式碼任務

CraftPix 素材已經有完整動畫幀，只是程式碼沒接上。待辦：
- 把 `preload()` 改成用 `this.load.spritesheet(...)` 或個別載入全部 frame（idle/walk/attack/hurt/death）
- 把 `CharacterAnimator` 對怪物的分支從「tween 假動畫」改成「真的換幀播放」
- 這不需要使用者生任何新圖，之前已經下載好的 CraftPix 素材全部都在 `public/sprites/monsters/` 底下

## 下一步待辦

- [ ] 使用者用 LPC 產生器（或下面的 Claude in Chrome 自動化提示詞）產出至少 1-2 名隊友的表格，存到 `public/sprites/party-lpc-raw/`（已建立這個暫存資料夾，不會覆蓋掉現有可正常運作的 `public/sprites/party/*.png`）
- [ ] 我確認實際幀佈局後，更新 `src/battle/SpriteSelection.ts` / `src/data/sprites.ts` / `BattleScene.ts` 的 `animDefs`，把該隊友從「靜態圖 tween 假動畫」路徑改成「真 sprite 動畫」路徑（這段需要走完整的 spec/plan + TDD 流程，不是隨手改）
- [ ] 怪物真動畫的程式碼串接（獨立任務，隨時可以開始，不依賴隊友美術進度）
- [ ] 12 名隊友的圖都生完後，`ASSET-CREDITS.md` 要依 LPC 頁面的「Detailed attribution instructions」補上正確 credit——LPC 是拼裝式素材庫，不同部位可能來自不同作者，用頁面的 `Credits (TXT/CSV)` 下載按鈕能直接產生對應這次選擇組合的完整清單，每個角色生完都應該連 Credits 一起下載存起來

## 附錄：Claude in Chrome 自動化提示詞

把下面這個框框整段貼到 Claude in Chrome 的對話框，它會自己開瀏覽器操作 LPC 產生器、幫 12 名隊友各生一張動畫表。**不需要每個角色一次做完**——可以先跑一小段（例如只做 Rex 一個）看看結果，滿意再繼續。

```
請幫我用瀏覽器自動化操作這個免費的像素角色動畫產生器，幫我的 RPG 遊戲角色群產出動畫圖。

網址：https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/

這是一個開源的「組件式」角色產生器：左側面板有多個分類（Body Type、Body、Head、Hair、
Headwear、Arms、Torso 底下有 Shirts/Aprons/Jacket/Vest/Armour/Waist/Cape/Backpack/
Chainmail/Bandages、Legs、Feet、Tools、Weapons 底下有 Shields/Ranged/Sword/Blunt/
Polearm/Magic），每個分類展開後是可勾選的圖示選項，選了之後右側「Animation Preview」
會即時預覽走路/攻擊等動畫。左上角「Download」區塊有一個 `Spritesheet (PNG)` 按鈕可以
下載目前組合的完整動畫表。

風格提醒：這是中世紀奇幻風的素材庫，沒有手槍/步槍/戰術背心這類現代裝備，請用最接近的
奇幻類比（例如「手槍」用 Weapons→Ranged 的弓代替或乾脆不裝武器，「戰術背心」用
Torso→Vest 或 Armour，「兜帽斗篷」用 Cape，「雙短刀」用 Weapons→Sword 裡刀刃較短的
款式）。每個角色都選 Body Type、至少一種 Torso 服裝、Hair、Feet，武器類選項挑一個最貼近
描述的就好，不用每一項分類都填滿。

請對以下每一個角色重複這個流程：
1. 如果不是第一個角色，先按左側「Reset all」清空上一個角色的選擇
2. 依照該角色的描述，在左側面板展開對應分類、勾選最貼近的選項
3. 把右上「Animation Preview」的 Animation 下拉選單切到「Walk」看一下預覽動畫有沒有正常顯示（沒有破圖、沒有缺件）
4. 按左上「Spritesheet (PNG)」下載動畫表
5. 也按「Credits (TXT)」下載這個組合對應的授權credit清單
6. 把剛下載的兩個檔案從下載資料夾移動/更名到：
   /Users/kyo.lai82/Projects/Personal/game-factory/workspace-pixel-squad/public/sprites/party-lpc-raw/
   命名規則：動畫表存成 `{id}.png`、credit 存成 `{id}-credits.txt`（{id} 見下方對照表）

角色列表（id / 描述）：
- rex：厚重廢土坦克型，笨重的拼裝防暴盔甲、圓形防暴盾牌、木然表情、焊接金屬護肩
- nyx：精瘦廢土偵查狙擊手，貼身戰術裝、遠程武器背在肩上、銳利專注的眼神、短髮
- vega：廢土戰地支援專家、胸前掛著補給罐的背心、護目鏡推到額頭上、沉穩自信的站姿
- ash：粗獷的廢土醫護/守衛混合型、打了補丁的防具背心、袖子上綁著紅十字膠帶、警戒的守護姿態
- crow：敏捷的廢土掠奪者轉盟友、戴兜帽的拼裝斗篷、雙持短刃、狡黠的笑容
- mira：穩重的廢土戰地醫護、加強型圍裙套在防具外、大腿綁著醫療包、溫和但堅定的表情
- zora：全副武裝的廢土壁壘、廢金屬全身板甲、沉重的站姿、面罩式頭盔、窄視野縫
- rook：巨大的廢土重裝兵、厚重多層廢金屬盔甲、加大型塔盾、不可動搖的沉重站姿
- dex：緩慢遲鈍的廢土防禦者、隊伍中最厚重的拼裝盔甲、鉚接金屬頭盔、不為所動的表情
- echo：最快的廢土偵察兵、輕量化流線裝備、雙持匕首、動態警覺的蹲姿
- aaaa：兇猛的廢土打擊手、厚重的拼裝拳套、有疤痕的臉、備戰的攻擊性站姿

全部做完後，請給我一個總結表格，列出每個角色實際選了哪些分類/選項，方便我之後檢查。
```

完成後把生出來的圖給我看（或直接說已經存進 `party-lpc-raw/`），我會確認實際的幀版面，接著才進到程式碼串接的部分。
