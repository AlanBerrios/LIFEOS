import { useMemo } from 'react';
import { useLifeStore } from './store/useLifeStore';

export type UiThemeMode = 'dark' | 'light';
export type UiAccentTextMode = 'auto' | 'light' | 'dark';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;

  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return { r, g, b };
}

function rgba(hex: string, alpha: number): string {
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

function getContrastTextColor(primaryColor: string, mode: UiAccentTextMode): string {
  if (mode === 'light') return '#FFFFFF';
  if (mode === 'dark') return '#161A1D';
  return getRelativeLuminance(primaryColor) > 0.55 ? '#161A1D' : '#FFFFFF';
}

export function createLifeTheme(mode: UiThemeMode, primaryColor: string, accentTextMode: UiAccentTextMode = 'auto') {
  const isDark = mode === 'dark';
  const onPrimary = getContrastTextColor(primaryColor, accentTextMode);

  return {
    colors: {
      background: isDark ? '#060606' : '#F4F6F8',
      surface: isDark ? '#121212' : '#FFFFFF',
      surfaceAlt: isDark ? '#1A1A1A' : '#E9EDF1',
      border: isDark ? '#2A2A2A' : '#CDD5DF',
      text: isDark ? '#F5F5F5' : '#161A1D',
      muted: isDark ? '#9A9A9A' : '#617083',
      primary: primaryColor,
      success: primaryColor,
      onPrimary,
      alert: '#FF5F7A',
      softPrimary: rgba(primaryColor, isDark ? 0.22 : 0.16),
      softSuccess: rgba(primaryColor, isDark ? 0.18 : 0.14),
      softAlert: 'rgba(255, 95, 122, 0.18)'
    },
    radius: {
      sm: 12,
      md: 16,
      lg: 24
    },
    spacing: {
      xs: 6,
      sm: 10,
      md: 14,
      lg: 20,
      xl: 28
    },
    typography: {
      titleLg: 24,
      titleMd: 20,
      body: 15,
      bodySm: 13,
      caption: 11
    }
  } as const;
}

export const lifeTheme = createLifeTheme('dark', '#8FBF00');

export function useAppTheme() {
  const uiThemeMode = useLifeStore((s) => s.settings.uiThemeMode ?? 'dark');
  const uiAccentColor = useLifeStore((s) => s.settings.uiAccentColor ?? '#8FBF00');
  const uiAccentTextMode = useLifeStore((s) => s.settings.uiAccentTextMode ?? 'auto');

  return useMemo(
    () => createLifeTheme(uiThemeMode, uiAccentColor, uiAccentTextMode),
    [uiThemeMode, uiAccentColor, uiAccentTextMode]
  );
}
