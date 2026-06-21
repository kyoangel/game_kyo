import {
  createInitialState,
  slide,
  spawnRandomTile,
  isGameOver,
  type Direction,
  type GameState,
  type GameGrid,
  type EliminatedPair,
  type Rng,
} from "./grid";
import {
  PALETTES,
  PALETTE_ORDER,
  nextPalette,
  isPaletteId,
  type PaletteId,
} from "./palettes";
import { changedCells } from "./gridDiff";
import { formatScorePopup, isNewRecord } from "./scoring";
import { AudioEngine } from "./audio";
import {
  type PowerupId,
  type PowerupState,
  emptyPowerups,
  computePlayCountAward,
  computeEliminationAward,
} from "./powerups";
import { checkTrophies, loadModalData, getTrophyDef } from "./trophies";

const GRID_SIZE = 4;
const BEST_SCORE_KEY = "mathMerge10BestScore";
const PALETTE_KEY = "mathMerge10Palette";
const POWERUP_KEY = "mathMerge10Powerups";
const PLAY_COUNT_KEY = "mathMerge10PlayCount";
const LIFETIME_ELIM_KEY = "mathMerge10LifetimeElim";
const ELIM_HIGHLIGHT_MS = 400;
const ELIM_FADE_MS = 200;
const MOVE_DURATION_MS = 150;
const SPAWN_DELAY_MS = 350;
const SPAWN_DURATION_MS = 400;
const HUD_HEIGHT = 64;
const CANVAS_PADDING = 16;
const CANVAS_MAX = 500;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const gameOverEl = document.getElementById("game-over") as HTMLDivElement;
const gameOverScoreEl = document.getElementById("game-over-score") as HTMLParagraphElement;
const gameOverBestEl = document.getElementById("game-over-best") as HTMLParagraphElement;
const gameOverBadgeEl = document.getElementById("game-over-badge") as HTMLParagraphElement;
const playAgainEl = document.getElementById("play-again") as HTMLButtonElement;
const paletteToggleEl = document.getElementById("hud-palette-toggle") as HTMLButtonElement;
const hudScoreEl = document.getElementById("hud-score") as HTMLSpanElement;
const hudBestEl = document.getElementById("hud-best") as HTMLSpanElement;
const scorePopupEl = document.getElementById("score-popup") as HTMLDivElement;
const comboBadgeEl = document.getElementById("combo-badge") as HTMLDivElement;

const hudMuteEl = document.getElementById("hud-mute") as HTMLButtonElement;
const hudPowerupInfoEl = document.getElementById("hud-powerup-info") as HTMLButtonElement;
const powerupModalEl = document.getElementById("powerup-modal") as HTMLDivElement;
const powerupModalOverlayEl = document.getElementById("powerup-modal-overlay") as HTMLDivElement;
const powerupModalCloseEl = document.getElementById("powerup-modal-close") as HTMLButtonElement;
const hudTrophyEl = document.getElementById("hud-trophy") as HTMLButtonElement;
const trophyModalEl = document.getElementById("trophy-modal") as HTMLDivElement;
const trophyModalOverlayEl = document.getElementById("trophy-modal-overlay") as HTMLDivElement;
const trophyModalCloseEl = document.getElementById("trophy-modal-close") as HTMLButtonElement;
const trophyModalListEl = document.getElementById("trophy-modal-list") as HTMLUListElement;
const trophyToastEl = document.getElementById("trophy-toast") as HTMLDivElement;
const audio = new AudioEngine();

function updateMuteButton(): void {
  hudMuteEl.textContent = audio.isMuted ? "🔇" : "🔊";
}

hudMuteEl.addEventListener("click", () => {
  audio.toggleMute();
  updateMuteButton();
});

hudPowerupInfoEl.addEventListener("click", () => {
  powerupModalEl.removeAttribute("hidden");
});
powerupModalOverlayEl.addEventListener("click", () => {
  powerupModalEl.setAttribute("hidden", "");
});
powerupModalCloseEl.addEventListener("click", () => {
  powerupModalEl.setAttribute("hidden", "");
});

hudTrophyEl.addEventListener("click", () => {
  renderTrophyModal();
  trophyModalEl.removeAttribute("hidden");
});
trophyModalOverlayEl.addEventListener("click", () => {
  trophyModalEl.setAttribute("hidden", "");
});
trophyModalCloseEl.addEventListener("click", () => {
  trophyModalEl.setAttribute("hidden", "");
});

