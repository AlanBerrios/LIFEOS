import type { AppSettings, Alarm, DailyEnergyReport, DailyRoutine, DailySession, Habit, LifeTimer, QuickNote, RoutineDayOverride, ScheduleBlock, StaticEvent, Task, TaskStatus, TravelLog, UserProfile, ExecutionRecord, SkipReason, PostponeReason, PendingCompletionCheck, ReplanDecision, EnergyLevel } from '../types';
import type { AlertButtonConfig } from '../components/CustomAlertDialog';

export type { Habit } from '../types';

export interface TaskDraft {
  title: string;
  description?: string;
  emoji?: string;
  color?: string;
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
  emoji?: string;
  color?: string;
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

export interface MoveSuggestion {
  targetIndex: number;
  startTime: Date;
  direction: 'up' | 'down';
}

export interface MoveBlockResult {
  moved: boolean;
  reason?: 'out_of_bounds' | 'blocked_by_fixed' | 'invalid_block';
  suggestions?: MoveSuggestion[];
}

export interface ScheduleGenerationOptions {
  preferredTaskIds?: string[];
  suppressOverflowPrompt?: boolean;
}

export interface ScheduleOverflowCandidate {
  id: string;
  title: string;
  priority: Task['priority'];
  urgency: Task['urgency'];
  eta_minutes: number;
  cognitive_load: number;
  deadline?: Date | null;
}

export interface ScheduleOverflowPromptState {
  visible: boolean;
  reason: string;
  createdAt: Date;
  candidateTasks: ScheduleOverflowCandidate[];
  recommendedTaskIds: string[];
  maxSelections: number;
}

export interface GlobalAlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButtonConfig[];
}

export interface SchedulerParityState {
  status: 'ok' | 'drift' | 'remote_unavailable';
  checkedAt: Date;
  threshold: number;
  summary: string;
  metrics: {
    localTaskCount: number;
    remoteTaskCount: number;
    commonTaskCount: number;
    onlyLocalCount: number;
    onlyRemoteCount: number;
    avgStartDeltaMinutes: number;
    avgDurationDeltaMinutes: number;
    orderMismatchCount: number;
    divergenceScore: number;
    withinThreshold: boolean;
  };
  remote?: {
    available: boolean;
    engine?: string;
    solverStatus?: string;
    solveTimeMs?: number;
    error?: string;
  };
}

export interface TransitArrivalRecord {
  id: string;
  date: string; // YYYY-MM-DD
  routineBlockKey: string;
  transitRoutineId: string;
  transitLabel: string;
  plannedStart: Date;
  plannedEnd: Date;
  actualArrivalTime: Date;
  delayMinutes: number;
  observedDurationMinutes?: number;
  response: 'on_time' | 'late' | 'dismissed';
}

export interface PendingTransitArrivalPromptState {
  visible: boolean;
  date: string; // YYYY-MM-DD
  blockId: string;
  routineBlockKey: string;
  transitRoutineId: string;
  transitLabel: string;
  plannedStart: Date;
  plannedEnd: Date;
}

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
  routineOverrides: RoutineDayOverride[];
  completedGhostBlocks: ScheduleBlock[];
  habitReminderNotificationId?: string | null;
  pendingTaskEditId?: string | null;
  travelLogs: TravelLog[];
  userProfile: UserProfile;
  lastEngine: SchedulerEngine;
  lastSolverStatus: string;
  isGenerating: boolean;
  last_replan_reason?: string;
  replan_history: ReplanDecision[];
  pending_schedule_overflow?: ScheduleOverflowPromptState;
  global_alert?: GlobalAlertState;
  last_scheduler_parity?: SchedulerParityState;
  daily_energy_reports: DailyEnergyReport[];
  energy_suggested_task_ids: string[];
  energy_suggestion_bias: number;
  transit_arrival_records: TransitArrivalRecord[];
  pending_transit_arrival_prompt?: PendingTransitArrivalPromptState;

  // FASE C: Execution Nucleus
  execution_records: ExecutionRecord[];
  pending_completion_check?: PendingCompletionCheck;
  is_replanning: boolean;
  replan_error?: string;

  // Rest days: array de fechas (YYYY-MM-DD) donde usuario declaró "hoy es descanso"
  rest_days: string[];
}

