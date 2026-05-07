import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLifeStore } from '../../src/store/useLifeStore';
import { useAppTheme } from '../../src/theme';

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
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function getShortDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es', { weekday: 'short' }).slice(0, 3);
}

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  accent: string;
  delay?: number;
}

function StatCard({ label, value, icon, accent, delay = 0 }: StatCardProps): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(260)} style={styles.statCard}>
      <View style={styles.statCardHeader}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

interface BarProps {
  label: string;
  progress: number;
  count: number;
  color: string;
  delay?: number;
}

function HBar({ label, progress, count, color, delay = 0 }: BarProps): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);

  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(260)} style={styles.hbarRow}>
      <Text style={styles.hbarLabel}>{label}</Text>
      <View style={styles.hbarTrack}>
        <View style={[styles.hbarFill, { width: `${Math.max(2, Math.min(progress, 1) * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.hbarCount, { color }]}>{count}</Text>
    </Animated.View>
  );
}

function InfoModal({
  visible,
  title,
  body,
  onClose
}: {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalBody}>{body}</Text>
          <Pressable style={styles.modalCloseBtn} onPress={onClose}>
            <Text style={styles.modalCloseText}>Entendido</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function StatsScreen(): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const tasks = useLifeStore((s) => s.tasks);
  const timeline = useLifeStore((s) => s.timeline);
  const sessions = useLifeStore((s) => s.sessions);
  const dailyEnergyReports = useLifeStore((s) => s.daily_energy_reports);
  const userProfile = useLifeStore((s) => s.userProfile);

  const [showEnergyInfo, setShowEnergyInfo] = useState(false);

  const today = todayISO();
  const todaySession = sessions.find((s) => s.date === today);
  const last7 = getLast7Days();
  const sessionMap = Object.fromEntries(sessions.map((s) => [s.date, s]));
  const taskMap = Object.fromEntries(tasks.map((task) => [task.id, task]));

  const plannedTaskBlocks = timeline.filter((block) => block.type === 'task' && !!block.task_id);
  const effectiveTaskBlocks = plannedTaskBlocks.filter((block) => {
    const task = block.task_id ? taskMap[block.task_id] : undefined;
    return task?.status !== 'postponed';
  });

  const completedToday = todaySession?.tasksCompleted ?? tasks.filter((t) => t.status === 'completed').length;
  const skippedToday = todaySession?.tasksSkipped ?? tasks.filter((t) => t.status === 'skipped').length;
  const postponedToday = todaySession?.tasksPostponed ?? tasks.filter((t) => t.status === 'postponed').length;
  const scheduledToday = todaySession?.tasksScheduled ?? plannedTaskBlocks.length;
  const totalWork = effectiveTaskBlocks.reduce(
    (sum, block) => sum + (block.end_time.getTime() - block.start_time.getTime()) / 60_000,
    0
  );

  const poolCount = tasks.filter((t) => t.status === 'pool').length;
  const scheduledCount = tasks.filter((t) => t.status === 'scheduled').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = Math.max(tasks.length, 1);

  const maxCompleted = Math.max(1, ...last7.map((d) => sessionMap[d]?.tasksCompleted ?? 0));

  const taskBlocks = timeline.filter((b) => b.type === 'task');
  let lowLoad = 0;
  let midLoad = 0;
  let highLoad = 0;

  for (const block of taskBlocks) {
    const task = block.task_id ? taskMap[block.task_id] : null;
    if (!task) continue;

    if (task.cognitive_load <= 3) lowLoad += 1;
    else if (task.cognitive_load <= 6) midLoad += 1;
    else highLoad += 1;
  }

  const maxLoad = Math.max(lowLoad, midLoad, highLoad, 1);

  const totalDrain = todaySession?.totalCognitiveDrain ?? 0;
  const dailyBudget = 600;
  const drainPercent = Math.min(100, Math.round((totalDrain / dailyBudget) * 100));
  const remainingBudget = Math.max(0, dailyBudget - totalDrain);

  const energyTelemetry = dailyEnergyReports.find((report) => report.date === today)?.telemetry ??
    todaySession?.energy_reported?.telemetry ?? null;

  const completionRate = scheduledToday > 0 ? Math.round((completedToday / scheduledToday) * 100) : 0;
  const avgLast7 =
    Math.round(
      (last7.reduce((acc, day) => acc + (sessionMap[day]?.tasksCompleted ?? 0), 0) / last7.length) * 10
    ) / 10;

  const unlockedBadges = userProfile.badges.length;
  const knownAchievementsCount = 50;
  const knownSecretsCount = 15;

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)} style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroKicker}>Sistema Operativo Personal</Text>
          <Text style={styles.heroTitle}>Estadísticas</Text>
          <Text style={styles.heroSub}>Panel simplificado de hoy con acceso a detalle avanzado.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(260)} style={styles.section}>
          <Text style={styles.sectionTitle}>1. Resumen de Hoy</Text>
          <View style={styles.statGrid}>
            <StatCard label="Completadas" value={`${completedToday}`} icon="✅" accent={lifeTheme.colors.success} delay={80} />
            <StatCard label="Saltadas" value={`${skippedToday}`} icon="⏭️" accent={lifeTheme.colors.muted} delay={120} />
            <StatCard label="Pospuestas" value={`${postponedToday}`} icon="⏳" accent={'#f59e0b'} delay={160} />
            <StatCard label="Planificadas" value={`${scheduledToday}`} icon="⚡" accent={lifeTheme.colors.primary} delay={200} />
            <StatCard label="Trabajo total" value={formatMinutes(Math.round(totalWork))} icon="⏲️" accent={lifeTheme.colors.text} delay={240} />
          </View>

          {scheduledToday > 0 && (
            <View style={styles.progressWrap}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Progreso del día</Text>
                <Text style={styles.progressValue}>{completionRate}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${completionRate}%`, backgroundColor: lifeTheme.colors.success }]} />
              </View>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(110).duration(260)} style={styles.section}>
          <Text style={styles.sectionTitle}>2. Estado del Pool</Text>
          <View style={styles.poolGrid}>
            {[
              { label: 'En pool', count: poolCount, color: lifeTheme.colors.muted },
              { label: 'Programadas', count: scheduledCount, color: lifeTheme.colors.primary },
              { label: 'Completadas', count: completedCount, color: lifeTheme.colors.success }
            ].map(({ label, count, color }) => (
              <View key={label} style={styles.poolCard}>
                <Text style={[styles.poolValue, { color }]}>{count}</Text>
                <Text style={styles.poolLabel}>{label}</Text>
                <View style={styles.poolTrack}>
                  <View style={[styles.poolFill, { width: `${Math.round((count / totalTasks) * 100)}%`, backgroundColor: color }]} />
                </View>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(260)} style={styles.section}>
          <Text style={styles.sectionTitle}>3. Últimos 7 Días</Text>
          <View style={styles.sparklineRow}>
            {last7.map((date, i) => {
              const completed = sessionMap[date]?.tasksCompleted ?? 0;
              const barHeight = completed === 0 ? 4 : Math.max(12, Math.round((completed / maxCompleted) * 80));
              const isToday = date === today;
              return (
                <Animated.View key={date} entering={FadeInDown.delay(i * 40).duration(220)} style={styles.sparkCol}>
                  <Text style={styles.sparkCount}>{completed > 0 ? completed : ''}</Text>
                  <View
                    style={[
                      styles.sparkBar,
                      {
                        height: barHeight,
                        backgroundColor: isToday
                          ? lifeTheme.colors.primary
                          : completed > 0
                          ? `${lifeTheme.colors.primary}66`
                          : lifeTheme.colors.border
                      }
                    ]}
                  />
                  <Text style={[styles.sparkDay, isToday && styles.sparkDayToday]}>{getShortDay(date)}</Text>
                </Animated.View>
              );
            })}
          </View>
          <Text style={styles.smallHint}>Promedio diario: {avgLast7} tareas completadas.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(190).duration(260)} style={styles.section}>
          <Text style={styles.sectionTitle}>4. Atributos y Habilidades</Text>
          <View style={styles.loadBars}>
            <HBar label="🧠 Enfoque" progress={Math.min(1, userProfile.skills.focus / 500)} count={userProfile.skills.focus} color={lifeTheme.colors.primary} delay={200} />
            <HBar label="⚡ Vitalidad" progress={Math.min(1, userProfile.skills.vitality / 500)} count={userProfile.skills.vitality} color={lifeTheme.colors.success} delay={240} />
            <HBar label="🛡️ Disciplina" progress={Math.min(1, userProfile.skills.discipline / 500)} count={userProfile.skills.discipline} color={'#fb923c'} delay={280} />
            <HBar label="📜 Sabiduría" progress={Math.min(1, userProfile.skills.wisdom / 500)} count={userProfile.skills.wisdom} color={'#818cf8'} delay={320} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(230).duration(260)} style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>5. Energía Cognitiva</Text>
            <Pressable style={styles.inlineInfoBtn} onPress={() => setShowEnergyInfo(true)}>
              <Text style={styles.inlineInfoText}>Info</Text>
            </Pressable>
          </View>

          <View style={styles.energyTopRow}>
            <Text style={styles.energyMain}>{drainPercent}%</Text>
            <View>
              <Text style={styles.energyLabel}>Drenaje actual</Text>
              <Text style={styles.energySub}>{totalDrain} / {dailyBudget} unidades</Text>
              <Text style={styles.energySub}>Restante estimado: {Math.round(remainingBudget)} unidades</Text>
            </View>
          </View>

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

          <View style={styles.loadBars}>
            <HBar label="Carga baja (1-3)" progress={lowLoad / maxLoad} count={lowLoad} color={lifeTheme.colors.success} delay={260} />
            <HBar label="Carga media (4-6)" progress={midLoad / maxLoad} count={midLoad} color={'#f59e0b'} delay={300} />
            <HBar label="Carga alta (7-10)" progress={highLoad / maxLoad} count={highLoad} color={lifeTheme.colors.alert} delay={340} />
          </View>

          <View style={styles.energyTipsRow}>
            <View style={styles.tipChip}><Text style={styles.tipChipText}>Prioriza bloques de alta carga al inicio</Text></View>
            <View style={styles.tipChip}><Text style={styles.tipChipText}>Inserta descansos si pasas 70%</Text></View>
            <View style={styles.tipChip}><Text style={styles.tipChipText}>Agrupa tareas simples al cierre</Text></View>
          </View>

          {energyTelemetry && (
            <Text style={styles.smallHint}>
              Telemetría: match {Math.round(energyTelemetry.suggestedHitRate * 100)}% · calibración {energyTelemetry.calibration}.
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(270).duration(260)} style={styles.section}>
          <Text style={styles.sectionTitle}>6. Logros RPG</Text>
          <View style={styles.achievementsSummaryRow}>
            <View style={styles.achievementMiniCard}>
              <Text style={styles.achievementMiniValue}>{unlockedBadges}</Text>
              <Text style={styles.achievementMiniLabel}>Desbloqueados</Text>
            </View>
            <View style={styles.achievementMiniCard}>
              <Text style={styles.achievementMiniValue}>{knownAchievementsCount}</Text>
              <Text style={styles.achievementMiniLabel}>Catálogo total</Text>
            </View>
            <View style={styles.achievementMiniCard}>
              <Text style={styles.achievementMiniValue}>{knownSecretsCount}</Text>
              <Text style={styles.achievementMiniLabel}>Secretos</Text>
            </View>
          </View>
          <Text style={styles.smallHint}>Catálogo ampliado con logros comunes, épicos, legendarios y secretos.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/achievements' as any)}>
            <Text style={styles.primaryBtnText}>Abrir página de Logros RPG</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(310).duration(260)} style={styles.section}>
          <Text style={styles.sectionTitle}>7. Métricas</Text>
          <View style={styles.simpleMetricsRow}>
            <View style={styles.simpleMetricCard}>
              <Text style={styles.simpleMetricValue}>{completionRate}%</Text>
              <Text style={styles.simpleMetricLabel}>Cumplimiento hoy</Text>
            </View>
            <View style={styles.simpleMetricCard}>
              <Text style={styles.simpleMetricValue}>{avgLast7}</Text>
              <Text style={styles.simpleMetricLabel}>Promedio 7 días</Text>
            </View>
            <View style={styles.simpleMetricCard}>
              <Text style={styles.simpleMetricValue}>{userProfile.consistency.currentStreak}</Text>
              <Text style={styles.simpleMetricLabel}>Racha actual</Text>
            </View>
          </View>
          <Text style={styles.smallHint}>Vista rápida para decisiones del día. El análisis completo vive en la pantalla avanzada.</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.push('/advanced-metrics' as any)}>
            <Text style={styles.secondaryBtnText}>Ver Métricas Avanzadas</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <InfoModal
        visible={showEnergyInfo}
        title="Cómo leer la Energía Cognitiva"
        body={`La energía cognitiva estima cuánto esfuerzo mental consumió tu jornada.\n\n• Presupuesto base: 600 unidades/día.\n• Drenaje: suma de carga cognitiva × duración real.\n• Zona recomendada: 40%-70%.\n\nInterpretación:\n- < 50%: margen para tareas exigentes.\n- 50%-79%: mantener ritmo con pausas.\n- 80%+: riesgo de fatiga y menor calidad.\n\nRecomendaciones avanzadas:\n1) Coloca tareas de alta carga en tu ventana de mayor energía.\n2) Encadena tareas medias y cierra con tareas bajas.\n3) Si el drenaje sube demasiado, replanifica o reduce carga.`}
        onClose={() => setShowEnergyInfo(false)}
      />
    </>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: lifeTheme.colors.background
    },
    content: {
      padding: lifeTheme.spacing.lg,
      gap: lifeTheme.spacing.lg
    },
    hero: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: lifeTheme.radius.lg,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: lifeTheme.spacing.lg,
      gap: 8,
      overflow: 'hidden'
    },
    heroGlow: {
      position: 'absolute',
      right: -24,
      top: -24,
      width: 120,
      height: 120,
      borderRadius: 999,
      backgroundColor: `${lifeTheme.colors.primary}22`
    },
    heroKicker: {
      color: lifeTheme.colors.success,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase'
    },
    heroTitle: {
      color: lifeTheme.colors.text,
      fontSize: 24,
      fontWeight: '900'
    },
    heroSub: {
      color: lifeTheme.colors.muted,
      fontSize: 12,
      lineHeight: 18
    },
    section: {
      backgroundColor: lifeTheme.colors.surface,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: lifeTheme.radius.lg,
      padding: lifeTheme.spacing.lg,
      gap: 12
    },
    sectionTitle: {
      color: lifeTheme.colors.text,
      fontSize: 14,
      fontWeight: '800',
      textTransform: 'uppercase'
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    inlineInfoBtn: {
      borderWidth: 1,
      borderColor: `${lifeTheme.colors.primary}55`,
      backgroundColor: `${lifeTheme.colors.primary}14`,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4
    },
    inlineInfoText: {
      color: lifeTheme.colors.primary,
      fontSize: 12,
      fontWeight: '800'
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10
    },
    statCard: {
      flexBasis: '48%',
      flexGrow: 1,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 8
    },
    statCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    statIcon: {
      fontSize: 18
    },
    statValue: {
      fontSize: 22,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    statLabel: {
      color: lifeTheme.colors.muted,
      fontSize: 12,
      fontWeight: '700'
    },
    progressWrap: {
      marginTop: 4,
      gap: 8
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    progressLabel: {
      color: lifeTheme.colors.text,
      fontSize: 12,
      fontWeight: '700'
    },
    progressValue: {
      color: lifeTheme.colors.success,
      fontSize: 12,
      fontWeight: '800',
      fontFamily: 'monospace'
    },
    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: lifeTheme.colors.border,
      overflow: 'hidden'
    },
    progressFill: {
      height: '100%',
      borderRadius: 999
    },
    poolGrid: {
      flexDirection: 'row',
      gap: 10
    },
    poolCard: {
      flex: 1,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 8
    },
    poolValue: {
      fontSize: 24,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    poolLabel: {
      color: lifeTheme.colors.muted,
      fontSize: 12,
      fontWeight: '700'
    },
    poolTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: lifeTheme.colors.border,
      overflow: 'hidden'
    },
    poolFill: {
      height: '100%',
      borderRadius: 999
    },
    sparklineRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 6,
      minHeight: 106
    },
    sparkCol: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6
    },
    sparkCount: {
      color: lifeTheme.colors.text,
      fontSize: 10,
      fontWeight: '700',
      minHeight: 12,
      fontFamily: 'monospace'
    },
    sparkBar: {
      width: 18,
      borderRadius: 8,
      minHeight: 4
    },
    sparkDay: {
      color: lifeTheme.colors.muted,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase'
    },
    sparkDayToday: {
      color: lifeTheme.colors.primary
    },
    loadBars: {
      gap: 10
    },
    hbarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    hbarLabel: {
      width: 120,
      color: lifeTheme.colors.text,
      fontSize: 12,
      fontWeight: '700'
    },
    hbarTrack: {
      flex: 1,
      height: 8,
      borderRadius: 999,
      backgroundColor: lifeTheme.colors.border,
      overflow: 'hidden'
    },
    hbarFill: {
      height: '100%',
      borderRadius: 999
    },
    hbarCount: {
      width: 40,
      textAlign: 'right',
      fontSize: 12,
      fontWeight: '800',
      fontFamily: 'monospace'
    },
    energyTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14
    },
    energyMain: {
      color: lifeTheme.colors.text,
      fontSize: 34,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    energyLabel: {
      color: lifeTheme.colors.text,
      fontSize: 13,
      fontWeight: '700'
    },
    energySub: {
      color: lifeTheme.colors.muted,
      fontSize: 12,
      lineHeight: 18
    },
    energyGauge: {
      height: 12,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: lifeTheme.colors.border
    },
    energyFill: {
      height: '100%',
      borderRadius: 999
    },
    energyTipsRow: {
      gap: 8
    },
    tipChip: {
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    tipChipText: {
      color: lifeTheme.colors.text,
      fontSize: 12,
      fontWeight: '600'
    },
    achievementsSummaryRow: {
      flexDirection: 'row',
      gap: 10
    },
    achievementMiniCard: {
      flex: 1,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 4
    },
    achievementMiniValue: {
      color: lifeTheme.colors.primary,
      fontSize: 24,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    achievementMiniLabel: {
      color: lifeTheme.colors.muted,
      fontSize: 11,
      fontWeight: '700'
    },
    primaryBtn: {
      marginTop: 2,
      backgroundColor: lifeTheme.colors.primary,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12
    },
    primaryBtnText: {
      color: lifeTheme.colors.onPrimary,
      fontSize: 13,
      fontWeight: '800'
    },
    simpleMetricsRow: {
      flexDirection: 'row',
      gap: 10
    },
    simpleMetricCard: {
      flex: 1,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 4
    },
    simpleMetricValue: {
      color: lifeTheme.colors.text,
      fontSize: 22,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    simpleMetricLabel: {
      color: lifeTheme.colors.muted,
      fontSize: 11,
      fontWeight: '700'
    },
    secondaryBtn: {
      marginTop: 2,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: lifeTheme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      backgroundColor: `${lifeTheme.colors.primary}12`
    },
    secondaryBtnText: {
      color: lifeTheme.colors.primary,
      fontSize: 13,
      fontWeight: '800'
    },
    smallHint: {
      color: lifeTheme.colors.muted,
      fontSize: 11,
      lineHeight: 17
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24
    },
    modalCard: {
      width: '100%',
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 16,
      gap: 12
    },
    modalTitle: {
      color: lifeTheme.colors.text,
      fontSize: 16,
      fontWeight: '800'
    },
    modalBody: {
      color: lifeTheme.colors.text,
      fontSize: 13,
      lineHeight: 20
    },
    modalCloseBtn: {
      alignSelf: 'flex-end',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: lifeTheme.colors.primary
    },
    modalCloseText: {
      color: lifeTheme.colors.onPrimary,
      fontSize: 12,
      fontWeight: '800'
    }
  });
}
