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
import { TaskCompletionCheckDialog } from '../../src/components/TaskCompletionCheckDialog';
import { ReplanificationPrompt } from '../../src/components/ReplanificationPrompt';
import { useLifeStore } from '../../src/store/useLifeStore';
import { lifeTheme } from '../../src/theme';
import type { PostponeReason, ScheduleBlock, SkipReason, Task, TaskUrgency } from '../../src/types';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  1: '#6b7280', 2: '#22d3ee', 3: lifeTheme.colors.primary, 4: '#f59e0b', 5: lifeTheme.colors.alert
};

const LOAD_COLOR = (v: number): string =>
  v <= 3 ? lifeTheme.colors.success : v <= 6 ? '#f59e0b' : lifeTheme.colors.alert;

const URGENCY_OPTS: { value: TaskUrgency; label: string; icon: string; color: string }[] = [
  { value: 'today',      label: 'Hoy',      icon: '🔥', color: lifeTheme.colors.alert },
  { value: 'this_week',  label: 'Semana',   icon: '📅', color: '#f59e0b' },
  { value: 'this_month', label: 'Mes',      icon: '🗓', color: lifeTheme.colors.primary },
  { value: 'someday',    label: 'Algún día', icon: '💭', color: lifeTheme.colors.muted }
];

type FilterType = 'all' | 'today' | 'this_week' | 'pool' | 'completed';

// ─── Android-safe DatePicker ──────────────────────────────────────────────────
// Android DateTimePicker crashes when mode="datetime".
// We use two separate pickers: first date, then time.

