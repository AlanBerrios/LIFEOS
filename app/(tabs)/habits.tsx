import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTodayStr } from '../../src/utils/date';
import { useLifeStore } from '../../src/store/useLifeStore';
import { useAppTheme } from '../../src/theme';
import { CustomAlertDialog } from '../../src/components/CustomAlertDialog';
import { useCustomAlert } from '../../src/hooks/useCustomAlert';
import { FormSheet } from '../../src/components/FormSheet';

const EMOJI_OPTIONS = ['💧', '🏃', '🥗', '🧘', '📚', '💊', '🍎', '💤', '🚶', '💪', '🧠', '✨'];

const SUGGESTIONS = [
  { name: 'Meditar', emoji: '🧘', goalValue: 10, goalUnit: 'min', color: '#a78bfa' },
  { name: 'Leer', emoji: '📖', goalValue: 20, goalUnit: 'páginas', color: '#fbbf24' },
  { name: 'Comer sano', emoji: '🥗', goalValue: 3, goalUnit: 'comidas', color: '#34d399' },
  { name: 'Dormir 8h', emoji: '💤', goalValue: 8, goalUnit: 'horas', color: '#60a5fa' },
  { name: 'Sin Cafeína', emoji: '☕', goalValue: 1, goalUnit: 'día', color: '#f87171' }
];

type HabitStepButtonProps = {
  label: string;
  delta: number;
  onStep: (delta: number) => void;
  accessibilityLabel: string;
  styles: ReturnType<typeof createStyles>;
};

function HabitStepButton({
  label,
  delta,
  onStep,
  accessibilityLabel,
  styles
}: HabitStepButtonProps): ReactElement {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatCountRef = useRef(0);
  const holdingRef = useRef(false);

  function clearRepeat(): void {
    holdingRef.current = false;
    repeatCountRef.current = 0;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function scheduleRepeat(delayMs: number): void {
    timeoutRef.current = setTimeout(() => {
      if (!holdingRef.current) return;
      repeatCountRef.current += 1;
      onStep(delta);
      const nextDelay = Math.max(160, delayMs - (repeatCountRef.current % 4 === 0 ? 45 : 0));
      scheduleRepeat(nextDelay);
    }, delayMs);
  }

  useEffect(() => clearRepeat, []);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.stepBtn,
        holdingRef.current && styles.stepBtnHolding,
        pressed && { opacity: 0.7 }
      ]}
      onPressIn={() => {
        clearRepeat();
        holdingRef.current = true;
        onStep(delta);
        scheduleRepeat(520);
      }}
      onPressOut={clearRepeat}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.stepBtnText}>{label}</Text>
    </Pressable>
  );
}

