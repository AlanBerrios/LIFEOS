import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { create } from 'zustand';
import { generateTimeline as buildTimelineLocal } from '../core/scheduler';
import { callSchedulerApi, SchedulerApiError } from '../services/schedulerApi';
import { createId } from '../utils/ids';
import { MINUTE_MS } from '../utils/time';
import { cancelAllNotifications, scheduleTaskNotifications } from '../services/notifications';
import { getTodayStr, toDate, toDateRequired } from '../utils/date';
import { DEFAULT_SETTINGS } from '../types';
import type { AppSettings, DailySession, LifeTimer, ScheduleBlock, Task, TaskStatus } from '../types';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface TaskDraft {
  title: string;
  description?: string;
  eta_minutes: number;
  priority: 1 | 2 | 3 | 4 | 5;
  cognitive_load: number;
  deadline?: Date | string | null;
  fixed_start?: Date | string | null;
  fixed_end?: Date | string | null;
  urgency: import('../types').TaskUrgency;
}

interface TaskUpdate {
  title?: string;
  description?: string;
  eta_minutes?: number;
  priority?: 1 | 2 | 3 | 4 | 5;
  cognitive_load?: number;
  deadline?: Date | string | null;
  fixed_start?: Date | string | null;
  fixed_end?: Date | string | null;
  urgency?: import('../types').TaskUrgency;
  status?: TaskStatus;
}

export type SchedulerEngine = 'ortools-cpsat' | 'greedy-fallback' | 'local-ts' | 'idle';

interface LifeStore {
  tasks: Task[];
  timeline: ScheduleBlock[];
  activeTimer: LifeTimer | null;
  sessions: DailySession[];
  settings: AppSettings;
  habits: import('../types').Habit[];
  notes: import('../types').QuickNote[];
  alarms: import('../types').Alarm[];
  events: import('../types').StaticEvent[];
  routines: import('../types').DailyRoutine[];
  travelLogs: import('../types').TravelLog[];
  lastEngine: SchedulerEngine;
  lastSolverStatus: string;
  isGenerating: boolean;

  // Habits
  addHabit: (h: Omit<import('../types').Habit, 'id' | 'logs' | 'streak'>) => void;
  logHabit: (id: string, value: number) => void;
  updateHabit: (id: string, updates: Partial<import('../types').Habit>) => void;
  deleteHabit: (id: string) => void;
  
  // Notes
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;

  // Timeline
  generateTimeline: (startTime?: Date) => Promise<void>;
  setTimeline: (blocks: ScheduleBlock[]) => void;
  moveBlock: (blockId: string, direction: 'up' | 'down') => void;
  updateBreakDuration: (blockId: string, newMinutes: number) => void;
  deleteBlock: (blockId: string) => void;

  // Timer
  startMealTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  restoreMealTimer: () => void;

  // Settings
  updateSettings: (partial: Partial<AppSettings>) => void;

  // Data management
  clearOldSessions: () => void;
  clearAllData: () => void;



  // Notes
  addNote: (n: { title: string; content: string; reminderIntervalMinutes?: number; reminderAt?: string }) => void;
  deleteNote: (id: string) => void;

  // Alarms
  addAlarm: (a: { time: string; label: string; days: number[] }) => void;
  toggleAlarm: (id: string, enabled: boolean) => void;
  deleteAlarm: (id: string) => void;

  // Events (Static / Calendar ICS)
  addEvent: (e: Omit<import('../types').StaticEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<import('../types').StaticEvent>) => void;
  setEvents: (events: import('../types').StaticEvent[]) => void;
  deleteEvent: (id: string) => void;

  // Routines
  updateRoutineDay: (dayOfWeek: number, updates: Partial<import('../types').DailyRoutine>) => void;

