import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Slider from '@react-native-community/slider';
import Animated, { FadeInDown, FadeOutUp, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SwipeableTaskCard } from '../../src/components/SwipeableTaskCard';
import { TaskCompletionCheckDialog } from '../../src/components/TaskCompletionCheckDialog';
import { ReplanificationPrompt } from '../../src/components/ReplanificationPrompt';
import { CustomAlertDialog } from '../../src/components/CustomAlertDialog';
import { useLifeStore } from '../../src/store/useLifeStore';
import { useAppTheme } from '../../src/theme';
import { useCustomAlert } from '../../src/hooks/useCustomAlert';
import { AppDateTimePickerSheet } from '../../src/components/AppDateTimePickerSheet';
import type { PostponeReason, ScheduleBlock, SkipReason, Task, TaskUrgency } from '../../src/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  description: string;
  emoji: string;
  color: string;
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
  emoji: '✨',
  color: '',
  eta_minutes: 45,
  priority: 3,
  cognitive_load: 5,
  deadline: null,
  fixed_start: null,
  fixed_end: null,
  urgency: 'this_week'
};

function getPriorityColors(lifeTheme: ReturnType<typeof useAppTheme>): Record<number, string> {
  return {
    1: '#6b7280',
    2: '#22d3ee',
    3: lifeTheme.colors.primary,
    4: '#f59e0b',
    5: lifeTheme.colors.alert
  };
}

function getLoadColor(v: number, lifeTheme: ReturnType<typeof useAppTheme>): string {
  return v <= 3 ? lifeTheme.colors.success : v <= 6 ? '#f59e0b' : lifeTheme.colors.alert;
}

function getUrgencyOptions(lifeTheme: ReturnType<typeof useAppTheme>): { value: TaskUrgency; label: string; icon: string; color: string }[] {
  return [
    { value: 'today', label: 'Hoy', icon: '🔥', color: lifeTheme.colors.alert },
    { value: 'this_week', label: 'Semana', icon: '📅', color: '#f59e0b' },
    { value: 'this_month', label: 'Mes', icon: '🗓', color: lifeTheme.colors.primary },
    { value: 'someday', label: 'Algún día', icon: '💭', color: lifeTheme.colors.muted }
  ];
}

type FilterType =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'pool'
  | 'pending_today'
  | 'priority_high'
  | 'due_soon'
  | 'completed';

