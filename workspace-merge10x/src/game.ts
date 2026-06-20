import {
  createInitialState,
  slide,
  spawnRandomTile,
  isGameOver,
  type Direction,
  type GameState,
  type GameGrid,
  type Rng,
  type EliminatedGroup,
  type SlideOutcome,
} from "./grid";
import { formatScorePopup, isNewRecord } from "./scoring";
import { AudioEngine } from "./audio";
import { checkTrophies, loadModalData, getTrophyDef } from "./trophies";

// ── Constants ──────────────────────────────────────────────────────────────────
const SIZE_KEY = "merge10xGridSize";
const MATCH_LIMIT_KEY = "merge10xMatchLimit";
const BEST_SCORE_KEY_4 = "merge10xBestScore4";
const BEST_SCORE_KEY_5 = "merge10xBestScore5";
const PLAY_COUNT_KEY = "merge10xPlayCount";
const SPAWN_DELAY_MS = 350;
const SPAWN_DURATION_MS = 400;
const MOVE_DURATION_MS = 150;
const ELIM_HIGHLIGHT_MS = 400;
const ELIM_FADE_MS = 200;
const CANVAS_PADDING = 24;
const HUD_HEIGHT = 70;
const CANVAS_MAX = 520;
const SWIPE_MIN_PX = 30;

const TILE_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: "#1d4ed8", text: "#fff" },
  2: { bg: "#7c3aed", text: "#fff" },
  3: { bg: "#db2777", text: "#fff" },
  4: { bg: "#dc2626", text: "#fff" },
  5: { bg: "#d97706", text: "#fff" },
  6: { bg: "#65a30d", text: "#fff" },
  7: { bg: "#0d9488", text: "#fff" },
  8: { bg: "#0369a1", text: "#fff" },
  9: { bg: "#475569", text: "#fff" },
};

// ── DOM refs ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const sizePickerEl = document.getElementById("size-picker") as HTMLDivElement;
const sizeStepEl = document.getElementById("size-step") as HTMLDivElement;
const matchStepEl = document.getElementById("match-step") as HTMLDivElement;
const gameOverEl = document.getElementById("game-over") as HTMLDivElement;
const gameOverScoreEl = document.getElementById("game-over-score") as HTMLParagraphElement;
const gameOverBestEl = document.getElementById("game-over-best") as HTMLParagraphElement;
const gameOverBadgeEl = document.getElementById("game-over-badge") as HTMLParagraphElement;
const playAgainEl = document.getElementById("play-again") as HTMLButtonElement;
const changeSizeEl = document.getElementById("change-size") as HTMLButtonElement;
const hudScoreEl = document.getElementById("hud-score") as HTMLSpanElement;
const hudBestEl = document.getElementById("hud-best") as HTMLSpanElement;
const hudMuteEl = document.getElementById("hud-mute") as HTMLButtonElement;
const hudTrophyEl = document.getElementById("hud-trophy") as HTMLButtonElement;
const trophyModalEl = document.getElementById("trophy-modal") as HTMLDivElement;
const trophyModalOverlayEl = document.getElementById("trophy-modal-overlay") as HTMLDivElement;
const trophyModalCloseEl = document.getElementById("trophy-modal-close") as HTMLButtonElement;
const trophyModalListEl = document.getElementById("trophy-modal-list") as HTMLUListElement;
const trophyToastEl = document.getElementById("trophy-toast") as HTMLDivElement;
const scorePopupEl = document.getElementById("score-popup") as HTMLDivElement;
const comboBadgeEl = document.getElementById("combo-badge") as HTMLDivElement;

const audio = new AudioEngine();

// ── Persistence helpers ────────────────────────────────────────────────────────
function loadGridSize(): 4 | 5 {
  return localStorage.getItem(SIZE_KEY) === "4" ? 4 : 5;
}

function saveGridSize(size: 4 | 5): void {
  localStorage.setItem(SIZE_KEY, String(size));
}

