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
  id: string;
  type: 'task' | 'rest' | 'meal';
  task_id?: string;
  title: string;
  start_time: Date;
  end_time: Date;
  /** Energía cognitiva drenada en este bloque (cognitive_load × eta_minutes) */
  cognitive_drain?: number;
  /** Si true, el usuario movió este bloque manualmente */
  pinned?: boolean;
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
}

export const DEFAULT_SETTINGS: AppSettings = {
  breakDurationMinutes: 10,
  longBreakDurationMinutes: 20,
  workStreakLimitMinutes: 90,
  notifyTaskStart: true,
  notifyPendingIntervalMinutes: 0,
  notifyImportantUnfinished: true,
  notifyTaskStartLeadMinutes: 5
};
