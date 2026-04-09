/**
 * LifeOS — Scheduler v2
 * Soporta: urgency, fixed_start/end, breakDurationMinutes configurable
 */

import { createId } from '../utils/ids';
import { HOUR_MS } from '../utils/time';
import { getEventsForDate } from '../utils/events';
import type { AppSettings, ScheduleBlock, Task, TaskUrgency, StaticEvent } from '../types';

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
  events: import('../types').StaticEvent[] = [],
  routines: import('../types').DailyRoutine[] = [],
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

  // ── Build timeline blocks ─────────────────────────────────────────────────
  const blocks: ScheduleBlock[] = [];
  let cursor = new Date(now);
  const sleepStart = settings?.sleepTimeStart ?? '23:00';
  const sleepEnd = settings?.sleepTimeEnd ?? '07:00';

  const [sH, sM] = sleepStart.split(':').map(Number);
  const [eH, eM] = sleepEnd.split(':').map(Number);

  function isSleepTime(dt: Date): boolean {
    const dayOfWeek = dt.getDay(); // 0 is Sunday
    const routine = routines.find(r => r.dayOfWeek === dayOfWeek);
    if (!routine || !routine.sleepStart || !routine.sleepEnd) return false;

    const currentMin = dt.getHours() * 60 + dt.getMinutes();
    const [sH, sM] = routine.sleepStart.split(':').map(Number);
    const [eH, eM] = routine.sleepEnd.split(':').map(Number);
    const startMin = sH * 60 + sM;
    const endMin = eH * 60 + eM;

    if (startMin > endMin) {
      return currentMin >= startMin || currentMin < endMin;
    }
    return currentMin >= startMin && currentMin < endMin;
  }

  function getSleepEnd(dt: Date): Date {
    const dayOfWeek = dt.getDay();
    const routine = routines.find(r => r.dayOfWeek === dayOfWeek);
    const sleepEnd = routine?.sleepEnd || '07:00';
    const [eH, eM] = sleepEnd.split(':').map(Number);
    const sleepDate = new Date(dt);
    if (dt.getHours() >= 12) { // It's late evening, sleep ends next morning
      sleepDate.setDate(sleepDate.getDate() + 1);
    }
    sleepDate.setHours(eH, eM, 0, 0);
    return sleepDate;
  }

  function getNextMeal(dt: Date): import('../types').MealRoutine | null {
    const dayOfWeek = dt.getDay();
    const routine = routines.find(r => r.dayOfWeek === dayOfWeek);
    if (!routine || !routine.meals) return null;
    
    const curMin = dt.getHours() * 60 + dt.getMinutes();
    
    // Sort meals contextually
    const upcoming = routine.meals.filter(m => {
      const [h, min] = m.time.split(':').map(Number);
      const mMin = h * 60 + min;
      return mMin > curMin && (mMin - curMin < 60); // only trigger if within 1 hour radius
    }).sort((a,b) => {
       const aMin = Number(a.time.substring(0,2))*60 + Number(a.time.substring(3));
       const bMin = Number(b.time.substring(0,2))*60 + Number(b.time.substring(3));
       return aMin - bMin;
    });

    return upcoming[0] || null;
  }

  let workStreakMinutes = 0;
  let cognitiveUsed = 0;

  // expansion logic for recurring events
  const dailyEvents = getEventsForDate(events, now);

  // Clone and sort events to consume them chronologically
  const upcomingEvents = dailyEvents
    .filter(e => e.endTime > now)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  function pushOpportunisticRest(start: Date, durationMin: number, title: string, type: 'rest' | 'meal' | 'sleep' = 'rest', nextFixedTaskStart?: Date) {
    let allowMin = durationMin;
    
    // Check next static event
    if (upcomingEvents.length > 0) {
      const nextEvt = upcomingEvents[0].startTime;
      if (nextEvt >= start) {
        const span = (nextEvt.getTime() - start.getTime()) / 60000;
        if (span < allowMin) allowMin = Math.max(0, span);
      }
    }
    
    // Check next fixed task
    if (nextFixedTaskStart && nextFixedTaskStart >= start) {
      const span = (nextFixedTaskStart.getTime() - start.getTime()) / 60000;
      if (span < allowMin) allowMin = Math.max(0, span);
    }
    
    // We can also check sleep/meal, but typically they act as their own hard boundaries.
    
    if (allowMin >= 2) { // Only push break if there's at least 2 minutes of buffer
      const end = new Date(start.getTime() + allowMin * 60000);
      blocks.push({
        id: createId('rest'),
        type,
        title,
        start_time: start,
        end_time: end
      });
      cursor = end;
    }
  }

  for (let idx = 0; idx < finalSequence.length; idx++) {
    const task = finalSequence[idx];
    let taskPlaced = false;

    // Peek ahead for the next fixed task to avoid pushing breaks into it
    let nextFixed: Date | undefined;
    for (let k = idx + 1; k < finalSequence.length; k++) {
      if (finalSequence[k].fixed_start) {
        nextFixed = finalSequence[k].fixed_start;
        break;
      }
    }

    while (!taskPlaced) {
      // 1. Process passing Events
      if (upcomingEvents.length > 0 && upcomingEvents[0].startTime <= cursor) {
        const evt = upcomingEvents.shift()!;
        if (evt.endTime > cursor) {
          blocks.push({
            id: evt.id,
            type: 'task', // Render as task but visually we'll know it's static
            title: `📍 ${evt.title}`,
            start_time: new Date(Math.max(cursor.getTime(), evt.startTime.getTime())),
            end_time: evt.endTime,
            isStaticEvent: true,
            pinned: true
          });
          cursor = evt.endTime;
          workStreakMinutes = 0;
          continue; // Re-evaluate task
        }
      }

      // Si la tarea tiene hora fija, insertar descanso hasta ese momento
    if (task.fixed_start && task.fixed_start > cursor) {
      const waitMinutes = (task.fixed_start.getTime() - cursor.getTime()) / 60_000;
      if (waitMinutes > 2) {
        blocks.push({
          id: createId('rest'),
          type: 'rest',
          title: 'Espera / Descanso',
          start_time: new Date(cursor),
          end_time: new Date(task.fixed_start)
        });
      }
      cursor = new Date(task.fixed_start);
      workStreakMinutes = 0;
    }

    // Menú de Comidas cercano
    const nextMeal = getNextMeal(cursor);
    if (nextMeal) {
      const [mH, mM] = nextMeal.time.split(':').map(Number);
      const mealStart = new Date(cursor);
      mealStart.setHours(mH, mM, 0, 0);
      const mealEnd = new Date(mealStart.getTime() + nextMeal.durationMinutes * 60000);
      
      blocks.push({
        id: createId('rest'),
        type: 'meal',
        title: `🍔 ${nextMeal.type}`,
        start_time: mealStart,
        end_time: mealEnd
      });
      cursor = mealEnd;
      workStreakMinutes = 0;
      continue;
    }

    // Saltar tiempo de sueño si el cursor cae ahí
    if (isSleepTime(cursor)) {
      const sleepDate = getSleepEnd(cursor);
      
      blocks.push({
        id: createId('rest'),
        type: 'sleep',
        title: 'Descanso nocturno 😴',
        start_time: new Date(cursor),
        end_time: sleepDate
      });
      cursor = new Date(sleepDate);
      workStreakMinutes = 0;
      continue; // Re-evaluate task
    }

    // Descanso por racha de trabajo
    if (workStreakMinutes >= streakLimit) {
      pushOpportunisticRest(new Date(cursor), breakMin, 'Descanso', 'rest', nextFixed);
      workStreakMinutes = 0;
    }

    // Descanso cognitivo
    if (cognitiveUsed >= cognitiveBudget) {
      pushOpportunisticRest(new Date(cursor), longBreakMin, 'Recarga mental', 'rest', nextFixed);
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

    // Descanso corto entre tareas (siempre intenta)
    pushOpportunisticRest(new Date(cursor), breakMin, 'Descanso', 'rest', nextFixed);
    
    taskPlaced = true;
    } // Ends while(!taskPlaced)
  } // Ends for loop

  // Add any remaining events for the day
  while (upcomingEvents.length > 0) {
    const evt = upcomingEvents.shift()!;
    // Only add if it's within 24hs to avoid infinite timeline blowing up memory
    if (evt.startTime.getTime() - now.getTime() < 24 * HOUR_MS) {
      if (evt.startTime > cursor) {
         blocks.push({
           id: createId('rest'),
           type: 'rest',
           title: 'Libre',
           start_time: new Date(cursor),
           end_time: evt.startTime
         });
      }
      blocks.push({
        id: evt.id,
        type: 'task',
        title: `📍 ${evt.title}`,
        start_time: evt.startTime,
        end_time: evt.endTime,
        isStaticEvent: true,
        pinned: true
      });
      cursor = evt.endTime;
    }
  }

  return mergeRestBlocks(blocks);
}
