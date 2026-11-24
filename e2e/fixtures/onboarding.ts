import type { Page } from '@playwright/test';

/** Marks the first-run tutorial as done so clean-run assertions are not covered by it. Key = platform prefix `gk:` + save slug prefix + `onboarding`. */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('gk:dodge-drop:onboarding', JSON.stringify({ shown: 2, completed: true }));
  });
}
