import { test, expect } from "@playwright/test";

test("apple-touch-icon link is present in head", async ({ page }) => {
  await page.goto("/");
  const href = await page.evaluate(() => {
    const el = document.querySelector(
      'link[rel="apple-touch-icon"]'
    ) as HTMLLinkElement | null;
    return el?.href ?? null;
  });
  expect(href).toMatch(/apple-touch-icon\.png$/);
});

test("apple-mobile-web-app meta tags are present", async ({ page }) => {
  await page.goto("/");
  const capable = await page.evaluate(() =>
    document
      .querySelector('meta[name="apple-mobile-web-app-capable"]')
      ?.getAttribute("content")
  );
  const title = await page.evaluate(() =>
    document
      .querySelector('meta[name="apple-mobile-web-app-title"]')
      ?.getAttribute("content")
  );
  expect(capable).toBe("yes");
  expect(title).toBe("Math Merge 10");
});

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const BASE = "http://localhost:5173/game_kyo/merge10/";

test("iOS hint appears on first iOS visit after 2 seconds", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: IOS_UA, baseURL: BASE });
  const page = await ctx.newPage();
  await ctx.addInitScript(() => localStorage.removeItem("iosHintShown"));
  await page.goto("/");
  await page.waitForTimeout(2500);
  await expect(page.locator("#ios-hint")).toBeVisible();
  await ctx.close();
});

test("iOS hint does not appear when already shown", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: IOS_UA, baseURL: BASE });
  const page = await ctx.newPage();
  await ctx.addInitScript(() => localStorage.setItem("iosHintShown", "1"));
  await page.goto("/");
  await page.waitForTimeout(2500);
  await expect(page.locator("#ios-hint")).not.toBeVisible();
  await ctx.close();
});

test("iOS hint does not appear on desktop browser", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("iosHintShown"));
  await page.goto("/");
  await page.waitForTimeout(2500);
  await expect(page.locator("#ios-hint")).not.toBeVisible();
});

test("iOS hint dismisses on click", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: IOS_UA, baseURL: BASE });
  const page = await ctx.newPage();
  await ctx.addInitScript(() => localStorage.removeItem("iosHintShown"));
  await page.goto("/");
  await page.waitForTimeout(2500);
  await page.locator("#ios-hint").click();
  await expect(page.locator("#ios-hint")).not.toBeVisible();
  await ctx.close();
});
