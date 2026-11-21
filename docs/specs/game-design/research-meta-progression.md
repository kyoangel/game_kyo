# Dodge Drop Meta-Progression 與多韌性難度研究

日期：2026-11-21。目的：為 Dodge Drop 的「元進程更新」（A 永久工作坊、B 局內 1-of-3 perk、C 任務/等級、D 角色能力、E 區域突破）蒐集「什麼有效、數字多少」的證據。本文件**只做研究，不做遊戲設計**；[D] 標記的數字是由證據推導的起始假設，必須 playtest 驗證。
證據標記：[V] = 本次實際抓取/搜尋到並附 URL；[K] = 業界常識或作者記憶，本次未驗證；[U] = 找不到/未知；[D] = 設計推論。
誠實聲明：本次 session 的搜尋工具以摘要回傳，許多經典遊戲（Learn to Fly、Burrito Bison、Hill Climb、Alto、Subway Surfers 的精確價格曲線）**沒有找到可引用的一手數據**；Game Developer 的一篇文章被付費牆擋下（HTTP 402）；Columbia 的 DDA 論文 PDF 無法解析全文，僅有搜尋摘要。因此許多數字標 [K]/[U]，不要當作定論。

## (A) 參考遊戲比較表

| 遊戲 | 元進程類型 | 升級類別 / 數量 | 成本曲線 | 首次升級 → 滿級 | 防止難度被磨平 | 證據 |
|---|---|---|---|---|---|---|
| Jetpack Joyride | 任務→等級→金幣；金幣買 Gadget/載具升級/外觀 | Gadget 可裝 2 格（升級後 3 格）；多數載具有 Magnetic、Golden 升級；外觀不影響玩法 | 「Mission unlock」每顆星 500 coins；等級獎勵幣；細部曲線 [U] | 第一個任務數分鐘內可完成 [K] | 升級是便利/輔助；最高級後用 125 種徽章 cash-in 重新循環 | [V] https://en.wikipedia.org/wiki/Jetpack_Joyride |
| Rogue Legacy | 局間花金幣升級 Manor（HP/MP/職業），遺傳給後代 | 多類屬性 + 職業 + 鐵匠/附魔 | 玩家觀察：買任一項會讓其他項漲價（約每點 +10 gold，單一玩家回報，非官方）；Charon 要收「未花費金幣」過路費（強迫花掉） | 一局即可買第一個 [K] | 玩家強度有 soft cap；NG+ 敵人無限成長但 boss 不變；architect 鎖地圖要抽成 | [V] https://en.wikipedia.org/wiki/Rogue_Legacy ；漲價觀察 [V 弱]：Steam 討論串（搜尋摘要） |
| Hades（Mirror/God Mode） | 鏡子永久升級 + God Mode 輔助 | Mirror 多類；God Mode 為獨立輔助 | God Mode：起始 20% 減傷，每死 +2%，上限 80% | 一局內可用 | 輔助為 opt-in；關掉不失去累積值 | [V] 搜尋彙整：https://www.gamesradar.com/hades-god-mode-achievements ；https://ggrecon.com/guides/hades-2-god-mode |
| Vampire Survivors | 金幣買 PowerUp（Might 5 級起價 200；Armor 3 級 600；Banish 3 級 200） | ~十餘類被動 | 搜尋摘要：買一級後其他 PowerUp 價格 +10%（攻略站說法）；全買約 202,000 coins（版本相依） | 一局即可買 1–2 個 | 每局 30 分鐘、敵人持續加壓；PowerUp 為百分比小幅加成 | [V 弱] https://vampire-survivors.fandom.com/wiki/PowerUp ；https://kosgames.com/vampire-survivors-optimal-powerup-selection-order-15884/ |
| Archero | 天賦（金幣隨機升級，每買一次下一次變貴）+ 裝備 + 局內技能 | 每次 level-up 3 選 1 技能；Glory 天賦讓開局多一個技能 | 天賦金幣：隨機、遞增；天賦等級上限 10 或 20；每日/每週免費箱（可看廣告再開） | [U] | 章節門檻（新敵人/新攻擊圖樣）+ 轉盤獎勵隨章節上升（追趕機制）；作者批評隨機天賦「連抽到沒用的」會推走玩家 | [V] https://gamedeveloper.com/design/finding-the-fun-archero-part-2---progression ；天賦細節 [V 弱] https://progameguides.com/archero/archero-talents-list/ |
| Crossy Road | 角色收集（非玩法升級） | 數十個角色，多為外觀 + 專屬音效 | 硬幣/抽獎/廣告 | [K] | 無（純外觀，所以無平衡問題） | 角色=留存骨幹；90 天 >US$6M 影片廣告 [V]（見前份研究）https://www.pocketgamer.biz/crossy-road-sharing-retention/ |
| Learn to Fly 1–3 | 一局飛行→賺錢→買企鵝發射器/機翼/火箭 | 約 5–6 類（滑翔、火箭、燃料…）每類多級 | 價格逐級遞增 [K]；精確公式 [U] | 第一局即可買 [K] | 以距離關卡/世界區域（冰原→太空）改變需求 [K] | [U] 本次未找到可引用來源 |
| Burrito Bison / Hill Climb Racing / Subway Surfers / Alto / Dead Cells / Downwell | 各自不同 | Hill Climb：引擎/懸吊/輪胎/四驅各 ~10 級；Subway Surfers：道具持續時間 6 級 [K] | 多為近似等比遞增 [K] | [K] | Downwell：升級在局內（一局重置），無永久強度 [K] | 全為 [K]，[U] 無一手來源 |