function loadMatchLimit(): 2 | 3 | 4 {
  const v = localStorage.getItem(MATCH_LIMIT_KEY);
  if (v === "3") return 3;
  if (v === "4") return 4;
  return 2;
}

function saveMatchLimit(limit: 2 | 3 | 4): void {
  localStorage.setItem(MATCH_LIMIT_KEY, String(limit));
}

function bestScoreKey(size: 4 | 5): string {
  return size === 4 ? BEST_SCORE_KEY_4 : BEST_SCORE_KEY_5;
}

function loadBestScore(size: 4 | 5): number {
  const v = Number(localStorage.getItem(bestScoreKey(size)));
  return Number.isFinite(v) ? v : 0;
}

function saveBestScore(size: 4 | 5, score: number): void {
  localStorage.setItem(bestScoreKey(size), String(score));
}

function loadPlayCount(): number {
  return parseInt(localStorage.getItem(PLAY_COUNT_KEY) ?? "0", 10);
}

// ── Game state ─────────────────────────────────────────────────────────────────
let gridSize: 4 | 5 = loadGridSize();
let matchLimit: 2 | 3 | 4 = loadMatchLimit();
let state: GameState = createInitialState(gridSize);
let rng: Rng = Math.random;
let bestScore: number = loadBestScore(gridSize);
let pendingSize: 4 | 5 | null = null;

// ── Animation state ────────────────────────────────────────────────────────────
const spawnCells = new Map<string, number>();
const moveCells = new Map<string, { startTime: number; direction: Direction }>();
let animationFrameId: number | null = null;

interface PhantomTile {
  origRow: number;
  origCol: number;
  firstCompactRow: number;
  firstCompactCol: number;
  value: number;
}

interface PhantomGroup {
  tiles: PhantomTile[];
  firstCompactedStart: number;
  length: 2 | 3 | 4;
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
let deferredSlideOutcome: {
  outcome: SlideOutcome;
  prevScore: number;
} | null = null;
const recompactCells = new Map<string, RecompactCell>();

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
  eliminatedGroups: EliminatedGroup[],
  originalGrid: GameGrid,
  outcome: SlideOutcome,
  direction: Direction,
  startTime: number,
): ElimPhaseState {
  const size = originalGrid.length;
  const isVertical = direction === "up" || direction === "down";
  const isReverse = direction === "right" || direction === "down";

  const eliminatedSet = new Set(
    eliminatedGroups.flatMap((g) => g.positions.map((p) => `${p.row},${p.col}`)),
  );

  const groups: PhantomGroup[] = eliminatedGroups.map((g, groupIndex) => ({
    tiles: g.positions.map(({ row, col }, k) => {
      // "right"/"down" positions are in reverse spatial order; ki compensates
      const ki = isReverse ? (g.length - 1 - k) : k;
      return {
        origRow: row,
        origCol: col,
        firstCompactRow: isVertical ? g.firstCompactedStart + ki : row,
        firstCompactCol: isVertical ? col : g.firstCompactedStart + ki,
        value: originalGrid[row][col] as number,
      };
    }),
    firstCompactedStart: g.firstCompactedStart,
    length: g.length,
    direction,
    groupIndex,
  }));

  const survivorCells: SurvivorCell[] = [];

  for (let lineIdx = 0; lineIdx < size; lineIdx++) {
    const positions: number[] = isReverse
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    let fcIdx = 0;
    let finalIdx = 0;

    for (const pos of positions) {
      const origRow = isVertical ? pos : lineIdx;
      const origCol = isVertical ? lineIdx : pos;

      if (originalGrid[origRow][origCol] === null) continue;

      const isElim = eliminatedSet.has(`${origRow},${origCol}`);

      if (!isElim) {
        let fcRow: number, fcCol: number, finalRow: number, finalCol: number;
        if (isVertical) {
          fcRow = isReverse ? size - 1 - fcIdx : fcIdx;
          fcCol = lineIdx;
          finalRow = isReverse ? size - 1 - finalIdx : finalIdx;
          finalCol = lineIdx;
        } else {
          fcRow = lineIdx;
          fcCol = isReverse ? size - 1 - fcIdx : fcIdx;
          finalRow = lineIdx;
          finalCol = isReverse ? size - 1 - finalIdx : finalIdx;
        }
        survivorCells.push({ origRow, origCol, firstCompactRow: fcRow, firstCompactCol: fcCol, finalRow, finalCol });
        finalIdx++;
      }
      fcIdx++;
    }
  }

  return { groups, startTime, survivorCells };
}

