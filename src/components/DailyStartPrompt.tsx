import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';
import { useLifeStore } from '../store/useLifeStore';
import { getTodayStr } from '../utils/date';
import type { ReactElement } from 'react';
import { useState, useMemo } from 'react';
import { Clock, AlertCircle, Edit3 } from 'lucide-react-native';

interface DailyStartPromptProps {
  visible: boolean;
  onDismiss: () => void;
  onStartDay: () => void;
  onCaptureQuick: () => void;
  onRestDay: () => void;
}

export function DailyStartPrompt({
  visible,
  onDismiss,
  onStartDay,
  onCaptureQuick,
  onRestDay
}: DailyStartPromptProps): ReactElement {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  const timeline = useLifeStore((s) => s.timeline);
  const tasks = useLifeStore((s) => s.tasks);
  const routines = useLifeStore((s) => s.routines);

  // Contar tareas en pool (sin agendar para hoy)
  const poolTasksCount = useMemo(() => {
    const today = getTodayStr();
    return tasks.filter((t) => t.status === 'pool').length;
  }, [tasks]);

  // Contar bloques de tarea en timeline de hoy
  const scheduledTasksCount = useMemo(() => {
    const today = getTodayStr();
    return timeline.filter((block) => block.type === 'task').length;
  }, [timeline]);

  // Si hay plan, mostrar resumen
  const hasSchedule = timeline.length > 2; // Más que solo sleep/descanso
  const hasTasks = scheduledTasksCount > 0 || poolTasksCount > 0;

  const timelinePreview = useMemo(() => {
    return timeline.slice(0, 5); // Primeros 5 bloques
  }, [timeline]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Cabecera */}
            <View style={styles.header}>
              <Clock size={32} color={theme.colors.primary} strokeWidth={2} />
              <Text style={styles.title}>¿Listos para hoy?</Text>
            </View>

            {/* Resumen del día */}
            <View style={styles.summaryCard}>
              {hasTasks ? (
                <>
                  <Text style={styles.summaryLabel}>
                    Tu plan de hoy: {scheduledTasksCount > 0 ? scheduledTasksCount : poolTasksCount} tareas
                  </Text>
                  {poolTasksCount > 0 && scheduledTasksCount === 0 && (
                    <Text style={styles.summaryHint}>
                      ({poolTasksCount} en el pool, listas para agendar)
                    </Text>
                  )}
                  
                  {/* Preview del timeline */}
                  {timelinePreview.length > 0 && (
                    <View style={styles.timelinePreview}>
                      <Text style={styles.previewLabel}>Próximos bloques:</Text>
                      {timelinePreview.map((block, idx) => (
                        <View key={block.id} style={styles.timelineItem}>
                          <Text style={styles.timelineTime}>
                            {block.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text style={styles.timelineTitle} numberOfLines={1}>
                            {block.title}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.emptyState}>
                    <AlertCircle size={40} color={theme.colors.muted} strokeWidth={1.5} />
                    <Text style={styles.emptyStateTitle}>Sin tareas para hoy</Text>
                    <Text style={styles.emptyStateHint}>
                      Tu calendario está en blanco. ¿Capturar tareas rápidamente o declarar día de descanso?
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Acciones */}
            <View style={styles.actionsContainer}>
              {/* Botón principal: Empezar día */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && { opacity: 0.8 }
                ]}
                onPress={onStartDay}
              >
                <Clock size={20} color={theme.colors.background} strokeWidth={2} />
                <Text style={styles.primaryButtonText}>Empezar día</Text>
              </Pressable>

              {/* Botón secundario: Capturar rápido */}
              {!hasTasks && (
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && { opacity: 0.7 }
                  ]}
                  onPress={onCaptureQuick}
                >
                  <Edit3 size={18} color={theme.colors.primary} strokeWidth={2} />
                  <Text style={styles.secondaryButtonText}>Capturar tareas rápido</Text>
                </Pressable>
              )}

              {/* Botón terciario: Descanso */}
              {!hasTasks && (
                <Pressable
                  style={({ pressed }) => [
                    styles.tertiaryButton,
                    pressed && { opacity: 0.7 }
                  ]}
                  onPress={onRestDay}
                >
                  <Text style={styles.tertiaryButtonText}>Hoy es día de descanso</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center'
    },
    container: {
      flex: 1,
      paddingHorizontal: 16,
      justifyContent: 'flex-start'
    },
    scrollContent: {
      paddingBottom: 32
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 24,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: -0.5
    },
    summaryCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    summaryLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4
    },
    summaryHint: {
      fontSize: 13,
      color: theme.colors.muted,
      marginBottom: 12
    },
    timelinePreview: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: 8
    },
    previewLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 4
    },
    timelineItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 6
    },
    timelineTime: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.primary,
      minWidth: 40
    },
    timelineTitle: {
      fontSize: 13,
      color: theme.colors.text,
      flex: 1
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      gap: 12
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginTop: 8
    },
    emptyStateHint: {
      fontSize: 13,
      color: theme.colors.muted,
      textAlign: 'center',
      lineHeight: 18
    },
    actionsContainer: {
      gap: 12,
      marginBottom: 16
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 20,
      gap: 8
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.background,
      letterSpacing: -0.3
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 20,
      gap: 8,
      borderWidth: 1.5,
      borderColor: theme.colors.primary
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.primary,
      letterSpacing: -0.3
    },
    tertiaryButton: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: 'transparent'
    },
    tertiaryButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.muted,
      textAlign: 'center',
      textDecorationLine: 'underline'
    }
  });
