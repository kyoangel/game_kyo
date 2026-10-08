import { describe, it, expect } from "vitest";
import { ENEMIES } from "../../../src/adventure/enemies";
import { drawEnemyArt } from "../../../src/adventure/enemyArt";
import { fakeCanvas } from "../fakeCanvas";

describe("drawEnemyArt", () => {
  it.each(ENEMIES.map((e) => [e.id, e.shape, e.color] as const))(
    "%s (%s) draws something without throwing",
    (_id, shape, color) => {
      const { ctx, calls } = fakeCanvas(96);
      expect(() => drawEnemyArt(ctx, shape, color, 96, 1234)).not.toThrow();
      expect(calls.filter((c) => ["fill", "stroke"].includes(c.op)).length).toBeGreaterThan(0);
      expect(calls[0].op).toBe("save");
      expect(calls[calls.length - 1].op).toBe("restore");
    },
  );

  it("covers all 9 distinct shapes", () => {
    expect(new Set(ENEMIES.map((e) => e.shape)).size).toBe(9);
  });

  it("uses the enemy colour for its body", () => {
    const { ctx, calls } = fakeCanvas(96);
    drawEnemyArt(ctx, "circle", "#86efac", 96);
    expect(calls.find((c) => c.op === "fill")?.fillStyle).toBe("#86efac");
  });
});
