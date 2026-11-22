export interface TitleExtrasContext {
  width: number;
  height: number;
  /** Y just under the best-score line. */
  below: number;
  /** Top edge of the first menu button. */
  menuTop: number;
  /** Bottom edge of the last menu button (menuTop when the menu is empty). */
  menuBottom: number;
}

export function titleLayout(width: number, height: number, menuCount: number): TitleExtrasContext {
  const menuTop = height * 0.72 - 36;
  const menuBottom = menuCount <= 0 ? menuTop : height * 0.72 + (menuCount - 1) * 96 + 36;
  return { width, height, below: height * 0.62 + 36, menuTop, menuBottom };
}
