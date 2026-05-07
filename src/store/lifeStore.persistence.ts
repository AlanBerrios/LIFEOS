import type { Alarm, DailyEnergyReport, DailyRoutine, DailySession, Habit, LifeTimer, QuickNote, ScheduleBlock, StaticEvent, Task, TravelLog } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { createId } from '../utils/ids';
import type { LifeStore } from './lifeStore.types';

const VALID_TASK_STATUSES = new Set<Task['status']>([
  'pool',
  'scheduled',
  'completed',
  'in_progress',
  'skipped',
  'postponed'
]);

const VALID_TASK_URGENCIES = new Set<Task['urgency']>([
  'today',
  'this_week',
  'this_month',
  'someday'
]);

function asArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function asObject<T extends object>(value: unknown, fallback: T): T {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? ({ ...fallback, ...(value as Partial<T>) } as T)
    : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Math.round(asNumber(value, fallback));
  return Math.min(max, Math.max(min, numeric));
}

function safeDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const parsed = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function safeDateRequired(value: unknown, fallback: Date = new Date()): Date {
  return safeDate(value) ?? fallback;
}

function asTaskStatus(value: unknown): Task['status'] {
  return typeof value === 'string' && VALID_TASK_STATUSES.has(value as Task['status'])
    ? (value as Task['status'])
    : 'pool';
}

function asTaskUrgency(value: unknown): Task['urgency'] {
  return typeof value === 'string' && VALID_TASK_URGENCIES.has(value as Task['urgency'])
    ? (value as Task['urgency'])
    : 'someday';
}

function reviveAlarm(alarm: Alarm): Alarm {
  const safeDays = asArray((alarm as any).days, [1, 2, 3, 4, 5])
    .map((day) => clampInt(day, 0, 6, 1))
    .filter((day, index, source) => source.indexOf(day) === index);

  const safeNotificationIds = asArray<unknown>((alarm as any).notificationIds, [])
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  return {
    ...alarm,
    id: asString((alarm as any).id, createId('alarm')),
    time: asString((alarm as any).time, '07:00'),
    label: asString((alarm as any).label, 'Alarma'),
    days: safeDays.length > 0 ? safeDays : [1, 2, 3, 4, 5],
    enabled: Boolean((alarm as any).enabled),
    notificationIds: safeNotificationIds
  };
}

function revivePendingScheduleOverflow(
  prompt: LifeStore['pending_schedule_overflow']
): LifeStore['pending_schedule_overflow'] {
  if (!prompt || typeof prompt !== 'object') return undefined;

  const candidateTasks = asArray((prompt as any).candidateTasks, []).map((candidate: any) => ({
    id: asString(candidate?.id, createId('task')),
    title: asString(candidate?.title, 'Tarea'),
    priority: clampInt(candidate?.priority, 1, 5, 3) as 1 | 2 | 3 | 4 | 5,
    urgency: asTaskUrgency(candidate?.urgency),
    eta_minutes: Math.max(1, clampInt(candidate?.eta_minutes, 1, 24 * 60, 30)),
    cognitive_load: clampInt(candidate?.cognitive_load, 1, 10, 5),
    deadline: safeDate(candidate?.deadline)
  }));

  if (candidateTasks.length === 0) return undefined;

  const recommendedTaskIds = asArray<unknown>((prompt as any).recommendedTaskIds, [])
    .filter((taskId): taskId is string => typeof taskId === 'string' && taskId.length > 0);

  return {
    visible: Boolean((prompt as any).visible),
    reason: asString((prompt as any).reason, 'No cabe todo hoy.'),
    createdAt: safeDateRequired((prompt as any).createdAt),
    candidateTasks,
    recommendedTaskIds,
    maxSelections: clampInt((prompt as any).maxSelections, 0, candidateTasks.length, Math.min(3, candidateTasks.length))
  };
}