## (B) 各研究問題的發現

### Q1. 「輸 → 升級 → 走更遠」：成本曲線與防磨平
- 事實層：能引用的曲線只有「買了會讓其他項漲價」這種**跨項目通膨**（Rogue Legacy、Vampire Survivors 的攻略站描述）[V 弱]，以及 Archero「每次隨機天賦購買後下一次更貴」[V 弱]。單項目 base/ratio 的精確數值 **[U]**。
- 常見模式 [K]：每項 5–10 級，成本近似等比（ratio 約 1.3–1.8）；強度加成則是線性或遞減，所以「花費指數、效果線性」形成自然 diminishing returns。
- 防磨平手段（有來源者）：Rogue Legacy 玩家強度 soft cap、NG+ 只加敵人 [V]；Archero 章節門檻 + 新攻擊圖樣 [V]；Jetpack Joyride 滿級後以徽章重置循環（prestige-like）[V]；Hades God Mode 為 opt-in 輔助而非預設強度 [V]。
- [D] 對 Dodge Drop 的意涵：本作是**一擊死**，不是 HP 戰鬥。升級最危險的是「直接免疫」（長期無敵）。應把升級做成「提高容錯」而非「取消失誤」，並且每級加成很小。

### Q2. 低韌性玩家的留存
- **DDA 有留存證據，但來源強度不一**：
  - Columbia Business School 工作論文（熱門 F2P 手遊、約 30 萬玩家、12 週、對照隨機 holdout）：對「高流失風險」玩家降低難度，提升 engagement 與留存；短期內購下降、長期消費為正 [V 弱，僅搜尋摘要，PDF 未能解析]。https://business.columbia.edu/sites/default/files-efs/citation_file_upload/Personalized_games.pdf
  - 學術綜述：Sepulveda 等（2019）認為 DDA 與留存/變現相關；Robb & Zhang（2022）為 2D 遊戲受控實驗，**效果量未取得** [V 弱/U] https://arxiv.org/pdf/2007.07220
  - Game Developer 廠商文：卡關過度 → 玩家流失，過易 → 無聊流失；且「3 次失敗就放水」這類一刀切規則可能閾值不對、部分玩家 2 次失敗就流失 [V，但為廠商觀點] https://gamedeveloper.com/business/data-science-and-game-difficulty-tuning-a-new-paradigm-
  - 基準：GameAnalytics H1-2019 引用：D1 ≥35%（hyper-casual 50%）、D7 11%、D28 4% 算好 [V 但為二手引用]；CrazyGames Basic Launch：D1 強者 10–15%、遊玩≥1 分鐘 conversion 頂尖 80%+ [V，見前份研究]。
