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
import { SwipeableTaskCard } from '../src/components/SwipeableTaskCard';
import { useLifeStore } from '../src/store/useLifeStore';
import { lifeTheme } from '../src/theme';
import type { Task } from '../src/types';

interface FormState {
  title: string;
  description: string;
  eta_minutes: number;
  priority: 1 | 2 | 3 | 4 | 5;
  cognitive_load: number;
  deadline: Date | null;
}

const DEFAULT_FORM: FormState = {
  title: '',
  description: '',
  eta_minutes: 45,
  priority: 3,
  cognitive_load: 5,
  deadline: null
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

export default function PoolScreen(): ReactElement {
  const tasks = useLifeStore((s) => s.tasks);
  const addTask = useLifeStore((s) => s.addTask);
  const updateTask = useLifeStore((s) => s.updateTask);
  const deleteTask = useLifeStore((s) => s.deleteTask);
  const completeTask = useLifeStore((s) => s.completeTask);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pool' | 'completed'>('all');

  const sorted = useMemo(() => {
    const filtered =
      filterStatus === 'all'
        ? tasks
        : tasks.filter((t) => (filterStatus === 'pool' ? t.status !== 'completed' : t.status === 'completed'));
    return [...filtered].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }, [tasks, filterStatus]);

  function resetForm() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setShowDatePicker(false);
  }

  function handleEdit(task: Task) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? '',
      eta_minutes: task.eta_minutes,
      priority: task.priority,
      cognitive_load: task.cognitive_load,
      deadline: task.deadline ?? null
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
      deadline: form.deadline ?? undefined
    };
    if (editingId) {
      updateTask(editingId, payload);
    } else {
      addTask(payload);
    }
    resetForm();
  }

  const priorityColor = PRIORITY_COLORS[form.priority];
  const loadColor = LOAD_COLOR(form.cognitive_load);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.kicker}>Task Pool</Text>
        <Text style={styles.heroTitle}>Captura intención, no horarios.</Text>
        <Text style={styles.heroSub}>
          Las tareas viven aquí como procesos pendientes hasta que el kernel las convierte en timeline.
        </Text>
      </View>

      {/* Form card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{editingId ? 'Editar tarea' : 'Nueva tarea'}</Text>

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
          numberOfLines={3}
        />

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
          <View style={styles.sliderTicks}>
            <Text style={styles.sliderTick}>5m</Text>
            <Text style={styles.sliderTick}>1h</Text>
            <Text style={styles.sliderTick}>2h</Text>
            <Text style={styles.sliderTick}>4h</Text>
          </View>
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
            onValueChange={(v) => setForm((f) => ({ ...f, priority: Math.round(v) as 1 | 2 | 3 | 4 | 5 }))}
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

        {/* Deadline picker */}
        <View>
          <Text style={styles.sliderLabel}>Deadline (opcional)</Text>
          <Pressable
            style={styles.dateButton}
            onPress={() => setShowDatePicker(!showDatePicker)}
          >
            <Text style={[styles.dateButtonText, form.deadline && styles.dateButtonTextActive]}>
              {form.deadline
                ? `📅 ${form.deadline.toLocaleDateString()} ${form.deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : '+ Seleccionar fecha límite'}
            </Text>
            {form.deadline && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setForm((f) => ({ ...f, deadline: null }));
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.clearDate}>✕</Text>
              </Pressable>
            )}
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={form.deadline ?? new Date()}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={new Date()}
              onChange={(_event, date) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (date) setForm((f) => ({ ...f, deadline: date }));
              }}
              themeVariant="dark"
            />
          )}
        </View>

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
      <View style={styles.filterRow}>
        {(['all', 'pool', 'completed'] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterTab, filterStatus === f && styles.filterTabActive]}
            onPress={() => setFilterStatus(f)}
          >
            <Text style={[styles.filterTabText, filterStatus === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'Todas' : f === 'pool' ? 'Pendientes' : 'Completadas'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Header count */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>Tareas</Text>
        <Text style={styles.listHeaderHint}>{sorted.length} registradas</Text>
      </View>

      {/* Task list with animated entries */}
      <View style={styles.list}>
        {sorted.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin tareas aquí</Text>
            <Text style={styles.emptyText}>
              Agrega la primera intención y luego deja que LifeOS la estructure automáticamente.
            </Text>
          </View>
        ) : (
          sorted.map((task, index) => (
            <Animated.View
              key={task.id}
              entering={FadeInDown.delay(index * 40).duration(280)}
              exiting={FadeOutUp.duration(200)}
              layout={Layout.springify().damping(20)}
            >
              <SwipeableTaskCard
                task={task}
                onEdit={handleEdit}
                onDelete={deleteTask}
                onComplete={completeTask}
              />
            </Animated.View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lifeTheme.colors.background
  },
  content: {
    padding: lifeTheme.spacing.lg,
    gap: lifeTheme.spacing.lg,
    paddingBottom: 48
  },
  hero: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.lg,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: lifeTheme.spacing.lg,
    gap: 8
  },
  kicker: {
    color: lifeTheme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  heroTitle: {
    color: lifeTheme.colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800'
  },
  heroSub: {
    color: lifeTheme.colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  card: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: lifeTheme.spacing.lg,
    gap: 18
  },
  cardLabel: {
    color: lifeTheme.colors.text,
    fontSize: 16,
    fontWeight: '800'
  },
  input: {
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderColor: lifeTheme.colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: lifeTheme.colors.text,
    fontSize: 15
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  sliderBlock: {
    gap: 8
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sliderLabel: {
    color: lifeTheme.colors.muted,
    fontSize: 13,
    fontWeight: '600'
  },
  sliderValue: {
    color: lifeTheme.colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  mono: {
    fontFamily: 'monospace'
  },
  slider: {
    width: '100%',
    height: 36
  },
  sliderTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2
  },
  sliderTick: {
    color: lifeTheme.colors.muted,
    fontSize: 10
  },
  dateButton: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderColor: lifeTheme.colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  dateButtonText: {
    color: lifeTheme.colors.muted,
    fontSize: 14
  },
  dateButtonTextActive: {
    color: lifeTheme.colors.text,
    fontWeight: '600'
  },
  clearDate: {
    color: lifeTheme.colors.alert,
    fontSize: 16,
    paddingLeft: 8
  },
  formActions: {
    flexDirection: 'row',
    gap: 10
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: lifeTheme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800'
  },
  cancelBtn: {
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    justifyContent: 'center'
  },
  cancelBtnText: {
    color: lifeTheme.colors.muted,
    fontSize: 13,
    fontWeight: '700'
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: lifeTheme.colors.surface,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  filterTabActive: {
    backgroundColor: lifeTheme.colors.softPrimary,
    borderColor: lifeTheme.colors.primary
  },
  filterTabText: {
    color: lifeTheme.colors.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  filterTabTextActive: {
    color: lifeTheme.colors.primary
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  listHeaderTitle: {
    color: lifeTheme.colors.text,
    fontSize: 18,
    fontWeight: '800'
  },
  listHeaderHint: {
    color: lifeTheme.colors.muted,
    fontSize: 12
  },
  list: {
    gap: 12
  },
  emptyCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: lifeTheme.spacing.lg,
    gap: 8
  },
  emptyTitle: {
    color: lifeTheme.colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  emptyText: {
    color: lifeTheme.colors.muted,
    fontSize: 13,
    lineHeight: 19
  }
});
