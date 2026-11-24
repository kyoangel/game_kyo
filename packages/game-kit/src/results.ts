export interface ResultsContext {
  score: number;
  best: number;
  newBest: boolean;
  top: number;
  rewardedAds: boolean;
  /** Centre X of the area the results hook should lay out in (landscape: the right-hand column). Defaults to the canvas centre. */
  cx?: number;
  /** True on a landscape canvas, where the hook gets a column instead of the full width. */
  landscape?: boolean;
}