- **Pity / assist**：Hades God Mode（起始 20%，每死 +2%，上限 80%；slider 可調；關閉再開仍保留累積）[V]。Celeste Assist Mode：存在且 opt-in、可調速度/無敵 [K，本次未驗證]。Archero 轉盤獎勵隨章節上升作為追趕 [V]。
- **近失目標條**（死亡時顯示「差 X 就解鎖」）：[K] 為業界常見做法，本次無一手數據；Geometry Dash 的完成百分比顯示類似心理 [K]。
- **Candy Crush 式「連敗給助力」**：[K]；King 的實際閾值 [U]。
- **Portal 文件**：CrazyGames 與 Poki 對首 60 秒的具體文件數字：Poki 載入 6MB 轉換 72% vs 40MB 50% [V，見前份研究]；對「首局目標長度」無官方數字 [U]。
- [D] 結論：DDA 證據支持「**對高流失風險玩家悄悄放寬**」，但最強的設計做法是**明示、可選、累積型**（God Mode 型）而非黑箱，因為黑箱會損及技巧玩家的公平感 [D]。

### Q3. 技巧型玩家：升級後仍有挑戰
- 有來源者：Rogue Legacy 的 soft cap 與無限成長敵人 [V]；Super Hexagon 的 60 秒解鎖 Hyper 階（見前份研究）[V]；Archero 章節新圖樣 [V]。
- 常識 [K]：分數倍率與排行榜以「技巧指標」（combo、存活秒數）計分，而非以「金幣/升級」計分；每日挑戰（種子固定）讓升級不影響比較。
- [D] 關鍵設計原則：**排行榜與每日挑戰以「標準裝備」或「分數不含升級加成」計算**，否則升級破壞技巧表現。此為推論，無來源。

### Q4. 短局中的 perk 選擇
- Archero：每次 level-up 3 選 1；開局可再 1 次（Glory 天賦）[V 弱]；單局長度本次 [U]。
- Vampire Survivors 單局 30 分鐘、Hades 單局約 20–40 分鐘 [K]；Brotato 每波 20–90 秒（短波）[K]。這些都比 Dodge Drop 的 30–120 秒長得多，**無直接可比的 30–120 秒案例** [U]。
- Pause-to-pick 在這些遊戲是標準做法 [K]；在 30–120 秒的 portrait dodger 中，每次暫停會打斷 flow（[D] 推論）。
- 稀有度/協同：Hades boon rarity 與 duo boon [K]；Vampire Survivors weapon evolution [K]。本次無一手數據。

### Q5. 任務系統
- Jetpack Joyride：同時 3 個任務；每個 1–3 星（難度越高星越多）；完成後補新任務；星數累積升級（到 15 級後有徽章循環）；升級給金幣；可用 500 coins/星「買下」任務星（變相 skip）[V] https://en.wikipedia.org/wiki/Jetpack_Joyride ；範例任務含「差點被飛彈擊中」「靠近 zapper 飛行」，與 Dodge Drop 的 near-miss 直接對應 [V]。
- IGN 評論稱讚三任務系統的「再來一局」拉力（評論，非指標）[V 二手]。
- Subway Surfers / Temple Run 2：每日任務、分數倍率、skip 價格 [K]，細節 [U]。
- 看廣告 skip 任務：Poki/CrazyGames 皆接受獎勵型廣告換「協助」[V 見前份研究]；任務換新 [D]。

### Q6. 角色能力 vs 純外觀
- Crossy Road：角色**純外觀 + 專屬音效**，團隊稱角色是為了擴展遊戲與 retention [V 見前份研究]；因無玩法差異，沒有平衡問題（推論 [D]）。
- Rogue Legacy：職業/特質直接影響玩法，是遊戲核心；平衡成本高，且 Traitor 等特殊職業需解鎖 [V 部分] https://en.wikipedia.org/wiki/Rogue_Legacy
- Archero 英雄、Subway Surfers 角色能力：[K]；留存/變現對比數據 [U]。**沒有找到「能力角色 vs 外觀」的 A/B 數據**。
- 風險 [D]：能力角色會產生「必選最強」，並使排行榜不可比；需要每個角色有「代價」（例如 trade-off）。

### Q7. 區域/階段突破與檢查點
- Super Hexagon：60 秒解鎖更難階層，且過程中換形狀重置肌肉記憶 [V 見前份研究]。
- Smash Hit：分關 + checkpoint，**checkpoint 重生要付費（Premium）**；免費版死了回起點 [V 見前份研究]。
- Geometry Dash：練習模式 checkpoint、完成百分比 [K]。
- 「從 checkpoint 開始是否提升留存」：**[U] 無直接證據**。常識推論 [D]：checkpoint 減少重複挫折但降低「純度/成就」，常被作為付費/廣告點（Smash Hit）。