function finalizeDeferredSlide(): void {
  if (!deferredSlideOutcome) return;
  const { outcome, prevScore } = deferredSlideOutcome;
  deferredSlideOutcome = null;

  const postSlideGrid = outcome.grid;
  const newGrid = spawnRandomTile(postSlideGrid, rng);
  const spawnedCells = changedCells(postSlideGrid, newGrid).filter(
    ({ row, col }) => newGrid[row][col] !== null && postSlideGrid[row][col] === null,
  );

  const newScore = prevScore + outcome.scoreGained;
  state = { grid: newGrid, score: newScore };
  if (state.score > bestScore) { bestScore = state.score; saveBestScore(gridSize, bestScore); }
  updateHudScore();

  if (isGameOver(newGrid, matchLimit)) {
    showGameOver(prevScore);
  }

  spawnCells.clear();
  spawnedCells.forEach(({ row, col }) => {
    spawnCells.set(`${row},${col}`, performance.now() + SPAWN_DELAY_MS);
  });
}

// ── Rendering ──────────────────────────────────────────────────────────────────
function drawTile(value: number, x: number, y: number, cellSize: number): void {
  const colors = TILE_COLORS[value] ?? { bg: "#374151", text: "#fff" };
  const padding = gridSize === 5 ? 3 : 4;
  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
  ctx.fill();
  ctx.fillStyle = colors.text;
  ctx.font = `${gridSize === 5 ? 22 : 30}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), x + cellSize / 2, y + cellSize / 2);
}

function drawPhantomTile(value: number, x: number, y: number, cellSize: number, alpha: number, scale: number): void {
  const cx = x + cellSize / 2, cy = y + cellSize / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
  const padding = gridSize === 5 ? 3 : 4;
  ctx.fillStyle = "#fde047";
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#422006";
  ctx.font = `${gridSize === 5 ? 22 : 30}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), x + cellSize / 2, y + cellSize / 2);
  ctx.restore();
}


function render(): void {
  const cellSize = canvas.width / gridSize;
  const now = performance.now();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      ctx.strokeStyle = "#333";
      ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
    }
  }

  state.grid.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      if (cell === null) return;
      const key = `${ri},${ci}`;
      const x = ci * cellSize;
      const y = ri * cellSize;

      if (spawnCells.has(key)) {
        const startTime = spawnCells.get(key)!;
        const elapsed = now - startTime;
        if (elapsed < 0) return;
        const t = Math.min(1, elapsed / SPAWN_DURATION_MS);
        let dy: number, scale: number, opacity: number;
        if (t <= 0.5) {
          const p = t / 0.5;
          dy = lerp(-40, 4, p); scale = lerp(0.4, 1.05, p); opacity = p;
        } else {
          const p = (t - 0.5) / 0.5;
          dy = lerp(4, 0, p); scale = lerp(1.05, 1.0, p); opacity = 1;
        }
        const cx = x + cellSize / 2, cy = y + dy + cellSize / 2;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
        drawTile(cell, x, y + dy, cellSize);
        ctx.restore();
      } else if (moveCells.has(key)) {
        const { startTime, direction } = moveCells.get(key)!;
        const t = Math.min(1, (now - startTime) / MOVE_DURATION_MS);
        const p = 1 - Math.pow(1 - t, 2);
        const scale = lerp(0.7, 1.0, p);
        const offset = lerp(12, 0, p);
        let dx = 0, dy = 0;
        if (direction === "left") dx = offset;
        else if (direction === "right") dx = -offset;
        else if (direction === "up") dy = offset;
        else dy = -offset;
        const cx = x + dx + cellSize / 2, cy = y + dy + cellSize / 2;
        ctx.save();
        ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
        drawTile(cell, x + dx, y + dy, cellSize);
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
          drawX = lerp(rc.firstCompactCol * cellSize, ci * cellSize, p);
          drawY = lerp(rc.firstCompactRow * cellSize, ri * cellSize, p);
        }
        drawTile(cell, drawX, drawY, cellSize);
      } else {
        drawTile(cell, x, y, cellSize);
      }
    });
  });

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
          // Waiting for this group's turn: stay visible at firstCompact in normal tile color
          drawTile(tile.value, fcX, fcY, cellSize);
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
}

