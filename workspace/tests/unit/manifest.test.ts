import { describe, it, expect } from "vitest";
import manifest from "../../public/manifest.json";

describe("manifest.json navigation", () => {
  it("start_url is /game_kyo/merge10/", () => {
    expect((manifest as any).start_url).toBe("/game_kyo/merge10/");
  });

  it("scope is /game_kyo/merge10/", () => {
    expect((manifest as any).scope).toBe("/game_kyo/merge10/");
  });

  it("background_color is #111827", () => {
    expect((manifest as any).background_color).toBe("#111827");
  });

  it("theme_color is #1a1a2e", () => {
    expect((manifest as any).theme_color).toBe("#1a1a2e");
  });
});
