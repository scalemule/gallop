import type { GallopConfig, GallopTheme } from './types';

export const DEFAULT_THEME: GallopTheme = {
  colorPrimary: '#3b82f6',
  colorSecondary: '#8b5cf6',
  colorText: '#ffffff',
  colorBackground: 'rgba(24, 24, 32, 0.92)',
  colorBuffered: 'rgba(255, 255, 255, 0.22)',
  colorProgress: '#3b82f6',
  controlBarBackground: 'rgba(0, 0, 0, 0.65)',
  controlBarHeight: '44px',
  borderRadius: '8px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '13px',
  iconSize: '22px',
};

export const DEFAULT_CONFIG: Required<
  Pick<GallopConfig, 'controls' | 'autoplay' | 'loop' | 'muted' | 'keyboard' | 'touch' | 'aspectRatio'>
> & { apiBaseUrl: string } = {
  controls: true,
  autoplay: false,
  loop: false,
  muted: false,
  keyboard: true,
  touch: true,
  aspectRatio: '16:9',
  apiBaseUrl: 'https://api.scalemule.com',
};

export const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const SEEK_STEP = 5;
export const SEEK_STEP_LARGE = 10;
export const VOLUME_STEP = 0.05;
export const CONTROLS_HIDE_DELAY = 3000;
export const DOUBLE_TAP_DELAY = 300;

export const HLS_DEFAULT_CONFIG = {
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  startLevel: -1,
  capLevelToPlayerSize: true,
  progressive: true,
};
