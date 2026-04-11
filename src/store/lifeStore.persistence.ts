import type { DailyRoutine, DailySession, Habit, LifeTimer, QuickNote, ScheduleBlock, StaticEvent, Task, TravelLog } from '../types';
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
    meals: routine.meals.map((meal) => ({ ...meal }))
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

export function createDefaultRoutines(): DailyRoutine[] {
  return Array.from({ length: 7 }).map((_, index) => ({
    dayOfWeek: index,
    sleepStart: '23:00',
    sleepEnd: '07:00',
    meals: [
      { id: createId('meal'), type: 'desayuno', time: '08:00', durationMinutes: 30 },
      { id: createId('meal'), type: 'almuerzo', time: '13:30', durationMinutes: 60 }
    ]
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
    sessions: (snapshot.sessions ?? currentState.sessions).map((session) => ({ ...session })) as DailySession[],
    settings: { ...DEFAULT_SETTINGS, ...(snapshot.settings ?? currentState.settings) },
    habits: (snapshot.habits ?? currentState.habits).map(reviveHabit),
    notes: (snapshot.notes ?? currentState.notes).map(reviveNote),
    alarms: snapshot.alarms ?? currentState.alarms,
    events: (snapshot.events ?? currentState.events).map(reviveEvent),
    routines: (snapshot.routines ?? currentState.routines).map(reviveRoutine),
    travelLogs: (snapshot.travelLogs ?? currentState.travelLogs).map(reviveTravelLog),
    userProfile: snapshot.userProfile ?? currentState.userProfile,
    lastEngine: snapshot.lastEngine ?? currentState.lastEngine,
    lastSolverStatus: snapshot.lastSolverStatus ?? currentState.lastSolverStatus,
    isGenerating: snapshot.isGenerating ?? currentState.isGenerating,
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
    travelLogs: state.travelLogs,
    userProfile: state.userProfile,
    lastEngine: state.lastEngine,
    lastSolverStatus: state.lastSolverStatus,
    isGenerating: state.isGenerating,
    execution_records: state.execution_records,
    pending_completion_check: state.pending_completion_check,
    is_replanning: state.is_replanning,
    replan_error: state.replan_error
  };
}