function tick(): void {
  const now = performance.now();
  let stillAnimating = false;

  spawnCells.forEach((startTime, key) => {
    if (startTime > now || now - startTime < SPAWN_DURATION_MS) {
      stillAnimating = true;
    } else {
      spawnCells.delete(key);
    }
  });

  moveCells.forEach((data, key) => {
    if (now - data.startTime < MOVE_DURATION_MS) {
      stillAnimating = true;
    } else {
      moveCells.delete(key);
    }
  });

  if (eliminationPhase !== null) {
    const elapsed = now - eliminationPhase.startTime;
    const total = totalElimMs(eliminationPhase.groups.length);
    if (elapsed < total) {
      stillAnimating = true;
    } else {
      eliminationPhase = null;
      recompactCells.clear();
      finalizeDeferredSlide();
      stillAnimating = true;
    }
  }

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

function changedCells(prev: GameGrid, next: GameGrid): Array<{ row: number; col: number }> {
  const result: Array<{ row: number; col: number }> = [];
  prev.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell !== next[r][c]) result.push({ row: r, col: c });
    });
  });
  return result;
}

// ── HUD ────────────────────────────────────────────────────────────────────────
function updateHudScore(): void {
  hudScoreEl.textContent = `Score: ${state.score}`;
  hudBestEl.textContent = `Best: ${bestScore}`;
}

function updateMuteButton(): void {
  hudMuteEl.textContent = audio.isMuted ? "🔇" : "🔊";
}

// ── Trophy UI ──────────────────────────────────────────────────────────────────
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
      } else {
        const pct = Math.min(100, ((group.progressValue ?? 0) / (group.progressCeiling ?? 1)) * 100);
        li.className = "tm-prog-row";
        li.innerHTML = `
          <div class="tm-prog-top"><span class="tm-prog-label">${group.label}</span><span class="tm-prog-val">${group.progressDisplay ?? ""}</span></div>
          <div class="tm-medals">${(group.tiers ?? []).map((t, i) => `<div class="tm-tier${t.unlocked ? "" : " locked"}"><span class="tm-ico">${t.def.icon}</span><span class="tm-thr">${group.thresholdDisplays?.[i] ?? ""}</span></div>`).join("")}</div>
          <div class="tm-bar"><div class="tm-fill" style="width:${pct.toFixed(1)}%"></div></div>
        `;
      }
      trophyModalListEl.appendChild(li);
    }
  }
}

// ── Score popup / combo ────────────────────────────────────────────────────────
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
  setTimeout(() => { canvas.style.boxShadow = ""; }, 300);
}

