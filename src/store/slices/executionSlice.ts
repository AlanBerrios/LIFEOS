import type { StateCreator } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { create } from 'zustand';
import { generateTimeline as buildTimelineLocal } from '../../core/scheduler';
import { createId } from '../../utils/ids';
import { MINUTE_MS } from '../../utils/time';
import { cancelAllNotifications, rescheduleAll, scheduleTaskNotifications } from '../../services/notifications';
import type { LifeStore, MoveBlockResult, MoveSuggestion } from '../lifeStore.types';
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

function buildExecutionPlanWindow(state: LifeStore, taskId: string, now = new Date()): { plannedStart: Date; plannedEnd: Date } {
  const plannedBlock = state.timeline.find((block) => block.task_id === taskId);
  if (plannedBlock) {
    return {
      plannedStart: new Date(plannedBlock.start_time),
      plannedEnd: new Date(plannedBlock.end_time)
    };
  }

  const task = state.tasks.find((item) => item.id === taskId);
  const etaMinutes = task?.eta_minutes ?? 0;
  return {
    plannedStart: new Date(now),
    plannedEnd: new Date(now.getTime() + etaMinutes * MINUTE_MS)
  };
}

function nextExecutionAttempt(state: LifeStore, taskId: string): number {
  const lastAttempt = (state.execution_records ?? [])
    .filter((record) => record.task_id === taskId)
    .reduce((max, record) => Math.max(max, record.attempt_number), 0);
  return lastAttempt + 1;
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

function isLockedForReorder(block: ScheduleBlock): boolean {
  return Boolean(block.isStaticEvent || block.isRoutineBlock || block.isCompletedGhost);
}

function canMoveThroughRange(blocks: ScheduleBlock[], fromIndex: number, targetIndex: number): boolean {
  if (targetIndex < 0 || targetIndex >= blocks.length) return false;
  const current = blocks[fromIndex];
  if (!current || current.type !== 'task' || isLockedForReorder(current)) return false;

  const start = Math.min(fromIndex, targetIndex);
  const end = Math.max(fromIndex, targetIndex);
  for (let i = start; i <= end; i += 1) {
    if (i === fromIndex) continue;
    if (isLockedForReorder(blocks[i])) return false;
  }

  return true;
}

function reorderAndReflow(blocks: ScheduleBlock[], fromIndex: number, targetIndex: number): ScheduleBlock[] {
  const next = [...blocks];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(targetIndex, 0, moved);

  const start = Math.min(fromIndex, targetIndex);
  const end = Math.max(fromIndex, targetIndex);
  const reflowStartMs = blocks[start].start_time.getTime();
  let cursorMs = reflowStartMs;

  for (let i = start; i <= end; i += 1) {
    const block = next[i];
    const durationMs = block.end_time.getTime() - block.start_time.getTime();
    next[i] = {
      ...block,
      start_time: new Date(cursorMs),
      end_time: new Date(cursorMs + durationMs)
    };
    cursorMs += durationMs;
  }

  return next;
}

function buildMoveSuggestions(blocks: ScheduleBlock[], fromIndex: number, limit = 3): MoveSuggestion[] {
  const suggestions: MoveSuggestion[] = [];

  for (let offset = 1; offset < blocks.length && suggestions.length < limit; offset += 1) {
    const upIndex = fromIndex - offset;
    if (upIndex >= 0 && canMoveThroughRange(blocks, fromIndex, upIndex)) {
      suggestions.push({
        targetIndex: upIndex,
        startTime: blocks[upIndex].start_time,
        direction: 'up'
      });
    }

    if (suggestions.length >= limit) break;

    const downIndex = fromIndex + offset;
    if (downIndex < blocks.length && canMoveThroughRange(blocks, fromIndex, downIndex)) {
      suggestions.push({
        targetIndex: downIndex,
        startTime: blocks[downIndex].start_time,
        direction: 'down'
      });
    }
  }

  return suggestions;
}

function attemptMove(
  blocks: ScheduleBlock[],
  fromIndex: number,
  targetIndex: number
): { result: MoveBlockResult; nextTimeline?: ScheduleBlock[] } {
  if (fromIndex < 0 || fromIndex >= blocks.length || targetIndex < 0 || targetIndex >= blocks.length) {
    return { result: { moved: false, reason: 'out_of_bounds' } };
  }

  const current = blocks[fromIndex];
  if (!current || current.type !== 'task' || isLockedForReorder(current)) {
    return { result: { moved: false, reason: 'invalid_block' } };
  }

  if (!canMoveThroughRange(blocks, fromIndex, targetIndex)) {
    return {
      result: {
        moved: false,
        reason: 'blocked_by_fixed',
        suggestions: buildMoveSuggestions(blocks, fromIndex)
      }
    };
  }

  const nextTimeline = reorderAndReflow(blocks, fromIndex, targetIndex);
  return { result: { moved: true }, nextTimeline };
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
  'moveBlockToIndex' |
  'startMealTimer' | 'stopTimer' | 'restoreMealTimer' |
  'startTaskExecution' | 'pauseTaskExecution' | 'resumeTaskExecution' | 
  'confirmCompletionOK' | 'confirmCompletionPartial' | 'reportTaskSkipped' | 'reportTaskPostponed' |
  'addReplanDecision' | 'triggerReplanification' | 'confirmReplan' | 'rejectReplan'
>> = (set, get) => ({
  generateTimeline: async (startTime = new Date()) => {
    const { tasks, settings } = get();
    const isRestDay = get().isRestDay();
    
    set({ isGenerating: true });

    // Si es día de descanso, no generar tareas, solo bloques de descanso/comidas
    if (isRestDay) {
      const restDayBlocks = buildTimelineLocal(
        [], // Sin tareas
        get().events, // Mantener eventos estáticos
        get().routines,
        startTime,
        settings,
        get().routineOverrides
      );
      
      set((state) => {
        const today = todayISO();
        const session = buildSession(state.tasks, restDayBlocks);
        const otherSessions = state.sessions.filter((sessionItem) => sessionItem.date !== today);

        return {
          timeline: restDayBlocks,
          sessions: [...otherSessions, session],
          lastEngine: 'local-ts',
          lastSolverStatus: 'REST_DAY',
          isGenerating: false
        };
      });
      return;
    }

    // Modo normal: planificar tareas
    const schedulableTasks = tasks.filter((task) => task.status === 'pool' || task.status === 'scheduled' || task.status === 'in_progress');

    // Modo local-only: siempre planificar con el scheduler TypeScript local.
    const newBlocks = buildTimelineLocal(
      schedulableTasks,
      get().events,
      get().routines,
      startTime,
      settings,
      get().routineOverrides
    );
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

      // Preservar bloques completados (ghost blocks) durante reorganización
      const now = new Date();
      const activeGhostBlocks = state.completedGhostBlocks.filter(
        (block) => block.end_time.getTime() > now.getTime()
      );
      
      // Combinar timeline nuevo con ghost blocks preservados
      const timelineWithGhosts = [
        ...newBlocks,
        ...activeGhostBlocks
      ].sort((a, b) => a.start_time.getTime() - b.start_time.getTime());

      const session = buildSession(updatedTasks, timelineWithGhosts);
      const otherSessions = state.sessions.filter((sessionItem) => sessionItem.date !== today);

      return {
        tasks: updatedTasks,
        timeline: newBlocks,
        completedGhostBlocks: activeGhostBlocks,
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
    const state = get();
    const index = state.timeline.findIndex((block) => block.id === blockId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const { result, nextTimeline } = attemptMove(state.timeline, index, targetIndex);

    if (result.moved && nextTimeline) {
      set({ timeline: nextTimeline });
    }

    return result;
  },

  moveBlockToIndex: (blockId: string, targetIndex: number) => {
    const state = get();
    const index = state.timeline.findIndex((block) => block.id === blockId);
    const { result, nextTimeline } = attemptMove(state.timeline, index, targetIndex);

    if (result.moved && nextTimeline) {
      set({ timeline: nextTimeline });
    }

    return result;
  },

  updateBreakDuration: (blockId: string, newMinutes: number) => {
    const target = get().timeline.find((block) => block.id === blockId);
    if (target?.isRoutineBlock && target.routineBlockKey) {
      const date = todayISO();
      const nextStart = target.start_time;
      const startTime = `${String(nextStart.getHours()).padStart(2, '0')}:${String(nextStart.getMinutes()).padStart(2, '0')}`;

      set((state) => {
        const existing = state.routineOverrides.find((item) => item.date === date);
        const remaining = (existing?.blocks ?? []).filter((item) => item.routineBlockKey !== target.routineBlockKey);
        const nextOverride = {
          routineBlockKey: target.routineBlockKey as string,
          startTime,
          durationMinutes: Math.max(1, newMinutes),
          title: target.title,
          hidden: false
        };

        const nextDay = { date, blocks: [...remaining, nextOverride] };
        const others = state.routineOverrides.filter((item) => item.date !== date);
        return { routineOverrides: [...others, nextDay] };
      });

      void get().generateTimeline(new Date());
      return;
    }

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
    const target = get().timeline.find((block) => block.id === blockId);
    if (target?.isRoutineBlock && target.routineBlockKey) {
      const date = todayISO();
      set((state) => {
        const existing = state.routineOverrides.find((item) => item.date === date);
        const remaining = (existing?.blocks ?? []).filter((item) => item.routineBlockKey !== target.routineBlockKey);
        const nextDay = {
          date,
          blocks: [...remaining, { routineBlockKey: target.routineBlockKey as string, hidden: true }]
        };
        const others = state.routineOverrides.filter((item) => item.date !== date);
        return { routineOverrides: [...others, nextDay] };
      });

      void get().generateTimeline(new Date());
      return;
    }

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
      const now = new Date();
      const { plannedStart, plannedEnd } = buildExecutionPlanWindow(state, task_id, now);

      const record: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: nextExecutionAttempt(state, task_id),
        planned_start: plannedStart,
        planned_end: plannedEnd,
        actual_start: now,
        actual_end: null,
        status: 'in_progress',
        result_code: 'not_started',
        work_minutes: 0,
        estimated_minutes: task.eta_minutes,
        created_at: now,
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
      const { plannedStart, plannedEnd } = buildExecutionPlanWindow(state, task_id, now);
      const gainedXp = (task.priority * 10) + (task.cognitive_load * 2);
      const targetBlock = state.timeline.find((block) => block.task_id === task_id);
      const keepGhost = Boolean(
        state.settings.keepCompletedGhostBlock &&
        targetBlock &&
        targetBlock.end_time.getTime() > now.getTime()
      );
      const nextGhostBlocks = state.completedGhostBlocks
        .filter((block) => block.task_id !== task_id)
        .filter((block) => block.end_time.getTime() > now.getTime());

      const completionRecord: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: nextExecutionAttempt(state, task_id),
        planned_start: plannedStart,
        planned_end: plannedEnd,
        actual_start: plannedStart <= now ? plannedStart : now,
        actual_end: now,
        status: 'completed',
        result_code: 'completed',
        work_minutes: Math.max(0, Math.round((now.getTime() - (plannedStart <= now ? plannedStart.getTime() : now.getTime())) / 60_000)),
        estimated_minutes: Math.max(1, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60_000)),
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
        completedGhostBlocks: keepGhost && targetBlock
          ? [...nextGhostBlocks, { ...targetBlock, isCompletedGhost: true, pinned: true }]
          : nextGhostBlocks,
        execution_records: [...(state.execution_records || []), completionRecord],
        userProfile: {
          ...state.userProfile,
          level: nextLevel,
          currentXP: nextXp,
          skills: nextSkills
        }
      };
    });
    get().addConsistencyActivity();
  },

  reportTaskSkipped: async (task_id: string, reason: SkipReason, details: string) => {
    set((state) => {
      const now = new Date();
      const { plannedStart, plannedEnd } = buildExecutionPlanWindow(state, task_id, now);
      const estimatedMinutes = Math.max(1, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60_000));
      // Record de ejecución fallida
      const record: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: nextExecutionAttempt(state, task_id),
        planned_start: plannedStart,
        planned_end: plannedEnd,
        actual_start: null,
        actual_end: null,
        status: 'skipped',
        result_code: 'failed',
        skip_reason: reason,
        skip_reason_details: details,
        work_minutes: 0,
        estimated_minutes: estimatedMinutes,
        created_at: now,
      };

      // Marcar tarea como skipped
      const updatedTasks = state.tasks.map((t) =>
        t.id === task_id ? { ...t, status: 'skipped' as const } : t
      );

      return {
        tasks: updatedTasks,
        execution_records: [...(state.execution_records || []), record],
        last_replan_reason: `Se saltó "${state.tasks.find((t) => t.id === task_id)?.title ?? 'tarea'}" por ${reason}. ${details}`
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
      const now = new Date();
      const { plannedStart, plannedEnd } = buildExecutionPlanWindow(state, task_id, now);
      // Grabar como parcialmente completada
      const record: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: nextExecutionAttempt(state, task_id),
        planned_start: plannedStart,
        planned_end: plannedEnd,
        actual_start: plannedStart <= now ? plannedStart : now,
        actual_end: now,
        status: 'completed',
        result_code: 'partial',
        work_minutes: Math.max(0, Math.round((now.getTime() - (plannedStart <= now ? plannedStart.getTime() : now.getTime())) / 60_000)),
        estimated_minutes: Math.max(1, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60_000)),
        notes_after: notes,
        created_at: now,
      };

      return {
        execution_records: [...(state.execution_records || []), record],
      };
    });
  },

  reportTaskPostponed: async (task_id: string, reason: PostponeReason, details: string, postponed_until: Date) => {
    set((state) => {
      const now = new Date();
      const { plannedStart, plannedEnd } = buildExecutionPlanWindow(state, task_id, now);
      const estimatedMinutes = Math.max(1, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60_000));
      // Grabar postpone con fecha de reintento
      const record: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: nextExecutionAttempt(state, task_id),
        planned_start: plannedStart,
        planned_end: plannedEnd,
        actual_start: null,
        actual_end: null,
        status: 'postponed',
        result_code: 'not_started',
        postpone_reason: reason,
        postpone_reason_details: details,
        postponed_until,
        work_minutes: 0,
        estimated_minutes: estimatedMinutes,
        created_at: now,
      };

      // Marcar tarea como postponed
      const updatedTasks = state.tasks.map((t) =>
        t.id === task_id ? { ...t, status: 'postponed' as const } : t
      );

      return {
        tasks: updatedTasks,
        execution_records: [...(state.execution_records || []), record],
        last_replan_reason: `Se pospuso "${state.tasks.find((t) => t.id === task_id)?.title ?? 'tarea'}" hasta ${postponed_until.toLocaleString('es-ES')}. Motivo: ${reason}. ${details}`
      };
    });

    // Trigger replanificación
    await get().triggerReplanification();
  },

  addReplanDecision: (decision, reason, previousBlocks, nextBlocks, diffMinutes) => {
    set((state) => ({
      replan_history: [
        ...state.replan_history,
        {
          timestamp: new Date(),
          decision,
          reason,
          previousBlocks,
          nextBlocks,
          diffMinutes
        }
      ].slice(-25)
    }));
  },

  confirmReplan: async (new_schedule: ScheduleBlock[]) => {
    const previousTimeline = get().timeline;
    const reason = get().last_replan_reason ?? 'Replan automática';
    const diffMinutes = Math.round(
      (new_schedule.reduce((sum, block) => sum + (block.end_time.getTime() - block.start_time.getTime()), 0) -
        previousTimeline.reduce((sum, block) => sum + (block.end_time.getTime() - block.start_time.getTime()), 0)) / 60_000
    );

    set((state) => {
      const today = new Date().toISOString().slice(0, 10);
      const activeGhostBlocks = state.completedGhostBlocks.filter((block) => block.end_time.getTime() > Date.now());
      
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
        timeline: [...new_schedule, ...activeGhostBlocks].sort((a, b) => a.start_time.getTime() - b.start_time.getTime()),
        sessions: updatedSessions,
        is_replanning: false,
        replan_error: undefined,
        pending_completion_check: undefined,
        last_replan_reason: undefined,
      };
    });

    get().addReplanDecision('accepted', reason, previousTimeline.length, new_schedule.length, diffMinutes);
  },

  rejectReplan: () => {
    const previousTimeline = get().timeline;
    const reason = get().last_replan_reason ?? 'Replan automática';
    set({
      is_replanning: false,
      replan_error: undefined,
      pending_completion_check: undefined,
      last_replan_reason: undefined,
    });

    get().addReplanDecision('rejected', reason, previousTimeline.length, previousTimeline.length, 0);
  }
});