const FILTER_OPTIONS: Array<{ key: FilterType; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'today', label: 'Hoy' },
  { key: 'this_week', label: 'Semana' },
  { key: 'this_month', label: 'Mes' },
  { key: 'pool', label: 'Pendientes' },
  { key: 'pending_today', label: 'Pendientes hoy' },
  { key: 'priority_high', label: 'Prioridad alta' },
  { key: 'due_soon', label: 'Deadline cercana' },
  { key: 'completed', label: 'Completadas' }
];

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
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  function handleDateConfirm(selected: Date) {
    setShowDate(false);
    setPendingDate(selected);
    setShowTime(true);
  }

  function handleTimeConfirm(selected: Date) {
    setShowTime(false);
    if (pendingDate == null) { setPendingDate(null); return; }
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

      <AppDateTimePickerSheet
        visible={showDate}
        mode="date"
        value={value ?? new Date()}
        title={label}
        subtitle="Elige la fecha con el estilo de la app."
        confirmLabel="Siguiente"
        onConfirm={handleDateConfirm}
        onClose={() => setShowDate(false)}
      />
      <AppDateTimePickerSheet
        visible={showTime}
        mode="time"
        value={pendingDate ?? new Date()}
        title={label}
        subtitle="Ahora elige la hora exacta."
        confirmLabel="Guardar"
        onConfirm={handleTimeConfirm}
        onClose={() => {
          setShowTime(false);
          setPendingDate(null);
        }}
      />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PoolScreen(): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
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
  const lastReplanReason = useLifeStore((s) => s.last_replan_reason);
  const confirmReplan = useLifeStore((s) => s.confirmReplan);
  const rejectReplan = useLifeStore((s) => s.rejectReplan);
  const pendingTaskEditId = useLifeStore((s) => s.pendingTaskEditId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
  const [recentlyCompletedTaskIds, setRecentlyCompletedTaskIds] = useState<string[]>([]);
  const [completionTask, setCompletionTask] = useState<Task | null>(null);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [replanPreview, setReplanPreview] = useState<{
    previous: ScheduleBlock[];
    next: ScheduleBlock[];
  } | null>(null);
  const { alertState, showAlert, hideAlert } = useCustomAlert();

  // Sort: urgency > priority > completed last
  const sorted = useMemo(() => {
    const urgOrd: Record<TaskUrgency, number> = { today: 4, this_week: 3, this_month: 2, someday: 1 };
    const nowMs = Date.now();
    const dueSoonLimitMs = 48 * 60 * 60 * 1000;
    const keepRecentlyCompleted = (task: Task) => recentlyCompletedTaskIds.includes(task.id);
    let list: Task[];

    if (filter === 'all') {
      list = [...tasks];
    } else if (filter === 'pool') {
      list = tasks.filter((t) => t.status !== 'completed' || keepRecentlyCompleted(t));
    } else if (filter === 'completed') {
      list = tasks.filter((t) => t.status === 'completed');
    } else if (filter === 'today') {
      list = tasks.filter((t) => t.urgency === 'today' && (t.status !== 'completed' || keepRecentlyCompleted(t)));
    } else if (filter === 'this_week') {
      list = tasks.filter((t) => t.urgency === 'this_week' && (t.status !== 'completed' || keepRecentlyCompleted(t)));
    } else if (filter === 'this_month') {
      list = tasks.filter((t) => t.urgency === 'this_month' && (t.status !== 'completed' || keepRecentlyCompleted(t)));
    } else if (filter === 'pending_today') {
      list = tasks.filter(
        (t) =>
          (t.urgency === 'today' || t.status === 'scheduled' || t.status === 'in_progress') &&
          (t.status !== 'completed' || keepRecentlyCompleted(t))
      );
    } else if (filter === 'priority_high') {
      list = tasks.filter((t) => t.priority >= 4 && (t.status !== 'completed' || keepRecentlyCompleted(t)));
    } else {
      list = tasks.filter(
        (t) =>
          !!t.deadline &&
          t.deadline.getTime() > nowMs &&
          t.deadline.getTime() - nowMs <= dueSoonLimitMs &&
          (t.status !== 'completed' || keepRecentlyCompleted(t))
      );
    }

    return list.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      const uDiff = urgOrd[b.urgency ?? 'someday'] - urgOrd[a.urgency ?? 'someday'];
      return uDiff !== 0 ? uDiff : b.priority - a.priority;
    });
  }, [tasks, filter, recentlyCompletedTaskIds]);

  function resetForm() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
  }

  function toggleTaskForm() {
    if (isFormCollapsed) {
      resetForm();
      setIsFormCollapsed(false);
      return;
    }

    if (editingId) {
      resetForm();
    }
    setIsFormCollapsed(true);
  }

  function markRecentlyCompleted(taskId: string) {
    setRecentlyCompletedTaskIds((prev) => (prev.includes(taskId) ? prev : [taskId, ...prev].slice(0, 20)));
    setTimeout(() => {
      setRecentlyCompletedTaskIds((prev) => prev.filter((id) => id !== taskId));
    }, 3000);
  }

  function handleEdit(task: Task) {
    setIsFormCollapsed(false);
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? '',
      emoji: task.emoji ?? '✨',
      color: task.color ?? '',
      eta_minutes: task.eta_minutes,
      priority: task.priority,
      cognitive_load: task.cognitive_load,
      deadline: task.deadline ?? null,
      fixed_start: (task as any).fixed_start ?? null,
      fixed_end: (task as any).fixed_end ?? null,
      urgency: (task as any).urgency ?? 'someday'
    });
  }

  useEffect(() => {
    if (!pendingTaskEditId) return;
    const task = tasks.find((item) => item.id === pendingTaskEditId);
    if (!task) {
      useLifeStore.setState({ pendingTaskEditId: null });
      return;
    }
    handleEdit(task);
    useLifeStore.setState({ pendingTaskEditId: null });
  }, [pendingTaskEditId, tasks]);

  function handleDelete(id: string) {
    showAlert('Eliminar tarea', '¿Eliminar esta tarea? No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteTask(id) }
    ]);
  }

  async function handleConfirmCompletionOK(taskId: string): Promise<void> {
    setIsSubmittingCompletion(true);
    try {
      await confirmCompletionOK(taskId);
      markRecentlyCompleted(taskId);
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
      showAlert('Campo requerido', 'El título no puede estar vacío.');
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      emoji: form.emoji.trim() || undefined,
      color: form.color.trim() || undefined,
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
  const totalCount = tasks.length;

  const priorityColors = useMemo(() => getPriorityColors(lifeTheme), [lifeTheme]);
  const urgencyOptions = useMemo(() => getUrgencyOptions(lifeTheme), [lifeTheme]);

  const p = form.priority;
  const prioColor = priorityColors[p];
  const loadColor = getLoadColor(form.cognitive_load, lifeTheme);

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
        <View style={styles.hdrLeft}>
          <Text style={styles.title}>📋 Task Pool</Text>
          <Text style={styles.subtitle}>Captura, organiza y prioriza tus tareas antes de programarlas.</Text>
          <Pressable style={styles.formToggleBtn} onPress={toggleTaskForm}>
            <Text style={styles.formToggleText}>{isFormCollapsed ? '+ Nueva tarea' : '− Minimizar form'}</Text>
          </Pressable>
        </View>
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

      <View style={styles.guideCard}>
        <Text style={styles.guideTitle}>Cómo aprovechar el Pool</Text>
        <Text style={styles.guideItem}>• Vuelca todo lo pendiente sin fricción.</Text>
        <Text style={styles.guideItem}>• Ajusta urgencia, prioridad y duración para ordenar.</Text>
        <Text style={styles.guideItem}>• Completa desde la lista para registrar tu avance.</Text>
        <Text style={styles.guideMeta}>Tienes {totalCount} tarea{totalCount !== 1 ? 's' : ''} registradas.</Text>
      </View>

      {/* Form */}
      {isFormCollapsed ? (
        <Pressable style={styles.formCollapsedCard} onPress={toggleTaskForm}>
          <Text style={styles.formCollapsedTitle}>+ Crear tarea nueva</Text>
          <Text style={styles.formCollapsedSubtitle}>Abre el formulario cuando necesites capturar una tarea.</Text>
        </Pressable>
      ) : (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{editingId ? '✏️ Editar tarea' : '+ Nueva tarea'}</Text>
        <Text style={styles.formHint}>Usa este formulario para definir contexto, tiempo y prioridad.</Text>

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

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Emoji</Text>
            <TextInput
              style={styles.input}
              value={form.emoji}
              onChangeText={(v) => setForm((f) => ({ ...f, emoji: v.slice(0, 2) }))}
              placeholder="✨"
              placeholderTextColor={lifeTheme.colors.muted}
              maxLength={2}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Color</Text>
            <TextInput
              style={styles.input}
              value={form.color}
              onChangeText={(v) => setForm((f) => ({ ...f, color: v }))}
              placeholder="#8FBF00"
              placeholderTextColor={lifeTheme.colors.muted}
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Urgency */}
        <View>
          <Text style={styles.fieldLabel}>¿Cuándo debe hacerse? *</Text>
          <View style={styles.urgencyRow}>
            {urgencyOptions.map((opt) => (
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
          <Text style={styles.fieldHint}>La urgencia define en qué vistas aparece y cómo se prioriza.</Text>
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
        <Text style={styles.fieldHint}>Si hay horario fijo, usa inicio y fin para respetar tu agenda.</Text>

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
      )}

      {/* Filters */}
      <View style={styles.filterDropdownRow}>
        <Text style={styles.fieldLabel}>Filtro activo</Text>
        <Pressable style={styles.filterDropdownBtn} onPress={() => setIsFilterMenuVisible(true)}>
          <Text style={styles.filterDropdownText}>{FILTER_OPTIONS.find((opt) => opt.key === filter)?.label ?? 'Todas'}</Text>
          <Text style={styles.filterDropdownIcon}>▼</Text>
        </Pressable>
        <Text style={styles.filterHint}>Tip: usa "Pendientes hoy" para enfocarte en lo urgente.</Text>
      </View>

      <Modal visible={isFilterMenuVisible} transparent animationType="fade" onRequestClose={() => setIsFilterMenuVisible(false)}>
        <Pressable style={styles.filterModalOverlay} onPress={() => setIsFilterMenuVisible(false)}>
          <Pressable style={styles.filterModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.filterModalTitle}>Seleccionar filtro</Text>
            <View style={styles.filterModalList}>
              {FILTER_OPTIONS.map((option) => {
                const active = option.key === filter;
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.filterModalItem, active && styles.filterModalItemActive]}
                    onPress={() => {
                      setFilter(option.key);
                      setIsFilterMenuVisible(false);
                    }}
                  >
                    <Text style={[styles.filterModalItemText, active && styles.filterModalItemTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
              entering={FadeInDown.duration(120).delay(idx * 20)}
              exiting={FadeOutUp.duration(160)}
              layout={Layout.springify().damping(32).stiffness(120).mass(0.9)}
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
        reason={lastReplanReason}
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

      <CustomAlertDialog
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onDismiss={hideAlert}
      />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  content: { paddingHorizontal: 16, gap: 14, paddingBottom: 32 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hdrLeft: { gap: 8 },
  title: { color: lifeTheme.colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: lifeTheme.colors.muted, fontSize: 12, lineHeight: 18, maxWidth: 260 },
  formToggleBtn: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    backgroundColor: lifeTheme.colors.surface
  },
  formToggleText: { color: lifeTheme.colors.text, fontSize: 12, fontWeight: '700' },
  badges: { flexDirection: 'row', gap: 6 },
  badge: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 5, alignItems: 'center',
    borderWidth: 1, borderColor: lifeTheme.colors.border
  },
  badgeNum: { fontSize: 14, fontWeight: '800' },
  badgeLbl: { color: lifeTheme.colors.muted, fontSize: 8, fontWeight: '600' },
  guideCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: 14,
    gap: 6
  },
  guideTitle: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '800' },
  guideItem: { color: lifeTheme.colors.muted, fontSize: 12, lineHeight: 18 },
  guideMeta: { color: lifeTheme.colors.text, fontSize: 12, fontWeight: '700', marginTop: 4 },
  card: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: lifeTheme.colors.border, padding: 16, gap: 16
  },
  cardTitle: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '800' },
  formHint: { color: lifeTheme.colors.muted, fontSize: 12, lineHeight: 18 },
  formCollapsedCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: 14,
    gap: 4
  },
  formCollapsedTitle: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '800' },
  formCollapsedSubtitle: { color: lifeTheme.colors.muted, fontSize: 12 },
  input: {
    backgroundColor: lifeTheme.colors.surfaceAlt, borderColor: lifeTheme.colors.border,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: lifeTheme.colors.text, fontSize: 15
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  fieldLabel: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldHint: { color: lifeTheme.colors.muted, fontSize: 11, lineHeight: 16, marginTop: 6 },
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
  primaryBtnText: { color: lifeTheme.colors.onPrimary, fontSize: 14, fontWeight: '800' },
  cancelBtn: {
    paddingHorizontal: 16, borderRadius: 12, borderWidth: 1,
    borderColor: lifeTheme.colors.border, justifyContent: 'center'
  },
  cancelBtnText: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '700' },
  filterDropdownRow: { gap: 6 },
  filterDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    backgroundColor: lifeTheme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  filterDropdownText: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '700' },
  filterDropdownIcon: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700' },
  filterHint: { color: lifeTheme.colors.muted, fontSize: 11, lineHeight: 16 },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  filterModalCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: 14,
    gap: 10
  },
  filterModalTitle: { color: lifeTheme.colors.text, fontSize: 15, fontWeight: '800' },
  filterModalList: { gap: 8 },
  filterModalItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  filterModalItemActive: {
    borderColor: lifeTheme.colors.primary,
    backgroundColor: lifeTheme.colors.softPrimary
  },
  filterModalItemText: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '700' },
  filterModalItemTextActive: { color: lifeTheme.colors.primary },
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
}
