# Dodge Drop v3 — CC0 素材候選清單 (Task 3.2 / 3.3 前置研究)

查證日期：2026-11-25。本文件只做研究，沒有下載任何素材，也沒有把素材加進 repo。
授權文字是我用 WebFetch / curl 讀各頁面本身得到的，不是憑記憶。選定後仍需依 plan 在下載當下再驗一次並寫入 manifest。

## 0. 查證方法與限制（先看這裡）

- Kenney 頁面：每個 pack 自己的頁面都顯示 `License  Creative Commons CC0`（連到 https://creativecommons.org/publicdomain/zero/1.0/）。頁面沒有更長的授權條文，也**沒有標示下載大小**；頁面只有檔案數（`Files N×`）。所以「大小」欄是估計，需下載後確認。
- OpenGameArt (OGA)：WebFetch 被 403 擋，改用 curl 抓頁面 HTML，讀 `License(s):` 欄位。以下 OGA 項目的 License 欄位都顯示為 `CC0`。
- 我**沒有聽任何音訊**，也沒有下載，所以：曲長、是否真的無縫循環、音質都**未驗證**，必須在 Task 3.3 下載後用耳朵與 ffmpeg 確認。
- Freesound：沒有查（需登入才能看授權與下載，單項 CC0 標示未驗證），本文件不列任何 Freesound 項目。
- 字型（logo 用）：這次沒有驗證任何字型，logo 的字型授權仍是待辦（見第 5 節）。
- Kenney 音效包內的實際檔名我沒看到（沒下載），下面 SFX 對應表裡的檔名類別是「依 pack 主題推測的搜尋方向」，不是已確認的檔名。

## 1. 美術方向（3 選 1）

共通事實（皆已驗證）：下列每個 Kenney pack 頁面都寫 `Creative Commons CC0`，查證日期 2026-11-25。

### 美術方案 A：Kenney「Simple Space + Particle Pack + UI Pack - Sci-Fi」（推薦）

| Pack | 頁面 | 授權原文 | 內容 |
|---|---|---|---|
| Simple Space | https://kenney.nl/assets/simple-space | `License Creative Commons CC0` | 48 檔，2D，tags: space, sci-fi, map，v1.0 (2021) |
| Particle Pack | https://kenney.nl/assets/particle-pack | `License Creative Commons CC0` | 80 檔，2D/VFX，tile size 512 x 512 |
| UI Pack - Sci-Fi | https://kenney.nl/assets/ui-pack-sci-fi | `License Creative Commons CC0` | 130 檔，tags: button, panel, slider, space, sci-fi, interface；v2.0 完全重製 |

- 預覽圖：
  - https://kenney.nl/media/pages/assets/simple-space/76f4e4cdb2-1677578137/preview.png
  - https://kenney.nl/media/pages/assets/simple-space/489b432d65-1677578140/sample.png
  - https://kenney.nl/media/pages/assets/particle-pack/d50c7fc9b6-1677578655/preview.png（實測 91,674 bytes）
  - https://kenney.nl/media/pages/assets/ui-pack-sci-fi/7b0f896462-1724181098/preview.png
  - https://kenney.nl/media/pages/assets/ui-pack-sci-fi/00227142e5-1724181103/sample.png
- 對應需求：
  - 玩家 / 皮膚：Simple Space 的太空船或形狀（再用現有程式 tint 成 cyan，保持 skin 鍵不變）。
  - 方塊變體：Simple Space 形狀或 Particle Pack 的白色形狀，程式 tint 粉紅 + glow（plan 本來就要求方塊寬度變體維持程式 tint）。
  - 星星 / 護盾 / 環（ring）：Particle Pack 的星形、圓環、光暈（512px 白色，天生適合 tint 成霓虹色）。實際檔名未驗證。
  - 側欄裝飾、UI 框 / 按鈕：UI Pack - Sci-Fi 的 panel / button。
- 缺口：parallax 背景兩層（這些 pack 沒有 synthwave 天空 / 網格）、title logo（要自己用字型 render）。背景建議維持現有程式漸層 + 透視網格，再疊 Particle Pack 光暈當星塵層（見第 4 節）。
- 大小：頁面未標示。估計只取用約 20-40 張 PNG 縮到 128-256px 後 < 1 MB（估計，未驗證）。
- 風格：Kenney 的乾淨扁平造型 + 白色光暈貼圖 tint 成粉 / 青 / 紫，最接近 neon 外觀，且三包同一作者，風格一致（plan 要求同一作者 <= 2 packs，這裡是 3 個同作者 pack，需使用者同意，或者把 Simple Space 省掉只用 Particle + UI 兩包，見方案 B）。

