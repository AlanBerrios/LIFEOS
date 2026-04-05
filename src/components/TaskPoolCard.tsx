import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactElement } from 'react';
import { formatDuration } from '../utils/time';
import { lifeTheme } from '../theme';
import type { Task } from '../types';

interface TaskPoolCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onComplete: (taskId: string) => void;
}

function getStatusLabel(task: Task): string {
  switch (task.status) {
    case 'scheduled':
      return 'Programada';
    case 'completed':
      return 'Completada';
    default:
      return 'En pool';
  }
}

export function TaskPoolCard({ task, onEdit, onDelete, onComplete }: TaskPoolCardProps): ReactElement {
  const isCompleted = task.status === 'completed';
  const accentColor =
    task.status === 'completed'
      ? lifeTheme.colors.success
      : task.status === 'scheduled'
        ? lifeTheme.colors.primary
        : lifeTheme.colors.text;

  return (
    <Pressable
      onPress={() => onEdit(task)}
      style={({ pressed }: { pressed: boolean }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.row}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{task.title}</Text>
          {task.description ? <Text style={styles.description}>{task.description}</Text> : null}
        </View>
        <View style={[styles.badge, { borderColor: accentColor }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>{getStatusLabel(task)}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>ETA {formatDuration(task.eta_minutes)}</Text>
        <Text style={styles.meta}>P{task.priority}</Text>
        <Text style={styles.meta}>Carga {task.cognitive_load}/10</Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionButton} onPress={() => onEdit(task)}>
          <Text style={styles.actionText}>Editar</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => onDelete(task.id)}>
          <Text style={styles.actionText}>Borrar</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, isCompleted && styles.actionDisabled]}
          onPress={() => onComplete(task.id)}
          disabled={isCompleted}
        >
          <Text style={styles.actionText}>{isCompleted ? 'Hecha' : 'Completar'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: lifeTheme.colors.surface,
    borderColor: lifeTheme.colors.border,
    borderWidth: 1,
    borderRadius: lifeTheme.radius.md,
    padding: lifeTheme.spacing.md,
    gap: lifeTheme.spacing.sm
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.94
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: lifeTheme.spacing.md
  },
  titleWrap: {
    flex: 1,
    gap: 4
  },
  title: {
    color: lifeTheme.colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  description: {
    color: lifeTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  meta: {
    color: lifeTheme.colors.muted,
    fontSize: 12,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden'
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: '#171722'
  },
  actionDisabled: {
    opacity: 0.45
  },
  actionText: {
    color: lifeTheme.colors.text,
    fontSize: 12,
    fontWeight: '700'
  }
});
