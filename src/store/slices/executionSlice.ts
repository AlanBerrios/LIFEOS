import type { StateCreator } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { create } from 'zustand';
import { generateTimeline as buildTimelineLocal } from '../../core/scheduler';
import { createId } from '../../utils/ids';
import { MINUTE_MS } from '../../utils/time';
import { cancelAllNotifications, rescheduleAll, scheduleTaskNotifications } from '../../services/notifications';
import type { LifeStore } from '../lifeStore.types';
import type { DailySession, LifeTimer, ScheduleBlock, Task, ExecutionRecord, SkipReason, PostponeReason, PendingCompletionCheck } from '../../types';

let mealTimeout: ReturnType<typeof setTimeout> | null = null;

function clearMealTimeout(): void {
  if (mealTimeout) {
    clearTimeout(mealTimeout);
    mealTimeout = null;
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildSession(tasks: Task[], timeline: ScheduleBlock[], totalExpGained = 0): DailySession {
  const taskBlocks = timeline.filter((block) => block.type === 'task');
  const totalWorkMinutes = taskBlocks.reduce(
    (sum, block) => sum + (block.end_time.getTime() - block.start_time.getTime()) / 60_000,
    0
  );
  const totalCognitiveDrain = taskBlocks.reduce((sum, block) => sum + (block.cognitive_drain ?? 0), 0);

  return {
    id: createId('session'),
    date: todayISO(),
    tasksCompleted: tasks.filter((task) => task.status === 'completed').length,
    tasksScheduled: taskBlocks.length,
    tasksSkipped: tasks.filter((task) => task.status === 'skipped').length,
    tasksPostponed: tasks.filter((task) => task.status === 'postponed').length,
    totalWorkMinutes: Math.round(totalWorkMinutes),
    totalCognitiveDrain: Math.round(totalCognitiveDrain),
    expGainedToday: totalExpGained
  };
}

type SetFn = (partial: Partial<LifeStore> | ((state: LifeStore) => Partial<LifeStore>)) => void;
type GetFn = () => LifeStore;

function scheduleMealTimeout(getState: GetFn, setState: SetFn): void {
  clearMealTimeout();
  const timer = getState().activeTimer;
  if (!timer) return;

  const remainingMs = timer.endsAt.getTime() - Date.now();
  if (remainingMs <= 0) {
    void getState().generateTimeline(new Date());
    setState({ activeTimer: null });
    return;
  }

  mealTimeout = setTimeout(() => {
    setState({ activeTimer: null });
    void getState().generateTimeline(new Date());
  }, remainingMs);
}

export const createExecutionSlice: StateCreator<LifeStore, [], [], Pick<LifeStore,
  'generateTimeline' | 'setTimeline' | 'moveBlock' | 'updateBreakDuration' | 'deleteBlock' |
  'startMealTimer' | 'stopTimer' | 'restoreMealTimer' |
  'startTaskExecution' | 'pauseTaskExecution' | 'resumeTaskExecution' | 
  'confirmCompletionOK' | 'confirmCompletionPartial' | 'reportTaskSkipped' | 'reportTaskPostponed' |
  'triggerReplanification' | 'confirmReplan' | 'rejectReplan'
>> = (set, get) => ({
  generateTimeline: async (startTime = new Date()) => {
    const { tasks, settings } = get();
    const schedulableTasks = tasks.filter((task) => task.status === 'pool' || task.status === 'scheduled' || task.status === 'in_progress');
    set({ isGenerating: true });

    // Modo local-only: siempre planificar con el scheduler TypeScript local.
    const newBlocks = buildTimelineLocal(schedulableTasks, get().events, get().routines, startTime, settings);
    const engine: LifeStore['lastEngine'] = 'local-ts';
    const solverStatus = 'LOCAL_ONLY';

    const scheduledTaskIds = new Set(newBlocks.filter((block) => block.type === 'task' && block.task_id).map((block) => block.task_id as string));
    const today = todayISO();

    set((state) => {
      const updatedTasks = state.tasks.map((task) =>
        task.status === 'pool' && scheduledTaskIds.has(task.id)
          ? { ...task, status: 'scheduled' as const }
          : task
      );

      const session = buildSession(updatedTasks, newBlocks);
      const otherSessions = state.sessions.filter((sessionItem) => sessionItem.date !== today);

      return {
        tasks: updatedTasks,
        timeline: newBlocks,
        sessions: [...otherSessions, session],
        lastEngine: engine,
        lastSolverStatus: solverStatus,
        isGenerating: false
      };
    });

    void rescheduleAll(newBlocks, tasks, settings, get().routines, get().events, get().notes, get().alarms)
      .then((syncedAlarms) => set({ alarms: syncedAlarms }));
  },

  setTimeline: (blocks: ScheduleBlock[]) => set({ timeline: blocks }),

  moveBlock: (blockId: string, direction: 'up' | 'down') => {
    set((state) => {
      const index = state.timeline.findIndex((block) => block.id === blockId);
      if (index < 0) return state;
      const blocks = [...state.timeline];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= blocks.length) return state;

      const current = blocks[index];
      const target = blocks[targetIndex];
      const currentDuration = current.end_time.getTime() - current.start_time.getTime();
      const targetDuration = target.end_time.getTime() - target.start_time.getTime();
      const firstStart = index < targetIndex ? current.start_time : target.start_time;
      const first = index < targetIndex ? target : current;
      const second = index < targetIndex ? current : target;
      const firstDuration = index < targetIndex ? targetDuration : currentDuration;
      const secondDuration = index < targetIndex ? currentDuration : targetDuration;
      const firstEnd = new Date(firstStart.getTime() + firstDuration);
      const secondStart = firstEnd;
      const secondEnd = new Date(secondStart.getTime() + secondDuration);

      blocks[Math.min(index, targetIndex)] = { ...first, start_time: firstStart, end_time: firstEnd, pinned: true };
      blocks[Math.max(index, targetIndex)] = { ...second, start_time: secondStart, end_time: secondEnd, pinned: true };
      return { timeline: blocks };
    });
  },

  updateBreakDuration: (blockId: string, newMinutes: number) => {
    set((state) => {
      const index = state.timeline.findIndex((block) => block.id === blockId);
      if (index < 0) return state;
      const blocks = [...state.timeline];
      const block = blocks[index];
      if (block.type !== 'rest' && block.type !== 'meal') return state;
      const oldDuration = block.end_time.getTime() - block.start_time.getTime();
      const newDuration = newMinutes * 60_000;
      const delta = newDuration - oldDuration;
      const newEnd = new Date(block.end_time.getTime() + delta);
      blocks[index] = { ...block, end_time: newEnd };

      for (let cursor = index + 1; cursor < blocks.length; cursor++) {
        blocks[cursor] = {
          ...blocks[cursor],
          start_time: new Date(blocks[cursor].start_time.getTime() + delta),
          end_time: new Date(blocks[cursor].end_time.getTime() + delta)
        };
      }

      return { timeline: blocks };
    });
  },

  deleteBlock: (blockId: string) => {
    set((state) => {
      const index = state.timeline.findIndex((block) => block.id === blockId);
      if (index < 0) return state;
      const blocks = [...state.timeline];
      const block = blocks[index];
      const duration = block.end_time.getTime() - block.start_time.getTime();
      blocks.splice(index, 1);

      const updatedTasks =
        block.task_id
          ? state.tasks.map((task) =>
              task.id === block.task_id && task.status !== 'completed'
                ? { ...task, status: 'pool' as const }
                : task
            )
          : state.tasks;

      for (let cursor = index; cursor < blocks.length; cursor++) {
        blocks[cursor] = {
          ...blocks[cursor],
          start_time: new Date(blocks[cursor].start_time.getTime() - duration),
          end_time: new Date(blocks[cursor].end_time.getTime() - duration)
        };
      }

      return { timeline: blocks, tasks: updatedTasks };
    });

    const { timeline, tasks, settings, routines, events, notes } = get();
    void rescheduleAll(timeline, tasks, settings, routines, events, notes, get().alarms)
      .then((syncedAlarms) => set({ alarms: syncedAlarms }));
  },

  startMealTimer: async (durationMinutes?: number) => {
    const { routines } = get();
    clearMealTimeout();
    await cancelAllNotifications();

    const currentDay = new Date().getDay();
    const routine = routines.find((currentRoutine) => currentRoutine.dayOfWeek === currentDay);
    const routineLunch = routine?.meals.find((meal) => meal.type.toLowerCase() === 'almuerzo');
    const finalDuration = durationMinutes ?? routineLunch?.durationMinutes ?? 60;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + finalDuration * MINUTE_MS);

    set({
      activeTimer: {
        id: createId('timer'),
        label: 'meal',
        startedAt,
        endsAt,
        durationMinutes: finalDuration,
        active: true
      }
    });

    scheduleMealTimeout(get, set);
  },

  stopTimer: async () => {
    clearMealTimeout();
    await cancelAllNotifications();
    set({ activeTimer: null });
  },

  restoreMealTimer: () => {
    scheduleMealTimeout(get, set);
  },

  // ============================================
  // FASE C: Execution Nucleus Actions
  // ============================================

  startTaskExecution: (task_id: string) => {
    set((state) => {
      const task = state.tasks.find((t) => t.id === task_id);
      if (!task) return state;

      const record: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: 1,
        planned_start: new Date(),
        planned_end: new Date(Date.now() + (task.eta_minutes * MINUTE_MS)),
        actual_start: new Date(),
        actual_end: null,
        status: 'in_progress',
        result_code: 'not_started',
        work_minutes: 0,
        estimated_minutes: task.eta_minutes,
        created_at: new Date(),
      };

      return {
        execution_records: [...(state.execution_records || []), record],
      };
    });
  },

  confirmCompletionOK: async (task_id: string) => {
    set((state) => {
      const task = state.tasks.find((t) => t.id === task_id);
      if (!task) return state;

      const now = new Date();
      const gainedXp = (task.priority * 10) + (task.cognitive_load * 2);

      const completionRecord: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: 1,
        planned_start: now,
        planned_end: now,
        actual_start: now,
        actual_end: now,
        status: 'completed',
        result_code: 'completed',
        work_minutes: task.eta_minutes,
        estimated_minutes: task.eta_minutes,
        created_at: now,
      };

      const updatedTasks = state.tasks.map((t) =>
        t.id === task_id ? { ...t, status: 'completed' as const } : t
      );

      const nextSkills = {
        ...state.userProfile.skills,
        focus: state.userProfile.skills.focus + gainedXp
      };
      let nextLevel = state.userProfile.level;
      let nextXp = state.userProfile.currentXP + gainedXp;
      while (nextXp >= nextLevel * 100) {
        nextXp -= nextLevel * 100;
        nextLevel += 1;
      }

      return {
        tasks: updatedTasks,
        timeline: state.timeline.filter((block) => block.task_id !== task_id),
        execution_records: [...(state.execution_records || []), completionRecord],
        userProfile: {
          level: nextLevel,
          currentXP: nextXp,
          skills: nextSkills
        }
      };
    });
  },

  reportTaskSkipped: async (task_id: string, reason: SkipReason, details: string) => {
    set((state) => {
      // Record de ejecución fallida
      const record: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: 1,
        planned_start: new Date(),
        planned_end: new Date(),
        actual_start: null,
        actual_end: null,
        status: 'skipped',
        result_code: 'failed',
        skip_reason: reason,
        skip_reason_details: details,
        work_minutes: 0,
        estimated_minutes: state.tasks.find((t) => t.id === task_id)?.eta_minutes || 0,
        created_at: new Date(),
      };

      // Marcar tarea como skipped
      const updatedTasks = state.tasks.map((t) =>
        t.id === task_id ? { ...t, status: 'skipped' as const } : t
      );

      return {
        tasks: updatedTasks,
        execution_records: [...(state.execution_records || []), record],
      };
    });
    
    // Trigger replanificación después del skip
    await get().triggerReplanification();
  },

  triggerReplanification: async () => {
    const { tasks, settings } = get();

    set({ is_replanning: true, replan_error: undefined });

    const pendingTasks = tasks.filter((task) => task.status !== 'completed');
    const blocks = buildTimelineLocal(pendingTasks, get().events, get().routines, new Date(), settings);

    set({
      timeline: blocks,
      is_replanning: false,
      replan_error: undefined,
      lastEngine: 'local-ts',
      lastSolverStatus: 'LOCAL_ONLY'
    });

    void rescheduleAll(blocks, tasks, settings, get().routines, get().events, get().notes, get().alarms)
      .then((syncedAlarms) => set({ alarms: syncedAlarms }));
  },

  pauseTaskExecution: (task_id: string) => {
    // Pausa ejecución actual (podría persistir datos parciales)
    set((state) => {
      // TODO: Grabar pausa en execution_records si es necesario
      return state;
    });
  },

  resumeTaskExecution: (task_id: string) => {
    // Reanuda ejecución de tarea pausada
    set((state) => {
      // TODO: Restaurar contexto de ejecución anterior
      return state;
    });
  },

  confirmCompletionPartial: async (task_id: string, notes: string) => {
    set((state) => {
      // Grabar como parcialmente completada
      const record: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: 1,
        planned_start: new Date(),
        planned_end: new Date(),
        actual_start: new Date(),
        actual_end: new Date(),
        status: 'completed',
        result_code: 'partial',
        work_minutes: 0,
        estimated_minutes: state.tasks.find((t) => t.id === task_id)?.eta_minutes || 0,
        notes_after: notes,
        created_at: new Date(),
      };

      return {
        execution_records: [...(state.execution_records || []), record],
      };
    });
  },

  reportTaskPostponed: async (task_id: string, reason: PostponeReason, details: string, postponed_until: Date) => {
    set((state) => {
      // Grabar postpone con fecha de reintento
      const record: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: 1,
        planned_start: new Date(),
        planned_end: new Date(),
        actual_start: null,
        actual_end: null,
        status: 'postponed',
        result_code: 'not_started',
        postpone_reason: reason,
        postpone_reason_details: details,
        postponed_until,
        work_minutes: 0,
        estimated_minutes: state.tasks.find((t) => t.id === task_id)?.eta_minutes || 0,
        created_at: new Date(),
      };

      // Marcar tarea como postponed
      const updatedTasks = state.tasks.map((t) =>
        t.id === task_id ? { ...t, status: 'postponed' as const } : t
      );

      return {
        tasks: updatedTasks,
        execution_records: [...(state.execution_records || []), record],
      };
    });

    // Trigger replanificación
    await get().triggerReplanification();
  },

  confirmReplan: async (new_schedule: ScheduleBlock[]) => {
    set((state) => {
      const today = new Date().toISOString().slice(0, 10);
      
      // Actualizar timeline con nuevo plan
      const updatedSessions = state.sessions.map((session) =>
        session.date === today
          ? {
              ...session,
              execution_timeline: new_schedule.map((block) => ({
                block_id: block.id,
                block_title: block.title,
                planned_start: block.start_time,
                planned_end: block.end_time,
                actual_start: null,
                actual_end: null,
                status: 'pending' as const,
              })),
              replan_count: (session.replan_count || 0) + 1,
            }
          : session
      );

      return {
        timeline: new_schedule,
        sessions: updatedSessions,
        is_replanning: false,
        replan_error: undefined,
        pending_completion_check: undefined,
      };
    });
  },

  rejectReplan: () => {
    set({
      is_replanning: false,
      replan_error: undefined,
      pending_completion_check: undefined,
    });
  }
});
