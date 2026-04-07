import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInDown, FadeOutUp, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SwipeableTaskCard } from '../../src/components/SwipeableTaskCard';
import { useLifeStore } from '../../src/store/useLifeStore';
import { lifeTheme } from '../../src/theme';
import type { Task, TaskUrgency } from '../../src/types';

// ─── Constants ────────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  description: string;
  eta_minutes: number;
  priority: 1 | 2 | 3 | 4 | 5;
  cognitive_load: number;
  deadline: Date | null;
  fixed_start: Date | null;
  fixed_end: Date | null;
  urgency: TaskUrgency;
}

const DEFAULT_FORM: FormState = {
  title: '',
  description: '',
  eta_minutes: 45,
  priority: 3,
  cognitive_load: 5,
  deadline: null,
  fixed_start: null,
  fixed_end: null,
  urgency: 'this_week'
};

const PRIORITY_COLORS: Record<number, string> = {
  1: '#6b7280',
  2: '#22d3ee',
  3: lifeTheme.colors.primary,
  4: '#f59e0b',
  5: lifeTheme.colors.alert
};

const LOAD_COLOR = (val: number): string => {
  if (val <= 3) return lifeTheme.colors.success;
  if (val <= 6) return '#f59e0b';
  return lifeTheme.colors.alert;
};

const URGENCY_OPTIONS: { value: TaskUrgency; label: string; icon: string; color: string }[] = [
  { value: 'today', label: 'Hoy', icon: '🔥', color: lifeTheme.colors.alert },
  { value: 'this_week', label: 'Semana', icon: '📅', color: '#f59e0b' },
  { value: 'this_month', label: 'Mes', icon: '🗓', color: lifeTheme.colors.primary },
  { value: 'someday', label: 'Algún día', icon: '💭', color: lifeTheme.colors.muted }
];

type FilterType = 'all' | 'today' | 'this_week' | 'pool' | 'completed';

// ─── Date Picker Block ────────────────────────────────────────────────────────

