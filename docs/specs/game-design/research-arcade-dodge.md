# Arcade Dodge 遊戲競品與 Game Feel 研究

日期：2026-11-21。目的：讓「左右移動、躲避掉落方塊」的 Phaser 3 網頁小遊戲真正好玩、可重玩。
證據標記：[V] = 本次實際抓取/搜尋到的來源；[K] = 來自一般業界知識或作者記憶，本次未能驗證（實作前請當作假設，用自己的 playtest 驗證）；[?] = 搜尋未找到，標示為缺口。

## (A) 競品表

| 遊戲 | 核心迴圈 | 張力 / 「再一次」機制 | 難度曲線 | 計分 / 風險報酬 | 短局 & 留存 | 視聽簽名 |
|---|---|---|---|---|---|---|
| Super Hexagon (Cavanagh, 2012 由 Pirate Kart 的一天原型 Hexagon 擴充) [V: Wikipedia] | 旋轉六角形中心，單鍵左右閃避收縮牆 | 死亡到重來幾乎零等待、單局極短；Hexagon/Hexagoner/Hexagonest 三階，存活 60 秒解鎖 Hyper 階 [V] | 階梯式：玩家自選難度，而非單一連續曲線；中途改變形狀（五邊形、方形）重置玩家肌肉記憶 [V: 評論] | 純存活時間；目標是「撐過 60 秒」這種明確里程碑 [V] | 局長常 <30 秒；Chipzel 音樂與配色循環是主要簽名 [V] | 控制「立刻起停」是被稱讚的點 [V]；配音報時語音、旋轉畫面 [K] |
| Duet (Kumobius, 2013) [V: Wikipedia/PocketGamer/Steam 評論] | 同時控制兩顆球躲障礙，關卡 = 精準手寫 | 一撞即重置關卡；每關僅數秒，累積嘗試次數才花幾小時 [V]；評論「最挫折但成功時最爽」 [V] | 起手就偏難，非緩升 [V]；另有隨機 Endless 模式補重玩性 [V] | 關卡通關為主，無 mid-level save，因為短所以可接受 [V] | 手寫關卡 = 可學習、可記憶 [V 推論] | 簡約配色 + 配樂同步 [K] |
| Smash Hit (Mediocre) [V: Gamezebo/GameSkinny] | 第一人稱軌道，射鋼球擊碎玻璃 | 球數是「生命」：撞障礙掉 10 顆，水晶補球 [V]；進度以距離計 | 分關卡 + checkpoint；checkpoint 重生是付費(Premium US$1.99) [V] | 距離 + 連擊倍率；checkpoint 存最佳球數與倍率 [V] | 免費版死了回起點 = 強烈「再試」 | 玻璃碎裂音效與粒子是核心回饋 [K] |
| Alto's Adventure/Odyssey (Snowman) | 單鍵跳 + 空翻的無盡滑雪 | 連續 trick 連擊、被追的 llama 追逐壓力 [K] | 平緩，重心在「flow」而非失敗 [K] | 風險：空翻越多分越高但落地失敗會跌倒 [K]；每日/每局小目標(goals)驅動 [K] | 目標系統（3 個一組）給每局意義 [K]；天氣/日夜循環 | 低飽和日夜光影、配樂、放鬆節奏 [K]。本次搜尋未找到可引用的設計分析 [?] |
| Crossy Road (Hipster Whale) [V: PocketGamer.biz] | 單指跳格的 endless hopper | 隨機地圖、每局不同；團隊刻意以 retention/sharing 為設計目標而非單看獲利 [V] | 近乎平坦，死得快（出生地被老鷹追） [K] | 以距離計；收集硬幣 | 角色收集是 retention 骨幹：角色是「有意為之以擴展遊戲」 [V]；90 天內超過 US$6M 來自影片廣告 [V]；免費、廣告可忽略但值得看 [V] | Voxel 風格、各角色專屬音效 [K] |
| Downwell (Ojiro Fumoto) [V: 搜尋摘要; GDC 2016 演講存在 [V]] | 往下掉，射擊靴同時是跳躍與攻擊 | 單一核心機制（下落+槍）的多重用途；設計刻意限縮水平移動 [V] | 隨機生成井；修飾符 build 選擇 [K] | 連擊(combo) 不落地=更高分/寶石 [K] | 單局短、可立即重開 [K] | 強烈槍聲、閃屏、三色限制色盤 [K] |
| Geometry Dash (RobTop) | 單鍵節奏跳躍關卡 | 音樂同步障礙、練習模式放置 checkpoint、死亡即時重生 [K] | 手寫關卡，難度星級分級 [K] | 完成百分比顯示「差一點」 [K] | 死亡 <1 秒重生，是「再一次」核心 [K] | 音樂與障礙節拍對齊 [K] |
| Poki/CrazyGames 的 Dodge / Stickman Hook / Drive Mad / Jump Only 類 [V: Poki 部落格] | 單操作動作類 | 簡單控制（左右半螢幕點按，透明箭頭提示）、每次點擊都要有爽感（跳躍拖尾、碎片） [V] | 前幾關教玩法，後面變難 [V] | — | 為「短 session」最佳化 [V] | 明亮、一致風格的色彩資產比暗色/像素更容易有高遊玩量 [V] |

