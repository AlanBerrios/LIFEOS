import type { ReactElement } from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp, Layout } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { getTodayStr } from '../../src/utils/date';
import { useLifeStore } from '../../src/store/useLifeStore';
import { useAppTheme } from '../../src/theme';
import type { ScheduleBlock, StaticEvent, Task, TaskUrgency } from '../../src/types';
import { createId } from '../../src/utils/ids';
import { 
  UtensilsCrossed, 
  Plus, 
  CalendarPlus, 
  FileText,
  SquareTerminal,
  CalendarClock,
  Zap
} from 'lucide-react-native';
import { TaskCompletionCheckDialog } from '../../src/components/TaskCompletionCheckDialog';
import { CustomAlertDialog, AlertButtonConfig } from '../../src/components/CustomAlertDialog';
import { useCustomAlert } from '../../src/hooks/useCustomAlert';
import { AppDateTimePickerSheet } from '../../src/components/AppDateTimePickerSheet';
import { AppColorPickerSheet } from '../../src/components/AppColorPickerSheet';
import { FormSheet } from '../../src/components/FormSheet';
import { AppEmojiPickerSheet } from '../../src/components/AppEmojiPickerSheet';
import { AppButton, EmptyState, ScreenHeader, SectionHeader } from '../../src/components/ui';

const EMOJI_OPTIONS = [
  '✨', '🔥', '✅', '🧠', '💼', '📚', '🏃', '💪',
  '🛒', '🧹', '🍳', '🧘', '🎯', '📝', '💡', '🚀',
  '📞', '📦', '💻', '🎵', '🏠', '🧪', '📊', '🛠️'
];

