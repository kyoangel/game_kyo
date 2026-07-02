# Spec: UI Design

## Goal
Unify all game scenes under a cohesive pixel-art UI design system that improves information clarity, visual hierarchy, and player feedback while maintaining the dark post-apocalyptic aesthetic.

---

## Rules

### 1. Design System — "Wasteland Pixel" Theme

A shared visual language applied to every scene:

**Palette (in-code constants in `src/ui/theme.ts`):**
```
BG_DARK      = 0x0d1117   // primary background
BG_MID       = 0x1c2333   // panel fill
BG_LIGHT     = 0x2d3748   // raised card / row
BORDER_DIM   = 0x4a5568   // inactive border
BORDER_LIT   = 0x68d391   // active / selected border (green neon)
BORDER_WARN  = 0xf6ad55   // warning (low HP, cooldown)
TEXT_PRIMARY  = 0xe2e8f0  // main readable text
TEXT_DIM      = 0x718096  // secondary / disabled
TEXT_ACCENT   = 0x68d391  // green — EXP, regen, success
TEXT_GOLD     = 0xf6e05e  // currency, loot
TEXT_RED      = 0xfc8181  // damage, danger
TEXT_PURPLE   = 0xb794f4  // skill cost, archetype
BUTTON_IDLE   = 0x2d3748
BUTTON_HOVER  = 0x4a5568
BUTTON_ACTIVE = 0x276749  // confirm/attack
BUTTON_DANGER = 0x742a2a  // destructive actions
HP_HIGH       = 0x48bb78
HP_MID        = 0xed8936
HP_LOW        = 0xe53e3e
```

**Typography (Phaser text style presets exported from `src/ui/theme.ts`):**
```
TITLE_LG   = { fontFamily: 'monospace', fontSize: '20px', color: '#e2e8f0' }
TITLE_MD   = { fontFamily: 'monospace', fontSize: '16px', color: '#e2e8f0' }
BODY       = { fontFamily: 'monospace', fontSize: '12px', color: '#e2e8f0' }
LABEL      = { fontFamily: 'monospace', fontSize: '10px', color: '#718096' }
ACCENT     = { fontFamily: 'monospace', fontSize: '12px', color: '#68d391' }
GOLD       = { fontFamily: 'monospace', fontSize: '12px', color: '#f6e05e' }
```

**Panel borders:** All panels use a 2px-wide pixel-border rectangle (top + left + right + bottom as four thin `Graphics` rectangles). No rounded corners. No drop shadows.

**Button anatomy:**
- Fill rectangle (BUTTON_IDLE / BUTTON_HOVER / BUTTON_ACTIVE / BUTTON_DANGER)
- 1px border on all sides (BORDER_DIM → BORDER_LIT on hover)
- Text centered inside
- Pointer cursor on hover; alpha 0.5 + BORDER_DIM when disabled

**Transition rule:** All scene entries use a 300ms black-cover alpha-in from 1→0 (fade in). Scene exits fade to black 200ms before `scene.start()`.

---

### 2. Battle Scene UI

#### 2a. Battle HUD — Static Layout (360×640)

```
┌─────────────────────────────────────────────────────┐
│ TURN: 3  [AUTO]  [PAUSE]              💰 240        │ y=0–28 (header bar)
├─────────────────────────────────────────────────────┤
│  [PLAYER PARTY — left column x=10–170]              │
│  [ENEMY PARTY  — right column x=190–350]            │
│                                                      │ y=28–390 (combat field)
├─────────────────────────────────────────────────────┤
│  COMBAT LOG                                          │ y=390–440 (log panel)
├─────────────────────────────────────────────────────┤
│  ACTION MENU                                         │ y=440–640 (command zone)
└─────────────────────────────────────────────────────┘
```

#### 2b. Character Card (in combat field)

Each combatant occupies a 150×74 card with:
- Background: BG_MID rectangle + 1px BORDER_DIM border
- Active combatant border: BORDER_LIT (green), 2px
- Sprite/body: left half of card (64×64 area)
- Right half: name (TITLE_MD, truncated at 8 chars), archetype badge (pill shape, colored by archetype), HP bar (full width, 8px height), HP text (LABEL)
- Buff/debuff row: up to 4 icon slots (12×12 pixel icons) below HP bar — each slot shows a colored square with a letter code (e.g., `Ⓢ` for speed up, `Ⓓ` for defense down). Tooltip on hover shows full name + remaining turns.
- Skill cooldown dots: one dot per skill, filled = ready (BORDER_LIT), empty ring = on cooldown (BORDER_DIM)
- Dead characters: card alpha → 0.35, grayscale tint (0xaaaaaa), "✕" overlaid

