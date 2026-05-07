/**
 * Analytics domain types
 * Session tracking, replan decisions, pattern detection
 */

import type { EnergyLevel, EnergyTelemetry } from './energy';
import type { SkipReason, PostponeReason } from './execution';

export interface ReplanDecision {
  timestamp: Date;
  decision: 'accepted' | 'rejected';
  reason: string;
  previousBlocks: number;
  nextBlocks: number;
  diffMinutes: number;
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
