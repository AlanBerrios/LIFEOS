/**
 * LifeOS — Scheduler v2
 * Soporta: urgency, fixed_start/end, breakDurationMinutes configurable
 */

import { createId } from '../utils/ids';
import { HOUR_MS } from '../utils/time';
import type { AppSettings, ScheduleBlock, Task, TaskUrgency } from '../types';

const URGENCY_BONUS: Record<TaskUrgency, number> = {
  today: 50,
  this_week: 20,
  this_month: 5,
  someday: 0
};

const BEAM_WIDTH = 3;
const SA_ITERATIONS = 400;
const SA_TEMP_INIT = 8.0;
const SA_COOLING = 0.97;
const HARD_DEADLINE_HOURS = 2;
const HIGH_LOAD_THRESHOLD = 7;
const MAX_HIGH_LOAD_STREAK = 2;

interface ScoredTask {
  task: Task;
  baseScore: number;
  isHardConstraint: boolean;
}

function deadlineProximityScore(task: Task, now: Date): number {
  if (!task.deadline) return 0;
  const hoursLeft = (task.deadline.getTime() - now.getTime()) / HOUR_MS;
  if (hoursLeft <= 0) return 120;
  if (hoursLeft <= 2) return 100;
  return Math.max(0, 72 - hoursLeft * 2);
}

function baseScore(task: Task, now: Date): number {
  return (
    task.priority * 10 +
    deadlineProximityScore(task, now) +
    URGENCY_BONUS[task.urgency] -
    task.cognitive_load * 0.5
  );
}

function contextualScore(
  task: Task,
  now: Date,
  recentTasks: Task[],
  remainingCognitiveBudget: number
): number {
  let score = baseScore(task, now);
  const recentHighLoad = recentTasks
    .slice(-MAX_HIGH_LOAD_STREAK)
    .filter((t) => t.cognitive_load >= HIGH_LOAD_THRESHOLD).length;
  if (recentHighLoad >= MAX_HIGH_LOAD_STREAK && task.cognitive_load >= HIGH_LOAD_THRESHOLD) {
    score -= 30;
  }
  const taskBudgetCost = task.cognitive_load * task.eta_minutes;
  if (taskBudgetCost > remainingCognitiveBudget * 0.6) {
    score -= 15;
  }
  return score;
}

function scoreAll(tasks: Task[], now: Date): ScoredTask[] {
  return tasks.map((task) => ({
    task,
    baseScore: baseScore(task, now),
    isHardConstraint: !!(
      task.deadline &&
      (task.deadline.getTime() - now.getTime()) / HOUR_MS <= HARD_DEADLINE_HOURS
    ) || task.urgency === 'today'
  }));
}

function computeSequenceQuality(sequence: Task[], now: Date): number {
  return sequence.reduce((sum, t) => sum + baseScore(t, now), 0);
}