[?] Ballz-style hyper-casual 與具體 Poki/CrazyGames 榜單排名，本次沒有取得可信來源，不在表中下結論。

## (B) 趣味元素模式（Named Patterns）

### B1. Instant Retry（秒重開）
- 是什麼：死亡到下一局開始 <1 秒，無選單、無廣告阻擋。
- 使用者：Super Hexagon、Duet（每關數秒）、Geometry Dash [V/K]。
- 為何有效：重試成本 ≈ 0，挫折感不累積，「再一次」衝動在 refractory 前消化。
- 實作：Game Over 畫面只顯示分數 + 最佳 + 一顆大 Retry 鍵；點擊任意處 / Space 即重開；結算動畫 <800ms 且可略過。廣告（revive/double）只放在這個畫面的旁側，不得擋住 Retry。

### B2. Near-Miss Reward（擦邊獎勵）
- 是什麼：偵測與方塊的擦邊（如水平距離 < 玩家半寬的 1.2 倍但未碰撞），給分/連擊/特效。
- 使用者：Alto 的近距離 trick、Smash Hit 的連擊倍率思路 [K，Smash Hit 倍率 V]；Downwell combo [K]。
- 為何有效：把「風險」顯性化，風險越高報酬越高，讓玩家刻意貼近危險而非只逃離。
- 實作：每次擦邊 +N 分、combo 計數器 +1、白色閃光 + 音階遞增（見 C）；combo 在 ~2 秒無擦邊後重置。

### B3. Clear Milestones / Self-Selected Difficulty（明確里程碑）
- 是什麼：以固定目標（如「存活 60 秒」）解鎖下一階；難度階層讓玩家挑戰自己。
- 使用者：Super Hexagon（60 秒解鎖 Hyper）[V]；Alto goals [K]。
- 為何有效：給每一局「半完成」的理由，並提供可傳達的目標，而非只有高分數字。
- 實作：Easy/Normal/Hard 或「30s / 60s / 90s」徽章；解鎖後主選單出現新階。

### B4. Short Loop + Learnable Patterns（短局 + 可學習圖樣）
- 是什麼：以手寫或半手寫的方塊「波型」(pattern/wave) 而非純隨機，使玩家能記住並進步。
- 使用者：Duet（手寫關卡）[V]、Geometry Dash [K]；Duet 的 Endless 補隨機 [V]。
- 為何有效：失敗 = 學習，而不是運氣；玩家覺得「下次一定過」。
- 實作：定義 10–20 種 wave 模板（如 gap-left、zigzag、wall-with-hole、cross），隨難度抽選拼接；固定一小段開場序列確保前 10 秒可預期。

### B5. Resource-as-Life（資源即生命）
- 是什麼：不是一擊死，而是失去資源（如 Smash Hit 撞到掉 10 球）。
- 使用者：Smash Hit [V]。
- 為何有效：失敗是漸進的，玩家有「補救」窗口，降低初期挫折。
- 實作（可選）：3 顆心 / 護盾；被撞扣 1，收集道具回復；歸零才結束。注意：會稀釋 Super Hexagon 式純粹張力，需 A/B 玩測（見 E）。

### B6. Collection Meta（收集型元進程）
- 是什麼：以角色/造型解鎖作為跨局目標。
- 使用者：Crossy Road [V]；Poki 指引：用 customization（週/季節解鎖）提升長期 retention [V: Poki developers 變現指南，搜尋摘要]。
- 為何有效：每局的硬幣/分數都有「花費去處」，即使本局失敗也有進展。
- 實作：每局結算掉落硬幣；累積到門檻解鎖玩家皮膚/方塊主題/拖尾；每日一次免費抽 / 看廣告額外抽。

