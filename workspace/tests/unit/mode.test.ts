import { describe, it, expect, afterEach, vi } from "vitest";
import { getScreen, setScreen } from "../../src/mode";

describe("screen mode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setScreen("endless");
  });

  it("defaults to endless so the page behaves as before until main.ts decides", () => {
    expect(getScreen()).toBe("endless");
  });

  it("setScreen updates the value and mirrors it into body[data-screen]", () => {
    const body = { dataset: {} as Record<string, string> };
    vi.stubGlobal("document", { body });
    setScreen("adventure");
    expect(getScreen()).toBe("adventure");
    expect(body.dataset.screen).toBe("adventure");
    setScreen("menu");
    expect(body.dataset.screen).toBe("menu");
  });

  it("works without a DOM", () => {
    expect(() => setScreen("menu")).not.toThrow();
    expect(getScreen()).toBe("menu");
  });
});
