import {
  createInitialState,
  applyMove,
  isGameOver,
  type Direction,
  type GameState,
  type Rng,
} from "./grid";

const GRID_SIZE = 4;
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const gameOverEl = document.getElementById("game-over") as HTMLDivElement;

let state: GameState = createInitialState(GRID_SIZE);
let rng: Rng = Math.random;

function render(): void {
  const cellSize = canvas.width / GRID_SIZE;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  state.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const x = colIndex * cellSize;
      const y = rowIndex * cellSize;

      ctx.strokeStyle = "#444";
      ctx.strokeRect(x, y, cellSize, cellSize);

      if (cell !== null) {
        ctx.fillStyle = "#4ade80";
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

function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;

  state = applyMove(state, direction, rng);
  render();
}

window.addEventListener("keydown", handleKeydown);

(window as unknown as { __getGameState: () => GameState }).__getGameState = () => state;

(window as unknown as {
  __setTestState: (s: GameState, testRng?: Rng) => void;
}).__setTestState = (s, testRng) => {
  state = s;
  if (testRng) rng = testRng;
  render();
};

render();