### B7. Instant Readability + Fair Death（可讀性與公平死亡）
- 是什麼：玩家一眼看懂什麼會殺死自己，死亡總是「我的錯」。
- 使用者：Super Hexagon 的即時起停操控 [V]；Poki 指引：UI 大而清楚、支援鍵盤/滑鼠/觸控 [V]。
- 為何有效：不公平的死亡會直接導致玩家離開。
- 實作：方塊與背景高對比；碰撞 hitbox 略小於視覺（寬容 4–6px，[K] 業界常見做法）；危險方塊落下前 200–300ms 預告線/陰影。

### B8. Sound-as-Feedback + Music Sync（聲音即回饋）
- 是什麼：每個動作有對應短音效；背景音樂有節奏並隨難度升級。
- 使用者：Super Hexagon（Chipzel）[V]、Geometry Dash [K]；「Mario 蘑菇音」被引為聲音 juice 例子 [V: digital garden 摘要]。
- 為何有效：音效是最便宜、最高 ROI 的 juice，且手機上常被靜音，所以需視覺備援。
- 實作：擦邊音階遞增、死亡低頻 thud、得分 tick；音樂每 30 秒加一層 stem。

## (C) Juice 檢查表（含參數）

證據說明：Nijman「The Art of Screenshake」(Control, Amsterdam，約 45 分鐘，從平淡射擊遊戲逐步加約 30 個小調整) [V]。Jonasson & Purho「Juice it or lose it」，從打磚塊遊戲逐層加粒子、screenshake、聲音、動畫 [V]。Eiserloh GDC 2016「Math for Game Programmers: Juicing Your Cameras With Math」：trauma 模型 [V]。**具體數值多半來自二手實作與經驗，下表標 [K] 者為建議起始值，需調。**

| 項目 | 建議起始值 | 證據 |
|---|---|---|
| Screenshake 模型 | trauma ∈ [0,1]，shake = trauma^2 × maxOffset，trauma 隨時間線性衰減 | trauma 與平方曲線 [V: Bevy 範例/GameDev.tv 引用該演講] |
| Shake 最大位移 | maxOffset 約 8–16px（800px 寬遊戲），maxAngle 約 2–4° | [K] |
| Shake 事件強度 | 擦邊 trauma +0.1；撞擊死亡 +0.6~0.8；combo 里程碑 +0.2 | [K] |
| Shake 衰減 | trauma 以 ~1.5/秒速率衰減（全滿約 0.6 秒） | [K] |
| Nuclear Throne 範例 | 鏡頭往後踢 6px、screenshake +4，快速衰減 | [V: Nijman 演講二手描述] |
| Hit-stop（死亡） | 凍結 60–100ms（約 4–6 幀@60fps） | 範圍 4–8 幀、>20 幀像 bug [V: 搜尋摘要，來源為部落格，非權威] |
| Hit-stop（擦邊） | 不要凍結，改用 20–30ms 的微頓或只做縮放 pulse | [K] |
| Slow motion | 死亡瞬間 timeScale 0.3 持續 ~300ms 再回正 | Nijman 的 handout 列有 slow motion [V]；數值 [K] |
| Squash & Stretch | 左右移動時玩家 scaleX 1.15 / scaleY 0.9，80–120ms 回彈 | 原則 [V: Comeau]；數值 [K] |
| Tween easing | 進場 Back.easeOut（overshoot ~1.7），UI 彈出 Elastic/Back，消失 Quad.easeIn | [K]，Phaser 內建皆有 |
| 玩家移動 | 加速度 + 輕微摩擦（而非瞬間速度）或極短 ramp（~60ms） | 控制「立刻起停」是好評點 [V: Super Hexagon]；ramp [K] |
| Trail / 殘影 | 玩家拖尾 3–5 個漸隱副本，每 40ms 一個 | Poki 範例 Jump Only 用 trails 與碎片 [V]；數值 [K] |
| 粒子 | 死亡 20–40 顆，擦邊 3–6 顆，壽命 300–600ms，隨機 scale 與旋轉 | 粒子重要 [V]；數值 [K] |
| 閃白 | 死亡/combo 時 1–2 幀全屏白或方塊 tint 白 | [K] |
| 持久性 | 殘骸/煙霧停留（Nijman handout: 「Even More Permanence (Smoke)」） | [V: handout 二手] |
| 結算意義 | 有意義的 Game Over 畫面（最佳分、本局統計、新紀錄動畫） | Nijman handout「Meaning (Game Over Screen)」[V] |
| 計分數字 | 數字 count-up 彈跳 + scale 1.3→1，每 +10 分短 tick | [K] |
| 音效變化 | 同一音效 ±5% pitch 隨機，避免單調；擦邊音階 combo 遞增 | [K] |
| 玩家可控 | 設定中提供 shake 開關/強度滑桿 | [V: dev.to 建議] |
| 反例警告 | 平靜類遊戲應少 shake；juice 應服務目標體驗而非堆砌 | [V: dev.to、digital garden] |

