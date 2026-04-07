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
import Animated, { FadeInDown, ZoomIn, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../../src/store/useLifeStore';
import { lifeTheme } from '../../src/theme';
import { formatDuration } from '../../src/utils/time';

// ─── Format helpers ───────────────────────────────────────────────────────────

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
          <Text style={styles.modalLabel}>Duración (minutos)</Text>
          <TextInput
            style={styles.modalInput}
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            selectTextOnFocus
            placeholderTextColor={lifeTheme.colors.muted}
          />
          <View style={styles.modalRow}>
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

// ─── Timeline Block Card ──────────────────────────────────────────────────────

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
  const durationMs = block.end_time.getTime() - block.start_time.getTime();
  const durationMin = Math.round(durationMs / 60_000);

  const isRest = block.type === 'rest' || block.type === 'meal';
  const isTask = block.type === 'task';

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      layout={Layout.springify()}
      style={[styles.blockCard, isRest ? styles.blockRest : styles.blockTask]}
    >
      <View style={styles.blockLeft}>
        <Text style={styles.blockTime}>{fmt(block.start_time)}</Text>
        <View style={[styles.blockLine, isRest ? styles.blockLineRest : styles.blockLineTask]} />
        <Text style={styles.blockTime}>{fmt(block.end_time)}</Text>
      </View>
      <View style={styles.blockCenter}>
        <Text style={isRest ? styles.blockTitleRest : styles.blockTitleTask} numberOfLines={2}>
          {isRest ? '☕ ' : '📌 '}
          {block.title}
        </Text>
        <Text style={styles.blockDuration}>{durationMin} min</Text>
      </View>
      <View style={styles.blockActions}>
        {isTask && (
          <>
            <Pressable
              style={styles.actionBtn}
              onPress={() => index > 0 && moveBlock(block.id, 'up')}
              disabled={index === 0}
            >
              <Text style={[styles.actionIcon, index === 0 && styles.actionIconDisabled]}>↑</Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={() => index < total - 1 && moveBlock(block.id, 'down')}
              disabled={index === total - 1}
            >
              <Text style={[styles.actionIcon, index === total - 1 && styles.actionIconDisabled]}>↓</Text>
            </Pressable>
            {block.task_id && (
              <Pressable
                style={[styles.actionBtn, styles.completeBtn]}
                onPress={() => {
                  Alert.alert('Completar tarea', `¿Completar "${block.title}"?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Completar ✅', onPress: () => completeTask(block.task_id!) }
                  ]);
                }}
              >
                <Text style={styles.completeBtnText}>✓</Text>
              </Pressable>
            )}
          </>
        )}
        {isRest && (
          <Pressable
            style={styles.editBreakBtn}
            onPress={() => onEditBreak(block.id, durationMin)}
          >
            <Text style={styles.editBreakText}>✏️</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const timeline = useLifeStore((s) => s.timeline);
  const tasks = useLifeStore((s) => s.tasks);
  const generateTimeline = useLifeStore((s) => s.generateTimeline);
  const isGenerating = useLifeStore((s) => s.isGenerating);
  const lastEngine = useLifeStore((s) => s.lastEngine);
  const lastSolverStatus = useLifeStore((s) => s.lastSolverStatus);
  const startMealTimer = useLifeStore((s) => s.startMealTimer);
  const stopTimer = useLifeStore((s) => s.stopTimer);
  const activeTimer = useLifeStore((s) => s.activeTimer);

  const [editBreak, setEditBreak] = useState<{ id: string; minutes: number } | null>(null);

  const poolCount = tasks.filter((t) => t.status === 'pool').length;
  const todayCount = tasks.filter((t) => t.urgency === 'today' && t.status !== 'completed').length;
  const completedToday = tasks.filter((t) => t.status === 'completed').length;
  const taskBlocks = timeline.filter((b) => b.type === 'task').length;

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {new Date().getHours() < 12 ? 'Buenos días ☀️' : new Date().getHours() < 18 ? 'Buenas tardes 🌤' : 'Buenas noches 🌙'}
            </Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>{taskBlocks}</Text>
              <Text style={styles.statLbl}>planif.</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={[styles.statNum, { color: lifeTheme.colors.alert }]}>{todayCount}</Text>
              <Text style={styles.statLbl}>hoy</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={[styles.statNum, { color: lifeTheme.colors.success }]}>{completedToday}</Text>
              <Text style={styles.statLbl}>✓ done</Text>
            </View>
          </View>
        </Animated.View>

        {/* Engine badge */}
        {lastEngine !== 'idle' && (
          <Animated.View
            entering={FadeInDown.duration(280)}
            style={[
              styles.engineBadge,
              lastEngine === 'ortools-cpsat' ? styles.engineOptimal :
              lastEngine === 'greedy-fallback' ? styles.engineFallback :
              styles.engineLocal
            ]}
          >
            <Text style={[
              styles.engineText,
              lastEngine === 'ortools-cpsat' ? styles.engineTextOptimal :
              lastEngine === 'greedy-fallback' ? styles.engineTextFallback :
              styles.engineTextLocal
            ]}>
              {lastEngine === 'ortools-cpsat'
                ? `🔬 OR-Tools CP-SAT · ${lastSolverStatus}`
                : lastEngine === 'greedy-fallback'
                ? `⚠️ Greedy · ${lastSolverStatus}`
                : '📱 Scheduler local (offline)'}
            </Text>
          </Animated.View>
        )}

        {/* Action buttons */}
        <Animated.View entering={FadeInDown.delay(150).duration(350)} style={styles.actionsCard}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              isGenerating && styles.disabled
            ]}
            onPress={() => void generateTimeline(new Date())}
            disabled={isGenerating}
          >
            <Text style={styles.primaryButtonText}>
              {isGenerating ? '⏳ Optimizando...' : '⚡ Organizar mi día'}
            </Text>
          </Pressable>

          {activeTimer ? (
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              onPress={() => void stopTimer()}
            >
              <Text style={styles.secondaryButtonText}>⏹ Terminar pausa</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              onPress={() => void startMealTimer()}
            >
              <Text style={styles.secondaryButtonText}>🍽 Pausa (90 min)</Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Timeline */}
        {timeline.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(250).duration(350)} style={styles.section}>
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
          <Animated.View entering={FadeInDown.delay(300).duration(350)} style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin plan aún</Text>
            <Text style={styles.emptyText}>
              Tienes {poolCount} tarea{poolCount !== 1 ? 's' : ''} en la pool.{'\n'}
              Presiona "Organizar mi día" para generar tu timeline.
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Break Edit Modal */}
      {editBreak && (
        <BreakEditModal
          visible={!!editBreak}
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
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  greeting: { color: lifeTheme.colors.text, fontSize: 22, fontWeight: '800' },
  date: { color: lifeTheme.colors.muted, fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statChip: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  statNum: { color: lifeTheme.colors.primary, fontSize: 16, fontWeight: '800' },
  statLbl: { color: lifeTheme.colors.muted, fontSize: 9, fontWeight: '600' },
  engineBadge: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    alignSelf: 'flex-start'
  },
  engineOptimal: { backgroundColor: 'rgba(108,252,184,0.1)', borderColor: 'rgba(108,252,184,0.3)' },
  engineFallback: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' },
  engineLocal: { backgroundColor: 'rgba(124,108,252,0.1)', borderColor: 'rgba(124,108,252,0.3)' },
  engineText: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  engineTextOptimal: { color: lifeTheme.colors.success },
  engineTextFallback: { color: '#f59e0b' },
  engineTextLocal: { color: lifeTheme.colors.primary },
  actionsCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.lg,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: 16,
    gap: 10
  },
  primaryButton: {
    backgroundColor: lifeTheme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  secondaryButtonText: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.978 }] },
  disabled: { opacity: 0.55 },
  section: { gap: 12 },
  sectionTitle: { color: lifeTheme.colors.text, fontSize: 17, fontWeight: '800' },
  blockList: { gap: 8 },
  blockCard: {
    flexDirection: 'row',
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    padding: 12,
    gap: 12,
    alignItems: 'center'
  },
  blockRest: {
    backgroundColor: 'rgba(42,42,58,0.5)',
    borderColor: lifeTheme.colors.border
  },
  blockTask: {
    backgroundColor: lifeTheme.colors.surface,
    borderColor: `${lifeTheme.colors.primary}44`
  },
  blockLeft: { alignItems: 'center', gap: 4, width: 46 },
  blockTime: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '600' },
  blockLine: { width: 2, height: 20, borderRadius: 1 },
  blockLineTask: { backgroundColor: lifeTheme.colors.primary },
  blockLineRest: { backgroundColor: lifeTheme.colors.border },
  blockCenter: { flex: 1, gap: 2 },
  blockTitleTask: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '700' },
  blockTitleRest: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '500' },
  blockDuration: { color: lifeTheme.colors.muted, fontSize: 11 },
  blockActions: { gap: 4, alignItems: 'center' },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  actionIcon: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '700' },
  actionIconDisabled: { color: lifeTheme.colors.border },
  completeBtn: { backgroundColor: 'rgba(108,252,184,0.15)', borderColor: lifeTheme.colors.success },
  completeBtnText: { color: lifeTheme.colors.success, fontSize: 14, fontWeight: '800' },
  editBreakBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  editBreakText: { fontSize: 14 },
  emptyCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: 24,
    gap: 8,
    alignItems: 'center'
  },
  emptyTitle: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '700' },
  emptyText: { color: lifeTheme.colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  modalCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.lg,
    padding: 24,
    width: '100%',
    gap: 16,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  modalTitle: { color: lifeTheme.colors.text, fontSize: 18, fontWeight: '800' },
  modalLabel: { color: lifeTheme.colors.muted, fontSize: 13 },
  modalInput: {
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    color: lifeTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    padding: 14,
    textAlign: 'center'
  },
  modalRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  cancelBtnText: { color: lifeTheme.colors.muted, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    backgroundColor: lifeTheme.colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center'
  },
  saveBtnText: { color: '#fff', fontWeight: '800' }
});