function DatePickerBlock({
  label,
  value,
  onClear,
  onConfirm
}: {
  label: string;
  value: Date | null;
  onClear: () => void;
  onConfirm: (d: Date) => void;
}): ReactElement {
  const [show, setShow] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <Pressable
        style={styles.dateButton}
        onPress={() => setShow((v) => !v)}
      >
        <Text style={[styles.dateButtonText, value ? styles.dateButtonTextActive : null]}>
          {value
            ? `📅 ${value.toLocaleDateString()} ${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : '+ Seleccionar'}
        </Text>
        {value && (
          <Pressable
            hitSlop={12}
            onPress={(e) => {
              e.stopPropagation();
              onClear();
              setShow(false);
            }}
          >
            <Text style={styles.clearDate}>✕</Text>
          </Pressable>
        )}
      </Pressable>
      {show && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={new Date()}
          onChange={(_event, date) => {
            // Fix crash: Android passes undefined on cancel
            if (Platform.OS === 'android') setShow(false);
            if (date != null) onConfirm(date);
          }}
          themeVariant="dark"
        />
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PoolScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const tasks = useLifeStore((s) => s.tasks);
  const addTask = useLifeStore((s) => s.addTask);
  const updateTask = useLifeStore((s) => s.updateTask);
  const deleteTask = useLifeStore((s) => s.deleteTask);
  const completeTask = useLifeStore((s) => s.completeTask);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');

  const sorted = useMemo(() => {
    let filtered: Task[];
    if (filterStatus === 'all') filtered = tasks;
    else if (filterStatus === 'completed') filtered = tasks.filter((t) => t.status === 'completed');
    else if (filterStatus === 'pool') filtered = tasks.filter((t) => t.status !== 'completed');
    else if (filterStatus === 'today') filtered = tasks.filter((t) => t.urgency === 'today' && t.status !== 'completed');
    else filtered = tasks.filter((t) => t.urgency === 'this_week' && t.status !== 'completed');

    return [...filtered].sort((a, b) => {
      // Completed always last
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      const urgOrd = { today: 4, this_week: 3, this_month: 2, someday: 1 };
      const urgDiff = urgOrd[b.urgency] - urgOrd[a.urgency];
      if (urgDiff !== 0) return urgDiff;
      return b.priority - a.priority;
    });
  }, [tasks, filterStatus]);

  function resetForm() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
  }

  function handleEdit(task: Task) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? '',
      eta_minutes: task.eta_minutes,
      priority: task.priority,
      cognitive_load: task.cognitive_load,
      deadline: task.deadline ?? null,
      fixed_start: (task as any).fixed_start ?? null,
      fixed_end: (task as any).fixed_end ?? null,
      urgency: task.urgency ?? 'someday'
    });
  }

  function handleSubmit() {
    if (!form.title.trim()) {
      Alert.alert('Título requerido', 'Agrega un nombre para la tarea antes de guardar.');
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      eta_minutes: form.eta_minutes,
      priority: form.priority,
      cognitive_load: form.cognitive_load,
      deadline: form.deadline ?? undefined,
      fixed_start: form.fixed_start ?? undefined,
      fixed_end: form.fixed_end ?? undefined,
      urgency: form.urgency
    };
    if (editingId) {
      updateTask(editingId, payload);
    } else {
      addTask(payload);
    }
    resetForm();
  }

  function handleDelete(id: string) {
    Alert.alert('Eliminar tarea', '¿Seguro que quieres eliminar esta tarea?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteTask(id) }
    ]);
  }

  const priorityColor = PRIORITY_COLORS[form.priority];
  const loadColor = LOAD_COLOR(form.cognitive_load);

  const todayCount = tasks.filter((t) => t.urgency === 'today' && t.status !== 'completed').length;
  const weekCount = tasks.filter((t) => t.urgency === 'this_week' && t.status !== 'completed').length;
  const pendingCount = tasks.filter((t) => t.status === 'pool').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📋 Task Pool</Text>
        <View style={styles.countsRow}>
          <View style={[styles.countChip, { borderColor: `${lifeTheme.colors.alert}44` }]}>
            <Text style={[styles.countNum, { color: lifeTheme.colors.alert }]}>{todayCount}</Text>
            <Text style={styles.countLabel}>hoy</Text>
          </View>
          <View style={[styles.countChip, { borderColor: '#f59e0b44' }]}>
            <Text style={[styles.countNum, { color: '#f59e0b' }]}>{weekCount}</Text>
            <Text style={styles.countLabel}>semana</Text>
          </View>
          <View style={[styles.countChip, { borderColor: `${lifeTheme.colors.success}44` }]}>
            <Text style={[styles.countNum, { color: lifeTheme.colors.success }]}>{completedCount}</Text>
            <Text style={styles.countLabel}>✓ done</Text>
          </View>
        </View>
      </View>

      {/* Form card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{editingId ? '✏️ Editar tarea' : '+ Nueva tarea'}</Text>

        {/* Title */}
        <TextInput
          value={form.title}
          onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
          placeholder="Título de la tarea"
          placeholderTextColor={lifeTheme.colors.muted}
          style={styles.input}
          returnKeyType="next"
        />

        {/* Description */}
        <TextInput
          value={form.description}
          onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
          placeholder="Descripción (opcional)"
          placeholderTextColor={lifeTheme.colors.muted}
          style={[styles.input, styles.textArea]}
          multiline
          numberOfLines={2}
        />

        {/* Urgency chips */}
        <View>
          <Text style={styles.sliderLabel}>Urgencia</Text>
          <View style={styles.urgencyRow}>
            {URGENCY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.urgencyChip,
                  form.urgency === opt.value && {
                    backgroundColor: `${opt.color}22`,
                    borderColor: opt.color
                  }
                ]}
                onPress={() => setForm((f) => ({ ...f, urgency: opt.value }))}
              >
                <Text style={styles.urgencyIcon}>{opt.icon}</Text>
                <Text style={[
                  styles.urgencyLabel,
                  form.urgency === opt.value && { color: opt.color, fontWeight: '800' }
                ]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ETA */}
        <View style={styles.sliderBlock}>
          <View style={styles.sliderLabelRow}>
            <Text style={styles.sliderLabel}>Duración estimada</Text>
            <Text style={[styles.sliderValue, styles.mono]}>{form.eta_minutes} min</Text>
          </View>
          <Slider
            minimumValue={5}
            maximumValue={240}
            step={5}
            value={form.eta_minutes}
            onValueChange={(v) => setForm((f) => ({ ...f, eta_minutes: Math.round(v) }))}
            minimumTrackTintColor={lifeTheme.colors.primary}
            maximumTrackTintColor={lifeTheme.colors.border}
            thumbTintColor={lifeTheme.colors.primary}
            style={styles.slider}
          />
        </View>

        {/* Priority */}
        <View style={styles.sliderBlock}>
          <View style={styles.sliderLabelRow}>
            <Text style={styles.sliderLabel}>Prioridad</Text>
            <Text style={[styles.sliderValue, { color: priorityColor }]}>
              {'★'.repeat(form.priority)}{'☆'.repeat(5 - form.priority)}
            </Text>
          </View>
          <Slider
            minimumValue={1}
            maximumValue={5}
            step={1}
            value={form.priority}
            onValueChange={(v) => setForm((f) => ({ ...f, priority: Math.round(v) as 1|2|3|4|5 }))}
            minimumTrackTintColor={priorityColor}
            maximumTrackTintColor={lifeTheme.colors.border}
            thumbTintColor={priorityColor}
            style={styles.slider}
          />
        </View>

        {/* Cognitive Load */}
        <View style={styles.sliderBlock}>
          <View style={styles.sliderLabelRow}>
            <Text style={styles.sliderLabel}>Carga cognitiva</Text>
            <Text style={[styles.sliderValue, { color: loadColor }]}>{form.cognitive_load}/10</Text>
          </View>
          <Slider
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={form.cognitive_load}
            onValueChange={(v) => setForm((f) => ({ ...f, cognitive_load: Math.round(v) }))}
            minimumTrackTintColor={loadColor}
            maximumTrackTintColor={lifeTheme.colors.border}
            thumbTintColor={loadColor}
            style={styles.slider}
          />
        </View>

        {/* Hora fija */}
        <DatePickerBlock
          label="Hora de inicio fija (opcional)"
          value={form.fixed_start}
          onClear={() => setForm((f) => ({ ...f, fixed_start: null }))}
          onConfirm={(d) => setForm((f) => ({ ...f, fixed_start: d }))}
        />

        <DatePickerBlock
          label="Hora de fin fija (opcional)"
          value={form.fixed_end}
          onClear={() => setForm((f) => ({ ...f, fixed_end: null }))}
          onConfirm={(d) => setForm((f) => ({ ...f, fixed_end: d }))}
        />

        {/* Deadline */}
        <DatePickerBlock
          label="Deadline (opcional)"
          value={form.deadline}
          onClear={() => setForm((f) => ({ ...f, deadline: null }))}
          onConfirm={(d) => setForm((f) => ({ ...f, deadline: d }))}
        />

        {/* Form buttons */}
        <View style={styles.formActions}>
          <Pressable style={styles.primaryBtn} onPress={handleSubmit}>
            <Text style={styles.primaryBtnText}>{editingId ? 'Actualizar' : 'Guardar tarea'}</Text>
          </Pressable>
          {editingId && (
            <Pressable style={styles.cancelBtn} onPress={resetForm}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
        <View style={styles.filterRow}>
          {([
            { key: 'all', label: 'Todas' },
            { key: 'today', label: '🔥 Hoy' },
            { key: 'this_week', label: '📅 Semana' },
            { key: 'pool', label: 'Pendientes' },
            { key: 'completed', label: '✓ Hechas' }
          ] as { key: FilterType; label: string }[]).map((f) => (
            <Pressable
              key={f.key}
              style={[styles.filterTab, filterStatus === f.key && styles.filterTabActive]}
              onPress={() => setFilterStatus(f.key)}
            >
              <Text style={[styles.filterTabText, filterStatus === f.key && styles.filterTabTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Header count */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>Tareas</Text>
        <Text style={styles.listHeaderHint}>{sorted.length} registradas</Text>
      </View>

      {/* Task list */}
      <View style={styles.list}>
        {sorted.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin tareas aquí</Text>
            <Text style={styles.emptyText}>
              {filterStatus === 'today'
                ? 'No hay tareas marcadas para hoy. ¡Crea una!'
                : 'Agrega la primera tarea y deja que LifeOS la organice.'}
            </Text>
          </View>
        ) : (
          sorted.map((task, index) => (
            <Animated.View
              key={task.id}
              entering={FadeInDown.delay(index * 35).duration(260)}
              exiting={FadeOutUp.duration(180)}
              layout={Layout.springify().damping(20)}
            >
              <SwipeableTaskCard
                task={task}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onComplete={completeTask}
              />
            </Animated.View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: lifeTheme.colors.text, fontSize: 24, fontWeight: '800' },
  countsRow: { flexDirection: 'row', gap: 8 },
  countChip: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1
  },
  countNum: { fontSize: 15, fontWeight: '800' },
  countLabel: { color: lifeTheme.colors.muted, fontSize: 9, fontWeight: '600' },
  card: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: 16,
    gap: 16
  },
  cardLabel: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '800' },
  input: {
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderColor: lifeTheme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: lifeTheme.colors.text,
    fontSize: 15
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  urgencyRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  urgencyChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    gap: 2
  },
  urgencyIcon: { fontSize: 16 },
  urgencyLabel: { color: lifeTheme.colors.muted, fontSize: 10, fontWeight: '600' },
  sliderBlock: { gap: 6 },
  sliderLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '600' },
  sliderValue: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '800' },
  mono: { fontFamily: 'monospace' },
  slider: { width: '100%', height: 32 },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderColor: lifeTheme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  dateButtonText: { color: lifeTheme.colors.muted, fontSize: 14 },
  dateButtonTextActive: { color: lifeTheme.colors.text, fontWeight: '600' },
  clearDate: { color: lifeTheme.colors.alert, fontSize: 16, paddingLeft: 8 },
  formActions: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    flex: 1,
    backgroundColor: lifeTheme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  cancelBtn: {
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    justifyContent: 'center'
  },
  cancelBtnText: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 4, paddingBottom: 4 },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: lifeTheme.colors.surface,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  filterTabActive: {
    backgroundColor: lifeTheme.colors.softPrimary,
    borderColor: lifeTheme.colors.primary
  },
  filterTabText: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700' },
  filterTabTextActive: { color: lifeTheme.colors.primary },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listHeaderTitle: { color: lifeTheme.colors.text, fontSize: 17, fontWeight: '800' },
  listHeaderHint: { color: lifeTheme.colors.muted, fontSize: 12 },
  list: { gap: 10 },
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
  emptyText: { color: lifeTheme.colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' }
});