function reviveGlobalAlert(alert: LifeStore['global_alert']): LifeStore['global_alert'] {
  if (!alert || typeof alert !== 'object') return undefined;

  const safeButtons = asArray((alert as any).buttons, [])
    .map((button: any) => ({
      text: asString(button?.text, 'OK'),
      style: button?.style === 'cancel' || button?.style === 'destructive' ? button.style : 'default'
    }))
    .filter((button) => button.text.length > 0);

  return {
    visible: Boolean((alert as any).visible),
    title: asString((alert as any).title, ''),
    message: asOptionalString((alert as any).message),
    buttons: safeButtons.length > 0 ? safeButtons : [{ text: 'OK', style: 'default' }]
  };
}

function reviveHabit(habit: Habit): Habit {
  const logs = Array.isArray(habit.logs) ? habit.logs : [];
  return {
    ...habit,
    id: asString((habit as any).id, createId('habit')),
    name: asString((habit as any).name, 'Hábito'),
    emoji: asString((habit as any).emoji, '✅'),
    goalValue: Math.max(0, asNumber((habit as any).goalValue, 1)),
    goalUnit: asString((habit as any).goalUnit, 'check'),
    streak: Math.max(0, clampInt((habit as any).streak, 0, 5000, 0)),
    lastCompletedDate: asOptionalString((habit as any).lastCompletedDate),
    color: asOptionalString((habit as any).color),
    logs: logs.map((log) => ({
      ...log,
      value: asNumber((log as any).value, 1),
      timestamp: safeDateRequired((log as any).timestamp)
    }))
  };
}

function reviveNote(note: QuickNote): QuickNote {
  return {
    ...note,
    id: asString((note as any).id, createId('note')),
    title: asString((note as any).title, 'Nota'),
    content: asString((note as any).content, ''),
    emoji: asOptionalString((note as any).emoji),
    color: asOptionalString((note as any).color),
    reminderAt: asOptionalString((note as any).reminderAt),
    createdAt: safeDateRequired((note as any).createdAt)
  };
}

function reviveEvent(event: StaticEvent): StaticEvent {
  return {
    ...event,
    id: asString((event as any).id, createId('event')),
    title: asString((event as any).title, 'Evento'),
    description: asOptionalString((event as any).description),
    emoji: asOptionalString((event as any).emoji),
    color: asOptionalString((event as any).color),
    location: asOptionalString((event as any).location),
    reminderMinutes: Math.max(0, clampInt((event as any).reminderMinutes, 0, 24 * 60, 0)),
    startTime: safeDateRequired((event as any).startTime),
    endTime: safeDateRequired((event as any).endTime),
    recurrence: event.recurrence
      ? {
          ...event.recurrence,
          endDate: safeDate(event.recurrence.endDate)
        }
      : event.recurrence
  };
}

function reviveRoutine(routine: DailyRoutine): DailyRoutine {
  const meals = Array.isArray(routine.meals) ? routine.meals : [];
  const transits = Array.isArray(routine.transits) ? routine.transits : [];
  return {
    ...routine,
    dayOfWeek: clampInt((routine as any).dayOfWeek, 0, 6, 0),
    sleepStart: asString((routine as any).sleepStart, '23:00'),
    sleepEnd: asString((routine as any).sleepEnd, '07:00'),
    meals: meals.map((meal) => ({
      ...meal,
      id: asString((meal as any).id, createId('meal')),
      type: asString((meal as any).type, 'comida'),
      time: asString((meal as any).time, '13:00'),
      durationMinutes: Math.max(1, clampInt((meal as any).durationMinutes, 1, 8 * 60, 30))
    })),
    transits: transits.map((transit) => ({
      ...transit,
      id: asString((transit as any).id, createId('transit')),
      label: asString((transit as any).label, 'Traslado'),
      time: asString((transit as any).time, '08:00'),
      durationMinutes: Math.max(1, clampInt((transit as any).durationMinutes, 1, 8 * 60, 30)),
      arrivalTime: asOptionalString((transit as any).arrivalTime)
    }))
  };
}

function reviveTravelLog(log: TravelLog): TravelLog {
  return {
    ...log,
    id: asString((log as any).id, createId('travel')),
    timestamp: safeDateRequired((log as any).timestamp)
  };
}

