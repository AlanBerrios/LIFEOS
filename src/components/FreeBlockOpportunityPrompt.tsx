import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';
import type { ScheduleOverflowCandidate } from '../store/lifeStore.types';
import { FormSheet } from './FormSheet';
import { AppButton } from './ui';

interface FreeBlockOpportunityPromptProps {
  visible: boolean;
  candidateTasks: ScheduleOverflowCandidate[];
  recommendedTaskId?: string;
  totalMinutes: number;
  usableMinutes: number;
  bufferMinutes: number;
  onPickTask: (taskId: string) => void;
  onDismiss: () => void;
}

export function FreeBlockOpportunityPrompt({
  visible,
  candidateTasks,
  recommendedTaskId,
  totalMinutes,
  usableMinutes,
  bufferMinutes,
  onPickTask,
  onDismiss
}: FreeBlockOpportunityPromptProps): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);

  return (
    <FormSheet visible={visible} onClose={onDismiss} align="center" animationType="fade">
        <View style={styles.card}>
          <Text style={styles.title}>Bloque libre disponible</Text>
          <Text style={styles.subtitle}>
            Hay {totalMinutes} min libres. Puedo dejar {bufferMinutes} min de descanso al inicio y al final, y usar {usableMinutes} min para avanzar una tarea.
          </Text>

          <View style={styles.infoRow}>
            <View style={styles.infoChip}>
              <Text style={styles.infoLabel}>Libre</Text>
              <Text style={styles.infoValue}>{totalMinutes} min</Text>
            </View>
            <View style={styles.infoChip}>
              <Text style={styles.infoLabel}>Trabajo posible</Text>
              <Text style={styles.infoValue}>{usableMinutes} min</Text>
            </View>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled>
            {candidateTasks.map((task) => {
              const recommended = task.id === recommendedTaskId;
              return (
                <Pressable
                  key={task.id}
                  style={[
                    styles.taskRow,
                    recommended && { borderColor: lifeTheme.colors.primary, backgroundColor: `${lifeTheme.colors.primary}12` }
                  ]}
                  onPress={() => onPickTask(task.id)}
                >
                  <View style={styles.taskMain}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskMeta}>
                      P{task.priority} - {task.urgency.toUpperCase()} - {task.eta_minutes} min - carga {task.cognitive_load}
                    </Text>
                  </View>
                  <Text style={[styles.pickLabel, recommended && { color: lifeTheme.colors.primary }]}>
                    {recommended ? 'Sugerida' : 'Usar'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <AppButton label="Dejar libre" variant="outlined" onPress={onDismiss} fullWidth />
          </View>
        </View>
    </FormSheet>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    card: {
      gap: lifeTheme.spacing.sm,
      maxHeight: '78%'
    },
    title: {
      color: lifeTheme.colors.text,
      fontSize: 18,
      fontWeight: '800'
    },
    subtitle: {
      color: lifeTheme.colors.muted,
      fontSize: 13,
      lineHeight: 18
    },
    infoRow: {
      flexDirection: 'row',
      gap: 8
    },
    infoChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 10,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    infoLabel: {
      color: lifeTheme.colors.muted,
      fontSize: 11,
      fontWeight: '700'
    },
    infoValue: {
      color: lifeTheme.colors.text,
      fontSize: 16,
      fontWeight: '800'
    },
    list: {
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 10,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      minHeight: 110,
      maxHeight: 260
    },
    listContent: {
      padding: 8,
      gap: 8
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 9,
      backgroundColor: lifeTheme.colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    taskMain: {
      flex: 1,
      gap: 2
    },
    taskTitle: {
      color: lifeTheme.colors.text,
      fontSize: 13,
      fontWeight: '800'
    },
    taskMeta: {
      color: lifeTheme.colors.muted,
      fontSize: 10,
      fontWeight: '600'
    },
    pickLabel: {
      color: lifeTheme.colors.text,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    actions: {
      flexDirection: 'row',
      gap: 10
    },
  });
}
