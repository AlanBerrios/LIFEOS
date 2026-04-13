import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Modal, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../../src/store/useLifeStore';
import { useAppTheme } from '../../src/theme';
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

function StatCard({ label, value, icon, accent, delay = 0 }: StatCardProps): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const resolvedAccent = accent ?? lifeTheme.colors.primary;
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={styles.statCard}>
      <View style={styles.statCardHeader}>
        <Text style={[styles.statValue, { color: resolvedAccent, fontFamily: 'monospace' }]}>{value}</Text>
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
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
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
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const insets = useSafeAreaInsets();
  const tasks = useLifeStore((s) => s.tasks);
  const timeline = useLifeStore((s) => s.timeline);
  const sessions = useLifeStore((s) => s.sessions);
  const userProfile = useLifeStore((s) => s.userProfile);
  const [summaryDetail, setSummaryDetail] = useState<{ title: string; items: string[] } | null>(null);

  const today = todayISO();
  const todaySession: DailySession | undefined = sessions.find((s) => s.date === today);
  const last7 = getLast7Days();
  const sessionMap = Object.fromEntries(sessions.map((s) => [s.date, s]));
  const taskMap = Object.fromEntries(tasks.map((task) => [task.id, task]));

  const plannedTaskBlocks = timeline.filter((block) => block.type === 'task' && !!block.task_id);
  const workBlocksWithoutPostponed = plannedTaskBlocks.filter((block) => {
    const task = block.task_id ? taskMap[block.task_id] : undefined;
    return task?.status !== 'postponed';
  });

  const plannedTaskLabels = plannedTaskBlocks.map((block) => {
    const task = block.task_id ? taskMap[block.task_id] : undefined;
    const title = task?.title ?? block.title;
    const start = block.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const end = block.end_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${title} (${start}-${end})`;
  });

  const totalWorkLabels = workBlocksWithoutPostponed.map((block) => {
    const task = block.task_id ? taskMap[block.task_id] : undefined;
    const title = task?.title ?? block.title;
    const mins = Math.round((block.end_time.getTime() - block.start_time.getTime()) / 60_000);
    return `${title} (${mins} min)`;
  });

  // ── Métricas del día actual ──────────────────────────────────────────────────
  const completedToday = tasks.filter((t) => t.status === 'completed').length;
  const scheduledToday = plannedTaskBlocks.length;
  const totalWork = workBlocksWithoutPostponed.reduce(
    (sum, block) => sum + (block.end_time.getTime() - block.start_time.getTime()) / 60_000,
    0
  );
  const totalDrain = todaySession?.totalCognitiveDrain ?? 0;

  const completedTaskLabels = tasks
    .filter((task) => task.status === 'completed')
    .map((task) => task.title);
  const skippedTaskLabels = tasks
    .filter((task) => task.status === 'skipped')
    .map((task) => task.title);
  const postponedTaskLabels = tasks
    .filter((task) => task.status === 'postponed')
    .map((task) => task.title);

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
  const xpToNextLevel = (userProfile.level * 100) - userProfile.currentXP;

  const [showMasteryInfo, setShowMasteryInfo] = useState(false);
  const [showXpInfo, setShowXpInfo] = useState(false);
  const [showSkillsInfo, setShowSkillsInfo] = useState(false);

  return (
    <>
    <ScrollView 
      style={styles.screen} 
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >

      {/* Hero */}
      <Animated.View entering={FadeInDown.duration(350)} style={styles.hero}>
        <View style={styles.glowAccent} />
        
        <Pressable style={styles.maestriaBadge} onPress={() => setShowMasteryInfo(true)}>
          <Text style={styles.maestriaIcon}>📈</Text>
          <Text style={styles.maestriaText}>Maestría Personal</Text>
        </Pressable>

        <Text style={styles.kicker}>Sistema Operativo Personal</Text>
        <View style={styles.heroLevelRow}>
           <Pressable style={styles.heroLevelBadge} onPress={() => setShowXpInfo(true)}>
             <Text style={styles.heroLevelValue}>{userProfile.level}</Text>
           </Pressable>
          <View>
            <Text style={styles.heroTitle}>Estadísticas</Text>
            <Text style={styles.heroLevelLabel}>Nivel de Jugador</Text>
          </View>
        </View>
        <Text style={styles.heroSub}>
          Un vistazo a tu productividad cognitiva de hoy y los últimos 7 días.
        </Text>
      </Animated.View>

      {/* Resumen del dÃ­a */}
      <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.section}>
        <Text style={styles.sectionTitle}>Resumen de Hoy</Text>
        <View style={styles.statRow}>
          <Pressable
            style={styles.statPressable}
            onPress={() => setSummaryDetail({ title: 'Completadas', items: completedTaskLabels })}
          >
            <StatCard
              label="Completadas"
              value={`${completedToday}`}
              icon="✅"
              accent={lifeTheme.colors.success}
              delay={100}
            />
          </Pressable>
          <Pressable
            style={styles.statPressable}
            onPress={() => setSummaryDetail({ title: 'Saltadas', items: skippedTaskLabels })}
          >
            <StatCard
              label="Saltadas"
              value={`${tasks.filter(t => t.status === 'skipped').length}`}
              icon="⏭️"
              accent={lifeTheme.colors.muted}
              delay={140}
            />
          </Pressable>
          <Pressable
            style={styles.statPressable}
            onPress={() => setSummaryDetail({ title: 'Pospuestas', items: postponedTaskLabels })}
          >
            <StatCard
              label="Pospuestas"
              value={`${tasks.filter(t => t.status === 'postponed').length}`}
              icon="⏳"
              accent={'#f59e0b'}
              delay={180}
            />
          </Pressable>
        </View>
        
        <View style={[styles.statRow, { marginTop: 10 }]}>
          <Pressable
            style={styles.statPressable}
            onPress={() => setSummaryDetail({ title: 'Planificadas', items: plannedTaskLabels })}
          >
            <StatCard
              label="Planificadas"
              value={`${scheduledToday}`}
              icon="⚡"
              accent={lifeTheme.colors.primary}
              delay={220}
            />
          </Pressable>
          <Pressable
            style={styles.statPressable}
            onPress={() => setSummaryDetail({ title: 'Trabajo total (sin pospuestas)', items: totalWorkLabels })}
          >
            <StatCard
              label="Trabajo total"
              value={formatMinutes(Math.round(totalWork))}
              icon="⏲️"
              accent={lifeTheme.colors.text}
              delay={260}
            />
          </Pressable>
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

      {/* Skills & Attributes */}
      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Atributos y Habilidades</Text>
          <Pressable onPress={() => setShowSkillsInfo(true)}>
            <Text style={styles.infoLink}>¿Cómo funciona?</Text>
          </Pressable>
        </View>
        <View style={styles.loadBars}>
          <HBar
            label="🧠 Enfoque"
            progress={Math.min(1, userProfile.skills.focus / 500)}
            color={lifeTheme.colors.primary}
            count={userProfile.skills.focus}
            delay={200}
          />
          <HBar
            label="⚡ Vitalidad"
            progress={Math.min(1, userProfile.skills.vitality / 500)}
            color={lifeTheme.colors.success}
            count={userProfile.skills.vitality}
            delay={260}
          />
          <HBar
            label="🛡️ Disciplina"
            progress={Math.min(1, userProfile.skills.discipline / 500)}
            color={'#fb923c'}
            count={userProfile.skills.discipline}
            delay={320}
          />
          <HBar
            label="📜 Sabiduría"
            progress={Math.min(1, userProfile.skills.wisdom / 500)}
            color={'#818cf8'}
            count={userProfile.skills.wisdom}
            delay={380}
          />
        </View>
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

      <InfoModal
        visible={showMasteryInfo}
        title="Maestría Personal"
        body={`Este panel resume tu consistencia diaria, tu carga cognitiva y tu progreso histórico.\n\nÚsalo para detectar patrones: cuándo rindes mejor, cuántas tareas completas realmente y si estás sobrecargando tu día.`}
        onClose={() => setShowMasteryInfo(false)}
      />

      <InfoModal
        visible={showXpInfo}
        title="Nivel y Experiencia"
        body={`Tu nivel sube cuando acumulas EXP en cualquier categoría.\n\nNivel actual: ${userProfile.level}\nEXP actual: ${userProfile.currentXP}\nFaltan: ${xpToNextLevel} EXP para el siguiente nivel.`}
        onClose={() => setShowXpInfo(false)}
      />

      <InfoModal
        visible={showSkillsInfo}
        title="Atributos y Habilidades"
        body={`• Enfoque: crece al completar tareas de trabajo.\n• Vitalidad: crece con hábitos saludables y energía diaria.\n• Disciplina: crece cuando sostienes rutinas y consistencia.\n• Sabiduría: crece al capturar notas y reflexiones útiles.\n\nCada atributo suma al progreso general de tu perfil.`}
        onClose={() => setShowSkillsInfo(false)}
      />

      <SummaryDetailModal
        visible={summaryDetail != null}
        title={summaryDetail?.title ?? ''}
        items={summaryDetail?.items ?? []}
        onClose={() => setSummaryDetail(null)}
      />
    </>
  );
}

function SummaryDetailModal({
  visible,
  title,
  items,
  onClose
}: {
  visible: boolean;
  title: string;
  items: string[];
  onClose: () => void;
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          {items.length === 0 ? (
            <Text style={styles.modalBody}>No hay elementos para mostrar.</Text>
          ) : (
            <ScrollView style={styles.summaryList} contentContainerStyle={styles.summaryListContent}>
              {items.map((item, idx) => (
                <View key={`${item}-${idx}`} style={styles.summaryListItem}>
                  <Text style={styles.summaryListItemText}>{item}</Text>
                </View>
              ))}
            </ScrollView>
          )}
          <Pressable style={styles.modalCloseBtn} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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

// â”€â”€â”€ Estilos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
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
  heroLevelRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  heroLevelBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: lifeTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  heroLevelValue: { color: 'white', fontSize: 28, fontWeight: '900' },
  heroLevelLabel: { color: lifeTheme.colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
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
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  infoLink: {
    color: lifeTheme.colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  statRow: {
    flexDirection: 'row',
    gap: 10
  },
  statPressable: { flex: 1 },
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  modalCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: 18,
    gap: 10
  },
  modalTitle: {
    color: lifeTheme.colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  modalBody: {
    color: lifeTheme.colors.muted,
    fontSize: 14,
    lineHeight: 21
  },
  summaryList: { maxHeight: 280 },
  summaryListContent: { gap: 8, paddingTop: 2 },
  summaryListItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  summaryListItemText: {
    color: lifeTheme.colors.text,
    fontSize: 13,
    lineHeight: 18
  },
  modalCloseBtn: {
    marginTop: 4,
    backgroundColor: lifeTheme.colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11
  },
  modalCloseText: {
    color: lifeTheme.colors.onPrimary,
    fontSize: 13,
    fontWeight: '800'
  }
  });
}

