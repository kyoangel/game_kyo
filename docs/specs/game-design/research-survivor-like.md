# Survivor-like 競品研究 (for "Neon Swarm")

研究日期 2026-11-21。證據分級：
- [V] = 本次研究在所列 URL 直接讀到（見 H 節）。
- [U] = 未驗證：來自常識/記憶或搜尋摘要，實作前請自行玩一遍確認。
- [D] = 設計建議（本文推導，不是引述）。

誠實聲明：網路上找不到 poncle / Blobfish 發表的正式 postmortem 或 GDC 演講談「為何上癮」。Galante 本人說過他自己也不確定為何成功 [U, 見 H 節標題]。因此 B/C/D 的「為什麼有效」多半是由已驗證的遊戲結構 + 心理學分析 (The Conversation) + 設計推論組成，數值參數多為 [D] 起手值，需要 playtest 調整。

---

## A. 競品表

| 遊戲 | 核心循環 | Run 長度 | 升級設計 | 波次/Boss | Meta | 好評 / 負評 |
|---|---|---|---|---|---|---|
| Vampire Survivors (VS) | 只控制移動，武器自動攻擊，撿 gem 升級 | 關卡軟上限 15/20/30 分鐘，時間到出現 Reaper 且每分鐘再加一隻 [V wiki] | 升級給 3~4 選項（武器 + passive）；武器/passive 各 6 格滿了之後只給金幣/補血；怪物掉寶箱含 1/3/5 件；武器滿級 + 指定 passive + 開箱 = Evolution [V wiki] | 密度隨時間遞增；寶箱怪是節點 | 金幣買永久強化/解鎖角色；挑戰解鎖關卡、endless、hyper、limit break；golden egg [V wiki] | 好評：多巴胺、build 多樣（Polygon: 「沒有兩個實況主玩得一樣」）；BAFTA 最佳遊戲 + 遊戲設計 [V wiki]。負評：DLC 邊際效益遞減 (Ars) [V wiki] |
| Brotato | 回合制 arena，波間商店；自動射擊可切手動 | 每波約 20~90 秒，波間購物並回滿血 [V Digital Trends via 搜尋]；總波數 [U: 20 波] | 波後商店（最多 4 件、可 refresh）、stat 疊加為主 [V 搜尋]；武器合成升階 [U] | 每波有明確開始/結束，可喘息、檢討失敗原因 [V] | 解鎖角色/武器 [V wiki]；1000 萬套 (2025) [V] | 好評：VS 的「聰明進化」、build 動態 [V]；負評：RPS 覺得「死得太容易」[V] |
| 20 Minutes Till Dawn | 雙搖桿射擊 roguelite，撐到天亮 | 標準 20 分、Quickplay 10 分、Endless [V wiki] | 升級 4 選 1；gem 同時是經驗與貨幣 [V] | Boss 掉寶箱給特殊升級 [V] | gem 在主選單解鎖角色/武器/符文；Darkness 難度到 15 [V] | 好評：角色/武器多樣、build 實驗；負評：後期 build 趨同 (Destructoid)、近單色畫面文字難讀 [V wiki] |
| Halls of Torment | Diablo 風格 VS-like，可自動/手動瞄準 | 30 分鐘一場；撐滿後打 Lord [V wiki] | 升級 4 選 1 + reroll；Boss 掉 scroll（本局新能力）；寶箱三選一護甲/飾品 [V wiki] | 怪潮越來越密；mini-boss 定時出現、攻擊有 telegraph [V wiki] | 物品存入 well 後永久購買；XP 投入永久屬性；11 角色 [V wiki] | 好評：Metacritic 88，Ars 「近乎完美」，賣破百萬 [V]；負評：關卡設計缺辨識度 [V] |
| HoloCure | VS-like 免費同人遊戲 | 20 分鐘 + 關底 Boss 才算贏；有 Endless [V wiki] | 4 選 1；武器滿級可合成 "collab"，部分可再合成 "super collab" [V wiki] | 每關有 final boss [V] | 金錢買通用強化；gacha 解鎖角色（不可付費）[V] | 好評：GamesRadar 「最好的 VS 仿作」，99% 好評 [V]；負評：成長速度比 VS 慢、選單多 [V RPS] |
| Magic Survival (Leme, 2019) | VS 的靈感來源之一 [V PC Gamer 搜尋摘要] | [U] | 研究系統（meta tree）是鉤子 [V TapTap 評論]；後期畫面「爆炸奇觀」[V] | [U] | 死後看廣告，$3.99 去廣告 [V TapTap] | 「再玩一局試新 build」的習慣 [V] |
| Death Must Die | 動作 roguelite + VS-like | [U] 約 20~30 分 | [U] | [U] | [U] | 本次未能取得資料，請手動玩 |
| Vampire Pixel Survivors (CrazyGames) | 像素 VS-like 網頁版，含製作武器 | [U] | 經驗/金幣升級武器與技能，可製作火焰噴射器/雷射 [V] | 三個場景（沙漠/森林/雪地）[V] | [U] | CrazyGames 評分 9.0（近 6 個月，4.4K 讚 / 680 踩）[V]；桌機 WASD + Space，橫向，支援手機瀏覽器 [V] |
| Mirage Survivors (CrazyGames) | 同類型 | [U] | [U] | [U] | [U] | 評分 8.4 [V 搜尋摘要]；證明入口網站持續有同類新作 |

