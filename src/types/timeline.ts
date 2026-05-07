/**
 * Timeline domain types
 * Schedule blocks, static events, and temporal structure
 */

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
