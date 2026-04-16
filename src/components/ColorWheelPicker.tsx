import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { PanResponderGestureState, GestureResponderEvent } from 'react-native';
import { PanResponder, View, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toHex(channel: number): string {
  return clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0').toUpperCase();
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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

function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) {
    return { r: 143, g: 191, b: 0 };
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
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

function polarToCartesian(cx: number, cy: number, radius: number, angleDegrees: number): { x: number; y: number } {
  const radians = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function describeWedge(cx: number, cy: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number): string {
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    `L ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    'Z'
  ].join(' ');
}

function normalizeHex(hex: string): string {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
  return cleaned.length === 6 ? `#${cleaned}`.toUpperCase() : '#8FBF00';
}

function pointToColor(cx: number, cy: number, x: number, y: number): string {
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.sqrt((dx * dx) + (dy * dy));
  const radius = Math.max(cx, cy);
  const saturation = clamp(distance / radius, 0, 1);
  const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 450) % 360;
  return hsvToHex(hue, saturation, 1);
}

export function ColorWheelPicker({
  value,
  onChange,
  size = 260
}: {
  value: string;
  onChange: (hex: string) => void;
  size?: number;
}) {
  const wheelRadius = size / 2;
  const segmentCount = 72;
  const ringCount = 7;
  const ringThickness = wheelRadius / ringCount;
  const safeValue = normalizeHex(value);
  const currentHsv = rgbToHsv(hexToRgb(safeValue).r, hexToRgb(safeValue).g, hexToRgb(safeValue).b);
  const markerRadius = wheelRadius * Math.min(0.92, Math.max(0.12, currentHsv.s));
  const markerPosition = polarToCartesian(wheelRadius, wheelRadius, markerRadius, currentHsv.h);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event: GestureResponderEvent) => {
        onChange(pointToColor(wheelRadius, wheelRadius, event.nativeEvent.locationX, event.nativeEvent.locationY));
      },
      onPanResponderMove: (event: GestureResponderEvent, _gesture: PanResponderGestureState) => {
        onChange(pointToColor(wheelRadius, wheelRadius, event.nativeEvent.locationX, event.nativeEvent.locationY));
      }
    })
  ).current;

  const wedges = useMemo(() => {
    const items: ReactNode[] = [];
    for (let ring = 0; ring < ringCount; ring += 1) {
      const innerRadius = ring === 0 ? 0.01 : ring * ringThickness;
      const outerRadius = (ring + 1) * ringThickness;
      const saturation = (ring + 1) / ringCount;
      for (let index = 0; index < segmentCount; index += 1) {
        const startAngle = (index / segmentCount) * 360;
        const endAngle = ((index + 1) / segmentCount) * 360;
        const hue = startAngle;
        items.push(
          <Path
            key={`${ring}-${index}`}
            d={describeWedge(wheelRadius, wheelRadius, innerRadius, outerRadius, startAngle, endAngle)}
            fill={hsvToHex(hue, saturation, 1)}
          />
        );
      }
    }
    return items;
  }, [ringCount, ringThickness, segmentCount, wheelRadius]);

  return (
    <View {...responder.panHandlers} style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {wedges}
        <Circle
          cx={markerPosition.x}
          cy={markerPosition.y}
          r={Math.max(8, size * 0.045)}
          fill={safeValue}
          stroke="#FFFFFF"
          strokeWidth={3}
        />
        <Circle
          cx={markerPosition.x}
          cy={markerPosition.y}
          r={Math.max(12, size * 0.06)}
          fill="transparent"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center'
  }
});
