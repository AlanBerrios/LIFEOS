import type { DailyEnergyReport, DailyRoutine, DailySession, Habit, LifeTimer, QuickNote, ScheduleBlock, StaticEvent, Task, TravelLog } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { toDate, toDateRequired } from '../utils/date';
import { createId } from '../utils/ids';
import type { LifeStore } from './lifeStore.types';

function reviveHabit(habit: Habit): Habit {
  return {
    ...habit,
    logs: habit.logs.map((log) => ({
      ...log,
      timestamp: toDateRequired(log.timestamp)
    }))
  };
}

function reviveNote(note: QuickNote): QuickNote {
  return {
    ...note,
    createdAt: toDateRequired(note.createdAt)
  };
}

function reviveEvent(event: StaticEvent): StaticEvent {
  return {
    ...event,
    startTime: toDateRequired(event.startTime),
    endTime: toDateRequired(event.endTime),
    recurrence: event.recurrence
      ? {
          ...event.recurrence,
          endDate: toDate(event.recurrence.endDate)
        }
      : event.recurrence
  };
}

function reviveRoutine(routine: DailyRoutine): DailyRoutine {
  return {
    ...routine,
    meals: (routine.meals ?? []).map((meal) => ({ ...meal })),
    transits: (routine.transits ?? []).map((transit) => ({ ...transit }))
  };
}

function reviveTravelLog(log: TravelLog): TravelLog {
  return {
    ...log,
    timestamp: toDateRequired(log.timestamp)
  };
}

function reviveTask(task: Task): Task {
  return {
    ...task,
    created_at: toDateRequired(task.created_at),
    deadline: toDate(task.deadline),
    fixed_start: toDate(task.fixed_start),
    fixed_end: toDate(task.fixed_end)
  };
}

function reviveBlock(block: ScheduleBlock): ScheduleBlock {
  return {
    ...block,
    start_time: toDateRequired(block.start_time),
    end_time: toDateRequired(block.end_time)
  };
}

function reviveExecutionRecord(record: any) {
  return {
    ...record,
    planned_start: toDateRequired(record.planned_start),
    planned_end: toDateRequired(record.planned_end),
    actual_start: toDate(record.actual_start),
    actual_end: toDate(record.actual_end),
    postponed_until: toDate(record.postponed_until),
    created_at: toDateRequired(record.created_at)
  };
}

function reviveReplanDecision(decision: any) {
  return {
    ...decision,
    timestamp: toDateRequired(decision.timestamp)
  };
}

function reviveSchedulerParity(parity: LifeStore['last_scheduler_parity']) {
  if (!parity) return parity;
  return {
    ...parity,
    checkedAt: toDateRequired(parity.checkedAt)
  };
}

function reviveDailyEnergyReport(report: DailyEnergyReport): DailyEnergyReport {
  return {
    ...report,
    created_at: toDateRequired(report.created_at)
  };
}

function reviveEnergyTelemetry(telemetry: DailyEnergyReport['telemetry']): DailyEnergyReport['telemetry'] {
  if (!telemetry) return telemetry;
  return {
    ...telemetry,
    evaluatedAt: toDateRequired(telemetry.evaluatedAt)
  };
}

function reviveTransitArrivalRecord(record: LifeStore['transit_arrival_records'][number]): LifeStore['transit_arrival_records'][number] {
  return {
    ...record,
    plannedStart: toDateRequired(record.plannedStart),
    plannedEnd: toDateRequired(record.plannedEnd),
    actualArrivalTime: toDateRequired(record.actualArrivalTime)
  };
}

function revivePendingTransitArrivalPrompt(
  prompt: LifeStore['pending_transit_arrival_prompt']
): LifeStore['pending_transit_arrival_prompt'] {
  if (!prompt) return prompt;
  return {
    ...prompt,
    plannedStart: toDateRequired(prompt.plannedStart),
    plannedEnd: toDateRequired(prompt.plannedEnd)
  };
}

function reviveTimer(timer: LifeTimer | null): LifeTimer | null {
  if (!timer) {
    return null;
  }

  const revived: LifeTimer = {
    ...timer,
    startedAt: toDateRequired(timer.startedAt),
    endsAt: toDateRequired(timer.endsAt)
  };

  return revived.endsAt.getTime() <= Date.now() ? null : revived;
}