**Archetype badge colors:**
| Archetype | Color    |
|-----------|----------|
| 坦克       | 0x3182ce (blue) |
| 輸出       | 0xe53e3e (red)  |
| 狙擊       | 0xd69e2e (gold) |
| 輔助       | 0x68d391 (green)|
| 全能       | 0xb794f4 (purple)|

#### 2c. Combat Log Panel

- 2-line scrolling text area (y=390–440), BG_DARK background
- Latest line: TEXT_PRIMARY; previous line: TEXT_DIM
- Damage numbers: TEXT_RED + font size 14px; healing: TEXT_ACCENT; miss: TEXT_DIM italics
- Floating damage numbers: spawn at target's center, float up 30px over 600ms, alpha 1→0

#### 2d. Action Menu Zone (y=440–640)

Command buttons arranged in a 2×2 grid + 1 wide:
```
[ 攻擊 ]  [ 技能 ]
[ 防禦 ]  [ 招募 ]
[    AUTO    ]
```
- Button size: 80×36 (grid), 164×36 (AUTO)
- Selected character name shown as header above grid in TITLE_MD
- Skill submenu: slides up from y=640 when "技能" pressed — shows up to 4 skill buttons each 160×32 wide with skill name, cost (MP icon), cooldown remaining. Blocked skills show BORDER_WARN border + remaining turns.

#### 2e. Turn Order Indicator

Horizontal strip at y=28–50 (between header and field):
- 5 portrait thumbnails (28×28) in turn order left-to-right
- Active (current turn): larger (36×36), BORDER_LIT border
- Next 4: small, BORDER_DIM, slightly transparent (0.7)
- Enemy thumbnails have a red background tint; player thumbnails blue tint

#### 2f. Pause Menu

Triggered by dedicated [PAUSE] button in header. Covers full screen with 0x000000 at alpha 0.7.  
Options (vertical list of buttons):
1. 繼續 (Resume)
2. 重新開始 (Restart stage) — BUTTON_DANGER
3. 放棄任務 (Abandon to Base) — BUTTON_DANGER

---

### 3. Base Scene (Hub) UI

- **Layout rework**: Two-column layout. Left column (x=0–175): squad list. Right column (x=185–360): selected character detail panel.
- **Character detail panel**: Shows large archetype badge, all stats with icons (❤ HP / ⚔ ATK / 🛡 DEF / ⚡ SPD), current skills list (name + cooldown design), level + EXP progress bar to next level.
- **Section headers**: Full-width 24px-height bar (BG_LIGHT fill, BORDER_DIM bottom border) with category label in TITLE_MD.
- **EXP pool bar**: Moved to sticky top-right with a 100px-wide bar; replaces floating text.
- **Notification badges**: Small red circle with number on squad cards when level-up is available.
- **Sticky footer**: "商店" and "世界地圖" pinned at y=600–640. Always visible.

---

### 4. World Map Scene UI

- **Chapter collapsible headers**: Click to expand/collapse chapter's stage list. Collapsed shows chapter name + completion count ("2/5 完成").
- **Stage row redesign**:
  - Height: 44px per row (up from ~32)
  - Left icon (20×20): 🔒 / ▶ / ✅ / ⚔ / ✦ replaced with pixel icons from a sprite sheet
  - Status color-coded left border (4px wide bar): gray/blue/green/red/yellow
  - Stage name + difficulty pips (1–3 filled diamonds: ◆◆◇ = medium)
  - Reward preview (tiny icons for currency, EXP, item)
- **Scroll indicator**: Right-side scrollbar (6px wide, BG_LIGHT track, BORDER_LIT thumb).

---

### 5. Shop Scene UI

- **Tab bar**: Two pill tabs at top — "技能卷軸" | "補給品". Active tab has BORDER_LIT underline.
- **Item card** (full width, 60px height):
  - Left: 32×32 item icon (colored placeholder square for now, sprite later)
  - Center: name (BODY), description (LABEL, 2 lines max, truncated)
  - Right: price in GOLD color + 購買 button (BUTTON_ACTIVE when affordable, BUTTON_IDLE + disabled when not)
- **Insufficient funds feedback**: Shake animation (±4px x over 200ms) + flash red on price when clicked without enough currency.

---

### 6. Result Scene UI