缺口：Poki 的 survivor 熱門榜、CrazyGames 的排行榜沒查到；survivor.io (mobile 商業版)、Soulstone Survivors、Rogue Genesia 未研究。建議人工逛一次 CrazyGames "Survivor" 標籤的前 10 名。

關鍵觀察：
1. 這個類型的 run 長度大多 10~30 分鐘；Neon Swarm 5 分鐘是刻意壓縮，沒有直接競品證據證明 5 分鐘版本的爆發力 —— 這是我們最大的設計風險 [D]。
2. 「評價最高」的幾款（VS, Halls of Torment, HoloCure）都有：選擇 + 進化/合成 + 寶箱事件 + 持續遞增的怪潮。
3. 負評集中在：build 趨同、視覺可讀性、成長過慢、選單太多。

---

## B. 具名「樂趣元素」模式

每項：What / Games / Why / How（5 分鐘霓虹網頁版）。

**B1. Automation + Movement-only（單一技能輸入）**
- What：只有移動是輸入，攻擊自動。
- Games：VS, Brotato (自動射擊), 20MTD 以外全部。
- Why：「只需要移動，注意力放在穿過怪物間隙與把怪聚集」[V The Conversation]；新手數秒內就能有能力感。
- How：單搖桿/WASD，零教學；攻擊目標用最近敵人。

**B2. Escalating Power Fantasy（弱到清屏）**
- What：從一發子彈到滿屏爆炸。
- Games：Magic Survival 後期「爆炸奇觀」[V]；VS。
- Why：能力感 (competence)；怪潮節奏在「輕鬆統治」與「大群壓力」間交替以維持 flow [V The Conversation]。
- How [D]：把 5 分鐘切成 3 次「弱→爽」小循環（見 D 節），每次循環的爽感頂點由寶箱/進化觸發。

**B3. Meaningful Pick-1-of-3（頻繁小決策）**
- What：升級三選一。
- Games：VS 3~4 選項 [V]；HoloCure/20MTD 4 選 1 [V]；Halls 4 選 + reroll [V]。
- Why：自主性 (autonomy)，每次都在塑造 build [V The Conversation]。
- How [D]：5 分鐘內約 10~12 次升級 ≈ 每 25~30 秒一次；前 3 次升級選項保證含新武器，避免全是數值。

**B4. Evolution / Collab（合成大招）**
- What：滿級武器 + 條件 = 質變武器。VS: 滿級 + 指定 passive + 開箱 [V]；HoloCure: collab / super collab [V]。
- Why：給玩家「長期目標」，在 run 中形成追逐感（near-miss：快要進化就死掉會想再來）[V The Conversation 的 near-miss 概念]。
- How [D]：Neon Swarm 只做 4~5 個進化，條件寫在升級卡上（可見的目標），並用 Boss 掉落箱觸發。

**B5. Chest / Boss Drop Moment（寶箱事件）**
- What：Boss/精英掉箱，開箱有獎勵演出。VS 1/3/5 件 [V]；Halls Boss 掉 scroll、箱給三選一 [V]；20MTD Boss 箱給特殊升級 [V]。
- Why：不規則、可期待的獎勵（Epic 文章稱升級與開箱為多巴胺時刻，但該頁 403，二手引述 [U]）。
- How [D]：mini-boss 與 boss 必掉箱；箱 = 三選一「稀有」升級或進化。