  // Geofencing / Travel Logging
  addTravelLog: (type: 'leave_home' | 'arrive_uni' | 'leave_uni' | 'arrive_home') => void;
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
    urgency: (task as any).urgency ?? 'someday',
    created_at: toDateRequired(task.created_at),
    deadline: toDate(task.deadline),
    fixed_start: toDate((task as any).fixed_start),
    fixed_end: toDate((task as any).fixed_end)
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

const DEFAULT_HABITS = [
  { id: createId('habit'), name: 'Tomar agua', emoji: '💧', goalValue: 2, goalUnit: 'litros', logs: [], streak: 0, color: '#38bdf8' },
  { id: createId('habit'), name: 'Hacer ejercicio', emoji: '💪', goalValue: 30, goalUnit: 'min', logs: [], streak: 0, color: '#fb7185' },
  { id: createId('habit'), name: 'Estudiar', emoji: '📚', goalValue: 60, goalUnit: 'min', logs: [], streak: 0, color: '#818cf8' },
  { id: createId('habit'), name: 'Caminar 5km', emoji: '🚶', goalValue: 5, goalUnit: 'km', logs: [], streak: 0, color: '#4ade80' }
];

const DEFAULT_ROUTINES = Array.from({ length: 7 }).map((_, i) => ({
  dayOfWeek: i,
  sleepStart: '23:00',
  sleepEnd: '07:00',
  meals: [
    { id: createId('meal'), type: 'desayuno', time: '08:00', durationMinutes: 30 },
    { id: createId('meal'), type: 'almuerzo', time: '13:30', durationMinutes: 60 }
  ]
}));

export const useLifeStore = create<LifeStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      timeline: [],
      activeTimer: null,
      sessions: [],
      settings: DEFAULT_SETTINGS,
      habits: DEFAULT_HABITS,
      notes: [],
      alarms: [],
      events: [],
      routines: DEFAULT_ROUTINES as any,
      travelLogs: [],
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
          fixed_start: toDate(task.fixed_start),
          fixed_end: toDate(task.fixed_end),
          urgency: task.urgency,
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
              fixed_start:
                updates.fixed_start === undefined ? task.fixed_start : toDate(updates.fixed_start),
              fixed_end:
                updates.fixed_end === undefined ? task.fixed_end : toDate(updates.fixed_end),
              urgency: updates.urgency ?? task.urgency,
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
        const { tasks, settings } = get();
        // Solo re-planificar tareas que aún están en pool (no completadas)
        const schedulableTasks = tasks.filter(
          (t) => t.status === 'pool' || t.status === 'scheduled'
        );
        set({ isGenerating: true });

        let newBlocks: ScheduleBlock[];
        let engine: SchedulerEngine;
        let solverStatus: string;

        try {
          const { blocks, meta } = await callSchedulerApi(schedulableTasks, startTime);
          newBlocks = blocks;
          engine = meta.engine === 'ortools-cpsat' ? 'ortools-cpsat' : 'greedy-fallback';
          solverStatus = meta.solver_status;
        } catch (err) {
          console.warn('[LifeOS] Backend no disponible, usando scheduler local.', err instanceof SchedulerApiError ? err.message : err);
          newBlocks = buildTimelineLocal(schedulableTasks, get().events, get().routines, startTime, settings);
          engine = 'local-ts';
          solverStatus = 'LOCAL_FALLBACK';
        }

        const scheduledTaskIds = new Set(
          newBlocks.filter((b) => b.type === 'task' && b.task_id).map((b) => b.task_id as string)
        );

        const today = todayISO();

        set((state) => {
          const updatedTasks = state.tasks.map((task) =>
            task.status === 'pool' && scheduledTaskIds.has(task.id)
              ? { ...task, status: 'scheduled' as TaskStatus }
              : task
          );

          const session = buildSession(updatedTasks, newBlocks);
          const otherSessions = state.sessions.filter((s) => s.date !== today);

          return {
            tasks: updatedTasks,
            timeline: newBlocks,
            sessions: [...otherSessions, session],
            lastEngine: engine,
            lastSolverStatus: solverStatus,
            isGenerating: false
          };
        });