export interface LifeStoreActions {
  addXP: (amount: number, skill: keyof UserProfile['skills']) => void;
  addConsistencyActivity: (date?: string) => void;

  addTask: (task: TaskDraft) => void;
  updateTask: (id: string, updates: TaskUpdate) => void;
  deleteTask: (id: string) => void;
  startTask: (id: string) => void;
  completeTask: (id: string) => void;
  skipTask: (id: string) => void;
  postponeTask: (id: string) => void;

  addHabit: (habit: Omit<Habit, 'id' | 'logs' | 'streak'>) => void;
  logHabit: (id: string, value: number) => void;
  unlogHabit: (id: string) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;

  generateTimeline: (startTime?: Date, options?: ScheduleGenerationOptions) => Promise<void>;
  setTimeline: (blocks: ScheduleBlock[]) => void;
  moveBlock: (blockId: string, direction: 'up' | 'down') => MoveBlockResult;
  moveBlockToIndex: (blockId: string, targetIndex: number) => MoveBlockResult;
  updateBreakDuration: (blockId: string, newMinutes: number) => void;
  deleteBlock: (blockId: string) => void;
  convertCompletedGhostToFree: (blockId: string) => void;

  startMealTimer: (durationMinutes?: number) => Promise<void>;
  stopTimer: () => Promise<void>;
  restoreMealTimer: () => void;

  updateSettings: (partial: Partial<AppSettings>) => void;
  clearOldSessions: () => void;
  clearAllData: () => void;

  addNote: (note: { title: string; content: string; emoji?: string; color?: string; reminderIntervalMinutes?: number; reminderAt?: string }) => void;
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

  // Rest day management
  markRestDay: (date?: string) => void;
  clearRestDay: (date?: string) => void;
  isRestDay: (date?: string) => boolean;

  // FASE C: Execution Nucleus Actions
  startTaskExecution: (task_id: string) => void;
  pauseTaskExecution: (task_id: string) => void;
  resumeTaskExecution: (task_id: string) => void;
  confirmCompletionOK: (task_id: string) => Promise<void>;
  confirmCompletionPartial: (task_id: string, notes: string) => Promise<void>;
  reportTaskSkipped: (task_id: string, reason: SkipReason, details: string) => Promise<void>;
  reportTaskPostponed: (task_id: string, reason: PostponeReason, details: string, postponed_until: Date) => Promise<void>;
  triggerReplanification: () => Promise<void>;
  resolveScheduleOverflow: (keepTaskIds: string[]) => Promise<void>;
  dismissScheduleOverflow: () => void;
  showGlobalAlert: (title: string, message?: string, buttons?: AlertButtonConfig[]) => void;
  dismissGlobalAlert: () => void;
  reportDailyEnergy: (level: EnergyLevel, fatigue: 'low' | 'medium' | 'high', note?: string) => void;
  applyEnergyBasedSuggestions: () => Promise<void>;
  checkTransitArrivalPrompt: (now?: Date) => void;
  respondTransitArrivalPrompt: (arrivedOnTime: boolean, actualArrivalTime?: Date) => void;
  dismissTransitArrivalPrompt: () => void;
  addReplanDecision: (
    decision: 'accepted' | 'rejected',
    reason: string,
    previousBlocks: number,
    nextBlocks: number,
    diffMinutes: number
  ) => void;
  confirmReplan: (new_schedule: ScheduleBlock[]) => Promise<void>;
  rejectReplan: () => void;
}

export type LifeStore = LifeStoreState & LifeStoreActions;
