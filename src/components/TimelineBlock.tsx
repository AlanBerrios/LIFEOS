import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import Animated, { FadeInLeft } from 'react-native-reanimated';
import { formatClock } from '../utils/time';
import { useAppTheme } from '../theme';
import type { ScheduleBlock } from '../types';

interface TimelineBlockProps {
  block: ScheduleBlock;
}

function getBlockAccent(type: ScheduleBlock['type'], lifeTheme: ReturnType<typeof useAppTheme>): string {
  switch (type) {
    case 'rest': return lifeTheme.colors.success;
    case 'meal': return lifeTheme.colors.alert;
    default: return lifeTheme.colors.primary;
  }
}

function getBlockLabel(type: ScheduleBlock['type']): string {
  switch (type) {
    case 'rest': return 'Descanso';
    case 'meal': return 'Comida';
    default: return 'Tarea';
  }
}

function getBlockIcon(type: ScheduleBlock['type']): string {
  switch (type) {
    case 'rest': return '☕';
    case 'meal': return '🍽';
    default: return '⚡';
  }
}

function getDurationMinutes(block: ScheduleBlock): number {
  return Math.round((block.end_time.getTime() - block.start_time.getTime()) / 60_000);
}

export function TimelineBlock({ block }: TimelineBlockProps): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const accent = getBlockAccent(block.type, lifeTheme);
  const durationMin = getDurationMinutes(block);

  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.timeColumn}>
        <Text style={[styles.timeText, styles.mono]}>{formatClock(block.start_time)}</Text>
        <View style={styles.timeLine} />
        <Text style={[styles.timeText, styles.mono, styles.timeEnd]}>{formatClock(block.end_time)}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.typeLabel, { color: accent }]}>
            {getBlockIcon(block.type)} {getBlockLabel(block.type)}
          </Text>
          <Text style={[styles.durationBadge, styles.mono, { color: accent }]}>{durationMin}m</Text>
        </View>
        <Text style={styles.title}>{block.title}</Text>
        <View style={[styles.progressBar, { backgroundColor: `${accent}22` }]}>
          <View style={[styles.progressFill, { backgroundColor: accent, width: '100%' }]} />
        </View>
      </View>
    </View>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  card: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    borderLeftWidth: 3,
    flexDirection: 'row',
    overflow: 'hidden'
  },
  timeColumn: {
    width: 60,
    paddingVertical: lifeTheme.spacing.md,
    paddingLeft: lifeTheme.spacing.sm,
    alignItems: 'center',
    gap: 4,
    borderRightWidth: 1,
    borderRightColor: lifeTheme.colors.border
  },
  timeText: {
    color: lifeTheme.colors.muted,
    fontSize: 11
  },
  timeEnd: {
    opacity: 0.6
  },
  timeLine: {
    flex: 1,
    width: 1,
    backgroundColor: lifeTheme.colors.border,
    minHeight: 12
  },
  body: {
    flex: 1,
    padding: lifeTheme.spacing.md,
    gap: 6
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  durationBadge: {
    fontSize: 12,
    fontWeight: '700'
  },
  title: {
    color: lifeTheme.colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  progressBar: {
    height: 2,
    borderRadius: 999,
    marginTop: 4,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    opacity: 0.7
  },
  mono: {
    fontFamily: 'monospace'
  }
  });
}
