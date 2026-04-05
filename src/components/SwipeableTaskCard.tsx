import { Pressable, StyleSheet, Text, View, Dimensions } from 'react-native';
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
import { lifeTheme } from '../theme';
import type { Task } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

interface SwipeableTaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onComplete: (taskId: string) => void;
}

const PRIORITY_LABEL: Record<number, string> = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4', 5: 'P5' };

function getStatusColor(task: Task): string {
  if (task.status === 'completed') return lifeTheme.colors.success;
  if (task.status === 'scheduled') return lifeTheme.colors.primary;
  return lifeTheme.colors.muted;
}

function getStatusLabel(task: Task): string {
  if (task.status === 'completed') return 'Completada';
  if (task.status === 'scheduled') return 'Programada';
  return 'En pool';
}

export function SwipeableTaskCard({ task, onEdit, onDelete, onComplete }: SwipeableTaskCardProps): ReactElement {
  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const isCompleted = task.status === 'completed';

  function triggerComplete() {
    onComplete(task.id);
  }

  function triggerDelete() {
    onDelete(task.id);
  }

  const panGesture = Gesture.Pan()
    .enabled(!isCompleted)
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        // Swipe right → complete
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 260 }, () => {
          runOnJS(triggerComplete)();
        });
        cardOpacity.value = withTiming(0, { duration: 220 });
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        // Swipe left → delete
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 260 }, () => {
          runOnJS(triggerDelete)();
        });
        cardOpacity.value = withTiming(0, { duration: 220 });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: cardOpacity.value
  }));

  // Background hint colors based on drag direction
  const completeHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP)
  }));

  const deleteHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP)
  }));

  const borderColorStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      translateX.value,
      [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
      [lifeTheme.colors.alert, lifeTheme.colors.border, lifeTheme.colors.success]
    )
  }));

  const accentColor = getStatusColor(task);

  return (
    <View style={styles.wrapper}>
      {/* Swipe hints shown behind the card */}
      <Animated.View style={[styles.hint, styles.hintRight, completeHintStyle]}>
        <Text style={styles.hintTextGreen}>✓ Completar</Text>
      </Animated.View>
      <Animated.View style={[styles.hint, styles.hintLeft, deleteHintStyle]}>
        <Text style={styles.hintTextRed}>✕ Borrar</Text>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, borderColorStyle, cardStyle]}>
          <View style={styles.topRow}>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, isCompleted && styles.titleDone]}>{task.title}</Text>
              {task.description ? (
                <Text style={styles.description} numberOfLines={2}>{task.description}</Text>
              ) : null}
            </View>
            <View style={[styles.badge, { borderColor: accentColor }]}>
              <Text style={[styles.badgeText, { color: accentColor }]}>{getStatusLabel(task)}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.meta}>{formatDuration(task.eta_minutes)}</Text>
            <Text style={[styles.meta, styles.metaPriority]}>{PRIORITY_LABEL[task.priority]}</Text>
            <Text style={styles.meta}>Carga {task.cognitive_load}/10</Text>
            {task.deadline ? (
              <Text style={[styles.meta, styles.metaDeadline]}>
                📅 {task.deadline.toLocaleDateString()}
              </Text>
            ) : null}
          </View>

          {!isCompleted && (
            <View style={styles.actionsRow}>
              <Pressable
                style={styles.editBtn}
                onPress={() => onEdit(task)}
              >
                <Text style={styles.editBtnText}>Editar</Text>
              </Pressable>
              <Text style={styles.swipeHint}>← deslizá para borrar · completar →</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative'
  },
  hint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    justifyContent: 'center',
    borderRadius: lifeTheme.radius.md,
    paddingHorizontal: 20
  },
  hintRight: {
    left: 0,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(108, 252, 184, 0.14)'
  },
  hintLeft: {
    right: 0,
    alignItems: 'flex-end',
    backgroundColor: 'rgba(252, 108, 143, 0.14)'
  },
  hintTextGreen: {
    color: lifeTheme.colors.success,
    fontSize: 13,
    fontWeight: '800'
  },
  hintTextRed: {
    color: lifeTheme.colors.alert,
    fontSize: 13,
    fontWeight: '800'
  },
  card: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    padding: lifeTheme.spacing.md,
    gap: lifeTheme.spacing.sm
  },
  topRow: {
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
  titleDone: {
    opacity: 0.45,
    textDecorationLine: 'line-through'
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
  metaPriority: {
    color: lifeTheme.colors.primary
  },
  metaDeadline: {
    color: lifeTheme.colors.alert
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  editBtnText: {
    color: lifeTheme.colors.text,
    fontSize: 12,
    fontWeight: '700'
  },
  swipeHint: {
    flex: 1,
    color: lifeTheme.colors.muted,
    fontSize: 11,
    textAlign: 'center'
  }
});
