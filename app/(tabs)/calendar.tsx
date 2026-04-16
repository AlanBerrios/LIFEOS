import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLifeStore } from '../../src/store/useLifeStore';
import { useAppTheme } from '../../src/theme';
import { getEventsForDate } from '../../src/utils/events';
import type { Task, StaticEvent, ScheduleBlock, RecurrenceFrequency } from '../../src/types';
import { CustomAlertDialog, type AlertButtonConfig } from '../../src/components/CustomAlertDialog';
import { AppDateTimePickerSheet } from '../../src/components/AppDateTimePickerSheet';
import { useCustomAlert } from '../../src/hooks/useCustomAlert';

type ShowAlertFn = (title: string, message?: string, buttons?: AlertButtonConfig[]) => void;

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

function urgencyColor(task: Task | undefined, lifeTheme: ReturnType<typeof useAppTheme>): string {
  if (!task) return lifeTheme.colors.muted;
  if (task.urgency === 'today') return lifeTheme.colors.alert;
  if (task.urgency === 'this_week') return '#f59e0b';
  if (task.urgency === 'this_month') return lifeTheme.colors.primary;
  return lifeTheme.colors.muted;
}

function getTaskAccent(task: Task | undefined, lifeTheme: ReturnType<typeof useAppTheme>): string {
  return task?.color?.trim() || urgencyColor(task, lifeTheme);
}

function getTaskEmoji(task: Task | undefined): string {
  return task?.emoji?.trim() || '✅';
}

function getEventAccent(event: StaticEvent | undefined, lifeTheme: ReturnType<typeof useAppTheme>): string {
  return event?.color?.trim() || lifeTheme.colors.primary;
}

function getEventEmoji(event: StaticEvent | undefined): string {
  return event?.emoji?.trim() || '📌';
}

