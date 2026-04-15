import { Pressable, StyleSheet, Text, View, Dimensions } from 'react-native';
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolateColor,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { formatDuration } from '../utils/time';
import { useAppTheme } from '../theme';
import type { Task, TaskUrgency } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.30;

function getUrgencyColor(urgency: TaskUrgency, lifeTheme: ReturnType<typeof useAppTheme>): string {
  if (urgency === 'today') return lifeTheme.colors.alert;
  if (urgency === 'this_week') return '#f59e0b';
  if (urgency === 'this_month') return lifeTheme.colors.primary;
  return lifeTheme.colors.muted;
}

const URGENCY_ICON: Record<TaskUrgency, string> = {
  today: '🔥', this_week: '📅', this_month: '🗓', someday: '💭'
};

interface Props {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onComplete: (taskId: string) => void;
}

function getStatusColor(task: Task, lifeTheme: ReturnType<typeof useAppTheme>): string {
  if (task.status === 'completed') return lifeTheme.colors.success;
  if (task.status === 'scheduled') return lifeTheme.colors.primary;
  return lifeTheme.colors.muted;
}

function getPriorityColors(lifeTheme: ReturnType<typeof useAppTheme>): Record<number, string> {
  return {
    1: '#6b7280',
    2: '#22d3ee',
    3: lifeTheme.colors.primary,
    4: '#f59e0b',
    5: lifeTheme.colors.alert
  };
}

function getStatusLabel(task: Task): string {
  if (task.status === 'completed') return '✓ Hecha';
  if (task.status === 'scheduled') return 'Programada';
  return 'Pool';
}

function getTaskAccent(task: Task, lifeTheme: ReturnType<typeof useAppTheme>): string {
  return task.color?.trim() || getUrgencyColor((task as any).urgency ?? 'someday', lifeTheme);
}

