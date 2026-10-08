/**
 * Which top-level screen is showing. The endless game (game.ts) reads this to
 * ignore keystrokes while the menu or the adventure screen is up. It also
 * mirrors the value into `<body data-screen>` so CSS can hide/show the screens.
 * Default is "endless": until main.ts says otherwise the page behaves exactly
 * as it did before adventure mode existed.
 */
export type Screen = "menu" | "endless" | "adventure";

let current: Screen = "endless";

export function getScreen(): Screen {
  return current;
}

export function setScreen(screen: Screen): void {
  current = screen;
  if (typeof document !== "undefined" && document.body) document.body.dataset.screen = screen;
}
