import { describe, it, expect } from "vitest";
import { slide, type GameGrid } from "../../src/grid";
import {
  buildElimPhaseState,
  c2StartMs,
  totalElimMs,
  MOVE_DURATION_MS,
} from "../../src/boardRenderer";

describe("elimination timing helpers", () => {
  it("c2StartMs = one move phase + one highlight/fade slot (600ms) per group", () => {
    expect(c2StartMs(0)).toBe(MOVE_DURATION_MS);
    expect(c2StartMs(1)).toBe(750);
    expect(c2StartMs(2)).toBe(1350);
  });

  it("totalElimMs adds the second compaction move after c2Start", () => {
    expect(totalElimMs(1)).toBe(900);
    expect(totalElimMs(2)).toBe(1500);
  });
});

describe("buildElimPhaseState", () => {
  it("one pair sliding left produces one phantom group and no survivors", () => {
    const grid: GameGrid = [
      [9, 1, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "left");
    const phase = buildElimPhaseState(outcome.eliminatedPairs, grid, "left", 1234);

    expect(phase.startTime).toBe(1234);
    expect(phase.survivorCells).toEqual([]);
    expect(phase.groups).toHaveLength(1);
    expect(phase.groups[0].groupIndex).toBe(0);
    expect(phase.groups[0].tiles).toEqual([
      { origRow: 0, origCol: 0, firstCompactRow: 0, firstCompactCol: 0, value: 9 },
      { origRow: 0, origCol: 1, firstCompactRow: 0, firstCompactCol: 1, value: 1 },
    ]);
  });

  it("tracks survivors through both compaction passes: [3,9,1,5] left", () => {
    const grid: GameGrid = [
      [3, 9, 1, 5],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "left");
    const phase = buildElimPhaseState(outcome.eliminatedPairs, grid, "left", 0);

    expect(phase.survivorCells).toEqual([
      { origRow: 0, origCol: 0, firstCompactRow: 0, firstCompactCol: 0, finalRow: 0, finalCol: 0 },
      { origRow: 0, origCol: 3, firstCompactRow: 0, firstCompactCol: 3, finalRow: 0, finalCol: 1 },
    ]);
  });

  it("mirrors indices for a right slide: [5,9,1,3] right", () => {
    const grid: GameGrid = [
      [5, 9, 1, 3],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "right");
    const phase = buildElimPhaseState(outcome.eliminatedPairs, grid, "right", 0);

    expect(phase.survivorCells).toEqual([
      { origRow: 0, origCol: 3, firstCompactRow: 0, firstCompactCol: 3, finalRow: 0, finalCol: 3 },
      { origRow: 0, origCol: 0, firstCompactRow: 0, firstCompactCol: 0, finalRow: 0, finalCol: 2 },
    ]);
  });
});
