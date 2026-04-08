import type { ReactElement } from 'react';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../../src/store/useLifeStore';
import { lifeTheme } from '../../src/theme';

function fmt(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Break Edit Modal ─────────────────────────────────────────────────────────

function BreakEditModal({
  visible,
  blockId,
  currentMinutes,
  onClose
}: {
  visible: boolean;
  blockId: string;
  currentMinutes: number;
  onClose: () => void;
}): ReactElement {
  const updateBreak = useLifeStore((s) => s.updateBreakDuration);
  const [value, setValue] = useState(String(currentMinutes));

  function handleSave() {
    const mins = parseInt(value, 10);
    if (!isNaN(mins) && mins >= 1 && mins <= 120) {
      updateBreak(blockId, mins);
    }
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Editar descanso</Text>
          <Text style={styles.modalLabel}>Duración en minutos</Text>
          <TextInput
            style={styles.modalInput}
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            selectTextOnFocus
            placeholderTextColor={lifeTheme.colors.muted}
          />
          <View style={styles.modalBtns}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Guardar</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Timeline Block ───────────────────────────────────────────────────────────

function BlockCard({
  block,
  index,
  total,
  onEditBreak
}: {
  block: ReturnType<typeof useLifeStore.getState>['timeline'][0];
  index: number;
  total: number;
  onEditBreak: (id: string, minutes: number) => void;
}): ReactElement {
  const moveBlock = useLifeStore((s) => s.moveBlock);
  const completeTask = useLifeStore((s) => s.completeTask);
  const durationMin = Math.round((block.end_time.getTime() - block.start_time.getTime()) / 60_000);
  const isRest = block.type === 'rest' || block.type === 'meal' || block.type === 'sleep';
  const isMeal = block.type === 'meal';
  const isSleep = block.type === 'sleep';

  let emoji = '☕';
  if (isMeal) emoji = '🍜';
  else if (isSleep) emoji = '🌙';
  else if (!isRest) emoji = '🔷';

  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      layout={Layout.springify().damping(14)}
      style={[
        styles.block, 
        isRest ? styles.blockRest : styles.blockTask,
        isMeal && styles.blockMeal,
        isSleep && styles.blockSleep
      ]}
    >
      <View style={styles.blockTimeCol}>
        <Text style={styles.blockTimeText}>{fmt(block.start_time)}</Text>
        <View style={[styles.blockLine, isRest ? styles.lineRest : styles.lineTask]} />
        <Text style={styles.blockTimeText}>{fmt(block.end_time)}</Text>
      </View>

      <View style={styles.blockBody}>
        <Text style={[
          isRest ? styles.blockTitleRest : styles.blockTitleTask,
          isMeal && { color: '#fb923c' },
          isSleep && { color: '#818cf8', fontWeight: '900' }
        ]} numberOfLines={2}>
          {emoji} {block.title}
        </Text>
        <Text style={styles.blockDuration}>{durationMin} min</Text>
      </View>

      <View style={styles.blockCtrl}>
        {!isRest && (
          <>
            <Pressable
              style={[styles.ctrlBtn, index === 0 && styles.ctrlBtnDisabled]}
              onPress={() => index > 0 && moveBlock(block.id, 'up')}
              disabled={index === 0}
            >
              <Text style={[styles.ctrlIcon, index === 0 && styles.ctrlIconDisabled]}>↑</Text>
            </Pressable>
            <Pressable
              style={[styles.ctrlBtn, index >= total - 1 && styles.ctrlBtnDisabled]}
              onPress={() => index < total - 1 && moveBlock(block.id, 'down')}
              disabled={index >= total - 1}
            >
              <Text style={[styles.ctrlIcon, index >= total - 1 && styles.ctrlIconDisabled]}>↓</Text>
            </Pressable>
            {block.task_id && (
              <Pressable
                style={[styles.ctrlBtn, styles.ctrlBtnDone]}
                onPress={() => {
                  Alert.alert('Completar', `¿Marcar "${block.title}" como completada?`, [
                    { text: 'No', style: 'cancel' },
                    { text: 'Sí ✅', onPress: () => completeTask(block.task_id!) }
                  ]);
                }}
              >
                <Text style={styles.ctrlIconDone}>✓</Text>
              </Pressable>
            )}
          </>
        )}
        {isRest && (
          <Pressable
            style={styles.editBreakBtn}
            onPress={() => onEditBreak(block.id, durationMin)}
            onLongPress={() => {
              Alert.alert('Eliminar descanso', '¿Eliminar este bloque de descanso?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar 🗑', style: 'destructive', onPress: () => useLifeStore.getState().deleteBlock(block.id) }
              ]);
            }}
          >
            <Text style={styles.editBreakIcon}>✏️</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen(): ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const timeline = useLifeStore((s) => s.timeline);
  const tasks = useLifeStore((s) => s.tasks);
  const habits = useLifeStore((s) => s.habits);
  const logHabit = useLifeStore((s) => s.logHabit);
  const generateTimeline = useLifeStore((s) => s.generateTimeline);
  const isGenerating = useLifeStore((s) => s.isGenerating);
  const lastEngine = useLifeStore((s) => s.lastEngine);
  const lastSolverStatus = useLifeStore((s) => s.lastSolverStatus);
  const startMealTimer = useLifeStore((s) => s.startMealTimer);
  const stopTimer = useLifeStore((s) => s.stopTimer);
  const activeTimer = useLifeStore((s) => s.activeTimer);

  const [editBreak, setEditBreak] = useState<{ id: string; minutes: number } | null>(null);

  const poolCount = tasks.filter((t) => t.status === 'pool').length;
  const todayCount = tasks.filter((t) => (t as any).urgency === 'today' && t.status !== 'completed').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const taskBlocks = timeline.filter((b) => b.type === 'task').length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días ☀️' : hour < 18 ? 'Buenas tardes 🌤' : 'Buenas noches 🌙';

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.greeting}>{greeting}</Text>
              <Pressable onPress={() => router.push('/analytics' as any)} style={styles.analyticsBtn}>
                <Text style={styles.analyticsBtnText}>📈</Text>
              </Pressable>
            </View>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>{taskBlocks}</Text>
              <Text style={styles.statLbl}>plan.</Text>
            </View>
            <View style={[styles.statChip, { borderColor: `${lifeTheme.colors.alert}55` }]}>
              <Text style={[styles.statNum, { color: lifeTheme.colors.alert }]}>{todayCount}</Text>
              <Text style={styles.statLbl}>hoy</Text>
            </View>
            <View style={[styles.statChip, { borderColor: `${lifeTheme.colors.success}55` }]}>
              <Text style={[styles.statNum, { color: lifeTheme.colors.success }]}>{completedCount}</Text>
              <Text style={styles.statLbl}>✓</Text>
            </View>
          </View>
        </Animated.View>

        {/* Engine badge */}
        {lastEngine !== 'idle' && (
          <Animated.View
            entering={FadeInDown.delay(100).duration(280)}
            style={[
              styles.engineBadge,
              lastEngine === 'ortools-cpsat' ? styles.badgeGreen :
              lastEngine === 'greedy-fallback' ? styles.badgeYellow : styles.badgePurple
            ]}
          >
            <Text style={[
              styles.engineText,
              lastEngine === 'ortools-cpsat' ? { color: lifeTheme.colors.success } :
              lastEngine === 'greedy-fallback' ? { color: '#f59e0b' } : { color: lifeTheme.colors.primary }
            ]}>
              {lastEngine === 'ortools-cpsat' ? `🔬 OR-Tools · ${lastSolverStatus}` :
               lastEngine === 'greedy-fallback' ? `⚠️ Greedy · ${lastSolverStatus}` :
               '📱 Scheduler local (offline)'}
            </Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(150).duration(320)} style={styles.actionsCard}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, isGenerating && styles.disabled]}
            onPress={() => void generateTimeline(new Date())}
            disabled={isGenerating}
          >
            <Text style={styles.primaryBtnText}>
              {isGenerating ? '⏳ Optimizando...' : '⚡ Organizar mi día'}
            </Text>
          </Pressable>

          {activeTimer ? (
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={() => void stopTimer()}
            >
              <Text style={styles.secondaryBtnText}>⏹ Terminar pausa de almuerzo</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={() => void startMealTimer()}
            >
              <Text style={styles.secondaryBtnText}>🍽 Pausa almuerzo (90 min)</Text>
            </Pressable>
          )}
        </Animated.View>

        {/* --- HABIT QUICK ACTIONS --- */}
        <View style={styles.habitsRow}>
          <Text style={styles.habitsTitle}>🌟 Hábitos de hoy</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.habitsList}>
            {habits.map((habit) => {
              const isDone = habit.lastCompletedDate === new Date().toISOString().slice(0, 10);
              return (
                <Pressable
                  key={habit.id}
                  style={[styles.habitBubble, isDone && styles.habitBubbleDone]}
                  onPress={() => logHabit(habit.id, 1)}
                >
                  <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                  <Text style={[styles.habitName, isDone && styles.habitNameDone]}>
                    {habit.name}
                  </Text>
                  {isDone && <Text style={styles.habitDoneCheck}>✓</Text>}
                </Pressable>
              );
            })}
            <Pressable style={styles.habitBubble} onPress={() => router.push('/(tabs)/habits' as any)}>
              <Text style={styles.habitEmoji}>➕</Text>
              <Text style={styles.habitName}>Añadir</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Timeline */}
        {timeline.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(220).duration(320)} style={styles.section}>
            <Text style={styles.sectionTitle}>📆 Timeline de hoy</Text>
            <View style={styles.blockList}>
              {timeline.map((block, idx) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  index={idx}
                  total={timeline.length}
                  onEditBreak={(id, mins) => setEditBreak({ id, minutes: mins })}
                />
              ))}
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(280).duration(300)} style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin plan aún</Text>
            <Text style={styles.emptyText}>
              Tienes {poolCount} tarea{poolCount !== 1 ? 's' : ''} en la pool.
              {'\n'}Presiona "Organizar mi día" para generar tu timeline.
            </Text>
          </Animated.View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {editBreak && (
        <BreakEditModal
          visible
          blockId={editBreak.id}
          currentMinutes={editBreak.minutes}
          onClose={() => setEditBreak(null)}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  content: { paddingHorizontal: 16, gap: 14, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { color: lifeTheme.colors.muted, fontSize: 16, fontWeight: '600' },
  analyticsBtn: { backgroundColor: lifeTheme.colors.surfaceAlt, padding: 8, borderRadius: 12 },
  analyticsBtnText: { fontSize: 16 },
  dateText: { color: lifeTheme.colors.text, fontSize: 24, fontWeight: '900', marginTop: 4, textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row', gap: 6 },
  statChip: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 5, alignItems: 'center',
    borderWidth: 1, borderColor: lifeTheme.colors.border
  },
  statNum: { color: lifeTheme.colors.primary, fontSize: 14, fontWeight: '800' },
  statLbl: { color: lifeTheme.colors.muted, fontSize: 8, fontWeight: '600' },
  engineBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, alignSelf: 'flex-start' },
  badgeGreen: { backgroundColor: 'rgba(108,252,184,0.08)', borderColor: 'rgba(108,252,184,0.25)' },
  badgeYellow: { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)' },
  badgePurple: { backgroundColor: 'rgba(124,108,252,0.08)', borderColor: 'rgba(124,108,252,0.25)' },
  engineText: { fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  actionsCard: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: lifeTheme.colors.border, padding: 14, gap: 10
  },
  primaryBtn: {
    backgroundColor: lifeTheme.colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center'
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: lifeTheme.colors.border
  },
  secondaryBtnText: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.975 }] },
  disabled: { opacity: 0.5 },
  section: { gap: 10 },
  sectionTitle: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '800' },
  blockList: { gap: 6 },
  block: {
    flexDirection: 'row', borderRadius: 12, borderWidth: 1,
    padding: 10, gap: 10, alignItems: 'center'
  },
  blockRest: { backgroundColor: `${lifeTheme.colors.surfaceAlt}88`, borderColor: `${lifeTheme.colors.muted}44`, borderStyle: 'dashed' },
  blockMeal: { backgroundColor: `${lifeTheme.colors.alert}15`, borderColor: `${lifeTheme.colors.alert}55`, borderStyle: 'solid' },
  blockSleep: { backgroundColor: '#1e1b4b', borderColor: '#4f46e5', borderStyle: 'solid', paddingVertical: 20 },
  blockTask: { backgroundColor: lifeTheme.colors.surface, borderColor: `${lifeTheme.colors.primary}40` },
  blockTimeCol: { width: 50, alignItems: 'center', gap: 3 },
  blockTimeText: { color: lifeTheme.colors.muted, fontSize: 10, fontWeight: '600' },
  blockLine: { width: 2, height: 16, borderRadius: 1 },
  lineTask: { backgroundColor: lifeTheme.colors.primary },
  lineRest: { backgroundColor: lifeTheme.colors.border },
  blockBody: { flex: 1, gap: 2 },
  blockTitleTask: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '700' },
  blockTitleRest: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '500' },
  blockDuration: { color: lifeTheme.colors.muted, fontSize: 10 },
  blockCtrl: { flexDirection: 'column', gap: 4, alignItems: 'center' },
  ctrlBtn: {
    width: 26, height: 26, borderRadius: 7, alignItems: 'center',
    justifyContent: 'center', backgroundColor: lifeTheme.colors.surfaceAlt,
    borderWidth: 1, borderColor: lifeTheme.colors.border
  },
  ctrlBtnDisabled: { opacity: 0.3 },
  ctrlBtnDone: { backgroundColor: 'rgba(108,252,184,0.12)', borderColor: lifeTheme.colors.success },
  ctrlIcon: { color: lifeTheme.colors.text, fontSize: 12, fontWeight: '700' },
  ctrlIconDisabled: { color: lifeTheme.colors.border },
  ctrlIconDone: { color: lifeTheme.colors.success, fontSize: 13, fontWeight: '800' },
  editBreakBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: lifeTheme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center'
  },
  editBreakIcon: { fontSize: 13 },
  emptyCard: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: lifeTheme.colors.border,
    padding: 24, alignItems: 'center', gap: 8
  },
  emptyTitle: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '700' },
  emptyText: { color: lifeTheme.colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  // Modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center', alignItems: 'center', padding: 28
  },
  modalCard: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 20,
    padding: 24, width: '100%', gap: 14,
    borderWidth: 1, borderColor: lifeTheme.colors.border
  },
  modalTitle: { color: lifeTheme.colors.text, fontSize: 18, fontWeight: '800' },
  modalLabel: { color: lifeTheme.colors.muted, fontSize: 13 },
  modalInput: {
    backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 12,
    borderWidth: 1, borderColor: lifeTheme.colors.border,
    color: lifeTheme.colors.text, fontSize: 24, fontWeight: '700',
    padding: 14, textAlign: 'center'
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 12,
    padding: 13, alignItems: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border
  },
  cancelBtnText: { color: lifeTheme.colors.muted, fontWeight: '700' },
  saveBtn: { flex: 1, backgroundColor: lifeTheme.colors.primary, borderRadius: 12, padding: 13, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800' },
  habitsRow: { gap: 8, marginTop: 4 },
  habitsTitle: { color: lifeTheme.colors.text, fontSize: 15, fontWeight: '800', marginLeft: 4 },
  habitsList: { gap: 10, paddingRight: 16 },
  habitBubble: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: lifeTheme.colors.border,
    padding: 10, alignItems: 'center', minWidth: 64, gap: 4
  },
  habitEmoji: { fontSize: 20 },
  habitName: { color: lifeTheme.colors.muted, fontSize: 10, fontWeight: '700' },
  habitBubbleDone: { backgroundColor: 'rgba(108,252,184,0.1)', borderColor: lifeTheme.colors.success },
  habitNameDone: { color: lifeTheme.colors.success },
  habitDoneCheck: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: lifeTheme.colors.success, borderRadius: 10,
    width: 18, height: 18, textAlign: 'center', lineHeight: 18,
    color: '#fff', fontSize: 10, fontWeight: '900', overflow: 'hidden'
  }
});
