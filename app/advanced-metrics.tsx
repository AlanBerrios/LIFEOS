import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Modal } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLifeStore } from '../src/store/useLifeStore';
import { useAppTheme } from '../src/theme';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdvancedMetricsScreen(): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const sessions = useLifeStore((s) => s.sessions);
  const replanHistory = useLifeStore((s) => s.replan_history);
  const lastReplanReason = useLifeStore((s) => s.last_replan_reason);
  const schedulerParity = useLifeStore((s) => s.last_scheduler_parity);
  const dailyEnergyReports = useLifeStore((s) => s.daily_energy_reports);

  const [detailModal, setDetailModal] = useState<{ title: string; items: string[] } | null>(null);

  const today = todayISO();
  const todaySession = sessions.find((s) => s.date === today);
  const energyTelemetry = dailyEnergyReports.find((report) => report.date === today)?.telemetry ??
    todaySession?.energy_reported?.telemetry ?? null;
  const todayReplans = replanHistory.filter((entry) => entry.timestamp.toISOString().slice(0, 10) === today);
  const latestReplan = todayReplans[todayReplans.length - 1] ?? replanHistory[replanHistory.length - 1] ?? null;
  const replanHistoryLabels = todayReplans.length > 0
    ? todayReplans.map((entry) => {
        const time = entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const direction = entry.decision === 'accepted' ? 'Aceptada' : 'Rechazada';
        return `${time} · ${direction} · ${entry.reason} · ${entry.previousBlocks}→${entry.nextBlocks} bloques (${entry.diffMinutes >= 0 ? '+' : ''}${entry.diffMinutes} min)`;
      })
    : ['No hubo replanificaciones hoy.'];

  const MetricCard = ({ title, icon, value, unit, hint, details }: {
    title: string;
    icon: string;
    value: string | number;
    unit: string;
    hint: string;
    details: string[];
  }) => (
    <Pressable
      style={styles.metricCard}
      onPress={() => setDetailModal({ title, items: details })}
    >
      <View style={styles.metricHeader}>
        <Text style={styles.metricIcon}>{icon}</Text>
        <View style={styles.metricTitles}>
          <Text style={styles.metricTitle}>{title}</Text>
          <Text style={styles.metricHint}>{hint}</Text>
        </View>
      </View>
      <View style={styles.metricValue}>
        <Text style={[styles.metricValueText, { color: lifeTheme.colors.primary }]}>
          {value}
        </Text>
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
    </Pressable>
  );

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Atrás</Text>
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Métricas Avanzadas</Text>
            <Text style={styles.headerSub}>Análisis detallado de tu rendimiento</Text>
          </View>
        </Animated.View>

        {/* Scheduler Parity */}
        <Animated.View entering={FadeInDown.delay(80).duration(300)}>
          <Text style={styles.sectionTitle}>Arquitectura de Planificación</Text>
          <MetricCard
            title="Paridad Local/Remoto"
            icon="🔄"
            value={schedulerParity ? schedulerParity.metrics.divergenceScore : '-'}
            unit={`/ ${schedulerParity?.threshold ?? 'N/A'}`}
            hint={
              schedulerParity
                ? schedulerParity.status === 'remote_unavailable'
                  ? 'Fallback local activo'
                  : schedulerParity.summary
                : 'Sin datos'
            }
            details={
              schedulerParity
                ? [
                    schedulerParity.summary,
                    `Estado: ${schedulerParity.status}`,
                    `Score divergencia: ${schedulerParity.metrics.divergenceScore}/${schedulerParity.threshold}`,
                    `Tareas comunes: ${schedulerParity.metrics.commonTaskCount}`,
                    `Solo local: ${schedulerParity.metrics.onlyLocalCount}`,
                    `Solo remoto: ${schedulerParity.metrics.onlyRemoteCount}`,
                    `Delta inicio promedio: ${schedulerParity.metrics.avgStartDeltaMinutes} min`,
                    `Delta duración promedio: ${schedulerParity.metrics.avgDurationDeltaMinutes} min`,
                    schedulerParity.remote?.available
                      ? `Motor remoto: ${schedulerParity.remote.engine ?? 'desconocido'} · solver: ${schedulerParity.remote.solverStatus ?? 'n/a'}`
                      : `Fallback activo: ${schedulerParity.remote?.error ?? 'backend no disponible'}`,
                    `Última verificación: ${schedulerParity.checkedAt.toLocaleString('es-ES')}`
                  ]
                : ['Aún no hay verificación de paridad. Genera o replanifica timeline para calcularla.']
            }
          />
        </Animated.View>

        {/* Replan Activity */}
        <Animated.View entering={FadeInDown.delay(130).duration(300)}>
          <Text style={styles.sectionTitle}>Actividad de Replanificación</Text>
          <MetricCard
            title="Replanificaciones Hoy"
            icon="📋"
            value={todayReplans.length}
            unit="cambios"
            hint={
              latestReplan
                ? `Último: ${latestReplan.reason}`
                : 'Sin cambios hoy'
            }
            details={replanHistoryLabels}
          />
          {latestReplan && (
            <View style={styles.replanDetail}>
              <Text style={styles.detailLabel}>Última Replanificación:</Text>
              <Text style={styles.detailValue}>
                {latestReplan.decision === 'accepted' ? 'Aceptada' : 'Rechazada'}
              </Text>
              <Text style={styles.detailValue}>
                {latestReplan.previousBlocks} → {latestReplan.nextBlocks} bloques
              </Text>
              <Text style={styles.detailValue}>
                {latestReplan.diffMinutes >= 0 ? '+' : ''}{latestReplan.diffMinutes} min
              </Text>
              <Text style={styles.detailHint}>{latestReplan.reason}</Text>
              {lastReplanReason && (
                <Text style={styles.detailHint}>Contexto: {lastReplanReason}</Text>
              )}
            </View>
          )}
        </Animated.View>

        {/* Energy Telemetry */}
        <Animated.View entering={FadeInDown.delay(180).duration(300)}>
          <Text style={styles.sectionTitle}>Telemetría de Energía Cognitiva</Text>
          <MetricCard
            title="Acierto en Sugerencias"
            icon="🎯"
            value={energyTelemetry ? `${Math.round(energyTelemetry.suggestedHitRate * 100)}` : '-'}
            unit="%"
            hint={
              energyTelemetry
                ? (energyTelemetry.calibration === 'aligned'
                    ? 'Ajuste estable'
                    : energyTelemetry.calibration === 'under'
                    ? 'Sugiere ↑ exigencia'
                    : 'Sugiere ↓ exigencia')
                : 'Sin reporte'
            }
            details={
              energyTelemetry
                ? [
                    `Calibración: ${energyTelemetry.calibration}`,
                    `Tareas completadas: ${energyTelemetry.completedTaskCount}`,
                    `Acierto en sugerencias: ${Math.round(energyTelemetry.suggestedHitRate * 100)}%`,
                    `Carga observada: ${energyTelemetry.observedAverageLoad.toFixed(1)} / esperada ${energyTelemetry.expectedAverageLoad.toFixed(1)}`,
                    `Prioridad media: ${energyTelemetry.observedAveragePriority.toFixed(1)}`,
                    `ETA medio: ${Math.round(energyTelemetry.observedAverageEtaMinutes)} min`,
                    `Sesgo aplicado: ${energyTelemetry.biasDelta >= 0 ? '+' : ''}${energyTelemetry.biasDelta.toFixed(2)}`,
                    `Evaluado: ${energyTelemetry.evaluatedAt.toLocaleString('es-ES')}`
                  ]
                : ['Todavía no hay telemetría. Completa tareas para calibrar.']
            }
          />

          {energyTelemetry && (
            <View style={styles.energyBreakdown}>
              <View style={styles.energyRow}>
                <Text style={styles.energyLabel}>Carga observada</Text>
                <Text style={styles.energyValue}>
                  {energyTelemetry.observedAverageLoad.toFixed(1)}
                </Text>
              </View>
              <View style={styles.energyRow}>
                <Text style={styles.energyLabel}>Carga esperada</Text>
                <Text style={styles.energyValue}>
                  {energyTelemetry.expectedAverageLoad.toFixed(1)}
                </Text>
              </View>
              <View style={styles.energyRow}>
                <Text style={styles.energyLabel}>Prioridad media</Text>
                <Text style={styles.energyValue}>
                  {energyTelemetry.observedAveragePriority.toFixed(1)}
                </Text>
              </View>
              <View style={styles.energyRow}>
                <Text style={styles.energyLabel}>ETA medio</Text>
                <Text style={styles.energyValue}>
                  {Math.round(energyTelemetry.observedAverageEtaMinutes)} min
                </Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Historical Replans */}
        <Animated.View entering={FadeInDown.delay(230).duration(300)}>
          <Text style={styles.sectionTitle}>Historial Completo</Text>
          <MetricCard
            title="Replanificaciones Registradas"
            icon="📜"
            value={replanHistory.length}
            unit="total"
            hint="Toca para ver el registro completo"
            details={replanHistory
              .map((entry) => {
                const time = entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const date = entry.timestamp.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                const direction = entry.decision === 'accepted' ? 'Aceptada' : 'Rechazada';
                return `${date} ${time} · ${direction} · ${entry.reason} · ${entry.previousBlocks}→${entry.nextBlocks} bloques (${entry.diffMinutes >= 0 ? '+' : ''}${entry.diffMinutes} min)`;
              })
              .reverse()}
          />
        </Animated.View>

        {/* Summary Stats */}
        <Animated.View entering={FadeInDown.delay(280).duration(300)} style={styles.summaryStats}>
          <Text style={styles.sectionTitle}>Resumen General</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {sessions.length}
              </Text>
              <Text style={styles.statLabel}>Sesiones totales</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {replanHistory.length}
              </Text>
              <Text style={styles.statLabel}>Replanificaciones</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {dailyEnergyReports.length}
              </Text>
              <Text style={styles.statLabel}>Reportes energía</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={detailModal != null} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDetailModal(null)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>{detailModal?.title}</Text>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              {detailModal?.items.map((item, idx) => (
                <View key={`${item}-${idx}`} style={styles.modalItem}>
                  <Text style={styles.modalItemText}>{item}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setDetailModal(null)}
            >
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
      padding: lifeTheme.spacing.lg,
      gap: lifeTheme.spacing.lg
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8
    },
    backBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: `${lifeTheme.colors.primary}20`,
      borderRadius: 8
    },
    backBtnText: {
      color: lifeTheme.colors.primary,
      fontWeight: '600',
      fontSize: 14
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '900',
      color: lifeTheme.colors.text
    },
    headerSub: {
      fontSize: 12,
      color: lifeTheme.colors.muted,
      marginTop: 2
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: lifeTheme.colors.muted,
      marginBottom: 12,
      marginTop: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    metricCard: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: lifeTheme.radius.md,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: lifeTheme.spacing.md,
      marginBottom: 12,
      gap: 12
    },
    metricHeader: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start'
    },
    metricIcon: {
      fontSize: 28,
      marginTop: 4
    },
    metricTitles: {
      flex: 1,
      gap: 4
    },
    metricTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: lifeTheme.colors.text
    },
    metricHint: {
      fontSize: 12,
      color: lifeTheme.colors.muted
    },
    metricValue: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6
    },
    metricValueText: {
      fontSize: 28,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    metricUnit: {
      fontSize: 12,
      color: lifeTheme.colors.muted,
      fontWeight: '500'
    },
    replanDetail: {
      backgroundColor: `${lifeTheme.colors.primary}10`,
      borderRadius: lifeTheme.radius.md,
      borderLeftWidth: 3,
      borderLeftColor: lifeTheme.colors.primary,
      padding: lifeTheme.spacing.md,
      gap: 6,
      marginBottom: 12
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: lifeTheme.colors.muted,
      textTransform: 'uppercase'
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '600',
      color: lifeTheme.colors.text
    },
    detailHint: {
      fontSize: 12,
      color: lifeTheme.colors.muted,
      fontStyle: 'italic'
    },
    energyBreakdown: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: lifeTheme.radius.md,
      padding: lifeTheme.spacing.md,
      gap: 8,
      marginBottom: 12
    },
    energyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: lifeTheme.colors.border
    },
    energyLabel: {
      fontSize: 12,
      color: lifeTheme.colors.muted
    },
    energyValue: {
      fontSize: 14,
      fontWeight: '700',
      color: lifeTheme.colors.primary,
      fontFamily: 'monospace'
    },
    summaryStats: {
      marginTop: 12
    },
    statsGrid: {
      flexDirection: 'row',
      gap: lifeTheme.spacing.md
    },
    statCard: {
      flex: 1,
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: lifeTheme.radius.md,
      padding: lifeTheme.spacing.md,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      alignItems: 'center',
      justifyContent: 'center'
    },
    statValue: {
      fontSize: 20,
      fontWeight: '900',
      color: lifeTheme.colors.primary,
      fontFamily: 'monospace',
      marginBottom: 4
    },
    statLabel: {
      fontSize: 11,
      color: lifeTheme.colors.muted,
      fontWeight: '500'
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: lifeTheme.spacing.lg
    },
    modalCard: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: lifeTheme.radius.lg,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: lifeTheme.spacing.lg,
      maxHeight: '80%',
      width: '100%'
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: lifeTheme.colors.text,
      marginBottom: 12
    },
    modalScroll: {
      maxHeight: 300,
      marginBottom: 12
    },
    modalContent: {
      gap: 8
    },
    modalItem: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: `${lifeTheme.colors.primary}10`,
      borderRadius: 6,
      borderLeftWidth: 2,
      borderLeftColor: lifeTheme.colors.primary
    },
    modalItemText: {
      fontSize: 12,
      color: lifeTheme.colors.text,
      lineHeight: 18
    },
    modalCloseBtn: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: lifeTheme.colors.primary,
      borderRadius: lifeTheme.radius.md,
      alignItems: 'center'
    },
    modalCloseBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff'
    }
  });
}