function updateHudScore(): void {
  hudScoreEl.textContent = `Score: ${state.score}`;
  hudBestEl.textContent = `Best: ${bestScore}`;
}

function loadBestScore(): number {
  const value = Number(localStorage.getItem(BEST_SCORE_KEY));
  return Number.isFinite(value) ? value : 0;
}

function loadPalette(): PaletteId {
  const stored = localStorage.getItem(PALETTE_KEY);
  return isPaletteId(stored) ? stored : PALETTE_ORDER[0];
}

function loadPowerups(): PowerupState {
  try {
    const raw = localStorage.getItem(POWERUP_KEY);
    if (raw) return { ...emptyPowerups(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return emptyPowerups();
}

function savePowerups(): void {
  localStorage.setItem(POWERUP_KEY, JSON.stringify(powerups));
}

const POWERUP_UNLOCK_TIPS: Record<PowerupId, string> = {
  hammer:  "每 2 局隨機獲得",
  shuffle: "每 2 局隨機獲得",
  addOne:  "每 3 局獲得",
  bomb:    "每累計消除 30 對獲得一顆",
};

function renderHudPowerups(): void {
  const container = document.getElementById("hud-powerups")!;
  container.innerHTML = "";
  const defs: Array<{ id: PowerupId; icon: string }> = [
    { id: "hammer",  icon: "🔨" },
    { id: "shuffle", icon: "🔀" },
    { id: "addOne",  icon: "➕" },
    { id: "bomb",    icon: "💣" },
  ];

  defs.forEach(({ id, icon }) => {
    const count = powerups[id];
    const locked = count === 0;
    const btn = document.createElement("button");
    btn.className = "hud-powerup-btn";
    btn.dataset.powerup = id;
    btn.dataset.locked = String(locked);
    btn.dataset.active = String(activePowerup === id);

    const badge = locked
      ? `<span class="hud-powerup-count">🔒</span>`
      : `<span class="hud-powerup-count">${count}</span>`;
    const tooltip = locked
      ? `<span class="powerup-tooltip">${POWERUP_UNLOCK_TIPS[id]}</span>`
      : "";

    btn.innerHTML = `${icon}${badge}${tooltip}`;

    btn.addEventListener("click", (e) => {
      if (locked) {
        e.stopPropagation();
        const isOpen = btn.dataset.tooltipOpen === "true";
        container.querySelectorAll<HTMLElement>("[data-tooltip-open]").forEach(
          (el) => { delete el.dataset.tooltipOpen; },
        );
        if (!isOpen) btn.dataset.tooltipOpen = "true";
        return;
      }
      activePowerup = activePowerup === id ? null : id;
      canvas.style.outline = activePowerup ? "3px solid #f59e0b" : "";
      renderHudPowerups();
    });

    container.appendChild(btn);
  });
}

function applyHammer(row: number, col: number): void {
  if (state.grid[row][col] === null) return;
  const newGrid = state.grid.map((r, ri) =>
    r.map((c, ci) => (ri === row && ci === col ? null : c)),
  );
  setState({ ...state, grid: newGrid });
  powerups.hammer--;
  savePowerups();
  audio.play("hammer");
  renderHudPowerups();
}

function applyShuffle(): void {
  const tiles: Array<{ row: number; col: number; value: number }> = [];
  state.grid.forEach((r, ri) =>
    r.forEach((c, ci) => {
      if (c !== null) tiles.push({ row: ri, col: ci, value: c });
    }),
  );
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i].value, tiles[j].value] = [tiles[j].value, tiles[i].value];
  }
  const newGrid = state.grid.map((r) => r.map(() => null as number | null));
  tiles.forEach(({ row, col, value }) => {
    newGrid[row][col] = value;
  });
  setState({ ...state, grid: newGrid });
  powerups.shuffle--;
  savePowerups();
  audio.play("shuffle");
  renderHudPowerups();
}

function applyAddOne(row: number, col: number): void {
  const value = state.grid[row][col];
  if (value === null) return;
  if (value === 9) {
    const newGrid = state.grid.map((r, ri) =>
      r.map((c, ci) => (ri === row && ci === col ? null : c)),
    );
    setState({ ...state, grid: newGrid, score: state.score + 10 });
  } else {
    const newGrid = state.grid.map((r, ri) =>
      r.map((c, ci) => (ri === row && ci === col ? value + 1 : c)),
    );
    setState({ ...state, grid: newGrid });
  }
  powerups.addOne--;
  savePowerups();
  audio.play("addOne");
  renderHudPowerups();
}

