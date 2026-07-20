import { useMemo } from 'react';
import { useLifeStore } from './store/useLifeStore';

export type UiThemeMode = 'dark' | 'light';
export type UiAccentTextMode = 'auto' | 'light' | 'dark';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((character) => character + character).join('')
    : normalized;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16)
  };
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = getRelativeLuminance(first);
  const secondLuminance = getRelativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function getContrastTextColor(primaryColor: string, mode: UiAccentTextMode): string {
  if (mode === 'light') return '#F8FAF8';
  if (mode === 'dark') return '#111713';

  const light = '#F8FAF8';
  const dark = '#111713';
  return contrastRatio(primaryColor, light) >= contrastRatio(primaryColor, dark) ? light : dark;
}

export function createLifeTheme(
  mode: UiThemeMode,
  primaryColor: string,
  accentTextMode: UiAccentTextMode = 'auto'
) {
  const isDark = mode === 'dark';
  const onPrimary = getContrastTextColor(primaryColor, accentTextMode);
  const success = isDark ? '#4ADE80' : '#187B45';
  const warning = isDark ? '#F6C453' : '#9A5B00';
  const info = isDark ? '#67B7F7' : '#1769AA';
  const danger = isDark ? '#FF6B7A' : '#C7354A';

  return {
    isDark,
    colors: {
      background: isDark ? '#0B0D0C' : '#F5F7F4',
      surface: isDark ? '#121512' : '#FFFFFF',
      surfaceAlt: isDark ? '#1A1E1B' : '#EDF1EC',
      surfaceRaised: isDark ? '#202520' : '#FFFFFF',
      surfaceSunken: isDark ? '#080A09' : '#E7EBE6',
      border: isDark ? '#303730' : '#D5DDD4',
      outlineStrong: isDark ? '#4D584E' : '#98A497',
      text: isDark ? '#F2F5F1' : '#172019',
      muted: isDark ? '#A5ADA5' : '#566159',
      subtle: isDark ? '#737B74' : '#77827A',
      primary: primaryColor,
      onPrimary,
      success,
      warning,
      info,
      alert: danger,
      danger,
      scrim: 'rgba(0, 0, 0, 0.72)',
      softPrimary: withAlpha(primaryColor, isDark ? 0.18 : 0.12),
      softSuccess: withAlpha(success, isDark ? 0.16 : 0.11),
      softWarning: withAlpha(warning, isDark ? 0.16 : 0.12),
      softInfo: withAlpha(info, isDark ? 0.16 : 0.11),
      softAlert: withAlpha(danger, isDark ? 0.16 : 0.10)
    },
    radius: {
      xs: 4,
      sm: 6,
      md: 8,
      lg: 12,
      full: 999
    },
    spacing: {
      xxs: 4,
      xs: 8,
      sm: 12,
      md: 16,
      lg: 20,
      xl: 24,
      xxl: 32
    },
    typography: {
      display: 32,
      headline: 26,
      titleLg: 22,
      titleMd: 18,
      titleSm: 16,
      body: 15,
      bodySm: 13,
      label: 12,
      caption: 11,
      lineHeight: {
        display: 38,
        headline: 32,
        title: 26,
        body: 22,
        bodySm: 19,
        label: 16
      }
    },
    motion: {
      press: 110,
      fast: 160,
      standard: 210,
      sheet: 250
    },
    shadow: {
      low: isDark ? '0 2px 6px rgba(0, 0, 0, 0.24)' : '0 2px 6px rgba(23, 32, 25, 0.10)',
      medium: isDark ? '0 5px 12px rgba(0, 0, 0, 0.32)' : '0 5px 12px rgba(23, 32, 25, 0.14)'
    }
  } as const;
}

export const lifeTheme = createLifeTheme('dark', '#8FBF00');

export type LifeTheme = ReturnType<typeof createLifeTheme>;

export function useAppTheme(): LifeTheme {
  const uiThemeMode = useLifeStore((state) => state.settings.uiThemeMode ?? 'dark');
  const uiAccentColor = useLifeStore((state) => state.settings.uiAccentColor ?? '#8FBF00');
  const uiAccentTextMode = useLifeStore((state) => state.settings.uiAccentTextMode ?? 'auto');

  return useMemo(
    () => createLifeTheme(uiThemeMode, uiAccentColor, uiAccentTextMode),
    [uiThemeMode, uiAccentColor, uiAccentTextMode]
  );
}
