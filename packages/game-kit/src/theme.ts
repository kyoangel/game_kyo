export interface Theme {
  bgTop: number;
  bgBottom: number;
  primary: number;
  accent: number;
  danger: number;
  text: number;
  muted: number;
  font: string;
}

export const DEFAULT_THEME: Theme = {
  bgTop: 0x2b1d7a,
  bgBottom: 0x7a2fb0,
  primary: 0x3ff0ff,
  accent: 0xffe14d,
  danger: 0xff4fa3,
  text: 0xffffff,
  muted: 0xc9b8ff,
  font: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
};

export function resolveTheme(partial?: Partial<Theme>): Theme {
  return { ...DEFAULT_THEME, ...partial };
}

/** CSS background for the page around the canvas (letterbox bars on 16:9 portals): the game gradient, dimmed. */
export function pageBackground(theme: Theme): string {
  return `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)), linear-gradient(${cssColor(theme.bgTop)}, ${cssColor(theme.bgBottom)})`;
}

export function cssColor(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}