### 美術方案 B：Kenney「Particle Pack + UI Pack - Sci-Fi」混合（風險最低、最符合 <= 2 packs）

- 頁面與授權原文同方案 A（Particle Pack、UI Pack - Sci-Fi 兩頁各自寫 `Creative Commons CC0`）。
- 做法：沿用現有程式繪製的形狀當主體，把 Particle Pack 的光暈 / 星 / 環當 glow 與裝飾，UI Pack - Sci-Fi 做面板與按鈕。
- 缺口：玩家與方塊本體不是 authored 美術（仍是程式形狀），對「換掉程式美術」的說服力較弱；title logo 同樣要自己 render。
- 大小：估計 < 0.8 MB（未驗證）。
- 適合：想嚴守「<= 2 packs、最小改動」時。

### 美術方案 C：Kenney「Space Shooter Redux + Planets」（較豐富但不那麼 neon）

| Pack | 頁面 | 授權原文 | 內容 |
|---|---|---|---|
| Space Shooter Redux | https://kenney.nl/assets/space-shooter-redux （301 轉址到 space-shooter-remastered） | `Creative Commons CC0` | 295 檔，2D，tags: vehicle, space, weapon, laser；v1.0 (2014) |
| Planets | https://kenney.nl/assets/planets | `License Creative Commons CC0` | 50 檔，2D，tags: planet, space, galaxy，v1.0 (2022) |

- 預覽圖：
  - https://kenney.nl/media/pages/assets/space-shooter-remastered/41561bfade-1677669432/preview.png
  - https://kenney.nl/media/pages/assets/space-shooter-remastered/3a292e0d18-1677669436/sample.png
- 對應：玩家 = 太空船（有多色，天然可當 skins）、方塊 = 隕石 / 敵機、星星 / 護盾 = 內含的 power-up / shield 圖示（Redux 有 pickup 與 shield 圖，未逐檔驗證）、背景 = Planets 當遠景層。
- 缺口：沒有 UI 面板（需再加 UI pack，會超過 2 packs）、風格偏 2014 卡通太空射擊，不是 synthwave，要大量 tint 才像 neon。
- 解析度：頁面未標示像素大小，Redux 的圖偏小（我印象是多為幾十到一百多 px，未驗證），放大到 1920x1080 可能糊，這是此方案最大風險。

## 2. 音樂方向（3 選 1，單曲逐項驗證）

下表每一項我都實際抓了該曲自己的 OGA 頁面，`License(s):` 欄位為 `CC0`。曲長與循環性**未驗證**（沒聽 / 沒下載）。「檔案大小」是頁面列出的原檔大小。

### 音樂方案 A：同一作者 Pro Sensory（Alex McCulloch）synthwave 系列（風格最貼）

| 曲名 | 頁面 | License 欄位 | 頁面列出的檔案 | 備註 |
|---|---|---|---|---|
| Synth Wave | https://opengameart.org/content/synth-wave | CC0 | Synth Wave.mp3 7.7 Mb | 作者註記 `just include my name, Alex McCulloch. This is not mandatory.` |
| 80's Synth Wave | https://opengameart.org/content/80s-synth-wave | CC0 | synth_wave_1980s.mp3 5 Mb | 作者註記 `Just include my name, Alex McCulloch.`（希望掛連結，非強制） |
| Space Synth Wave | https://opengameart.org/content/space-synth-wave | CC0 | Cool 80's Synth Wave.wav 33.9 Mb | 作者註記同上，另希望告知使用 |

- 這三首都是整首長曲，不是循環片段；要自己用 ffmpeg 切 30-60 s 的小節邊界並做 crossfade，「無縫」要靠我們處理。（需聽感驗證。）
- 授權風險提醒：欄位是 CC0，但作者文字寫「請放我的名字（非強制）」。依你「不需要署名」的底線，欄位 CC0 是成立的；建議仍在 manifest 記下此頁面與那句話。
- 對應：normal = Synth Wave（較慢的應該是，未聽）、rush = 80's Synth Wave、overdrive = 需聽後決定，可從 Space Synth Wave 切高能量段。強度對應只是推測。

### 音樂方案 B：cynicmusic「Melodic EDM Loops」（天生是循環片段）