function applyBomb(row: number, col: number): void {
  const newGrid = state.grid.map((r, ri) =>
    r.map((c, ci) => {
      const isCenter = ri === row && ci === col;
      const isAdjacent =
        (ri === row - 1 && ci === col) ||
        (ri === row + 1 && ci === col) ||
        (ri === row && ci === col - 1) ||
        (ri === row && ci === col + 1);
      return isCenter || isAdjacent ? null : c;
    }),
  );
  setState({ ...state, grid: newGrid });
  powerups.bomb--;
  savePowerups();
  audio.play("bomb");
  renderHudPowerups();
}

function loadPlayCount(): number {
  return parseInt(localStorage.getItem(PLAY_COUNT_KEY) ?? "0", 10);
}

function loadLifetimeElim(): number {
  return parseInt(localStorage.getItem(LIFETIME_ELIM_KEY) ?? "0", 10);
}

let state: GameState = createInitialState(GRID_SIZE);
let rng: Rng = Math.random;
let bestScore = loadBestScore();
let currentPalette: PaletteId = loadPalette();
let powerups: PowerupState = loadPowerups();

const spawnCells = new Map<string, number>();
const moveCells = new Map<string, { startTime: number; direction: Direction }>();

interface PhantomTile {
  origRow: number;
  origCol: number;
  firstCompactRow: number;
  firstCompactCol: number;
  value: number;
}

interface PhantomGroup {
  tiles: PhantomTile[];
  length: 2;
  direction: Direction;
  groupIndex: number;
}

interface SurvivorCell {
  origRow: number;
  origCol: number;
  firstCompactRow: number;
  firstCompactCol: number;
  finalRow: number;
  finalCol: number;
}

interface ElimPhaseState {
  groups: PhantomGroup[];
  startTime: number;
  survivorCells: SurvivorCell[];
}

interface RecompactCell {
  origRow: number;
  origCol: number;
  firstCompactRow: number;
  firstCompactCol: number;
}

let eliminationPhase: ElimPhaseState | null = null;
let spawnPending = false;
const recompactCells = new Map<string, RecompactCell>();

let animationFrameId: number | null = null;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const HF_MS = ELIM_HIGHLIGHT_MS + ELIM_FADE_MS;

function c2StartMs(totalGroups: number): number {
  return MOVE_DURATION_MS + totalGroups * HF_MS;
}

function totalElimMs(totalGroups: number): number {
  return c2StartMs(totalGroups) + MOVE_DURATION_MS;
}

function buildElimPhaseState(
  eliminatedPairs: EliminatedPair[],
  prevGrid: GameGrid,
  direction: Direction,
  startTime: number,
): ElimPhaseState {
  const size = prevGrid.length;
  const isVertical = direction === "up" || direction === "down";
  const isReverse = direction === "right" || direction === "down";

  const eliminatedSet = new Set(
    eliminatedPairs.flatMap(({ a, b }) => [`${a.row},${a.col}`, `${b.row},${b.col}`]),
  );

  const groups: PhantomGroup[] = eliminatedPairs.map(({ a, b, meetA, meetB }, groupIndex) => ({
    tiles: [
      { origRow: a.row, origCol: a.col, firstCompactRow: meetA.row, firstCompactCol: meetA.col, value: prevGrid[a.row][a.col] as number },
      { origRow: b.row, origCol: b.col, firstCompactRow: meetB.row, firstCompactCol: meetB.col, value: prevGrid[b.row][b.col] as number },
    ],
    length: 2 as const,
    direction,
    groupIndex,
  }));

  const survivorCells: SurvivorCell[] = [];

  for (let lineIdx = 0; lineIdx < size; lineIdx++) {
    const positions: number[] = isReverse
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    let finalIdx = 0;

    for (const pos of positions) {
      const origRow = isVertical ? pos : lineIdx;
      const origCol = isVertical ? lineIdx : pos;

      if (prevGrid[origRow][origCol] === null) continue;

      const isElim = eliminatedSet.has(`${origRow},${origCol}`);

      if (!isElim) {
        let finalRow: number, finalCol: number;
        if (isVertical) {
          finalRow = isReverse ? size - 1 - finalIdx : finalIdx;
          finalCol = lineIdx;
        } else {
          finalRow = lineIdx;
          finalCol = isReverse ? size - 1 - finalIdx : finalIdx;
        }
        // Survivors stay in place during C1; they slide orig→final in C2.
        survivorCells.push({ origRow, origCol, firstCompactRow: origRow, firstCompactCol: origCol, finalRow, finalCol });
        finalIdx++;
      }
    }
  }

  return { groups, startTime, survivorCells };
}

