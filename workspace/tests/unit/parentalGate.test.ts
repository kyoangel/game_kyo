import { describe, it, expect } from "vitest";
import { createGateQuestion, checkGateAnswer, createGateCooldown, GATE_COOLDOWN_MS } from "../../src/parentalGate";

describe("parental gate", () => {
  it("draws both operands from 6-9 across the whole rng range", () => {
    for (const r of [0, 0.24, 0.25, 0.5, 0.74, 0.99999]) {
      const q = createGateQuestion(() => r);
      expect(q.a).toBeGreaterThanOrEqual(6);
      expect(q.a).toBeLessThanOrEqual(9);
      expect(q.b).toBeGreaterThanOrEqual(6);
      expect(q.b).toBeLessThanOrEqual(9);
    }
  });

  it("maps rng 0 to 6 and rng just under 1 to 9", () => {
    expect(createGateQuestion(() => 0)).toMatchObject({ a: 6, b: 6, answer: 36 });
    expect(createGateQuestion(() => 0.999999)).toMatchObject({ a: 9, b: 9, answer: 81 });
  });

  it("produces a Traditional Chinese prompt with the operands", () => {
    const q = createGateQuestion(() => 0.5);
    expect(q.prompt).toBe(`請家長作答：${q.a} × ${q.b} = ?`);
  });

  it("accepts the correct answer, with surrounding whitespace", () => {
    const q = { a: 7, b: 8, answer: 56, prompt: "" };
    expect(checkGateAnswer(q, "56")).toBe(true);
    expect(checkGateAnswer(q, " 56 ")).toBe(true);
  });

  it("rejects wrong, empty, and non-numeric answers", () => {
    const q = { a: 7, b: 8, answer: 56, prompt: "" };
    expect(checkGateAnswer(q, "")).toBe(false);
    expect(checkGateAnswer(q, "55")).toBe(false);
    expect(checkGateAnswer(q, "abc")).toBe(false);
    expect(checkGateAnswer(q, "56abc")).toBe(false);
    expect(checkGateAnswer(q, "56.5")).toBe(false);
  });
});

describe("parental gate cooldown", () => {
  it("uses a 30 second cooldown", () => {
    expect(GATE_COOLDOWN_MS).toBe(30000);
  });

  it("is idle until a wrong answer is recorded", () => {
    const cd = createGateCooldown(() => 1000);
    expect(cd.remainingSeconds()).toBe(0);
  });

  it("counts down after a wrong answer, rounding partial seconds up", () => {
    let t = 1000;
    const cd = createGateCooldown(() => t);
    cd.recordWrong();
    expect(cd.remainingSeconds()).toBe(30);
    t += 1500;
    expect(cd.remainingSeconds()).toBe(29);
    t += 28499;
    expect(cd.remainingSeconds()).toBe(1);
  });

  it("ends exactly 30 seconds after the wrong answer", () => {
    let t = 0;
    const cd = createGateCooldown(() => t);
    cd.recordWrong();
    t = 30000;
    expect(cd.remainingSeconds()).toBe(0);
  });

  it("restarts the cooldown on a later wrong answer", () => {
    let t = 0;
    const cd = createGateCooldown(() => t);
    cd.recordWrong();
    t = 40000;
    cd.recordWrong();
    t = 50000;
    expect(cd.remainingSeconds()).toBe(20);
  });
});
