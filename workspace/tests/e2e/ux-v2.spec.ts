import { test, expect } from "@playwright/test";

test("F1: #hud footer contains score, best, palette toggle, and mute button", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#hud-score")).toBeVisible();
  await expect(page.locator("#hud-best")).toBeVisible();
  await expect(page.locator("#hud-palette-toggle")).toBeVisible();
  await expect(page.locator("#hud-mute")).toBeVisible();
});
