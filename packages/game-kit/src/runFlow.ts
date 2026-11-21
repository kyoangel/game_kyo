/** Phaser-free per-run decision logic (revive is offered at most once per run). */
export class RunFlow {
  private reviveUsed = false;

  reset(): void {
    this.reviveUsed = false;
  }

  canOfferRevive(hasReviveCb: boolean, rewardedAds: boolean): boolean {
    return hasReviveCb && rewardedAds && !this.reviveUsed;
  }

  markReviveUsed(): void {
    this.reviveUsed = true;
  }
}
