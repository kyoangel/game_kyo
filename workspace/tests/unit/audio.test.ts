import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioEngine } from "../../src/audio";

function makeMockCtx(state?: "suspended" | "running" | "closed") {
  const mockGain = {
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  const mockOsc = {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    type: "sine" as OscillatorType,
    frequency: {
      value: 440,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
  };
  return {
    state: state || "running",
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => mockOsc),
    createGain: vi.fn(() => mockGain),
    resume: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AudioEngine", () => {
  beforeEach(() => {
    const ctx = makeMockCtx();
    vi.stubGlobal("AudioContext", vi.fn(() => ctx));
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  it("play('move') does not throw", () => {
    const engine = new AudioEngine();
    expect(() => engine.play("move")).not.toThrow();
  });

  it("play('eliminate') does not throw", () => {
    const engine = new AudioEngine();
    expect(() => engine.play("eliminate")).not.toThrow();
  });

  it("play('gameOver') does not throw", () => {
    const engine = new AudioEngine();
    expect(() => engine.play("gameOver")).not.toThrow();
  });

  it("play('combo', { comboCount: 3 }) does not throw", () => {
    const engine = new AudioEngine();
    expect(() => engine.play("combo", { comboCount: 3 })).not.toThrow();
  });

  it("toggleMute flips muted state", () => {
    const engine = new AudioEngine();
    expect(engine.isMuted).toBe(false);
    engine.toggleMute();
    expect(engine.isMuted).toBe(true);
    engine.toggleMute();
    expect(engine.isMuted).toBe(false);
  });

  it("play does not call AudioContext when muted", () => {
    const engine = new AudioEngine();
    engine.toggleMute();
    engine.play("move");
    expect(AudioContext).not.toHaveBeenCalled();
  });

  it("calls resume() when AudioContext is suspended", () => {
    const mockCtx = makeMockCtx("suspended");
    vi.stubGlobal("AudioContext", vi.fn(() => mockCtx));
    const engine = new AudioEngine();
    engine.play("move");
    expect(mockCtx.resume).toHaveBeenCalledOnce();
  });

  it("does not call resume() when AudioContext is already running", () => {
    const mockCtx = makeMockCtx("running");
    vi.stubGlobal("AudioContext", vi.fn(() => mockCtx));
    const engine = new AudioEngine();
    engine.play("move");
    expect(mockCtx.resume).not.toHaveBeenCalled();
  });
});
