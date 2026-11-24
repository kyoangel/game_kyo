import { isLandscape } from './ui/landscape.ts';

export interface TitleColumn { x0: number; x1: number }

export interface TitleExtrasContext {
  width: number;
  height: number;
  /** Y just under the best-score line. */
  below: number;
  /** Top edge of the first menu button. */
  menuTop: number;
  /** Bottom edge of the last menu button (menuTop when the menu is empty). */
  menuBottom: number;
  /** True on a landscape canvas: extras go in the side columns instead of stacking under the menu. */
  landscape: boolean;
  /** Centres of the title, tap prompt and best-score lines. */
  titleY: number;
  tapY: number;
  bestY: number;
  /** Centre Y of the first menu button and the centre-to-centre step. */
  menuY0: number;
  menuStep: number;
  menuButtonW: number;
  menuButtonH: number;
  /** Side columns for extras (landscape); in portrait both span the full width. */
  left: TitleColumn;
  right: TitleColumn;
  /** Vertical band the extras may use (landscape side columns). */
  extrasTop: number;
  extrasBottom: number;
}

const MARGIN = 24;

export function titleLayout(width: number, height: number, menuCount: number): TitleExtrasContext {
  if (isLandscape(width, height)) {
    const menuButtonH = 88;
    const menuStep = menuButtonH + 16;
    const menuTop = height * 0.53; // keeps the exact canvas centre free, so a tap there starts the run
    const menuBottom = menuCount <= 0 ? menuTop : menuTop + (menuCount - 1) * menuStep + menuButtonH;
    return {
      width, height, landscape: true,
      titleY: height * 0.2, tapY: height * 0.34, bestY: height * 0.415,
      below: height * 0.415 + 36, menuTop, menuBottom, menuY0: menuTop + menuButtonH / 2, menuStep,
      menuButtonW: 360, menuButtonH,
      left: { x0: MARGIN, x1: width * 0.34 }, right: { x0: width * 0.66, x1: width - MARGIN },
      extrasTop: height * 0.16, extrasBottom: height - MARGIN,
    };
  }
  const menuTop = height * 0.72 - 36;
  const menuBottom = menuCount <= 0 ? menuTop : height * 0.72 + (menuCount - 1) * 96 + 36;
  return {
    width, height, landscape: false,
    titleY: height * 0.3, tapY: height * 0.55, bestY: height * 0.62,
    below: height * 0.62 + 36, menuTop, menuBottom, menuY0: height * 0.72, menuStep: 96,
    menuButtonW: 280, menuButtonH: 72,
    left: { x0: 6, x1: width - 6 }, right: { x0: 6, x1: width - 6 },
    extrasTop: height * 0.62 + 36, extrasBottom: height,
  };
}