Swink《Game Feel》：本次未能取得原文內容 [?]。其核心概念（input→response 即時性、感知的物理、polish）屬 [K]，具體對應已體現在上表「玩家移動」與「Instant Retry」。

## (D) Web Portal 重點

- 首 5–30 秒：玩家在點擊前尚未投入，頭幾秒決定去留。Poki 案例：40MB WebGL 載入中位 29.5s，只有 50% 點擊後留下；改 6MB HTML5，載入中位 3.7s，轉換升至 72%，遊玩數增加 22% [V: poki.com/blog/what-makes-high-quality-browser-game]。
- CrazyGames Basic Launch 基準：平均遊玩時間 10+ 分鐘；Day-1 retention 強者 10–15%；conversion（玩 ≥1 分鐘）頂尖 80%+，載入 <10s，包體 <20MB；測試期至少 7 天且 500 次遊玩 [V: docs.crazygames.com/resources/basic-launch-metrics]。注意：「10+ 分鐘」是 session 總時間，非單局；單局應極短、靠 instant retry 累積。
- CTR：從 2026-11-23 起成為第四個 Basic Launch 指標 [V]。封面需有明確焦點、清楚標題、類型一眼可辨，hover 預覽影片 15–20 秒內放最佳時刻 [V]。（本遊戲上架前需要做封面與預覽片。）
- 無教學上手：Poki 建議教學不阻擋遊戲，遊戲立即開始，動作置中；Drive Mad 的前幾關即是教學 [V]。CrazyGames 建議先載入教學素材，其餘邊玩邊載 [V]；`gameplayStart` 才算載入完成 [V]。
- 操作：簡單；左/右半螢幕點按搭配透明箭頭提示；UI 大而清晰；支援鍵盤+滑鼠+觸控；多種解析度與直式手機 [V: Poki]。
- 視覺：明亮、風格一致的素材更容易有高遊玩；暗色/像素/低飽和較難突出 [V: Poki]。（與我們的美術方向直接相關，需權衡。）
- 變現（Rewarded Ad）：Poki 稱 Rewarded Video 為主要變現，三種有效做法：game assists（revive、跳關）止住即時流失，customization（週/季節解鎖）提升長期 retention [V: developers.poki.com/guide/monetization 搜尋摘要]。
- CrazyGames Rewarded 深度指南 [V]：Game Over 畫面是強位置；提供 "Watch to Revive"/"Keep your score"；revive 每 session 限 1 次；"Double your coins" 在結算；獎勵與進度掛鉤；每日上限（例 5 次）與遞減獎勵；獎勵要明確標示且帶影片圖示；需處理 adblock。該頁**未給** opt-in 率或精確頻率 [?]。
- 不要強制：不要用廣告擋住開始遊戲；強制廣告易令玩家流失 [V: Poki 部落格 + 搜尋摘要]。Poki SDK 已含廣告，不允許其他廣告、splash screen、外連 [V]。
- 留存建議：進度系統、每日登入獎勵、存檔、修 bug；polish 缺失是不回流主因 [V: CrazyGames]。
- 缺口：Poki/CrazyGames 對「死亡→重試時間」「單局目標長度」無官方數字 [?]。

## (E) 最值得放進 Dodge 遊戲的 12 個元素（排序）

| # | 元素 | 預期影響 | 成本 | 依據 |
|---|---|---|---|---|
| 1 | 零等待 Instant Retry（B1）+ 結算只留分數/Retry | 極高 | 低 | Super Hexagon/Duet/GD；[V/K] |
| 2 | 可讀性 + 公平死亡：預告陰影、寬容 hitbox、高對比 | 極高 | 低 | Poki UI 指引 [V]；hitbox [K] |
| 3 | 輕量載入（<20MB、<10s）+ 立即開始、無教學牆 | 極高（直接影響 conversion） | 低–中 | CrazyGames/Poki 數據 [V] |
| 4 | Near-Miss 擦邊連擊（B2）與分數倍率 | 高 | 中 | 風險報酬概念 [K]、Smash Hit 倍率 [V] |
| 5 | 死亡 juice 組合：trauma shake + 60–100ms hit-stop + 粒子 + 慢動作 | 高 | 低–中 | Vlambeer/Eiserloh [V]；數值 [K] |
| 6 | 音效與 pitch 隨機 + 擦邊音階遞增（B8） | 高 | 低 | Mario 蘑菇音例 [V]；數值 [K] |
| 7 | 難度曲線：開場 10 秒可預期，之後波型模板逐步加速/加密 + 偶爾「變形」事件（B3/B4） | 高 | 中 | Super Hexagon 形狀變化 [V]、Duet 手寫 [V] |
| 8 | 明確里程碑與難度階（30/60/90s 徽章、解鎖階）（B3） | 中–高 | 低–中 | Super Hexagon 60s 解鎖 [V] |
| 9 | 角色/皮膚收集 + 局末硬幣（B6） | 中–高（留存） | 中 | Crossy Road [V]；Poki customization [V] |
| 10 | Rewarded：revive（每局 1 次）+ 結算 double coins，皆可略過 | 中（變現） | 低–中 | CrazyGames/Poki [V] |
| 11 | 每日挑戰/每日登入獎勵（種子化固定波型，分享成績） | 中（D1/D7） | 中 | CrazyGames retention 建議 [V]；Alto goals [K] |
| 12 | 移動手感打磨：squash-stretch、拖尾、微加速、動態音樂層 | 中 | 中 | 「立刻起停」好評 [V]、Poki trails [V]；數值 [K] |