**B6. Time-pressure Escalation + Soft Fail（時間壓力）**
- What：VS 的 Reaper；Halls 的怪潮越來越密 [V]。
- Why：保證 run 有終點，也讓生存感持續上升。
- How [D]：5 分鐘到時 boss 戰；Boss 死亡 = 勝利，否則在 ~5:00 後加入「狂暴」計時。

**B7. Near-miss + Layered Reward（失敗也有收穫）**
- What：每局都累積金幣/解鎖，「沒有一局是白費」[V The Conversation]。
- How [D]：結算畫面一定顯示「得到 X 碎片」與距離下個解鎖的進度條（即使 v1 沒有完整 meta，也先放 1 個最小 meta）。

**B8. Between-wave Breath（喘息）**
- What：Brotato 每波結束可停下來購物與檢討 [V]。
- How [D]：在 Neon Swarm 以「mini-boss 後的 3 秒 XP 吸收 + 升級」代替商店。

**B9. Readable Chaos（可讀性）**
- What：近單色視覺使文字難讀 (20MTD 負評) [V]；過多傷害數字會擋住戰場 [V 搜尋摘要]。
- How [D]：敵人=冷色/紅，玩家子彈=亮色、玩家 hitbox 有明顯亮核；傷害數字只顯示暴擊或合併。

**B10. Opt-in Ads（自願廣告）**
- What：VS 手機版只有玩家自願時才出現獎勵廣告，文章認為這是手機版成功的一部分 [V The Conversation]。

---

## C. 升級 / 武器系統設計模式

### C1. 結構
- 兩類卡：Weapon（新武器/升級）與 Passive（全局數值）。VS 結構：6 武器 + 6 passive 滿格 [V]。5 分鐘版建議縮為 3 武器 + 3 passive 槽 [D]，這樣選項池很快變窄，決策變得有意義。
- 選項池規則 [D]：滿槽後只出現已持有的升級（VS 的做法是填滿後給金幣/補血 [V]）。這保證三選一的每個選項都「與你的 build 相關」。
- Reroll / Banish：Halls 有 reroll [V]；VS 有 reroll/skip/banish [U]。[D] v1 給每局 1~2 次 reroll，可作為獎勵廣告的一個掛鉤。

### C2. Rarity
- 資料不足（本次未驗證各遊戲稀有度比例）。[D]：寶箱選項才出現「稀有」，一般升級統一為普通，降低 UI 負擔。

### C3. Evolution / Synergy 範例（霓虹主題 [D]）
| 武器 A（滿級 Lv5） | + Passive（或武器 B） | 進化結果 |
|---|---|---|
| Pulse Orb（近身環繞球） | + Magnet Core | Nova Halo：球體向外擴張成持續衝擊波環 |
| Arc Bolt（連鎖閃電） | + Overclock（攻速） | Storm Lattice：閃電在敵人間無限彈跳，持續 2 秒 |
| Laser Lance（直線穿透） | + Prism（投射物數量） | Prism Beam：360° 旋轉光束 |
| Seeker Shards（追蹤彈） | + Pulse Orb 滿級（武器+武器） | Swarm Drones：自動環繞並追擊的小機器人 |
| Mine Grid（地雷） | + Overclock | Chain Reactor：地雷爆炸連鎖，擊殺掉落更多 XP |

設計規則 [D]：
1. 進化條件顯示在卡上與暫停選單，玩家可以「規劃」。
2. 進化只能由 Boss/mini-boss 的箱觸發（VS 的開箱要求 [V]），這樣進化是 run 中的高潮事件而不是自動發生。
3. 進化後視覺必須 2 倍以上震撼，否則進化沒有回饋。
4. 避免「後期 build 趨同」(20MTD 負評 [V])：武器要有不同玩法（範圍/追蹤/直線/環繞），不要只是傷害數字不同。

### C4. Passive 清單（v1，[D]）
Might (傷害)、Overclock (攻速)、Magnet Core (吸取半徑)、Prism (投射物 +1)、Thrusters (移速)、Shield Cell (最大血量/再生)。

---

## D. 5 分鐘 Run 的波次/節奏樣板 [D]

注意：以下全是起手設計，需靠 playtest 調整。已驗證的僅有：VS 的怪潮隨時間變密且有 mini-boss 節點 [V]、Halls 的 mini-boss 有 telegraph [V]。

