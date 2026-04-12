import { useMemo } from 'react';
import { useLifeStore } from './store/useLifeStore';

export const UI_ACCENT_PRESETS = [
  { key: 'olive', label: 'Verde Oliva', color: '#8FBF00' },
  { key: 'teal', label: 'Turquesa', color: '#14B8A6' },
  { key: 'blue', label: 'Azul', color: '#3B82F6' },
  { key: 'orange', label: 'Naranja', color: '#F97316' }
] as const;

export type UiThemeMode = 'dark' | 'light';

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

export function createLifeTheme(mode: UiThemeMode, primaryColor: string) {
  const isDark = mode === 'dark';

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
    }
  } as const;
}

export const lifeTheme = createLifeTheme('dark', '#8FBF00');

export function useAppTheme() {
  const uiThemeMode = useLifeStore((s) => s.settings.uiThemeMode ?? 'dark');
  const uiAccentColor = useLifeStore((s) => s.settings.uiAccentColor ?? '#8FBF00');

  return useMemo(() => createLifeTheme(uiThemeMode, uiAccentColor), [uiThemeMode, uiAccentColor]);
}