function drawPhantomTile(
  value: number,
  x: number,
  y: number,
  cellSize: number,
  alpha: number,
  scale: number,
): void {
  const cx = x + cellSize / 2;
  const cy = y + cellSize / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = "#fde047";
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 4, cellSize - 8, cellSize - 8, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#422006";
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), x + cellSize / 2, y + cellSize / 2);
  ctx.restore();
}

function finalizeDeferredSlide(): void {
  if (!spawnPending) return;
  spawnPending = false;

  const postSlideGrid = state.grid;
  const newGrid = spawnRandomTile(postSlideGrid, rng);
  state = { ...state, grid: newGrid };

  if (isGameOver(newGrid)) {
    setTimeout(() => audio.play("gameOver"), 400);
    const gameOverTrophies = checkTrophies({ type: "gameOver", score: state.score });
    gameOverTrophies.forEach((id) => showTrophyToast(id));
  }

  const spawnedList = changedCells(postSlideGrid, newGrid).filter(
    ({ row, col }) => newGrid[row][col] !== null && postSlideGrid[row][col] === null,
  );
  spawnCells.clear();
  spawnedList.forEach(({ row, col }) => {
    spawnCells.set(`${row},${col}`, performance.now() + SPAWN_DELAY_MS);
  });
}

function drawBaseTile(
  value: number,
  x: number,
  y: number,
  cellSize: number,
  padding: number,
  flashAlpha: number,
): void {
  const colors = PALETTES[currentPalette][value];

  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
  ctx.fill();

  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.beginPath();
    ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
    ctx.fill();
  }

  ctx.fillStyle = colors.text;
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), x + cellSize / 2, y + cellSize / 2);
}