目標曲線：三個「弱→爽」迷你循環 (0:00-1:30 / 1:30-3:00 / 3:00-4:30) + 最終 Boss (4:30-5:00+)。

| 時間 | 場上敵人（上限） | 事件 | 升級 | 玩家感受 |
|---|---|---|---|---|
| 0:00-0:20 | 5~10，慢速直線追擊 | 無教學；起手武器自動開火 | Lv1 約 8 秒內達成（第一個 XP 來得很快） | 立刻看見「我在打」 |
| 0:20-1:00 | 15~30，開始分兩種（慢 + 快） | 第一次包圍隊形（圈） | Lv2~3 | 開始有威脅，3 選 1 第一次 |
| 1:00-1:30 | 30~50 | 第一個衝刺怪 (dasher) | Lv4~5 | 爽感小高峰：第一個武器 Lv3 |
| 1:30 | 40 | Mini-boss #1 (telegraph 攻擊，掉箱) | 箱：稀有選項/新武器 | 第一個寶箱高潮 |
| 1:30-3:00 | 50~90 | 射手怪（遠程，彈幕要可閃避）、分裂怪 | Lv6~9 | 武器組合成型，開始清屏 |
| 2:45-3:00 | 20 → 密集 | 「Surge」：10 秒內一波大量弱怪（讓玩家感覺清屏的爽） | - | 刻意的 power-fantasy 高潮 |
| 3:00 | 60 | Mini-boss #2 或精英 + 箱（進化可能） | 進化 #1 | 質變 |
| 3:00-4:30 | 90~150 (桌機) / 60~100 (手機) | 精英怪、組合波、環形包圍 | Lv10~12 | 壓力與爽感交替 |
| 4:30 | 清場 | Boss 登場：3 個階段 (遠程彈幕 → 召喚 → 衝刺/狂暴) | - | 終局 |
| 4:30-5:00+ | Boss + 小怪 | 打贏 = 勝利；超過 ~5:30 加狂暴 | - | 結算 |

節奏原則 [D]：
- 每 25~30 秒一個決策（升級）、每 90 秒一個大事件（箱/boss）。
- 每個「大事件」之前 5~8 秒壓力稍微放鬆，讓玩家有「準備好了」的感覺。
- 難度由「敵人種類」與「行為」增加，而不是只增加數量（同質化會變無聊）[D]。
- XP 曲線：前期快（Lv1 ~8 秒、Lv2 ~20 秒）、之後平滑；總計 ~12 次升級。
- Brotato 的波長 20~90 秒 + 波間喘息 [V Digital Trends] 說明：明確的小目標比單一長 run 更容易讓人「再來一局」。

---

## E. 類型 Juice 清單

資料來源有限：搜尋只找到通用 juice 建議 [V]：
- 螢幕震動被濫用，若每次打擊都震，玩家 3 分鐘後就麻木 [V eastondev 搜尋摘要]；有開發者回報「傷害數字 12~20 時震動失控」[V itch 帖]。
- 傷害數字過多/過大/過多色會遮擋戰場，應做 pooling 與限量 [V]。
- 小傷害數字 + 死亡 puff + 輪廓閃爍能提升可讀性 [V itch 帖]。
- 玩家評論：自動吸取全部 XP 讓玩家專注閃避 [V itch 帖]。

下列參數皆為 [D] 起手值：

