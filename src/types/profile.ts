/**
 * Profile domain types
 * User profile, badges, habits, alarms, travel logs
 */

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
  | 'streak_60'
  | 'active_10'
  | 'active_30'
  | 'active_60'
  | 'active_100'
  | 'perfect_day'
  | 'night_owl'
  | 'early_bird'
  | 'multitasker'
  | 'consistent_master'
  | 'zero_drain'
  | 'comeback_kid'
  | 'focus_master'
  | 'all_nighter'
  | 'speedrunner';

export interface BadgeUnlock {
  id: BadgeId;
  title: string;
  description: string;
  icon: string;
  unlockedAt: Date;
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

export interface QuickNote {
  id: string;
  title: string;
  content: string;
  emoji?: string;
  color?: string;
  reminderIntervalMinutes?: number;
  reminderAt?: string; // HH:mm
  createdAt: Date;
}

export interface TravelLog {
  id: string;
  type: 'leave_home' | 'arrive_uni' | 'leave_uni' | 'arrive_home';
  timestamp: Date;
  /** Tiempo transcurrido desde el último estado, ej: de leave_home a arrive_uni */
  durationMinutes?: number;
}
