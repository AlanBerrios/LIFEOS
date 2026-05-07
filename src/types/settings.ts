/**
 * Settings domain types
 * Application configuration and defaults
 */

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

export const DEFAULT_SETTINGS: AppSettings = {
  breakDurationMinutes: 10,
  longBreakDurationMinutes: 20,
  workStreakLimitMinutes: 90,
  notifyTaskStart: true,
  notifyPendingIntervalMinutes: 60,
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