- **Victory**: Full-screen flash to white (50ms) then scene fades in. Large "VICTORY" in TITLE_LG gold color. Pixel star graphic (3 stars above title, filled based on performance).
- **Defeat**: Screen flash to red, then TITLE_LG "DEFEAT" in TEXT_RED.
- **Reward breakdown**: Animated count-up for EXP and currency (500ms).
- **New recruit callout**: Character name in a separate highlighted row with "> 新夥伴加入!" in TEXT_ACCENT, 1s delay after other rewards appear.

---

### 7. Title Scene UI

- **Background**: Scrolling pixel cityscape at y=200–400 (static colored rectangles for now, anim later).
- **Logo**: "PIXEL SQUAD" in TITLE_LG (28px), subtitle in LABEL below.
- **Save slots**: Cards 320×72 each, with:
  - Save icon (💾) left
  - Center: squad composition (up to 3 character name initials in colored badges) + last-played timestamp
  - "NEW" badge for empty slots
  - Delete button (×) top-right corner, only visible on hover

---

## Data Model Changes

### New file: `src/ui/theme.ts`
```typescript
export const Colors = {
  BG_DARK: 0x0d1117,
  BG_MID: 0x1c2333,
  BG_LIGHT: 0x2d3748,
  BORDER_DIM: 0x4a5568,
  BORDER_LIT: 0x68d391,
  BORDER_WARN: 0xf6ad55,
  TEXT_PRIMARY: 0xe2e8f0,
  TEXT_DIM: 0x718096,
  TEXT_ACCENT: 0x68d391,
  TEXT_GOLD: 0xf6e05e,
  TEXT_RED: 0xfc8181,
  TEXT_PURPLE: 0xb794f4,
  BUTTON_IDLE: 0x2d3748,
  BUTTON_HOVER: 0x4a5568,
  BUTTON_ACTIVE: 0x276749,
  BUTTON_DANGER: 0x742a2a,
  HP_HIGH: 0x48bb78,
  HP_MID: 0xed8936,
  HP_LOW: 0xe53e3e,
  ARCHETYPE: {
    坦克: 0x3182ce,
    輸出: 0xe53e3e,
    狙擊: 0xd69e2e,
    輔助: 0x68d391,
    全能: 0xb794f4,
  } as Record<string, number>,
} as const;

export const TextStyles = {
  TITLE_LG: { fontFamily: 'monospace', fontSize: '20px', color: '#e2e8f0' },
  TITLE_MD: { fontFamily: 'monospace', fontSize: '16px', color: '#e2e8f0' },
  BODY:     { fontFamily: 'monospace', fontSize: '12px', color: '#e2e8f0' },
  LABEL:    { fontFamily: 'monospace', fontSize: '10px', color: '#718096' },
  ACCENT:   { fontFamily: 'monospace', fontSize: '12px', color: '#68d391' },
  GOLD:     { fontFamily: 'monospace', fontSize: '12px', color: '#f6e05e' },
  DAMAGE:   { fontFamily: 'monospace', fontSize: '14px', color: '#fc8181' },
  HEAL:     { fontFamily: 'monospace', fontSize: '14px', color: '#68d391' },
} as const;
```

### New file: `src/ui/UIFactory.ts`
```typescript
// Factory helpers — every scene uses these instead of ad-hoc primitives
export function makePanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, borderColor?: number): Phaser.GameObjects.Container

export function makeButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, variant: 'active' | 'idle' | 'danger' | 'disabled'): Phaser.GameObjects.Container

export function makeHPBar(scene: Phaser.Scene, x: number, y: number, w: number, h: number): { bg: Phaser.GameObjects.Rectangle; bar: Phaser.GameObjects.Rectangle; update: (pct: number) => void }

export function makeArchetypeBadge(scene: Phaser.Scene, x: number, y: number, archetype: string): Phaser.GameObjects.Container

export function makeBuffSlots(scene: Phaser.Scene, x: number, y: number, count: number): Phaser.GameObjects.Container

export function fadeIn(scene: Phaser.Scene, duration?: number): void
export function fadeOut(scene: Phaser.Scene, duration?: number, onComplete?: () => void): void
```

### Modify `src/scenes/BattleScene.ts`

Update `CharacterView` interface:
```typescript
interface CharacterView {
  container: Phaser.GameObjects.Container;   // ADD: root container
  body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;
  animator: CharacterAnimator;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  archetypeText: Phaser.GameObjects.Text;
  archetypeBadge: Phaser.GameObjects.Container;  // ADD
  buffSlots: Phaser.GameObjects.Container;        // ADD
  cdDots: Phaser.GameObjects.Graphics[];          // ADD: one per skill
  cardBg: Phaser.GameObjects.Rectangle;           // ADD: for active highlight
}
```

