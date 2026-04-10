import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../../src/store/useLifeStore';
import { lifeTheme } from '../../src/theme';
import { getEventsForDate } from '../../src/utils/events';
import type { Task, StaticEvent, ScheduleBlock, RecurrenceFrequency } from '../../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function urgencyColor(task?: Task): string {
  if (!task) return lifeTheme.colors.muted;
  if (task.urgency === 'today') return lifeTheme.colors.alert;
  if (task.urgency === 'this_week') return '#f59e0b';
  if (task.urgency === 'this_month') return lifeTheme.colors.primary;
  return lifeTheme.colors.muted;
}

// ─── Android-safe DatePicker ──────────────────────────────────────────────────

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
    if (selected == null) return;
    if (Platform.OS === 'android') {
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
      <Text style={styles.modalLabel}>{label}</Text>
      <Pressable style={styles.dateBtn} onPress={() => setShowDate(true)}>
        <Text style={[styles.dateBtnText, value ? styles.dateBtnTextActive : null]}>
          {value
            ? `📅 ${value.toLocaleDateString('es-ES')}  ${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : '+ Seleccionar'}
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

// ─── Day Tasks Panel ──────────────────────────────────────────────────────────

function DayTasksPanel({ 
  date, tasks, events, onEditEvent 
}: { 
  date: Date; tasks: Task[]; events: StaticEvent[]; onEditEvent: (id: string) => void 
}): ReactElement {
  const dayTasks = tasks.filter((t) => {
    if (t.fixed_start && sameDay(t.fixed_start, date)) return true;
    if (t.deadline && sameDay(t.deadline, date)) return true;
    if (t.urgency === 'today' && sameDay(date, new Date())) return true;
    return false;
  });

  const dayEvents = getEventsForDate(events, date);

  return (
    <View style={styles.dayPanel}>
      <Text style={styles.dayPanelTitle}>
        {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>
      <ScrollView>
      {dayTasks.length === 0 && dayEvents.length === 0 ? (
        <Text style={styles.dayPanelEmpty}>Sin eventos ni tareas para este día</Text>
      ) : (
        <View style={{ gap: 8 }}>
        {dayEvents.map((evt) => (
          <Pressable key={evt.id} style={styles.dayTask} onPress={() => onEditEvent(evt.id)}>
            <Text style={{fontSize: 16}}>📌</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dayTaskTitle, { color: '#8b5cf6' }]}>{evt.title}</Text>
              <Text style={styles.dayTaskMeta}>
                Evento Fijo · {evt.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {evt.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {evt.reminderMinutes ? ` · Alerta: ${evt.reminderMinutes}m antes` : ''}
              </Text>
            </View>
          </Pressable>
        ))}
        {dayTasks.map((task) => (
          <View key={task.id} style={styles.dayTask}>
            <View style={[styles.urgencyDot, { backgroundColor: urgencyColor(task) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dayTaskTitle}>{task.title}</Text>
              <Text style={styles.dayTaskMeta}>
                {task.eta_minutes} min · P{task.priority}
                {task.fixed_start ? ` · ${task.fixed_start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
              </Text>
            </View>
            <View style={[styles.statusDot, task.status === 'completed' ? styles.statusDone : styles.statusPending]} />
          </View>
        ))}
        </View>
      )}
      </ScrollView>
    </View>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ currentDate, selectedDay, tasks, events, onSelectDay }: {
  currentDate: Date;
  selectedDay: Date;
  tasks: Task[];
  events: StaticEvent[];
  onSelectDay: (d: Date) => void;
}): ReactElement {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = startOfMonth(currentDate);
  const totalDays = daysInMonth(year, month);
  // Monday=0 offset
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(year, month, i + 1))
  ];
  // Fill to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  function getTaskColorsOn(date: Date): string[] {
    const dayEvents = getEventsForDate(events, date);
    const dayTasks = tasks.filter((t) => {
      if (t.fixed_start && sameDay(t.fixed_start, date)) return true;
      if (t.deadline && sameDay(t.deadline, date)) return true;
      return false;
    });

    const colors: string[] = [];
    if (dayEvents.length > 0) colors.push('#8b5cf6');
    
    // Get unique urgency colors from tasks
    const urgencies = Array.from(new Set(dayTasks.map(t => t.urgency)));
    urgencies.forEach(u => {
      const dummyTask = { urgency: u } as any;
      const color = urgencyColor(dummyTask);
      if (!colors.includes(color)) colors.push(color);
    });

    return colors.slice(0, 3);
  }

  return (
    <View style={styles.monthGrid}>
      {WEEKDAYS.map((d) => (
        <View key={d} style={styles.weekdayHeader}>
          <Text style={styles.weekdayText}>{d}</Text>
        </View>
      ))}
      {cells.map((date, idx) => {
        if (!date) return <View key={`empty-${idx}`} style={styles.dayCell} />;
        const isToday = sameDay(date, new Date());
        const isSelected = sameDay(date, selectedDay);
        const dotColor = hasTaskOn(date);
        return (
          <Pressable
            key={date.toISOString()}
            style={[
              styles.dayCell,
              isToday && styles.dayCellToday,
              isSelected && styles.dayCellSelected
            ]}
            onPress={() => onSelectDay(date)}
          >
            <Text style={[
              styles.dayCellText,
              isToday && styles.dayCellTextToday,
              isSelected && styles.dayCellTextSelected
            ]}>{date.getDate()}</Text>
            <View style={styles.dotRow}>
              {getTaskColorsOn(date).map((color, i) => (
                <View key={i} style={[styles.calDot, { backgroundColor: color, position: 'relative', bottom: 0 }]} />
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ currentDate, tasks, events, onSelectDay }: {
  currentDate: Date;
  selectedDay: Date;
  tasks: Task[];
  events: StaticEvent[];
  onSelectDay: (d: Date) => void;
}): ReactElement {
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <View style={styles.weekContainer}>
      <View style={styles.weekHdrRow}>
        <View style={styles.hourColSpacer} />
        {days.map((d, i) => (
          <Pressable key={i} style={styles.weekHdrCell} onPress={() => onSelectDay(d)}>
            <Text style={styles.weekHdrDay}>{WEEKDAYS[i]}</Text>
            <Text style={styles.weekHdrNum}>{d.getDate()}</Text>
          </Pressable>
        ))}
      </View>
      
      <ScrollView style={styles.weekGridScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.weekGridBody}>
          <View style={styles.hourCol}>
            {hours.map(h => (
              <View key={h} style={styles.hourLabelCell}>
                <Text style={styles.hourLabelText}>{String(h).padStart(2, '0')}:00</Text>
              </View>
            ))}
          </View>
          
          {days.map((day, dayIdx) => {
            const dayEvents = getEventsForDate(events, day);
            const dayTasks = tasks.filter(t => 
              (t.fixed_start && sameDay(t.fixed_start, day)) ||
              (t.deadline && sameDay(t.deadline, day))
            );

            return (
              <View key={dayIdx} style={styles.dayCol}>
                {hours.map(h => {
                  const hasEvt = dayEvents.some(e => e.startTime.getHours() === h);
                  const hasTsk = dayTasks.some(t => t.fixed_start?.getHours() === h);
                  return (
                    <View key={h} style={styles.slotCell}>
                      {hasEvt && <View style={[styles.miniDot, { backgroundColor: '#8b5cf6' }]} />}
                      {hasTsk && <View style={[styles.miniDot, { backgroundColor: lifeTheme.colors.primary }]} />}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}


// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ date, tasks, events, timeline, onEditEvent }: { 
  date: Date; tasks: Task[]; events: StaticEvent[]; timeline: ScheduleBlock[]; onEditEvent: (id: string) => void 
}): ReactElement {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 7:00 — 22:00

  // Combine timeline blocks & standalone events for that day
  function blocksAt(hour: number) {
    const isToday = sameDay(date, new Date());
    
    // Timeline blocks that fall into this hour
    const tb = timeline.filter(b => b.start_time.getHours() === hour && sameDay(b.start_time, date));
    
    // expansion logic for recurring events
    const dailyEvents = getEventsForDate(events, date);
    
    // Events not in the timeline (for future/past days, or unmerged)
    const ev = dailyEvents.filter(e => e.startTime.getHours() === hour && sameDay(e.startTime, date) && !tb.some(b => b.id === e.id));
    
    return { tb, ev };
  }

  return (
    <ScrollView style={styles.dayScroll} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
      {hours.map((hour) => {
        const { tb, ev } = blocksAt(hour);
        const hasContent = tb.length > 0 || ev.length > 0;
        
        return (
          <View key={hour} style={[styles.hourRow, hasContent && { minHeight: 64 }]}>
            <Text style={styles.hourLabel}>{String(hour).padStart(2, '0')}:00</Text>
            <View style={styles.hourContent}>
              {ev.map((e) => (
                <Pressable key={e.id} style={[styles.hourTask, { borderLeftColor: '#8b5cf6', backgroundColor: '#8b5cf610' }]} onPress={() => onEditEvent(e.id)}>
                  <Text style={[styles.hourTaskTitle, { color: '#8b5cf6' }]}>{e.title}</Text>
                  <Text style={styles.hourTaskMeta}>Evento Fijo</Text>
                </Pressable>
              ))}
              {tb.map((b) => {
                let brdColor = lifeTheme.colors.border;
                let bgStyle: any = null;
                const durMinutes = Math.round((b.end_time.getTime() - b.start_time.getTime()) / 60000);
                
                if (b.type === 'task') {
                  const t = tasks.find(tsk => tsk.id === b.task_id);
                  brdColor = urgencyColor(t);
                  bgStyle = { backgroundColor: lifeTheme.colors.surface };
                } else if (b.type === 'rest' || b.type === 'meal') {
                  brdColor = lifeTheme.colors.muted;
                  bgStyle = { backgroundColor: `${lifeTheme.colors.surfaceAlt}88`, borderStyle: 'dashed' as const };
                  if (b.type === 'meal') brdColor = lifeTheme.colors.alert;
                } else if (b.isStaticEvent) {
                  brdColor = '#8b5cf6';
                  bgStyle = { backgroundColor: '#8b5cf610' };
                }

                return (
                  <Pressable 
                    key={`${b.id}-${b.start_time.getTime()}`} 
                    style={[styles.hourTask, { borderLeftColor: brdColor }, bgStyle]}
                    onPress={() => b.isStaticEvent && onEditEvent(b.id)}
                  >
                    <Text style={[styles.hourTaskTitle, b.isStaticEvent && { color: '#8b5cf6' }]}>{b.title}</Text>
                    <Text style={styles.hourTaskMeta}>
                      {fmt(b.start_time)} - {fmt(b.end_time)} ({durMinutes} min)
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function fmt(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Add/Edit Event Modal ──────────────────────────────────────────────────────────

function EventModal({ 
  visible, editId, onClose 
}: { 
  visible: boolean; editId?: string | null; onClose: () => void; 
}): ReactElement {
  const addEvent = useLifeStore(s => s.addEvent);
  const updateEvent = useLifeStore(s => s.updateEvent);
  const deleteEvent = useLifeStore(s => s.deleteEvent);
  const events = useLifeStore(s => s.events);

  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [remindMin, setRemindMin] = useState(10);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('none');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    if (visible && editId) {
      const e = events.find(ev => ev.id === editId);
      if (e) {
        setTitle(e.title);
        setStartTime(e.startTime);
        setEndTime(e.endTime);
        setRemindMin(e.reminderMinutes || 0);
        setFrequency(e.recurrence?.frequency || 'none');
        setDaysOfWeek(e.recurrence?.daysOfWeek || []);
        setEndDate(e.recurrence?.endDate ? new Date(e.recurrence.endDate) : null);
      }
    } else if (visible) {
      setTitle('');
      setStartTime(null);
      setEndTime(null);
      setRemindMin(10);
      setFrequency('none');
      setDaysOfWeek([]);
      setEndDate(null);
    }
  }, [visible, editId, events]);

  function handleSave() {
    if (!title.trim() || !startTime || !endTime) {
      Alert.alert('Faltan datos', 'El título y las horas son obligatorios.');
      return;
    }
    if (endTime <= startTime) {
      Alert.alert('Error', 'La hora de fin debe ser posterior a la de inicio.');
      return;
    }

    const payload: any = {
      title: title.trim(),
      startTime,
      endTime,
      reminderMinutes: remindMin,
      recurrence: frequency !== 'none' ? { frequency, daysOfWeek, endDate: endDate || undefined } : undefined
    };

    if (editId) {
      updateEvent(editId, payload);
    } else {
      addEvent(payload);
    }
    onClose();
  }

  function handleDelete() {
    if (!editId) return;
    Alert.alert('Eliminar Evento', '¿Estás seguro de que quieres eliminar este evento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { deleteEvent(editId); onClose(); } }
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={undefined}>
          <Text style={styles.modalTitle}>{editId ? 'Editar Evento' : 'Nuevo Evento Fijo'}</Text>
          <Text style={styles.modalSub}>Clases, reuniones, compromisos inamovibles.</Text>
          
          <Text style={styles.modalLabel}>Título del Evento</Text>
          <TextInput
            style={styles.modalInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Clase de Programación"
            placeholderTextColor={lifeTheme.colors.muted}
          />

          <SafeDatePicker
            label="Hora de Inicio"
            value={startTime}
            onClear={() => setStartTime(null)}
            onConfirm={setStartTime}
          />

          <SafeDatePicker
            label="Hora de Fin"
            value={endTime}
            onClear={() => setEndTime(null)}
            onConfirm={setEndTime}
          />

          <View style={{ gap: 8 }}>
            <Text style={styles.modalLabel}>Repetir</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['none', 'daily', 'weekly', 'monthly'] as RecurrenceFrequency[]).map(f => (
                <Pressable
                  key={f}
                  onPress={() => setFrequency(f)}
                  style={[styles.freqChip, frequency === f && styles.freqChipActive]}
                >
                  <Text style={[styles.freqChipText, frequency === f && styles.freqChipTextActive]}>
                    {f === 'none' ? 'No' : f === 'daily' ? 'Diario' : f === 'weekly' ? 'Semanal' : 'Mensual'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {frequency === 'weekly' && (
            <View style={{ gap: 8 }}>
              <Text style={styles.modalLabel}>Días de la semana</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {['D','L','M','X','J','V','S'].map((day, i) => {
                  const active = daysOfWeek.includes(i);
                  return (
                    <Pressable
                      key={day}
                      onPress={() => {
                        setDaysOfWeek(prev => 
                          active ? prev.filter(d => d !== i) : [...prev, i]
                        );
                      }}
                      style={[styles.daySelectChip, active && styles.daySelectChipActive]}
                    >
                      <Text style={[styles.daySelectText, active && styles.daySelectTextActive]}>{day}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {frequency !== 'none' && (
            <SafeDatePicker
              label="Finalizar repetición (opcional)"
              value={endDate}
              onClear={() => setEndDate(null)}
              onConfirm={setEndDate}
            />
          )}

          <View style={{ gap: 6 }}>
            <Text style={styles.modalLabel}>Recordatorio (minutos antes)</Text>
            <TextInput
              style={styles.modalInput}
              value={String(remindMin)}
              onChangeText={v => setRemindMin(Number(v) || 0)}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.modalBtns}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>{editId ? 'Guardar' : 'Crear'}</Text>
            </Pressable>
          </View>

          {editId && (
            <Pressable style={[styles.cancelBtn, { borderColor: lifeTheme.colors.alert, marginTop: 4 }]} onPress={handleDelete}>
              <Text style={[styles.cancelBtnText, { color: lifeTheme.colors.alert }]}>Eliminar Evento</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type CalendarView = 'month' | 'week' | 'day';

export default function CalendarScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const tasks = useLifeStore((s) => s.tasks);
  const events = useLifeStore((s) => s.events);
  const timeline = useLifeStore((s) => s.timeline);

  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeTasks = tasks.filter((t) => t.status !== 'completed');

  function onEditEvent(id: string) {
    setEditingId(id);
    setModalVisible(true);
  }

  function onAddEvent() {
    setEditingId(null);
    setModalVisible(true);
  }

  function navigate(direction: -1 | 1) {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + direction);
    else if (view === 'week') d.setDate(d.getDate() + direction * 7);
    else d.setDate(d.getDate() + direction);
    setCurrentDate(d);
    setSelectedDay(d);
  }

  function headerTitle(): string {
    if (view === 'month') return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (view === 'week') {
      const ws = startOfWeek(currentDate);
      return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} — ${addDays(ws, 6).getDate()} ${MONTH_NAMES[addDays(ws, 6).getMonth()]}`;
    }
    return currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 4 }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.navBtn} onPress={() => navigate(-1)}>
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{headerTitle()}</Text>
        <Pressable style={styles.navBtn} onPress={() => navigate(1)}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      {/* View selector */}
      <View style={styles.viewSelector}>
        {(['month', 'week', 'day'] as CalendarView[]).map((v) => (
          <Pressable
            key={v}
            style={[styles.viewTab, view === v && styles.viewTabActive]}
            onPress={() => setView(v)}
          >
            <Text style={[styles.viewTabText, view === v && styles.viewTabTextActive]}>
              {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : 'Día'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Calendar body */}
      <View style={styles.calBody}>
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            selectedDay={selectedDay}
            tasks={activeTasks}
            events={events}
            onSelectDay={setSelectedDay}
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            selectedDay={selectedDay}
            tasks={activeTasks}
            events={events}
            onSelectDay={setSelectedDay}
          />
        )}
        {view === 'day' && (
          <DayView date={currentDate} tasks={activeTasks} events={events} timeline={timeline} onEditEvent={onEditEvent} />
        )}
      </View>

      {/* Selected day info */}
      {view !== 'day' && (
        <DayTasksPanel date={selectedDay} tasks={activeTasks} events={events} onEditEvent={onEditEvent} />
      )}

      {/* FAB */}
      <Pressable style={[styles.fab, { bottom: 16 }]} onPress={onAddEvent}>
        <Text style={styles.fabText}>+ Evento</Text>
      </Pressable>

      <EventModal visible={modalVisible} editId={editingId} onClose={() => setModalVisible(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: lifeTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  navBtnText: { color: lifeTheme.colors.text, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '800', textTransform: 'capitalize' },
  viewSelector: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    marginBottom: 8
  },
  viewTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  viewTabActive: { backgroundColor: lifeTheme.colors.primary },
  viewTabText: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '700' },
  viewTabTextActive: { color: '#fff' },
  calBody: { flex: 1 },
  // Month
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  weekdayHeader: { width: '14.28%', alignItems: 'center', paddingVertical: 6 },
  weekdayText: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700' },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    position: 'relative'
  },
  dayCellToday: { backgroundColor: `${lifeTheme.colors.primary}22` },
  dayCellSelected: { backgroundColor: lifeTheme.colors.primary },
  dayCellText: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '600' },
  dayCellTextToday: { color: lifeTheme.colors.primary, fontWeight: '800' },
  dayCellTextSelected: { color: '#fff', fontWeight: '800' },
  dotRow: { flexDirection: 'row', gap: 2, position: 'absolute', bottom: 4 },
  calDot: { width: 4, height: 4, borderRadius: 2 },
  // Week Vertical
  weekContainer: { flex: 1 },
  weekHdrRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: lifeTheme.colors.border, paddingBottom: 8 },
  hourColSpacer: { width: 45 },
  weekHdrCell: { flex: 1, alignItems: 'center' },
  weekHdrDay: { color: lifeTheme.colors.muted, fontSize: 10, fontWeight: '700' },
  weekHdrNum: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '800' },
  weekGridScroll: { flex: 1 },
  weekGridBody: { flexDirection: 'row' },
  hourCol: { width: 45 },
  hourLabelCell: { height: 40, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: lifeTheme.colors.border },
  hourLabelText: { color: lifeTheme.colors.muted, fontSize: 9, fontWeight: '600' },
  dayCol: { flex: 1, borderRightWidth: 1, borderRightColor: `${lifeTheme.colors.border}44` },
  slotCell: { height: 40, borderBottomWidth: 1, borderBottomColor: `${lifeTheme.colors.border}22`, alignItems: 'center', justifyContent: 'center', gap: 2 },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  // View switches...

  weekDayNum: { color: lifeTheme.colors.text, fontSize: 18, fontWeight: '800' },
  weekDayNumToday: { color: '#fff' },
  weekTasks: { flex: 1, gap: 4 },
  weekTaskChip: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderLeftWidth: 3
  },
  weekTaskText: { color: lifeTheme.colors.text, fontSize: 12 },
  moreText: { color: lifeTheme.colors.muted, fontSize: 11, marginTop: 2 },
  emptyDayText: { color: lifeTheme.colors.border, fontSize: 14 },
  // Day view
  dayScroll: { paddingHorizontal: 12 },
  hourRow: { flexDirection: 'row', minHeight: 52, borderBottomWidth: 1, borderBottomColor: lifeTheme.colors.border },
  hourLabel: { width: 50, color: lifeTheme.colors.muted, fontSize: 11, paddingTop: 8, paddingRight: 8, textAlign: 'right' },
  hourContent: { flex: 1, gap: 4, paddingVertical: 6 },
  hourTask: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 8,
    padding: 6,
    borderLeftWidth: 3
  },
  hourTaskTitle: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '700' },
  hourTaskMeta: { color: lifeTheme.colors.muted, fontSize: 11 },
  // Day panel
  dayPanel: {
    backgroundColor: lifeTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: lifeTheme.colors.border,
    padding: 16,
    gap: 10,
    maxHeight: 200
  },
  dayPanelTitle: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '800', textTransform: 'capitalize' },
  dayPanelEmpty: { color: lifeTheme.colors.muted, fontSize: 13 },
  dayTask: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  urgencyDot: { width: 8, height: 8, borderRadius: 4 },
  dayTaskTitle: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '700' },
  dayTaskMeta: { color: lifeTheme.colors.muted, fontSize: 11 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDone: { backgroundColor: lifeTheme.colors.success },
  statusPending: { backgroundColor: lifeTheme.colors.border },
  
  // Modal & Forms
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: lifeTheme.colors.surface, borderRadius: 20, padding: 24, gap: 14, borderWidth: 1, borderColor: lifeTheme.colors.border },
  modalTitle: { color: lifeTheme.colors.text, fontSize: 18, fontWeight: '800' },
  modalSub: { color: lifeTheme.colors.muted, fontSize: 12, marginTop: -8 },
  modalLabel: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  modalInput: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: lifeTheme.colors.border, color: lifeTheme.colors.text, fontSize: 15, padding: 12 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: lifeTheme.colors.border },
  cancelBtnText: { color: lifeTheme.colors.muted, fontWeight: '700' },
  saveBtn: { flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: lifeTheme.colors.primary },
  saveBtnText: { color: '#fff', fontWeight: '800' },
  
  dateBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: lifeTheme.colors.surfaceAlt, borderColor: lifeTheme.colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  dateBtnText: { color: lifeTheme.colors.muted, fontSize: 13, flex: 1 },
  dateBtnTextActive: { color: lifeTheme.colors.text, fontWeight: '600' },
  dateClear: { color: lifeTheme.colors.alert, fontSize: 16, paddingLeft: 8 },

  // FAB
  fab: { position: 'absolute', right: 20, backgroundColor: lifeTheme.colors.primary, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 30, elevation: 5, shadowColor: '#000', shadowOffset: {width:0, height:3}, shadowOpacity: 0.3, shadowRadius: 5 },
  fabText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  freqChip: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: lifeTheme.colors.border, backgroundColor: lifeTheme.colors.surfaceAlt },
  freqChipActive: { backgroundColor: lifeTheme.colors.primary, borderColor: lifeTheme.colors.primary },
  freqChipText: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '700' },
  freqChipTextActive: { color: '#fff' },

  daySelectChip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border, backgroundColor: lifeTheme.colors.surfaceAlt },
  daySelectChipActive: { backgroundColor: lifeTheme.colors.primary, borderColor: lifeTheme.colors.primary },
  daySelectText: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '700' },
  daySelectTextActive: { color: '#fff' }
});
