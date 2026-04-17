import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useAppTheme } from '../theme';
import { ColorWheelPicker } from './ColorWheelPicker';

interface AppColorPickerSheetProps {
  visible: boolean;
  value: string;
  title?: string;
  onClose: () => void;
  onApply: (hex: string) => void;
  onClear?: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeHex(hex: string): string {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
  return cleaned.length === 6 ? `#${cleaned}`.toUpperCase() : '#8FBF00';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const safeHex = normalizeHex(hex).replace('#', '');
  return {
    r: Number.parseInt(safeHex.slice(0, 2), 16),
    g: Number.parseInt(safeHex.slice(2, 4), 16),
    b: Number.parseInt(safeHex.slice(4, 6), 16)
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (channel: number) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6);
    } else if (max === gn) {
      h = 60 * (((bn - rn) / delta) + 2);
    } else {
      h = 60 * (((rn - gn) / delta) + 4);
    }
  }

  if (h < 0) h += 360;
  const s = max === 0 ? 0 : delta / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const chroma = v * s;
  const sector = (h / 60) % 6;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (sector >= 0 && sector < 1) {
    r1 = chroma; g1 = x; b1 = 0;
  } else if (sector < 2) {
    r1 = x; g1 = chroma; b1 = 0;
  } else if (sector < 3) {
    r1 = 0; g1 = chroma; b1 = x;
  } else if (sector < 4) {
    r1 = 0; g1 = x; b1 = chroma;
  } else if (sector < 5) {
    r1 = x; g1 = 0; b1 = chroma;
  } else {
    r1 = chroma; g1 = 0; b1 = x;
  }

  const m = v - chroma;
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255
  };
}

function getBrightnessFromHex(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b).v;
}

function adjustHexBrightness(hex: string, brightness: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s } = rgbToHsv(r, g, b);
  const adjusted = hsvToRgb(h, s, clamp(brightness, 0.12, 1));
  return rgbToHex(adjusted.r, adjusted.g, adjusted.b);
}

function mergeHueSatWithBrightness(baseHex: string, incomingHex: string): string {
  const baseRgb = hexToRgb(baseHex);
  const incomingRgb = hexToRgb(incomingHex);
  const { v: baseV } = rgbToHsv(baseRgb.r, baseRgb.g, baseRgb.b);
  const { h, s } = rgbToHsv(incomingRgb.r, incomingRgb.g, incomingRgb.b);
  const adjusted = hsvToRgb(h, s, clamp(baseV, 0.12, 1));
  return rgbToHex(adjusted.r, adjusted.g, adjusted.b);
}

export function AppColorPickerSheet({
  visible,
  value,
  title,
  onClose,
  onApply,
  onClear
}: AppColorPickerSheetProps): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const [draftColor, setDraftColor] = useState(normalizeHex(value || lifeTheme.colors.primary));

  useEffect(() => {
    if (!visible) return;
    setDraftColor(normalizeHex(value || lifeTheme.colors.primary));
  }, [visible, value, lifeTheme.colors.primary]);

  const brightness = useMemo(() => getBrightnessFromHex(draftColor), [draftColor]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>{title ?? 'Selecciona un color'}</Text>

          <View style={styles.previewRow}>
            <View style={[styles.previewSwatch, { backgroundColor: draftColor }]} />
            <Text style={styles.previewText}>{draftColor}</Text>
            <Text style={styles.previewPercent}>{Math.round(brightness * 100)}%</Text>
          </View>

          <View style={styles.wheelWrap}>
            <ColorWheelPicker
              value={draftColor}
              size={250}
              onChange={(hex) => setDraftColor((current) => mergeHueSatWithBrightness(current, hex))}
            />
          </View>

          <View style={styles.brightnessSection}>
            <Text style={styles.brightnessLabel}>Brillo</Text>
            <Slider
              style={styles.slider}
              minimumValue={0.12}
              maximumValue={1}
              step={0.01}
              value={brightness}
              onValueChange={(next) => setDraftColor((current) => adjustHexBrightness(current, next))}
              minimumTrackTintColor={lifeTheme.colors.primary}
              maximumTrackTintColor={lifeTheme.colors.border}
              thumbTintColor={lifeTheme.colors.primary}
            />
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.actionSecondary} onPress={onClose}>
              <Text style={styles.actionSecondaryText}>Cancelar</Text>
            </Pressable>
            {onClear ? (
              <Pressable
                style={styles.actionSecondary}
                onPress={() => {
                  onClear();
                  onClose();
                }}
              >
                <Text style={styles.actionSecondaryText}>Limpiar</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.actionPrimary}
              onPress={() => {
                onApply(draftColor);
                onClose();
              }}
            >
              <Text style={styles.actionPrimaryText}>Aplicar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      paddingHorizontal: 20
    },
    card: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 14,
      gap: 12
    },
    title: { color: lifeTheme.colors.text, fontSize: 15, fontWeight: '800' },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 12,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    previewSwatch: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border
    },
    previewText: { color: lifeTheme.colors.text, fontSize: 12, fontWeight: '800', flex: 1 },
    previewPercent: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700' },
    wheelWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 14,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      paddingVertical: 10
    },
    brightnessSection: {
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 12,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 4
    },
    brightnessLabel: { color: lifeTheme.colors.text, fontSize: 12, fontWeight: '700' },
    slider: { width: '100%', height: 30 },
    actions: { flexDirection: 'row', gap: 10 },
    actionSecondary: {
      flex: 1,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      backgroundColor: lifeTheme.colors.surfaceAlt
    },
    actionSecondaryText: { color: lifeTheme.colors.text, fontSize: 12, fontWeight: '700' },
    actionPrimary: {
      flex: 1,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      backgroundColor: lifeTheme.colors.primary
    },
    actionPrimaryText: { color: lifeTheme.colors.onPrimary, fontSize: 12, fontWeight: '800' }
  });
}