### Q8. 獎勵型廣告 × 元進程
- CrazyGames 深度指南 [V] https://docs.crazygames.com/resources/rewarded-ads-deep-dive/：獎勵要連結當前進度（例如「下個升級成本的某百分比，或數分鐘遊玩等值」，未給具體百分比）；提供「立即完成這個升級/跳過等待」；結算「Double your coins」；revive 每 session 1 次；每日上限例 5 次、遞減獎勵（100/50/25 gems）；可測試較小獎勵（50 而非 100 coins），若觀看率不變就保留較小以保護經濟。
- Poki：game assists（revive、跳關）止住即時流失，customization 提升長期 retention [V 見前份研究]。
- perk reroll 換廣告：[K] 業界常見（Archero 轉盤/寶箱廣告 [V 弱]）；官方限制 [U]。
- 限制：不可阻擋開始遊戲；不要強制廣告（見前份研究）[V]。

## (C) 給不同韌性玩家的設計

目標：快速放棄者（前 3 局內可能離開）與堅持者（會玩 50+ 局）都留住。以下為機制 + 證據 + 強度。

| 機制 | 對象 | 證據 | 說明 |
|---|---|---|---|
| 首局 <60 秒內必得第一筆金幣並買到第一個升級（或看到明確「差 X 金幣」） | 快速放棄者 | Poki/CrazyGames 首幾十秒定生死 [V]；Learn to Fly 首局可買 [K] | [D]：目標讓第一個升級 ≤ 1 局收入 |
| 死亡畫面的近失目標條（下個升級/任務/等級還差 X） | 快速放棄者 | [K]（無一手數據） | 條要放在 Retry 旁，不阻擋 Retry（見前份 B1） |
| 失敗累積型 opt-in 輔助（God Mode 式：每死 +2% 容錯，上限 80%）| 低韌性 | Hades [V] | [D]：Dodge Drop 一擊死，換算為「起始護盾機率」或「near-miss 視窗加寬」而非減傷 |
| 悄悄放水（連續 N 局 <20 秒時降低開局密度/多給一個護盾）| 高流失風險 | Columbia 論文（對高流失風險放寬難度，提升留存）[V 弱] | 風險：黑箱、一刀切閾值可能不對 [V 廠商文]。[D] 建議限於前 10 局，且不計入排行榜 |
| 追趕式獎勵（越輸越多金幣/轉盤獎勵）| 低韌性 | Archero 轉盤隨章節上升 [V] | [D]：每局保底金幣，並隨「連敗」小幅增加 |
| 廣告 revive（每局 1 次）| 快速放棄者 | CrazyGames/Poki [V] | 不強迫 |
| 永久升級的收益遞減 + 排行榜與升級脫鉤 | 堅持者/技巧型 | Rogue Legacy soft cap [V]；脫鉤為 [D] | 避免升級讓技巧失效 |
| 區域突破 + 更難的新方塊 | 堅持者 | Super Hexagon 變形 [V]、Archero 章節新圖樣 [V] | 升級再強，新機制仍需學習 |
| 每日挑戰（固定種子）| 技巧型 | [K] CrazyGames 留存建議含每日獎勵 [V 見前份研究] | [D] 用標準裝備 |

**重要的相反證據/警告**：
- 對一擊死遊戲，「加容錯」過多會變成「無趣」。證據：Super Hexagon/Duet 以「純粹」和「立刻重來」留存 [V]；但 Smash Hit 的資源即生命證明漸進失敗也能成立 [V]。兩者都成立，所以必須用**玩家自選**（opt-in 或升級購買），而不是強制。[D]
- DDA 的最大風險是玩家發現被放水而失去成就感 [K]；Columbia 論文也指出短期內購下降 [V 弱]。

## (D) Dodge Drop 數值起點（全為 [D]，需 playtest）

現況輸入：每 60 秒約 12–18 coins；皮膚 30–500 coins；revive/double 為 rewarded。以每局約 15 coins 作計算基準。