function fmt(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFatigueLabel(fatigue: 'low' | 'medium' | 'high'): string {
  if (fatigue === 'high') return 'Muy cansado';
  if (fatigue === 'medium') return 'Cansado';
  return 'Con energía';
}

function getEnergyLevelLabel(level: 1 | 2 | 3 | 4 | 5): string {
  if (level === 1) return 'Muy cansado';
  if (level === 2) return 'Cansado';
  if (level === 3) return 'Normal';
  if (level === 4) return 'Con energía';
  return 'A tope';
}

function blockDurationMin(block: ScheduleBlock): number {
  return Math.max(1, Math.round((block.end_time.getTime() - block.start_time.getTime()) / 60_000));
}

function isFinishedBlock(block: ScheduleBlock, now: Date): boolean {
  return block.end_time.getTime() <= now.getTime();
}

function explainRestSource(block: ScheduleBlock, previousBlock?: ScheduleBlock, nextBlock?: ScheduleBlock): string {
  const parts: string[] = [];
  if (previousBlock && nextBlock) {
    parts.push(`Nace entre "${previousBlock.title}" y "${nextBlock.title}" para mantener continuidad sin solapes.`);
  } else if (previousBlock) {
    parts.push(`Nace después de "${previousBlock.title}" como buffer del timeline.`);
  } else if (nextBlock) {
    parts.push(`Nace antes de "${nextBlock.title}" para evitar huecos incoherentes.`);
  } else {
    parts.push('Se genera automáticamente para mantener un plan temporal coherente.');
  }

  if (block.title.toLowerCase().includes('libre')) {
    parts.push('"Libre" representa tiempo no asignado que quedó disponible entre bloques obligatorios o tareas planificadas.');
  } else if (block.title.toLowerCase().includes('descanso')) {
    parts.push('Este descanso se propone para recuperar energía y sostener foco entre bloques de trabajo.');
  }

  return parts.join(' ');
}

function buildBlockInfoMessage(params: {
  block: ScheduleBlock;
  task: Task | null;
  event: StaticEvent | null;
  previousBlock?: ScheduleBlock;
  nextBlock?: ScheduleBlock;
}): string {
  const { block, task, event, previousBlock, nextBlock } = params;
  const duration = blockDurationMin(block);
  const base = [
    `Tipo: ${block.type}`,
    `Inicio: ${fmt(block.start_time)}`,
    `Fin: ${fmt(block.end_time)}`,
    `Duración: ${duration} min`
  ];

  if (block.isStaticEvent) {
    base.push('Naturaleza: Evento fijo (no editable desde timeline).');
    if (event?.description?.trim()) {
      base.push(`Descripción: ${event.description.trim()}`);
    } else {
      base.push('Descripción: Sin descripción.');
    }
    if (event?.location?.trim()) {
      base.push(`Lugar: ${event.location.trim()}`);
    }
    if (event?.recurrence?.frequency && event.recurrence.frequency !== 'none') {
      base.push(`Repetición: ${event.recurrence.frequency}`);
    }
    return base.join('\n');
  }

  if (block.type === 'task') {
    base.push('Naturaleza: Tarea de ejecución.');
    if (task) {
      base.push(`Prioridad: ${task.priority}/5`);
      base.push(`Carga cognitiva: ${task.cognitive_load}/10`);
      base.push(`Estado: ${task.status}`);
      if (task.description?.trim()) {
        base.push(`Descripción: ${task.description.trim()}`);
      }
    } else {
      base.push('Detalle: Esta tarea no tiene metadata adicional disponible.');
    }
    return base.join('\n');
  }

  if (block.type === 'rest') {
    base.push('Naturaleza: Descanso/buffer automático.');
    base.push(explainRestSource(block, previousBlock, nextBlock));
    return base.join('\n');
  }

  if (block.type === 'meal') {
    base.push('Naturaleza: Bloque de comida/rutina.');
    base.push(block.isRoutineBlock ? 'Origen: Rutina diaria (ajustable solo para hoy).' : 'Origen: Planificación del día.');
    return base.join('\n');
  }

  if (block.type === 'sleep' || block.type === 'transit') {
    base.push(`Naturaleza: ${block.type === 'sleep' ? 'Descanso nocturno' : 'Traslado'}.`);
    base.push(block.isRoutineBlock ? 'Origen: Rutina fija del día.' : 'Origen: Planificación automática.');
    return base.join('\n');
  }

  if (block.type === 'habit') {
    base.push('Naturaleza: Recordatorio de hábito (bloque blando).');
    base.push('No bloquea ni rompe el plan principal; puede solaparse visualmente con otras actividades.');
    return base.join('\n');
  }

  return base.join('\n');
}

// ─── Quick Task Modal ─────────────────────────────────────────────────────────

function QuickTaskModal({
  visible,
  onClose
}: {
  visible: boolean;
  onClose: () => void;
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const addTask = useLifeStore((s) => s.addTask);
  const [title, setTitle] = useState('');
  const [urgency, setUrgency] = useState<TaskUrgency>('today');
  const [emoji, setEmoji] = useState('✨');
  const [color, setColor] = useState('');
  const [eta, setEta] = useState(30);
  const [isEmojiPickerVisible, setIsEmojiPickerVisible] = useState(false);
  const [isColorPickerVisible, setIsColorPickerVisible] = useState(false);

  function handleSave() {
    if (!title.trim()) {
      showAlert('Error', 'El título es obligatorio');
      return;
    }
    addTask({
      title: title.trim(),
      urgency,
      eta_minutes: eta,
      priority: 3,
      cognitive_load: 5,
      emoji: emoji.trim() || undefined,
      color: color.trim() || undefined
    });
    setTitle('');
    setEmoji('✨');
    setColor('');
    onClose();
  }

  return (
    <>
      <FormSheet visible={visible} onClose={onClose} align="center">
            <Text style={styles.modalTitle}>Nueva tarea rápida</Text>
            
            <TextInput
              style={[styles.modalInput, { fontSize: 16, textAlign: 'left' }]}
              value={title}
              onChangeText={setTitle}
              placeholder="¿Qué hay que hacer?"
              placeholderTextColor={lifeTheme.colors.muted}
              autoFocus
            />

            <View style={{ gap: 8 }}>
              <Text style={styles.modalLabel}>Urgencia</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['today', 'this_week', 'someday'] as TaskUrgency[]).map((u) => (
                  <Pressable
                    key={u}
                    style={[
                      styles.urgencyMiniChip,
                      urgency === u && styles.urgencyMiniChipActive
                    ]}
                    onPress={() => setUrgency(u)}
                  >
                    <Text style={[styles.urgencyMiniText, urgency === u && { color: lifeTheme.colors.onPrimary }]}> 
                      {u === 'today' ? 'Hoy' : u === 'this_week' ? 'Semana' : 'Pool'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Emoji</Text>
                <Pressable style={styles.selectorInput} onPress={() => setIsEmojiPickerVisible(true)}>
                  <Text style={styles.selectorEmojiValue}>{emoji || '✨'}</Text>
                  <Text style={styles.selectorHint}>Seleccionar</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Color</Text>
                <Pressable
                  style={styles.selectorInput}
                  onPress={() => setIsColorPickerVisible(true)}
                >
                  <View style={styles.colorPreviewRow}>
                    <View style={[styles.colorSwatch, { backgroundColor: color || lifeTheme.colors.primary }]} />
                    <Text style={styles.selectorColorText}>{(color || lifeTheme.colors.primary).toUpperCase()}</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={styles.modalLabel}>Tiempo: {eta} min</Text>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={5} maximumValue={120} step={5}
                value={eta} onValueChange={setEta}
                minimumTrackTintColor={lifeTheme.colors.primary}
                maximumTrackTintColor={lifeTheme.colors.border}
                thumbTintColor={lifeTheme.colors.primary}
              />
            </View>

            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Guardar</Text>
              </Pressable>
            </View>
      </FormSheet>
      <AppEmojiPickerSheet
        visible={isEmojiPickerVisible}
        value={emoji}
        options={EMOJI_OPTIONS}
        onClose={() => setIsEmojiPickerVisible(false)}
        onApply={setEmoji}
      />

      <AppColorPickerSheet
        visible={isColorPickerVisible}
        value={color || lifeTheme.colors.primary}
        onClose={() => setIsColorPickerVisible(false)}
        onClear={() => setColor('')}
        onApply={(hex) => setColor(hex)}
      />

      <CustomAlertDialog
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onDismiss={hideAlert}
      />
    </>
  );
}

// ─── Quick Event Modal ────────────────────────────────────────────────────────

function QuickEventModal({
  visible,
  onClose
}: {
  visible: boolean;
  onClose: () => void;
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const addEvent = useLifeStore((s) => s.addEvent);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('📌');
  const [color, setColor] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [remindMin, setRemindMin] = useState(10);
  const [isEmojiPickerVisible, setIsEmojiPickerVisible] = useState(false);
  const [isColorPickerVisible, setIsColorPickerVisible] = useState(false);

  function handleSave() {
    if (!title.trim() || !startTime || !endTime) {
      showAlert('Faltan datos', 'Título y horarios son obligatorios.');
      return;
    }
    addEvent({
      title: title.trim(),
      description: description.trim() || undefined,
      emoji: emoji.trim() || undefined,
      color: color.trim() || undefined,
      startTime,
      endTime,
      reminderMinutes: remindMin
    });
    setTitle('');
    setDescription('');
    setEmoji('📌');
    setColor('');
    setStartTime(null);
    setEndTime(null);
    onClose();
  }

  return (
    <>
      <FormSheet visible={visible} onClose={onClose} align="center">
            <Text style={styles.modalTitle}>Rápido: Nuevo Evento</Text>
            
            <TextInput
              style={[styles.modalInput, { fontSize: 16, textAlign: 'left' }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Nombre del evento"
              placeholderTextColor={lifeTheme.colors.muted}
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Emoji</Text>
                <Pressable style={styles.selectorInput} onPress={() => setIsEmojiPickerVisible(true)}>
                  <Text style={styles.selectorEmojiValue}>{emoji || '📌'}</Text>
                  <Text style={styles.selectorHint}>Seleccionar</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Color</Text>
                <Pressable
                  style={styles.selectorInput}
                  onPress={() => setIsColorPickerVisible(true)}
                >
                  <View style={styles.colorPreviewRow}>
                    <View style={[styles.colorSwatch, { backgroundColor: color || lifeTheme.colors.primary }]} />
                    <Text style={styles.selectorColorText}>{(color || lifeTheme.colors.primary).toUpperCase()}</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            <TextInput
              style={[styles.modalInput, { fontSize: 15, textAlign: 'left', minHeight: 72, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descripción del evento (opcional)"
              placeholderTextColor={lifeTheme.colors.muted}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
               <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Recordatorio (min)</Text>
                  <TextInput
                    style={[styles.modalInput, { fontSize: 16, padding: 10 }]}
                    value={String(remindMin)}
                    onChangeText={(v) => setRemindMin(Number(v) || 0)}
                    keyboardType="number-pad"
                  />
               </View>
            </View>

            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cerrar</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Guardar</Text>
              </Pressable>
            </View>
            <Text style={{ color: lifeTheme.colors.muted, fontSize: 10, textAlign: 'center' }}>
              * Usa el Calendario para configurar horas exactas.
            </Text>
      </FormSheet>
      <AppEmojiPickerSheet
        visible={isEmojiPickerVisible}
        value={emoji}
        options={EMOJI_OPTIONS}
        onClose={() => setIsEmojiPickerVisible(false)}
        onApply={setEmoji}
      />

      <AppColorPickerSheet
        visible={isColorPickerVisible}
        value={color || lifeTheme.colors.primary}
        onClose={() => setIsColorPickerVisible(false)}
        onClear={() => setColor('')}
        onApply={(hex) => setColor(hex)}
      />

      <CustomAlertDialog
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onDismiss={hideAlert}
      />
    </>
  );
}

// ─── Quick Note Modal ─────────────────────────────────────────────────────────

function QuickNoteModal({
  visible,
  onClose
}: {
  visible: boolean;
  onClose: () => void;
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const addNote = useLifeStore((s) => s.addNote);
  const [content, setContent] = useState('');

  function handleSave() {
    if (!content.trim()) return;
    addNote({ title: 'Nota rápida', content: content.trim() });
    setContent('');
    onClose();
  }

  return (
    <FormSheet visible={visible} onClose={onClose} align="center">
          <Text style={styles.modalTitle}>Nueva anotación</Text>
          <TextInput
            style={[styles.modalInput, { fontSize: 16, textAlign: 'left', height: 120 }]}
            value={content}
            onChangeText={setContent}
            placeholder="Escribe algo rápido..."
            placeholderTextColor={lifeTheme.colors.muted}
            multiline
            autoFocus
          />
          <View style={styles.modalBtns}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cerrar</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Guardar Nota</Text>
            </Pressable>
          </View>
    </FormSheet>
  );
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
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
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
    <FormSheet visible={visible} onClose={onClose} animationType="fade" align="center">
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
    </FormSheet>
  );
}

function MealOptionsModal({
  visible,
  onClose
}: {
  visible: boolean;
  onClose: () => void;
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const startMealTimer = useLifeStore((s) => s.startMealTimer);
  const routines = useLifeStore((s) => s.routines);
  
  const today = new Date().getDay();
  const routine = routines.find(r => r.dayOfWeek === today);
  const routineMeal = routine?.meals.find((meal) => {
    const type = meal.type.toLowerCase();
    return type.includes('comida') || type.includes('almuerzo');
  }) ?? routine?.meals[0];

  function handleStart(mins: number) {
    void startMealTimer(mins);
    onClose();
  }

  return (
    <FormSheet visible={visible} onClose={onClose} align="center" animationType="fade">
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Opciones de Comida</Text>
          <Text style={styles.modalLabel}>¿Cuánto tiempo vas a comer?</Text>
          
          <View style={{ gap: 10, marginTop: 10 }}>
            {routineMeal && (
              <AppButton label={`Según tu rutina (${routineMeal.durationMinutes} min)`} onPress={() => handleStart(routineMeal.durationMinutes)} fullWidth />
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[30, 45, 60].map(m => (
                <View key={m} style={{ flex: 1 }}><AppButton label={`${m}m`} variant="outlined" onPress={() => handleStart(m)} fullWidth /></View>
              ))}
            </View>
            <AppButton label="90 minutos" variant="outlined" onPress={() => handleStart(90)} fullWidth />
          </View>

          <AppButton label="Cancelar" variant="text" onPress={onClose} fullWidth />
        </View>
    </FormSheet>
  );
}

// ─── Timeline Block ───────────────────────────────────────────────────────────

function BlockCard({
  block,
  index,
  total,
  previousBlock,
  nextBlock,
  now,
  onEditBreak,
  onRequestMove,
  onTaskCompleted,
  onRequestCompletionCheck,
  showAlert,
  hideAlert
}: {
  block: ReturnType<typeof useLifeStore.getState>['timeline'][0];
  index: number;
  total: number;
  previousBlock?: ReturnType<typeof useLifeStore.getState>['timeline'][0];
  nextBlock?: ReturnType<typeof useLifeStore.getState>['timeline'][0];
  now: Date;
  onEditBreak: (id: string, minutes: number) => void;
  onRequestMove: (blockId: string, direction: 'up' | 'down') => void;
  onTaskCompleted: (title: string, xp: number) => void;
  onRequestCompletionCheck: (taskId: string) => void;
  showAlert: (title: string, message?: string, buttons?: AlertButtonConfig[]) => void;
  hideAlert: () => void;
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const skipTask = useLifeStore((s) => s.skipTask);
  const postponeTask = useLifeStore((s) => s.postponeTask);
  const deleteBlock = useLifeStore((s) => s.deleteBlock);
  const convertCompletedGhostToFree = useLifeStore((s) => s.convertCompletedGhostToFree);
  const logHabit = useLifeStore((s) => s.logHabit);
  const tasks = useLifeStore((s) => s.tasks);
  const habits = useLifeStore((s) => s.habits);
  const events = useLifeStore((s) => s.events);
  const task = block.task_id ? tasks.find((t) => t.id === block.task_id) ?? null : null;
  const habit = block.habit_id ? habits.find((h) => h.id === block.habit_id) ?? null : null;
  const relatedEvent = block.isStaticEvent ? events.find((event) => event.id === block.id) ?? null : null;
  const isInProgress = task?.status === 'in_progress';
  const isGhost = Boolean(block.isCompletedGhost);
  const accentColor = task?.color?.trim() || habit?.color?.trim() || (isGhost ? lifeTheme.colors.success : lifeTheme.colors.primary);
  const taskEmoji = task?.emoji?.trim() || '🔷';
  const durationMin = Math.round((block.end_time.getTime() - block.start_time.getTime()) / 60_000);
  const isRest = block.type === 'rest' || block.type === 'meal' || block.type === 'sleep' || block.type === 'transit';
  const isHabit = block.type === 'habit';
  const isMeal = block.type === 'meal';
  const isSleep = block.type === 'sleep';
  const isTransit = block.type === 'transit';
  const isRoutineBlock = Boolean(block.isRoutineBlock);
  const isStaticEvent = Boolean(block.isStaticEvent);
  const isGeneratedFreeBlock = block.type === 'rest' && block.title === 'Libre' && !isRoutineBlock;
  const isMovableTask = !isRest && !isHabit && !isStaticEvent && !isRoutineBlock && !isGhost;
  const isHabitDoneToday = Boolean(habit?.lastCompletedDate === getTodayStr());
  const isFinished = isFinishedBlock(block, now) && !isGhost && !isInProgress;
  const dragOffsetY = useSharedValue(0);

  let emoji = '☕';
  if (isGhost) emoji = '✅';
  else if (isMeal) emoji = '🍜';
  else if (isSleep) emoji = '🌙';
  else if (isTransit) emoji = '🚗';
  else if (isHabit) emoji = '🌱';
  else if (!isRest) emoji = '🔷';

  // Liquid progress calculation
  const startMs = block.start_time.getTime();
  const endMs = block.end_time.getTime();
  const nowMs = now.getTime();
  let progress = 0;
  if (isGhost) {
    progress = 1;
  } else if (nowMs >= startMs && nowMs <= endMs) {
    progress = (nowMs - startMs) / (endMs - startMs);
  } else if (nowMs > endMs) {
    progress = 1;
  }

  const showProgress = progress > 0 && progress < 1;
  const fillColor = isGhost ? `${lifeTheme.colors.success}22` : isRest ? `${lifeTheme.colors.text}0D` : lifeTheme.colors.softPrimary;

  const dragGesture = Gesture.Pan()
    .enabled(isMovableTask)
    .activeOffsetX([-18, 18])
    .onUpdate((event) => {
      dragOffsetY.value = event.translationY;
    })
    .onEnd((event) => {
      dragOffsetY.value = withSpring(0, { damping: 16, stiffness: 180 });
      if (Math.abs(event.translationY) < 36) return;

      const direction: 'up' | 'down' = event.translationY < 0 ? 'up' : 'down';
      runOnJS(onRequestMove)(block.id, direction);
    })
    .onFinalize(() => {
      dragOffsetY.value = withSpring(0, { damping: 16, stiffness: 180 });
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragOffsetY.value }]
  }));

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View
        entering={FadeInDown.duration(280)}
        layout={Layout.springify().damping(14)}
        style={[
          styles.block,
          dragStyle,
          isRest ? styles.blockRest : styles.blockTask,
          isMeal && styles.blockMeal,
          isSleep && styles.blockSleep,
          isFinished && styles.blockFinished,
          isGhost && styles.blockGhost,
          isInProgress && styles.blockInProgress,
          { borderLeftColor: accentColor }
        ]}
      >
      {/* Liquid Fill Overlay */}
      {showProgress && (
        <View 
          style={[
            styles.liquidFill, 
            { width: `${progress * 100}%`, backgroundColor: fillColor }
          ]} 
        />
      )}
      
      <View style={styles.blockTimeCol}>
        <Text style={styles.blockTimeText}>{fmt(block.start_time)}</Text>
        <View style={[styles.blockLine, isRest ? styles.lineRest : styles.lineTask]} />
        <Text style={styles.blockTimeText}>{fmt(block.end_time)}</Text>
      </View>

      <View style={styles.blockBody}>
        <Text style={[
          isRest ? styles.blockTitleRest : styles.blockTitleTask,
          isMeal && { color: '#fb923c' },
          isSleep && { color: '#818cf8', fontWeight: '900' },
          isHabit && { color: accentColor },
          !isRest && { color: accentColor }
        ]} numberOfLines={2}>
          {task ? taskEmoji : emoji} {block.title}
        </Text>
        <View style={styles.blockMetaRow}>
          <Text style={styles.blockDuration}>{durationMin} min</Text>
          {isHabit && (
            <View style={styles.ghostBadge}>
              <Text style={styles.ghostBadgeText}>{isHabitDoneToday ? 'HÁBITO ✓' : 'HÁBITO'}</Text>
            </View>
          )}
          {isGhost && (
            <View style={styles.ghostBadge}>
              <Text style={styles.ghostBadgeText}>FANTASMA</Text>
            </View>
          )}
          {isFinished && (
            <View style={styles.finishedBadge}>
              <Text style={styles.finishedBadgeText}>TERMINADO</Text>
            </View>
          )}
          {isInProgress && (
            <View style={styles.inProgressBadge}>
              <Text style={styles.inProgressText}>EN CURSO</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.blockCtrl}>
        <Pressable
          style={styles.ctrlBtn}
          onPress={() => {
            const infoMessage = buildBlockInfoMessage({
              block,
              task,
              event: relatedEvent,
              previousBlock,
              nextBlock
            });
            showAlert(`Información del bloque`, infoMessage, [{ text: 'Cerrar', style: 'cancel' }]);
          }}
        >
          <Text style={styles.ctrlIcon}>[i]</Text>
        </Pressable>
        {isMovableTask && (
          <>
            {block.task_id && (
              <Pressable
                style={[styles.ctrlBtn, styles.ctrlBtnDone, isInProgress && styles.ctrlBtnInProgress]}
                onPress={() => onRequestCompletionCheck(block.task_id!)}
                onLongPress={() => {
                  showAlert('Gestión de Tarea', `Opciones para "${block.title}"`, [
                    { text: 'X Cancelar', style: 'cancel' },
                    {
                      text: isInProgress ? '🔁 Reiniciar' : '▶ Iniciar',
                      onPress: () => {
                        if (!isInProgress) {
                          useLifeStore.getState().startTask(block.task_id!);
                        }
                      }
                    },
                    { text: '⏭️ Saltar', onPress: () => skipTask(block.task_id!) },
                    { text: '⏳ Posponer', onPress: () => postponeTask(block.task_id!) },
                    { text: '🗑 Eliminar bloque', style: 'destructive', onPress: () => deleteBlock(block.id) }
                  ]);
                }}
              >
                <Text style={styles.ctrlIconDone}>{isInProgress ? '⌛' : '✓'}</Text>
              </Pressable>
            )}
          </>
        )}
        {!isRest && isStaticEvent && (
          <View style={[styles.ctrlBtn, styles.ctrlBtnLocked]}>
            <Text style={styles.ctrlIconLocked}>🔒</Text>
          </View>
        )}
        {isGhost && (
          <Pressable
            style={[styles.ctrlBtn, styles.ctrlBtnDone]}
            onPress={() => {
              showAlert(
                'Convertir en libre',
                'Este hueco quedara disponible para descansar o reemplazarlo por otra tarea.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Convertir', onPress: () => convertCompletedGhostToFree(block.id) }
                ]
              );
            }}
          >
            <Text style={styles.ctrlIconDone}>L</Text>
          </Pressable>
        )}
        {isHabit && habit && !isHabitDoneToday && (
          <Pressable
            style={[styles.ctrlBtn, styles.ctrlBtnDone]}
            onPress={() => {
              logHabit(habit.id, 1);
              onTaskCompleted('Hábito completado', 15);
            }}
          >
            <Text style={styles.ctrlIconDone}>✓</Text>
          </Pressable>
        )}
        {isRest && !isGeneratedFreeBlock && (
          <Pressable
            style={styles.editBreakBtn}
            onPress={() => onEditBreak(block.id, durationMin)}
            onLongPress={() => {
              showAlert(
                isRoutineBlock ? 'Ajuste de rutina (solo hoy)' : 'Eliminar descanso',
                isRoutineBlock
                  ? 'Este cambio aplica solo al día de hoy y no modifica tu rutina semanal.'
                  : '¿Eliminar este bloque de descanso?',
                [
                { text: 'Cancelar', style: 'cancel' },
                { text: isRoutineBlock ? 'Ocultar hoy 🗑' : 'Eliminar 🗑', style: 'destructive', onPress: () => useLifeStore.getState().deleteBlock(block.id) }
              ]
              );
            }}
          >
            <Text style={styles.editBreakIcon}>✏️</Text>
          </Pressable>
        )}
        {isGeneratedFreeBlock && (
          <View style={[styles.ctrlBtn, styles.ctrlBtnLocked]}>
            <Text style={styles.ctrlIconLocked}>L</Text>
          </View>
        )}
      </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen(): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const timeline = useLifeStore((s) => s.timeline);
  const completedGhostBlocks = useLifeStore((s) => s.completedGhostBlocks);
  const tasks = useLifeStore((s) => s.tasks);
  const habits = useLifeStore((s) => s.habits);
  const logHabit = useLifeStore((s) => s.logHabit);
  const unlogHabit = useLifeStore((s) => s.unlogHabit);
  const generateTimeline = useLifeStore((s) => s.generateTimeline);
  const isGenerating = useLifeStore((s) => s.isGenerating);
  const lastEngine = useLifeStore((s) => s.lastEngine);
  const lastSolverStatus = useLifeStore((s) => s.lastSolverStatus);
  const startMealTimer = useLifeStore((s) => s.startMealTimer);
  const stopTimer = useLifeStore((s) => s.stopTimer);
  const activeTimer = useLifeStore((s) => s.activeTimer);
  const userProfile = useLifeStore((s) => s.userProfile);
  const confirmCompletionOK = useLifeStore((s) => s.confirmCompletionOK);
  const confirmCompletionPartial = useLifeStore((s) => s.confirmCompletionPartial);
  const reportTaskSkipped = useLifeStore((s) => s.reportTaskSkipped);
  const reportTaskPostponed = useLifeStore((s) => s.reportTaskPostponed);
  const dailyEnergyReports = useLifeStore((s) => s.daily_energy_reports);
  const energySuggestedTaskIds = useLifeStore((s) => s.energy_suggested_task_ids);
  const reportDailyEnergy = useLifeStore((s) => s.reportDailyEnergy);
  const applyEnergyBasedSuggestions = useLifeStore((s) => s.applyEnergyBasedSuggestions);
  const pendingTransitArrivalPrompt = useLifeStore((s) => s.pending_transit_arrival_prompt);
  const checkTransitArrivalPrompt = useLifeStore((s) => s.checkTransitArrivalPrompt);
  const respondTransitArrivalPrompt = useLifeStore((s) => s.respondTransitArrivalPrompt);
  const dismissTransitArrivalPrompt = useLifeStore((s) => s.dismissTransitArrivalPrompt);

  const [editBreak, setEditBreak] = useState<{ id: string; minutes: number } | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [quickEventVisible, setQuickEventVisible] = useState(false);
  const [quickNoteVisible, setQuickNoteVisible] = useState(false);
  const [mealOptionsVisible, setMealOptionsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [now, setNow] = useState(new Date());
  const [feedback, setFeedback] = useState<{ title: string; subtitle: string } | null>(null);
  const [completionTaskId, setCompletionTaskId] = useState<string | null>(null);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [transitArrivalPickerVisible, setTransitArrivalPickerVisible] = useState(false);
  const [transitActualArrivalTime, setTransitActualArrivalTime] = useState(new Date());
  const [energyExpanded, setEnergyExpanded] = useState(false);

  useEffect(() => {
    // Actualizar cada 5 segundos para animación de progreso fluida en tiempo real
    const itv = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(itv);
  }, []);

  useEffect(() => {
    checkTransitArrivalPrompt(now);
  }, [checkTransitArrivalPrompt, now, timeline]);

  useEffect(() => {
    if (!pendingTransitArrivalPrompt) return;
    setTransitActualArrivalTime(new Date(pendingTransitArrivalPrompt.plannedEnd));
  }, [pendingTransitArrivalPrompt]);

  useEffect(() => {
    if (!activeTimer) return;
    const itv = setInterval(() => {
      const now = Date.now();
      const diff = activeTimer.endsAt.getTime() - now;
      if (diff <= 0) {
        setTimeLeft('00:00');
        clearInterval(itv);
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(itv);
  }, [activeTimer]);

  const poolCount = tasks.filter((t) => t.status === 'pool').length;
  const todayCount = tasks.filter((t) => (t as any).urgency === 'today' && t.status !== 'completed').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const taskBlocks = timeline.filter((b) => b.type === 'task').length;
  const completionTask = completionTaskId ? tasks.find((t) => t.id === completionTaskId) ?? null : null;
  const todayEnergyReport = dailyEnergyReports.find((item) => item.date === getTodayStr());
  const suggestedTasks = useMemo(
    () => energySuggestedTaskIds
      .map((taskId) => tasks.find((task) => task.id === taskId))
      .filter((task): task is NonNullable<typeof task> => Boolean(task)),
    [energySuggestedTaskIds, tasks]
  );

  // Auto-filter completed tasks from timeline, but keep today's ghost blocks visible
  const visibleTimeline = useMemo(() => {
    const todayKey = getTodayStr();
    const activeGhostBlocks = completedGhostBlocks.filter((block) => localDateKey(block.start_time) === todayKey);
    const activeTimeline = timeline.filter((block) => {
      if (block.type === 'habit') {
        return false;
      }
      if (block.task_id) {
        const task = tasks.find((t) => t.id === block.task_id);
        return !task || task.status !== 'completed';
      }
      return true;
    });

    return [...activeTimeline, ...activeGhostBlocks].sort((a, b) => a.start_time.getTime() - b.start_time.getTime());
  }, [completedGhostBlocks, now, tasks, timeline]);

  function showFeedback(title: string, subtitle: string) {
    setFeedback({ title, subtitle });
    setTimeout(() => setFeedback(null), 2200);
  }

  const hour = new Date().getHours();
  const greeting = hour >= 6 && hour < 12 ? 'Buenos días' : hour >= 12 && hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(220)}>
          <ScreenHeader
            eyebrow={greeting}
            title="Hoy"
            subtitle={todayLabel}
            action={(
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver progreso"
                style={styles.levelSummary}
                onPress={() => router.push('/(tabs)/stats' as any)}
              >
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>{userProfile.level}</Text>
                </View>
                <View style={styles.levelCopy}>
                  <Text style={styles.levelLabel}>NIVEL</Text>
                  <View style={styles.xpTrack}>
                    <View
                      style={[
                        styles.xpFill,
                        { width: `${Math.min(100, (userProfile.currentXP / (userProfile.level * 100)) * 100)}%` }
                      ]}
                    />
                  </View>
                </View>
              </Pressable>
            )}
          />
        </Animated.View>

        <View style={styles.todayStats}>
          <Text style={styles.todayStatsText}><Text style={styles.todayStatsValue}>{taskBlocks}</Text> planificadas</Text>
          <View style={styles.statDivider} />
          <Text style={styles.todayStatsText}><Text style={styles.todayStatsValue}>{todayCount}</Text> pendientes</Text>
          <View style={styles.statDivider} />
          <Text style={styles.todayStatsText}><Text style={[styles.todayStatsValue, { color: lifeTheme.colors.success }]}>{completedCount}</Text> listas</Text>
        </View>

        {/* Action Row Removed - Navigation moved to stats chips */}

        {/* Engine badge removed - moved to settings */}

        <Animated.View entering={FadeInDown.delay(120).duration(320)} style={styles.actionsCard}>
          <View style={styles.topActionsRow}>
            <View style={styles.energyCard}>
              <View style={styles.energyHeaderRow}>
                <Pressable
                  style={styles.energyHeaderPressable}
                  onPress={() => setEnergyExpanded((current) => !current)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.energyTitle}>⚡ Energía</Text>
                    {todayEnergyReport ? (
                      <>
                        <Text style={styles.energyMetaLevel} numberOfLines={1}>Nivel {todayEnergyReport.level}</Text>
                        <Text style={styles.energyMetaName} numberOfLines={1}>{getEnergyLevelLabel(todayEnergyReport.level)}</Text>
                      </>
                    ) : (
                      <Text style={styles.energyMeta} numberOfLines={1}>Toca para registrar energía</Text>
                    )}
                  </View>
                  <Text style={styles.energyChevron}>{energyExpanded ? '▴' : '▾'}</Text>
                </Pressable>

                <Pressable
                  style={styles.energyInfoBtn}
                  onPress={() => {
                    showAlert(
                      'Energía y cansancio',
                      'Este control reordena prioridades y carga cognitiva del día según tu estado.\n\n' +
                        'Nivel 1 (Muy cansado): baja exigencia, tareas cortas y de menor carga.\n' +
                        'Nivel 2 (Cansado): prioriza avance ligero y reduce bloques intensos.\n' +
                        'Nivel 3 (Normal): balance estándar entre progreso y carga.\n' +
                        'Nivel 4 (Con energía): prioriza tareas importantes y de foco.\n' +
                        'Nivel 5 (A tope): empuja tareas complejas y bloques profundos.'
                    );
                  }}
                >
                  <Text style={styles.energyInfoText}>i</Text>
                </Pressable>
              </View>

              {energyExpanded ? (
                <>
                  <View style={styles.energyLevelsRow}>
                    {[1, 2, 3, 4, 5].map((level) => {
                      const selected = todayEnergyReport?.level === level;
                      return (
                        <Pressable
                          key={level}
                          style={[styles.energyLevelChip, selected && styles.energyLevelChipActive, isGenerating && styles.disabled]}
                          disabled={isGenerating}
                          onPress={() => {
                            const fatigue = level <= 2 ? 'high' : level === 3 ? 'medium' : 'low';
                            const fatigueLabel = getFatigueLabel(fatigue);
                            const levelLabel = getEnergyLevelLabel(level as 1 | 2 | 3 | 4 | 5);
                            reportDailyEnergy(level as 1 | 2 | 3 | 4 | 5, fatigue);
                            void applyEnergyBasedSuggestions();
                            showFeedback('🔁 Plan ajustado', `Nivel ${level}: ${levelLabel} (${fatigueLabel}) aplicado`);
                          }}
                        >
                          <Text style={[styles.energyLevelText, selected && styles.energyLevelTextActive]} numberOfLines={1}>
                            {level}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {suggestedTasks.length > 0 ? (
                    <View style={styles.energySuggestedWrap}>
                      <Text style={styles.energySuggestedLabel}>Sugeridas ahora:</Text>
                      <Text style={styles.energySuggestedText} numberOfLines={2}>
                        {suggestedTasks.map((task) => task.title).join(' · ')}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>

            <View style={styles.organizeAction}>
              <AppButton
                label="Organizar día"
                icon={Zap}
                loading={isGenerating}
                onPress={() => void generateTimeline(new Date())}
              />
            </View>
          </View>

          <View style={styles.secondaryActionsRow}>
            {activeTimer ? (
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, styles.flex1, pressed && styles.pressed]}
                onPress={() => void stopTimer()}
              >
                <View style={styles.actionBtnInner}>
                  <Text style={styles.timerDigitsSmall}>{timeLeft}</Text>
                  <Text style={styles.actionBtnLabel}>Terminar</Text>
                </View>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, styles.flex1, pressed && styles.pressed]}
                onPress={() => setMealOptionsVisible(true)}
              >
                <View style={styles.actionBtnInner}>
                  <UtensilsCrossed size={18} color={lifeTheme.colors.text} />
                  <Text style={styles.actionBtnLabel}>Comida</Text>
                </View>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, styles.flex1, pressed && styles.pressed]}
              onPress={() => setQuickAddVisible(true)}
            >
              <View style={styles.actionBtnInner}>
                <Plus size={20} color={lifeTheme.colors.text} />
                <Text style={styles.actionBtnLabel}>Tarea</Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, styles.flex1, pressed && styles.pressed]}
              onPress={() => setQuickEventVisible(true)}
            >
              <View style={styles.actionBtnInner}>
                <CalendarPlus size={18} color={lifeTheme.colors.text} />
                <Text style={styles.actionBtnLabel}>Evento</Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, styles.flex1, pressed && styles.pressed]}
              onPress={() => setQuickNoteVisible(true)}
            >
              <View style={styles.actionBtnInner}>
                <FileText size={18} color={lifeTheme.colors.text} />
                <Text style={styles.actionBtnLabel}>Nota</Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>

        {/* --- HABIT QUICK ACTIONS --- */}
        <Animated.View entering={FadeInDown.delay(220).duration(280)} style={styles.habitsRow}>
          <SectionHeader title="Hábitos de hoy" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.habitsList}>
            {habits.map((habit) => {
              const todayStr = getTodayStr();
              const isDone = habit.lastCompletedDate === todayStr;
              const goal = Math.max(1, habit.goalValue || 1);
              const todayProgress = habit.logs.reduce((sum, log) => {
                const logDate = new Date(log.timestamp).toISOString().slice(0, 10);
                return logDate === todayStr ? sum + log.value : sum;
              }, 0);
              const remainingToComplete = Math.max(0, goal - todayProgress);

              return (
                <Pressable
                  key={habit.id}
                  style={[styles.habitBubble, isDone && styles.habitBubbleDone]}
                  onPress={() => {
                    if (isDone) {
                      unlogHabit(habit.id);
                      showFeedback('↩️ Hábito desmarcado', '-15 EXP en Vitalidad');
                      return;
                    }

                    if (remainingToComplete <= 0) return;
                    logHabit(habit.id, remainingToComplete);
                    showFeedback('✨ Hábito completado', '+15 EXP en Vitalidad');
                  }}
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
        </Animated.View>

        <QuickTaskModal visible={quickAddVisible} onClose={() => setQuickAddVisible(false)} />
        <QuickEventModal visible={quickEventVisible} onClose={() => setQuickEventVisible(false)} />
        <QuickNoteModal visible={quickNoteVisible} onClose={() => setQuickNoteVisible(false)} />
        <MealOptionsModal visible={mealOptionsVisible} onClose={() => setMealOptionsVisible(false)} />



        {/* Timeline */}
        {visibleTimeline.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(220).duration(320)} style={styles.section}>
            <SectionHeader title="Timeline" subtitle={todayLabel} />
            <View style={styles.blockList}>
              {visibleTimeline.map((block, idx) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  index={idx}
                  total={visibleTimeline.length}
                  previousBlock={idx > 0 ? visibleTimeline[idx - 1] : undefined}
                  nextBlock={idx < visibleTimeline.length - 1 ? visibleTimeline[idx + 1] : undefined}
                  now={now}
                  onEditBreak={(id, mins) => setEditBreak({ id, minutes: mins })}
                  onRequestMove={(blockId, direction) => {
                    const result = useLifeStore.getState().moveBlock(blockId, direction);
                    if (result.moved) return;

                    const suggestions = (result.suggestions ?? []).slice(0, 3);
                    const suggestionButtons: AlertButtonConfig[] = suggestions.map((suggestion) => ({
                      text: `Mover a ${fmt(suggestion.startTime)}`,
                      onPress: () => {
                        const apply = useLifeStore.getState().moveBlockToIndex(blockId, suggestion.targetIndex);
                        if (!apply.moved) {
                          showAlert('No se pudo aplicar', 'Ese espacio ya no está disponible. Intenta arrastrar de nuevo.');
                        }
                      }
                    }));

                    const reasonMessage =
                      result.reason === 'blocked_by_fixed'
                        ? 'Ese lugar está bloqueado por un evento o bloque fijo.'
                        : result.reason === 'out_of_bounds'
                          ? 'No hay espacio en esa dirección.'
                          : 'No se puede mover esta tarea desde su posición actual.';

                    showAlert(
                      'No puedes moverla ahí',
                      suggestions.length > 0
                        ? `${reasonMessage}\nOpciones tentativas: ${suggestions.map((s) => fmt(s.startTime)).join(', ')}`
                        : `${reasonMessage}\nNo hay horarios tentativos disponibles ahora.`,
                      [{ text: 'Cancelar', style: 'cancel' }, ...suggestionButtons]
                    );
                  }}
                  onTaskCompleted={(title, xp) => {
                    if (xp > 0) {
                      showFeedback('🏆 Tarea completada', `${title} · +${xp} EXP en Enfoque`);
                    }
                  }}
                  onRequestCompletionCheck={(taskId) => setCompletionTaskId(taskId)}
                  showAlert={showAlert}
                  hideAlert={hideAlert}
                />
              ))}
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(180).duration(220)} style={styles.emptyCard}>
            <EmptyState
              icon={CalendarClock}
              title="Tu día aún no está organizado"
              message={`${poolCount} tarea${poolCount !== 1 ? 's' : ''} disponible${poolCount !== 1 ? 's' : ''} para planificar.`}
              actionLabel="Organizar día"
              onAction={() => void generateTimeline(new Date())}
            />
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

      {feedback ? (
        <Animated.View
          entering={FadeInDown.duration(180)}
          exiting={FadeOutUp.duration(180)}
          style={styles.feedbackToast}
        >
          <Text style={styles.feedbackTitle}>{feedback.title}</Text>
          <Text style={styles.feedbackSubtitle}>{feedback.subtitle}</Text>
        </Animated.View>
      ) : null}

      <FormSheet
        visible={Boolean(pendingTransitArrivalPrompt?.visible)}
        onClose={dismissTransitArrivalPrompt}
        align="center"
        animationType="fade"
      >
          <View style={styles.transitPromptCard}>
            <Text style={styles.transitPromptTitle}>Llegada de tránsito</Text>
            <Text style={styles.transitPromptText}>
              ¿Llegaste a tiempo en "{pendingTransitArrivalPrompt?.transitLabel}"?
            </Text>
            <Text style={styles.transitPromptMeta}>
              Llegada objetivo: {pendingTransitArrivalPrompt ? fmt(pendingTransitArrivalPrompt.plannedEnd) : '--:--'}
            </Text>

            <View style={styles.transitPromptActions}>
              <View style={styles.transitAction}>
              <AppButton
                label="Llegué a tiempo"
                onPress={() => {
                  respondTransitArrivalPrompt(true, pendingTransitArrivalPrompt?.plannedEnd);
                  showFeedback('✅ Llegada registrada', 'Se marcó como llegada a tiempo');
                }}
                fullWidth
              />
              </View>

              <View style={styles.transitAction}>
              <AppButton
                label="Llegué tarde"
                variant="outlined"
                onPress={() => setTransitArrivalPickerVisible(true)}
                fullWidth
              />
              </View>
            </View>

            <AppButton label="Ahora no" variant="text" onPress={dismissTransitArrivalPrompt} fullWidth />
          </View>
      </FormSheet>

      <AppDateTimePickerSheet
        visible={transitArrivalPickerVisible}
        mode="time"
        value={transitActualArrivalTime}
        title="Hora real de llegada"
        subtitle="Guardaremos este dato para ajustar mejor la duración del traslado."
        confirmLabel="Guardar llegada"
        onConfirm={(selected) => {
          setTransitActualArrivalTime(selected);
          respondTransitArrivalPrompt(false, selected);
          setTransitArrivalPickerVisible(false);
          showFeedback('🕒 Llegada real guardada', 'Ajustaremos próximas sugerencias de salida');
        }}
        onClose={() => setTransitArrivalPickerVisible(false)}
      />

      <TaskCompletionCheckDialog
        visible={Boolean(completionTask)}
        task={completionTask}
        isSubmitting={isSubmittingCompletion}
        onClose={() => {
          if (!isSubmittingCompletion) setCompletionTaskId(null);
        }}
        onConfirmOK={async (taskId) => {
          setIsSubmittingCompletion(true);
          await confirmCompletionOK(taskId);
          const task = tasks.find((t) => t.id === taskId);
          const gainedXp = task ? (task.priority * 10) + (task.cognitive_load * 2) : 0;
          showFeedback('🏆 Tarea completada', `${task?.title ?? 'Tarea'} · +${gainedXp} EXP en Enfoque`);
          setIsSubmittingCompletion(false);
          setCompletionTaskId(null);
        }}
        onConfirmPartial={async (taskId, notes) => {
          setIsSubmittingCompletion(true);
          await confirmCompletionPartial(taskId, notes);
          showFeedback('🧩 Avance parcial guardado', 'Se registró tu progreso para replanificar mejor');
          setIsSubmittingCompletion(false);
          setCompletionTaskId(null);
        }}
        onReportSkipped={async (taskId, reason, details) => {
          setIsSubmittingCompletion(true);
          await reportTaskSkipped(taskId, reason, details);
          showFeedback('⏭️ Tarea saltada', 'Se replanificó tu timeline automáticamente');
          setIsSubmittingCompletion(false);
          setCompletionTaskId(null);
        }}
        onReportPostponed={async (taskId, reason, details, postponedUntil) => {
          setIsSubmittingCompletion(true);
          await reportTaskPostponed(taskId, reason, details, postponedUntil);
          showFeedback('⏳ Tarea pospuesta', `Reintento programado para ${postponedUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
          setIsSubmittingCompletion(false);
          setCompletionTaskId(null);
        }}
      />
      <CustomAlertDialog
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onDismiss={hideAlert}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  content: { paddingHorizontal: 16, gap: 16, paddingBottom: 32 },
  levelSummary: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: lifeTheme.radius.md,
    backgroundColor: lifeTheme.colors.surfaceAlt
  },
  levelCopy: { width: 48, gap: 4 },
  levelLabel: { color: lifeTheme.colors.muted, fontSize: 9, fontWeight: '800' },
  todayStats: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  todayStatsText: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '600' },
  todayStatsValue: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '900' },
  statDivider: { width: 1, height: 18, backgroundColor: lifeTheme.colors.border },
  actionsCard: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: lifeTheme.radius.md,
    borderWidth: 1, borderColor: lifeTheme.colors.border, padding: 12, gap: 10
  },
  topActionsRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  energyCard: {
    flex: 1,
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderRadius: lifeTheme.radius.sm,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 7,
    minHeight: 56,
    gap: 6
  },
  organizeAction: { minWidth: 132 },
  energyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8
  },
  energyHeaderPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  energyChevron: {
    color: lifeTheme.colors.muted,
    fontSize: 14,
    fontWeight: '900'
  },
  energyInfoBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    backgroundColor: lifeTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  energyInfoText: {
    color: lifeTheme.colors.primary,
    fontSize: 12,
    fontWeight: '900'
  },
  energyTitle: { color: lifeTheme.colors.text, fontSize: 12, fontWeight: '800' },
  energyMetaLevel: { color: lifeTheme.colors.muted, fontSize: 10, fontWeight: '800' },
  energyMetaName: { color: lifeTheme.colors.text, fontSize: 11, fontWeight: '700' },
  energyMeta: { color: lifeTheme.colors.muted, fontSize: 10, fontWeight: '700' },
  energyLevelsRow: { flexDirection: 'row', gap: 6 },
  energyLevelChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: lifeTheme.colors.surface,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  energyLevelChipActive: {
    borderColor: lifeTheme.colors.primary,
    backgroundColor: `${lifeTheme.colors.primary}20`
  },
  energyLevelText: { color: lifeTheme.colors.text, fontSize: 11, fontWeight: '900' },
  energyLevelTextActive: { color: lifeTheme.colors.primary },
  energySuggestedWrap: { gap: 1 },
  energySuggestedLabel: { color: lifeTheme.colors.muted, fontSize: 9, fontWeight: '700' },
  energySuggestedText: { color: lifeTheme.colors.text, fontSize: 11, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 12,
    paddingVertical: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: lifeTheme.colors.border,
    height: 52
  },
  levelBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lifeTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: lifeTheme.colors.primary
  },
  levelText: { color: lifeTheme.colors.onPrimary, fontSize: 15, fontWeight: '900' },
  xpTrack: {
    height: 4,
    backgroundColor: lifeTheme.colors.border,
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden'
  },
  xpFill: {
    height: '100%',
    backgroundColor: lifeTheme.colors.primary,
    borderRadius: 2
  },
  actionBtnInner: {
    alignItems: 'center',
    gap: 4
  },
  actionBtnLabel: { color: lifeTheme.colors.text, fontSize: 9, fontWeight: '700' },
  timerDigitsSmall: { color: lifeTheme.colors.primary, fontSize: 13, fontWeight: '900', fontFamily: 'monospace' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.975 }] },
  disabled: { opacity: 0.5 },
  section: { gap: 10 },
  blockList: { gap: 6 },
  block: {
    flexDirection: 'row', borderRadius: lifeTheme.radius.md, borderWidth: 1,
    padding: 10, gap: 10, alignItems: 'center'
  },
  blockTask: { 
    borderColor: lifeTheme.colors.outlineStrong
  },
  blockGhost: {
    borderColor: lifeTheme.colors.success,
    backgroundColor: `${lifeTheme.colors.success}10`
  },
  blockFinished: {
    backgroundColor: `${lifeTheme.colors.success}08`,
    borderColor: `${lifeTheme.colors.success}35`,
    opacity: 0.82
  },
  blockInProgress: {
    borderColor: lifeTheme.colors.primary,
    borderWidth: 2,
    backgroundColor: lifeTheme.colors.softPrimary
  },
  blockMeal: { borderColor: lifeTheme.colors.warning },
  blockSleep: { borderColor: lifeTheme.colors.info },
  blockRest: { borderColor: lifeTheme.colors.border, opacity: 0.9 },
  blockBody: { flex: 1, paddingVertical: 4 },
  blockTitleTask: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  blockTitleRest: { color: lifeTheme.colors.muted, fontSize: 15, fontWeight: '500' },
  blockMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockDuration: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '500' },
  inProgressBadge: { 
    backgroundColor: lifeTheme.colors.primary, 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4 
  },
  inProgressText: { color: 'white', fontSize: 10, fontWeight: '900' },
  ghostBadge: {
    backgroundColor: `${lifeTheme.colors.success}18`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: `${lifeTheme.colors.success}55`
  },
  ghostBadgeText: { color: lifeTheme.colors.success, fontSize: 10, fontWeight: '900' },
  finishedBadge: {
    backgroundColor: `${lifeTheme.colors.success}12`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: `${lifeTheme.colors.success}35`
  },
  finishedBadgeText: { color: lifeTheme.colors.success, fontSize: 10, fontWeight: '900' },
  blockCtrl: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  ctrlBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: `${lifeTheme.colors.text}10`, alignItems: 'center', justifyContent: 'center' },
  ctrlBtnDone: { backgroundColor: `${lifeTheme.colors.success}15` },
  ctrlBtnInProgress: { backgroundColor: `${lifeTheme.colors.primary}20` },
  ctrlBtnLocked: { backgroundColor: `${lifeTheme.colors.alert}15` },
  ctrlIcon: { fontSize: 16, color: lifeTheme.colors.text, fontWeight: '700' },
  ctrlIconDone: { fontSize: 16, color: lifeTheme.colors.success, fontWeight: '900' },
  ctrlIconLocked: { fontSize: 14 },
  liquidFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 11,
    zIndex: -1
  },
  blockTimeCol: { width: 50, alignItems: 'center', gap: 3 },
  blockTimeText: { color: lifeTheme.colors.muted, fontSize: 10, fontWeight: '600' },
  blockLine: { width: 2, height: 16, borderRadius: 1 },
  lineTask: { backgroundColor: lifeTheme.colors.primary },
  lineRest: { backgroundColor: lifeTheme.colors.border },
  editBreakBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: lifeTheme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center'
  },
  editBreakIcon: { fontSize: 13 },
  emptyCard: {
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1, borderColor: lifeTheme.colors.border,
    alignItems: 'center'
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
  selectorInput: {
    backgroundColor: lifeTheme.colors.surfaceAlt,
    borderColor: lifeTheme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 50,
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
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 12,
    padding: 13, alignItems: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border
  },
  cancelBtnText: { color: lifeTheme.colors.text, fontWeight: '800' },
  saveBtn: { flex: 1, backgroundColor: lifeTheme.colors.primary, borderRadius: 12, padding: 13, alignItems: 'center' },
  saveBtnText: { color: lifeTheme.colors.onPrimary, fontWeight: '800' },
  // Actions Grid
  secondaryActionsRow: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  urgencyMiniChip: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: lifeTheme.colors.surfaceAlt, alignItems: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border },
  urgencyMiniChipActive: { backgroundColor: lifeTheme.colors.primary, borderColor: lifeTheme.colors.primary },
  urgencyMiniText: { fontSize: 11, fontWeight: '700', color: lifeTheme.colors.muted },
  habitsRow: { gap: 8, marginTop: 2 },
  habitsList: { gap: 10, paddingRight: 16, paddingTop: 4 },
  habitBubble: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: lifeTheme.colors.border,
    paddingHorizontal: 7, paddingVertical: 5, alignItems: 'center', minWidth: 48, gap: 2
  },
  habitEmoji: { fontSize: 15 },
  habitName: { color: lifeTheme.colors.muted, fontSize: 8, fontWeight: '700' },
  habitBubbleDone: { backgroundColor: 'rgba(108,252,184,0.1)', borderColor: lifeTheme.colors.success },
  habitNameDone: { color: lifeTheme.colors.success },
  habitDoneCheck: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: lifeTheme.colors.success, borderRadius: 10,
    width: 18, height: 18, textAlign: 'center', lineHeight: 18,
    color: lifeTheme.colors.onPrimary, fontSize: 10, fontWeight: '900', overflow: 'hidden'
  },
  feedbackToast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: lifeTheme.colors.surface,
    borderWidth: 1,
    borderColor: lifeTheme.colors.success,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6
  },
  feedbackTitle: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '800' },
  feedbackSubtitle: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '600' },
  transitPromptCard: {
    width: '100%',
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: 16,
    gap: 10
  },
  transitPromptTitle: { color: lifeTheme.colors.text, fontSize: 17, fontWeight: '900' },
  transitPromptText: { color: lifeTheme.colors.text, fontSize: 14, lineHeight: 20 },
  transitPromptMeta: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700' },
  transitPromptActions: { flexDirection: 'row', gap: 10 },
  transitAction: { flex: 1 },
  });
}
