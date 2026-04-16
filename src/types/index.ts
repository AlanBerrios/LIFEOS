export type TaskStatus = 'pool' | 'scheduled' | 'completed' | 'in_progress' | 'skipped' | 'postponed';

/**
 * Urgencia temporal de la tarea — afecta el scoring del scheduler.
 * - today: debe hacerse hoy sí o sí
 * - this_week: durante la semana
 * - this_month: en algún momento del mes
 * - someday: sin urgencia temporal
 */
export type TaskUrgency = 'today' | 'this_week' | 'this_month' | 'someday';

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export interface EnergyTelemetry {
  evaluatedAt: Date;
  completedTaskCount: number;
  completedTaskIds: string[];
  suggestedHitCount: number;
  suggestedHitRate: number;
  observedAverageLoad: number;
  observedAveragePriority: number;
  observedAverageEtaMinutes: number;
  expectedAverageLoad: number;
  calibration: 'under' | 'aligned' | 'over';
  biasDelta: number;
}

export interface DailyEnergyReport {
  date: string; // YYYY-MM-DD
  level: EnergyLevel;
  fatigue: 'low' | 'medium' | 'high';
  note?: string;
  created_at: Date;
  telemetry?: EnergyTelemetry;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
  color?: string;
  eta_minutes: number;
  priority: 1 | 2 | 3 | 4 | 5;
  cognitive_load: number;
  deadline?: Date;
  /** Hora/fecha de inicio fija (hard-constraint en el scheduler) */
  fixed_start?: Date;
  /** Hora/fecha de fin fija */
  fixed_end?: Date;
  /** Urgencia temporal de la tarea */
  urgency: TaskUrgency;
  status: TaskStatus;
  created_at: Date;
}

export interface ScheduleBlock {
  id: string; // Puede ser de una tarea o generado (ej. "rest-1")
  type: 'task' | 'rest' | 'meal' | 'sleep' | 'transit' | 'habit';
  task_id?: string;
  habit_id?: string;
  title: string;
  start_time: Date;
  end_time: Date;
  /** Energía cognitiva drenada en este bloque (cognitive_load × eta_minutes) */
  cognitive_drain?: number;
  /** Si true, el usuario movió este bloque manualmente */
  pinned?: boolean;
  /** Background styling specific to events vs tasks */
  isStaticEvent?: boolean;
  /** Bloque de rutina diaria; no debe moverse manualmente */
  isRoutineBlock?: boolean;
  /** Bloque visual de una tarea completada que se mantiene visible hasta su fin */
  isCompletedGhost?: boolean;
  /** Clave estable para overrides diarios (ej: meal:<id>, transit:<id>, sleep) */
  routineBlockKey?: string;
  /** Bloque blando: recordatorio visual que no impone restricción dura al plan */
  isSoftBlock?: boolean;
}

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export interface StaticEvent {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
  color?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  isRecurring?: boolean;
  /** Minutos de antelación para el recordatorio */
  reminderMinutes?: number;
  /** Regla de repetición */
  recurrence?: {
    frequency: RecurrenceFrequency;
    daysOfWeek?: number[]; // 0=Domingo, 1=Lunes...
    interval?: number;     // Cada X semanas/meses
    endDate?: Date;
  };
}

export interface MealRoutine {
  id: string;
  type: string;
  time: string; // HH:mm
  durationMinutes: number;
}

export interface TransitRoutine {
  id: string;
  label: string;
  time: string; // HH:mm
  durationMinutes: number;
  /** Hora objetivo de llegada (HH:mm). Si existe, prevalece para derivar duración. */
  arrivalTime?: string;
}

export interface DailyRoutine {
  dayOfWeek: number; // 0=Sun ... 6=Sat
  sleepStart: string; // HH:mm
  sleepEnd: string; // HH:mm
  meals: MealRoutine[];
  transits: TransitRoutine[];
}

export interface RoutineBlockOverride {
  routineBlockKey: string;
  hidden?: boolean;
  startTime?: string; // HH:mm
  durationMinutes?: number;
  title?: string;
}

export interface RoutineDayOverride {
  date: string; // YYYY-MM-DD
  blocks: RoutineBlockOverride[];
}

export interface ReplanDecision {
  timestamp: Date;
  decision: 'accepted' | 'rejected';
  reason: string;
  previousBlocks: number;
  nextBlocks: number;
  diffMinutes: number;
}

export interface LifeTimer {
  id: string;
  label: 'meal';
  startedAt: Date;
  endsAt: Date;
  durationMinutes: number;
  active: boolean;
}

/**
 * Snapshot de una sesión de organización diaria.
 */
export interface DailySession {
  id: string;
  /** Fecha en formato YYYY-MM-DD */
  date: string;
  tasksCompleted: number;
  tasksScheduled: number;
  tasksSkipped: number;
  tasksPostponed: number;
  totalWorkMinutes: number;
  /** Suma de cognitive_load × eta_minutes de todas las tareas del timeline */
  totalCognitiveDrain: number;
  expGainedToday: number;