function reviveTask(task: Task): Task {
  const rawCreatedAt = (task as any).created_at;
  const fallbackCreatedAt = new Date();
  const rawStatus = asTaskStatus((task as any).status);
  return {
    ...task,
    id: asString((task as any).id, createId('task')),
    title: asString((task as any).title, 'Tarea sin título'),
    description: asOptionalString((task as any).description),
    emoji: asOptionalString((task as any).emoji),
    color: asOptionalString((task as any).color),
    eta_minutes: Math.max(1, clampInt((task as any).eta_minutes, 1, 24 * 60, 30)),
    priority: clampInt((task as any).priority, 1, 5, 3) as Task['priority'],
    cognitive_load: clampInt((task as any).cognitive_load, 1, 10, 5),
    urgency: asTaskUrgency((task as any).urgency),
    status: rawStatus,
    created_at: safeDateRequired(rawCreatedAt, fallbackCreatedAt),
    deadline: safeDate((task as any).deadline),
    fixed_start: safeDate((task as any).fixed_start),
    fixed_end: safeDate((task as any).fixed_end)
  };
}

function reviveBlock(block: ScheduleBlock): ScheduleBlock {
  const type = asString((block as any).type, 'task') as ScheduleBlock['type'];
  return {
    ...block,
    id: asString((block as any).id, createId('block')),
    type,
    task_id: asOptionalString((block as any).task_id),
    habit_id: asOptionalString((block as any).habit_id),
    title: asString((block as any).title, type === 'rest' ? 'Descanso' : 'Bloque'),
    start_time: safeDateRequired((block as any).start_time),
    end_time: safeDateRequired((block as any).end_time),
    cognitive_drain: asNumber((block as any).cognitive_drain, 0),
    pinned: Boolean((block as any).pinned),
    isStaticEvent: Boolean((block as any).isStaticEvent),
    isRoutineBlock: Boolean((block as any).isRoutineBlock),
    isCompletedGhost: Boolean((block as any).isCompletedGhost),
    routineBlockKey: asOptionalString((block as any).routineBlockKey),
    isSoftBlock: Boolean((block as any).isSoftBlock)
  };
}

function reviveExecutionRecord(record: any) {
  return {
    ...record,
    planned_start: safeDateRequired(record.planned_start),
    planned_end: safeDateRequired(record.planned_end),
    actual_start: safeDate(record.actual_start),
    actual_end: safeDate(record.actual_end),
    postponed_until: safeDate(record.postponed_until),
    created_at: safeDateRequired(record.created_at)
  };
}

function reviveReplanDecision(decision: any) {
  return {
    ...decision,
    timestamp: safeDateRequired(decision.timestamp)
  };
}

function reviveSchedulerParity(parity: LifeStore['last_scheduler_parity']) {
  if (!parity) return parity;
  return {
    ...parity,
    checkedAt: safeDateRequired(parity.checkedAt)
  };
}

function reviveDailyEnergyReport(report: DailyEnergyReport): DailyEnergyReport {
  return {
    ...report,
    created_at: safeDateRequired(report.created_at)
  };
}

function reviveEnergyTelemetry(telemetry: DailyEnergyReport['telemetry']): DailyEnergyReport['telemetry'] {
  if (!telemetry) return telemetry;
  return {
    ...telemetry,
    evaluatedAt: safeDateRequired(telemetry.evaluatedAt)
  };
}

function reviveTransitArrivalRecord(record: LifeStore['transit_arrival_records'][number]): LifeStore['transit_arrival_records'][number] {
  return {
    ...record,
    plannedStart: safeDateRequired(record.plannedStart),
    plannedEnd: safeDateRequired(record.plannedEnd),
    actualArrivalTime: safeDateRequired(record.actualArrivalTime)
  };
}

function revivePendingTransitArrivalPrompt(
  prompt: LifeStore['pending_transit_arrival_prompt']
): LifeStore['pending_transit_arrival_prompt'] {
  if (!prompt) return prompt;
  return {
    ...prompt,
    plannedStart: safeDateRequired(prompt.plannedStart),
    plannedEnd: safeDateRequired(prompt.plannedEnd)
  };
}