function SafeDatePicker({
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
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  function handleDateChange(_evt: unknown, selected?: Date) {
    setShowDate(false);
    if (selected == null) return; // user cancelled
    if (Platform.OS === 'android') {
      // Store partial date and show time picker
      setPendingDate(selected);
      setShowTime(true);
    } else {
      onConfirm(selected);
    }
  }

  function handleTimeChange(_evt: unknown, selected?: Date) {
    setShowTime(false);
    if (selected == null || pendingDate == null) { setPendingDate(null); return; }
    const combined = new Date(pendingDate);
    combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setPendingDate(null);
    onConfirm(combined);
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.dateBtn} onPress={() => setShowDate(true)}>
        <Text style={[styles.dateBtnText, value ? styles.dateBtnTextActive : null]}>
          {value
            ? `📅 ${value.toLocaleDateString('es-ES')}  ${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : '+ Seleccionar (opcional)'}
        </Text>
        {value && (
          <Pressable hitSlop={12} onPress={(e) => { e.stopPropagation(); onClear(); }}>
            <Text style={styles.dateClear}>✕</Text>
          </Pressable>
        )}
      </Pressable>

      {showDate && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleDateChange}
          themeVariant="dark"
        />
      )}
      {showTime && (
        <DateTimePicker
          value={pendingDate ?? new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleTimeChange}
          themeVariant="dark"
        />
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PoolScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const tasks = useLifeStore((s) => s.tasks);
  const addTask = useLifeStore((s) => s.addTask);
  const updateTask = useLifeStore((s) => s.updateTask);
  const deleteTask = useLifeStore((s) => s.deleteTask);
  const timeline = useLifeStore((s) => s.timeline);
  const setTimeline = useLifeStore((s) => s.setTimeline);
  const confirmCompletionOK = useLifeStore((s) => s.confirmCompletionOK);
  const confirmCompletionPartial = useLifeStore((s) => s.confirmCompletionPartial);
  const reportTaskSkipped = useLifeStore((s) => s.reportTaskSkipped);
  const reportTaskPostponed = useLifeStore((s) => s.reportTaskPostponed);
  const confirmReplan = useLifeStore((s) => s.confirmReplan);
  const rejectReplan = useLifeStore((s) => s.rejectReplan);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [filter, setFilter] = useState<FilterType>('all');
  const [completionTask, setCompletionTask] = useState<Task | null>(null);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [replanPreview, setReplanPreview] = useState<{
    previous: ScheduleBlock[];
    next: ScheduleBlock[];
  } | null>(null);

  // Sort: urgency > priority > completed last
  const sorted = useMemo(() => {
    const urgOrd: Record<TaskUrgency, number> = { today: 4, this_week: 3, this_month: 2, someday: 1 };
    let list: Task[];

    if (filter === 'all')       list = [...tasks];
    else if (filter === 'pool') list = tasks.filter((t) => t.status !== 'completed');
    else if (filter === 'completed') list = tasks.filter((t) => t.status === 'completed');
    else if (filter === 'today')    list = tasks.filter((t) => t.urgency === 'today' && t.status !== 'completed');
    else                             list = tasks.filter((t) => t.urgency === 'this_week' && t.status !== 'completed');

    return list.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      const uDiff = urgOrd[b.urgency ?? 'someday'] - urgOrd[a.urgency ?? 'someday'];
      return uDiff !== 0 ? uDiff : b.priority - a.priority;
    });
  }, [tasks, filter]);

  function resetForm() { setEditingId(null); setForm(DEFAULT_FORM); }

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
      urgency: (task as any).urgency ?? 'someday'
    });
  }

  function handleDelete(id: string) {
    Alert.alert('Eliminar tarea', '¿Eliminar esta tarea? No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteTask(id) }
    ]);
  }

  async function handleConfirmCompletionOK(taskId: string): Promise<void> {
    setIsSubmittingCompletion(true);
    try {
      await confirmCompletionOK(taskId);
      setCompletionTask(null);
    } finally {
      setIsSubmittingCompletion(false);
    }
  }

  async function handleConfirmCompletionPartial(taskId: string, notes: string): Promise<void> {
    setIsSubmittingCompletion(true);
    try {
      await confirmCompletionPartial(taskId, notes);
      setCompletionTask(null);
    } finally {
      setIsSubmittingCompletion(false);
    }
  }

  async function handleReportTaskSkipped(taskId: string, reason: SkipReason, details: string): Promise<void> {
    setIsSubmittingCompletion(true);
    const previousTimeline = [...timeline];
    try {
      await reportTaskSkipped(taskId, reason, details);
      setCompletionTask(null);
      const nextTimeline = [...useLifeStore.getState().timeline];
      if (nextTimeline.length > 0) {
        setReplanPreview({ previous: previousTimeline, next: nextTimeline });
      }
    } finally {
      setIsSubmittingCompletion(false);
    }
  }

  async function handleReportTaskPostponed(
    taskId: string,
    reason: PostponeReason,
    details: string,
    postponedUntil: Date
  ): Promise<void> {
    setIsSubmittingCompletion(true);
    const previousTimeline = [...timeline];
    try {
      await reportTaskPostponed(taskId, reason, details, postponedUntil);
      setCompletionTask(null);
      const nextTimeline = [...useLifeStore.getState().timeline];
      if (nextTimeline.length > 0) {
        setReplanPreview({ previous: previousTimeline, next: nextTimeline });
      }
    } finally {
      setIsSubmittingCompletion(false);
    }
  }

  function handleSubmit() {
    if (!form.title.trim()) {
      Alert.alert('Campo requerido', 'El título no puede estar vacío.');
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
    if (editingId) updateTask(editingId, payload);
    else addTask(payload);
    resetForm();
  }

  const todayCount = tasks.filter((t) => t.urgency === 'today' && t.status !== 'completed').length;
  const weekCount  = tasks.filter((t) => t.urgency === 'this_week' && t.status !== 'completed').length;
  const doneCount  = tasks.filter((t) => t.status === 'completed').length;

  const p = form.priority;
  const prioColor = PRIORITY_COLORS[p];
  const loadColor = LOAD_COLOR(form.cognitive_load);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.hdr}>
        <Text style={styles.title}>📋 Task Pool</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, { borderColor: `${lifeTheme.colors.alert}55` }]}>
            <Text style={[styles.badgeNum, { color: lifeTheme.colors.alert }]}>{todayCount}</Text>
            <Text style={styles.badgeLbl}>hoy</Text>
          </View>
          <View style={[styles.badge, { borderColor: '#f59e0b55' }]}>
            <Text style={[styles.badgeNum, { color: '#f59e0b' }]}>{weekCount}</Text>
            <Text style={styles.badgeLbl}>semana</Text>
          </View>
          <View style={[styles.badge, { borderColor: `${lifeTheme.colors.success}55` }]}>
            <Text style={[styles.badgeNum, { color: lifeTheme.colors.success }]}>{doneCount}</Text>
            <Text style={styles.badgeLbl}>✓</Text>
          </View>
        </View>
      </View>

      {/* Form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{editingId ? '✏️ Editar tarea' : '+ Nueva tarea'}</Text>

        <TextInput
          style={styles.input}
          value={form.title}
          onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
          placeholder="Título de la tarea"
          placeholderTextColor={lifeTheme.colors.muted}
          returnKeyType="next"
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.description}
          onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
          placeholder="Descripción (opcional)"
          placeholderTextColor={lifeTheme.colors.muted}
          multiline
          numberOfLines={2}
        />

        {/* Urgency */}
        <View>
          <Text style={styles.fieldLabel}>¿Cuándo debe hacerse? *</Text>
          <View style={styles.urgencyRow}>
            {URGENCY_OPTS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.urgencyChip,
                  form.urgency === opt.value && {
                    backgroundColor: `${opt.color}1A`,
                    borderColor: opt.color
                  }
                ]}
                onPress={() => setForm((f) => ({ ...f, urgency: opt.value }))}
              >
                <Text style={styles.urgencyIcon}>{opt.icon}</Text>
                <Text style={[styles.urgencyLabel, form.urgency === opt.value && { color: opt.color, fontWeight: '800' }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Duration */}
        <View>
          <View style={styles.sliderHdr}>
            <Text style={styles.fieldLabel}>Duración estimada</Text>
            <Text style={[styles.sliderVal, { fontFamily: 'monospace' }]}>{form.eta_minutes} min</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={5} maximumValue={240} step={5}
            value={form.eta_minutes}
            onValueChange={(v) => setForm((f) => ({ ...f, eta_minutes: Math.round(v) }))}
            minimumTrackTintColor={lifeTheme.colors.primary}
            maximumTrackTintColor={lifeTheme.colors.border}
            thumbTintColor={lifeTheme.colors.primary}
          />
        </View>

        {/* Priority */}
        <View>
          <View style={styles.sliderHdr}>
            <Text style={styles.fieldLabel}>Prioridad</Text>
            <Text style={[styles.sliderVal, { color: prioColor }]}>{'★'.repeat(p)}{'☆'.repeat(5 - p)}</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={1} maximumValue={5} step={1}
            value={form.priority}
            onValueChange={(v) => setForm((f) => ({ ...f, priority: Math.round(v) as 1|2|3|4|5 }))}
            minimumTrackTintColor={prioColor}
            maximumTrackTintColor={lifeTheme.colors.border}
            thumbTintColor={prioColor}
          />
        </View>

        {/* Cognitive Load */}
        <View>
          <View style={styles.sliderHdr}>
            <Text style={styles.fieldLabel}>Carga cognitiva</Text>
            <Text style={[styles.sliderVal, { color: loadColor }]}>{form.cognitive_load}/10</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={1} maximumValue={10} step={1}
            value={form.cognitive_load}
            onValueChange={(v) => setForm((f) => ({ ...f, cognitive_load: Math.round(v) }))}
            minimumTrackTintColor={loadColor}
            maximumTrackTintColor={lifeTheme.colors.border}
            thumbTintColor={loadColor}
          />
        </View>

        {/* Hora de inicio */}
        <SafeDatePicker
          label="🕐 Hora de inicio fija (opcional)"
          value={form.fixed_start}
          onClear={() => setForm((f) => ({ ...f, fixed_start: null }))}
          onConfirm={(d) => setForm((f) => ({ ...f, fixed_start: d }))}
        />

        {/* Hora de fin */}
        <SafeDatePicker
          label="🕐 Hora de fin fija (opcional)"
          value={form.fixed_end}
          onClear={() => setForm((f) => ({ ...f, fixed_end: null }))}
          onConfirm={(d) => setForm((f) => ({ ...f, fixed_end: d }))}
        />

        {/* Deadline */}
        <SafeDatePicker
          label="⏰ Fecha límite / Deadline (opcional)"
          value={form.deadline}
          onClear={() => setForm((f) => ({ ...f, deadline: null }))}
          onConfirm={(d) => setForm((f) => ({ ...f, deadline: d }))}
        />

        {/* Buttons */}
        <View style={styles.formBtns}>
          <Pressable style={styles.primaryBtn} onPress={handleSubmit}>
            <Text style={styles.primaryBtnText}>{editingId ? 'Actualizar tarea' : 'Guardar tarea'}</Text>
          </Pressable>
          {editingId && (
            <Pressable style={styles.cancelBtn} onPress={resetForm}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterRow}>
          {([
            { key: 'all',       label: 'Todas' },
            { key: 'today',     label: '🔥 Hoy' },
            { key: 'this_week', label: '📅 Semana' },
            { key: 'pool',      label: 'Pendientes' },
            { key: 'completed', label: '✓ Hechas' }
          ] as { key: FilterType; label: string }[]).map((f) => (
            <Pressable
              key={f.key}
              style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* List header */}
      <View style={styles.listHdr}>
        <Text style={styles.listHdrTitle}>Tareas</Text>
        <Text style={styles.listHdrCount}>{sorted.length} registradas</Text>
      </View>

      {/* Task list */}
      <View style={styles.list}>
        {sorted.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin tareas aquí</Text>
            <Text style={styles.emptyText}>
              {filter === 'today'
                ? 'No hay tareas marcadas para hoy. ¡Crea una!'
                : 'Crea tu primera tarea usando el formulario de arriba.'}
            </Text>
          </View>
        ) : (
          sorted.map((task, idx) => (
            <Animated.View
              key={task.id}
              entering={FadeInDown.delay(idx * 30).duration(240)}
              exiting={FadeOutUp.duration(160)}
              layout={Layout.springify().damping(18)}
            >
              <SwipeableTaskCard
                task={task}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onComplete={(taskId) => {
                  const selected = tasks.find((item) => item.id === taskId) ?? null;
                  setCompletionTask(selected);
                }}
              />
            </Animated.View>
          ))
        )}
      </View>

      <TaskCompletionCheckDialog
        visible={completionTask != null}
        task={completionTask}
        isSubmitting={isSubmittingCompletion}
        onClose={() => {
          if (!isSubmittingCompletion) setCompletionTask(null);
        }}
        onConfirmOK={handleConfirmCompletionOK}
        onConfirmPartial={handleConfirmCompletionPartial}
        onReportSkipped={handleReportTaskSkipped}
        onReportPostponed={handleReportTaskPostponed}
      />

      <ReplanificationPrompt
        visible={replanPreview != null}
        previousBlocks={replanPreview?.previous ?? []}
        nextBlocks={replanPreview?.next ?? []}
        onConfirm={() => {
          if (!replanPreview) return;
          void confirmReplan(replanPreview.next);
          setReplanPreview(null);
        }}
        onReject={() => {
          if (replanPreview) {
            setTimeline(replanPreview.previous);
          }
          rejectReplan();
          setReplanPreview(null);
        }}
      />

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  content: { paddingHorizontal: 16, gap: 14, paddingBottom: 32 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: lifeTheme.colors.text, fontSize: 22, fontWeight: '800' },
  badges: { flexDirection: 'row', gap: 6 },
  badge: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 5, alignItems: 'center',
    borderWidth: 1, borderColor: lifeTheme.colors.border
  },
  badgeNum: { fontSize: 14, fontWeight: '800' },
  badgeLbl: { color: lifeTheme.colors.muted, fontSize: 8, fontWeight: '600' },
  card: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: lifeTheme.colors.border, padding: 16, gap: 16
  },
  cardTitle: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '800' },
  input: {
    backgroundColor: lifeTheme.colors.surfaceAlt, borderColor: lifeTheme.colors.border,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: lifeTheme.colors.text, fontSize: 15
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  fieldLabel: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  urgencyRow: { flexDirection: 'row', gap: 8 },
  urgencyChip: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    backgroundColor: lifeTheme.colors.surfaceAlt, borderWidth: 1,
    borderColor: lifeTheme.colors.border, gap: 3
  },
  urgencyIcon: { fontSize: 17 },
  urgencyLabel: { color: lifeTheme.colors.muted, fontSize: 9, fontWeight: '600', textAlign: 'center' },
  sliderHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderVal: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '800' },
  slider: { width: '100%', height: 30 },
  dateBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: lifeTheme.colors.surfaceAlt, borderColor: lifeTheme.colors.border,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12
  },
  dateBtnText: { color: lifeTheme.colors.muted, fontSize: 13, flex: 1 },
  dateBtnTextActive: { color: lifeTheme.colors.text, fontWeight: '600' },
  dateClear: { color: lifeTheme.colors.alert, fontSize: 16, paddingLeft: 8 },
  formBtns: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    flex: 1, backgroundColor: lifeTheme.colors.primary,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center'
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  cancelBtn: {
    paddingHorizontal: 16, borderRadius: 12, borderWidth: 1,
    borderColor: lifeTheme.colors.border, justifyContent: 'center'
  },
  cancelBtnText: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: lifeTheme.colors.surface, borderWidth: 1, borderColor: lifeTheme.colors.border
  },
  filterTabActive: { backgroundColor: lifeTheme.colors.softPrimary, borderColor: lifeTheme.colors.primary },
  filterTabText: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700' },
  filterTabTextActive: { color: lifeTheme.colors.primary },
  listHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listHdrTitle: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '800' },
  listHdrCount: { color: lifeTheme.colors.muted, fontSize: 12 },
  list: { gap: 10 },
  emptyCard: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: lifeTheme.colors.border,
    padding: 24, gap: 8, alignItems: 'center'
  },
  emptyTitle: { color: lifeTheme.colors.text, fontSize: 15, fontWeight: '700' },
  emptyText: { color: lifeTheme.colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 }
});