function buildBlockInfoMessage(params: {
  kind: 'task' | 'event' | 'rest' | 'meal' | 'sleep' | 'transit' | 'habit';
  title: string;
  start?: Date;
  end?: Date;
  description?: string;
  location?: string;
  emoji?: string;
  color?: string;
  task?: Task | null;
  event?: StaticEvent | null;
}): string {
  const lines: string[] = [];
  const duration = params.start && params.end
    ? Math.max(1, Math.round((params.end.getTime() - params.start.getTime()) / 60000))
    : null;

  lines.push(`Tipo: ${params.kind}`);
  if (params.start && params.end) {
    lines.push(`Horario: ${params.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${params.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    lines.push(`Duración: ${duration} min`);
  }
  if (params.color) lines.push(`Color: ${params.color}`);
  if (params.emoji) lines.push(`Emoji: ${params.emoji}`);

  if (params.kind === 'task' && params.task) {
    lines.push(`Prioridad: ${params.task.priority}/5`);
    lines.push(`Carga cognitiva: ${params.task.cognitive_load}/10`);
    lines.push(`Duración estimada: ${params.task.eta_minutes} min`);
    if (params.task.description?.trim()) lines.push(`Descripción: ${params.task.description.trim()}`);
  }

  if (params.kind === 'event') {
    if (params.description?.trim()) lines.push(`Descripción: ${params.description.trim()}`);
    if (params.location?.trim()) lines.push(`Lugar: ${params.location.trim()}`);
    if (params.event?.recurrence?.frequency && params.event.recurrence.frequency !== 'none') {
      lines.push(`Repetición: ${params.event.recurrence.frequency}`);
    }
  }

  if (params.kind === 'rest') {
    lines.push('Este es un descanso automático generado para dejar espacio entre bloques y evitar solapes.');
    if (params.title.toLowerCase().includes('libre')) {
      lines.push('El bloque “Libre” representa tiempo no asignado que quedó disponible en el timeline.');
    }
  }

  if (params.kind === 'meal') {
    lines.push('Bloque de comida de rutina. Protege tu tiempo de alimentación y evita que se solape con tareas.');
  }

  if (params.kind === 'sleep') {
    lines.push('Bloque de sueño de rutina. Mantiene tu jornada coherente y bloquea la noche como descanso.');
  }

  if (params.kind === 'transit') {
    lines.push('Bloque de traslado de rutina. Calcula el tiempo necesario para moverte sin cortar otros bloques.');
  }

  if (params.kind === 'habit') {
    lines.push('Recordatorio de hábito en modo bloque blando.');
    lines.push('Puede solaparse visualmente y no fuerza replanificación dura.');
  }

  return lines.join('\n');
}

type TimelineCard = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  kind: 'Tarea' | 'Evento' | 'Descanso' | 'Comida' | 'Sueño' | 'Tránsito' | 'Hábito';
  dotted?: boolean;
  onPress: () => void;
};

function overlap(a: TimelineCard, b: TimelineCard): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

function assignOverlapLanes(cards: TimelineCard[]): Array<TimelineCard & { lane: number; laneCount: number; spanLanes: number }> {
  const ordered = [...cards].sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  const laneEnds: number[] = [];
  const laidOut: Array<TimelineCard & { lane: number; laneCount: number; spanLanes: number }> = [];

  for (const card of ordered) {
    let lane = laneEnds.findIndex((endMs) => endMs <= card.start.getTime());
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(card.end.getTime());
    } else {
      laneEnds[lane] = card.end.getTime();
    }

    laidOut.push({ ...card, lane, laneCount: 0, spanLanes: 1 });
  }

  const laneCount = Math.max(1, laneEnds.length);

  // Expandir a la derecha cuando no haya solape en carriles vecinos.
  for (const card of laidOut) {
    let spanLanes = 1;
    for (let targetLane = card.lane + 1; targetLane < laneCount; targetLane += 1) {
      const blocksInTargetLane = laidOut.filter((other) => other.lane === targetLane);
      const hasCollision = blocksInTargetLane.some((other) => overlap(card, other));
      if (hasCollision) break;
      spanLanes += 1;
    }
    card.spanLanes = spanLanes;
  }

  return laidOut.map((card) => ({ ...card, laneCount }));
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

// ─── Day Tasks Panel ──────────────────────────────────────────────────────────

function DayTasksPanel({ 
  date, tasks, events, onOpenEventInfo, onOpenTaskInfo 
}: { 
  date: Date; tasks: Task[]; events: StaticEvent[]; onOpenEventInfo: (id: string) => void; onOpenTaskInfo: (id: string) => void; 
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
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
          <Pressable key={evt.id} style={styles.dayTask} onPress={() => onOpenEventInfo(evt.id)}>
            <Text style={{fontSize: 16}}>{getEventEmoji(evt)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dayTaskTitle, { color: getEventAccent(evt, lifeTheme) }]}>{evt.title}</Text>
              <Text style={styles.dayTaskMeta}>
                Evento Fijo · {evt.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {evt.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {evt.reminderMinutes ? ` · Alerta: ${evt.reminderMinutes}m antes` : ''}
              </Text>
            </View>
          </Pressable>
        ))}
        {dayTasks.map((task) => (
          <Pressable key={task.id} style={styles.dayTask} onPress={() => onOpenTaskInfo(task.id)}>
            <View style={[styles.urgencyDot, { backgroundColor: urgencyColor(task, lifeTheme) }]} />
            <Text style={{fontSize: 16, marginRight: 8}}>{getTaskEmoji(task)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dayTaskTitle, { color: getTaskAccent(task, lifeTheme) }]}>{task.title}</Text>
              <Text style={styles.dayTaskMeta}>
                {task.eta_minutes} min · P{task.priority}
                {task.fixed_start ? ` · ${task.fixed_start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
              </Text>
            </View>
            <View style={[styles.statusDot, task.status === 'completed' ? styles.statusDone : styles.statusPending]} />
          </Pressable>
        ))}
        </View>
      )}
      </ScrollView>
    </View>
  );
}

