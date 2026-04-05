import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight, Layout, ZoomIn } from 'react-native-reanimated';
import { ActionTimer } from '../src/components/ActionTimer';
import { TimelineBlock } from '../src/components/TimelineBlock';
import { useLifeStore } from '../src/store/useLifeStore';
import { lifeTheme } from '../src/theme';
import { formatDuration } from '../src/utils/time';

export default function HomeScreen(): ReactElement {
  const router = useRouter();
  const timeline = useLifeStore((state) => state.timeline);
  const tasks = useLifeStore((state) => state.tasks);
  const activeTimer = useLifeStore((state) => state.activeTimer);
  const generateTimeline = useLifeStore((state) => state.generateTimeline);
  const startMealTimer = useLifeStore((state) => state.startMealTimer);
  const stopTimer = useLifeStore((state) => state.stopTimer);
  const lastEngine = useLifeStore((state) => state.lastEngine);
  const lastSolverStatus = useLifeStore((state) => state.lastSolverStatus);
  const isGenerating = useLifeStore((state) => state.isGenerating);

  const poolCount = tasks.filter((task) => task.status === 'pool').length;
  const scheduledCount = timeline.filter((block) => block.type === 'task').length;
  const totalWorkMinutes = timeline
    .filter((block) => block.type === 'task')
    .reduce((total, block) => total + (block.end_time.getTime() - block.start_time.getTime()) / 60_000, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Hero card */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />
        <Text style={styles.kicker}>Event-driven productivity kernel</Text>
        <Text style={styles.title}>Tu día se organiza solo.</Text>
        <Text style={styles.subtitle}>
          Captura tareas en el pool, genera un timeline automático y deja que el sistema reduzca el ruido mental.
        </Text>

        <View style={styles.statsRow}>
          <Animated.View entering={ZoomIn.delay(100).duration(300)} style={styles.statCard}>
            <Text style={[styles.statValue, styles.mono]}>{poolCount}</Text>
            <Text style={styles.statLabel}>En pool</Text>
          </Animated.View>
          <Animated.View entering={ZoomIn.delay(180).duration(300)} style={styles.statCard}>
            <Text style={[styles.statValue, styles.mono]}>{scheduledCount}</Text>
            <Text style={styles.statLabel}>Bloques activos</Text>
          </Animated.View>
          <Animated.View entering={ZoomIn.delay(260).duration(300)} style={styles.statCard}>
            <Text style={[styles.statValue, styles.mono]}>{formatDuration(Math.round(totalWorkMinutes))}</Text>
            <Text style={styles.statLabel}>Trabajo total</Text>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Action buttons */}
      <Animated.View entering={FadeInDown.delay(150).duration(350)} style={styles.actionsCard}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
            isGenerating && styles.buttonDisabled
          ]}
          onPress={() => void generateTimeline(new Date())}
          disabled={isGenerating}
        >
          <Text style={styles.primaryButtonText}>
            {isGenerating ? '⏳ Optimizando...' : '⚡ Organizar mi día'}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          onPress={() => void startMealTimer()}
        >
          <Text style={styles.secondaryButtonText}>🍽 Ir a comer (90 min)</Text>
        </Pressable>
        <View style={styles.secondaryRow}>
          <Pressable
            style={({ pressed }) => [styles.tertiaryButton, styles.tertiaryHalf, pressed && styles.buttonPressed]}
            onPress={() => router.push('/pool')}
          >
            <Text style={styles.tertiaryButtonText}>Task Pool →</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.tertiaryButton, styles.tertiaryHalf, pressed && styles.buttonPressed]}
            onPress={() => router.push('/stats')}
          >
            <Text style={styles.tertiaryButtonText}>Estadísticas →</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Engine indicator */}
      {lastEngine !== 'idle' && (
        <Animated.View entering={FadeInDown.duration(280)} style={[
          styles.engineBadge,
          lastEngine === 'ortools-cpsat' ? styles.engineBadgeOptimal :
          lastEngine === 'greedy-fallback' ? styles.engineBadgeFallback :
          styles.engineBadgeLocal
        ]}>
          <Text style={[
            styles.engineText,
            lastEngine === 'ortools-cpsat' ? styles.engineTextOptimal :
            lastEngine === 'greedy-fallback' ? styles.engineTextFallback :
            styles.engineTextLocal
          ]}>
            {lastEngine === 'ortools-cpsat'
              ? `🔬 OR-Tools CP-SAT · ${lastSolverStatus}`
              : lastEngine === 'greedy-fallback'
              ? `⚠️ Greedy fallback · ${lastSolverStatus}`
              : '📱 Scheduler local (backend offline)'}
          </Text>
        </Animated.View>
      )}

      {/* Active timer */}
      {activeTimer ? (
        <Animated.View entering={ZoomIn.duration(300)}>
          <ActionTimer timer={activeTimer} onStop={() => void stopTimer()} />
        </Animated.View>
      ) : null}

      {/* Timeline section */}
      <Animated.View entering={FadeInRight.delay(250).duration(350)} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Timeline</Text>
        <Text style={[styles.sectionHint, styles.mono]}>{timeline.length} bloques</Text>
      </Animated.View>

      {timeline.length > 0 ? (
        <View style={styles.blockList}>
          {timeline.map((block, i) => (
            <Animated.View
              key={block.id}
              entering={FadeInDown.delay(i * 50).duration(300)}
              layout={Layout.springify().damping(18)}
            >
              <TimelineBlock block={block} />
            </Animated.View>
          ))}
        </View>
      ) : (
        <Animated.View entering={FadeInDown.delay(300).duration(300)} style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aún no hay timeline</Text>
          <Text style={styles.emptyText}>
            Pulsa "Organizar mi día" para convertir el pool en una secuencia de trabajo automática.
          </Text>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lifeTheme.colors.background
  },
  content: {
    padding: lifeTheme.spacing.lg,
    gap: lifeTheme.spacing.lg,
    paddingBottom: 40
  },
  hero: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.lg,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: lifeTheme.spacing.lg,
    overflow: 'hidden',
    gap: 12
  },
  glowOne: {
    position: 'absolute',
    right: -20,
    top: -30,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(124, 108, 252, 0.18)'
  },
  glowTwo: {
    position: 'absolute',
    left: -25,
    bottom: -35,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(108, 252, 184, 0.13)'
  },
  kicker: {
    color: lifeTheme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  title: {
    color: lifeTheme.colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800'
  },
  subtitle: {
    color: lifeTheme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 340
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 4
  },
  statCard: {
    flexGrow: 1,
    minWidth: 90,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: lifeTheme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  statValue: {
    color: lifeTheme.colors.text,
    fontSize: 20,
    fontWeight: '800'
  },
  mono: {
    fontFamily: 'monospace'
  },
  statLabel: {
    color: lifeTheme.colors.muted,
    fontSize: 11,
    marginTop: 4
  },
  actionsCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: lifeTheme.spacing.md,
    gap: 10
  },
  primaryButton: {
    backgroundColor: lifeTheme.colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  secondaryButton: {
    backgroundColor: 'rgba(108, 252, 184, 0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 252, 184, 0.3)'
  },
  secondaryButtonText: {
    color: lifeTheme.colors.success,
    fontSize: 14,
    fontWeight: '800'
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10
  },
  tertiaryButton: {
    paddingVertical: 12,
    alignItems: 'center'
  },
  tertiaryHalf: {
    flex: 1,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  tertiaryButtonText: {
    color: lifeTheme.colors.muted,
    fontSize: 13,
    fontWeight: '700'
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.978 }]
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    color: lifeTheme.colors.text,
    fontSize: 18,
    fontWeight: '800'
  },
  sectionHint: {
    color: lifeTheme.colors.muted,
    fontSize: 13
  },
  blockList: {
    gap: 12
  },
  emptyCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: lifeTheme.spacing.lg,
    gap: 8
  },
  emptyTitle: {
    color: lifeTheme.colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  emptyText: {
    color: lifeTheme.colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  buttonDisabled: {
    opacity: 0.55
  },
  engineBadge: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    alignSelf: 'flex-start'
  },
  engineBadgeOptimal: {
    backgroundColor: 'rgba(108, 252, 184, 0.1)',
    borderColor: 'rgba(108, 252, 184, 0.3)'
  },
  engineBadgeFallback: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  engineBadgeLocal: {
    backgroundColor: 'rgba(124, 108, 252, 0.1)',
    borderColor: 'rgba(124, 108, 252, 0.3)'
  },
  engineText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace'
  },
  engineTextOptimal: {
    color: lifeTheme.colors.success
  },
  engineTextFallback: {
    color: '#f59e0b'
  },
  engineTextLocal: {
    color: lifeTheme.colors.primary
  }
});
