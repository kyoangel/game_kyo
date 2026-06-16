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

const GRID_SIZE = 4;
const BEST_SCORE_KEY = "mathMerge10BestScore";
const PALETTE_KEY = "mathMerge10Palette";
const ELIMINATE_DURATION_MS = 350;
const MOVE_DURATION_MS = 150;
const SPAWN_DELAY_MS = 350;
const SPAWN_DURATION_MS = 400;

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

let state: GameState = createInitialState(GRID_SIZE);
let rng: Rng = Math.random;
let bestScore = loadBestScore();
let currentPalette: PaletteId = loadPalette();

// eliminatingCells: phantom tiles no longer in state.grid
const eliminatingCells = new Map<string, { value: number; startTime: number }>();
// spawnCells: start time for the newly spawned tile (may be future)
const spawnCells = new Map<string, number>();
// moveCells: tiles that slid to a new position
const moveCells = new Map<string, { startTime: number; direction: Direction }>();

let animationFrameId: number | null = null;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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

  // Draw elimination phantoms on top (cells now null in state.grid)
  eliminatingCells.forEach(({ value, startTime }, key) => {
    const [rowIndex, colIndex] = key.split(",").map(Number);
    const x = colIndex * cellSize;
    const y = rowIndex * cellSize;
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / ELIMINATE_DURATION_MS);

    const T1 = 60 / ELIMINATE_DURATION_MS;
    const T2 = 200 / ELIMINATE_DURATION_MS;
    if (t >= T2) return;

    let scale: number;
    let opacity: number;
    let flashAlpha: number;

    if (t < T1) {
      const p = t / T1;
      scale = 1 + 0.15 * p;
      flashAlpha = 0.5 * p;
      opacity = 1;
    } else {
      const p = (t - T1) / (T2 - T1);
      scale = 1.15 * (1 - p);
      flashAlpha = 0.5 * (1 - p);
      opacity = 1 - p;
    }

    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.shadowColor = "#facc15";
    ctx.shadowBlur = 40 * flashAlpha;
    drawBaseTile(value, x, y, cellSize, padding, flashAlpha);
    ctx.restore();
  });

  const gameOver = isGameOver(state.grid);
  gameOverEl.hidden = !gameOver;
  if (gameOver) {
    gameOverScoreEl.textContent = `本次分數：${state.score}`;
    gameOverBestEl.textContent = `最高分：${bestScore}`;
    gameOverBadgeEl.classList.toggle("hidden", !isNewRecord(state.score, bestScore));
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
  comboBadgeEl.textContent = `COMBO ×${count}`;
  comboBadgeEl.classList.remove("animate");
  void comboBadgeEl.offsetWidth;
  comboBadgeEl.classList.add("animate");
  canvas.style.boxShadow = "0 0 30px 8px #f59e0b";
  setTimeout(() => {
    canvas.style.boxShadow = "";
  }, 300);
}

function tick(): void {
  const now = performance.now();
  let stillAnimating = false;

  eliminatingCells.forEach((data, key) => {
    if (now - data.startTime >= ELIMINATE_DURATION_MS) {
      eliminatingCells.delete(key);
    } else {
      stillAnimating = true;
    }
  });

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

function startAnimations(
  prevGrid: GameGrid,
  eliminatedPairs: EliminatedPair[],
  spawnedCells: Array<{ row: number; col: number }>,
  movedCellsList: Array<{ row: number; col: number }>,
  direction: Direction,
): void {
  const now = performance.now();

  eliminatingCells.clear();
  spawnCells.clear();
  moveCells.clear();

  eliminatedPairs.forEach(({ a, b }) => {
    const valA = prevGrid[a.row][a.col];
    const valB = prevGrid[b.row][b.col];
    if (valA !== null) eliminatingCells.set(`${a.row},${a.col}`, { value: valA, startTime: now });
    if (valB !== null) eliminatingCells.set(`${b.row},${b.col}`, { value: valB, startTime: now });
  });

  spawnedCells.forEach(({ row, col }) => {
    spawnCells.set(`${row},${col}`, now + SPAWN_DELAY_MS);
  });

  movedCellsList.forEach(({ row, col }) => {
    moveCells.set(`${row},${col}`, { startTime: now, direction });
  });
}

function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;

  if (isGameOver(state.grid)) return;

  const outcome = slide(state.grid, direction);
  if (!outcome.moved) return;

  const prevGrid = state.grid;
  const postSlideGrid = outcome.grid;
  const newGrid = spawnRandomTile(postSlideGrid, rng);
  const scoreGained = outcome.scoreGained;

  const spawnedCells = changedCells(postSlideGrid, newGrid);

  const eliminatedPositionKeys = new Set(
    outcome.eliminatedPairs.flatMap((p) => [
      `${p.a.row},${p.a.col}`,
      `${p.b.row},${p.b.col}`,
    ])
  );
  const spawnedKeys = new Set(spawnedCells.map((c) => `${c.row},${c.col}`));
  const allChanged = changedCells(prevGrid, newGrid);
  const movedCells = allChanged.filter((c) => {
    const key = `${c.row},${c.col}`;
    return (
      !eliminatedPositionKeys.has(key) &&
      !spawnedKeys.has(key) &&
      newGrid[c.row][c.col] !== null
    );
  });

  state = { grid: newGrid, score: state.score + scoreGained };

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

  updateHudScore();

  if (scoreGained > 0) {
    showScorePopup(scoreGained);
  }

  const eliminatedPairs = outcome.eliminatedPairs;

  (window as unknown as {
    __lastAnimationHints: {
      eliminatedPairs: EliminatedPair[];
      spawnedCell: { row: number; col: number } | null;
      movedCells: Array<{ row: number; col: number }>;
      comboCount: number;
    };
  }).__lastAnimationHints = {
    eliminatedPairs,
    spawnedCell: spawnedCells[0] ?? null,
    movedCells,
    comboCount: eliminatedPairs.length,
  };

  if (eliminatedPairs.length >= 2) {
    setTimeout(() => showComboBadge(eliminatedPairs.length), 300);
  }

  startAnimations(prevGrid, eliminatedPairs, spawnedCells, movedCells, direction);
  startAnimationLoop();
}

window.addEventListener("keydown", handleKeydown);

paletteToggleEl.addEventListener("click", () => {
  currentPalette = nextPalette(currentPalette);
  localStorage.setItem(PALETTE_KEY, currentPalette);
  render();
});

function setState(newState: GameState): void {
  state = newState;
  eliminatingCells.clear();
  spawnCells.clear();
  moveCells.clear();

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
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

updateHudScore();
render();
