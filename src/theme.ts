import { useMemo } from 'react';
import { useLifeStore } from './store/useLifeStore';

export const UI_ACCENT_PRESETS = [
  { key: 'olive', label: 'Verde Oliva', color: '#8FBF00' },
  { key: 'teal', label: 'Turquesa', color: '#14B8A6' },
  { key: 'blue', label: 'Azul', color: '#3B82F6' },
  { key: 'cyan', label: 'Cian', color: '#06B6D4' },
  { key: 'emerald', label: 'Esmeralda', color: '#10B981' },
  { key: 'violet', label: 'Violeta', color: '#8B5CF6' },
  { key: 'rose', label: 'Rosa', color: '#F43F5E' },
  { key: 'orange', label: 'Naranja', color: '#F97316' },
  { key: 'amber', label: 'Ámbar', color: '#F59E0B' },
  { key: 'slate', label: 'Pizarra', color: '#64748B' },
  { key: 'indigo', label: 'Índigo', color: '#4F46E5' },
  { key: 'lime', label: 'Lima', color: '#A3E635' }
] as const;

export const UI_ACCENT_TEXT_MODES = [
  { key: 'auto', label: 'Auto', description: 'Contraste automático' },
  { key: 'light', label: 'Blanco', description: 'Texto claro' },
  { key: 'dark', label: 'Oscuro', description: 'Texto negro claro' }
] as const;

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
