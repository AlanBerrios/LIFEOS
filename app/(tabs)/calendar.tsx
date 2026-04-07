import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../../src/store/useLifeStore';
import { lifeTheme } from '../../src/theme';
import type { Task } from '../../src/types';

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

function urgencyColor(task: Task): string {
  if (task.urgency === 'today') return lifeTheme.colors.alert;
  if (task.urgency === 'this_week') return '#f59e0b';
  if (task.urgency === 'this_month') return lifeTheme.colors.primary;
  return lifeTheme.colors.muted;
}

// ─── Day Tasks Panel ──────────────────────────────────────────────────────────

function DayTasksPanel({ date, tasks }: { date: Date; tasks: Task[] }): ReactElement {
  const dayTasks = tasks.filter((t) => {
    if (t.fixed_start && sameDay(t.fixed_start, date)) return true;
    if (t.deadline && sameDay(t.deadline, date)) return true;
    if (t.urgency === 'today' && sameDay(date, new Date())) return true;
    return false;
  });

  return (
    <View style={styles.dayPanel}>
      <Text style={styles.dayPanelTitle}>
        {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>
      {dayTasks.length === 0 ? (
        <Text style={styles.dayPanelEmpty}>Sin tareas para este día</Text>
      ) : (
        dayTasks.map((task) => (
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
        ))
      )}
    </View>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ currentDate, selectedDay, tasks, onSelectDay }: {
  currentDate: Date;
  selectedDay: Date;
  tasks: Task[];
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

function WeekView({ currentDate, selectedDay, tasks, onSelectDay }: {
  currentDate: Date;
  selectedDay: Date;
  tasks: Task[];
  onSelectDay: (d: Date) => void;
}): ReactElement {
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <View>
      <ScrollView style={styles.weekScroll} showsVerticalScrollIndicator={false}>
        {days.map((day) => {
          const isToday = sameDay(day, new Date());
          const isSelected = sameDay(day, selectedDay);
          const dayTasks = tasks.filter((t) =>
            (t.fixed_start && sameDay(t.fixed_start, day)) ||
            (t.deadline && sameDay(t.deadline, day))
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
                {dayTasks.slice(0, 3).map((t) => (
                  <View key={t.id} style={[styles.weekTaskChip, { borderLeftColor: urgencyColor(t) }]}>
                    <Text style={styles.weekTaskText} numberOfLines={1}>{t.title}</Text>
                  </View>
                ))}
                {dayTasks.length > 3 && (
                  <Text style={styles.moreText}>+{dayTasks.length - 3} más</Text>
                )}
                {dayTasks.length === 0 && (
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

function DayView({ date, tasks }: { date: Date; tasks: Task[] }): ReactElement {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 7:00 — 22:00

  function tasksAt(hour: number): Task[] {
    return tasks.filter((t) => {
      if (!t.fixed_start) return false;
      return t.fixed_start.getHours() === hour;
    });
  }

  return (
    <ScrollView style={styles.dayScroll} showsVerticalScrollIndicator={false}>
      {hours.map((hour) => {
        const hourTasks = tasksAt(hour);
        return (
          <View key={hour} style={styles.hourRow}>
            <Text style={styles.hourLabel}>{String(hour).padStart(2, '0')}:00</Text>
            <View style={styles.hourContent}>
              {hourTasks.map((t) => (
                <View key={t.id} style={[styles.hourTask, { borderLeftColor: urgencyColor(t) }]}>
                  <Text style={styles.hourTaskTitle}>{t.title}</Text>
                  <Text style={styles.hourTaskMeta}>{t.eta_minutes} min</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type CalendarView = 'month' | 'week' | 'day';

export default function CalendarScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const tasks = useLifeStore((s) => s.tasks);

  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
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
            onSelectDay={setSelectedDay}
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            selectedDay={selectedDay}
            tasks={activeTasks}
            onSelectDay={setSelectedDay}
          />
        )}
        {view === 'day' && (
          <DayView date={currentDate} tasks={activeTasks} />
        )}
      </View>

      {/* Selected day info */}
      {view !== 'day' && (
        <DayTasksPanel date={selectedDay} tasks={activeTasks} />
      )}
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
  statusPending: { backgroundColor: lifeTheme.colors.border }
});
