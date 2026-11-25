/**
 * Anti-camping: a player who stays inside CAMP_RADIUS for CAMP_SECONDS gets one telegraphed block
 * aimed at their spot, so hugging a wall without moving stops being a free long run.
 */
export const CAMP_SECONDS = 3;
/** Movement smaller than this (px, logic field) still counts as standing still. */
export const CAMP_RADIUS = 40;
/** When an aimed block was refused (it would make the field unsurvivable), try again this much later. */
export const CAMP_RETRY = 0.5;
/** Aimed block width: wide enough that a small sidestep does not clear it. */
export const CAMP_BLOCK_W = 130;

export class CampTracker {
  private anchor: number | null = null;
  private still = 0;

  /** Feed the player x each frame; returns true when an aimed block is due. */
  update(x: number, dt: number): boolean {
    if (this.anchor === null || Math.abs(x - this.anchor) > CAMP_RADIUS) {
      this.anchor = x;
      this.still = 0;
      return false;
    }
    this.still += dt;
    if (this.still < CAMP_SECONDS) return false;
    this.still = 0;
    return true;
  }

  /** The due block could not be placed: fire again after CAMP_RETRY if the player is still there. */
  retrySoon(): void {
    this.still = CAMP_SECONDS - CAMP_RETRY;
  }

  reset(): void {
    this.anchor = null;
    this.still = 0;
  }
}

/** Centre x of the aimed block: on the player, clamped so the block stays inside the field. */
export function campBlockX(playerX: number, width: number): number {
  const half = CAMP_BLOCK_W / 2;
  return Math.min(width - half, Math.max(half, playerX));
}
