import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing
} from 'react-native-reanimated';
import { formatCountdown } from '../utils/time';
import { lifeTheme } from '../theme';
import type { LifeTimer } from '../types';

interface ActionTimerProps {
  timer: LifeTimer;
  onStop: () => void;
}

export function ActionTimer({ timer, onStop }: ActionTimerProps): ReactElement {
  const [now, setNow] = useState<Date>(new Date());
  const progressBar = useSharedValue(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const totalMs = timer.durationMinutes * 60_000;
  const remainingMs = Math.max(0, timer.endsAt.getTime() - now.getTime());
  const elapsed = totalMs - remainingMs;
  const progress = Math.min(1, elapsed / totalMs);
  const expired = remainingMs <= 0;

  useEffect(() => {
    progressBar.value = withTiming(progress, {
      duration: 800,
      easing: Easing.out(Easing.ease)
    });
  }, [progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressBar.value * 100}%`
  }));

  const progressColor = expired
    ? lifeTheme.colors.alert
    : progress > 0.75
    ? '#f59e0b'
    : lifeTheme.colors.success;

  return (
    <View style={[styles.card, expired && styles.cardExpired]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.label, expired && styles.labelExpired]}>
            {expired ? '⚡ Descanso terminado' : '🍽 Timer activo'}
          </Text>
          <Text style={styles.title}>Ir a comer</Text>
        </View>
        <View style={styles.clockWrapper}>
          <Text style={[styles.clock, styles.mono, expired && styles.clockExpired]}>
            {expired ? '00:00' : formatCountdown(timer.endsAt, now)}
          </Text>
          <Text style={[styles.clockSub, styles.mono]}>
            de {timer.durationMinutes}:00
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.track, { backgroundColor: `${progressColor}22` }]}>
        <Animated.View style={[styles.fill, { backgroundColor: progressColor }, progressStyle]} />
      </View>

      <Text style={styles.body}>
        {expired
          ? 'El descanso terminó. Toca "Detener" para que el kernel reorganice el día desde ahora.'
          : 'El kernel se reprogramará automáticamente cuando termine el bloque de descanso.'}
      </Text>

      <Pressable
        style={({ pressed }) => [styles.stopButton, pressed && styles.stopButtonPressed]}
        onPress={onStop}
      >
        <Text style={styles.stopText}>
          {expired ? '⚡ Reorganizar ahora' : 'Detener timer'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: lifeTheme.colors.surface,
    borderColor: 'rgba(108, 252, 184, 0.3)',
    borderWidth: 1,
    borderRadius: lifeTheme.radius.md,
    padding: lifeTheme.spacing.md,
    gap: 12
  },
  cardExpired: {
    borderColor: 'rgba(252, 108, 143, 0.35)'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  label: {
    color: lifeTheme.colors.success,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4
  },
  labelExpired: {
    color: lifeTheme.colors.alert
  },
  title: {
    color: lifeTheme.colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  clockWrapper: {
    alignItems: 'flex-end'
  },
  clock: {
    color: lifeTheme.colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32
  },
  clockExpired: {
    color: lifeTheme.colors.alert
  },
  clockSub: {
    color: lifeTheme.colors.muted,
    fontSize: 11
  },
  track: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: 999
  },
  body: {
    color: lifeTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  stopButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(252, 108, 143, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(252, 108, 143, 0.35)'
  },
  stopButtonPressed: {
    opacity: 0.7
  },
  stopText: {
    color: lifeTheme.colors.alert,
    fontSize: 13,
    fontWeight: '800'
  },
  mono: {
    fontFamily: 'monospace'
  }
});