### A. 永久工作坊
- 項目：shield capacity、start-with-shield、star magnet、near-miss 視窗、combo 超時、dash（共 6 項）。依據：Jetpack Joyride gadget 為便利/輔助（[V]），Vampire Survivors/Archero 以小幅被動為主（[V 弱]）。
- 等級：每項 5 級。依據：Vampire Survivors 3–5 級常見（Might 5、Armor 3）[V 弱]。
- 成本公式：cost(n) = round(15 × 1.6^(n-1))，n=1..5 → 15 / 24 / 38 / 61 / 98 = 236 coins/項；6 項共 ≈ 1,416 coins。依據：等比遞增為業界常識 [K]；總量 vs Vampire Survivors 的 ~202,000 只作量級參考（不同經濟）[V 弱]。以每局 15 coins 計，**第一次升級 1 局、滿級約 95 局**；若 ×2 廣告與較長存活，約 50–60 局。目標：D7 前買不完 [D]。
- 每級效果：小幅（如 near-miss 視窗 +8%/級；combo 超時 +0.15s/級）。上限：不提供「額外一次免疫上限 >2 顆護盾」。依據：Rogue Legacy soft cap [V]。
- 跨項漲價：可選 +10%（Vampire Survivors/Rogue Legacy 現象）[V 弱]，建議**先不加**，由數據決定 [D]。

### B. 局內 perk 3 選 1
- 次數：每局 2–3 次（約在 20 秒、45 秒、75 秒）。依據：Archero 每 level-up 3 選 1 [V 弱]；但局長不可比 [U]，故為 [D]。
- 不暫停？建議「慢動作 0.2× + 3 秒內不選自動選第一」或「選牌時方塊凍結」[D]；證據僅知暫停選牌是標準 [K]。
- perk 池：12–15 個，3 稀有度（普通/稀有/傳說）；協同標籤 2–3 組。依據：Vampire Survivors/Hades 的稀有與 synergy [K]，數量 [D]。
- 看廣告 reroll：每局 1 次。依據：CrazyGames 每 session 限制 [V]。

### C. 任務 / 等級
- 同時 3 個任務，難度 1–3 星；星累積升級；滿級後循環。依據：Jetpack Joyride [V]。
- 每任務 15–60 秒可達成（避免長任務），一天 3 個新的 + 換新用廣告或 ~星×N coins（Jetpack 為 500 coins/星 [V]；Dodge 經濟小，[D] 約 50–100 coins/星）。
- 優先任務類型：near-miss 次數、combo ×N、存活 N 秒、收集 N 星（與 Joyride 的近失任務對應 [V]）。

### D. 角色 / 皮膚能力
- 先做 3 個能力角色 + 其餘維持純外觀。每個有明確代價（如：dash 角色吸星範圍較小）[D]。
- 能力角色不進入排行榜，或排行榜分角色。依據：Crossy Road 純外觀避免平衡 [V 見前份研究]；Rogue Legacy 職業成本高 [V]。

### E. 區域突破
- 長度：每 ~60 秒一區，各區 1 種新方塊（如：移動方塊、分裂方塊、加速方塊）。依據：Super Hexagon 以形狀變化重置肌肉記憶 [V]；數字 60s 對應現有 medals 30/60/90/120 [D]。
- 區域起點：**不從 checkpoint 起跑為預設**；若提供，採 opt-in（如：看廣告/付費從上次區域開始）。依據：Smash Hit checkpoint 付費 [V]；留存影響 [U]。

## (E) 風險與 playtest 指標

| 風險 | 監測指標 | 判斷 |
|---|---|---|
| 升級讓遊戲變無聊/技巧無用 | 中位存活秒數 vs 升級總花費；高等級玩家是否仍死於區域 1 | 若滿級玩家平均存活 >2× 無升級者，降每級加成 |
| 快速放棄者看不到第一個升級 | 第 1–3 局內離開率；首局金幣；到第一個購買的局數 | 目標 D1 ≥ 基準（CrazyGames 強者 10–15% [V]） |
| 任務變成雜務 | 任務完成率、跳過率 | 太低降難度；太高升級 |
| perk 打斷節奏 | perk 選擇時間、選擇後 10 秒內死亡率 | 若中位 >3 秒，改為慢動作 |
| 廣告過量 | 每局廣告曝光、opt-in 率（官方基準 [U]） | 若觀看率不變，縮小獎勵（CrazyGames 建議 [V]） |
| 黑箱放水被察覺 | 技巧型玩家 D7、評論 | 放水限前 10 局 |
| 能力角色失衡 | 角色選擇率、各角色分數分布 | 單一 >60% 選擇率視為失衡 [D] |
| 經濟通膨 | 每日金幣收入 / 升級總價；滿級所需局數 | 目標 50–100 局 [D] |

