/** True when the platform wants a fullscreen toggle and the browser (iframe permissions included) supports it. */
export function fullscreenAvailable(feature: boolean, doc: { fullscreenEnabled?: boolean } | undefined): boolean {
  return feature && doc?.fullscreenEnabled === true;
}
