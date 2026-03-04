import type { GallopTheme } from '../types';

const PROP_MAP: Record<keyof GallopTheme, string> = {
  colorPrimary: '--gallop-color-primary',
  colorSecondary: '--gallop-color-secondary',
  colorText: '--gallop-color-text',
  colorBackground: '--gallop-color-background',
  colorBuffered: '--gallop-color-buffered',
  colorProgress: '--gallop-color-progress',
  controlBarBackground: '--gallop-control-bar-bg',
  controlBarHeight: '--gallop-control-bar-height',
  borderRadius: '--gallop-border-radius',
  fontFamily: '--gallop-font-family',
  fontSize: '--gallop-font-size',
  iconSize: '--gallop-icon-size',
};

export class ThemeManager {
  private theme: GallopTheme;

  constructor(theme: GallopTheme) {
    this.theme = theme;
  }

  apply(element: HTMLElement): void {
    for (const [key, cssVar] of Object.entries(PROP_MAP)) {
      const value = this.theme[key as keyof GallopTheme];
      if (value) {
        element.style.setProperty(cssVar, value);
      }
    }
  }

  update(overrides: Partial<GallopTheme>, element: HTMLElement): void {
    this.theme = { ...this.theme, ...overrides };
    this.apply(element);
  }
}
