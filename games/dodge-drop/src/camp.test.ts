import { describe, expect, it } from 'vitest';
import { CAMP_RADIUS, CAMP_RETRY, CAMP_SECONDS, CampTracker, campBlockX, CAMP_BLOCK_W } from './camp.ts';

describe('CampTracker', () => {
  it('fires after CAMP_SECONDS standing still, then again after another CAMP_SECONDS', () => {
    const c = new CampTracker();
    let fired = 0;
    for (let i = 0; i < Math.round((CAMP_SECONDS * 2) / 0.1) + 1; i++) if (c.update(30, 0.1)) fired++;
    expect(fired).toBe(2);
  });

  it('small wiggles inside CAMP_RADIUS still count as camping', () => {
    const c = new CampTracker();
    let fired = false;
    for (let i = 0; i < CAMP_SECONDS / 0.1 + 1; i++) fired = c.update(300 + (i % 2 ? CAMP_RADIUS - 1 : 0), 0.1) || fired;
    expect(fired).toBe(true);
  });

  it('moving past CAMP_RADIUS restarts the count', () => {
    const c = new CampTracker();
    for (let i = 0; i < (CAMP_SECONDS - 0.5) / 0.1; i++) expect(c.update(100, 0.1)).toBe(false);
    expect(c.update(100 + CAMP_RADIUS + 1, 0.1)).toBe(false);
    for (let i = 0; i < (CAMP_SECONDS - 0.5) / 0.1; i++) expect(c.update(100 + CAMP_RADIUS + 1, 0.1)).toBe(false);
  });

  it('retrySoon fires again after CAMP_RETRY', () => {
    const c = new CampTracker();
    let t = 0;
    while (!c.update(50, 0.05)) t += 0.05;
    c.retrySoon();
    let wait = 0;
    while (!c.update(50, 0.05)) wait += 0.05;
    expect(wait).toBeGreaterThan(CAMP_RETRY - 0.1);
    expect(wait).toBeLessThan(CAMP_RETRY + 0.1);
  });

  it('reset clears the count', () => {
    const c = new CampTracker();
    for (let i = 0; i < (CAMP_SECONDS - 0.2) / 0.1; i++) c.update(10, 0.1);
    c.reset();
    expect(c.update(10, 0.3)).toBe(false);
  });
});

describe('campBlockX', () => {
  it('centres on the player and stays inside the field at the walls', () => {
    expect(campBlockX(360, 720)).toBe(360);
    expect(campBlockX(10, 720)).toBe(CAMP_BLOCK_W / 2);
    expect(campBlockX(715, 720)).toBe(720 - CAMP_BLOCK_W / 2);
  });
});