function simulatedAnnealing(sequence: Task[], now: Date): Task[] {
  let current = [...sequence];
  let currentQuality = computeSequenceQuality(current, now);
  let temp = SA_TEMP_INIT;

  for (let iter = 0; iter < SA_ITERATIONS; iter++) {
    if (current.length < 2) break;
    const i = Math.floor(Math.random() * current.length);
    const j = Math.floor(Math.random() * current.length);
    if (i === j) continue;

    const candidate = [...current];
    [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
    const candidateQuality = computeSequenceQuality(candidate, now);
    const delta = candidateQuality - currentQuality;

    if (delta > 0 || Math.random() < Math.exp(delta / temp)) {
      current = candidate;
      currentQuality = candidateQuality;
    }
    temp *= SA_COOLING;
  }
  return current;
}

export function generateTimeline(
  tasks: Task[],
  now: Date,
  settings?: Partial<AppSettings>
): ScheduleBlock[] {
  const breakMin = settings?.breakDurationMinutes ?? 10;
  const longBreakMin = settings?.longBreakDurationMinutes ?? 20;
  const streakLimit = settings?.workStreakLimitMinutes ?? 90;
  const cognitiveBudget = 600;

  const schedulableTasks = tasks.filter(
    (t) => t.status === 'pool' || t.status === 'scheduled'
  );
  if (schedulableTasks.length === 0) return [];

  const scored = scoreAll(schedulableTasks, now);
  const hardFirst = scored.filter((s) => s.isHardConstraint).sort((a, b) => b.baseScore - a.baseScore);
  const flexible = scored.filter((s) => !s.isHardConstraint);

  // Beam Search para flexible
  type Beam = { sequence: Task[]; recentTasks: Task[]; cognitiveBudgetLeft: number; score: number };
  let beams: Beam[] = [{ sequence: [], recentTasks: [], cognitiveBudgetLeft: cognitiveBudget, score: 0 }];
  const remainingFlexible = [...flexible.map((s) => s.task)];

  for (let step = 0; step < remainingFlexible.length; step++) {
    const candidates: Beam[] = [];
    for (const beam of beams) {
      const available = remainingFlexible.filter(
        (t) => !beam.sequence.find((s) => s.id === t.id)
      );
      if (available.length === 0) {
        candidates.push(beam);
        continue;
      }
      const scored2 = available.map((t) => ({
        task: t,
        score: contextualScore(t, now, beam.recentTasks, beam.cognitiveBudgetLeft)
      }));
      scored2.sort((a, b) => b.score - a.score);
      for (const { task } of scored2.slice(0, BEAM_WIDTH)) {
        candidates.push({
          sequence: [...beam.sequence, task],
          recentTasks: [...beam.recentTasks.slice(-MAX_HIGH_LOAD_STREAK), task],
          cognitiveBudgetLeft: beam.cognitiveBudgetLeft - task.cognitive_load * task.eta_minutes,
          score: beam.score + contextualScore(task, now, beam.recentTasks, beam.cognitiveBudgetLeft)
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    beams = candidates.slice(0, BEAM_WIDTH);
  }

  const bestFlexible = beams[0]?.sequence ?? [];
  const finalSequence = simulatedAnnealing(
    [...hardFirst.map((s) => s.task), ...bestFlexible],
    now
  );

  // ── Build timeline blocks ─────────────────────────────────────────────────
  const blocks: ScheduleBlock[] = [];
  let cursor = new Date(now);
  let workStreakMinutes = 0;
  let cognitiveUsed = 0;

  for (const task of finalSequence) {
    // Si la tarea tiene hora fija, insertar descanso hasta ese momento
    if (task.fixed_start && task.fixed_start > cursor) {
      const waitMinutes = (task.fixed_start.getTime() - cursor.getTime()) / 60_000;
      if (waitMinutes > 2) {
        blocks.push({
          id: createId('rest'),
          type: 'rest',
          title: 'Espera',
          start_time: new Date(cursor),
          end_time: new Date(task.fixed_start)
        });
      }
      cursor = new Date(task.fixed_start);
      workStreakMinutes = 0;
    }

    // Descanso por racha de trabajo
    if (workStreakMinutes >= streakLimit) {
      const breakStart = new Date(cursor);
      const breakEnd = new Date(cursor.getTime() + breakMin * 60_000);
      blocks.push({
        id: createId('rest'),
        type: 'rest',
        title: 'Descanso',
        start_time: breakStart,
        end_time: breakEnd
      });
      cursor = breakEnd;
      workStreakMinutes = 0;
    }

    // Descanso cognitivo
    if (cognitiveUsed >= cognitiveBudget) {
      const breakStart = new Date(cursor);
      const breakEnd = new Date(cursor.getTime() + longBreakMin * 60_000);
      blocks.push({
        id: createId('rest'),
        type: 'rest',
        title: 'Recarga mental',
        start_time: breakStart,
        end_time: breakEnd
      });
      cursor = breakEnd;
      cognitiveUsed = 0;
    }

    const taskDuration = task.eta_minutes * 60_000;
    const taskEnd = task.fixed_end ?? new Date(cursor.getTime() + taskDuration);
    const drain = task.cognitive_load * task.eta_minutes;

    blocks.push({
      id: createId('block'),
      type: 'task',
      task_id: task.id,
      title: task.title,
      start_time: new Date(cursor),
      end_time: taskEnd,
      cognitive_drain: drain
    });

    cursor = taskEnd;
    workStreakMinutes += task.eta_minutes;
    cognitiveUsed += drain;

    // Descanso corto entre tareas (siempre)
    const shortBreakEnd = new Date(cursor.getTime() + breakMin * 60_000);
    blocks.push({
      id: createId('rest'),
      type: 'rest',
      title: 'Descanso',
      start_time: new Date(cursor),
      end_time: shortBreakEnd
    });
    cursor = shortBreakEnd;
  }

  return blocks;
}
