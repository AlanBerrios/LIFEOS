import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';
import type { ScheduleOverflowCandidate } from '../store/lifeStore.types';
import { FormSheet } from './FormSheet';
import { AppButton } from './ui';

interface ScheduleOverflowPromptProps {
  visible: boolean;
  candidateTasks: ScheduleOverflowCandidate[];
  recommendedTaskIds: string[];
  maxSelections: number;
  reason: string;
  onConfirm: (taskIds: string[]) => void;
  onDismiss: () => void;
}

export function ScheduleOverflowPrompt({
  visible,
  candidateTasks,
  recommendedTaskIds,
  maxSelections,
  reason,
  onConfirm,
  onDismiss
}: ScheduleOverflowPromptProps): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const [selectedIds, setSelectedIds] = useState<string[]>(recommendedTaskIds);

  useEffect(() => {
    if (!visible) return;
    setSelectedIds(recommendedTaskIds.length > 0 ? recommendedTaskIds : candidateTasks.slice(0, maxSelections).map((task) => task.id));
  }, [visible, recommendedTaskIds, candidateTasks, maxSelections]);

  const toggleTask = (taskId: string) => {
    setSelectedIds((current) => {
      if (current.includes(taskId)) {
        return current.filter((id) => id !== taskId);
      }
      if (current.length >= maxSelections) {
        return current;
      }
      return [...current, taskId];
    });
  };

  const handleApply = () => {
    const next = selectedIds.length > 0 ? selectedIds : recommendedTaskIds;
    onConfirm(next);
  };

  return (
    <FormSheet visible={visible} onClose={onDismiss} align="center" animationType="fade">
        <View style={styles.card}>
          <Text style={styles.title}>No cabe todo hoy</Text>
          <Text style={styles.subtitle}>{reason}</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoChip}><Text style={styles.infoLabel}>Máx. a proteger</Text><Text style={styles.infoValue}>{maxSelections}</Text></View>
            <View style={styles.infoChip}><Text style={styles.infoLabel}>Sugeridas</Text><Text style={styles.infoValue}>{recommendedTaskIds.length}</Text></View>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled>
            {candidateTasks.map((task) => {
              const selected = selectedIds.includes(task.id);
              const recommended = recommendedTaskIds.includes(task.id);
              return (
                <Pressable
                  key={task.id}
                  onPress={() => toggleTask(task.id)}
                  style={[
                    styles.taskRow,
                    selected && { borderColor: lifeTheme.colors.primary, backgroundColor: `${lifeTheme.colors.primary}15` }
                  ]}
                >
                  <View style={styles.taskMain}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskMeta}>
                      P{task.priority} · {task.urgency.toUpperCase()} · {task.eta_minutes} min · carga {task.cognitive_load}
                    </Text>
                  </View>
                  <View style={styles.taskState}>
                    {recommended && <Text style={styles.recommended}>Sugerida</Text>}
                    <Text style={[styles.checkbox, selected && { color: lifeTheme.colors.primary }]}>{selected ? '☑' : '☐'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <View style={styles.action}><AppButton label="Cancelar" variant="outlined" onPress={onDismiss} fullWidth /></View>
            <View style={styles.action}><AppButton label="Aplicar selección" onPress={handleApply} fullWidth /></View>
          </View>
        </View>
    </FormSheet>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    card: {
      gap: lifeTheme.spacing.sm,
      maxHeight: '82%'
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
      borderRadius: 12,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 10
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
      borderRadius: 12,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      minHeight: 140,
      maxHeight: 280
    },
    listContent: {
      padding: 10,
      gap: 8
    },
    taskRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 10,
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
      fontWeight: '700'
    },
    taskMeta: {
      color: lifeTheme.colors.muted,
      fontSize: 10,
      fontWeight: '600'
    },
    taskState: {
      alignItems: 'flex-end',
      gap: 2
    },
    recommended: {
      color: lifeTheme.colors.primary,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase'
    },
    checkbox: {
      color: lifeTheme.colors.text,
      fontSize: 20,
      fontWeight: '900'
    },
    actions: {
      flexDirection: 'row',
      gap: 10
    },
    action: { flex: 1 },
  });
}
