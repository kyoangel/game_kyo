import { describe, it, expect } from "vitest";
import { STONE, slide, type Direction, type GameGrid } from "../../src/grid";
import {
  BoardRenderer,
  ZERO_TILE_COLORS,
  buildElimPhaseState,
  canAnimateElimination,
} from "../../src/boardRenderer";
import { fakeCanvas, type Call } from "./fakeCanvas";

function makeRenderer() {
  const { canvas, calls } = fakeCanvas();
  const renderer = new BoardRenderer({ canvas, gridSize: 4, getPalette: () => "pairHint" });
  return { renderer, calls };
}

const texts = (calls: Call[]) => calls.filter((c) => c.op === "fillText").map((c) => c.args[0]);

function grid(rows: Array<Array<number | null>>): GameGrid {
  const g: GameGrid = Array.from({ length: 4 }, () => [null, null, null, null]);
  rows.forEach((row, r) => row.forEach((v, c) => (g[r][c] = v)));
  return g;
}

describe("BoardRenderer draws the adventure-only cells", () => {
  it("draws a 0 tile with the dull colours and a '0'", () => {
    const { renderer, calls } = makeRenderer();
    expect(() => renderer.draw(grid([[0]]), 0)).not.toThrow();
    expect(texts(calls)).toEqual(["0"]);
    expect(calls.some((c) => c.op === "fill" && c.fillStyle === ZERO_TILE_COLORS.bg)).toBe(true);
  });

  it("draws a stone without any text (never the raw value -1)", () => {
    const { renderer, calls } = makeRenderer();
    expect(() => renderer.draw(grid([[STONE, 5]]), 0)).not.toThrow();
    expect(texts(calls)).toEqual(["5"]);
  });

  it("ordinary 1-9 tiles draw exactly as before: one number each, no overlay", () => {
    const { renderer, calls } = makeRenderer();
    renderer.draw(grid([[1, 9], [4, 6]]), 0);
    expect(texts(calls)).toEqual(["1", "9", "4", "6"]);
  });
});

describe("frozen overlay", () => {
  it("draws the remaining turns on a frozen cell that holds a tile", () => {
    const { renderer, calls } = makeRenderer();
    renderer.setFrozenCells([{ row: 0, col: 1, turns: 2 }]);
    renderer.draw(grid([[3, 7]]), 0);
    expect(texts(calls)).toEqual(["3", "7", "❄2"]);
  });

  it("skips frozen cells that are empty or hidden, and clearing removes the overlay", () => {
    const { renderer, calls } = makeRenderer();
    renderer.setFrozenCells([{ row: 2, col: 2, turns: 3 }]);
    renderer.draw(grid([[3]]), 0);
    expect(texts(calls)).toEqual(["3"]);
    renderer.setFrozenCells([]);
    renderer.draw(grid([[3, 7]]), 0);
    expect(texts(calls)).toEqual(["3", "3", "7"]);
  });
});

describe("canAnimateElimination", () => {
  it("is true only while nothing is frozen", () => {
    expect(canAnimateElimination(0)).toBe(true);
    expect(canAnimateElimination(1)).toBe(false);
  });
});

describe("the elimination animation matches slide() on boards with stones and 0s (no freezes)", () => {
  function seeded(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  it("every survivor's animated end cell holds the same tile in the real post-slide grid", () => {
    const rng = seeded(2024);
    const directions: Direction[] = ["left", "right", "up", "down"];
    const values = [null, null, 0, STONE, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    let checkedBoards = 0;
    for (let n = 0; n < 400; n++) {
      const board: GameGrid = Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, () => values[Math.floor(rng() * values.length)]),
      );
      for (const direction of directions) {
        const outcome = slide(board, direction);
        if (outcome.eliminatedPairs.length === 0) continue;
        checkedBoards += 1;
        const phase = buildElimPhaseState(outcome.eliminatedPairs, board, direction, 0);
        phase.survivorCells.forEach((s) => {
          expect(outcome.grid[s.finalRow][s.finalCol]).toBe(board[s.origRow][s.origCol]);
        });
        const occupiedAfter = outcome.grid.flat().filter((c) => c !== null).length;
        expect(phase.survivorCells.length).toBe(occupiedAfter);
      }
    }
    expect(checkedBoards).toBeGreaterThan(100);
  });
});
