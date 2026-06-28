/**
 * AC-7: Battle — pause menu
 * Pause button opens an overlay with Resume, Restart, and Abandon options.
 * Resuming must not lose game state (battle state is unchanged).
 * Restart and Abandon are destructive actions (BUTTON_DANGER variant).
 */
import { describe, it, expect } from 'vitest';
import { createPauseMenuOptions, PauseMenuAction } from '../../src/ui/pauseMenu';

describe('createPauseMenuOptions', () => {
  it('returns exactly 3 options', () => {
    expect(createPauseMenuOptions()).toHaveLength(3);
  });

  it('first option is Resume (繼續)', () => {
    const opts = createPauseMenuOptions();
    expect(opts[0].action).toBe(PauseMenuAction.Resume);
  });

  it('second option is Restart (重新開始)', () => {
    const opts = createPauseMenuOptions();
    expect(opts[1].action).toBe(PauseMenuAction.Restart);
  });

  it('third option is Abandon (放棄任務)', () => {
    const opts = createPauseMenuOptions();
    expect(opts[2].action).toBe(PauseMenuAction.Abandon);
  });

  it('Restart option uses the danger variant', () => {
    const opts = createPauseMenuOptions();
    expect(opts[1].variant).toBe('danger');
  });

  it('Abandon option uses the danger variant', () => {
    const opts = createPauseMenuOptions();
    expect(opts[2].variant).toBe('danger');
  });

  it('Resume option does NOT use the danger variant', () => {
    const opts = createPauseMenuOptions();
    expect(opts[0].variant).not.toBe('danger');
  });

  it('every option has a non-empty label', () => {
    const opts = createPauseMenuOptions();
    expect(opts.every(o => typeof o.label === 'string' && o.label.length > 0)).toBe(true);
  });
});

describe('pause overlay appearance', () => {
  it('overlay background alpha is 0.7', async () => {
    const { PAUSE_OVERLAY_ALPHA } = await import('../../src/ui/pauseMenu');
    expect(PAUSE_OVERLAY_ALPHA).toBe(0.7);
  });

  it('overlay background color is black (0x000000)', async () => {
    const { PAUSE_OVERLAY_COLOR } = await import('../../src/ui/pauseMenu');
    expect(PAUSE_OVERLAY_COLOR).toBe(0x000000);
  });
});