        // Programar notificaciones para el nuevo timeline
        if (settings.notifyTaskStart) {
          void scheduleTaskNotifications(newBlocks, tasks, settings.notifyTaskStartLeadMinutes);
        }
      },

      setTimeline: (blocks) => set({ timeline: blocks }),

      moveBlock: (blockId, direction) => {
        set((state) => {
          const idx = state.timeline.findIndex((b) => b.id === blockId);
          if (idx < 0) return state;
          const blocks = [...state.timeline];
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= blocks.length) return state;
          // Swap preservando los tiempos
          const a = blocks[idx];
          const b = blocks[targetIdx];
          const aDuration = a.end_time.getTime() - a.start_time.getTime();
          const bDuration = b.end_time.getTime() - b.start_time.getTime();
          // Recalcular tiempos según la posición del más temprano
          const firstStart = idx < targetIdx ? a.start_time : b.start_time;
          const first = idx < targetIdx ? b : a;
          const second = idx < targetIdx ? a : b;
          const firstDur = idx < targetIdx ? bDuration : aDuration;
          const secondDur = idx < targetIdx ? aDuration : bDuration;
          const firstEnd = new Date(firstStart.getTime() + firstDur);
          const secondStart = firstEnd;
          const secondEnd = new Date(secondStart.getTime() + secondDur);
          blocks[Math.min(idx, targetIdx)] = { ...first, start_time: firstStart, end_time: firstEnd, pinned: true };
          blocks[Math.max(idx, targetIdx)] = { ...second, start_time: secondStart, end_time: secondEnd, pinned: true };
          return { timeline: blocks };
        });
      },

      updateBreakDuration: (blockId, newMinutes) => {
        set((state) => {
          const idx = state.timeline.findIndex((b) => b.id === blockId);
          if (idx < 0) return state;
          const blocks = [...state.timeline];
          const block = blocks[idx];
          if (block.type !== 'rest' && block.type !== 'meal') return state;
          const oldDuration = block.end_time.getTime() - block.start_time.getTime();
          const newDuration = newMinutes * 60_000;
          const delta = newDuration - oldDuration;
          const newEnd = new Date(block.end_time.getTime() + delta);
          blocks[idx] = { ...block, end_time: newEnd };
          // Shift all subsequent blocks
          for (let i = idx + 1; i < blocks.length; i++) {
            blocks[i] = {
              ...blocks[i],
              start_time: new Date(blocks[i].start_time.getTime() + delta),
              end_time: new Date(blocks[i].end_time.getTime() + delta)
            };
          }
          return { timeline: blocks };
        });
      },

      deleteBlock: (blockId) => {
        set((state) => {
          const idx = state.timeline.findIndex((b) => b.id === blockId);
          if (idx < 0) return state;
          const blocks = [...state.timeline];
          const block = blocks[idx];
          const duration = block.end_time.getTime() - block.start_time.getTime();
          
          blocks.splice(idx, 1);
          // Shift all subsequent blocks backwards to fill the gap
          for (let i = idx; i < blocks.length; i++) {
            blocks[i] = {
              ...blocks[i],
              start_time: new Date(blocks[i].start_time.getTime() - duration),
              end_time: new Date(blocks[i].end_time.getTime() - duration)
            };
          }
          return { timeline: blocks };
        });
      },

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

      // ── Settings ───────────────────────────────────────────────────────────
      updateSettings: (partial) => {
        set((state) => ({
          settings: { ...state.settings, ...partial }
        }));
      },

      // ── Data management ────────────────────────────────────────────────────
      clearOldSessions: () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        set((state) => ({
          sessions: state.sessions.filter((s) => s.date >= cutoffStr)
        }));
      },

      clearAllData: () => {
        set({
          tasks: [],
          timeline: [],
          sessions: [],
          activeTimer: null,
          lastEngine: 'idle',
          lastSolverStatus: '',
          habits: []
        });
        void cancelAllNotifications();
      },

      // ── Habits ─────────────────────────────────────────────────────────────
      addHabit: (h) => {
        set((state) => ({
          habits: [
            ...state.habits,
            {
              id: createId('habit'),
              ...h,
              logs: [],
              streak: 0
            }
          ]
        }));
      },

      logHabit: (id, value) => {
        set((state) => {
          const habits = state.habits.map((habit) => {
            if (habit.id !== id) return habit;
            const now = new Date();
            const todayStr = getTodayStr();
            
            // Toggle: si ya se completó hoy, desmarcarlo
            const isUnmarking = habit.lastCompletedDate === todayStr;
            
            let newLogs = [...habit.logs];
            let newLastDate = habit.lastCompletedDate;

            if (isUnmarking) {
              newLogs = newLogs.filter(log => {
                const logDate = new Date(log.timestamp).toISOString().slice(0, 10);
                return logDate !== todayStr;
              });
              if (newLogs.length > 0) {
                const sorted = newLogs.map(l => new Date(l.timestamp).toISOString().slice(0, 10)).sort();
                newLastDate = sorted[sorted.length - 1];
              } else {
                newLastDate = undefined;
              }
            } else {
              newLogs.push({ timestamp: now, value });
              newLastDate = todayStr;
            }

            // Recalcular racha basada en el historial de logs
            let newStreak = 0;
            if (newLogs.length > 0) {
              const uniqueDates = Array.from(new Set(
                newLogs.map(l => new Date(l.timestamp).toISOString().slice(0, 10))
              )).sort().reverse();

              const mostRecent = uniqueDates[0];
              const checkDate = new Date(todayStr);
              const yesterday = new Date(checkDate);
              yesterday.setDate(yesterday.getDate() - 1);
              const yY = yesterday.getFullYear();
              const yM = String(yesterday.getMonth() + 1).padStart(2, '0');
              const yD = String(yesterday.getDate()).padStart(2, '0');
              const yesterdayStr = `${yY}-${yM}-${yD}`;

              // Solo contar racha si el último log es hoy o ayer
              if (mostRecent === todayStr || mostRecent === yesterdayStr) {
                newStreak = 1;
                let current = new Date(mostRecent);
                for (let i = 1; i < uniqueDates.length; i++) {
                   current.setDate(current.getDate() - 1);
                   if (uniqueDates[i] === current.toISOString().slice(0, 10)) {
                     newStreak++;
                   } else {
                     break;
                   }
                }
              }
            }

            return { ...habit, logs: newLogs, lastCompletedDate: newLastDate, streak: newStreak };
          });
          return { habits };
        });
      },

      updateHabit: (id, updates) => {
        set((state) => ({
          habits: state.habits.map(h => h.id === id ? { ...h, ...updates } : h)
        }));
      },

      deleteHabit: (id) => {
        set((state) => ({
          habits: state.habits.filter((h) => h.id !== id)
        }));
      },

      // ── Notes ──────────────────────────────────────────────────────────────
      addNote: (n) => {
        set((state) => ({
          notes: [
            ...state.notes,
            {
              id: createId('note'),
              ...n,
              createdAt: new Date()
            }
          ]
        }));
      },

      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id)
        }));
      },

      // ── Alarms ─────────────────────────────────────────────────────────────
      addAlarm: (a) => {
        set((state) => ({
          alarms: [
            ...state.alarms,
            { id: createId('alarm'), ...a, enabled: true }
          ]
        }));
      },
      toggleAlarm: (id, enabled) => {
        set((state) => ({
          alarms: state.alarms.map(a => a.id === id ? { ...a, enabled } : a)
        }));
      },
      deleteAlarm: (id) => {
        set((state) => ({ alarms: state.alarms.filter(a => a.id !== id) }));
      },

      // ── Events ─────────────────────────────────────────────────────────────
      addEvent: (e) => {
        set((state) => ({
          events: [...state.events, { id: createId('evt'), ...e }]
        }));
      },
      updateEvent: (id, updates) => {
        set((state) => ({
          events: state.events.map(e => e.id === id ? { ...e, ...updates } : e)
        }));
      },
      setEvents: (events) => {
        set(() => ({ events }));
      },
      deleteEvent: (id) => {
        set((state) => ({ events: state.events.filter(e => e.id !== id) }));
      },

      // ── Routines ─────────────────────────────────────────────────────────────
      updateRoutineDay: (dayOfWeek, updates) => {
        set((state) => ({
          routines: state.routines.map(r => r.dayOfWeek === dayOfWeek ? { ...r, ...updates } : r)
        }));
      },

      // ── Travel Logging ─────────────────────────────────────────────────────
      addTravelLog: (type) => {
        set((state) => {
          const now = new Date();
          const lastLog = state.travelLogs[state.travelLogs.length - 1];
          let durationMinutes: number | undefined;

          if (lastLog && lastLog.timestamp) {
            durationMinutes = Math.round((now.getTime() - lastLog.timestamp.getTime()) / 60_000);
          }

          const newLog = {
            id: createId('travel'),
            type,
            timestamp: now,
            durationMinutes
          };

          return { travelLogs: [...state.travelLogs, newLog] };
        });
      }
    }),

    // ── Persistencia ──────────────────────────────────────────────────────────
    {
      name: 'lifeos-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
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
        lastEngine: state.lastEngine,
        lastSolverStatus: state.lastSolverStatus
      }),
      merge: (persistedState, currentState) => {
        const snap = persistedState as Partial<LifeStore> | undefined;
        return {
          ...currentState,
          tasks: (snap?.tasks ?? []).map(reviveTask),
          timeline: (snap?.timeline ?? []).map(reviveBlock),
          activeTimer: reviveTimer(snap?.activeTimer ?? null),
          sessions: snap?.sessions ?? [],
          settings: { ...DEFAULT_SETTINGS, ...(snap?.settings ?? {}) },
          habits: (snap?.habits && snap.habits.length > 0) ? snap.habits : DEFAULT_HABITS,
          notes: (snap?.notes ?? []).map((n: any) => ({ ...n, createdAt: new Date(n.createdAt) })),
          alarms: snap?.alarms ?? [],
          events: (snap?.events ?? []).map((e: any) => ({ ...e, startTime: new Date(e.startTime), endTime: new Date(e.endTime) })),
          routines: snap?.routines ?? DEFAULT_ROUTINES as any,
          travelLogs: (snap?.travelLogs ?? []).map((t: any) => ({ ...t, timestamp: new Date(t.timestamp) })),
          lastEngine: snap?.lastEngine ?? 'idle',
          lastSolverStatus: snap?.lastSolverStatus ?? ''
        };
      }
    }
  )
);
