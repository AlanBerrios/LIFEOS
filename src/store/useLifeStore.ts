import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { create } from 'zustand';
import { generateTimeline as buildTimelineLocal } from '../core/scheduler';
import { callSchedulerApi, SchedulerApiError } from '../services/schedulerApi';
import { createId } from '../utils/ids';
import { MINUTE_MS } from '../utils/time';
import { cancelAllNotifications, scheduleLocalNotification } from '../services/notifications';
import { toDate, toDateRequired } from '../utils/date';
import type { DailySession, LifeTimer, ScheduleBlock, Task, TaskStatus } from '../types';

// ─── Interfaces internas ──────────────────────────────────────────────────────

interface TaskDraft {
  title: string;
  description?: string;
  eta_minutes: number;
  priority: 1 | 2 | 3 | 4 | 5;
  cognitive_load: number;
  deadline?: Date | string | null;
}

interface TaskUpdate {
  title?: string;
  description?: string;
  eta_minutes?: number;
  priority?: 1 | 2 | 3 | 4 | 5;
  cognitive_load?: number;
  deadline?: Date | string | null;
  status?: TaskStatus;
}

/** Motor que generó el último timeline */
export type SchedulerEngine = 'ortools-cpsat' | 'greedy-fallback' | 'local-ts' | 'idle';

interface LifeStore {
  tasks: Task[];
  timeline: ScheduleBlock[];
  activeTimer: LifeTimer | null;
  sessions: DailySession[];
  /** Motor que generó el timeline actual */
  lastEngine: SchedulerEngine;
  /** Status del solver (OPTIMAL, FEASIBLE, etc.) */
  lastSolverStatus: string;
  /** true mientras genera el timeline */
  isGenerating: boolean;

  // Tasks
  addTask: (task: TaskDraft) => void;
  updateTask: (id: string, updates: TaskUpdate) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;

  // Timeline
  generateTimeline: (startTime?: Date) => Promise<void>;
  setTimeline: (blocks: ScheduleBlock[]) => void;

  // Timer
  startMealTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  restoreMealTimer: () => void;

  // Sessions
  clearOldSessions: () => void;
}

// ─── Timer helpers ────────────────────────────────────────────────────────────

let mealTimeout: ReturnType<typeof setTimeout> | null = null;

function clearMealTimeout(): void {
  if (mealTimeout) {
    clearTimeout(mealTimeout);
    mealTimeout = null;
  }
}

// ─── Revival helpers ──────────────────────────────────────────────────────────

function reviveTask(task: Task): Task {
  return {
    ...task,
    created_at: toDateRequired(task.created_at),
    deadline: toDate(task.deadline)
  };
}

function reviveBlock(block: ScheduleBlock): ScheduleBlock {
  return {
    ...block,
    start_time: toDateRequired(block.start_time),
    end_time: toDateRequired(block.end_time)
  };
}

function reviveTimer(timer: LifeTimer | null): LifeTimer | null {
  if (!timer) return null;
  const revived = {
    ...timer,
    startedAt: toDateRequired(timer.startedAt),
    endsAt: toDateRequired(timer.endsAt)
  };
  return revived.endsAt.getTime() <= Date.now() ? null : revived;
}

// ─── Session helpers ──────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildSession(tasks: Task[], timeline: ScheduleBlock[]): DailySession {
  const taskBlocks = timeline.filter((b) => b.type === 'task');
  const totalWorkMinutes = taskBlocks.reduce(
    (sum, b) => sum + (b.end_time.getTime() - b.start_time.getTime()) / 60_000,
    0
  );
  const totalCognitiveDrain = taskBlocks.reduce(
    (sum, b) => sum + (b.cognitive_drain ?? 0),
    0
  );
  return {
    id: createId('session'),
    date: todayISO(),
    tasksCompleted: tasks.filter((t) => t.status === 'completed').length,
    tasksScheduled: taskBlocks.length,
    totalWorkMinutes: Math.round(totalWorkMinutes),
    totalCognitiveDrain: Math.round(totalCognitiveDrain)
  };
}

// ─── Meal timeout ─────────────────────────────────────────────────────────────

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

// ─── Store ────────────────────────────────────────────────────────────────────