- 頁面：https://opengameart.org/content/melodic-edm-loops ，License 欄位 `CC0`。
- 頁面原文：`Very upbeat dance track chopped up into lots of loops.` 列出多個變體：`brightmelodicedm.ogg 170.5 Kb`、`brightmelodicloopyedm.ogg 170.1 Kb`、`brightmelodicskippyedm.ogg 337.4 Kb`，以及 zip（10.5 Mb，內含全部 loop）。
- 優點：已經切成 loop，檔小；「loopy / skippy」變體天然對應 rush / overdrive 的強度遞增。
- 缺點：單檔 170 KB ogg 大約 10 秒上下（推估，未驗證），低於 plan 的 30-60 s，需要在程式端重複或串接；曲風是 EDM，不是 synthwave。
- 注意：同作者（cynicmusic / Pixelsphere）的其他頁面（如 Hyper Ultra-Racing，欄位同為 CC0）內文寫「用在你的遊戲請先聯絡取得許可」。Melodic EDM Loops 頁面內文沒有這句，但出現同作者網站連結；若選此方案，建議先寄信確認，或避開有此句的頁面。

### 音樂方案 C：MintoDog「Space City」＋ Of Far Different Nature「Oldskool」（單曲組合）

| 曲名 | 頁面 | License 欄位 | 檔案 | 備註 |
|---|---|---|---|---|
| Space City | https://opengameart.org/content/space-city | CC0 | space_city_bpm115.mp3 4.7 Mb / .ogg 3.7 Mb | 內文：`Synthwave Music for City theme. This music is loopable.` |
| Oldskool | https://opengameart.org/content/oldskool | CC0 | wav + mp3 | 內文：`Retrovibe with classic subtractive synths.` 作者說會同時發 CC0 與 CC-BY 4.0 音樂，但這一首欄位為 CC0；內文另說該曲已有無縫循環版收在 Loop Box #4（我沒找到該頁，未驗證） |

- Space City 是作者宣稱 loopable 的 synthwave，4.7 MB mp3 以 128 kbps 推估約 5 分鐘（推估），需切 30-60 s 段。
- 其他我確認欄位為 CC0 的備選（不一定 synthwave）：
  - Super Synth Squadron https://opengameart.org/content/super-synth-squadron （「A short title screen loop with some stylish synth」，mp3 1.4 Mb）
  - Technological Messup https://opengameart.org/content/technological-messup （techno，ogg 3.5 Mb）
  - OverDrive https://opengameart.org/content/overdrive （ogg 960 Kb，作者自述偏重複且小，僅原型）
  - As fast as you can https://opengameart.org/content/as-fast-as-you-can （chiptune，ogg 2.1-5.2 Mb）
  - City Loop https://opengameart.org/content/city-loop-0 （mp3 1.4 Mb，內文 `Public Domain`）
- 已排除（曾出現在搜尋結果）：Retro Synthwave Loops（搜尋結果稱 CC-BY 4.0）、Stranger synth（我確認 License 欄位為 CC-BY 4.0）、多數 remix 頁（結果授權為 CC-BY / CC-BY-SA）。

### 音樂預算
2-3 首、每首 30-60 s、mp3 約 96-128 kbps 約 0.4-0.9 MB/首，總計約 1.2-2.7 MB（估算），在 4 MB 內，尚有 SFX 空間。

## 3. SFX 方案（1-2 個）

### SFX 方案 A：Kenney 音效三件套（推薦，同一作者，授權最乾淨）

| Pack | 頁面 | 授權原文 | 檔案數 |
|---|---|---|---|
| Digital Audio | https://kenney.nl/assets/digital-audio | `Creative Commons CC0` | 60 |
| Interface Sounds | https://kenney.nl/assets/interface-sounds | `Creative Commons CC0` | 100 |
| Sci-fi Sounds | https://kenney.nl/assets/sci-fi-sounds | `Creative Commons CC0` | 70 |
| Impact Sounds（可選） | https://kenney.nl/assets/impact-sounds | `Creative Commons CC0` | 130 |

預覽圖：Digital Audio https://kenney.nl/media/pages/assets/digital-audio/f240714ae3-1677590256/preview-3.png；Interface Sounds https://kenney.nl/media/pages/assets/interface-sounds/428fc5f14c-1677589445/preview_interface.png；Sci-fi Sounds https://kenney.nl/media/pages/assets/sci-fi-sounds/112ea5fed7-1677589328/audiopreview_scifi.png。

SFX 名稱對應（「建議來源」是依 pack 主題推測的找法；實際檔名需下載後試聽挑選，目前未驗證）：