function reviveTimer(timer: LifeTimer | null): LifeTimer | null {
  if (!timer) {
    return null;
  }

  const revived: LifeTimer = {
    ...timer,
    startedAt: safeDateRequired(timer.startedAt),
    endsAt: safeDateRequired(timer.endsAt)
  };

  return revived.endsAt.getTime() <= Date.now() ? null : revived;
}

function reviveUserProfile(snapshotProfile: LifeStore['userProfile'] | undefined, currentProfile: LifeStore['userProfile']): LifeStore['userProfile'] {
  const source = snapshotProfile ?? currentProfile;
  const consistency = source.consistency ?? currentProfile.consistency;
  const sourceBadges = Array.isArray(source.badges) ? source.badges : currentProfile.badges;
  const badges = sourceBadges.map((badge) => ({
    ...badge,
    unlockedAt: safeDateRequired(badge.unlockedAt)
  }));

  return {
    ...currentProfile,
    ...source,
    skills: {
      ...currentProfile.skills,
      ...(source.skills ?? {})
    },
    consistency: {
      currentStreak: consistency.currentStreak ?? 0,
      bestStreak: consistency.bestStreak ?? 0,
      totalActiveDays: consistency.totalActiveDays ?? 0,
      lastActiveDate: consistency.lastActiveDate
    },
    badges
  };
}

export function createDefaultRoutines(): DailyRoutine[] {
  return Array.from({ length: 7 }).map((_, index) => ({
    dayOfWeek: index,
    sleepStart: '23:00',
    sleepEnd: '07:00',
    meals: [
      { id: createId('meal'), type: 'desayuno', time: '08:00', durationMinutes: 30 },
      { id: createId('meal'), type: 'almuerzo', time: '13:30', durationMinutes: 60 }
    ],
    transits: []
  }));
}

export const DEFAULT_HABITS: Habit[] = [
  { id: createId('habit'), name: 'Tomar agua', emoji: '💧', goalValue: 2, goalUnit: 'litros', logs: [], streak: 0, color: '#38bdf8' },
  { id: createId('habit'), name: 'Hacer ejercicio', emoji: '💪', goalValue: 30, goalUnit: 'min', logs: [], streak: 0, color: '#fb7185' },
  { id: createId('habit'), name: 'Estudiar', emoji: '📚', goalValue: 60, goalUnit: 'min', logs: [], streak: 0, color: '#818cf8' },
  { id: createId('habit'), name: 'Caminar 5km', emoji: '🚶', goalValue: 5, goalUnit: 'km', logs: [], streak: 0, color: '#4ade80' }
];