export function SwipeableTaskCard({ task, onEdit, onDelete, onComplete }: Props): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const isCompleted = task.status === 'completed';
  const urgency: TaskUrgency = (task as any).urgency ?? 'someday';

  function triggerComplete() { onComplete(task.id); }
  function triggerDelete()   { onDelete(task.id); }

  const panGesture = Gesture.Pan()
    // Completed tasks: only swipe left to delete. Pending: both directions.
    .onUpdate((event) => {
      if (isCompleted) {
        // Only allow left swipe for completed
        if (event.translationX < 0) translateX.value = event.translationX;
      } else {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      if (!isCompleted && event.translationX > SWIPE_THRESHOLD) {
        // Swipe right → complete
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 240 }, () => {
          runOnJS(triggerComplete)();
        });
        cardOpacity.value = withTiming(0, { duration: 210 });
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        // Swipe left → delete (works for completed too)
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 240 }, () => {
          runOnJS(triggerDelete)();
        });
        cardOpacity.value = withTiming(0, { duration: 210 });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: cardOpacity.value
  }));

  const completeHintStyle = useAnimatedStyle(() => ({
    opacity: isCompleted
      ? 0
      : interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP)
  }));

  const deleteHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP)
  }));

  const borderColorStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      translateX.value,
      [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
      [lifeTheme.colors.alert, isCompleted ? `${lifeTheme.colors.success}60` : lifeTheme.colors.border, lifeTheme.colors.success]
    )
  }));

  const statusColor = getStatusColor(task, lifeTheme);
  const urgencyColor = getUrgencyColor(urgency, lifeTheme);
  const priorityColors = getPriorityColors(lifeTheme);
  const accentColor = getTaskAccent(task, lifeTheme);
  const emoji = task.emoji?.trim() || URGENCY_ICON[urgency];

  return (
    <View style={styles.wrapper}>
      {/* Swipe hint backgrounds */}
      {!isCompleted && (
        <Animated.View style={[styles.hint, styles.hintRight, completeHintStyle]}>
          <Text style={styles.hintGreen}>✓ Completar</Text>
        </Animated.View>
      )}
      <Animated.View style={[styles.hint, styles.hintLeft, deleteHintStyle]}>
        <Text style={styles.hintRed}>✕ Borrar</Text>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, isCompleted && styles.cardDone, borderColorStyle, cardStyle, { borderLeftColor: accentColor }] }>
          {/* Top row */}
          <View style={styles.topRow}>
            <View style={styles.titleWrap}>
              <View style={styles.titleLine}>
                <Text style={styles.urgencyDot}>{emoji}</Text>
                <Text style={[styles.title, isCompleted && styles.titleDone]} numberOfLines={2}>
                  {task.title}
                </Text>
              </View>
              {task.description ? (
                <Text style={styles.desc} numberOfLines={2}>{task.description}</Text>
              ) : null}
            </View>
            <View style={[styles.statusBadge, { borderColor: accentColor }]}>
              <Text style={[styles.statusText, { color: accentColor }]}>{getStatusLabel(task)}</Text>
            </View>
          </View>

          {/* Meta chips */}
          <View style={styles.metaRow}>
            <View style={[styles.chip, { borderColor: urgencyColor + '60' }]}>
              <Text style={[styles.chipText, { color: urgencyColor }]}>{task.eta_minutes} min</Text>
            </View>
            <View style={styles.chip}>
              <Text style={[styles.chipText, { color: priorityColors[task.priority] }]}>
                P{task.priority}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>🧠 {task.cognitive_load}/10</Text>
            </View>
            {task.deadline ? (
              <View style={[styles.chip, { borderColor: `${lifeTheme.colors.alert}60` }]}>
                <Text style={[styles.chipText, { color: lifeTheme.colors.alert }]}>
                  ⏰ {task.deadline.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                </Text>
              </View>
            ) : null}
            {(task as any).fixed_start ? (
              <View style={[styles.chip, { borderColor: `${lifeTheme.colors.primary}60` }]}>
                <Text style={[styles.chipText, { color: lifeTheme.colors.primary }]}>
                  🕐 {(task as any).fixed_start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Actions row */}
          <View style={styles.actionsRow}>
            {!isCompleted && (
              <Pressable style={styles.editBtn} onPress={() => onEdit(task)}>
                <Text style={styles.editBtnText}>Editar</Text>
              </Pressable>
            )}
            {isCompleted && (
              <Pressable
                style={styles.deleteBtn}
                onPress={() => onDelete(task.id)}
              >
                <Text style={styles.deleteBtnText}>🗑 Eliminar</Text>
              </Pressable>
            )}
            <Text style={styles.swipeHint}>
              {isCompleted ? '← deslizá para borrar' : '← borrar · completar →'}
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  wrapper: { position: 'relative' },
  hint: {
    position: 'absolute', top: 0, bottom: 0, width: '50%',
    justifyContent: 'center', borderRadius: 14, paddingHorizontal: 18
  },
  hintRight: { left: 0, alignItems: 'flex-start', backgroundColor: 'rgba(108,252,184,0.12)' },
  hintLeft:  { right: 0, alignItems: 'flex-end',  backgroundColor: 'rgba(252,108,143,0.12)' },
  hintGreen: { color: lifeTheme.colors.success, fontSize: 13, fontWeight: '800' },
  hintRed:   { color: lifeTheme.colors.alert,   fontSize: 13, fontWeight: '800' },
  card: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: lifeTheme.colors.border,
    padding: 12, gap: 8
  },
  cardDone: { backgroundColor: 'rgba(108,252,184,0.04)', borderColor: `${lifeTheme.colors.success}40` },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 10
  },
  titleWrap: { flex: 1, gap: 3 },
  titleLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  urgencyDot: { fontSize: 13, marginTop: 1 },
  title: { color: lifeTheme.colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  titleDone: { opacity: 0.45, textDecorationLine: 'line-through' },
  desc: { color: lifeTheme.colors.muted, fontSize: 12, lineHeight: 17, paddingLeft: 20 },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1,
    borderColor: lifeTheme.colors.border, overflow: 'hidden'
  },
  chipText: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  editBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9,
    backgroundColor: lifeTheme.colors.surfaceAlt, borderWidth: 1, borderColor: lifeTheme.colors.border
  },
  editBtnText: { color: lifeTheme.colors.text, fontSize: 12, fontWeight: '700' },
  deleteBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9,
    backgroundColor: 'rgba(252,108,143,0.1)', borderWidth: 1, borderColor: `${lifeTheme.colors.alert}40`
  },
  deleteBtnText: { color: lifeTheme.colors.alert, fontSize: 12, fontWeight: '700' },
  swipeHint: { flex: 1, color: lifeTheme.colors.muted, fontSize: 10, textAlign: 'center' }
  });
}
