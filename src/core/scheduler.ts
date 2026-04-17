/**
 * LifeOS — Scheduler v2
 * Soporta: urgency, fixed_start/end, breakDurationMinutes configurable
 */

import { createId } from '../utils/ids';
import { HOUR_MS } from '../utils/time';
import { getEventsForDate } from '../utils/events';
import type { AppSettings, DailyRoutine, Habit, RoutineBlockOverride, RoutineDayOverride, ScheduleBlock, StaticEvent, Task, TaskUrgency } from '../types';

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

export function rankTasksByImportance(tasks: Task[], now: Date): Task[] {
  return scoreAll(tasks, now)
    .sort((a, b) => {
      if (a.isHardConstraint !== b.isHardConstraint) {
        return a.isHardConstraint ? -1 : 1;
      }
      return b.baseScore - a.baseScore;
    })
    .map((entry) => entry.task);
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
  remainingCognitiveBudget: number,
  preferredTaskIds: Set<string>
): number {
  let score = baseScore(task, now);
  if (preferredTaskIds.has(task.id)) {
    score += 35;
  }
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

function scoreAll(tasks: Task[], now: Date, preferredTaskIds = new Set<string>()): ScoredTask[] {
  return tasks.map((task) => ({
    task,
    baseScore: baseScore(task, now) + (preferredTaskIds.has(task.id) ? 25 : 0),
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

function buildRoutineBlocks(routines: DailyRoutine[], now: Date, routineOverrides: RoutineDayOverride[]): ScheduleBlock[] {
  const routine = routines.find((currentRoutine) => currentRoutine.dayOfWeek === now.getDay());
  if (!routine) return [];

  const blocks: ScheduleBlock[] = [];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const dayKey = now.toISOString().slice(0, 10);
  const dayOverride = routineOverrides.find((item) => item.date === dayKey);
  const overrideMap = new Map<string, RoutineBlockOverride>((dayOverride?.blocks ?? []).map((item) => [item.routineBlockKey, item]));

  const toDateAt = (time: string): Date => {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date(now);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const sleepStartMinutes = Number(routine.sleepStart.slice(0, 2)) * 60 + Number(routine.sleepStart.slice(3));
  const sleepEndMinutes = Number(routine.sleepEnd.slice(0, 2)) * 60 + Number(routine.sleepEnd.slice(3));
  const overnightSleep = sleepStartMinutes > sleepEndMinutes;
  const inSleepWindow = overnightSleep
    ? nowMinutes >= sleepStartMinutes || nowMinutes < sleepEndMinutes
    : nowMinutes >= sleepStartMinutes && nowMinutes < sleepEndMinutes;

  if (inSleepWindow || nowMinutes < sleepStartMinutes || (!overnightSleep && nowMinutes < sleepEndMinutes)) {
    const sleepOverride = overrideMap.get('sleep');
    if (!sleepOverride?.hidden) {
    const sleepStart = inSleepWindow ? new Date(now) : toDateAt(routine.sleepStart);
    const sleepEnd = toDateAt(routine.sleepEnd);
    if (overnightSleep && sleepEnd <= sleepStart) {
      sleepEnd.setDate(sleepEnd.getDate() + 1);
    }

    if (sleepOverride?.startTime) {
      const [h, m] = sleepOverride.startTime.split(':').map(Number);
      sleepStart.setHours(h, m, 0, 0);
    }
    if (sleepOverride?.durationMinutes && sleepOverride.durationMinutes > 0) {
      sleepEnd.setTime(sleepStart.getTime() + sleepOverride.durationMinutes * 60_000);
    }

    if (sleepEnd > now) {
      blocks.push({
        id: createId('rest'),
        type: 'sleep',
        title: sleepOverride?.title || 'Descanso nocturno 😴',
        start_time: sleepStart,
        end_time: sleepEnd,
        pinned: true,
        isRoutineBlock: true,
        routineBlockKey: 'sleep'
      });
    }
    }
  }

  for (const meal of routine.meals) {
    const routineBlockKey = `meal:${meal.id}`;
    const mealOverride = overrideMap.get(routineBlockKey);
    if (mealOverride?.hidden) continue;

    const mealStart = toDateAt(meal.time);
    if (mealOverride?.startTime) {
      const [h, m] = mealOverride.startTime.split(':').map(Number);
      mealStart.setHours(h, m, 0, 0);
    }
    const duration = mealOverride?.durationMinutes && mealOverride.durationMinutes > 0
      ? mealOverride.durationMinutes
      : meal.durationMinutes;
    const mealEnd = new Date(mealStart.getTime() + duration * 60_000);
    if (mealEnd <= now) continue;

    blocks.push({
      id: meal.id,
      type: 'meal',
      title: mealOverride?.title || `🍔 ${meal.type}`,
      start_time: mealStart,
      end_time: mealEnd,
      pinned: true,
      isRoutineBlock: true,
      routineBlockKey
    });
  }

  for (const transit of routine.transits) {
    const routineBlockKey = `transit:${transit.id}`;
    const transitOverride = overrideMap.get(routineBlockKey);
    if (transitOverride?.hidden) continue;

    const transitStart = toDateAt(transit.time);
    if (transitOverride?.startTime) {
      const [h, m] = transitOverride.startTime.split(':').map(Number);
      transitStart.setHours(h, m, 0, 0);
    }
    let duration = transitOverride?.durationMinutes && transitOverride.durationMinutes > 0
      ? transitOverride.durationMinutes
      : transit.durationMinutes;
    if ((!transitOverride?.durationMinutes || transitOverride.durationMinutes <= 0) && transit.arrivalTime) {
      const [arrivalH, arrivalM] = transit.arrivalTime.split(':').map(Number);
      if (!Number.isNaN(arrivalH) && !Number.isNaN(arrivalM)) {
        const arrival = new Date(transitStart);
        arrival.setHours(arrivalH, arrivalM, 0, 0);
        if (arrival.getTime() <= transitStart.getTime()) {
          arrival.setDate(arrival.getDate() + 1);
        }
        duration = Math.max(1, Math.round((arrival.getTime() - transitStart.getTime()) / 60_000));
      }
    }
    const transitEnd = new Date(transitStart.getTime() + duration * 60_000);
    if (transitEnd <= now) continue;

    blocks.push({
      id: transit.id,
      type: 'transit',
      title: transitOverride?.title || `🚗 ${transit.label}`,
      start_time: transitStart,
      end_time: transitEnd,
      pinned: true,
      isRoutineBlock: true,
      routineBlockKey
    });
  }

  return blocks;
}

function buildEventBlocks(events: StaticEvent[], now: Date): ScheduleBlock[] {
  return getEventsForDate(events, now)
    .filter((event) => event.endTime > now)
    .map((event) => ({
      id: event.id,
      type: 'task' as const,
      title: `📍 ${event.title}`,
      start_time: event.startTime,
      end_time: event.endTime,
      isStaticEvent: true,
      pinned: true
    }));
}


function findNextCoherentStart(candidateStart: Date, durationMs: number, hardBlocks: ScheduleBlock[]): Date {
  let start = new Date(candidateStart);

  for (let safety = 0; safety < 48; safety++) {
    let moved = false;

    for (const block of hardBlocks) {
      if (block.end_time.getTime() <= start.getTime()) {
        continue;
      }

      const candidateEnd = start.getTime() + durationMs;
      if (candidateEnd <= block.start_time.getTime()) {
        return start;
      }

      start = new Date(Math.max(start.getTime(), block.end_time.getTime()));
      moved = true;
      break;
    }

    if (!moved) {
      return start;
    }
  }

  return start;
}

export function generateTimeline(
  tasks: Task[],
  events: StaticEvent[] = [],
  routines: DailyRoutine[] = [],
  now: Date,
  _settings?: Partial<AppSettings>,
  routineOverrides: RoutineDayOverride[] = [],
  options: { preferredTaskIds?: string[] } = {},
  habits: Habit[] = []
): ScheduleBlock[] {
  const schedulableTasks = tasks.filter((t) => t.status === 'pool' || t.status === 'scheduled');
  const cognitiveBudget = 600;
  const breakMin = _settings?.breakDurationMinutes ?? 10;
  const preferredTaskIds = new Set(options.preferredTaskIds ?? []);

  function mergeRestBlocks(unmerged: ScheduleBlock[]): ScheduleBlock[] {
    if (unmerged.length < 2) return unmerged;
    const merged: ScheduleBlock[] = [];
    for (const block of unmerged) {
      const last = merged[merged.length - 1];
      if (last && (last.type === 'rest' || last.type === 'meal') && (block.type === 'rest' || block.type === 'meal')) {
        last.end_time = block.end_time;
        if (block.type === 'meal') last.type = 'meal'; // Meal takes precedence
        if (block.title.includes('Recarga') || block.title.includes('Almuerzo')) last.title = block.title;
      } else {
        merged.push({ ...block });
      }
    }
    return merged;
  }

  const hardBlocks = [...buildRoutineBlocks(routines, now, routineOverrides), ...buildEventBlocks(events, now)]
    .sort((a, b) => a.start_time.getTime() - b.start_time.getTime());
  if (schedulableTasks.length === 0) {
    return mergeRestBlocks([...hardBlocks].sort((a, b) => a.start_time.getTime() - b.start_time.getTime()));
  }

  const scored = scoreAll(schedulableTasks, now, preferredTaskIds);
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
        score: contextualScore(t, now, beam.recentTasks, beam.cognitiveBudgetLeft, preferredTaskIds)
      }));
      scored2.sort((a, b) => b.score - a.score);
      for (const { task } of scored2.slice(0, BEAM_WIDTH)) {
        candidates.push({
          sequence: [...beam.sequence, task],
          recentTasks: [...beam.recentTasks.slice(-MAX_HIGH_LOAD_STREAK), task],
          cognitiveBudgetLeft: beam.cognitiveBudgetLeft - task.cognitive_load * task.eta_minutes,
          score: beam.score + contextualScore(task, now, beam.recentTasks, beam.cognitiveBudgetLeft, preferredTaskIds)
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    beams = candidates.slice(0, BEAM_WIDTH);
  }

  const bestFlexible = beams[0]?.sequence ?? [];
  const finalSequence = simulatedAnnealing([...hardFirst.map((s) => s.task), ...bestFlexible], now);

  const blocks: ScheduleBlock[] = [...hardBlocks.map((block) => ({ ...block }))];
  let cursor = new Date(now);

  for (let idx = 0; idx < finalSequence.length; idx++) {
    const task = finalSequence[idx];
    const durationMs = task.fixed_start && task.fixed_end
      ? Math.max(1, task.fixed_end.getTime() - task.fixed_start.getTime())
      : Math.max(5, task.eta_minutes) * 60_000;

    const initialStart = task.fixed_start && task.fixed_start > cursor ? new Date(task.fixed_start) : new Date(cursor);
    const start = findNextCoherentStart(initialStart, durationMs, hardBlocks);

    if (start.getTime() > cursor.getTime()) {
      blocks.push({
        id: createId('rest'),
        type: 'rest',
        title: 'Libre',
        start_time: new Date(cursor),
        end_time: new Date(start)
      });
    }

    const end = task.fixed_end && task.fixed_end.getTime() > start.getTime()
      ? new Date(task.fixed_end)
      : new Date(start.getTime() + durationMs);

    blocks.push({
      id: createId('block'),
      type: 'task',
      task_id: task.id,
      title: task.title,
      start_time: start,
      end_time: end,
      cognitive_drain: task.cognitive_load * task.eta_minutes
    });

    const desiredRestEnd = new Date(end.getTime() + breakMin * 60_000);
    const nextHardBlock = hardBlocks.find((block) => block.start_time.getTime() >= end.getTime());
    const restEnd = nextHardBlock && nextHardBlock.start_time.getTime() < desiredRestEnd.getTime()
      ? new Date(nextHardBlock.start_time)
      : desiredRestEnd;

    if (restEnd.getTime() - end.getTime() >= 2 * 60_000) {
      blocks.push({
        id: createId('rest'),
        type: 'rest',
        title: 'Descanso',
        start_time: new Date(end),
        end_time: restEnd
      });
      cursor = restEnd;
    } else {
      cursor = end;
    }
  }

  return mergeRestBlocks([...blocks].sort((a, b) => a.start_time.getTime() - b.start_time.getTime()));
}