  // ============================================
  // FASE C: Extended Execution Tracking
  // ============================================
  
  /** Timeline detallado de ejecución de bloques */
  execution_timeline?: Array<{
    block_id: string;
    block_title: string;
    planned_start: Date;
    planned_end: Date;
    actual_start: Date | null;
    actual_end: Date | null;
    status: 'pending' | 'completed' | 'skipped' | 'postponed';
    skip_reason?: SkipReason;
    postpone_reason?: PostponeReason;
    notes?: string;
  }>;
  
  /** Cuántos bloques se desviaron del plan */
  deviations_count?: number;
  
  /** Cuántas veces se replaneó el día */
  replan_count?: number;
  
  /** Puntos de feedback de usuario (basado en skip/postpone quality) */
  user_feedback_points?: number;
  
  /** Patrones detectados (ej: "distraction_after_breaks") para futuro análisis */
  detected_patterns?: Array<{
    pattern: string;
    confidence: number;  // 0-1
  }>;

  /** Métricas accionables con drill-down por categoría */
  metric_drilldowns?: Array<{
    key: 'completed' | 'skipped' | 'postponed' | 'scheduled' | 'drain' | 'replan';
    label: string;
    value: number;
    unit: string;
    context: string[];
    taskTitles: string[];
  }>;

  /** Razones y decisiones que explican por qué cambió el plan */
  decision_context?: Array<{
    label: string;
    count: number;
    context: string[];
  }>;

  /** Reporte de energía/cansancio del día para ajustar sugerencias del plan */
  energy_reported?: {
    level: EnergyLevel;
    fatigue: 'low' | 'medium' | 'high';
    note?: string;
    telemetry?: EnergyTelemetry;
  };

  /** IDs sugeridos por motor de energía para priorizar en el plan */
  suggested_task_ids?: string[];
}

export interface UserProfile {
  level: number;
  currentXP: number;
  skills: {
    focus: number;      // Tareas
    vitality: number;   // Hábitos, Sueño
    discipline: number; // Rutinas, Consistencia
    wisdom: number;     // Notas, Análisis
  };
  consistency: {
    currentStreak: number;
    bestStreak: number;
    totalActiveDays: number;
    lastActiveDate?: string; // YYYY-MM-DD
  };
  badges: BadgeUnlock[];
}

export type BadgeId =
  | 'streak_3'
  | 'streak_7'
  | 'streak_14'
  | 'streak_30'
  | 'active_10'
  | 'active_30'
  | 'active_60';

export interface BadgeUnlock {
  id: BadgeId;
  title: string;
  description: string;
  icon: string;
  unlockedAt: Date;
}

/** Configuración global de la app */
export interface AppSettings {
  /** Minutos de descanso corto entre racha de trabajo (default: 10) */
  breakDurationMinutes: number;
  /** Minutos de descanso cognitivo largo (default: 20) */
  longBreakDurationMinutes: number;
  /** Minutos de trabajo continuo antes de forzar descanso (default: 90) */
  workStreakLimitMinutes: number;
  /** Notificación al inicio de cada tarea del timeline */
  notifyTaskStart: boolean;
  /** Recordatorio de tareas pendientes cada X minutos (0 = desactivado) */
  notifyPendingIntervalMinutes: number;
  /** Alerta si hay tarea de prioridad alta sin completar al final del día */
  notifyImportantUnfinished: boolean;
  notifyTaskStartLeadMinutes: number;
  showTutorial: boolean;
  /** Paso actual del tutorial guiado */
  tutorialStep: number;
  // --- V2.1 Expansion ---
  /** Hora de dormir (HH:mm) */
  sleepTimeStart: string;
  /** Hora de despertar (HH:mm) */
  sleepTimeEnd: string;
  /** Ubicación de casa (Geofencing) */
  homeLocation?: { latitude: number; longitude: number };
  /** Ubicación de universidad/trabajo */
  workLocation?: { latitude: number; longitude: number };
  /** Habilitar rastreo de transporte */
  enableGeofencing: boolean;
  /** Minutos fuera de la app antes de enviar reto de distracción */
  distractionTimeoutMinutes: number;
  /** Max allowed minutes in social media apps before alert */
  maxSocialMinutes: number;
  /** Force alarms to bypass silent mode */
  alarmsBypassSilent: boolean;
  /** URL pública de calendario compartida en formato .ics */
  icsCalendarUrl?: string;
  /** Tema visual de la app */
  uiThemeMode: 'dark' | 'light';
  /** Color principal para botones, indicadores y acentos */
  uiAccentColor: string;
  /** Color de texto sobre superficies de acento */
  uiAccentTextMode: 'auto' | 'light' | 'dark';
  /** Mantiene visible un bloque completado hasta su hora fin */
  keepCompletedGhostBlock: boolean;
  /** Última fecha en que se mostró el prompt de inicio del día (YYYY-MM-DD) */
  last_daily_start_date?: string;
}

