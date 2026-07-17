import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLifeStore } from '../src/store/useLifeStore';
import { useAppTheme } from '../src/theme';
import type { ScheduleBlock } from '../src/types';

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  if (safeMinutes < 60) return `${safeMinutes} min`;
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function blockMinutes(block: ScheduleBlock): number {
  return Math.max(0, Math.round((block.end_time.getTime() - block.start_time.getTime()) / 60_000));
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

type DetailModal = {
  title: string;
  items: string[];
} | null;

type MetricCardProps = {
  title: string;
  value: string;
  label: string;
  hint: string;
  accent?: string;
  details: string[];
  onPress: (detail: DetailModal) => void;
};

function MetricCard({ title, value, label, hint, accent, details, onPress }: MetricCardProps): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);

  return (
    <Pressable
      style={({ pressed }) => [styles.metricCard, pressed && styles.pressed]}
      onPress={() => onPress({ title, items: details })}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalle de ${title}`}
    >
      <Text style={styles.metricTitle}>{title}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color: accent ?? lifeTheme.colors.primary }]}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricHint}>{hint}</Text>
    </Pressable>
  );
}

export default function AdvancedMetricsScreen(): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const tasks = useLifeStore((s) => s.tasks);
  const timeline = useLifeStore((s) => s.timeline);
  const completedGhostBlocks = useLifeStore((s) => s.completedGhostBlocks);
  const sessions = useLifeStore((s) => s.sessions);
  const executionRecords = useLifeStore((s) => s.execution_records);
  const replanHistory = useLifeStore((s) => s.replan_history);
  const transitRecords = useLifeStore((s) => s.transit_arrival_records);
  const dailyEnergyReports = useLifeStore((s) => s.daily_energy_reports);
  const schedulerParity = useLifeStore((s) => s.last_scheduler_parity);

  const [detailModal, setDetailModal] = useState<DetailModal>(null);

  const today = localDateKey(new Date());
  const todaySession = sessions.find((session) => session.date === today);
  const todayExecutions = executionRecords.filter((record) => localDateKey(record.created_at) === today);
  const todayReplans = replanHistory.filter((entry) => localDateKey(entry.timestamp) === today);
  const todayTransit = transitRecords.filter((record) => record.date === today);
  const todayEnergy = dailyEnergyReports.find((report) => report.date === today);

  const scheduledToday = todaySession?.tasksScheduled ?? timeline.filter((block) => block.type === 'task').length;
  const completedToday = todaySession?.tasksCompleted ?? todayExecutions.filter((record) => record.status === 'completed').length;
  const completionRate = percent(completedToday, scheduledToday);

  const skippedToday = todaySession?.tasksSkipped ?? todayExecutions.filter((record) => record.status === 'skipped').length;
  const postponedToday = todaySession?.tasksPostponed ?? todayExecutions.filter((record) => record.status === 'postponed').length;
  const workMinutes = todaySession?.totalWorkMinutes ??
    todayExecutions.reduce((sum, record) => sum + Math.max(0, record.work_minutes), 0);

  const etaRecords = todayExecutions.filter((record) => record.estimated_minutes > 0 && record.work_minutes > 0);
  const etaDeltaAvg = etaRecords.length > 0
    ? Math.round(etaRecords.reduce((sum, record) => sum + (record.work_minutes - record.estimated_minutes), 0) / etaRecords.length)
    : 0;

  const acceptedReplans = todayReplans.filter((entry) => entry.decision === 'accepted').length;
  const rejectedReplans = todayReplans.filter((entry) => entry.decision === 'rejected').length;
  const replanDiffMinutes = todayReplans.reduce((sum, entry) => sum + entry.diffMinutes, 0);

  const todayBlocks = [...timeline, ...completedGhostBlocks]
    .filter((block) => localDateKey(block.start_time) === today)
    .sort((a, b) => a.start_time.getTime() - b.start_time.getTime());
  const freeBlocks = todayBlocks.filter((block) => block.type === 'rest' && block.title === 'Libre');
  const freeMinutes = freeBlocks.reduce((sum, block) => sum + blockMinutes(block), 0);
  const opportunityBlocks = freeBlocks.filter((block) => blockMinutes(block) >= 30);

  const lateTransit = todayTransit.filter((record) => record.response === 'late');
  const answeredTransit = todayTransit.filter((record) => record.response !== 'dismissed');
  const avgTransitDelay = answeredTransit.length > 0
    ? Math.round(answeredTransit.reduce((sum, record) => sum + Math.max(0, record.delayMinutes), 0) / answeredTransit.length)
    : 0;
  const avgObservedTransit = answeredTransit.length > 0
    ? Math.round(answeredTransit.reduce((sum, record) => sum + (record.observedDurationMinutes ?? 0), 0) / answeredTransit.length)
    : 0;

  const energyHitRate = todayEnergy?.telemetry
    ? `${Math.round(todayEnergy.telemetry.suggestedHitRate * 100)}%`
    : todayEnergy
      ? `Nivel ${todayEnergy.level}`
      : '-';

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return localDateKey(date);
  });
  const sevenDayCompleted = lastSevenDays.reduce((sum, date) => {
    const session = sessions.find((item) => item.date === date);
    return sum + (session?.tasksCompleted ?? 0);
  }, 0);
  const sevenDayAvg = Math.round((sevenDayCompleted / 7) * 10) / 10;

  const activeTasks = tasks.filter((task) => task.status !== 'completed').length;
  const completedTasks = tasks.filter((task) => task.status === 'completed').length;

  const completionDetails = [
    `Completadas hoy: ${completedToday}`,
    `Planificadas hoy: ${scheduledToday}`,
    `Saltadas: ${skippedToday}`,
    `Pospuestas: ${postponedToday}`,
    `Trabajo registrado: ${formatMinutes(workMinutes)}`,
    `Promedio 7 dias: ${sevenDayAvg} tareas completadas/dia`
  ];

  const executionDetails = todayExecutions.length > 0
    ? todayExecutions
        .slice()
        .reverse()
        .map((record) => {
          const task = tasks.find((item) => item.id === record.task_id);
          const delta = record.work_minutes - record.estimated_minutes;
          return `${task?.title ?? record.task_id}: ${record.status} · real ${formatMinutes(record.work_minutes)} · ETA ${formatMinutes(record.estimated_minutes)} · delta ${delta >= 0 ? '+' : ''}${delta} min`;
        })
    : ['Todavia no hay registros de ejecucion hoy. Completa, salta o pospone tareas para alimentar esta metrica.'];

  const replanDetails = todayReplans.length > 0
    ? todayReplans
        .slice()
        .reverse()
        .map((entry) => `${formatTime(entry.timestamp)} · ${entry.decision === 'accepted' ? 'Aceptada' : 'Rechazada'} · ${entry.reason} · ${entry.previousBlocks}->${entry.nextBlocks} bloques · ${entry.diffMinutes >= 0 ? '+' : ''}${entry.diffMinutes} min`)
    : ['No hubo replanificaciones hoy.'];

  const freeDetails = freeBlocks.length > 0
    ? freeBlocks.map((block) => `${formatTime(block.start_time)}-${formatTime(block.end_time)} · ${formatMinutes(blockMinutes(block))}${blockMinutes(block) >= 30 ? ' · oportunidad de avance' : ' · buffer corto'}`)
    : ['No hay bloques Libre visibles para hoy.'];

  const transitDetails = todayTransit.length > 0
    ? todayTransit.map((record) => `${record.transitLabel}: ${record.response === 'late' ? 'tarde' : record.response === 'on_time' ? 'a tiempo' : 'omitido'} · atraso ${record.delayMinutes} min · duracion observada ${record.observedDurationMinutes ?? '-'} min`)
    : ['No hay observaciones de transito registradas hoy.'];

  const energyDetails = todayEnergy
    ? [
        `Nivel reportado: ${todayEnergy.level}`,
        `Fatiga: ${todayEnergy.fatigue}`,
        todayEnergy.note ? `Nota: ${todayEnergy.note}` : 'Sin nota.',
        todayEnergy.telemetry
          ? `Acierto sugerencias: ${Math.round(todayEnergy.telemetry.suggestedHitRate * 100)}%`
          : 'Sin telemetria de tareas completadas todavia.',
        todayEnergy.telemetry
          ? `Calibracion: ${todayEnergy.telemetry.calibration}`
          : 'Completa tareas para calibrar sugerencias.'
      ]
    : ['No registraste energia hoy.'];

  const schedulerDetails = schedulerParity
    ? [
        schedulerParity.summary,
        `Estado: ${schedulerParity.status}`,
        `Divergencia: ${schedulerParity.metrics.divergenceScore}/${schedulerParity.threshold}`,
        `Solo local: ${schedulerParity.metrics.onlyLocalCount}`,
        `Solo remoto: ${schedulerParity.metrics.onlyRemoteCount}`,
        schedulerParity.remote?.available
          ? `Backend remoto disponible: ${schedulerParity.remote.engine ?? 'desconocido'}`
          : `Backend remoto no disponible: ${schedulerParity.remote?.error ?? 'sin detalle'}`
      ]
    : ['Sin verificacion tecnica de scheduler. Esto no afecta el uso local diario.'];

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(260)} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Atras</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Metricas de Uso</Text>
            <Text style={styles.headerSub}>Que paso hoy y que patron se esta formando.</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(260)} style={styles.summaryBand}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{completionRate}%</Text>
            <Text style={styles.summaryLabel}>Cumplimiento</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{todayReplans.length}</Text>
            <Text style={styles.summaryLabel}>Replanes</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatMinutes(freeMinutes)}</Text>
            <Text style={styles.summaryLabel}>Libre hoy</Text>
          </View>
        </Animated.View>

        <View style={styles.metricGrid}>
          <MetricCard
            title="Cumplimiento del dia"
            value={`${completionRate}%`}
            label={`${completedToday}/${scheduledToday || 0}`}
            hint={scheduledToday > 0 ? 'Relacion entre tareas completadas y planificadas.' : 'Organiza el dia para medir cumplimiento.'}
            accent={lifeTheme.colors.success}
            details={completionDetails}
            onPress={setDetailModal}
          />
          <MetricCard
            title="Ejecucion real"
            value={`${todayExecutions.length}`}
            label="registros"
            hint={etaRecords.length > 0 ? `Delta ETA promedio ${etaDeltaAvg >= 0 ? '+' : ''}${etaDeltaAvg} min.` : 'Aun falta ejecucion registrada para calibrar ETA.'}
            details={executionDetails}
            onPress={setDetailModal}
          />
          <MetricCard
            title="Reorganizacion"
            value={`${todayReplans.length}`}
            label={`${acceptedReplans} ok / ${rejectedReplans} no`}
            hint={todayReplans.length > 0 ? `Cambio neto ${replanDiffMinutes >= 0 ? '+' : ''}${replanDiffMinutes} min.` : 'Sin cambios de plan hoy.'}
            accent="#f59e0b"
            details={replanDetails}
            onPress={setDetailModal}
          />
          <MetricCard
            title="Huecos libres"
            value={formatMinutes(freeMinutes)}
            label={`${opportunityBlocks.length} oportunidades`}
            hint="Libre largo deberia transformarse en descanso, avance o decision consciente."
            accent="#38bdf8"
            details={freeDetails}
            onPress={setDetailModal}
          />
          <MetricCard
            title="Transito observado"
            value={answeredTransit.length > 0 ? `${lateTransit.length}/${answeredTransit.length}` : '-'}
            label="tarde"
            hint={answeredTransit.length > 0 ? `Atraso medio ${avgTransitDelay} min · duracion ${avgObservedTransit} min.` : 'Responde prompts de llegada para aprender.'}
            accent={lifeTheme.colors.alert}
            details={transitDetails}
            onPress={setDetailModal}
          />
          <MetricCard
            title="Energia de hoy"
            value={energyHitRate}
            label={todayEnergy?.telemetry ? 'match' : 'estado'}
            hint={todayEnergy ? 'Usa energia para ajustar exigencia, no como juicio.' : 'Registra energia para mejorar sugerencias.'}
            accent="#a78bfa"
            details={energyDetails}
            onPress={setDetailModal}
          />
        </View>

        <Animated.View entering={FadeInDown.delay(120).duration(260)} style={styles.section}>
          <Text style={styles.sectionTitle}>Tendencia reciente</Text>
          <View style={styles.trendRow}>
            <View style={styles.trendCard}>
              <Text style={styles.trendValue}>{sevenDayAvg}</Text>
              <Text style={styles.trendLabel}>tareas/dia 7d</Text>
            </View>
            <View style={styles.trendCard}>
              <Text style={styles.trendValue}>{completedTasks}</Text>
              <Text style={styles.trendLabel}>completadas total</Text>
            </View>
            <View style={styles.trendCard}>
              <Text style={styles.trendValue}>{activeTasks}</Text>
              <Text style={styles.trendLabel}>activas</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(260)} style={styles.techSection}>
          <View style={{ flex: 1 }}>
            <Text style={styles.techTitle}>Estado tecnico del scheduler</Text>
            <Text style={styles.techText}>
              {schedulerParity ? schedulerParity.summary : 'Sin verificacion reciente. El scheduler local sigue siendo el runtime principal.'}
            </Text>
          </View>
          <Pressable style={styles.techBtn} onPress={() => setDetailModal({ title: 'Scheduler tecnico', items: schedulerDetails })}>
            <Text style={styles.techBtnText}>Detalle</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <Modal visible={detailModal != null} transparent animationType="fade" onRequestClose={() => setDetailModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDetailModal(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{detailModal?.title}</Text>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              {(detailModal?.items ?? []).map((item, index) => (
                <View key={`${item}-${index}`} style={styles.modalItem}>
                  <Text style={styles.modalItemText}>{item}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCloseBtn} onPress={() => setDetailModal(null)}>
              <Text style={styles.modalCloseBtnText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
      paddingHorizontal: 14,
      gap: 12
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
    },
    backBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: `${lifeTheme.colors.primary}18`,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: `${lifeTheme.colors.primary}30`
    },
    backBtnText: {
      color: lifeTheme.colors.primary,
      fontWeight: '800',
      fontSize: 12
    },
    headerTitle: {
      color: lifeTheme.colors.text,
      fontSize: 23,
      fontWeight: '900'
    },
    headerSub: {
      color: lifeTheme.colors.muted,
      fontSize: 12,
      lineHeight: 17
    },
    summaryBand: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 10
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
      gap: 2
    },
    summaryValue: {
      color: lifeTheme.colors.text,
      fontSize: 17,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    summaryLabel: {
      color: lifeTheme.colors.muted,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      textAlign: 'center'
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    metricCard: {
      width: '48.8%',
      minHeight: 148,
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 11,
      gap: 8
    },
    pressed: {
      opacity: 0.75
    },
    metricTitle: {
      color: lifeTheme.colors.text,
      fontSize: 13,
      fontWeight: '900',
      lineHeight: 16
    },
    metricValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 5,
      flexWrap: 'wrap'
    },
    metricValue: {
      fontSize: 24,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    metricLabel: {
      color: lifeTheme.colors.muted,
      fontSize: 10,
      fontWeight: '800'
    },
    metricHint: {
      color: lifeTheme.colors.muted,
      fontSize: 11,
      lineHeight: 15
    },
    section: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 12,
      gap: 10
    },
    sectionTitle: {
      color: lifeTheme.colors.text,
      fontSize: 14,
      fontWeight: '900'
    },
    trendRow: {
      flexDirection: 'row',
      gap: 8
    },
    trendCard: {
      flex: 1,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 10,
      gap: 2
    },
    trendValue: {
      color: lifeTheme.colors.primary,
      fontSize: 20,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    trendLabel: {
      color: lifeTheme.colors.muted,
      fontSize: 10,
      fontWeight: '700'
    },
    techSection: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 12
    },
    techTitle: {
      color: lifeTheme.colors.text,
      fontSize: 13,
      fontWeight: '900'
    },
    techText: {
      color: lifeTheme.colors.muted,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2
    },
    techBtn: {
      backgroundColor: `${lifeTheme.colors.primary}18`,
      borderWidth: 1,
      borderColor: `${lifeTheme.colors.primary}35`,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    techBtnText: {
      color: lifeTheme.colors.primary,
      fontSize: 12,
      fontWeight: '800'
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.62)',
      justifyContent: 'center',
      padding: 20
    },
    modalCard: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 16,
      gap: 12,
      maxHeight: '82%'
    },
    modalTitle: {
      color: lifeTheme.colors.text,
      fontSize: 17,
      fontWeight: '900'
    },
    modalScroll: {
      maxHeight: 360
    },
    modalContent: {
      gap: 8
    },
    modalItem: {
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    modalItemText: {
      color: lifeTheme.colors.text,
      fontSize: 12,
      lineHeight: 17
    },
    modalCloseBtn: {
      alignSelf: 'flex-end',
      backgroundColor: lifeTheme.colors.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 9
    },
    modalCloseBtnText: {
      color: lifeTheme.colors.onPrimary,
      fontSize: 12,
      fontWeight: '800'
    }
  });
}
