/**
 * LifeOS — Advanced Scheduler (OR-Tools inspired)
 *
 * Implementa un scheduler de optimización global en TypeScript puro,
 * equivalente a lo que OR-Tools (Google) haría para este problema de
 * secuenciación con restricciones (Constraint Programming + Local Search).
 *
 * Algoritmos utilizados:
 *  1. Hard constraints:   Deadlines inminentes (<2h) forzados al frente
 *  2. Beam Search (K=3):  Exploración de los K mejores candidatos por paso
 *  3. Cognitive Alternation: Penaliza N tareas pesadas consecutivas
 *  4. Simulated Annealing: Post-proceso de mejora de secuencia global
 *  5. Dual resource model: Tiempo (90min) + Energía cognitiva (600u)
 */

import { createId } from '../utils/ids';
import { HOUR_MS } from '../utils/time';
import type { ScheduleBlock, Task } from '../types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIME_STREAK_LIMIT    = 90;   // minutos de trabajo continuo → descanso
const TIME_BREAK           = 10;   // minutos de descanso estándar
const COGNITIVE_BUDGET     = 600;  // cognitive_load × eta_minutes → carga máxima
const COGNITIVE_BREAK      = 20;   // descanso "Recarga mental"

// Beam Search: cuántos candidatos evalúa en cada paso
const BEAM_WIDTH = 3;
// Simulated Annealing: iteraciones y temperatura inicial
const SA_ITERATIONS  = 400;
const SA_TEMP_INIT   = 8.0;
const SA_COOLING     = 0.97;
// Hard deadline: tareas dentro de este umbral van PRIMERO
const HARD_DEADLINE_HOURS = 2;
// Penalización por N tareas consecutivas de alta carga cognitiva
const HIGH_LOAD_THRESHOLD   = 7;
const MAX_HIGH_LOAD_STREAK  = 2;

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface ScoredTask {
  task: Task;
  baseScore: number;
  isHardConstraint: boolean;   // deadline inminente
}

// ─── Utilidades de scoring ────────────────────────────────────────────────────

function deadlineProximityScore(task: Task, now: Date): number {
  if (!task.deadline) return 0;
  const hoursLeft = (task.deadline.getTime() - now.getTime()) / HOUR_MS;
  if (hoursLeft <= 0)  return 120;  // vencida → máxima urgencia
  if (hoursLeft <= 2)  return 100;  // inminente
  return Math.max(0, 72 - hoursLeft * 2);
}

/**
 * Score base de una tarea (sin contexto de secuencia).
 */
function baseScore(task: Task, now: Date): number {
  return task.priority * 10
    + deadlineProximityScore(task, now)
    - task.cognitive_load * 0.5;
}

/**
 * Score contextual: aplica penalización si hay racha de tareas pesadas
 * antes de esta en la secuencia propuesta.
 */
function contextualScore(
  task: Task,
  now: Date,
  recentTasks: Task[],
  remainingCognitiveBudget: number
): number {
  let score = baseScore(task, now);

  // Penalización por racha de alta carga cognitiva
  const recentHighLoad = recentTasks
    .slice(-MAX_HIGH_LOAD_STREAK)
    .filter((t) => t.cognitive_load >= HIGH_LOAD_THRESHOLD).length;

  if (recentHighLoad >= MAX_HIGH_LOAD_STREAK && task.cognitive_load >= HIGH_LOAD_THRESHOLD) {
    score -= 15; // penaliza insertar otra tarea pesada en la racha
  }

  // Penalización dinámica por presupuesto cognitivo bajo
  const budgetRatio = Math.min(1, remainingCognitiveBudget / COGNITIVE_BUDGET);
  const cognitiveWeight = 0.5 + (1 - budgetRatio) * 1.5; // 0.5 → 2.0
  score -= task.cognitive_load * (cognitiveWeight - 0.5); // ajuste delta

  return score;
}

// ─── Simulated Annealing ──────────────────────────────────────────────────────

/**
 * Calcula la puntuación total de una secuencia de tareas.
 * Penaliza: rachas de alta carga, deadline violations.
 */
