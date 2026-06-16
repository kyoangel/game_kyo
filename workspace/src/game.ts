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
import { formatScorePopup } from "./scoring";

const GRID_SIZE = 4;
const BEST_SCORE_KEY = "mathMerge10BestScore";
const PALETTE_KEY = "mathMerge10Palette";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const gameOverEl = document.getElementById("game-over") as HTMLDivElement;
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

function render(): void {
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

        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
        ctx.fill();

        ctx.fillStyle = colors.text;
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(cell), x + cellSize / 2, y + cellSize / 2);
      }
    });
  });

  ctx.fillStyle = "#fff";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Score: ${state.score}`, 10, 20);
  ctx.fillText(`Best: ${bestScore}`, 10, 45);

  gameOverEl.hidden = !isGameOver(state.grid);
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

function setState(newState: GameState): void {
  const scoreGained = newState.score - state.score;
  state = newState;

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

  if (scoreGained > 0) {
    showScorePopup(scoreGained);
  }

  render();
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
