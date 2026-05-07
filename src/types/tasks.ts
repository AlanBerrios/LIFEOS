/**
 * Tasks domain types
 * Task definitions, statuses, urgency levels
 */

export type TaskStatus = 'pool' | 'scheduled' | 'completed' | 'in_progress' | 'skipped' | 'postponed';

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
