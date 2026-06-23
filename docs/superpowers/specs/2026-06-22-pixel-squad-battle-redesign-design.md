# Pixel Squad — Battle System Redesign Design

> **Status:** Approved for implementation planning
> **Scope:** Replaces the ATB/individual-turn model in `BattleScene.ts` with a Command Phase → Execution Phase model, plus Auto-battle mode.

---

## Overview

The current battle system processes each character's turn individually (ATB-style): when it's a player character's turn, the action menu appears; when it's an enemy's turn, the enemy auto-acts. This is replaced with a two-phase model where players input all commands upfront, then the round executes in SPD order.

---

## Battle Flow

```
[命令輸入階段]
  └─ 依序為每個存活的我方角色選行動（由上到下）
  └─ 全員設定完畢後，自動進入執行階段

[執行階段]
  └─ 全員（我方＋敵方）依 SPD 降序執行
  └─ 我方使用命令輸入階段的預設指令
  └─ 敵方即時 AI 決定（每個敵人行動時才決定）
  └─ 全部跑完 → 清空指令 → 回到命令輸入階段（新回合）
  └─ 每回合開始時，防禦狀態解除
```

---

## Command Phase Details

### Action Options (per character)

| 按鈕 | 對象 | 備註 |
|------|------|------|
| 自動 | — | 僅第一位角色可見；觸發自動模式 |
| 攻擊 | 選定存活敵人 | 進入目標選擇 |
| 技能 | 選定目標 | 攻擊技能 → 敵人；治療/輔助技能 → 己方 |
| 防禦 | — | 無需選擇目標，直接確認 |

### Input Order

- 存活我方角色由上到下依序輸入
- 每位角色確認後，角色身上顯示指令圖示（⚔️ 技 🛡）
- 全員確認後自動進入執行階段

### Revising Already-Set Commands (Mobile / Pointer)

- 點擊已設定指令的我方角色 → 重開其行動選單
- 確認後繼續往下一位輸入（不回頭）

### Keyboard Navigation

```
命令輸入：
  ←→      切換行動選項（攻擊 / 技能 / 防禦）
  Enter    確認選項
  Esc      退回上一個角色的命令輸入

目標選擇：
  ↑↓      切換目標（在存活目標間循環）
  Enter    確認目標
  Esc      取消，回到行動選單
```

---

## Auto-Battle Mode

- **觸發：** 命令輸入階段，第一位角色選「自動」
- **行為：** 全隊 AI 決定行動（攻擊 or 技能，隨機存活敵人），不進命令輸入階段，連續執行回合
- **UI：** 行動選單位置改為 `[■ 停止]` 按鈕
- **停止：** 按下後，當前執行回合跑完才停；下一回合回到命令輸入階段

---

## Execution Phase Details

### Turn Order

- `computeTurnOrder()` 不變：存活角色依 SPD 降序，同 SPD 時我方優先

### Dead Target Handling（行動前目標已死亡）

| 技能類型 | 處理 |
|----------|------|
| 攻擊 / 攻擊技能 | 改打隨機存活敵人 |
| 治療 / 輔助技能 | 行動浪費（技能視為無效，不消耗任何資源） |
| 復活技能 | 照常對死亡目標施放（有效） |

### Enemy AI

- **預設：** 攻擊隨機存活我方角色（非固定最低 HP）
- **特殊敵人：** 各自帶有專屬 AI 邏輯（例如 獵人型 → 最低 HP；狂戰士型 → 最高 ATK）
- 敵方 AI 在每個敵人行動時才計算（非命令階段預先決定）

---

## UI Layout

```
命令輸入階段：
  ┌─────────────────────┐
  │  [關卡名]            │
  │  [角色1] ⚔️          │  ← 已設定圖示；可點擊修改
  │  [角色2] 🛡           │
  │  [角色3] ...         │  ← 尚未設定則閃爍提示
  │         VS           │
  │  [敵人1] [敵人2]     │  ← 選目標時加橘框
  ├─────────────────────┤
  │  [自動] [攻擊] [技能] [防禦]  │  ← 行動選單
  └─────────────────────┘

執行階段：
  → 隱藏行動選單，顯示戰鬥訊息 + 行動順序列表
  → 每個角色行動時對應方塊短暫閃爍

自動模式：
  → 行動選單位置改為 [■ 停止] 按鈕
```

---

## Architecture

### State Machine

```typescript
type BattlePhase = 'command' | 'executing' | 'auto';
```

### New Data Structure

```typescript
interface PendingCommand {
  character: Character;
  action: 'attack' | 'skill' | 'defend';
  target?: Character; // undefined for 防禦
}
```

### Command Phase Flow (pseudo)

```
commandIndex = 0
pendingCommands = []

showCommandMenu(playerParty[commandIndex])
  → 攻擊/技能: enter target selection → on confirm: push PendingCommand, commandIndex++
  → 防禦: push PendingCommand (no target), commandIndex++
  → 自動: enter auto mode

if commandIndex >= alivePlayerCount → startExecution()

Revise:
  → tap already-set character at index i
  → remove pendingCommands[i]
  → commandIndex = i → showCommandMenu again
  → on confirm → commandIndex++ (continue forward)
```

### Execution Phase Flow (pseudo)

```
turnOrder = computeTurnOrder([...playerParty, ...enemyParty])

for each character in turnOrder:
  if !character.alive: skip
  if character.isPlayer:
    cmd = pendingCommands.find(c => c.character.id === character.id)
    retarget if cmd.target is dead (per Dead Target rules above)
    execute cmd
  else:
    target = randomAlive(playerParty)  // or enemy-specific AI
    execute normal attack (or enemy skill)

after all actions: clearPendingCommands() → phase = 'command' → new round
```

### Unchanged Pure Functions

- `TurnEngine.computeTurnOrder()` — no change
- `DamageCalc.calcDamage()` — no change
- `AI.chooseTarget()` — **needs update:** change default behavior from "lowest HP" to "random alive player character"; enemy-specific AI types passed as param
- `ExpSystem.applyExp()` / `allocateStat()` — no change

---

## Out of Scope (This Redesign — Planned for Future)

| 項目 | 未來計畫 |
|------|---------|
| AoE 技能（多目標） | 規劃中，本次不實作 |
| 技能 Cooldown | 依技能強度設定回合數冷卻，無 MP 系統；規劃中，本次不實作 |
| 狀態異常（毒、暈、燃燒等） | 規劃中，本次不實作；死亡視為狀態之一，未來統一處理 |
| 治療技能 | Phase 1 角色無治療技能，本次不實作 |
| 復活技能 | Phase 1 角色無復活技能，本次不實作 |
| 動畫強化 | 超出本次範圍 |
