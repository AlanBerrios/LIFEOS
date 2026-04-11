import type { AppSettings, Alarm, DailyRoutine, DailySession, Habit, LifeTimer, QuickNote, ScheduleBlock, StaticEvent, Task, TaskStatus, TravelLog, UserProfile, ExecutionRecord, SkipReason, PostponeReason, PendingCompletionCheck } from '../types';

export type { Habit } from '../types';

export interface TaskDraft {
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

export interface TaskUpdate {
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

export interface LifeStoreState {
  tasks: Task[];
  timeline: ScheduleBlock[];
  activeTimer: LifeTimer | null;
  sessions: DailySession[];
  settings: AppSettings;
  habits: Habit[];
  notes: QuickNote[];
  alarms: Alarm[];
  events: StaticEvent[];
  routines: DailyRoutine[];
  travelLogs: TravelLog[];
  userProfile: UserProfile;
  lastEngine: SchedulerEngine;
  lastSolverStatus: string;
  isGenerating: boolean;

  // FASE C: Execution Nucleus
  execution_records: ExecutionRecord[];
  pending_completion_check?: PendingCompletionCheck;
  is_replanning: boolean;
  replan_error?: string;
}

export interface LifeStoreActions {
  addXP: (amount: number, skill: keyof UserProfile['skills']) => void;

  addTask: (task: TaskDraft) => void;
  updateTask: (id: string, updates: TaskUpdate) => void;
  deleteTask: (id: string) => void;
  startTask: (id: string) => void;
  completeTask: (id: string) => void;
  skipTask: (id: string) => void;
  postponeTask: (id: string) => void;

  addHabit: (habit: Omit<Habit, 'id' | 'logs' | 'streak'>) => void;
  logHabit: (id: string, value: number) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;

  generateTimeline: (startTime?: Date) => Promise<void>;
  setTimeline: (blocks: ScheduleBlock[]) => void;
  moveBlock: (blockId: string, direction: 'up' | 'down') => void;
  updateBreakDuration: (blockId: string, newMinutes: number) => void;
  deleteBlock: (blockId: string) => void;

  startMealTimer: (durationMinutes?: number) => Promise<void>;
  stopTimer: () => Promise<void>;
  restoreMealTimer: () => void;

  updateSettings: (partial: Partial<AppSettings>) => void;
  clearOldSessions: () => void;
  clearAllData: () => void;

  addNote: (note: { title: string; content: string; reminderIntervalMinutes?: number; reminderAt?: string }) => void;
  updateNote: (id: string, updates: Partial<QuickNote>) => void;
  deleteNote: (id: string) => void;

  addAlarm: (alarm: { time: string; label: string; days: number[] }) => Promise<void>;
  toggleAlarm: (id: string, enabled: boolean) => Promise<void>;
  deleteAlarm: (id: string) => Promise<void>;

  addEvent: (event: Omit<StaticEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<StaticEvent>) => void;
  setEvents: (events: StaticEvent[]) => void;
  deleteEvent: (id: string) => void;

  updateRoutineDay: (dayOfWeek: number, updates: Partial<DailyRoutine>) => Promise<void>;
  addTravelLog: (type: TravelLog['type']) => void;

  // FASE C: Execution Nucleus Actions
  startTaskExecution: (task_id: string) => void;
  pauseTaskExecution: (task_id: string) => void;
  resumeTaskExecution: (task_id: string) => void;
  confirmCompletionOK: (task_id: string) => Promise<void>;
  confirmCompletionPartial: (task_id: string, notes: string) => Promise<void>;
  reportTaskSkipped: (task_id: string, reason: SkipReason, details: string) => Promise<void>;
  reportTaskPostponed: (task_id: string, reason: PostponeReason, details: string, postponed_until: Date) => Promise<void>;
  triggerReplanification: () => Promise<void>;
  confirmReplan: (new_schedule: ScheduleBlock[]) => Promise<void>;
  rejectReplan: () => void;
}

export type LifeStore = LifeStoreState & LifeStoreActions;