export function revivePersistedState(
  persistedState: Partial<LifeStore> | undefined,
  currentState: LifeStore
): LifeStore {
  const snapshot = asObject<Partial<LifeStore>>(persistedState, {} as Partial<LifeStore>);
  const safeSettings = asObject(snapshot.settings, currentState.settings);
  const safePendingCompletion = snapshot.pending_completion_check && typeof snapshot.pending_completion_check === 'object'
    ? snapshot.pending_completion_check
    : undefined;

  return {
    ...currentState,
    tasks: asArray(snapshot.tasks, currentState.tasks).map(reviveTask),
    timeline: asArray(snapshot.timeline, currentState.timeline).map(reviveBlock),
    activeTimer: reviveTimer(snapshot.activeTimer ?? currentState.activeTimer),
    sessions: asArray(snapshot.sessions, currentState.sessions).map((session) => ({
      ...session,
      energy_reported: session.energy_reported
        ? {
            ...session.energy_reported,
            telemetry: reviveEnergyTelemetry(session.energy_reported.telemetry)
          }
        : session.energy_reported
    })) as DailySession[],
    settings: { ...DEFAULT_SETTINGS, ...safeSettings },
    habits: asArray(snapshot.habits, currentState.habits).map(reviveHabit),
    notes: asArray(snapshot.notes, currentState.notes).map(reviveNote),
    alarms: asArray(snapshot.alarms, currentState.alarms).map(reviveAlarm),
    events: asArray(snapshot.events, currentState.events).map(reviveEvent),
    routines: asArray(snapshot.routines, currentState.routines).map(reviveRoutine),
    routineOverrides: asArray(snapshot.routineOverrides, currentState.routineOverrides),
    completedGhostBlocks: asArray(snapshot.completedGhostBlocks, currentState.completedGhostBlocks).map(reviveBlock),
    habitReminderNotificationId: snapshot.habitReminderNotificationId ?? currentState.habitReminderNotificationId,
    travelLogs: asArray(snapshot.travelLogs, currentState.travelLogs).map(reviveTravelLog),
    userProfile: reviveUserProfile(snapshot.userProfile, currentState.userProfile),
    rest_days: asArray(snapshot.rest_days, currentState.rest_days),
    lastEngine: snapshot.lastEngine ?? currentState.lastEngine,
    lastSolverStatus: snapshot.lastSolverStatus ?? currentState.lastSolverStatus,
    isGenerating: snapshot.isGenerating ?? currentState.isGenerating,
    last_replan_reason: snapshot.last_replan_reason ?? currentState.last_replan_reason,
    replan_history: asArray(snapshot.replan_history, currentState.replan_history).map(reviveReplanDecision),
    last_scheduler_parity: reviveSchedulerParity(snapshot.last_scheduler_parity ?? currentState.last_scheduler_parity),
    daily_energy_reports: asArray(snapshot.daily_energy_reports, currentState.daily_energy_reports).map((report) => ({
      ...reviveDailyEnergyReport(report),
      telemetry: reviveEnergyTelemetry(report.telemetry)
    })),
    energy_suggested_task_ids: asArray(snapshot.energy_suggested_task_ids, currentState.energy_suggested_task_ids),
    energy_suggestion_bias: snapshot.energy_suggestion_bias ?? currentState.energy_suggestion_bias,
    transit_arrival_records: asArray(snapshot.transit_arrival_records, currentState.transit_arrival_records).map(reviveTransitArrivalRecord),
    pending_transit_arrival_prompt: revivePendingTransitArrivalPrompt(
      snapshot.pending_transit_arrival_prompt ?? currentState.pending_transit_arrival_prompt
    ),
    execution_records: asArray(snapshot.execution_records, currentState.execution_records).map(reviveExecutionRecord),
    pending_completion_check: safePendingCompletion
      ? {
          ...safePendingCompletion,
          timestamp: safeDateRequired(safePendingCompletion.timestamp)
        }
      : currentState.pending_completion_check,
    is_replanning: snapshot.is_replanning ?? currentState.is_replanning,
    replan_error: snapshot.replan_error ?? currentState.replan_error,
    pending_schedule_overflow: revivePendingScheduleOverflow(snapshot.pending_schedule_overflow),
    global_alert: reviveGlobalAlert(snapshot.global_alert),
    pendingTaskEditId: asOptionalString(snapshot.pendingTaskEditId)
  };
}

export function partializeLifeState(state: LifeStore): Partial<LifeStore> {
  return {
    tasks: state.tasks,
    timeline: state.timeline,
    activeTimer: state.activeTimer,
    sessions: state.sessions,
    settings: state.settings,
    habits: state.habits,
    notes: state.notes,
    alarms: state.alarms,
    events: state.events,
    routines: state.routines,
    routineOverrides: state.routineOverrides,
    completedGhostBlocks: state.completedGhostBlocks,
    habitReminderNotificationId: state.habitReminderNotificationId,
    travelLogs: state.travelLogs,
    userProfile: state.userProfile,
    rest_days: state.rest_days,
    lastEngine: state.lastEngine,
    lastSolverStatus: state.lastSolverStatus,
    isGenerating: state.isGenerating,
    last_replan_reason: state.last_replan_reason,
    replan_history: state.replan_history,
    last_scheduler_parity: state.last_scheduler_parity,
    daily_energy_reports: state.daily_energy_reports,
    energy_suggested_task_ids: state.energy_suggested_task_ids,
    energy_suggestion_bias: state.energy_suggestion_bias,
    transit_arrival_records: state.transit_arrival_records,
    pending_transit_arrival_prompt: state.pending_transit_arrival_prompt,
    execution_records: state.execution_records,
    pending_completion_check: state.pending_completion_check,
    is_replanning: state.is_replanning,
    replan_error: state.replan_error
  };
}
