import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import {
  Platform,
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
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { ChevronDown, Inbox, Plus } from 'lucide-react-native';
import { SwipeableTaskCard } from '../../src/components/SwipeableTaskCard';
import { TaskCompletionCheckDialog } from '../../src/components/TaskCompletionCheckDialog';
import { ReplanificationPrompt } from '../../src/components/ReplanificationPrompt';
import { CustomAlertDialog } from '../../src/components/CustomAlertDialog';
import { AppColorPickerSheet } from '../../src/components/AppColorPickerSheet';
import { useLifeStore } from '../../src/store/useLifeStore';
import { useAppTheme } from '../../src/theme';
import { useCustomAlert } from '../../src/hooks/useCustomAlert';
import type { PostponeReason, ScheduleBlock, SkipReason, Task, TaskUrgency } from '../../src/types';
import { FormSheet } from '../../src/components/FormSheet';
import { AppEmojiPickerSheet } from '../../src/components/AppEmojiPickerSheet';
import { AppButton, EmptyState, ScreenHeader, SectionHeader, StatusBadge } from '../../src/components/ui';

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

const EMOJI_OPTIONS = [
  '✨', '🔥', '✅', '🧠', '💼', '📚', '🏃', '💪',
  '🛒', '🧹', '🍳', '🧘', '🎯', '📝', '💡', '🚀',
  '📞', '📦', '💻', '🎵', '🏠', '🧪', '📊', '🛠️'
];

// ─── Date/Time Picker (popup nativo) ─────────────────────────────────────────

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
  const uiThemeMode = useLifeStore((s) => s.settings.uiThemeMode ?? 'dark');
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  function handleDateConfirm(selected: Date) {
    const nextDate = value ? new Date(value) : new Date();
    nextDate.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setPendingDate(nextDate);
    setShowDate(false);
    setTimeout(() => setShowTime(true), 0);
  }

  function handleTimeConfirm(selected: Date) {
    const baseDate = pendingDate ?? value ?? new Date();
    const combined = new Date(baseDate);
    combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setPendingDate(null);
    setShowTime(false);
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

      <DateTimePickerModal
        isVisible={showDate}
        mode="date"
        date={value ?? new Date()}
        locale="es-ES"
        is24Hour
        isDarkModeEnabled={uiThemeMode === 'dark'}
        display={Platform.OS === 'android' ? 'calendar' : 'inline'}
        confirmTextIOS="Siguiente"
        cancelTextIOS="Cancelar"
        buttonTextColorIOS={lifeTheme.colors.primary}
        onConfirm={handleDateConfirm}
        onCancel={() => {
          setShowDate(false);
          setPendingDate(null);
        }}
      />
      <DateTimePickerModal
        isVisible={showTime}
        mode="time"
        date={pendingDate ?? value ?? new Date()}
        locale="es-ES"
        is24Hour
        isDarkModeEnabled={uiThemeMode === 'dark'}
        minuteInterval={5}
        display={Platform.OS === 'android' ? 'clock' : 'spinner'}
        confirmTextIOS="Guardar"
        cancelTextIOS="Cancelar"
        buttonTextColorIOS={lifeTheme.colors.primary}
        onConfirm={handleTimeConfirm}
        onCancel={() => {
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
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [isEmojiPickerVisible, setIsEmojiPickerVisible] = useState(false);
  const [isColorPickerVisible, setIsColorPickerVisible] = useState(false);
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

  function openNewTaskModal() {
    resetForm();
    setIsTaskModalVisible(true);
  }

  function markRecentlyCompleted(taskId: string) {
    setRecentlyCompletedTaskIds((prev) => (prev.includes(taskId) ? prev : [taskId, ...prev].slice(0, 20)));
    setTimeout(() => {
      setRecentlyCompletedTaskIds((prev) => prev.filter((id) => id !== taskId));
    }, 3000);
  }

  function handleEdit(task: Task) {
    setIsTaskModalVisible(true);
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
    setIsTaskModalVisible(false);
    resetForm();
  }

  const doneCount  = tasks.filter((t) => t.status === 'completed').length;
  const totalCount = tasks.length;

  const priorityColors = useMemo(() => getPriorityColors(lifeTheme), [lifeTheme]);
  const urgencyOptions = useMemo(() => getUrgencyOptions(lifeTheme), [lifeTheme]);

  const p = form.priority;
  const prioColor = priorityColors[p];
  const loadColor = getLoadColor(form.cognitive_load, lifeTheme);

  return (
    <View style={styles.screen}>
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      <ScreenHeader
        eyebrow="Planificación"
        title="Tareas"
        subtitle="Captura y prioriza lo pendiente."
        action={<AppButton label="Nueva" icon={Plus} compact onPress={openNewTaskModal} />}
      />

      <View style={styles.summaryRow}>
        <StatusBadge label={`${totalCount} registradas`} />
        <StatusBadge label={`${doneCount} completadas`} tone="success" />
      </View>

      {/* Filters */}
      <View style={styles.filterDropdownRow}>
        <Text style={styles.fieldLabel}>Mostrar</Text>
        <Pressable style={styles.filterDropdownBtn} onPress={() => setIsFilterMenuVisible(true)}>
          <Text style={styles.filterDropdownText}>{FILTER_OPTIONS.find((opt) => opt.key === filter)?.label ?? 'Todas'}</Text>
          <ChevronDown size={18} color={lifeTheme.colors.muted} />
        </Pressable>
      </View>

      <FormSheet visible={isFilterMenuVisible} onClose={() => setIsFilterMenuVisible(false)} align="center" animationType="fade">
          <View style={styles.filterModalCard}>
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
          </View>
      </FormSheet>

      {/* List header */}
      <SectionHeader title="Lista" subtitle={`${sorted.length} visibles`} />

      {/* Task list */}
      <View style={styles.list}>
        {sorted.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon={Inbox}
              title="Sin tareas aquí"
              message={filter === 'today' ? 'No tienes tareas pendientes para hoy.' : 'No hay tareas que coincidan con este filtro.'}
              actionLabel="Crear tarea"
              onAction={openNewTaskModal}
            />
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

      <View style={{ height: 24 }} />
    </ScrollView>

      <FormSheet visible={isTaskModalVisible} onClose={() => setIsTaskModalVisible(false)}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{editingId ? 'Editar tarea' : 'Nueva tarea'}</Text>
              <Text style={styles.formHint}>Define el tiempo, la urgencia y las condiciones necesarias.</Text>

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
                  <Pressable
                    style={styles.selectorInput}
                    onPress={() => setIsEmojiPickerVisible(true)}
                  >
                    <Text style={styles.selectorEmojiValue}>{form.emoji || '✨'}</Text>
                    <Text style={styles.selectorHint}>Seleccionar</Text>
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Color</Text>
                  <Pressable
                    style={styles.selectorInput}
                    onPress={() => {
                      setIsColorPickerVisible(true);
                    }}
                  >
                    <View style={styles.colorPreviewRow}>
                      <View
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: form.color || lifeTheme.colors.primary }
                        ]}
                      />
                      <Text style={styles.selectorColorText}>{(form.color || lifeTheme.colors.primary).toUpperCase()}</Text>
                    </View>
                  </Pressable>
                </View>
              </View>

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

              <SafeDatePicker
                label="🕐 Hora de inicio fija (opcional)"
                value={form.fixed_start}
                onClear={() => setForm((f) => ({ ...f, fixed_start: null }))}
                onConfirm={(d) => setForm((f) => ({ ...f, fixed_start: d }))}
              />

              <SafeDatePicker
                label="🕐 Hora de fin fija (opcional)"
                value={form.fixed_end}
                onClear={() => setForm((f) => ({ ...f, fixed_end: null }))}
                onConfirm={(d) => setForm((f) => ({ ...f, fixed_end: d }))}
              />

              <SafeDatePicker
                label="⏰ Fecha límite / Deadline (opcional)"
                value={form.deadline}
                onClear={() => setForm((f) => ({ ...f, deadline: null }))}
                onConfirm={(d) => setForm((f) => ({ ...f, deadline: d }))}
              />
              <Text style={styles.fieldHint}>Si hay horario fijo, usa inicio y fin para respetar tu agenda.</Text>

              <View style={styles.formBtns}>
                <View style={styles.formActionWide}>
                  <AppButton label={editingId ? 'Actualizar tarea' : 'Guardar tarea'} onPress={handleSubmit} fullWidth />
                </View>
                <View style={styles.formAction}>
                  <AppButton
                  label="Cerrar"
                  variant="outlined"
                  onPress={() => {
                    setIsTaskModalVisible(false);
                    if (!editingId) resetForm();
                  }}
                  fullWidth
                  />
                </View>
              </View>
            </View>
      </FormSheet>
      <AppEmojiPickerSheet
        visible={isEmojiPickerVisible}
        value={form.emoji}
        options={EMOJI_OPTIONS}
        onClose={() => setIsEmojiPickerVisible(false)}
        onApply={(emoji) => setForm((current) => ({ ...current, emoji }))}
      />

      <AppColorPickerSheet
        visible={isColorPickerVisible}
        value={form.color || lifeTheme.colors.primary}
        onClose={() => setIsColorPickerVisible(false)}
        onClear={() => setForm((current) => ({ ...current, color: '' }))}
        onApply={(hex) => setForm((current) => ({ ...current, color: hex }))}
      />

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

      <CustomAlertDialog
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onDismiss={hideAlert}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  content: { paddingHorizontal: 16, gap: 16, paddingBottom: 32 },
  summaryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  card: {
    gap: 16
  },
  cardTitle: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '800' },
  formHint: { color: lifeTheme.colors.muted, fontSize: 12, lineHeight: 18 },
  input: {
    backgroundColor: lifeTheme.colors.surfaceAlt, borderColor: lifeTheme.colors.border,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: lifeTheme.colors.text, fontSize: 15
  },
  selectorInput: {
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderColor: lifeTheme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  selectorHint: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '700' },
  selectorEmojiValue: { color: lifeTheme.colors.text, fontSize: 22 },
  colorPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  selectorColorText: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '700' },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  fieldLabel: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0 },
  fieldHint: { color: lifeTheme.colors.muted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  urgencyRow: { flexDirection: 'row', gap: 8 },
  urgencyChip: {
    flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: lifeTheme.radius.md,
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
  formAction: { flex: 1 },
  formActionWide: { flex: 2 },
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
    minHeight: 48,
    paddingVertical: 10
  },
  filterDropdownText: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '700' },
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
  list: { gap: 10 },
  emptyCard: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: lifeTheme.radius.md,
    borderWidth: 1, borderColor: lifeTheme.colors.border,
    alignItems: 'center'
  },
  });
}
