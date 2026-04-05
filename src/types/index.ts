export type TaskStatus = 'pool' | 'scheduled' | 'completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  eta_minutes: number;
  priority: 1 | 2 | 3 | 4 | 5;
  cognitive_load: number;
  deadline?: Date;
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
 * Se registra automáticamente cuando el usuario presiona "Organizar mi día".
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