- [ ] XP gem：敵人死亡掉落；吸取半徑預設 ~80 px；進入半徑後加速飛向玩家 (ease-in, ~600 px/s)；一次性「Magnet」掉落可吸全屏。
- [ ] Gem 合併：場上 gem >100 時合併為更大的 gem（效能 + 可讀性）。
- [ ] 傷害數字：只顯示暴擊與 Boss 傷害；或 100 ms 內同一敵人合併；pool 上限 ~30；上浮 ~40 px、淡出 ~400 ms。
- [ ] 敵人死亡：2~3 幀白閃 -> 8~12 個粒子霓虹碎片 (pooled)；小怪不做 hitstop。
- [ ] Hit flash：被擊中白色 tint 60~80 ms。
- [ ] Hitstop：只在 Boss/精英擊殺 40~60 ms。
- [ ] 螢幕震動：玩家受傷 + Boss 事件 + 進化，每次 150~250 ms、振幅 ≤4 px；小怪擊殺不震。
- [ ] 升級：暫停遊戲、時間縮放緩到 0（~150 ms ease）、金色環擴散、音效上升音階、卡片從下滑入 (stagger 60 ms)。
- [ ] 寶箱：箱子掉落時有光柱；開啟時 0.8~1.2 秒滾動動畫（slot-machine 式）後定格，是 near-miss 心理的視覺化 [V The Conversation 提到 slot machine 概念]。
- [ ] 進化：全屏白閃 + 慢動作 0.5 秒 + 武器圖示變形 + 大字 "EVOLVED"。
- [ ] 清屏效果（Nova / Magnet bomb）：環形衝擊波 + 全屏敵人同時 pop，並讓 XP gem 全部飛向玩家。
- [ ] Boss 登場：暗角 + 警示 + 名稱條。
- [ ] 音訊：音階隨連殺升調（combo pitch）；升級有專屬音；預留靜音按鈕（入口網站需求）。
- [ ] 發光：霓虹 glow 用預渲染的 additive sprite 或單一後製 bloom；不要每個物件各自 shader（效能，見 F）。

---

## F. 網頁入口網站特別要求

已驗證：
- CrazyGames：action 類遊戲用 rewarded 廣告頻率高於平台平均 [V]。建議位置：失敗救命（revive，每場限一次）、Game Over 的「Watch to Revive」/「Double your coins」、自然停頓（關卡/波次之間）、資源不足 [V]。文案要先說明獎勵（如 "Watch Ad for +50 Gems"），旁邊加影片圖示 [V]。
- 獎勵要有意義：例如結算獎勵翻倍；可測試較小獎勵 [V]。
- 保護經濟：獎勵綁定進度、日上限、遞減 [V]。
- Meta 與 VS 手機版的經驗一致：廣告只在玩家自願時出現 [V The Conversation]。
- 研究資料：Magic Survival 是「死後看廣告」，可用 $3.99 移除 [V TapTap]；我們不採此作法，請走自願式。
- CrazyGames 的 Vampire Pixel Survivors 支援橫向、桌機 + 手機瀏覽器 [V]。

Phaser 技術 [V 來源為 phaser.io 與社群教學，但沒有手機敵人數預算數據]：
- 物件池是必須：避免在 update 迴圈中配置記憶體，敵人/子彈/傷害數字/XP 都要 pool [V]。
- 範例原型 (Feronato) 的陷阱：killAndHide 而不是銷毀導致群組持續成長、離屏子彈不回收、每幀 getMatching 濾波 [V]。
- 效能預算 [U/D]：手機 WebGL 同時活躍敵人 ~80~120、桌機 ~200；用 spatial hash/grid 做碰撞，避免 O(n²)；不用 Arcade physics 的每個敵人 collider（改為手寫圓形碰撞）；以 Graphics 紋理 atlas 合批；實機（中階 Android）測 FPS，目標 ≥ 45。
- 載入：首屏 <~5 MB（入口網站審核常見要求 [U]），霓虹風格全程用程式生成貼圖，可以幾乎零資產。

手機操作 [U/D]：
- 浮動虛擬搖桿（觸控點為中心，左半螢幕）；不要固定位置搖桿。
- 沒有攻擊按鈕；唯一的 UI 按鈕是暫停（右上，避開拇指區）。
- 升級卡片要大觸控區（≥ 64 px 高）；橫向/直向都能玩，建議先鎖直向或兩者都測。
- 桌機：WASD + 方向鍵；不要求滑鼠。

無教學上手 [D]：
- 第一個畫面直接開始、Lv1 在 8 秒內、第一張升級卡上帶一行說明；用「移動就會自動攻擊」的視覺暗示（敵人靠近時，玩家自動發出光束）。
- 前 10 秒不放任何會死的東西。

---

## G. Neon Swarm v1 前 15 要素排名（Impact / Effort）

Impact 與 Effort 為主觀評估 (H/M/L) [D]。

