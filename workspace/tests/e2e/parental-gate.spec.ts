import { test, expect, Page } from "@playwright/test";

const SMALL = "com.kyoangel.mathmerge10.tip.small";

// Stub the native TipJar plugin before any page script runs, recording purchase calls.
async function stubTipJar(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__purchases = [];
    w.Capacitor = {
      Plugins: {
        TipJar: {
          getProducts: () => Promise.resolve({ products: [] }),
          purchase: (opts: { productId: string }) => {
            w.__purchases.push(opts.productId);
            return Promise.resolve({ success: true });
          },
        },
      },
    };
  });
}

async function openGate(page: Page) {
  await page.goto("/");
  await page.locator("#hud-powerup-info").click();
  await page.locator(`.tipjar-btn[data-product-id='${SMALL}']`).click();
  await expect(page.locator("#parental-gate")).toBeVisible();
}

async function answerCorrectly(page: Page) {
  const text = await page.locator("#parental-gate-question").innerText();
  const [, a, b] = text.match(/(\d+) × (\d+)/)!;
  await page.locator("#parental-gate-input").fill(String(Number(a) * Number(b)));
}

async function purchases(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__purchases);
}

test("correct parent answer starts the purchase with the tapped product", async ({ page }) => {
  await stubTipJar(page);
  await openGate(page);
  const text = await page.locator("#parental-gate-question").innerText();
  const [, a, b] = text.match(/(\d+) × (\d+)/)!;
  await page.locator("#parental-gate-input").fill(String(Number(a) * Number(b)));
  await page.locator("#parental-gate-ok").click();
  await expect(page.locator("#parental-gate")).toBeHidden();
  await expect.poll(() => purchases(page)).toEqual([SMALL]);
});

test("wrong answer closes the gate, shows a message, and does not purchase", async ({ page }) => {
  await stubTipJar(page);
  await openGate(page);
  await page.locator("#parental-gate-input").fill("1");
  await page.locator("#parental-gate-ok").click();
  await expect(page.locator("#parental-gate")).toBeHidden();
  await expect(page.locator("#tipjar-status")).toHaveText("答案不正確，已取消");
  await expect(page.locator("#tipjar-status")).toBeVisible();
  expect(await purchases(page)).toEqual([]);
});

test("cancel closes the gate without purchasing", async ({ page }) => {
  await stubTipJar(page);
  await openGate(page);
  await page.locator("#parental-gate-cancel").click();
  await expect(page.locator("#parental-gate")).toBeHidden();
  expect(await purchases(page)).toEqual([]);
});

test("web build without Capacitor keeps the tip jar hidden", async ({ page }) => {
  await page.goto("/");
  await page.locator("#hud-powerup-info").click();
  await expect(page.locator("#powerup-modal-tipjar")).toBeHidden();
});

test("gate is an accessible modal dialog with typed buttons", async ({ page }) => {
  await stubTipJar(page);
  await openGate(page);
  const gate = page.locator("#parental-gate");
  await expect(gate).toHaveAttribute("role", "dialog");
  await expect(gate).toHaveAttribute("aria-modal", "true");
  const labelId = await gate.getAttribute("aria-labelledby");
  expect(labelId).toBeTruthy();
  await expect(page.locator(`#${labelId}`)).toContainText("請家長作答");
  await expect(page.locator("#parental-gate-ok")).toHaveAttribute("type", "button");
  await expect(page.locator("#parental-gate-cancel")).toHaveAttribute("type", "button");
});

test("Enter key submits a correct answer for exactly one purchase", async ({ page }) => {
  await stubTipJar(page);
  await openGate(page);
  await answerCorrectly(page);
  await page.locator("#parental-gate-input").press("Enter");
  await expect(page.locator("#parental-gate")).toBeHidden();
  await expect.poll(() => purchases(page)).toEqual([SMALL]);
  await page.waitForTimeout(200);
  expect(await purchases(page)).toEqual([SMALL]);
});

test("double-clicking OK with a correct answer purchases exactly once", async ({ page }) => {
  await stubTipJar(page);
  await openGate(page);
  await answerCorrectly(page);
  await page.locator("#parental-gate-ok").dispatchEvent("click");
  await page.locator("#parental-gate-ok").dispatchEvent("click");
  await expect.poll(() => purchases(page)).toEqual([SMALL]);
  await page.waitForTimeout(200);
  expect(await purchases(page)).toEqual([SMALL]);
});

test("empty input does not purchase", async ({ page }) => {
  await stubTipJar(page);
  await openGate(page);
  await page.locator("#parental-gate-ok").click();
  await expect(page.locator("#parental-gate")).toBeHidden();
  expect(await purchases(page)).toEqual([]);
});

test("arrow keys typed in the gate input do not move the game grid", async ({ page }) => {
  await stubTipJar(page);
  await openGate(page);
  const grid = () => page.evaluate(() => JSON.stringify((window as any).__getGameState().grid));
  const before = await grid();
  const input = page.locator("#parental-gate-input");
  for (const k of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) await input.press(k);
  await page.waitForTimeout(300);
  expect(await grid()).toBe(before);
});

test("wrong answer blocks the gate for 30 seconds, then it reopens", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await stubTipJar(page);
  await openGate(page);
  await page.locator("#parental-gate-input").fill("1");
  await page.locator("#parental-gate-ok").click();
  const tip = page.locator(`.tipjar-btn[data-product-id='${SMALL}']`);
  await tip.click();
  await expect(page.locator("#parental-gate")).toBeHidden();
  await expect(page.locator("#tipjar-status")).toHaveText("請稍後再試（剩 30 秒）");
  await page.clock.fastForward(10_000);
  await tip.click();
  await expect(page.locator("#tipjar-status")).toHaveText("請稍後再試（剩 20 秒）");
  await page.clock.fastForward(20_000);
  await tip.click();
  await expect(page.locator("#parental-gate")).toBeVisible();
  expect(await purchases(page)).toEqual([]);
});

test("cancel does not start a cooldown", async ({ page }) => {
  await stubTipJar(page);
  await openGate(page);
  await page.locator("#parental-gate-cancel").click();
  await page.locator(`.tipjar-btn[data-product-id='${SMALL}']`).click();
  await expect(page.locator("#parental-gate")).toBeVisible();
});