export interface TravelLog {
  id: string;
  type: 'leave_home' | 'arrive_uni' | 'leave_uni' | 'arrive_home';
  timestamp: Date;
  /** Tiempo transcurrido desde el último estado, ej: de leave_home a arrive_uni */
  durationMinutes?: number;
}

export interface Alarm {
  id: string;
  time: string; // HH:mm
  label: string;
  /** Array de días donde 0=Dom, 1=Lun... 6=Sab */
  days: number[];
  enabled: boolean;
  /** IDs reales programados en expo-notifications para poder cancelar/updatear */
  notificationIds?: string[];
}

export interface HabitLog {
  timestamp: Date;
  value: number; // 1 for boolean, or specific amount like 0.5 (liters)
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  goalValue: number; // e.g. 2.0
  goalUnit: string; // e.g. "litros", "min", "check"
  logs: HabitLog[];
  streak: number;
  lastCompletedDate?: string; // YYYY-MM-DD
  color?: string;
}

export interface QuickNote {
  id: string;
  title: string;
  content: string;
  reminderIntervalMinutes?: number;
  reminderAt?: string; // HH:mm
  createdAt: Date;
}

export const DEFAULT_SETTINGS: AppSettings = {
  breakDurationMinutes: 10,
  longBreakDurationMinutes: 20,
  workStreakLimitMinutes: 90,
  notifyTaskStart: true,
  notifyPendingIntervalMinutes: 0,
  notifyImportantUnfinished: true,
  notifyTaskStartLeadMinutes: 5,
  showTutorial: true,
  tutorialStep: 0,
  sleepTimeStart: '23:00',
  sleepTimeEnd: '07:00',
  enableGeofencing: false,
  distractionTimeoutMinutes: 5,
  maxSocialMinutes: 20,
  alarmsBypassSilent: true,
  uiThemeMode: 'dark',
  uiAccentColor: '#8FBF00',
  uiAccentTextMode: 'auto',
  keepCompletedGhostBlock: true
};

// ============================================
// FASE C: Nucleus de Ejecución Real
// ============================================

/**
 * Razones por las que una tarea fue saltada/no completada.
 * Usado para análisis de patrones y futuras recomendaciones.
 */
export type SkipReason = 
  | 'distraction'      // User se distrajo
  | 'urgent_task'      // Salió algo urgente
  | 'low_energy'       // No tenía energía
  | 'blocker'          // Hay un obstáculo
  | 'system_issue'     // Problema técnico
  | 'other';           // Otro

/**
 * Razones por las que una tarea fue pospuesta.
 */
export type PostponeReason = 
  | 'need_more_time'   // Necesita más tiempo
  | 'blocked'          // Está bloqueada
  | 'deprioritized'    // Se despriorizó
  | 'other';           // Otro

/**
 * Resultado de una tentativa de ejecución de tarea.
 */
export type ExecutionResultCode = 
  | 'completed'        // Se completó completamente
  | 'partial'          // Se completó parcialmente
  | 'failed'           // No se hizo
  | 'not_started';     // No se inició

/**
 * Record del intento de ejecución de una tarea (FASE C).
 * Cada vez que el user inicia/completa/salta una tarea, se graba aquí.
 */
export interface ExecutionRecord {
  // Identidad
  id: string;
  task_id: string;
  attempt_number: number;  // Intento número cuánto (para reintentos)
  
  // Timeline
  planned_start: Date;     // Cuándo estaba planeado
  planned_end: Date;       // Cuándo debía terminar
  actual_start: Date | null;      // Cuándo realmente empezó
  actual_end: Date | null;        // Cuándo realmente terminó
  
  // Estado de la tentativa
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'postponed';
  result_code: ExecutionResultCode;
  
  // Skip: por qué no se hizo
  skip_reason?: SkipReason;
  skip_reason_details?: string;
  
  // Postpone: por qué se reprogramó
  postpone_reason?: PostponeReason;
  postpone_reason_details?: string;
  postponed_until?: Date;  // ← CRÍTICO: cuándo reintentar automáticamente
  
  // Métricas
  work_minutes: number;               // Tiempo real dedicado (actual_end - actual_start)
  estimated_minutes: number;          // Tiempo que se había estimado (planned_end - planned_start)
  cognitive_drain_reported?: number;  // 0-100 self-report de fatiga
  
  // Notas
  notes_before?: string;   // Contexto al iniciar
  notes_after?: string;    // Qué pasó, lecciones
  
  created_at: Date;
}

/**
 * Completion check dialog state para UI (FASE C).
 * Cuando user intenta marcar tarea como completada, abrimos este dialog.
 */
export interface PendingCompletionCheck {
  task_id: string;
  task_title: string;
  status: 'pending' | 'partial' | 'not_started';  // Qué pasó?
  timestamp: Date;
}
