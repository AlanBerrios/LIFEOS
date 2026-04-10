import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
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
import Animated, { FadeInDown, FadeOutUp, Layout } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { getTodayStr } from '../../src/utils/date';
import { useLifeStore } from '../../src/store/useLifeStore';
import { lifeTheme } from '../../src/theme';
import type { TaskUrgency } from '../../src/types';
import { createId } from '../../src/utils/ids';
import { 
  UtensilsCrossed, 
  Plus, 
  CalendarPlus, 
  FileText,
  SquareTerminator
} from 'lucide-react-native';
import { TutorialOverlay } from '../../src/components/TutorialOverlay';

function fmt(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Quick Task Modal ─────────────────────────────────────────────────────────

function QuickTaskModal({
  visible,
  onClose
}: {
  visible: boolean;
  onClose: () => void;
}): ReactElement {
  const addTask = useLifeStore((s) => s.addTask);
  const [title, setTitle] = useState('');
  const [urgency, setUrgency] = useState<TaskUrgency>('today');
  const [eta, setEta] = useState(30);

  function handleSave() {
    if (!title.trim()) {
      Alert.alert('Error', 'El título es obligatorio');
      return;
    }
    addTask({
      title: title.trim(),
      urgency,
      eta_minutes: eta,
      priority: 3,
      cognitive_load: 5
    });
    setTitle('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.modalCard}>
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
                  <Text style={[styles.urgencyMiniText, urgency === u && { color: '#fff' }]}>
                    {u === 'today' ? 'Hoy' : u === 'this_week' ? 'Semana' : 'Pool'}
                  </Text>
                </Pressable>
              ))}
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
        </View>
      </Pressable>
    </Modal>
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
  const addEvent = useLifeStore((s) => s.addEvent);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [remindMin, setRemindMin] = useState(10);

  function handleSave() {
    if (!title.trim() || !startTime || !endTime) {
      Alert.alert('Faltan datos', 'Título y horarios son obligatorios.');
      return;
    }
    addEvent({
      title: title.trim(),
      startTime,
      endTime,
      reminderMinutes: remindMin
    });
    setTitle('');
    setStartTime(null);
    setEndTime(null);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.modalCard}>
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
        </View>
      </Pressable>
    </Modal>
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
  const addNote = useLifeStore((s) => s.addNote);
  const [content, setContent] = useState('');

  function handleSave() {
    if (!content.trim()) return;
    addNote({ content: content.trim() });
    setContent('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.modalCard}>
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
        </View>
      </Pressable>
    </Modal>
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

function MealOptionsModal({
  visible,
  onClose
}: {
  visible: boolean;
  onClose: () => void;
}): ReactElement {
  const startMealTimer = useLifeStore((s) => s.startMealTimer);
  const routines = useLifeStore((s) => s.routines);
  
  const today = new Date().getDay();
  const routine = routines.find(r => r.dayOfWeek === today);
  const routineLunch = routine?.meals.find(m => m.type.toLowerCase() === 'almuerzo');

  function handleStart(mins: number) {
    void startMealTimer(mins);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Opciones de Almuerzo</Text>
          <Text style={styles.modalLabel}>¿Cuánto tiempo vas a almorzar?</Text>
          
          <View style={{ gap: 10, marginTop: 10 }}>
            {routineLunch && (
              <Pressable style={styles.saveBtn} onPress={() => handleStart(routineLunch.durationMinutes)}>
                <Text style={styles.saveBtnText}>Según rutina ({routineLunch.durationMinutes} min)</Text>
              </Pressable>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[30, 45, 60].map(m => (
                <Pressable key={m} style={[styles.secondaryBtn, { flex: 1, height: 45 }]} onPress={() => handleStart(m)}>
                  <Text style={styles.secondaryBtnText}>{m}m</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.secondaryBtn, { height: 45 }]} onPress={() => handleStart(90)}>
              <Text style={styles.secondaryBtnText}>90 minutos (Largo)</Text>
            </Pressable>
          </View>

          <Pressable style={[styles.cancelBtn, { marginTop: 10 }]} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </Pressable>
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
  now,
  onEditBreak
}: {
  block: ReturnType<typeof useLifeStore.getState>['timeline'][0];
  index: number;
  total: number;
  now: Date;
  onEditBreak: (id: string, minutes: number) => void;
}): ReactElement {
  const moveBlock = useLifeStore((s) => s.moveBlock);
  const completeTask = useLifeStore((s) => s.completeTask);
  const skipTask = useLifeStore((s) => s.skipTask);
  const postponeTask = useLifeStore((s) => s.postponeTask);
  const tasks = useLifeStore((s) => s.tasks);
  const task = block.task_id ? tasks.find(t => t.id === block.task_id) : null;
  const isInProgress = task?.status === 'in_progress';
  const durationMin = Math.round((block.end_time.getTime() - block.start_time.getTime()) / 60_000);
  const isRest = block.type === 'rest' || block.type === 'meal' || block.type === 'sleep';
  const isMeal = block.type === 'meal';
  const isSleep = block.type === 'sleep';

  let emoji = '☕';
  if (isMeal) emoji = '🍜';
  else if (isSleep) emoji = '🌙';
  else if (!isRest) emoji = '🔷';

  // Liquid progress calculation
  const startMs = block.start_time.getTime();
  const endMs = block.end_time.getTime();
  const nowMs = now.getTime();
  let progress = 0;
  if (nowMs >= startMs && nowMs <= endMs) {
    progress = (nowMs - startMs) / (endMs - startMs);
  } else if (nowMs > endMs) {
    progress = 1;
  }

  const showProgress = progress > 0 && progress < 1;
  const fillColor = isRest ? 'rgba(0,0,0,0.05)' : 'rgba(124,108,252,0.1)';

  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      layout={Layout.springify().damping(14)}
      style={[
        styles.block, 
        isRest ? styles.blockRest : styles.blockTask,
        isMeal && styles.blockMeal,
        isSleep && styles.blockSleep,
        isInProgress && styles.blockInProgress
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
          isSleep && { color: '#818cf8', fontWeight: '900' }
        ]} numberOfLines={2}>
          {emoji} {block.title}
        </Text>
        <View style={styles.blockMetaRow}>
          <Text style={styles.blockDuration}>{durationMin} min</Text>
          {isInProgress && (
            <View style={styles.inProgressBadge}>
              <Text style={styles.inProgressText}>EN CURSO</Text>
            </View>
          )}
        </View>
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
                style={[styles.ctrlBtn, styles.ctrlBtnDone, isInProgress && styles.ctrlBtnInProgress]}
                onPress={() => {
                  Alert.alert('Gestión de Tarea', `¿Qué quieres hacer con "${block.title}"?`, [
                    { text: 'X Cancelar', style: 'cancel' },
                    { text: '⏭️ Saltar', onPress: () => skipTask(block.task_id!) },
                    { text: '⏳ Posponer', onPress: () => postponeTask(block.task_id!) },
                    { text: '✅ Completar', onPress: () => completeTask(block.task_id!) },
                  ]);
                }}
                onLongPress={() => {
                   if (!isInProgress) {
                     useLifeStore.getState().startTask(block.task_id!);
                   }
                }}
              >
                <Text style={styles.ctrlIconDone}>{isInProgress ? '⌛' : '✓'}</Text>
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
  const settings = useLifeStore((s) => s.settings);
  const updateSettings = useLifeStore((s) => s.updateSettings);

  const [editBreak, setEditBreak] = useState<{ id: string; minutes: number } | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [quickEventVisible, setQuickEventVisible] = useState(false);
  const [quickNoteVisible, setQuickNoteVisible] = useState(false);
  const [mealOptionsVisible, setMealOptionsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const itv = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(itv);
  }, []);

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

  const hour = new Date().getHours();
  const greeting = hour >= 6 && hour < 12 ? 'Buenos días ☀️' : hour >= 12 && hour < 20 ? 'Buenas tardes 🌤' : 'Buenas noches 🌙';

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
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <Pressable 
            style={styles.statsRow}
            onPress={() => router.push('/(tabs)/stats' as any)}
          >
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
          </Pressable>
        </Animated.View>

        {/* Action Row Removed - Navigation moved to stats chips */}

        {/* Engine badge removed - moved to settings */}

        {/* --- HABIT QUICK ACTIONS --- */}
        <Animated.View entering={FadeInDown.delay(120).duration(300)} style={styles.habitsRow}>
          <Text style={styles.habitsTitle}>🌟 Hábitos de hoy</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.habitsList}>
            {habits.map((habit) => {
              const isDone = habit.lastCompletedDate === getTodayStr();
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
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(320)} style={styles.actionsCard}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, isGenerating && styles.disabled]}
            onPress={() => void generateTimeline(new Date())}
            disabled={isGenerating}
          >
            <Text style={styles.primaryBtnText}>
              {isGenerating ? '⏳ Optimizando...' : '⚡ Organizar mi día'}
            </Text>
          </Pressable>

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
                  <Text style={styles.actionBtnLabel}>Almuerzo</Text>
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

        <QuickTaskModal visible={quickAddVisible} onClose={() => setQuickAddVisible(false)} />
        <QuickEventModal visible={quickEventVisible} onClose={() => setQuickEventVisible(false)} />
        <QuickNoteModal visible={quickNoteVisible} onClose={() => setQuickNoteVisible(false)} />
        <MealOptionsModal visible={mealOptionsVisible} onClose={() => setMealOptionsVisible(false)} />
        <TutorialOverlay 
          visible={settings.showTutorial} 
          onComplete={() => updateSettings({ showTutorial: false })} 
        />



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
                  now={now}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  headerActionRow: { flexDirection: 'row', gap: 10, marginTop: -4 },
  greeting: { color: lifeTheme.colors.muted, fontSize: 16, fontWeight: '600' },
  analyticsBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: `${lifeTheme.colors.primary}15`, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${lifeTheme.colors.primary}30`,
    flex: 1
  },
  analyticsBtnIcon: { fontSize: 18 },
  analyticsBtnLabel: { color: lifeTheme.colors.primary, fontSize: 14, fontWeight: '800' },
  dateText: { color: lifeTheme.colors.text, fontSize: 24, fontWeight: '900', marginTop: 2, textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
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
    paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: lifeTheme.colors.border,
    height: 60
  },
  actionBtnInner: {
    alignItems: 'center',
    gap: 4
  },
  actionBtnLabel: { color: lifeTheme.colors.text, fontSize: 10, fontWeight: '700' },
  timerDigitsSmall: { color: lifeTheme.colors.primary, fontSize: 13, fontWeight: '900', fontFamily: 'monospace' },
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
  blockTask: { 
    borderLeftWidth: 4, 
    borderLeftColor: lifeTheme.colors.primary 
  },
  blockInProgress: {
    borderColor: lifeTheme.colors.primary,
    borderWidth: 2,
    borderLeftWidth: 6,
    shadowColor: lifeTheme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  blockMeal: { borderLeftColor: '#fb923c' },
  blockSleep: { borderLeftColor: '#818cf8' },
  blockRest: { borderLeftColor: '#94a3b8', opacity: 0.9 },
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
  blockCtrl: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  ctrlBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: `${lifeTheme.colors.text}10`, alignItems: 'center', justifyContent: 'center' },
  ctrlBtnDisabled: { opacity: 0.3 },
  ctrlBtnDone: { backgroundColor: `${lifeTheme.colors.success}15` },
  ctrlBtnInProgress: { backgroundColor: `${lifeTheme.colors.primary}20` },
  ctrlIcon: { fontSize: 16, color: lifeTheme.colors.text, fontWeight: '700' },
  ctrlIconDisabled: { color: lifeTheme.colors.muted },
  ctrlIconDone: { fontSize: 16, color: lifeTheme.colors.success, fontWeight: '900' },
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
  // Actions Grid
  secondaryActionsRow: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  timerContent: { alignItems: 'center', gap: 2 },
  timerDigits: { color: lifeTheme.colors.primary, fontSize: 10, fontWeight: '800', fontFamily: 'monospace' },
  urgencyMiniChip: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: lifeTheme.colors.surfaceAlt, alignItems: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border },
  urgencyMiniChipActive: { backgroundColor: lifeTheme.colors.primary, borderColor: lifeTheme.colors.primary },
  urgencyMiniText: { fontSize: 11, fontWeight: '700', color: lifeTheme.colors.muted },
  habitsRow: { gap: 8, marginTop: 4 },
  habitsTitle: { color: lifeTheme.colors.text, fontSize: 15, fontWeight: '800', marginLeft: 4 },
  habitsList: { gap: 10, paddingRight: 16, paddingTop: 6 },
  habitBubble: {
    backgroundColor: lifeTheme.colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: lifeTheme.colors.border,
    paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', minWidth: 50, gap: 2
  },
  habitEmoji: { fontSize: 16 },
  habitName: { color: lifeTheme.colors.muted, fontSize: 9, fontWeight: '700' },
  habitBubbleDone: { backgroundColor: 'rgba(108,252,184,0.1)', borderColor: lifeTheme.colors.success },
  habitNameDone: { color: lifeTheme.colors.success },
  habitDoneCheck: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: lifeTheme.colors.success, borderRadius: 10,
    width: 18, height: 18, textAlign: 'center', lineHeight: 18,
    color: '#fff', fontSize: 10, fontWeight: '900', overflow: 'hidden'
  }
});