方法：5–10 位陌生玩家錄影 + 分組比較（有/無近失條、有/無 DDA）。小樣本只能看趨勢，不能下統計結論 [D]。

## (F) 元素排序（影響 / 成本）

| # | 元素 | 影響 | 成本 | 依據 |
|---|---|---|---|---|
| 1 | 死亡畫面「差 X」近失目標條 + 首局可買第一個升級 | 高 | 低 | [K] + Poki/CrazyGames 首段流失 [V] |
| 2 | 永久工作坊（6 項 × 5 級，小幅加成）| 高 | 中 | Jetpack/Rogue Legacy/Vampire Survivors [V 弱] |
| 3 | 3 任務 + 星 → 等級 | 高 | 中 | Jetpack Joyride [V] |
| 4 | 廣告：Double coins、revive、升級加速 | 中–高 | 低 | CrazyGames [V] |
| 5 | 失敗累積型 opt-in 輔助（God Mode 式）| 中–高（低韌性）| 中 | Hades [V] |
| 6 | 局內 perk 3 選 1（2–3 次/局）| 中 | 中–高 | Archero [V 弱]；短局適配 [U] |
| 7 | 區域突破 + 新方塊 | 中–高（高韌性）| 高（需內容）| Super Hexagon [V] |
| 8 | 每日挑戰（標準裝備）| 中 | 中 | [K] |
| 9 | 3 個能力角色 | 中 | 高（平衡）| Rogue Legacy [V 部分]；A/B 數據 [U] |
| 10 | 黑箱 DDA | 不確定 | 中 | Columbia [V 弱]；風險 [V 廠商文] |

## (G) 來源

已取得（[V]，含摘要級）
- Jetpack Joyride — https://en.wikipedia.org/wiki/Jetpack_Joyride
- Rogue Legacy — https://en.wikipedia.org/wiki/Rogue_Legacy ；Steam 討論（漲價觀察，搜尋摘要）https://steamcommunity.com/app/241600/discussions/0/846957366716742648/
- Hades God Mode — https://www.gamesradar.com/hades-god-mode-achievements ；https://ggrecon.com/guides/hades-2-god-mode ；https://inverse.com/gaming/hades-god-mode-interview（僅標題）
- Vampire Survivors PowerUp — https://vampire-survivors.fandom.com/wiki/PowerUp ；https://kosgames.com/vampire-survivors-optimal-powerup-selection-order-15884/ （搜尋摘要）
- Archero — https://gamedeveloper.com/design/finding-the-fun-archero-part-2---progression （已抓取）；https://progameguides.com/archero/archero-talents-list/ （搜尋摘要）
- DDA — https://business.columbia.edu/sites/default/files-efs/citation_file_upload/Personalized_games.pdf （PDF 未能解析，僅搜尋摘要）；https://arxiv.org/pdf/2007.07220 ；https://gamedeveloper.com/business/data-science-and-game-difficulty-tuning-a-new-paradigm- （已抓取，廠商文）
- CrazyGames Rewarded ads — https://docs.crazygames.com/resources/rewarded-ads-deep-dive/ （已抓取）
- 前份研究引用的 Poki/CrazyGames/Crossy Road/Super Hexagon/Smash Hit 來源，見 docs/specs/game-design/research-arcade-dodge.md (F)

證據缺口
- [U] Learn to Fly、Burrito Bison、Hill Climb Racing、Subway Surfers、Alto、Dead Cells、Downwell 的精確升級價格、等級數、首次升級/滿級所需局數。
- [U] 30–120 秒短局中局內 perk 的最佳次數、pause vs no-pause 的對照數據；Brotato/Holocure/20 Minutes Till Dawn 數值未查。
- [U] 能力角色 vs 純外觀的留存/變現 A/B 數據；checkpoint 對留存的直接證據。
- [U] Celeste Assist Mode、Candy Crush 連敗助力、近失目標條的一手資料；Columbia 論文全文效果量。
- [U] 廣告 opt-in 率與 Poki/CrazyGames 對「首 60 秒」「死亡→重試時間」的官方數字。