// ── Size + match selection ─────────────────────────────────────────────────────
function startGame(size: 4 | 5, limit: 2 | 3 | 4): void {
  gridSize = size;
  saveGridSize(size);
  matchLimit = limit;
  saveMatchLimit(limit);
  bestScore = loadBestScore(size);
  state = createInitialState(gridSize, rng);
  spawnCells.clear();
  moveCells.clear();
  eliminationPhase = null;
  deferredSlideOutcome = null;
  recompactCells.clear();
  pendingSize = null;
  sizeStepEl.removeAttribute("hidden");
  matchStepEl.setAttribute("hidden", "");
  sizePickerEl.setAttribute("hidden", "");
  gameOverEl.setAttribute("hidden", "");
  updateHudScore();
  resizeCanvas();
}

// ── Move handler ───────────────────────────────────────────────────────────────
function showGameOver(prevScore: number): void {
  gameOverScoreEl.textContent = `本次分數：${state.score}`;
  gameOverBestEl.textContent = `最高分：${bestScore}`;
  gameOverBadgeEl.classList.toggle("hidden", !isNewRecord(state.score, prevScore > bestScore ? prevScore : bestScore));
  gameOverEl.removeAttribute("hidden");
  setTimeout(() => audio.play("gameOver"), 400);
  const gameOverTrophies = checkTrophies({ type: "gameOver", score: state.score });
  gameOverTrophies.forEach((id) => showTrophyToast(id));
}

function handleMove(direction: Direction): void {
  if (isGameOver(state.grid, matchLimit)) return;
  if (eliminationPhase !== null) return;

  const outcome = slide(state.grid, direction, matchLimit);
  if (!outcome.moved) return;

  const originalGrid = state.grid;
  const { scoreGained } = outcome;
  const groups = outcome.eliminatedGroups;

  audio.play(groups.length > 0 ? "eliminate" : "move");
  audio.play("spawn");

  if (groups.length > 0) {
    showScorePopup(scoreGained);
    if (groups.length >= 2) {
      setTimeout(() => showComboBadge(groups.length), 300);
    }
  }

  const slideTrophies = checkTrophies({
    type: "slide",
    postSlideGrid: outcome.grid,
    eliminatedGroups: groups,
  });
  slideTrophies.forEach((id) => showTrophyToast(id));

  if (groups.length === 0) {
    // No eliminations: existing immediate behavior
    const postSlideGrid = outcome.grid;
    const newGrid = spawnRandomTile(postSlideGrid, rng);
    const spawnedCells = changedCells(postSlideGrid, newGrid).filter(
      ({ row, col }) => newGrid[row][col] !== null && postSlideGrid[row][col] === null,
    );
    const spawnedKeys = new Set(spawnedCells.map(({ row, col }) => `${row},${col}`));
    const allChanged = changedCells(originalGrid, newGrid);
    const movedTiles = allChanged.filter(({ row, col }) => {
      const key = `${row},${col}`;
      return !spawnedKeys.has(key) && newGrid[row][col] !== null;
    });

    const prevScore = state.score;
    state = { grid: newGrid, score: state.score + scoreGained };
    if (state.score > bestScore) { bestScore = state.score; saveBestScore(gridSize, bestScore); }
    updateHudScore();

    if (isGameOver(newGrid, matchLimit)) {
      showGameOver(prevScore);
    }

    spawnCells.clear();
    moveCells.clear();
    spawnedCells.forEach(({ row, col }) => {
      spawnCells.set(`${row},${col}`, performance.now() + SPAWN_DELAY_MS);
    });
    movedTiles.forEach(({ row, col }) => {
      moveCells.set(`${row},${col}`, { startTime: performance.now(), direction });
    });
    startAnimationLoop();
    return;
  }

  // Eliminations exist: set up phantom animation, defer spawn + score
  const postSlideGrid = outcome.grid;
  state = { grid: postSlideGrid, score: state.score };

  const startTime = performance.now();
  const phaseState = buildElimPhaseState(groups, originalGrid, outcome, direction, startTime);
  eliminationPhase = phaseState;
  deferredSlideOutcome = { outcome, prevScore: state.score };

  recompactCells.clear();
  for (const sc of phaseState.survivorCells) {
    recompactCells.set(`${sc.finalRow},${sc.finalCol}`, {
      origRow: sc.origRow,
      origCol: sc.origCol,
      firstCompactRow: sc.firstCompactRow,
      firstCompactCol: sc.firstCompactCol,
    });
  }

  spawnCells.clear();
  moveCells.clear();

  startAnimationLoop();
}

