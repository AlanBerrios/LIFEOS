/**
 * Execution domain types
 * Task execution records, skip/postpone reasons, completion checks
 */

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
  postponed_until?: Date;  // ↑ CRÍTICO: cuándo reintentar automáticamente

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