| # | 要素 | Impact | Effort | 依據 |
|---|---|---|---|---|
| 1 | 單搖桿移動 + 自動攻擊 + 零教學 | H | L | B1 [V] |
| 2 | 升級三選一，每 25~30 秒一次，含暫停與音效 | H | L | B3 [V] |
| 3 | XP gem 吸取 + 自動 magnet 事件 | H | L | E [V 玩家評論] |
| 4 | 敵人死亡 pop + 粒子（pooled） | H | M | E [D] |
| 5 | 3 次「弱→爽」迷你循環的波次曲線 | H | M | D [D] |
| 6 | Mini-boss（掉箱）x2 + 最終 Boss（3 階段 + telegraph） | H | M | B5 [V Halls 的 telegraph] |
| 7 | 寶箱開啟演出 + 稀有三選一 | H | M | B5 [V] |
| 8 | 4~5 個武器進化（條件顯示） | H | M | B4 [V] |
| 9 | 物件池 + 空間分割碰撞，手機 ≥45 FPS | H | M | F [V pooling] |
| 10 | 可讀性：霓虹配色分層（敵人冷色、玩家暖色亮核）、數字合併 | H | L | B9 [V 負評] |
| 11 | 6 武器 + 6 passive 的選項池；槽位上限 3+3 | M | M | C1 [V VS 結構] |
| 12 | 結算畫面 + 碎片/解鎖進度條（最小 meta） | M | M | B7 [V] |
| 13 | 自願式獎勵廣告：Revive（每局 1 次）、結算翻倍 | M | M | F [V CrazyGames] |
| 14 | Reroll（每局 1~2 次，可廣告補充） | M | L | C1 [V Halls] |
| 15 | 螢幕震動/hitstop 節制 + 音階連殺音效 | M | L | E [V 反面警告] |

建議實作順序：1→2→3→4→5 先做出「可玩的 1 分鐘」；在這個點立刻用 3 個陌生人測試「想不想再玩」。然後 6→7→8→9。

---

## H. 來源

已讀取（V）：
- Vampire Survivors, Wikipedia: https://en.wikipedia.org/wiki/Vampire_Survivors
- Brotato, Wikipedia: https://en.wikipedia.org/wiki/Brotato
- 20 Minutes Till Dawn, Wikipedia: https://en.wikipedia.org/wiki/20_Minutes_Till_Dawn
- HoloCure, Wikipedia: https://en.wikipedia.org/wiki/HoloCure
- Halls of Torment, Wikipedia: https://en.wikipedia.org/wiki/Halls_of_Torment
- The Conversation, VS 心理學分析: https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613
- CrazyGames 獎勵廣告指南: https://docs.crazygames.com/resources/rewarded-ads-deep-dive/
- CrazyGames, Vampire Pixel Survivors: https://www.crazygames.com/game/vampire-pixel-survivors
- Feronato, Phaser VS 原型: https://emanueleferonato.com/2024/11/29/quick-html5-prototype-of-vampire-survivors-built-with-phaser-like-the-original-game/
- Phaser 物件池: https://www.phaser.io/news/2021/04/game-optimization-with-object-pools

只看到搜尋摘要（未完整讀取，視為 U/半驗證）：
- Brotato 波長 20~90 秒（Digital Trends 評論，經搜尋摘要）
- Magic Survival 評論: https://www.taptap.io/post/1741711
- Game Developer, Galante 用 Phaser 起家: https://gamedeveloper.com/design/vampire-survivors-development-sounds-like-an-open-source-fueled-fever-dream
- PC Gamer, Magic Survival 為靈感: https://pcgamer.com/vampire-survivors-creator-didnt-have-a-vision-when-he-started-making-the-game-that-allowed-him-to-quit-his-job
- Not even VS's creator knows why it's so good: https://videogames.si.com/news/vampire-survivors-success-reasons-unknown
- Juice/screen shake 通用文章: https://eastondev.com/blog/en/posts/dev/20260521-game-feedback-feel/
- Yandex 廣告時機: https://medium.com/yandexgames/ad-placement-and-timing-in-html5-games-best-practices-e5742401f69a

取不到（403/404/無資料）：Epic Games 文章 (403)、Death Must Die Wikipedia (404)、Poki 與 CrazyGames 排行榜、任何手機 WebGL 敵人數預算資料、任何 XP gem 吸取具體參數、poncle/Blobfish 的正式設計訪談。

後續建議（需人工）：
1. 親自玩 VS（前 10 分鐘）、Halls of Torment demo、CrazyGames survivor 標籤前 5 名，錄下升級頻率與敵人數。
2. 看 Noclip 的 VS 紀錄片（搜尋結果指向設計討論在此）。
3. 在中階 Android 測試 Phaser 原型的敵人數上限，替換 F 節 [U] 數字。