function render(): void {
  const cellSize = canvas.width / GRID_SIZE;
  const padding = 4;
  const now = performance.now();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      ctx.strokeStyle = "#444";
      ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
    }
  }

  // Draw tiles from state.grid with per-type animations
  state.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell === null) return;

      const key = `${rowIndex},${colIndex}`;
      const x = colIndex * cellSize;
      const y = rowIndex * cellSize;

      if (spawnCells.has(key)) {
        const startTime = spawnCells.get(key)!;
        const elapsed = now - startTime;
        if (elapsed < 0) return; // not started yet — tile stays invisible

        const t = Math.min(1, elapsed / SPAWN_DURATION_MS);
        let dy: number;
        let scale: number;
        let opacity: number;
        let glowAlpha: number;

        if (t <= 0.5) {
          const p = t / 0.5;
          dy = lerp(-64, 6, p);
          scale = lerp(0.4, 1.1, p);
          opacity = p;
          glowAlpha = p;
        } else if (t <= 0.75) {
          const p = (t - 0.5) / 0.25;
          dy = lerp(6, -3, p);
          scale = lerp(1.1, 0.97, p);
          opacity = 1;
          glowAlpha = lerp(1, 0, p);
        } else {
          const p = (t - 0.75) / 0.25;
          dy = lerp(-3, 0, p);
          scale = lerp(0.97, 1.0, p);
          opacity = 1;
          glowAlpha = 0;
        }

        const cx = x + cellSize / 2;
        const cy = y + dy + cellSize / 2;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
        if (glowAlpha > 0) {
          ctx.shadowColor = "#4ade80";
          ctx.shadowBlur = 20 * glowAlpha;
        }
        drawBaseTile(cell, x, y + dy, cellSize, padding, 0);
        ctx.restore();
      } else if (eliminationPhase !== null && recompactCells.has(key)) {
        const rc = recompactCells.get(key)!;
        const elapsed = now - eliminationPhase.startTime;
        const c2Start = c2StartMs(eliminationPhase.groups.length);
        let drawX: number, drawY: number;
        if (elapsed <= MOVE_DURATION_MS) {
          const t = Math.min(1, elapsed / MOVE_DURATION_MS);
          const p = 1 - Math.pow(1 - t, 2);
          drawX = lerp(rc.origCol * cellSize, rc.firstCompactCol * cellSize, p);
          drawY = lerp(rc.origRow * cellSize, rc.firstCompactRow * cellSize, p);
        } else if (elapsed < c2Start) {
          drawX = rc.firstCompactCol * cellSize;
          drawY = rc.firstCompactRow * cellSize;
        } else {
          const t = Math.min(1, (elapsed - c2Start) / MOVE_DURATION_MS);
          const p = 1 - Math.pow(1 - t, 2);
          drawX = lerp(rc.firstCompactCol * cellSize, colIndex * cellSize, p);
          drawY = lerp(rc.firstCompactRow * cellSize, rowIndex * cellSize, p);
        }
        drawBaseTile(cell, drawX, drawY, cellSize, padding, 0);
      } else if (moveCells.has(key)) {
        const { startTime, direction } = moveCells.get(key)!;
        const t = Math.min(1, (now - startTime) / MOVE_DURATION_MS);
        const p = 1 - Math.pow(1 - t, 2); // ease-out
        const scale = lerp(0.65, 1.0, p);
        const offset = lerp(16, 0, p);

        let dx = 0;
        let dy = 0;
        if (direction === "left") dx = offset;
        else if (direction === "right") dx = -offset;
        else if (direction === "up") dy = offset;
        else dy = -offset;

        const cx = x + dx + cellSize / 2;
        const cy = y + dy + cellSize / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
        drawBaseTile(cell, x + dx, y + dy, cellSize, padding, 0);
        ctx.restore();
      } else {
        drawBaseTile(cell, x, y, cellSize, padding, 0);
      }
    });
  });

  // Draw elimination phase: phantom tiles C1→H→F, survivors already handled in tile loop via recompactCells
  if (eliminationPhase !== null) {
    const elapsed = now - eliminationPhase.startTime;

    for (const group of eliminationPhase.groups) {
      const hStart = MOVE_DURATION_MS + group.groupIndex * HF_MS;
      const fStart = hStart + ELIM_HIGHLIGHT_MS;
      const fEnd = fStart + ELIM_FADE_MS;

      for (const tile of group.tiles) {
        const fcX = tile.firstCompactCol * cellSize;
        const fcY = tile.firstCompactRow * cellSize;
        const origX = tile.origCol * cellSize;
        const origY = tile.origRow * cellSize;

        if (elapsed <= MOVE_DURATION_MS) {
          const t = elapsed / MOVE_DURATION_MS;
          const p = 1 - Math.pow(1 - t, 2);
          drawPhantomTile(tile.value, lerp(origX, fcX, p), lerp(origY, fcY, p), cellSize, 1, 1.0);
        } else if (elapsed < hStart) {
          drawBaseTile(tile.value, fcX, fcY, cellSize, padding, 0);
        } else if (elapsed < fEnd) {
          if (elapsed < fStart) {
            drawPhantomTile(tile.value, fcX, fcY, cellSize, 1, 1.05);
          } else {
            const fadeT = Math.min(1, (elapsed - fStart) / ELIM_FADE_MS);
            drawPhantomTile(tile.value, fcX, fcY, cellSize, Math.max(0, 1 - fadeT), lerp(1.05, 0.4, fadeT));
          }
        }
      }
    }
  }

  if (eliminationPhase === null) {
    const gameOver = isGameOver(state.grid);
    gameOverEl.hidden = !gameOver;
    if (gameOver) {
      gameOverScoreEl.textContent = `本次分數：${state.score}`;
      gameOverBestEl.textContent = `最高分：${bestScore}`;
      gameOverBadgeEl.classList.toggle("hidden", !isNewRecord(state.score, bestScore));
    }
  }
}

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

function showScorePopup(amount: number): void {
  scorePopupEl.textContent = formatScorePopup(amount);
  scorePopupEl.classList.remove("animate");
  void scorePopupEl.offsetWidth;
  scorePopupEl.classList.add("animate");
}

function showComboBadge(count: number): void {
  audio.play("combo", { comboCount: count });
  comboBadgeEl.textContent = `COMBO ×${count}`;
  comboBadgeEl.classList.remove("animate");
  void comboBadgeEl.offsetWidth;
  comboBadgeEl.classList.add("animate");
  canvas.style.boxShadow = "0 0 30px 8px #f59e0b";
  setTimeout(() => {
    canvas.style.boxShadow = "";
  }, 300);
}