const MemoDayTasksPanel = memo(DayTasksPanel);

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ currentDate, selectedDay, tasks, events, onSelectDay }: {
  currentDate: Date;
  selectedDay: Date;
  tasks: Task[];
  events: StaticEvent[];
  onSelectDay: (d: Date) => void;
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
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
    dayEvents.forEach((event) => {
      const accent = getEventAccent(event, lifeTheme);
      if (!colors.includes(accent)) colors.push(accent);
    });
    
    // Get unique urgency colors from tasks
    dayTasks.forEach((task) => {
      const accent = getTaskAccent(task, lifeTheme);
      if (!colors.includes(accent)) colors.push(accent);
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
            <View style={styles.dayIndicatorsSlot}>
              {getTaskColorsOn(date).map((color, i) => (
                <View key={i} style={[styles.calDot, { backgroundColor: color }]} />
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const MemoMonthView = memo(MonthView);

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ currentDate, tasks, habits, events, timeline, onSelectDay, onOpenEventInfo, onOpenBlockInfo }: {
  currentDate: Date;
  tasks: Task[];
  habits: ReturnType<typeof useLifeStore.getState>['habits'];
  events: StaticEvent[];
  timeline: ScheduleBlock[];
  onSelectDay: (d: Date) => void;
  onOpenEventInfo: (id: string) => void;
  onOpenBlockInfo: (blockId: string) => void;
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const { width } = useWindowDimensions();
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 -> 23:00
  const hourHeight = 34;
  const baseHour = 6;
  const dayColWidth = Math.max(112, Math.min(148, Math.round((width - 72) / 3)));

  return (
    <View style={styles.weekContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.weekHdrRowWide}>
            <View style={styles.hourColSpacerWide} />
            {days.map((d, i) => (
              <Pressable key={i} style={[styles.weekHdrCellWide, { width: dayColWidth }]} onPress={() => onSelectDay(d)}>
                <Text style={styles.weekHdrDay}>{WEEKDAYS[i]}</Text>
                <Text style={styles.weekHdrNum}>{d.getDate()}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView style={styles.weekGridScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.weekGridBodyWide}>
              <View style={styles.hourColWide}>
                {hours.map((h) => (
                  <View key={h} style={[styles.hourLabelCellWide, { height: hourHeight }]}>
                    <Text style={styles.hourLabelText}>{String(h).padStart(2, '0')}:00</Text>
                  </View>
                ))}
              </View>

              {days.map((day, dayIdx) => {
                const dayEvents = getEventsForDate(events, day);
                const dayTimelineTasks = timeline.filter((b) => sameDay(b.start_time, day));

                const blocks = assignOverlapLanes([
                  ...dayEvents.map((e) => ({
                    id: `evt-${e.id}-${day.toISOString()}`,
                    title: e.title,
                    start: e.startTime,
                    end: e.endTime,
                    color: getEventAccent(e, lifeTheme),
                    kind: 'Evento' as const,
                    dotted: true,
                    onPress: () => onOpenEventInfo(e.id)
                  })),
                  ...dayTimelineTasks.map((b) => ({
                    id: `tsk-${b.id}`,
                    title: b.title,
                    start: b.start_time,
                    end: b.end_time,
                    color: b.type === 'habit'
                      ? habits.find((habit) => habit.id === b.habit_id)?.color?.trim() || lifeTheme.colors.alert
                      : b.task_id
                        ? getTaskAccent(tasks.find((t) => t.id === b.task_id), lifeTheme)
                        : lifeTheme.colors.muted,
                    kind: b.type === 'rest'
                      ? ('Descanso' as const)
                      : b.type === 'meal'
                        ? ('Comida' as const)
                        : b.type === 'sleep'
                          ? ('Sueño' as const)
                          : b.type === 'transit'
                            ? ('Tránsito' as const)
                            : b.type === 'habit'
                              ? ('Hábito' as const)
                              : ('Tarea' as const),
                    dotted: b.type !== 'task',
                    onPress: () => onOpenBlockInfo(b.id)
                  }))
                ]);

                return (
                  <View key={dayIdx} style={[styles.dayColWide, { width: dayColWidth }]}>
                    {hours.map((h) => (
                      <View key={h} style={[styles.slotCellWide, { height: hourHeight }]} />
                    ))}

                    {blocks.map((block) => {
                      const startMin = block.start.getHours() * 60 + block.start.getMinutes();
                      const endMin = block.end.getHours() * 60 + block.end.getMinutes();
                      const top = ((startMin - baseHour * 60) / 60) * hourHeight;
                      const rawHeight = ((Math.max(endMin, startMin + 15) - startMin) / 60) * hourHeight;
                      const height = Math.max(32, rawHeight);
                      const laneWidth = 100 / block.laneCount;
                      const leftPct = block.lane * laneWidth;
                      const widthPct = block.spanLanes * laneWidth;
                      const isTiny = height < 38;
                      const isShort = height < 54;
                      const isNarrow = widthPct < 56;
                      const showMeta = !isTiny && !(isShort && isNarrow);
                      const titleLines = isTiny || isNarrow ? 1 : 2;

                      if (top + height < 0 || top > hours.length * hourHeight) return null;

                      return (
                        <Pressable
                          key={block.id}
                          style={[
                            styles.weekBlockCard,
                            {
                              top,
                              height,
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              borderLeftColor: block.color,
                              borderStyle: block.dotted ? 'dashed' : 'solid',
                              backgroundColor: block.dotted ? `${block.color}14` : lifeTheme.colors.surface
                            }
                          ]}
                          onPress={block.onPress}
                        >
                          {showMeta && <Text style={styles.weekBlockMetaPill}>{fmt(block.start)} - {fmt(block.end)}</Text>}
                          <Text style={[styles.weekBlockTitle, !showMeta && styles.weekBlockTitleCompact]} numberOfLines={titleLines}>{block.title}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const MemoWeekView = memo(WeekView);


// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ date, tasks, habits, events, timeline, onOpenEventInfo, onOpenBlockInfo }: {
  date: Date; tasks: Task[]; habits: ReturnType<typeof useLifeStore.getState>['habits']; events: StaticEvent[]; timeline: ScheduleBlock[]; onOpenEventInfo: (id: string) => void; onOpenBlockInfo: (id: string) => void;
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);
  const hourHeight = 56;
  const baseHour = 6;

  const dayEvents = getEventsForDate(events, date);
  const dayTimelineTasks = timeline.filter((b) => sameDay(b.start_time, date));

  const blocks = assignOverlapLanes([
    ...dayEvents.map((e) => ({
      id: `evt-${e.id}`,
      title: e.title,
      start: e.startTime,
      end: e.endTime,
      color: getEventAccent(e, lifeTheme),
      kind: 'Evento' as const,
      dotted: true,
      onPress: () => onOpenEventInfo(e.id)
    })),
    ...dayTimelineTasks.map((b) => ({
      id: `tsk-${b.id}`,
      title: b.title,
      start: b.start_time,
      end: b.end_time,
      color: b.type === 'habit'
        ? habits.find((habit) => habit.id === b.habit_id)?.color?.trim() || lifeTheme.colors.alert
        : b.task_id
          ? getTaskAccent(tasks.find((t) => t.id === b.task_id), lifeTheme)
          : lifeTheme.colors.muted,
      kind: b.type === 'rest'
        ? ('Descanso' as const)
        : b.type === 'meal'
          ? ('Comida' as const)
          : b.type === 'sleep'
            ? ('Sueño' as const)
            : b.type === 'transit'
              ? ('Tránsito' as const)
              : b.type === 'habit'
                ? ('Hábito' as const)
                : ('Tarea' as const),
      dotted: b.type !== 'task',
      onPress: () => onOpenBlockInfo(b.id)
    }))
  ]);

  return (
    <ScrollView style={styles.dayTimelineScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.dayLegendRow}>
        <View style={styles.dayLegendItem}>
          <View style={[styles.dayLegendDot, { backgroundColor: lifeTheme.colors.primary }]} />
          <Text style={styles.dayLegendText}>Tarea</Text>
        </View>
        <View style={styles.dayLegendItem}>
          <View style={[styles.dayLegendDot, { backgroundColor: lifeTheme.colors.primary, opacity: 0.7 }]} />
          <Text style={styles.dayLegendText}>Evento</Text>
        </View>
        <View style={styles.dayLegendItem}>
          <View style={[styles.dayLegendDot, { backgroundColor: lifeTheme.colors.muted }]} />
          <Text style={styles.dayLegendText}>Descanso</Text>
        </View>
        <View style={styles.dayLegendItem}>
          <View style={[styles.dayLegendDot, { backgroundColor: lifeTheme.colors.alert }]} />
          <Text style={styles.dayLegendText}>Hábito</Text>
        </View>
      </View>

      <View style={styles.dayTimelineWrapper}>
        <View style={styles.dayHourCol}>
          {hours.map((h) => (
            <View key={h} style={[styles.dayHourLabelCell, { height: hourHeight }]}>
              <Text style={styles.hourLabelText}>{String(h).padStart(2, '0')}:00</Text>
            </View>
          ))}
        </View>

        <View style={[styles.dayBlocksCanvas, { height: hours.length * hourHeight }]}>
          {hours.map((h) => (
            <View key={h} style={[styles.dayHourLine, { top: (h - baseHour) * hourHeight }]} />
          ))}

          {blocks.map((block) => {
            const startMin = block.start.getHours() * 60 + block.start.getMinutes();
            const endMin = block.end.getHours() * 60 + block.end.getMinutes();
            const top = ((startMin - baseHour * 60) / 60) * hourHeight;
            const rawHeight = ((Math.max(endMin, startMin + 15) - startMin) / 60) * hourHeight;
            const height = Math.max(34, rawHeight);
            const laneWidth = 100 / block.laneCount;
            const leftPct = block.lane * laneWidth;
            const widthPct = block.spanLanes * laneWidth;
            const isTiny = height < 42;
            const isShort = height < 64;
            const isNarrow = widthPct < 52;
            const showMeta = !isTiny && !(isShort && isNarrow);
            const titleLines = isTiny || isNarrow ? 1 : 2;

            if (top + height < 0 || top > hours.length * hourHeight) return null;

            return (
              <Pressable
                key={block.id}
                style={[
                  styles.dayBlockCard,
                  {
                    top,
                    height,
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    borderLeftColor: block.color,
                    borderStyle: block.dotted ? 'dashed' : 'solid',
                    backgroundColor: block.dotted ? `${block.color}14` : lifeTheme.colors.surface
                  }
                ]}
                onPress={block.onPress}
              >
                {showMeta && <Text style={styles.dayBlockMetaPill}>{fmt(block.start)} - {fmt(block.end)}</Text>}
                <Text style={[styles.dayBlockTitle, !showMeta && styles.dayBlockTitleCompact]} numberOfLines={titleLines}>{block.title}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const MemoDayView = memo(DayView);

function fmt(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Add/Edit Event Modal ──────────────────────────────────────────────────────────

function EventModal({ 
  visible, editId, onClose, showAlert
}: { 
  visible: boolean; editId?: string | null; onClose: () => void; 
  showAlert: ShowAlertFn;
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const addEvent = useLifeStore(s => s.addEvent);
  const updateEvent = useLifeStore(s => s.updateEvent);
  const deleteEvent = useLifeStore(s => s.deleteEvent);
  const events = useLifeStore(s => s.events);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('📌');
  const [color, setColor] = useState('');
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
        setDescription(e.description ?? '');
        setEmoji(e.emoji ?? '📌');
        setColor(e.color ?? '');
        setStartTime(e.startTime);
        setEndTime(e.endTime);
        setRemindMin(e.reminderMinutes || 0);
        setFrequency(e.recurrence?.frequency || 'none');
        setDaysOfWeek(e.recurrence?.daysOfWeek || []);
        setEndDate(e.recurrence?.endDate ? new Date(e.recurrence.endDate) : null);
      }
    } else if (visible) {
      setTitle('');
      setDescription('');
      setEmoji('📌');
      setColor('');
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
      showAlert('Faltan datos', 'El título y las horas son obligatorios.');
      return;
    }
    if (endTime <= startTime) {
      showAlert('Error', 'La hora de fin debe ser posterior a la de inicio.');
      return;
    }

    const payload: any = {
      title: title.trim(),
      description: description.trim() || undefined,
      emoji: emoji.trim() || undefined,
      color: color.trim() || undefined,
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
    showAlert('Eliminar Evento', '¿Estás seguro de que quieres eliminar este evento?', [
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

          <Text style={styles.modalLabel}>Descripción (opcional)</Text>
          <TextInput
            style={[styles.modalInput, { height: 82, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Notas del evento, contexto o detalles"
            placeholderTextColor={lifeTheme.colors.muted}
            multiline
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalLabel}>Emoji</Text>
              <TextInput
                style={styles.modalInput}
                value={emoji}
                onChangeText={(v) => setEmoji(v.slice(0, 2))}
                placeholder="📌"
                placeholderTextColor={lifeTheme.colors.muted}
                maxLength={2}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalLabel}>Color</Text>
              <TextInput
                style={styles.modalInput}
                value={color}
                onChangeText={setColor}
                placeholder="#8FBF00"
                placeholderTextColor={lifeTheme.colors.muted}
                autoCapitalize="characters"
              />
            </View>
          </View>

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
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tasks = useLifeStore((s) => s.tasks);
  const events = useLifeStore((s) => s.events);
  const timeline = useLifeStore((s) => s.timeline);
  const habits = useLifeStore((s) => s.habits);
  const logHabit = useLifeStore((s) => s.logHabit);
  const deleteTask = useLifeStore((s) => s.deleteTask);
  const deleteEvent = useLifeStore((s) => s.deleteEvent);
  const deleteBlock = useLifeStore((s) => s.deleteBlock);

  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { alertState, showAlert, hideAlert } = useCustomAlert();

  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== 'completed'), [tasks]);

  function onAddEvent() {
    setEditingId(null);
    setModalVisible(true);
  }

  function openTaskEditor(taskId: string) {
    useLifeStore.setState({ pendingTaskEditId: taskId });
    router.push('/(tabs)/pool' as any);
  }

  function openTaskInfo(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const emoji = getTaskEmoji(task);
    const color = getTaskAccent(task, lifeTheme);
    showAlert(
      `${emoji} ${task.title}`,
      buildBlockInfoMessage({
        kind: 'task',
        title: task.title,
        start: task.fixed_start,
        end: task.fixed_end,
        description: task.description,
        emoji,
        color,
        task
      }),
      [
        { text: 'Editar', onPress: () => openTaskEditor(task.id) },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteTask(task.id) },
        { text: 'Hecho', style: 'cancel' }
      ]
    );
  }

  function openEventInfo(eventId: string) {
    const event = events.find((item) => item.id === eventId);
    if (!event) return;
    const emoji = getEventEmoji(event);
    const color = getEventAccent(event, lifeTheme);
    showAlert(
      `${emoji} ${event.title}`,
      buildBlockInfoMessage({
        kind: 'event',
        title: event.title,
        start: event.startTime,
        end: event.endTime,
        description: event.description,
        location: event.location,
        emoji,
        color,
        event
      }),
      [
        { text: 'Editar', onPress: () => { setEditingId(event.id); setModalVisible(true); } },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteEvent(event.id) },
        { text: 'Hecho', style: 'cancel' }
      ]
    );
  }

  function openBlockInfo(blockId: string) {
    const block = timeline.find((item) => item.id === blockId);
    if (!block) return;

    const task = block.task_id ? tasks.find((item) => item.id === block.task_id) ?? null : null;
    const habit = block.habit_id ? habits.find((item) => item.id === block.habit_id) ?? null : null;
    const event = block.isStaticEvent ? events.find((item) => item.id === block.id) ?? null : null;
    const emoji = task
      ? getTaskEmoji(task)
      : habit
        ? habit.emoji || '🌱'
        : event
          ? getEventEmoji(event)
          : block.type === 'sleep'
            ? '🌙'
            : block.type === 'transit'
              ? '🚗'
              : block.type === 'meal'
                ? '🍽'
                : block.type === 'rest'
                  ? '☕'
                  : '⚡';
    const color = task
      ? getTaskAccent(task, lifeTheme)
      : habit
        ? habit.color?.trim() || lifeTheme.colors.alert
        : event
          ? getEventAccent(event, lifeTheme)
          : lifeTheme.colors.muted;
    const kind = block.type === 'meal'
      ? 'meal'
      : block.type === 'sleep'
        ? 'sleep'
        : block.type === 'transit'
          ? 'transit'
          : block.type === 'task'
            ? 'task'
            : block.type === 'habit'
              ? 'habit'
              : 'rest';

    showAlert(
      `${emoji} ${block.title}`,
      buildBlockInfoMessage({
        kind,
        title: block.title,
        start: block.start_time,
        end: block.end_time,
        description: task?.description,
        emoji,
        color,
        task,
        event
      }),
      block.task_id && task
        ? [
            { text: 'Editar', onPress: () => openTaskEditor(task.id) },
            { text: 'Eliminar', style: 'destructive', onPress: () => deleteTask(task.id) },
            { text: 'Hecho', style: 'cancel' }
          ]
        : habit
          ? [
              { text: 'Ir a hábitos', onPress: () => router.push('/(tabs)/habits' as any) },
              { text: 'Marcar hecho hoy', onPress: () => logHabit(habit.id, 1) },
              { text: 'Hecho', style: 'cancel' }
            ]
        : block.isStaticEvent && event
          ? [
              { text: 'Editar', onPress: () => { setEditingId(event.id); setModalVisible(true); } },
              { text: 'Eliminar', style: 'destructive', onPress: () => deleteEvent(event.id) },
              { text: 'Hecho', style: 'cancel' }
            ]
          : [
              { text: 'Editar', onPress: () => router.push('/(tabs)/routines' as any) },
              { text: 'Eliminar', style: 'destructive', onPress: () => deleteBlock(block.id) },
              { text: 'Hecho', style: 'cancel' }
            ]
    );
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

  const titleText = useMemo(() => headerTitle(), [view, currentDate]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 4 }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.navBtn} onPress={() => navigate(-1)} accessibilityRole="button" accessibilityLabel="Ir al periodo anterior">
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{titleText}</Text>
        <Pressable style={styles.navBtn} onPress={() => navigate(1)} accessibilityRole="button" accessibilityLabel="Ir al siguiente periodo">
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
            accessibilityRole="button"
            accessibilityLabel={`Cambiar a vista ${v === 'month' ? 'mes' : v === 'week' ? 'semana' : 'dia'}`}
          >
            <Text style={[styles.viewTabText, view === v && styles.viewTabTextActive]}>
              {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : 'Día'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Calendar body */}
      <View style={[styles.calBody, view === 'month' && styles.calBodyMonth]}>
        {view === 'month' && (
          <MemoMonthView
            currentDate={currentDate}
            selectedDay={selectedDay}
            tasks={activeTasks}
            events={events}
            onSelectDay={setSelectedDay}
          />
        )}
        {view === 'week' && (
          <MemoWeekView
            currentDate={currentDate}
            tasks={activeTasks}
            habits={habits}
            events={events}
            timeline={timeline}
            onSelectDay={setSelectedDay}
            onOpenEventInfo={openEventInfo}
            onOpenBlockInfo={openBlockInfo}
          />
        )}
        {view === 'day' && (
          <MemoDayView
            date={currentDate}
            tasks={activeTasks}
            habits={habits}
            events={events}
            timeline={timeline}
            onOpenEventInfo={openEventInfo}
            onOpenBlockInfo={openBlockInfo}
          />
        )}
      </View>

      {/* Selected day info */}
      {view !== 'day' && (
        <View style={styles.dayPanelWrap}>
          <MemoDayTasksPanel
            date={selectedDay}
            tasks={activeTasks}
            events={events}
            onOpenEventInfo={openEventInfo}
            onOpenTaskInfo={openTaskInfo}
          />
        </View>
      )}

      {/* FAB */}
      <Pressable style={[styles.fab, { bottom: 16 }]} onPress={onAddEvent} accessibilityRole="button" accessibilityLabel="Crear nuevo evento fijo">
        <Text style={styles.fabText}>+ Evento</Text>
      </Pressable>

      <EventModal
        visible={modalVisible}
        editId={editingId}
        onClose={() => setModalVisible(false)}
        showAlert={showAlert}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: lifeTheme.spacing.md + 2,
    paddingVertical: lifeTheme.spacing.sm + 2
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
  headerTitle: { color: lifeTheme.colors.text, fontSize: lifeTheme.typography.body, fontWeight: '800', textTransform: 'capitalize' },
  viewSelector: {
    flexDirection: 'row',
    marginHorizontal: lifeTheme.spacing.md + 2,
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    marginBottom: 8
  },
  viewTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  viewTabActive: { backgroundColor: lifeTheme.colors.primary },
  viewTabText: { color: lifeTheme.colors.muted, fontSize: lifeTheme.typography.bodySm, fontWeight: '700' },
  viewTabTextActive: { color: lifeTheme.colors.onPrimary },
  calBody: { flex: 1 },
  calBodyMonth: { flex: 0 },
  // Month
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingBottom: 10 },
  weekdayHeader: { width: '14.28%', alignItems: 'center', paddingVertical: 7 },
  weekdayText: { color: lifeTheme.colors.muted, fontSize: lifeTheme.typography.bodySm, fontWeight: '700' },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 5,
    borderRadius: 10,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'transparent'
  },
  dayCellToday: { backgroundColor: `${lifeTheme.colors.primary}22` },
  dayCellSelected: { backgroundColor: lifeTheme.colors.primary, borderColor: `${lifeTheme.colors.onPrimary}44` },
  dayCellText: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '600' },
  dayCellTextToday: { color: lifeTheme.colors.primary, fontWeight: '800' },
  dayCellTextSelected: { color: lifeTheme.colors.onPrimary, fontWeight: '800' },
  dayIndicatorsSlot: { minHeight: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  calDot: { width: 5, height: 5, borderRadius: 3 },
  // Week Vertical
  weekContainer: { flex: 1 },
  weekHdrRowWide: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: lifeTheme.colors.border, paddingBottom: 8 },
  hourColSpacerWide: { width: 52 },
  weekHdrCellWide: { alignItems: 'center' },
  weekHdrDay: { color: lifeTheme.colors.muted, fontSize: 10, fontWeight: '700' },
  weekHdrNum: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '800' },
  weekGridScroll: { flex: 1 },
  weekGridBodyWide: { flexDirection: 'row' },
  hourColWide: { width: 52 },
  hourLabelCellWide: { justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: lifeTheme.colors.border },
  hourLabelText: { color: lifeTheme.colors.muted, fontSize: 10, fontWeight: '700' },
  dayColWide: { borderRightWidth: 1, borderRightColor: `${lifeTheme.colors.border}44`, position: 'relative' },
  slotCellWide: { borderBottomWidth: 1, borderBottomColor: `${lifeTheme.colors.border}22` },
  weekBlockCard: {
    position: 'absolute',
    left: 6,
    right: 6,
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    borderLeftWidth: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: 'hidden'
  },
  weekBlockTitle: { color: lifeTheme.colors.text, fontSize: 11, fontWeight: '800', lineHeight: 13, marginTop: 4 },
  weekBlockTitleCompact: { marginTop: 0, lineHeight: 12 },
  weekBlockMetaPill: {
    color: lifeTheme.colors.text,
    fontSize: 10,
    fontWeight: '700',
    alignSelf: 'flex-start',
    backgroundColor: `${lifeTheme.colors.border}55`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  // View switches...

  weekDayNum: { color: lifeTheme.colors.text, fontSize: 18, fontWeight: '800' },
  weekDayNumToday: { color: lifeTheme.colors.onPrimary },
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
  dayTimelineScroll: { flex: 1, paddingHorizontal: 12 },
  dayLegendRow: { flexDirection: 'row', gap: 12, marginBottom: 8, marginTop: 2, flexWrap: 'wrap' },
  dayLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayLegendDot: { width: 8, height: 8, borderRadius: 4 },
  dayLegendText: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '700' },
  dayTimelineWrapper: { flexDirection: 'row' },
  dayHourCol: { width: 52 },
  dayHourLabelCell: { justifyContent: 'flex-start', alignItems: 'center', paddingTop: 4 },
  dayBlocksCanvas: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: 1,
    borderLeftColor: lifeTheme.colors.border
  },
  dayHourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: `${lifeTheme.colors.border}44`
  },
  dayBlockCard: {
    position: 'absolute',
    left: 8,
    right: 10,
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    borderLeftWidth: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    overflow: 'hidden'
  },
  dayBlockTitle: { color: lifeTheme.colors.text, fontSize: 12, fontWeight: '800', lineHeight: 15, marginTop: 4 },
  dayBlockTitleCompact: { marginTop: 0, lineHeight: 13 },
  dayBlockMetaPill: {
    color: lifeTheme.colors.text,
    fontSize: 10,
    fontWeight: '700',
    alignSelf: 'flex-start',
    backgroundColor: `${lifeTheme.colors.border}55`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  // Day panel
  dayPanelWrap: { marginTop: 8 },
  dayPanel: {
    backgroundColor: lifeTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: lifeTheme.colors.border,
    padding: 16,
    gap: 10,
    flex: 1,
    minHeight: 210
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
  saveBtnText: { color: lifeTheme.colors.onPrimary, fontWeight: '800' },
  
  dateBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: lifeTheme.colors.surfaceAlt, borderColor: lifeTheme.colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  dateBtnText: { color: lifeTheme.colors.muted, fontSize: 13, flex: 1 },
  dateBtnTextActive: { color: lifeTheme.colors.text, fontWeight: '600' },
  dateClear: { color: lifeTheme.colors.alert, fontSize: 16, paddingLeft: 8 },

  // FAB
  fab: { position: 'absolute', right: 20, backgroundColor: lifeTheme.colors.primary, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 30, elevation: 5, shadowColor: '#000', shadowOffset: {width:0, height:3}, shadowOpacity: 0.3, shadowRadius: 5 },
  fabText: { color: lifeTheme.colors.onPrimary, fontWeight: '900', fontSize: 14 },

  freqChip: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: lifeTheme.colors.border, backgroundColor: lifeTheme.colors.surfaceAlt },
  freqChipActive: { backgroundColor: lifeTheme.colors.primary, borderColor: lifeTheme.colors.primary },
  freqChipText: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '700' },
  freqChipTextActive: { color: lifeTheme.colors.onPrimary },

  daySelectChip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border, backgroundColor: lifeTheme.colors.surfaceAlt },
  daySelectChipActive: { backgroundColor: lifeTheme.colors.primary, borderColor: lifeTheme.colors.primary },
  daySelectText: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '700' },
  daySelectTextActive: { color: lifeTheme.colors.onPrimary }
  });
}
