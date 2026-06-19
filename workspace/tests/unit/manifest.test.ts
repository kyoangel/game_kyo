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

describe("manifest.json icons", () => {
  it("has 3 icon entries", () => {
    expect((manifest as any).icons).toHaveLength(3);
  });

  it("has a 192x192 PNG icon", () => {
    const icons = (manifest as any).icons as Array<{ src: string; sizes: string; type: string }>;
    const icon = icons.find((i: { sizes: string }) => i.sizes === "192x192");
    expect(icon).toBeDefined();
    expect(icon!.type).toBe("image/png");
    expect(icon!.src).toContain("icon-192.png");
  });

  it("has a 512x512 PNG icon", () => {
    const icons = (manifest as any).icons as Array<{ src: string; sizes: string; type: string }>;
    const icon = icons.find((i: { sizes: string }) => i.sizes === "512x512");
    expect(icon).toBeDefined();
    expect(icon!.type).toBe("image/png");
    expect(icon!.src).toContain("icon-512.png");
  });
});