const trophyToastQueue: string[] = [];
let trophyToastTimer: ReturnType<typeof setTimeout> | null = null;

function drainTrophyToastQueue(): void {
  const id = trophyToastQueue.shift();
  if (id === undefined) { trophyToastTimer = null; return; }
  const def = getTrophyDef(id);
  if (!def) { drainTrophyToastQueue(); return; }
  trophyToastEl.textContent = `${def.icon} ${def.name}！`;
  trophyToastEl.classList.remove("animate");
  void trophyToastEl.offsetWidth;
  trophyToastEl.classList.add("animate");
  trophyToastTimer = setTimeout(() => {
    trophyToastEl.classList.remove("animate");
    drainTrophyToastQueue();
  }, 2200);
}

function showTrophyToast(id: string): void {
  trophyToastQueue.push(id);
  if (trophyToastTimer === null) drainTrophyToastQueue();
}

function renderTrophyModal(): void {
  trophyModalListEl.innerHTML = "";
  const sections = loadModalData();

  for (const section of sections) {
    const header = document.createElement("li");
    header.className = "tm-category-header";
    header.textContent = section.categoryLabel;
    trophyModalListEl.appendChild(header);

    for (const group of section.groups) {
      const li = document.createElement("li");

      if (group.type === "single") {
        const { def, unlocked } = group.single!;
        li.className = `tm-single${unlocked ? "" : " locked"}`;
        li.innerHTML = `<span class="tm-single-ico">${def.icon}</span><div class="tm-single-body"><strong>${def.name}</strong><small>${def.description}</small></div>`;
      } else if (group.beyondDiamond) {
        li.className = "tm-prog-row";
        li.innerHTML = `
          <div class="tm-prog-top">
            <span class="tm-prog-label">${group.label}</span>
            <span class="tm-beyond-count">${group.beyondDisplay ?? ""}</span>
          </div>
          <div class="tm-medals">
            ${group.tiers!.map((t) => `<div class="tm-tier"><span class="tm-ico">${t.def.icon}</span></div>`).join("")}
            <span class="tm-beyond-tag">全數解鎖 ✦</span>
          </div>
          <div class="tm-bar"><div class="tm-fill tm-fill-cyan" style="width:100%"></div></div>
          <div class="tm-beyond-sub">${group.beyondSubDisplay ?? ""}</div>
        `;
      } else {
        const pct = Math.min(100, ((group.progressValue ?? 0) / (group.progressCeiling ?? 1)) * 100);
        li.className = "tm-prog-row";
        li.innerHTML = `
          <div class="tm-prog-top">
            <span class="tm-prog-label">${group.label}</span>
            <span class="tm-prog-val">${group.progressDisplay ?? ""}</span>
          </div>
          <div class="tm-medals">
            ${group.tiers!.map((t, i) => `
              <div class="tm-tier${t.unlocked ? "" : " locked"}">
                <span class="tm-ico">${t.def.icon}</span>
                <span class="tm-thr">${group.thresholdDisplays?.[i] ?? ""}</span>
              </div>`).join("")}
          </div>
          <div class="tm-bar"><div class="tm-fill tm-fill-purple" style="width:${pct.toFixed(1)}%"></div></div>
        `;
      }

      trophyModalListEl.appendChild(li);
    }
  }
}

function tick(): void {
  const now = performance.now();
  let stillAnimating = false;

  if (eliminationPhase !== null) {
    const elapsed = now - eliminationPhase.startTime;
    const total = totalElimMs(eliminationPhase.groups.length);
    if (elapsed < total) {
      stillAnimating = true;
    } else {
      eliminationPhase = null;
      recompactCells.clear();
      finalizeDeferredSlide();
      stillAnimating = true; // spawn animation follows
    }
  }

  spawnCells.forEach((startTime, key) => {
    if (startTime > now) {
      stillAnimating = true;
    } else if (now - startTime >= SPAWN_DURATION_MS) {
      spawnCells.delete(key);
    } else {
      stillAnimating = true;
    }
  });

  moveCells.forEach((data, key) => {
    if (now - data.startTime >= MOVE_DURATION_MS) {
      moveCells.delete(key);
    } else {
      stillAnimating = true;
    }
  });

  render();

  if (stillAnimating) {
    animationFrameId = requestAnimationFrame(tick);
  } else {
    animationFrameId = null;
  }
}