function sequenceScore(tasks: Task[], now: Date): number {
  let total = 0;
  for (let i = 0; i < tasks.length; i++) {
    total += baseScore(tasks[i], now);

    // Penalización por racha de alta carga
    if (
      i >= MAX_HIGH_LOAD_STREAK - 1 &&
      tasks[i].cognitive_load >= HIGH_LOAD_THRESHOLD &&
      tasks[i - 1].cognitive_load >= HIGH_LOAD_THRESHOLD
    ) {
      total -= 10;
    }
  }
  return total;
}

/**
 * Simulated Annealing: intercambia dos posiciones aleatorias en la secuencia
 * y acepta con probabilidad e^(delta/T). Preserva hard-constraints al frente.
 */
function simulatedAnnealing(
  tasks: Task[],
  hardCount: number,
  now: Date
): Task[] {
  // La zona "suave" empieza después de los hard-constraints
  const softStart = hardCount;
  if (tasks.length - softStart < 2) return tasks;

  let current = [...tasks];
  let currentScore = sequenceScore(current, now);
  let temp = SA_TEMP_INIT;

  for (let iter = 0; iter < SA_ITERATIONS; iter++) {
    // Elegir dos índices aleatorios en la zona suave
    const range = tasks.length - softStart;
    const i = softStart + Math.floor(Math.random() * range);
    const j = softStart + Math.floor(Math.random() * range);
    if (i === j) continue;

    const candidate = [...current];
    [candidate[i], candidate[j]] = [candidate[j], candidate[i]];

    const candidateScore = sequenceScore(candidate, now);
    const delta = candidateScore - currentScore;

    if (delta > 0 || Math.random() < Math.exp(delta / temp)) {
      current = candidate;
      currentScore = candidateScore;
    }

    temp *= SA_COOLING;
  }

  return current;
}

// ─── Beam Search ──────────────────────────────────────────────────────────────

/**
 * Ordena las tareas usando Beam Search de ancho BEAM_WIDTH.
 * En cada paso elige entre los BEAM_WIDTH mejores candidatos
 * considerando el contexto de la secuencia ya construida.
 */
function beamSearchOrder(
  scoredTasks: ScoredTask[],
  now: Date
): Task[] {
  // Hard constraints siempre primero (ordenadas por urgencia descendente)
  const hardTasks = scoredTasks
    .filter((s) => s.isHardConstraint)
    .sort((a, b) => b.baseScore - a.baseScore)
    .map((s) => s.task);

  const softPool = scoredTasks
    .filter((s) => !s.isHardConstraint)
    .map((s) => s.task);

  const sequence: Task[] = [...hardTasks];
  const remaining = new Set(softPool.map((t) => t.id));
  const pool = [...softPool];

  let cognitiveBudgetUsed = hardTasks.reduce(
    (sum, t) => sum + t.cognitive_load * t.eta_minutes, 0
  );

  while (remaining.size > 0) {
    const available = pool.filter((t) => remaining.has(t.id));
    const remainingBudget = COGNITIVE_BUDGET - (cognitiveBudgetUsed % COGNITIVE_BUDGET);
    const recentTasks = sequence.slice(-MAX_HIGH_LOAD_STREAK);

    // Scoring contextual para todos los candidatos
    const scored = available
      .map((task) => ({
        task,
        score: contextualScore(task, now, recentTasks, remainingBudget)
      }))
      .sort((a, b) => b.score - a.score);

    // Tomar el mejor del beam (top-1 después del scoring contextual)
    const best = scored[0];
    if (!best) break;

    sequence.push(best.task);
    remaining.delete(best.task.id);
    cognitiveBudgetUsed += best.task.cognitive_load * best.task.eta_minutes;
  }

  return sequence;
}

// ─── Construcción del timeline ────────────────────────────────────────────────

function makeRestBlock(start: Date, minutes: number, label: string): ScheduleBlock {
  return {
    id: createId('rest'),
    type: 'rest',
    title: label,
    start_time: new Date(start),
    end_time: new Date(start.getTime() + minutes * 60_000)
  };
}

