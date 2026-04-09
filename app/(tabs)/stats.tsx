import type { ReactElement } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../../src/store/useLifeStore';
import { lifeTheme } from '../../src/theme';
import type { DailySession } from '../../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function getShortDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es', { weekday: 'short' }).slice(0, 3);
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon?: string;
  accent?: string;
  delay?: number;
}

function StatCard({ label, value, icon, accent = lifeTheme.colors.primary, delay = 0 }: StatCardProps): ReactElement {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={styles.statCard}>
      <View style={styles.statCardHeader}>
        <Text style={[styles.statValue, { color: accent, fontFamily: 'monospace' }]}>{value}</Text>
        {icon && <Text style={styles.statIcon}>{icon}</Text>}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

interface BarProps {
  progress: number; // 0-1
  color: string;
  label: string;
  count: number;
  delay?: number;
}

function HBar({ progress, color, label, count, delay = 0 }: BarProps): ReactElement {
  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(300)} style={styles.hbarRow}>
      <Text style={styles.hbarLabel}>{label}</Text>
      <View style={styles.hbarTrack}>
        <View style={[styles.hbarFill, { width: `${Math.max(2, progress * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.hbarCount, { color }]}>{count}</Text>
    </Animated.View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function StatsScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const tasks = useLifeStore((s) => s.tasks);
  const timeline = useLifeStore((s) => s.timeline);
  const sessions = useLifeStore((s) => s.sessions);

  const today = todayISO();
  const todaySession: DailySession | undefined = sessions.find((s) => s.date === today);
  const last7 = getLast7Days();
  const sessionMap = Object.fromEntries(sessions.map((s) => [s.date, s]));

  // ── Métricas del día actual ──────────────────────────────────────────────────
  const completedToday = tasks.filter((t) => t.status === 'completed').length;
  const scheduledToday = timeline.filter((b) => b.type === 'task').length;
  const totalWork = todaySession?.totalWorkMinutes ?? 0;
  const totalDrain = todaySession?.totalCognitiveDrain ?? 0;

  // Energía cognitiva: escalar (600 = 1 sesión completa, múltiplos posibles)
  const drainPercent = Math.min(100, Math.round((totalDrain / 600) * 100));

  // ── Pool breakdown ──────────────────────────────────────────────────────────
  const poolCount = tasks.filter((t) => t.status === 'pool').length;
  const scheduledCount = tasks.filter((t) => t.status === 'scheduled').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = tasks.length || 1;

  // ── Carga cognitiva por categoría ───────────────────────────────────────────
  const taskBlocks = timeline.filter((b) => b.type === 'task');
  const taskDetailMap = Object.fromEntries(tasks.map((t) => [t.id, t]));

  let lowLoad = 0, midLoad = 0, highLoad = 0;
  for (const block of taskBlocks) {
    const task = block.task_id ? taskDetailMap[block.task_id] : null;
    if (!task) continue;
    if (task.cognitive_load <= 3) lowLoad++;
    else if (task.cognitive_load <= 6) midLoad++;
    else highLoad++;
  }
  const maxLoad = Math.max(lowLoad, midLoad, highLoad, 1);

  // ── Histórico sparkline ─────────────────────────────────────────────────────────
  const maxCompleted = Math.max(1, ...last7.map((d) => sessionMap[d]?.tasksCompleted ?? 0));

  return (
    <ScrollView 
      style={styles.screen} 
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >

      {/* Hero */}
      <Animated.View entering={FadeInDown.duration(350)} style={styles.hero}>
        <View style={styles.glowAccent} />
        
        <View style={styles.maestriaBadge}>
          <Text style={styles.maestriaIcon}>📈</Text>
          <Text style={styles.maestriaText}>Maestría Personal</Text>
        </View>

        <Text style={styles.kicker}>Sistema Operativo Personal</Text>
        <Text style={styles.heroTitle}>Estadísticas</Text>
        <Text style={styles.heroSub}>
          Un vistazo a tu productividad cognitiva de hoy y los últimos 7 días.
        </Text>
      </Animated.View>

      {/* Resumen del dÃ­a */}
      <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.section}>
        <Text style={styles.sectionTitle}>Resumen de Hoy</Text>
        <View style={styles.statRow}>
          <StatCard
            label="Completadas"
            value={`${completedToday}`}
            icon="✅"
            accent={lifeTheme.colors.success}
            delay={100}
          />
          <StatCard
            label="Planificadas"
            value={`${scheduledToday}`}
            icon="⚡"
            accent={lifeTheme.colors.primary}
            delay={160}
          />
          <StatCard
            label="Trabajo total"
            value={formatMinutes(totalWork)}
            icon="⏲️"
            accent={lifeTheme.colors.text}
            delay={220}
          />
        </View>

        {/* Progreso del dÃ­a */}
        {scheduledToday > 0 && (
          <Animated.View entering={FadeInDown.delay(280).duration(300)} style={styles.progressBlock}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Progreso del día</Text>
              <Text style={[styles.progressPct, { fontFamily: 'monospace' }]}>
                {completedToday}/{scheduledToday}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round((completedToday / scheduledToday) * 100)}%`,
                    backgroundColor: lifeTheme.colors.success
                  }
                ]}
              />
            </View>
          </Animated.View>
        )}
      </Animated.View>

      {/* EnergÃ­a cognitiva */}
      <Animated.View entering={FadeInDown.delay(180).duration(300)} style={styles.section}>
        <Text style={styles.sectionTitle}>Energía Cognitiva</Text>
        
        {/* Explicación Técnica */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Tu cerebro tiene un presupuesto diario estimado de <Text style={{ fontWeight: '900', color: lifeTheme.colors.primary }}>600 unidades</Text> de energía. Cada tarea consume este presupuesto según su dificultad. Gestiona tus esfuerzos para evitar el agotamiento mental.
          </Text>
        </View>

        <View style={styles.energyRow}>
          <View style={styles.energyGauge}>
            <View
              style={[
                styles.energyFill,
                {
                  width: `${drainPercent}%`,
                  backgroundColor:
                    drainPercent < 50
                      ? lifeTheme.colors.success
                      : drainPercent < 80
                      ? '#f59e0b'
                      : lifeTheme.colors.alert
                }
              ]}
            />
          </View>
          <Text style={[styles.energyPct, { fontFamily: 'monospace' }]}>{drainPercent}%</Text>
        </View>
        <Text style={styles.energySub}>
          {totalDrain} unidades drenadas Â· Presupuesto diario: 600
        </Text>

        {/* Distribución de tareas por carga */}
        <View style={styles.loadBars}>
          <HBar
            label="Fácil (1-3)"
            progress={lowLoad / maxLoad}
            color={lifeTheme.colors.success}
            count={lowLoad}
            delay={200}
          />
          <HBar
            label="Media (4-6)"
            progress={midLoad / maxLoad}
            color={'#f59e0b'}
            count={midLoad}
            delay={260}
          />
          <HBar
            label="Alta (7-10)"
            progress={highLoad / maxLoad}
            color={lifeTheme.colors.alert}
            count={highLoad}
            delay={320}
          />
        </View>
      </Animated.View>

      {/* Historial 7 dÃ­as */}
      <Animated.View entering={FadeInDown.delay(280).duration(300)} style={styles.section}>
        <Text style={styles.sectionTitle}>Últimos 7 Días</Text>
        <View style={styles.sparklineRow}>
          {last7.map((date, i) => {
            const s = sessionMap[date];
            const count = s?.tasksCompleted ?? 0;
            const barH = count === 0 ? 4 : Math.max(12, Math.round((count / maxCompleted) * 80));
            const isToday = date === today;
            return (
              <Animated.View
                key={date}
                entering={FadeInDown.delay(i * 50).duration(260)}
                style={styles.sparkCol}
              >
                <Text style={[styles.sparkCount, { fontFamily: 'monospace' }]}>
                  {count > 0 ? count : ''}
                </Text>
                <View
                  style={[
                    styles.sparkBar,
                    {
                      height: barH,
                      backgroundColor: isToday
                        ? lifeTheme.colors.primary
                        : count > 0
                        ? 'rgba(124,108,252,0.4)'
                        : lifeTheme.colors.border
                    }
                  ]}
                />
                <Text style={[styles.sparkDay, isToday && styles.sparkDayToday]}>
                  {getShortDay(date)}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>

      {/* Pool breakdown */}
      <Animated.View entering={FadeInDown.delay(360).duration(300)} style={styles.section}>
        <Text style={styles.sectionTitle}>Estado del Pool</Text>
        <View style={styles.poolGrid}>
          {([
            { label: 'En pool', count: poolCount, color: lifeTheme.colors.muted },
            { label: 'Programadas', count: scheduledCount, color: lifeTheme.colors.primary },
            { label: 'Completadas', count: completedCount, color: lifeTheme.colors.success }
          ] as { label: string; count: number; color: string }[]).map(({ label, count, color }) => (
            <View key={label} style={styles.poolCard}>
              <Text style={[styles.poolValue, { color, fontFamily: 'monospace' }]}>{count}</Text>
              <Text style={styles.poolLabel}>{label}</Text>
              <View style={styles.poolBarTrack}>
                <View
                  style={[
                    styles.poolBarFill,
                    { width: `${Math.round((count / totalTasks) * 100)}%`, backgroundColor: color }
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </Animated.View>

    </ScrollView>
  );
}

// â”€â”€â”€ Estilos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lifeTheme.colors.background
  },
  content: {
    padding: lifeTheme.spacing.lg,
    gap: lifeTheme.spacing.lg,
    paddingBottom: 48
  },
  hero: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.lg,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: lifeTheme.spacing.lg,
    overflow: 'hidden',
    gap: 8
  },
  maestriaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${lifeTheme.colors.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    alignSelf: 'flex-start',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${lifeTheme.colors.primary}30`
  },
  maestriaIcon: { fontSize: 18 },
  maestriaText: { 
    color: lifeTheme.colors.primary, 
    fontSize: 14, 
    fontWeight: '800'
  },
  glowAccent: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(108, 252, 184, 0.1)'
  },
  kicker: {
    color: lifeTheme.colors.success,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  heroTitle: {
    color: lifeTheme.colors.text,
    fontSize: 28,
    fontWeight: '800'
  },
  heroSub: {
    color: lifeTheme.colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  section: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: lifeTheme.spacing.lg,
    gap: lifeTheme.spacing.md
  },
  sectionTitle: {
    color: lifeTheme.colors.text,
    fontSize: 16,
    fontWeight: '800'
  },
  statRow: {
    flexDirection: 'row',
    gap: 10
  },
  statCard: {
    flex: 1,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: 14,
    gap: 4
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statIcon: {
    fontSize: 14,
    opacity: 0.8
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900'
  },
  statLabel: {
    color: lifeTheme.colors.muted,
    fontSize: 11
  },
  progressBlock: {
    gap: 8,
    marginTop: 4
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  progressLabel: {
    color: lifeTheme.colors.muted,
    fontSize: 13
  },
  progressPct: {
    color: lifeTheme.colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  progressTrack: {
    height: 6,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  progressFill: {
    height: '100%',
    borderRadius: 999
  },
  infoCard: {
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: lifeTheme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    marginBottom: 4
  },
  infoText: {
    color: lifeTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic'
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  energyGauge: {
    flex: 1,
    height: 10,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  energyFill: {
    height: '100%',
    borderRadius: 999
  },
  energyPct: {
    color: lifeTheme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    width: 46,
    textAlign: 'right'
  },
  energySub: {
    color: lifeTheme.colors.muted,
    fontSize: 12
  },
  loadBars: {
    gap: 10,
    marginTop: 4
  },
  hbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  hbarLabel: {
    color: lifeTheme.colors.muted,
    fontSize: 12,
    width: 80
  },
  hbarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: 999,
    overflow: 'hidden'
  },
  hbarFill: {
    height: '100%',
    borderRadius: 999
  },
  hbarCount: {
    fontSize: 13,
    fontWeight: '800',
    width: 24,
    textAlign: 'right'
  },
  sparklineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 8
  },
  sparkCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6
  },
  sparkCount: {
    color: lifeTheme.colors.muted,
    fontSize: 11
  },
  sparkBar: {
    width: 24,
    borderRadius: 6
  },
  sparkDay: {
    color: lifeTheme.colors.muted,
    fontSize: 11,
    textTransform: 'capitalize'
  },
  sparkDayToday: {
    color: lifeTheme.colors.primary,
    fontWeight: '800'
  },
  poolGrid: {
    flexDirection: 'row',
    gap: 10
  },
  poolCard: {
    flex: 1,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: lifeTheme.radius.sm,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: 14,
    gap: 6
  },
  poolValue: {
    fontSize: 24,
    fontWeight: '800'
  },
  poolLabel: {
    color: lifeTheme.colors.muted,
    fontSize: 11
  },
  poolBarTrack: {
    height: 3,
    backgroundColor: lifeTheme.colors.border,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4
  },
  poolBarFill: {
    height: '100%',
    borderRadius: 999,
    opacity: 0.85
  }
});

