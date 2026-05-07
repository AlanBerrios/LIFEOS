/**
 * Routines domain types
 * Daily routines, meals, transits, and overrides
 */

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

export interface LifeTimer {
  id: string;
  label: 'meal';
  startedAt: Date;
  endsAt: Date;
  durationMinutes: number;
  active: boolean;
}