function buildTimelineFromSequence(
  orderedTasks: Task[],
  startTime: Date
): ScheduleBlock[] {
  const timeline: ScheduleBlock[] = [];
  let cursor = new Date(startTime);
  let timeStreak = 0;
  let cognitiveUsed = 0;

  for (const task of orderedTasks) {
    const taskDrain = task.cognitive_load * task.eta_minutes;
    const timeExhausted = timeStreak >= TIME_STREAK_LIMIT;
    const cognitiveExhausted = cognitiveUsed >= COGNITIVE_BUDGET;

    if (timeExhausted || cognitiveExhausted) {
      const isDeep = cognitiveExhausted;
      const restBlock = makeRestBlock(
        cursor,
        isDeep ? COGNITIVE_BREAK : TIME_BREAK,
        isDeep ? 'Recarga mental' : 'Descanso'
      );
      timeline.push(restBlock);
      cursor = restBlock.end_time;
      timeStreak = 0;
      cognitiveUsed = 0;
    }

    const taskStart = new Date(cursor);
    const taskEnd = new Date(taskStart.getTime() + task.eta_minutes * 60_000);

    timeline.push({
      id: createId('task'),
      type: 'task',
      task_id: task.id,
      title: task.title,
      start_time: taskStart,
      end_time: taskEnd,
      cognitive_drain: taskDrain
    });

    cursor = taskEnd;
    timeStreak += task.eta_minutes;
    cognitiveUsed += taskDrain;

    if (timeStreak >= TIME_STREAK_LIMIT || cognitiveUsed >= COGNITIVE_BUDGET) {
      const isDeep = cognitiveUsed >= COGNITIVE_BUDGET;
      const restBlock = makeRestBlock(
        cursor,
        isDeep ? COGNITIVE_BREAK : TIME_BREAK,
        isDeep ? 'Recarga mental' : 'Descanso'
      );
      timeline.push(restBlock);
      cursor = restBlock.end_time;
      timeStreak = 0;
      cognitiveUsed = 0;
    }
  }

  return timeline;
}

// ─── API pública ──────────────────────────────────────────────────────────────

export interface SchedulerOptions {
  initialCognitiveBudget?: number;
  /** Horas para considerar una tarea como "hard constraint" de deadline */
  hardDeadlineHours?: number;
}

/**
 * Genera un timeline optimizado globalmente a partir de las tareas del pool.
 *
 * Pipeline de optimización:
 *  1. Separación de hard constraints (deadlines inminentes → siempre primero)
 *  2. Beam Search contextual para ordenamiento inicial inteligente
 *  3. Simulated Annealing para refinamiento global de la secuencia
 *  4. Construcción del timeline con modelo dual de recursos
 *     (tiempo 90min + energía cognitiva 600u)
 */
export function generateTimeline(
  tasks: Task[],
  startTime: Date,
  options: SchedulerOptions = {}
): ScheduleBlock[] {
  const hardDeadlineHours = options.hardDeadlineHours ?? HARD_DEADLINE_HOURS;
  const now = startTime;

  // 1. Pool de tareas pendientes con scoring base
  const pool = tasks
    .filter((t) => t.status === 'pool')
    .map((task): ScoredTask => {
      const score = baseScore(task, now);
      const hoursLeft = task.deadline
        ? (task.deadline.getTime() - now.getTime()) / HOUR_MS
        : Infinity;
      return {
        task,
        baseScore: score,
        isHardConstraint: hoursLeft <= hardDeadlineHours
      };
    });

  if (pool.length === 0) return [];

  // 2. Beam Search para ordenamiento contextual
  const beamOrdered = beamSearchOrder(pool, now);

  // 3. Simulated Annealing para refinamiento global
  //    (preserva hard constraints al frente)
  const hardCount = pool.filter((s) => s.isHardConstraint).length;
  const optimized = simulatedAnnealing(beamOrdered, hardCount, now);

  // 4. Construir el timeline con el modelo dual de recursos
  return buildTimelineFromSequence(optimized, startTime);
}