export default function HabitsScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const habits = useLifeStore((s) => s.habits);
  const addHabit = useLifeStore((s) => s.addHabit);
  const deleteHabit = useLifeStore((s) => s.deleteHabit);
  const updateHabit = useLifeStore((s) => s.updateHabit);
  const logHabit = useLifeStore((s) => s.logHabit);
  const unlogHabit = useLifeStore((s) => s.unlogHabit);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);

  const [newHabit, setNewHabit] = useState({
    name: '',
    emoji: '✨',
    goalValue: 1,
    goalUnit: 'check'
  });
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const todayKey = getTodayStr();
  const totalHabits = habits.length;
  const completedToday = habits.filter((h) => h.lastCompletedDate === todayKey).length;
  const longestStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak)) : 0;

  function toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function handleSave() {
    if (!newHabit.name.trim()) return;

    if (editingHabitId) {
      updateHabit(editingHabitId, {
        ...newHabit,
        name: newHabit.name.trim()
      });
      setEditingHabitId(null);
    } else {
      addHabit({
        ...newHabit,
        name: newHabit.name.trim(),
        color: lifeTheme.colors.primary
      });
    }

    setModalVisible(false);
    setNewHabit({ name: '', emoji: '✨', goalValue: 1, goalUnit: 'check' });
  }

  function handleEdit(habit: any) {
    setEditingHabitId(habit.id);
    setNewHabit({
      name: habit.name,
      emoji: habit.emoji,
      goalValue: habit.goalValue,
      goalUnit: habit.goalUnit
    });
    setModalVisible(true);
  }

  function formatProgressValue(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hdr}>
        <Text style={styles.title}>🌟 Mis Hábitos</Text>
        <Pressable style={styles.addBtn} onPress={() => { setEditingHabitId(null); setModalVisible(true); }}>
          <Text style={styles.addBtnText}>+ Nuevo</Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>Construye constancia con pequeños actos diarios.</Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{completedToday}/{totalHabits || 0}</Text>
          <Text style={styles.summaryLabel}>Hoy</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{longestStreak}</Text>
          <Text style={styles.summaryLabel}>Mejor racha</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalHabits}</Text>
          <Text style={styles.summaryLabel}>Totales</Text>
        </View>
      </View>

      <Text style={styles.helperText}>Tip: toca + o - para ajustar de a uno; mantenlo presionado para avanzar continuo.</Text>

      {habits.length > 0 && (() => {
        const maxStreak = Math.max(...habits.map((h) => h.streak), 7);
        return (
          <View style={styles.streakPanel}>
            <Text style={styles.sectLabel}>Rachas Actuales</Text>
            <View style={styles.streakChart}>
              {habits.map((h) => (
                <View key={h.id} style={styles.streakRow}>
                  <Text style={styles.streakRowEmoji}>{h.emoji}</Text>
                  <View style={styles.streakBarTrack}>
                    <View
                      style={[
                        styles.streakBarFill,
                        {
                          width: `${(h.streak / maxStreak) * 100}%`,
                          backgroundColor: h.streak > 0 ? lifeTheme.colors.alert : lifeTheme.colors.border
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.streakRowVal}>🔥 {h.streak}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })()}

      <View style={styles.list}>
        {habits.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No tienes hábitos configurados.{"\n"}¡Crea uno para empezar tu racha!</Text>
          </View>
        ) : (
          habits.map((habit, idx) => {
            const isCompletedToday = habit.lastCompletedDate === todayKey;
            const todayTotal = habit.logs.reduce((sum, log) => {
              const logDate = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
              return toDateKey(logDate) === todayKey ? sum + log.value : sum;
            }, 0);
            const goalValue = habit.goalValue || 1;
            const progress = Math.min(1, todayTotal / goalValue);

            return (
              <Animated.View
                key={habit.id}
                entering={FadeInDown.delay(idx * 50)}
                layout={Layout.springify()}
                style={styles.habitCard}
              >
                <View style={styles.habitMain}>
                  <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.habitName}>{habit.name}</Text>
                    <Text style={styles.habitGoal}>Meta: {habit.goalValue} {habit.goalUnit}</Text>
                  </View>
                  <View style={[styles.streakBadge, { backgroundColor: `${habit.color ?? lifeTheme.colors.alert}22` }]}>
                    <Text style={[styles.streakText, { color: habit.color ?? lifeTheme.colors.alert }]}>🔥 {habit.streak}</Text>
                  </View>
                </View>

                <View style={styles.habitProgressRow}>
                  <Text style={styles.habitProgressText}>
                    Hoy: {formatProgressValue(Math.min(todayTotal, goalValue))}/{formatProgressValue(goalValue)} {habit.goalUnit}
                  </Text>
                  <Text style={styles.habitProgressPct}>{Math.round(progress * 100)}%</Text>
                </View>
                <View style={styles.habitProgressTrack}>
                  <View
                    style={[
                      styles.habitProgressFill,
                      { width: `${progress * 100}%`, backgroundColor: habit.color ?? lifeTheme.colors.primary }
                    ]}
                  />
                </View>

                <View style={styles.habitActions}>
                  <HabitStepButton
                    label="−"
                    delta={-1}
                    onStep={(delta) => logHabit(habit.id, delta)}
                    styles={styles}
                    accessibilityLabel={`Disminuir progreso del habito ${habit.name}`}
                  />

                  <HabitStepButton
                    label="+"
                    delta={1}
                    onStep={(delta) => logHabit(habit.id, delta)}
                    styles={styles}
                    accessibilityLabel={`Aumentar progreso del habito ${habit.name}`}
                  />

                  <Pressable
                    style={({ pressed }) => [
                      styles.completeBtn,
                      pressed && { opacity: 0.7 },
                      isCompletedToday && styles.completeBtnDone
                    ]}
                    onPress={() => {
                      if (isCompletedToday) {
                        unlogHabit(habit.id);
                        return;
                      }
                      const remaining = Math.max(0, goalValue - todayTotal);
                      if (remaining > 0) {
                        logHabit(habit.id, remaining);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={isCompletedToday ? `Deshacer completado del habito ${habit.name}` : `Completar habito ${habit.name} al 100 por ciento`}
                  >
                    <Text style={styles.completeBtnText}>
                      {isCompletedToday ? 'Completado ✓' : 'Completar 100%'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.editBtn}
                    onPress={() => handleEdit(habit)}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar habito ${habit.name}`}
                  >
                    <Text style={styles.delBtnText}>✏️</Text>
                  </Pressable>

                  <Pressable
                    style={styles.delBtn}
                    onPress={() => {
                      showAlert('Eliminar', `¿Borrar hábito "${habit.name}"?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Eliminar', style: 'destructive', onPress: () => deleteHabit(habit.id) }
                      ]);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar habito ${habit.name}`}
                  >
                    <Text style={styles.delBtnText}>🗑</Text>
                  </Pressable>
                </View>
              </Animated.View>
            );
          })
        )}
      </View>

      <FormSheet visible={modalVisible} onClose={() => { setModalVisible(false); setEditingHabitId(null); }}>
                <Text style={styles.modalTitle}>{editingHabitId ? 'Editar Hábito' : 'Nuevo Hábito'}</Text>

                <View style={styles.modalSuggestions}>
                  <Text style={styles.label}>Sugerencias rápidas</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionList}>
                    {SUGGESTIONS.map((s, i) => (
                      <Pressable
                        key={i}
                        style={styles.suggestionItemSmall}
                        onPress={() => setNewHabit({
                          name: s.name,
                          emoji: s.emoji,
                          goalValue: s.goalValue,
                          goalUnit: s.goalUnit
                        })}
                      >
                        <Text style={styles.suggestionEmojiSmall}>{s.emoji}</Text>
                        <Text style={styles.suggestionNameSmall}>{s.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  value={newHabit.name}
                  onChangeText={(v) => setNewHabit((prev) => ({ ...prev, name: v }))}
                  placeholder="Ej: Meditar, Beber agua..."
                  placeholderTextColor={lifeTheme.colors.muted}
                />

                <Text style={styles.label}>Emoji</Text>
                <View style={styles.emojiRow}>
                  {EMOJI_OPTIONS.map((e) => (
                    <Pressable
                      key={e}
                      style={[styles.emojiBtn, newHabit.emoji === e && styles.emojiBtnActive]}
                      onPress={() => setNewHabit((prev) => ({ ...prev, emoji: e }))}
                    >
                      <Text style={{ fontSize: 20 }}>{e}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.goalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Meta</Text>
                    <TextInput
                      style={styles.input}
                      value={String(newHabit.goalValue)}
                      onChangeText={(v) => setNewHabit((prev) => ({ ...prev, goalValue: Number(v) || 0 }))}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.label}>Unidad</Text>
                    <TextInput
                      style={styles.input}
                      value={newHabit.goalUnit}
                      onChangeText={(v) => setNewHabit((prev) => ({ ...prev, goalUnit: v }))}
                      placeholder="litros, km, etc."
                    />
                  </View>
                </View>

                <View style={styles.modalBtns}>
                  <Pressable style={styles.cancelBtn} onPress={() => { setModalVisible(false); setEditingHabitId(null); }}>
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={styles.saveBtn} onPress={handleSave}>
                    <Text style={styles.saveBtnText}>{editingHabitId ? 'Guardar' : 'Crear'}</Text>
                  </Pressable>
                </View>
      </FormSheet>

      <CustomAlertDialog
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onDismiss={hideAlert}
      />

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
    content: { paddingHorizontal: lifeTheme.spacing.lg, gap: lifeTheme.spacing.lg },
    hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: lifeTheme.colors.text, fontSize: lifeTheme.typography.titleLg, fontWeight: '900' },
    subtitle: { color: lifeTheme.colors.muted, fontSize: 12, lineHeight: 18, marginTop: -8 },
    addBtn: { backgroundColor: lifeTheme.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
    addBtnText: { color: lifeTheme.colors.onPrimary, fontWeight: '800', fontSize: 13 },
    summaryCard: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between'
    },
    summaryItem: { alignItems: 'center', flex: 1, gap: 2 },
    summaryValue: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '900' },
    summaryLabel: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '700' },
    helperText: { color: lifeTheme.colors.muted, fontSize: 11, lineHeight: 16 },
    modalSuggestions: { gap: 8, marginBottom: 8 },
    sectLabel: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginLeft: 4 },
    suggestionList: { gap: 10, paddingRight: 40 },
    suggestionItemSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      gap: 6
    },
    suggestionEmojiSmall: { fontSize: 14 },
    suggestionNameSmall: { color: lifeTheme.colors.text, fontSize: 12, fontWeight: '700' },
    streakPanel: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      marginBottom: 10,
      gap: 12
    },
    streakChart: { gap: 8 },
    streakRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    streakRowEmoji: { fontSize: 16, width: 24, textAlign: 'center' },
    streakBarTrack: { flex: 1, height: 8, backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
    streakBarFill: { height: '100%', borderRadius: 4 },
    streakRowVal: { color: lifeTheme.colors.text, fontWeight: '900', fontSize: 12, width: 34, textAlign: 'right' },
    list: { gap: 10 },
    habitCard: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 12,
      gap: 12
    },
    habitMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    habitEmoji: { fontSize: 24 },
    habitName: { color: lifeTheme.colors.text, fontSize: 15, fontWeight: '800' },
    habitGoal: { color: lifeTheme.colors.muted, fontSize: lifeTheme.typography.bodySm },
    streakBadge: { backgroundColor: 'rgba(252,108,143,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    streakText: { color: lifeTheme.colors.alert, fontWeight: '900', fontSize: 12 },
    habitProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    habitProgressText: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700' },
    habitProgressPct: { color: lifeTheme.colors.text, fontSize: 12, fontWeight: '800' },
    habitProgressTrack: { height: 6, borderRadius: 999, backgroundColor: lifeTheme.colors.surfaceAlt, overflow: 'hidden' },
    habitProgressFill: { height: '100%', borderRadius: 999 },
    habitActions: { flexDirection: 'row', gap: 8 },
    stepBtn: {
      width: 42,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      alignItems: 'center'
    },
    stepBtnHolding: {
      borderColor: lifeTheme.colors.primary,
      backgroundColor: `${lifeTheme.colors.primary}18`
    },
    stepBtnText: { color: lifeTheme.colors.text, fontWeight: '900', fontSize: 16 },
    completeBtn: {
      flex: 1,
      backgroundColor: lifeTheme.colors.primary,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center'
    },
    completeBtnDone: {
      backgroundColor: lifeTheme.colors.success
    },
    completeBtnText: { color: lifeTheme.colors.onPrimary, fontWeight: '800', fontSize: 12 },
    editBtn: { backgroundColor: lifeTheme.colors.surfaceAlt, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border },
    delBtn: { backgroundColor: lifeTheme.colors.surfaceAlt, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border },
    delBtnText: { fontSize: 14 },
    emptyCard: { padding: 40, alignItems: 'center' },
    emptyText: { color: lifeTheme.colors.muted, textAlign: 'center', lineHeight: 22 },
    modalTitle: { color: lifeTheme.colors.text, fontSize: 20, fontWeight: '900', marginBottom: 4 },
    label: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    input: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 12, padding: 14, color: lifeTheme.colors.text, fontSize: 16, borderWidth: 1, borderColor: lifeTheme.colors.border },
    emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    emojiBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: lifeTheme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
    emojiBtnActive: { borderColor: lifeTheme.colors.primary, backgroundColor: 'rgba(124,108,252,0.1)' },
    goalRow: { flexDirection: 'row', gap: 12 },
    modalBtns: { flexDirection: 'row', gap: 12, marginTop: 10 },
    cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
    cancelBtnText: { color: lifeTheme.colors.muted, fontWeight: '700' },
    saveBtn: { flex: 2, backgroundColor: lifeTheme.colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { color: lifeTheme.colors.onPrimary, fontWeight: '800' }
  });
}