function startAnimationLoop(): void {
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(tick);
  }
}

function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;

  if (isGameOver(state.grid)) return;
  if (eliminationPhase !== null) return;

  const outcome = slide(state.grid, direction);
  if (!outcome.moved) return;

  const prevGrid = state.grid;
  const postSlideGrid = outcome.grid;
  const scoreGained = outcome.scoreGained;
  const eliminatedPairs = outcome.eliminatedPairs;

  state = { grid: postSlideGrid, score: state.score + scoreGained };

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

  updateHudScore();

  if (scoreGained > 0) {
    audio.play("eliminate");
    showScorePopup(scoreGained);
  } else {
    audio.play("move");
  }

  audio.play("spawn");

  if (eliminatedPairs.length >= 2) {
    setTimeout(() => showComboBadge(eliminatedPairs.length), 300);
  }

  if (eliminatedPairs.length > 0) {
    const oldElim = loadLifetimeElim();
    const newElim = oldElim + eliminatedPairs.length;
    localStorage.setItem(LIFETIME_ELIM_KEY, String(newElim));
    const bombs = computeEliminationAward(oldElim, newElim);
    if (bombs > 0) {
      powerups.bomb += bombs;
      savePowerups();
      renderHudPowerups();
    }

    const now = performance.now();
    eliminationPhase = buildElimPhaseState(eliminatedPairs, prevGrid, direction, now);
    spawnPending = true;

    recompactCells.clear();
    for (const sc of eliminationPhase.survivorCells) {
      recompactCells.set(`${sc.finalRow},${sc.finalCol}`, {
        origRow: sc.origRow,
        origCol: sc.origCol,
        firstCompactRow: sc.firstCompactRow,
        firstCompactCol: sc.firstCompactCol,
      });
    }
    spawnCells.clear();
    moveCells.clear();

    (window as unknown as {
      __lastAnimationHints: {
        eliminatedPairs: EliminatedPair[];
        spawnedCell: { row: number; col: number } | null;
        movedCells: Array<{ row: number; col: number }>;
        comboCount: number;
      };
    }).__lastAnimationHints = {
      eliminatedPairs,
      spawnedCell: null,
      movedCells: [],
      comboCount: eliminatedPairs.length,
    };

    startAnimationLoop();
  } else {
    const newGrid = spawnRandomTile(postSlideGrid, rng);
    state = { ...state, grid: newGrid };

    const spawnedList = changedCells(postSlideGrid, newGrid).filter(
      ({ row, col }) => newGrid[row][col] !== null && postSlideGrid[row][col] === null,
    );
    const spawnedKeys = new Set(spawnedList.map(({ row, col }) => `${row},${col}`));
    const allChanged = changedCells(prevGrid, newGrid);
    const movedList = allChanged.filter(({ row, col }) => {
      const key = `${row},${col}`;
      return !spawnedKeys.has(key) && newGrid[row][col] !== null;
    });

    spawnCells.clear();
    moveCells.clear();
    spawnedList.forEach(({ row, col }) => {
      spawnCells.set(`${row},${col}`, performance.now() + SPAWN_DELAY_MS);
    });
    movedList.forEach(({ row, col }) => {
      moveCells.set(`${row},${col}`, { startTime: performance.now(), direction });
    });

    if (isGameOver(newGrid)) {
      setTimeout(() => audio.play("gameOver"), 400);
      const gameOverTrophies = checkTrophies({ type: "gameOver", score: state.score });
      gameOverTrophies.forEach((id) => showTrophyToast(id));
    }

    (window as unknown as {
      __lastAnimationHints: {
        eliminatedPairs: EliminatedPair[];
        spawnedCell: { row: number; col: number } | null;
        movedCells: Array<{ row: number; col: number }>;
        comboCount: number;
      };
    }).__lastAnimationHints = {
      eliminatedPairs: [],
      spawnedCell: spawnedList[0] ?? null,
      movedCells: movedList,
      comboCount: 0,
    };

    startAnimationLoop();
  }

  const newlyUnlockedTrophies = checkTrophies({
    type: "slide",
    grid: state.grid,
    comboCount: eliminatedPairs.length,
  });
  newlyUnlockedTrophies.forEach((id) => showTrophyToast(id));
}

window.addEventListener("keydown", handleKeydown);

paletteToggleEl.addEventListener("click", () => {
  currentPalette = nextPalette(currentPalette);
  localStorage.setItem(PALETTE_KEY, currentPalette);
  render();
});