建議驗證方式（避免只靠研究）：先做 1–6（皆低成本）→ 找 5 位陌生人玩測，量測「第一局到第二局的重開率」與「單局平均秒數」；Poki 有 playtest 錄影工具可看玩家是否理解 [V]。B5（生命制）建議 A/B，不要預設加入。

## (F) 來源

已抓取/搜尋到（[V]）
- Poki：What makes a high-quality browser game — https://poki.com/blog/what-makes-high-quality-browser-game
- CrazyGames Basic Launch metrics — https://docs.crazygames.com/resources/basic-launch-metrics/
- CrazyGames Rewarded ads deep dive — https://docs.crazygames.com/resources/rewarded-ads-deep-dive/
- CrazyGames Getting to the first frame — https://docs.crazygames.com/resources/getting-to-the-first-frame/
- CrazyGames requirements — https://docs.crazygames.com/requirements/quality/ ; https://docs.crazygames.com/requirements/gameplay/ ; https://docs.crazygames.com/requirements/ads/
- Poki monetization — https://developers.poki.com/guide/monetization （僅見搜尋摘要）
- Poki SDK requirements — https://sdk.poki.com/requirements ; https://sdk.poki.com/poki-quality-guidelines （僅見搜尋結果，未讀全文）
- Super Hexagon — https://en.wikipedia.org/wiki/Super_Hexagon ; https://www.pocketgamer.com/super-hexagon/super-hexagon-review/
- Duet — https://en.wikipedia.org/wiki/Duet_(video_game) ; https://www.pocketgamer.com/articles/054390/r/
- Smash Hit — https://www.gamezebo.com/reviews/smash-hit-review/ ; https://en.wikipedia.org/wiki/Smash_Hit
- Crossy Road — https://www.pocketgamer.biz/crossy-road-sharing-retention/ ; https://www.pocketgamer.biz/making-of-crossy-road/ ; https://www.gamedeveloper.com/design/what-design-lessons-can-we-learn-from-crossy-road-
- Downwell — https://specialreservegames.com/blog/moppin-entertainment-downwell/ ; https://kotaku.com/1697211547
- Nijman Art of Screenshake 摘要 — https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games ; https://medienwissenschaft.uni-bayreuth.de/wp-content/uploads/GxD-10-Game-Feel.pdf ; https://kenney.nl/learn/must-see-videos-for-indie-developers
- Juice it or lose it — https://gamejuice.pages.dev/resources/juice-it-or-lose-it ; https://garden.bradwoods.io/notes/design/juice
- Eiserloh 2016 GDC — https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing ; https://bevy.org/examples-webgpu/camera/2d-screen-shake/
- Hit-stop — https://gamejuice.pages.dev/articles/hit-stop-frame-trick ; https://ssbwiki.com/Hitlag （僅見搜尋摘要）
- Screen shake 建議 — https://dev.to/dat_one_dev/the-art-of-screen-shake-33bi
- Squash and stretch — https://joshwcomeau.com/animation/squash-and-stretch

未能驗證的缺口（[?] / [K]）
- Nijman 與 Jonasson/Purho 演講本體逐字稿與具體數值、Swink《Game Feel》內文：未取得，表中數值為建議起始值，需自行調校。
- Alto's、Geometry Dash、Downwell 的細部機制多為作者背景知識，未找到可引用的設計分析。
- Ballz-style hyper-casual、Poki/CrazyGames 榜單、廣告 opt-in 率、死亡到重試的官方基準：未取得。
