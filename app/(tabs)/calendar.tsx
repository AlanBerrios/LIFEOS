import { useCallback, useMemo, useState } from 'react';
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
import type { Task, StaticEvent, ScheduleBlock } from '../../src/types';

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

function DayTasksPanel({ date, tasks, events }: { date: Date; tasks: Task[]; events: StaticEvent[] }): ReactElement {
  const dayTasks = tasks.filter((t) => {
    if (t.fixed_start && sameDay(t.fixed_start, date)) return true;
    if (t.deadline && sameDay(t.deadline, date)) return true;
    if (t.urgency === 'today' && sameDay(date, new Date())) return true;
    return false;
  });

  const dayEvents = events.filter((e) => sameDay(e.startTime, date));

  return (
    <View style={styles.dayPanel}>
      <Text style={styles.dayPanelTitle}>
        {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>
      {dayTasks.length === 0 && dayEvents.length === 0 ? (
        <Text style={styles.dayPanelEmpty}>Sin eventos ni tareas para este día</Text>
      ) : (
        <>
        {dayEvents.map((evt) => (
          <View key={evt.id} style={styles.dayTask}>
            <Text style={{fontSize: 16}}>📌</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dayTaskTitle, { color: '#8b5cf6' }]}>{evt.title}</Text>
              <Text style={styles.dayTaskMeta}>
                Evento Fijo · {evt.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {evt.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {evt.location ? ` · ${evt.location}` : ''}
              </Text>
            </View>
          </View>
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
        </>
      )}
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

  function hasTaskOn(date: Date): string | null {
    if (events.some(e => sameDay(e.startTime, date))) return '#8b5cf6'; // Event color
    const relevant = tasks.filter((t) => {
      if (t.fixed_start && sameDay(t.fixed_start, date)) return true;
      if (t.deadline && sameDay(t.deadline, date)) return true;
      return false;
    });
    if (relevant.length === 0) return null;
    const prio = relevant.sort((a, b) => {
      const u = { today: 4, this_week: 3, this_month: 2, someday: 1 };
      return u[b.urgency] - u[a.urgency];
    })[0];
    return urgencyColor(prio);
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
            {dotColor && <View style={[styles.calDot, { backgroundColor: dotColor }]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ currentDate, selectedDay, tasks, events, onSelectDay }: {
  currentDate: Date;
  selectedDay: Date;
  tasks: Task[];
  events: StaticEvent[];
  onSelectDay: (d: Date) => void;
}): ReactElement {
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <View>
      <ScrollView style={styles.weekScroll} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
        {days.map((day) => {
          const isToday = sameDay(day, new Date());
          const isSelected = sameDay(day, selectedDay);
          const dayEvents = events.filter(e => sameDay(e.startTime, day));
          const dayTasks = tasks.filter((t) =>
            (t.fixed_start && sameDay(t.fixed_start, day)) ||
            (t.deadline && sameDay(t.deadline, day)) ||
            ((t as any).urgency === 'today' && sameDay(day, new Date()))
          );
          return (
            <Pressable
              key={day.toISOString()}
              style={[styles.weekRow, isSelected && styles.weekRowSelected]}
              onPress={() => onSelectDay(day)}
            >
              <View style={[styles.weekDayLabel, isToday && styles.weekDayLabelToday]}>
                <Text style={[styles.weekDayName, isToday && styles.weekDayNameToday]}>
                  {WEEKDAYS[(day.getDay() + 6) % 7]}
                </Text>
                <Text style={[styles.weekDayNum, isToday && styles.weekDayNumToday]}>
                  {day.getDate()}
                </Text>
              </View>
              <View style={styles.weekTasks}>
                {dayEvents.slice(0, 2).map((e) => (
                  <View key={e.id} style={[styles.weekTaskChip, { borderLeftColor: '#8b5cf6', backgroundColor: '#8b5cf615' }]}>
                    <Text style={[styles.weekTaskText, { color: '#8b5cf6', fontWeight: 'bold' }]} numberOfLines={1}>{e.title}</Text>
                  </View>
                ))}
                {dayTasks.slice(0, 3).map((t) => (
                  <View key={t.id} style={[styles.weekTaskChip, { borderLeftColor: urgencyColor(t) }]}>
                    <Text style={styles.weekTaskText} numberOfLines={1}>{t.title}</Text>
                  </View>
                ))}
                {dayTasks.length + dayEvents.length > 5 && (
                  <Text style={styles.moreText}>+{dayTasks.length + dayEvents.length - 5} más</Text>
                )}
                {dayTasks.length === 0 && dayEvents.length === 0 && (
                  <Text style={styles.emptyDayText}>—</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ date, tasks, events, timeline }: { date: Date; tasks: Task[]; events: StaticEvent[]; timeline: ScheduleBlock[] }): ReactElement {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 7:00 — 22:00

  // Combine timeline blocks & standalone events for that day
  function blocksAt(hour: number) {
    const isToday = sameDay(date, new Date());
    
    // Timeline blocks that fall into this hour
    const tb = timeline.filter(b => b.start_time.getHours() === hour && sameDay(b.start_time, date));
    
    // Events not in the timeline (for future/past days, or unmerged)
    const ev = events.filter(e => e.startTime.getHours() === hour && sameDay(e.startTime, date) && !tb.some(b => b.id === e.id));
    
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
                <View key={e.id} style={[styles.hourTask, { borderLeftColor: '#8b5cf6', backgroundColor: '#8b5cf610' }]}>
                  <Text style={[styles.hourTaskTitle, { color: '#8b5cf6' }]}>{e.title}</Text>
                  <Text style={styles.hourTaskMeta}>Evento Fijo</Text>
                </View>
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
                  <View key={`${b.id}-${b.start_time.getTime()}`} style={[styles.hourTask, { borderLeftColor: brdColor }, bgStyle]}>
                    <Text style={[styles.hourTaskTitle, b.isStaticEvent && { color: '#8b5cf6' }]}>{b.title}</Text>
                    <Text style={styles.hourTaskMeta}>
                      {fmt(b.start_time)} - {fmt(b.end_time)} ({durMinutes} min)
                    </Text>
                  </View>
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

// ─── Add Event Modal ──────────────────────────────────────────────────────────

function EventModal({ visible, onClose }: { visible: boolean; onClose: () => void; }): ReactElement {
  const addEvent = useLifeStore(s => s.addEvent);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);

  function handleSave() {
    if (!title.trim() || !startTime || !endTime) {
      Alert.alert('Faltan datos', 'El título y las horas son obligatorios.');
      return;
    }
    if (endTime <= startTime) {
      Alert.alert('Error', 'La hora de fin debe ser posterior a la de inicio.');
      return;
    }
    addEvent({
      title: title.trim(),
      startTime,
      endTime
    });
    setTitle('');
    setStartTime(null);
    setEndTime(null);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={undefined}>
          <Text style={styles.modalTitle}>Nuevo Evento Fijo</Text>
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

          <View style={styles.modalBtns}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Guardar Evento</Text>
            </Pressable>
          </View>
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

  const activeTasks = tasks.filter((t) => t.status !== 'completed');

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
          <DayView date={currentDate} tasks={activeTasks} events={events} timeline={timeline} />
        )}
      </View>

      {/* Selected day info */}
      {view !== 'day' && (
        <DayTasksPanel date={selectedDay} tasks={activeTasks} events={events} />
      )}

      {/* FAB */}
      <Pressable style={[styles.fab, { bottom: 16 }]} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+ Evento</Text>
      </Pressable>

      <EventModal visible={modalVisible} onClose={() => setModalVisible(false)} />
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
  calDot: { width: 5, height: 5, borderRadius: 3, position: 'absolute', bottom: 4 },
  // Week
  weekScroll: { maxHeight: 340, paddingHorizontal: 12 },
  weekRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: lifeTheme.colors.border,
    alignItems: 'flex-start',
    gap: 12
  },
  weekRowSelected: { backgroundColor: `${lifeTheme.colors.primary}11`, borderRadius: 10 },
  weekDayLabel: { width: 40, alignItems: 'center' },
  weekDayLabelToday: {
    backgroundColor: lifeTheme.colors.primary,
    borderRadius: 10,
    paddingVertical: 4
  },
  weekDayName: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '700' },
  weekDayNameToday: { color: '#fff' },
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
  fabText: { color: '#fff', fontWeight: '900', fontSize: 14 }
});