// ── Input handling ─────────────────────────────────────────────────────────────
const KEY_MAP: Record<string, Direction> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
};

window.addEventListener("keydown", (e: KeyboardEvent) => {
  const dir = KEY_MAP[e.key];
  if (dir) handleMove(dir);
});

let touchStart: { x: number; y: number } | null = null;

canvas.addEventListener("touchstart", (e) => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

canvas.addEventListener("touchend", (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) return;
  const dir: Direction = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? "right" : "left")
    : (dy > 0 ? "down" : "up");
  handleMove(dir);
}, { passive: true });

// ── Event listeners ────────────────────────────────────────────────────────────
hudMuteEl.addEventListener("click", () => { audio.toggleMute(); updateMuteButton(); });
hudTrophyEl.addEventListener("click", () => { renderTrophyModal(); trophyModalEl.removeAttribute("hidden"); });
trophyModalOverlayEl.addEventListener("click", () => trophyModalEl.setAttribute("hidden", ""));
trophyModalCloseEl.addEventListener("click", () => trophyModalEl.setAttribute("hidden", ""));

document.querySelectorAll<HTMLButtonElement>(".size-btn:not(.match-btn)").forEach((btn) => {
  btn.addEventListener("click", () => {
    pendingSize = Number(btn.dataset.size) as 4 | 5;
    sizeStepEl.setAttribute("hidden", "");
    matchStepEl.removeAttribute("hidden");
  });
});

document.querySelectorAll<HTMLButtonElement>(".match-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (pendingSize === null) return;
    const limit = Number(btn.dataset.match) as 2 | 3 | 4;
    startGame(pendingSize, limit);
  });
});

playAgainEl.addEventListener("click", () => {
  const newCount = loadPlayCount() + 1;
  localStorage.setItem(PLAY_COUNT_KEY, String(newCount));
  startGame(gridSize, matchLimit);
  const playTrophies = checkTrophies({ type: "gameStart", playCount: newCount });
  playTrophies.forEach((id) => showTrophyToast(id));
});

changeSizeEl.addEventListener("click", () => {
  gameOverEl.setAttribute("hidden", "");
  pendingSize = null;
  sizeStepEl.removeAttribute("hidden");
  matchStepEl.setAttribute("hidden", "");
  sizePickerEl.removeAttribute("hidden");
});

// ── Responsive resize ──────────────────────────────────────────────────────────
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

// ── E2E test hooks ─────────────────────────────────────────────────────────────
(window as unknown as { __getGameState: () => GameState }).__getGameState = () => state;
(window as unknown as { __getGridSize: () => number }).__getGridSize = () => gridSize;
(window as unknown as { __setTestState: (s: GameState, rngFn?: Rng) => void }).__setTestState = (s, rngFn) => {
  if (rngFn) rng = rngFn;
  state = s;
  spawnCells.clear();
  moveCells.clear();
  eliminationPhase = null;
  deferredSlideOutcome = null;
  recompactCells.clear();
  gameOverEl.setAttribute("hidden", "");
  updateHudScore();
  render();
};

// ── Init ───────────────────────────────────────────────────────────────────────
updateMuteButton();
updateHudScore();
// Show size picker if no size stored yet; otherwise go straight to game
if (!localStorage.getItem(SIZE_KEY)) {
  sizePickerEl.removeAttribute("hidden");
} else {
  sizePickerEl.setAttribute("hidden", "");
  resizeCanvas();
}