### Modify `src/types.ts`

Add to `GameState`:
```typescript
uiSettings?: {
  animationsEnabled: boolean;
  floatingNumbers: boolean;
};
```

Add `TurnOrderEntry` for turn-order strip:
```typescript
export interface TurnOrderEntry {
  characterId: string;
  isPlayer: boolean;
  portraitKey: string;
}
```

---

## UI Changes — Scene-Level Summary

| Scene | Key Changes |
|-------|-------------|
| All scenes | Unified color palette via `theme.ts`; `UIFactory` helpers replace ad-hoc primitives; fade-in/out transitions |
| BattleScene | Turn-order strip; floating damage numbers; pause menu; buff/debuff icon row; CD dots on cards; active-border highlight; combat log panel |
| BaseScene | Two-column layout; character detail panel; notification badges; sticky footer nav |
| WorldMapScene | Chapter collapsible sections; stage row redesign with difficulty pips; scrollbar |
| ShopScene | Tab bar; item cards with icons; shake-on-insufficient-funds feedback |
| ResultScene | Victory flash; animated count-up rewards; star rating |
| TitleScene | Scrolling BG placeholder; richer save slot cards |

---

## Acceptance Criteria

**AC-1: Theme constants**
- Given the game launches
- When any scene is rendered
- Then all backgrounds use Colors.BG_DARK/BG_MID/BG_LIGHT, all primary text uses Colors.TEXT_PRIMARY, and no hardcoded hex values appear outside `theme.ts`

**AC-2: Battle — active character highlight**
- Given it is a player character's turn
- When the command menu is shown
- Then that character's card has a 2px BORDER_LIT (green) border, and all other cards have BORDER_DIM

**AC-3: Battle — buff/debuff icons**
- Given a character has an active buff (e.g., ATK+)
- When the battle field is rendered
- Then a colored icon slot appears in the character's card buff row; hovering the icon shows a tooltip with full buff name and remaining turns

**AC-4: Battle — skill cooldown dots**
- Given a character has a skill on cooldown
- When the character card is visible
- Then its corresponding cooldown dot shows as an empty ring (BORDER_DIM); a ready skill shows a filled dot (BORDER_LIT)

**AC-5: Battle — floating damage numbers**
- Given an attack lands on a target
- When the attack resolves
- Then a floating number (red for damage, green for healing) spawns at the target's position and floats upward 30px over 600ms before disappearing

**AC-6: Battle — turn order strip**
- Given combat is in progress
- When any turn begins
- Then the turn-order strip at y=28–50 shows the next 5 combatants in order; the current combatant is displayed larger with a BORDER_LIT border

**AC-7: Battle — pause menu**
- Given the player is in battle
- When the PAUSE button is tapped
- Then a pause overlay appears with Resume, Restart, and Abandon options; tapping Resume returns to battle without losing state

**AC-8: Scene fade transitions**
- Given the player navigates from any scene to another
- When the transition fires
- Then a 200ms black fade-out precedes the new scene and a 300ms fade-in plays on the new scene

**AC-9: Shop — insufficient funds feedback**
- Given the player cannot afford an item
- When the 購買 button is tapped
- Then the price text shakes (±4px) and flashes TEXT_RED for 200ms; no purchase is made

**AC-10: Result — star rating display**
- Given the player completes a stage with victory
- When the result screen is shown
- Then 1–3 stars appear above the VICTORY title based on performance (1 = any win, 2 = no KOs, 3 = no KOs + under 5 turns); stars animate in sequentially with 200ms delay each

**AC-11: UIFactory usage**
- Given a code review of any scene
- When examining panel, button, and HP-bar creation calls
- Then they all call `UIFactory.makePanel`, `UIFactory.makeButton`, `UIFactory.makeHPBar` respectively — no raw `scene.add.rectangle` calls for UI chrome

**AC-12: Two-column Base layout**
- Given the player is on the Base scene
- When a character card is tapped
- Then the right column updates to show that character's full detail panel (archetype badge, all 4 stats with icons, skills, level + EXP bar) without navigating to a new scene

---

## Out of Scope
- Custom pixel-art UI sprite sheet / 9-slice panels (placeholder rectangles acceptable for this iteration)
- Localization / language toggle
- Animated background art (static placeholder acceptable)
- Mobile touch gesture swipe navigation
