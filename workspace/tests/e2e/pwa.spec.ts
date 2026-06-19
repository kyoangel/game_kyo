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
