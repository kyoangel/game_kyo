// workspace/src/game.ts
import {
  createInitialState,
  applyMove,
  isGameOver,
  type Direction,
  type GameState,
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
const ANIMATION_DURATION_MS = 150;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const gameOverEl = document.getElementById("game-over") as HTMLDivElement;
const gameOverScoreEl = document.getElementById("game-over-score") as HTMLParagraphElement;
const gameOverBestEl = document.getElementById("game-over-best") as HTMLParagraphElement;
const gameOverBadgeEl = document.getElementById("game-over-badge") as HTMLParagraphElement;
const playAgainEl = document.getElementById("play-again") as HTMLButtonElement;
const paletteToggleEl = document.getElementById("palette-toggle") as HTMLButtonElement;
const scorePopupEl = document.getElementById("score-popup") as HTMLDivElement;

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
const animatingCells = new Map<string, number>();
let animationFrameId: number | null = null;

function render(progress: Map<string, number> = new Map()): void {
  const cellSize = canvas.width / GRID_SIZE;
  const padding = 4;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  state.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const x = colIndex * cellSize;
      const y = rowIndex * cellSize;

      ctx.strokeStyle = "#444";
      ctx.strokeRect(x, y, cellSize, cellSize);

      if (cell !== null) {
        const colors = PALETTES[currentPalette][cell];
        const rawProgress = progress.get(`${rowIndex},${colIndex}`);
        const scale = rawProgress === undefined ? 1 : 1 - Math.pow(1 - rawProgress, 2);
        const centerX = x + cellSize / 2;
        const centerY = y + cellSize / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.translate(-centerX, -centerY);

        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
        ctx.fill();

        ctx.fillStyle = colors.text;
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(cell), centerX, centerY);

        ctx.restore();
      }
    });
  });

  ctx.fillStyle = "#fff";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Score: ${state.score}`, 10, 20);
  ctx.fillText(`Best: ${bestScore}`, 10, 45);

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
  // Force a reflow so re-adding "animate" restarts the CSS animation.
  void scorePopupEl.offsetWidth;
  scorePopupEl.classList.add("animate");
}

function tick(): void {
  const now = performance.now();
  const progress = new Map<string, number>();
  let stillAnimating = false;

  animatingCells.forEach((startTime, key) => {
    const elapsed = now - startTime;
    if (elapsed >= ANIMATION_DURATION_MS) {
      animatingCells.delete(key);
    } else {
      progress.set(key, elapsed / ANIMATION_DURATION_MS);
      stillAnimating = true;
    }
  });

  render(progress);

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

function setState(newState: GameState): void {
  const prevState = state;
  const scoreGained = newState.score - prevState.score;
  state = newState;

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

  if (scoreGained > 0) {
    showScorePopup(scoreGained);
  }

  const diff = changedCells(prevState.grid, state.grid);
  if (diff.length > 0) {
    const now = performance.now();
    diff.forEach(({ row, col }) => {
      animatingCells.set(`${row},${col}`, now);
    });
    startAnimationLoop();
  } else {
    render();
  }
}

function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;

  setState(applyMove(state, direction, rng));
}

window.addEventListener("keydown", handleKeydown);

paletteToggleEl.addEventListener("click", () => {
  currentPalette = nextPalette(currentPalette);
  localStorage.setItem(PALETTE_KEY, currentPalette);
  render();
});

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

render();