document.addEventListener("click", () => {
  document.querySelectorAll<HTMLElement>("[data-tooltip-open]").forEach(
    (el) => { delete el.dataset.tooltipOpen; },
  );
});

// ── Touch swipe ──────────────────────────────────────────────────────────────
let activePowerup: PowerupId | null = null;
let touchStart: { x: number; y: number } | null = null;
const SWIPE_MIN_PX = 30;

canvas.addEventListener(
  "touchstart",
  (e) => {
    if (activePowerup !== null) return;
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  },
  { passive: true },
);

canvas.addEventListener(
  "touchend",
  (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;

    if (activePowerup !== null) {
      const rect = canvas.getBoundingClientRect();
      const cs = canvas.width / GRID_SIZE;
      const col = Math.floor((e.changedTouches[0].clientX - rect.left) / cs);
      const row = Math.floor((e.changedTouches[0].clientY - rect.top) / cs);
      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        const id = activePowerup;
        activePowerup = null;
        canvas.style.outline = "";
        switch (id) {
          case "hammer":  applyHammer(row, col); break;
          case "addOne":  applyAddOne(row, col); break;
          case "bomb":    applyBomb(row, col); break;
          case "shuffle": applyShuffle(); break;
        }
      }
      return;
    }

    if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) return;
    const direction: Direction =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up";
    handleKeydown(new KeyboardEvent("keydown", { key: direction === "up" ? "ArrowUp" : direction === "down" ? "ArrowDown" : direction === "left" ? "ArrowLeft" : "ArrowRight" }));
  },
  { passive: true },
);

canvas.addEventListener("click", (e) => {
  if (activePowerup === null) return;
  const rect = canvas.getBoundingClientRect();
  const cs = canvas.width / GRID_SIZE;
  const col = Math.floor((e.clientX - rect.left) / cs);
  const row = Math.floor((e.clientY - rect.top) / cs);
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;

  const id = activePowerup;
  activePowerup = null;
  canvas.style.outline = "";

  switch (id) {
    case "hammer":  applyHammer(row, col); break;
    case "addOne":  applyAddOne(row, col); break;
    case "bomb":    applyBomb(row, col); break;
    case "shuffle": applyShuffle(); break;
  }
});

// ── Responsive resize ─────────────────────────────────────────────────────────
function resizeCanvas(): void {
  const available = Math.min(
    window.innerWidth - CANVAS_PADDING,
    window.innerHeight - HUD_HEIGHT - CANVAS_PADDING,
  );
  const size = Math.min(available, CANVAS_MAX);
  canvas.width = size;
  canvas.height = size;
  render();
}

window.addEventListener("resize", resizeCanvas);

function setState(newState: GameState): void {
  state = newState;
  eliminationPhase = null;
  spawnPending = false;
  recompactCells.clear();
  spawnCells.clear();
  moveCells.clear();
  trophyToastQueue.length = 0;
  if (trophyToastTimer !== null) {
    clearTimeout(trophyToastTimer);
    trophyToastTimer = null;
    trophyToastEl.classList.remove("animate");
  }

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

  if (newState.score === 0) {
    const newCount = loadPlayCount() + 1;
    localStorage.setItem(PLAY_COUNT_KEY, String(newCount));
    const award = computePlayCountAward(newCount);
    if (award) {
      powerups[award]++;
      savePowerups();
    }
  }

  updateHudScore();
  render();
}

playAgainEl.addEventListener("click", () => {
  setState(createInitialState(GRID_SIZE, rng));
});

(window as unknown as { __getGameState: () => GameState }).__getGameState = () => state;

(window as unknown as {
  __setTestState: (s: GameState, testRng?: Rng) => void;
}).__setTestState = (s, testRng) => {
  if (testRng) rng = testRng;
  setState(s);
};

(window as unknown as { __getCurrentPalette: () => PaletteId }).__getCurrentPalette = () =>
  currentPalette;

(window as unknown as { __setPowerups: (p: PowerupState) => void }).__setPowerups = (p) => {
  powerups = p;
  renderHudPowerups();
};

(window as unknown as { __setLifetimeElim: (n: number) => void }).__setLifetimeElim = (n) => {
  localStorage.setItem(LIFETIME_ELIM_KEY, String(n));
};

updateMuteButton();
updateHudScore();
renderHudPowerups();
resizeCanvas();