| SfxName | 建議來源 pack | 找什麼 |
|---|---|---|
| nearMiss | Digital Audio | 短促上升音（tick / blip），程式用 playbackRate 疊音階 |
| pickup | Digital Audio 或 Interface Sounds | 明亮的上行 power-up / confirm |
| shield | Sci-fi Sounds | 短的能量啟動 / force field 聲 |
| shieldBreak | Sci-fi Sounds 或 Impact Sounds | 能量破碎 / 玻璃感衝擊 |
| death | Digital Audio | 下行 lowDown / explosion 類 |
| medal | Interface Sounds | 兩三音上行 confirm / 成就感 |
| click | Interface Sounds | click / tick |
| rush | Sci-fi Sounds | 短的加速 / whoosh / 上掃音 |
| newBest | Digital Audio 或 Music Jingles | 上行三音 jingle |

另有 Music Jingles https://kenney.nl/assets/music-jingles （授權 `Creative Commons CC0`，85 檔）可做 newBest / medal 的備選，內容與長度未驗證。
大小：每個 SFX 通常 < 50 KB，9 個約 < 0.5 MB（估計）。

### SFX 方案 B：SubspaceAudio「512 Sound Effects (8-bit style)」（8-bit 風格的備案）

- 頁面：https://opengameart.org/content/512-sound-effects-8-bit-style ，License 欄位 `CC0`。
- 檔案：單一 zip `The Essential Retro Video Game Sound Effects Collection [512 sounds].zip` 20.6 Mb（只需挑 9 個，不會全進 repo）。
- 優點：選擇多，涵蓋 pickup / death / click / power-up / explosion 各類。
- 缺點：8-bit 復古風，與 synthwave / neon 的質感較不搭；要與音樂方案 A / C 混用時風格有落差。
- 輔助：Button SFX Pack III（https://opengameart.org/content/button-sfx-pack-iii-assortment-ot-hi-tech ，欄位 CC0，zip 15 Mb）可補 click 類的 hi-tech 按鈕聲，作者註記 `you don't have to credit me but it would be nice`。

## 4. 建議組合

**美術：方案 A（Kenney Simple Space + Particle Pack + UI Pack - Sci-Fi）**，若不接受 3 個 pack 則退到方案 B（Particle + UI）。理由：同一作者風格一致、Particle Pack 的 512px 白色光暈天生可 tint 成霓虹粉 / 青 / 紫，UI Pack - Sci-Fi 直接補面板 / 按鈕，且解析度比方案 C 更有把握高解析。

**音樂：方案 A（Pro Sensory 三首 synthwave）**，正常 / rush / overdrive 各取一段 30-60 s 並自己做無縫循環；風格與現有 neon 外觀最貼。若聽過後循環品質不佳，退到方案 C 的 Space City + Super Synth Squadron，或方案 B 的 EDM loop。

**SFX：方案 A（Kenney Digital Audio + Interface Sounds + Sci-fi Sounds）**，同作者、同授權頁面格式，與 Kenney 美術統一。

### 剩餘缺口與補法
1. Parallax 背景兩層（`dd-bg-far` / `dd-bg-mid`）：沒有任何驗證過的 CC0 synthwave 天空 / 網格素材。補法：維持現有程式漸層 + 透視網格；在 mid 層疊 Particle Pack 光暈 / 星點 tint 成粉紫。Planets 包（CC0，50 檔）可選作遠景裝飾，風格偏寫實，需 tint。
2. 方塊變體：依 plan 本來就用「CC0 紋理 overlay + 程式 tint」，不需要額外素材。
3. Title logo：「Neon Rush」字樣必須用 CC0 / OFL 字型 render 成 PNG。字型尚未驗證（本次未查），建議下一步到 kenney.nl/assets（Kenney Fonts，若頁面標 CC0）或 Google Fonts（OFL，需逐一確認授權檔）驗證後再選；再用程式加霓虹 glow。
4. 音樂循環：Pro Sensory 與 Space City 都不是現成短循環，需要在 Task 3.3 用 ffmpeg 找小節邊界 + crossfade，並用耳朵驗證。
5. 曲長、檔名、實際檔案大小：全部要在下載當下量測並寫進 manifest（plan 要求 sha256 與 licenseUrl）。

## 5. 無法驗證的項目

- 所有 Kenney pack 的下載大小、內部檔名、單檔像素尺寸（頁面沒寫、我沒下載）。
- 所有 OGA 曲目的實際長度、是否無縫、音質（沒聽）。
- Oldskool 頁面提到的 Loop Box #4（找不到頁面）。
- Freesound 任何項目（沒查）。
- 任何字型的授權（沒查）。
- Space Shooter Redux 內是否真有可用的 shield / pickup 圖（沒看檔案清單）。
- cynicmusic 其他頁面的「請先聯絡取得許可」文字是否適用於 Melodic EDM Loops（該頁內文沒有，但同作者）。