function reviveUserProfile(snapshotProfile: LifeStore['userProfile'] | undefined, currentProfile: LifeStore['userProfile']): LifeStore['userProfile'] {
  const source = snapshotProfile ?? currentProfile;
  const consistency = source.consistency ?? currentProfile.consistency;
  const badges = (source.badges ?? currentProfile.badges).map((badge) => ({
    ...badge,
    unlockedAt: toDateRequired(badge.unlockedAt)
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
  const snapshot = persistedState ?? {};

  return {
    ...currentState,
    tasks: (snapshot.tasks ?? currentState.tasks).map(reviveTask),
    timeline: (snapshot.timeline ?? currentState.timeline).map(reviveBlock),
    activeTimer: reviveTimer(snapshot.activeTimer ?? currentState.activeTimer),
    sessions: (snapshot.sessions ?? currentState.sessions).map((session) => ({
      ...session,
      energy_reported: session.energy_reported
        ? {
            ...session.energy_reported,
            telemetry: reviveEnergyTelemetry(session.energy_reported.telemetry)
          }
        : session.energy_reported
    })) as DailySession[],
    settings: { ...DEFAULT_SETTINGS, ...(snapshot.settings ?? currentState.settings) },
    habits: (snapshot.habits ?? currentState.habits).map(reviveHabit),
    notes: (snapshot.notes ?? currentState.notes).map(reviveNote),
    alarms: snapshot.alarms ?? currentState.alarms,
    events: (snapshot.events ?? currentState.events).map(reviveEvent),
    routines: (snapshot.routines ?? currentState.routines).map(reviveRoutine),
    routineOverrides: snapshot.routineOverrides ?? currentState.routineOverrides,
    completedGhostBlocks: (snapshot.completedGhostBlocks ?? currentState.completedGhostBlocks).map(reviveBlock),
    habitReminderNotificationId: snapshot.habitReminderNotificationId ?? currentState.habitReminderNotificationId,
    travelLogs: (snapshot.travelLogs ?? currentState.travelLogs).map(reviveTravelLog),
    userProfile: reviveUserProfile(snapshot.userProfile, currentState.userProfile),
    rest_days: snapshot.rest_days ?? currentState.rest_days,
    lastEngine: snapshot.lastEngine ?? currentState.lastEngine,
    lastSolverStatus: snapshot.lastSolverStatus ?? currentState.lastSolverStatus,
    isGenerating: snapshot.isGenerating ?? currentState.isGenerating,
    last_replan_reason: snapshot.last_replan_reason ?? currentState.last_replan_reason,
    replan_history: (snapshot.replan_history ?? currentState.replan_history).map(reviveReplanDecision),
    last_scheduler_parity: reviveSchedulerParity(snapshot.last_scheduler_parity ?? currentState.last_scheduler_parity),
    daily_energy_reports: (snapshot.daily_energy_reports ?? currentState.daily_energy_reports).map((report) => ({
      ...reviveDailyEnergyReport(report),
      telemetry: reviveEnergyTelemetry(report.telemetry)
    })),
    energy_suggested_task_ids: snapshot.energy_suggested_task_ids ?? currentState.energy_suggested_task_ids,
    energy_suggestion_bias: snapshot.energy_suggestion_bias ?? currentState.energy_suggestion_bias,
    transit_arrival_records: (snapshot.transit_arrival_records ?? currentState.transit_arrival_records).map(reviveTransitArrivalRecord),
    pending_transit_arrival_prompt: revivePendingTransitArrivalPrompt(
      snapshot.pending_transit_arrival_prompt ?? currentState.pending_transit_arrival_prompt
    ),
    execution_records: (snapshot.execution_records ?? currentState.execution_records).map(reviveExecutionRecord),
    pending_completion_check: snapshot.pending_completion_check
      ? {
          ...snapshot.pending_completion_check,
          timestamp: toDateRequired(snapshot.pending_completion_check.timestamp)
        }
      : currentState.pending_completion_check,
    is_replanning: snapshot.is_replanning ?? currentState.is_replanning,
    replan_error: snapshot.replan_error ?? currentState.replan_error
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