export const useLifeStore = create<LifeStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      timeline: [],
      activeTimer: null,
      sessions: [],
      lastEngine: 'idle',
      lastSolverStatus: '',
      isGenerating: false,

      // ── Tasks ──────────────────────────────────────────────────────────────
      addTask: (task) => {
        const created: Task = {
          id: createId('task'),
          title: task.title.trim(),
          description: task.description?.trim() || undefined,
          eta_minutes: Math.max(5, Math.round(task.eta_minutes)),
          priority: task.priority,
          cognitive_load: Math.max(1, Math.min(10, Math.round(task.cognitive_load))),
          deadline: toDate(task.deadline),
          status: 'pool',
          created_at: new Date()
        };
        set((state) => ({ tasks: [...state.tasks, created] }));
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id !== id) return task;
            return {
              ...task,
              title: updates.title?.trim() ?? task.title,
              description:
                updates.description === undefined
                  ? task.description
                  : updates.description.trim() || undefined,
              eta_minutes:
                updates.eta_minutes === undefined
                  ? task.eta_minutes
                  : Math.max(5, Math.round(updates.eta_minutes)),
              priority: updates.priority ?? task.priority,
              cognitive_load:
                updates.cognitive_load === undefined
                  ? task.cognitive_load
                  : Math.max(1, Math.min(10, Math.round(updates.cognitive_load))),
              deadline:
                updates.deadline === undefined ? task.deadline : toDate(updates.deadline),
              status: updates.status ?? task.status
            };
          })
        }));
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          timeline: state.timeline.filter((b) => b.task_id !== id)
        }));
      },

      completeTask: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, status: 'completed' } : t
          ),
          timeline: state.timeline.filter((b) => b.task_id !== id)
        }));
      },

      // ── Timeline ───────────────────────────────────────────────────────────
      generateTimeline: async (startTime = new Date()) => {
        const currentTasks = get().tasks;
        set({ isGenerating: true });

        let nextTimeline: ScheduleBlock[];
        let engine: SchedulerEngine;
        let solverStatus: string;

        // 1. Intentar backend Python (OR-Tools)
        try {
          const { blocks, meta } = await callSchedulerApi(currentTasks, startTime);
          nextTimeline  = blocks;
          engine        = meta.engine === 'ortools-cpsat' ? 'ortools-cpsat' : 'greedy-fallback';
          solverStatus  = meta.solver_status;
        } catch (err) {
          // 2. Fallback al scheduler TypeScript local
          console.warn(
            '[LifeOS] Backend Python no disponible, usando scheduler local.',
            err instanceof SchedulerApiError ? err.message : err
          );
          nextTimeline  = buildTimelineLocal(currentTasks, startTime);
          engine        = 'local-ts';
          solverStatus  = 'LOCAL_FALLBACK';
        }

        const scheduledTaskIds = new Set(
          nextTimeline
            .filter((b) => b.type === 'task' && b.task_id)
            .map((b) => b.task_id as string)
        );

        const today = todayISO();

        set((state) => {
          const updatedTasks = state.tasks.map((task) =>
            task.status === 'pool' && scheduledTaskIds.has(task.id)
              ? { ...task, status: 'scheduled' as TaskStatus }
              : task
          );

          const session: DailySession = buildSession(updatedTasks, nextTimeline);
          const otherSessions = state.sessions.filter((s) => s.date !== today);

          return {
            tasks: updatedTasks,
            timeline: nextTimeline,
            sessions: [...otherSessions, session],
            lastEngine: engine,
            lastSolverStatus: solverStatus,
            isGenerating: false
          };
        });
      },

      setTimeline: (blocks) => set({ timeline: blocks }),

      // ── Meal timer ─────────────────────────────────────────────────────────
      startMealTimer: async () => {
        clearMealTimeout();
        await cancelAllNotifications();
        const startedAt = new Date();
        const endsAt = new Date(startedAt.getTime() + 90 * MINUTE_MS);
        set({
          activeTimer: {
            id: createId('timer'),
            label: 'meal',
            startedAt,
            endsAt,
            durationMinutes: 90,
            active: true
          }
        });
        await scheduleLocalNotification(
          'Tiempo terminado',
          'Volvamos a reorganizar el día.',
          90 * 60
        );
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

      // ── Sessions ───────────────────────────────────────────────────────────
      clearOldSessions: () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        set((state) => ({
          sessions: state.sessions.filter((s) => s.date >= cutoffStr)
        }));
      }
    }),

    // ── Persistencia ──────────────────────────────────────────────────────────
    {
      name: 'lifeos-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        tasks: state.tasks,
        timeline: state.timeline,
        activeTimer: state.activeTimer,
        sessions: state.sessions,
        lastEngine: state.lastEngine,
        lastSolverStatus: state.lastSolverStatus
      }),
      merge: (persistedState, currentState) => {
        const snapshot = persistedState as Partial<LifeStore> | undefined;
        return {
          ...currentState,
          tasks: (snapshot?.tasks ?? currentState.tasks).map(reviveTask),
          timeline: (snapshot?.timeline ?? currentState.timeline).map(reviveBlock),
          activeTimer: reviveTimer(snapshot?.activeTimer ?? currentState.activeTimer),
          sessions: snapshot?.sessions ?? currentState.sessions,
          lastEngine: snapshot?.lastEngine ?? 'idle',
          lastSolverStatus: snapshot?.lastSolverStatus ?? ''
        };
      }
    }
  )
);
