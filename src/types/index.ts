export type TaskStatus = 'pool' | 'scheduled' | 'completed';

/**
 * Urgencia temporal de la tarea — afecta el scoring del scheduler.
 * - today: debe hacerse hoy sí o sí
 * - this_week: durante la semana
 * - this_month: en algún momento del mes
 * - someday: sin urgencia temporal
 */
export type TaskUrgency = 'today' | 'this_week' | 'this_month' | 'someday';

export interface Task {
  id: string;
  title: string;
  description?: string;
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
  type: 'task' | 'rest' | 'meal' | 'sleep';
  task_id?: string;
  title: string;
  start_time: Date;
  end_time: Date;
  /** Energía cognitiva drenada en este bloque (cognitive_load × eta_minutes) */
  cognitive_drain?: number;
  /** Si true, el usuario movió este bloque manualmente */
  pinned?: boolean;
  /** Background styling specific to events vs tasks */
  isStaticEvent?: boolean;
}

export interface StaticEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  color?: string;
  location?: string;
  isRecurring?: boolean;
}

export interface MealRoutine {
  id: string;
  type: string;
  time: string; // HH:mm
  durationMinutes: number;
}

export interface DailyRoutine {
  dayOfWeek: number; // 0=Sun ... 6=Sat
  sleepStart: string; // HH:mm
  sleepEnd: string; // HH:mm
  meals: MealRoutine[];
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
  totalWorkMinutes: number;
  /** Suma de cognitive_load × eta_minutes de todas las tareas del timeline */
  totalCognitiveDrain: number;
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
  /** Minutos antes del inicio de la tarea para notificar (default: 5) */
  notifyTaskStartLeadMinutes: number;
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
  sleepTimeStart: '23:00',
  sleepTimeEnd: '07:00',
  enableGeofencing: false,
  distractionTimeoutMinutes: 5,
  maxSocialMinutes: 20,
  alarmsBypassSilent: true
};
