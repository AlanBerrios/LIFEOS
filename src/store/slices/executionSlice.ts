import type { StateCreator } from 'zustand';
import { generateTimeline as buildTimelineLocal } from '../../core/scheduler';
import { createId } from '../../utils/ids';
import { MINUTE_MS } from '../../utils/time';
import { cancelAllNotifications } from '../../services/notifications';
import type { LifeStore, MoveBlockResult, MoveSuggestion } from '../lifeStore.types';
import type { DailySession, LifeTimer, ScheduleBlock, Task, ExecutionRecord, SkipReason, PostponeReason, PendingCompletionCheck, DailyEnergyReport, EnergyTelemetry } from '../../types';
import { rankTasksByImportance } from '../../core/scheduler';
import { computeTaskFocusXp, setTaskStatus } from '../domain/taskRules';
import { applyXpProgress, computeSkillLevelBonus } from '../domain/profileProgress';
import { triggerNotificationResync } from '../sideEffects/notifications';
import { callSchedulerApi, SchedulerApiError } from '../../services/schedulerApi';
import { compareSchedulerParity, createRemoteUnavailableParity } from '../../core/schedulerParity';

type EnergyCalibration = 'under' | 'aligned' | 'over';

const ENERGY_LEVEL_EXPECTED_LOAD: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 2.5,
  2: 3.5,
  3: 5,
  4: 6.5,
  5: 8
};

const ENERGY_BIAS_MIN = -2;
const ENERGY_BIAS_MAX = 2;
const FREE_BLOCK_MIN_TOTAL_MINUTES = 30;
const FREE_BLOCK_MIN_TASK_MINUTES = 10;
const FREE_BLOCK_MAX_CANDIDATES = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createOverflowPromptState(
  tasks: Task[],
  scheduledBlocks: ScheduleBlock[],
  startTime: Date
): LifeStore['pending_schedule_overflow'] {
  const selectedTaskIds = new Set(
    scheduledBlocks
      .filter((block) => block.type === 'task' && block.task_id)
      .map((block) => block.task_id as string)
  );
  const overflowTasks = tasks.filter((task) => !selectedTaskIds.has(task.id));
  if (overflowTasks.length === 0) return undefined;

  const rankedOverflow = rankTasksByImportance(overflowTasks, startTime);
  const recommendedTaskIds = rankedOverflow
    .slice(0, Math.min(3, rankedOverflow.length))
    .map((task) => task.id);

  return {
    visible: true,
    reason: 'Si no cabe todo, elige las tareas que quieres proteger hoy. El resto se pospone automáticamente.',
    createdAt: new Date(),
    candidateTasks: rankedOverflow.map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      urgency: task.urgency,
      eta_minutes: task.eta_minutes,
      cognitive_load: task.cognitive_load,
      deadline: task.deadline ?? null
    })),
    recommendedTaskIds,
    maxSelections: Math.min(3, rankedOverflow.length)
  };
}

let mealTimeout: ReturnType<typeof setTimeout> | null = null;

function clearMealTimeout(): void {
  if (mealTimeout) {
    clearTimeout(mealTimeout);
    mealTimeout = null;
  }
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayISO(): string {
  return localDateKey(new Date());
}

function dateISO(date: Date): string {
  return localDateKey(date);
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return dateISO(a) === dateISO(b);
}

function dedupeScheduleBlocks(blocks: ScheduleBlock[]): ScheduleBlock[] {
  const seen = new Set<string>();
  const unique: ScheduleBlock[] = [];

  for (const block of blocks) {
    const key = `${block.id}|${block.start_time.getTime()}|${block.end_time.getTime()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(block);
  }

  return unique.sort((a, b) => a.start_time.getTime() - b.start_time.getTime());
}

function getSameDayGhostBlocks(blocks: ScheduleBlock[], startTime: Date): ScheduleBlock[] {
  return dedupeScheduleBlocks(
    blocks.filter((block) => isSameLocalDay(block.start_time, startTime))
  );
}

function getBlockMinutes(block: ScheduleBlock): number {
  return Math.max(0, Math.round((block.end_time.getTime() - block.start_time.getTime()) / MINUTE_MS));
}

function isGeneratedFreeBlock(block: ScheduleBlock): boolean {
  return block.type === 'rest' && block.title === 'Libre' && !block.isRoutineBlock && !block.isStaticEvent;
}

function getFreeBlockBufferMinutes(settings: LifeStore['settings']): number {
  const configuredBreak = settings.breakDurationMinutes ?? 10;
  return clamp(Math.round(configuredBreak / 2), 3, 15);
}

function toOverflowCandidate(task: Task): NonNullable<LifeStore['pending_schedule_overflow']>['candidateTasks'][number] {
  return {
    id: task.id,
    title: task.title,
    priority: task.priority,
    urgency: task.urgency,
    eta_minutes: task.eta_minutes,
    cognitive_load: task.cognitive_load,
    deadline: task.deadline ?? null
  };
}

function createFreeBlockOpportunityState(
  tasks: Task[],
  blocks: ScheduleBlock[],
  settings: LifeStore['settings'],
  startTime: Date
): LifeStore['pending_free_block_opportunity'] {
  const scheduledTaskIds = new Set(
    blocks
      .filter((block) => block.type === 'task' && block.task_id)
      .map((block) => block.task_id as string)
  );
  const bufferMinutes = getFreeBlockBufferMinutes(settings);
  const rankedCandidates = rankTasksByImportance(
    tasks.filter((task) => (
      (task.status === 'pool' || task.status === 'scheduled' || task.status === 'in_progress') &&
      !scheduledTaskIds.has(task.id) &&
      !task.fixed_start &&
      !task.fixed_end &&
      task.eta_minutes >= FREE_BLOCK_MIN_TASK_MINUTES
    )),
    startTime
  );

  if (rankedCandidates.length === 0) return undefined;

  const freeBlocks = blocks
    .filter((block) => (
      isGeneratedFreeBlock(block) &&
      isSameLocalDay(block.start_time, startTime) &&
      block.end_time.getTime() > startTime.getTime()
    ))
    .sort((a, b) => a.start_time.getTime() - b.start_time.getTime());

  for (const block of freeBlocks) {
    const totalMinutes = getBlockMinutes(block);
    if (totalMinutes < FREE_BLOCK_MIN_TOTAL_MINUTES) continue;

    const usableMinutes = totalMinutes - (bufferMinutes * 2);
    if (usableMinutes < FREE_BLOCK_MIN_TASK_MINUTES) continue;

    const fittingTasks = rankedCandidates.slice(0, FREE_BLOCK_MAX_CANDIDATES);
    if (fittingTasks.length === 0) continue;

    return {
      visible: true,
      blockId: block.id,
      createdAt: new Date(),
      start_time: new Date(block.start_time),
      end_time: new Date(block.end_time),
      totalMinutes,
      bufferMinutes,
      usableMinutes,
      candidateTasks: fittingTasks.map(toOverflowCandidate),
      recommendedTaskId: fittingTasks[0]?.id
    };
  }

  return undefined;
}

function shouldPreserveDayHistoryBlock(block: ScheduleBlock, startTime: Date, tasks: Task[]): boolean {
  if (!isSameLocalDay(block.start_time, startTime)) return false;
  if (block.end_time.getTime() > startTime.getTime()) return false;
  if (block.type === 'rest') return false;
  if (block.isCompletedGhost || block.isStaticEvent || block.isRoutineBlock) return true;

  if (block.task_id) {
    const task = tasks.find((item) => item.id === block.task_id);
    return task?.status === 'completed';
  }

  return false;
}

function getDayHistoryBlocks(state: LifeStore, startTime: Date, tasks: Task[]): ScheduleBlock[] {
  return state.timeline.filter((block) => shouldPreserveDayHistoryBlock(block, startTime, tasks));
}

function findDueTransitArrivalPrompt(state: LifeStore, now: Date): LifeStore['pending_transit_arrival_prompt'] | undefined {
  const today = dateISO(now);
  const alreadyRecorded = new Set(
    (state.transit_arrival_records ?? []).map((record) => `${record.date}|${record.routineBlockKey}`)
  );

  const dueTransit = [...state.timeline]
    .filter((block) => {
      if (block.type !== 'transit') return false;
      if (!block.isRoutineBlock || !block.routineBlockKey?.startsWith('transit:')) return false;
      if (dateISO(block.start_time) !== today) return false;
      if (block.end_time.getTime() > now.getTime()) return false;
      return !alreadyRecorded.has(`${today}|${block.routineBlockKey}`);
    })
    .sort((a, b) => a.end_time.getTime() - b.end_time.getTime())[0];

  if (!dueTransit || !dueTransit.routineBlockKey) return undefined;

  return {
    visible: true,
    date: today,
    blockId: dueTransit.id,
    routineBlockKey: dueTransit.routineBlockKey,
    transitRoutineId: dueTransit.id,
    transitLabel: dueTransit.title.replace(/^🚗\s*/u, '').trim() || dueTransit.title,
    plannedStart: dueTransit.start_time,
    plannedEnd: dueTransit.end_time
  };
}

function getTodayCompletedExecutionRecords(state: LifeStore): ExecutionRecord[] {
  return (state.execution_records ?? []).filter(
    (record) => isTodayDate(record.created_at) && (record.result_code === 'completed' || record.result_code === 'partial')
  );
}

function computeEnergyTelemetry(state: LifeStore, report: DailyEnergyReport): EnergyTelemetry {
  const completedRecords = getTodayCompletedExecutionRecords(state);
  const completedTaskIds = completedRecords.map((record) => record.task_id);
  const completedTasks = completedRecords
    .map((record) => state.tasks.find((task) => task.id === record.task_id))
    .filter((task): task is Task => Boolean(task));

  const suggestedIds = new Set(state.energy_suggested_task_ids ?? []);
  const suggestedHitCount = completedTasks.filter((task) => suggestedIds.has(task.id)).length;
  const completedTaskCount = completedTasks.length;
  const suggestedHitRate = completedTaskCount > 0 ? suggestedHitCount / completedTaskCount : 0;
  const observedAverageLoad = completedTasks.length > 0
    ? completedTasks.reduce((sum, task) => sum + task.cognitive_load, 0) / completedTasks.length
    : 0;
  const observedAveragePriority = completedTasks.length > 0
    ? completedTasks.reduce((sum, task) => sum + task.priority, 0) / completedTasks.length
    : 0;
  const observedAverageEtaMinutes = completedTasks.length > 0
    ? completedTasks.reduce((sum, task) => sum + task.eta_minutes, 0) / completedTasks.length
    : 0;
  const expectedAverageLoad = ENERGY_LEVEL_EXPECTED_LOAD[report.level];
  const loadGap = observedAverageLoad - expectedAverageLoad;
  const calibration: EnergyCalibration = loadGap > 1.25 ? 'under' : loadGap < -1.25 ? 'over' : 'aligned';
  const biasDelta = clamp((loadGap / 4) + ((suggestedHitRate - 0.5) * 0.8), -0.75, 0.75);

  return {
    evaluatedAt: new Date(),
    completedTaskCount,
    completedTaskIds,
    suggestedHitCount,
    suggestedHitRate,
    observedAverageLoad,
    observedAveragePriority,
    observedAverageEtaMinutes,
    expectedAverageLoad,
    calibration,
    biasDelta
  };
}

function applyEnergyTelemetry(state: LifeStore): Partial<LifeStore> {
  const today = todayISO();
  const reportIndex = state.daily_energy_reports.findIndex((report) => report.date === today);
  if (reportIndex < 0) return {};

  const report = state.daily_energy_reports[reportIndex];
  const telemetry = computeEnergyTelemetry(state, report);
  const nextBias = clamp((state.energy_suggestion_bias ?? 0) + telemetry.biasDelta, ENERGY_BIAS_MIN, ENERGY_BIAS_MAX);
  const nextSuggestedIds = getEnergySuggestedTaskIds(state.tasks, report, nextBias);
  const nextReports = [...state.daily_energy_reports];
  nextReports[reportIndex] = { ...report, telemetry };

  return {
    daily_energy_reports: nextReports,
    energy_suggestion_bias: nextBias,
    energy_suggested_task_ids: nextSuggestedIds,
    sessions: state.sessions.map((session) => (
      session.date === today
        ? {
            ...session,
            energy_reported: {
              ...(session.energy_reported ?? {
                level: report.level,
                fatigue: report.fatigue,
                note: report.note
              }),
              telemetry
            }
          }
        : session
    ))
  };
}

function syncTodaySessionEnergyReport(sessions: DailySession[], report: DailyEnergyReport): DailySession[] {
  const today = report.date;
  return sessions.map((session) => (
    session.date === today
      ? {
          ...session,
          energy_reported: {
            ...(session.energy_reported ?? {
              level: report.level,
              fatigue: report.fatigue,
              note: report.note
            }),
            telemetry: report.telemetry
          }
        }
      : session
  ));
}

function getEnergySuggestedTaskIds(
  tasks: Task[],
  report: { level: 1 | 2 | 3 | 4 | 5; fatigue: 'low' | 'medium' | 'high' } | undefined,
  bias = 0
): string[] {
  if (!report) return [];

  const pool = tasks.filter((task) => task.status === 'pool' || task.status === 'scheduled' || task.status === 'in_progress');
  if (pool.length === 0) return [];

  const ranked = [...pool].sort((a, b) => {
    if (a.urgency !== b.urgency) {
      const urgencyWeight = { today: 4, this_week: 3, this_month: 2, someday: 1 } as const;
      return urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
    }
    return b.priority - a.priority;
  });

  const effectiveLevel = clamp(report.level + bias, 1, 5);
  const lowEnergyMode = effectiveLevel <= 2.5 || report.fatigue === 'high';
  const highEnergyMode = effectiveLevel >= 3.75 && report.fatigue === 'low';

  if (lowEnergyMode) {
    const cautiousBias = clamp(bias, -1.5, 1.5);
    return ranked
      .sort((a, b) => {
        const scoreA = a.cognitive_load * (2 - cautiousBias * 0.35) + Math.floor(a.eta_minutes / 20) - a.priority * 0.15;
        const scoreB = b.cognitive_load * (2 - cautiousBias * 0.35) + Math.floor(b.eta_minutes / 20) - b.priority * 0.15;
        return scoreA - scoreB;
      })
      .slice(0, 5)
      .map((task) => task.id);
  }

  if (highEnergyMode) {
    const ambitiousBias = clamp(bias, -1.5, 1.5);
    return ranked
      .sort((a, b) => {
        const scoreA = a.priority * (5 + ambitiousBias * 0.7) + a.cognitive_load * (2 + ambitiousBias * 0.4);
        const scoreB = b.priority * (5 + ambitiousBias * 0.7) + b.cognitive_load * (2 + ambitiousBias * 0.4);
        return scoreB - scoreA;
      })
      .slice(0, 5)
      .map((task) => task.id);
  }

  const balancedBias = clamp(bias, -1.5, 1.5);
  return ranked
    .sort((a, b) => {
      const center = 5 + balancedBias;
      const scoreA = a.priority * 4 + (10 - Math.abs(a.cognitive_load - center));
      const scoreB = b.priority * 4 + (10 - Math.abs(b.cognitive_load - center));
      return scoreB - scoreA;
    })
    .slice(0, 5)
    .map((task) => task.id);
}

function getTodayEnergyReport(reports: DailyEnergyReport[]): DailyEnergyReport | undefined {
  const today = todayISO();
  return reports.find((report) => report.date === today);
}

function buildExecutionPlanWindow(state: LifeStore, taskId: string, now = new Date()): { plannedStart: Date; plannedEnd: Date } {
  const plannedBlock = state.timeline.find((block) => block.task_id === taskId);
  if (plannedBlock) {
    return {
      plannedStart: new Date(plannedBlock.start_time),
      plannedEnd: new Date(plannedBlock.end_time)
    };
  }

  const task = state.tasks.find((item) => item.id === taskId);
  const etaMinutes = task?.eta_minutes ?? 0;
  return {
    plannedStart: new Date(now),
    plannedEnd: new Date(now.getTime() + etaMinutes * MINUTE_MS)
  };
}

function nextExecutionAttempt(state: LifeStore, taskId: string): number {
  const lastAttempt = (state.execution_records ?? [])
    .filter((record) => record.task_id === taskId)
    .reduce((max, record) => Math.max(max, record.attempt_number), 0);
  return lastAttempt + 1;
}

function isTodayDate(date: Date): boolean {
  return date.toISOString().slice(0, 10) === todayISO();
}

function countReasons(items: string[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const reason = item.trim();
    if (!reason) continue;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `${reason} (${count})`);
}

function buildSession(state: LifeStore, tasks: Task[], timeline: ScheduleBlock[], totalExpGained = 0): DailySession {
  const taskBlocks = timeline.filter((block) => block.type === 'task');
  const totalWorkMinutes = taskBlocks.reduce(
    (sum, block) => sum + (block.end_time.getTime() - block.start_time.getTime()) / 60_000,
    0
  );
  const totalCognitiveDrain = taskBlocks.reduce((sum, block) => sum + (block.cognitive_drain ?? 0), 0);
  const todayRecords = (state.execution_records ?? []).filter((record) => isTodayDate(record.created_at));
  const todayReplans = (state.replan_history ?? []).filter((decision) => isTodayDate(decision.timestamp));
  const todayEnergy = getTodayEnergyReport(state.daily_energy_reports ?? []);

  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const skippedTasks = tasks.filter((task) => task.status === 'skipped');
  const postponedTasks = tasks.filter((task) => task.status === 'postponed');
  const scheduledTasks = tasks.filter((task) => task.status === 'scheduled' || task.status === 'in_progress');

  const latestRecordByTask = new Map<string, ExecutionRecord>();
  for (const record of todayRecords) {
    if (record.task_id) latestRecordByTask.set(record.task_id, record);
  }

  const executionTimeline = taskBlocks.map((block) => {
    const record = block.task_id ? latestRecordByTask.get(block.task_id) : undefined;
    let status: 'pending' | 'completed' | 'skipped' | 'postponed' = 'pending';
    if (record?.status === 'completed' || record?.status === 'skipped' || record?.status === 'postponed') {
      status = record.status;
    }

    return {
      block_id: block.id,
      block_title: block.title,
      planned_start: block.start_time,
      planned_end: block.end_time,
      actual_start: record?.actual_start ?? null,
      actual_end: record?.actual_end ?? null,
      status,
      skip_reason: record?.skip_reason,
      postpone_reason: record?.postpone_reason,
      notes: record?.skip_reason_details ?? record?.postpone_reason_details ?? record?.notes_after
    };
  });

  const skippedRecords = todayRecords.filter((record) => record.skip_reason);
  const postponedRecords = todayRecords.filter((record) => record.postpone_reason);
  const completedRecords = todayRecords.filter((record) => record.result_code === 'completed' || record.result_code === 'partial');
  const topDrainBlocks = [...taskBlocks]
    .sort((a, b) => (b.cognitive_drain ?? 0) - (a.cognitive_drain ?? 0))
    .slice(0, 3)
    .map((block) => `${block.title} · ${Math.round((block.cognitive_drain ?? 0))} u.`);

  const metricDrilldowns = [
    {
      key: 'completed' as const,
      label: 'Completadas',
      value: completedTasks.length,
      unit: 'tareas',
      context: [
        `${completedTasks.length} tareas completadas hoy.`,
        completedRecords.length > 0 ? `Registros de ejecución cerrados: ${completedRecords.length}.` : 'Aún no hay registros de ejecución cerrados hoy.'
      ],
      taskTitles: completedTasks.map((task) => task.title)
    },
    {
      key: 'skipped' as const,
      label: 'Saltadas',
      value: skippedTasks.length,
      unit: 'tareas',
      context: [
        ...countReasons(skippedRecords.map((record) => record.skip_reason_details || record.skip_reason || '')).slice(0, 3),
        skippedRecords.length === 0 ? 'No hay motivos de salto registrados hoy.' : 'Los motivos provienen del flujo de ejecución real.'
      ].filter(Boolean),
      taskTitles: skippedTasks.map((task) => task.title)
    },
    {
      key: 'postponed' as const,
      label: 'Pospuestas',
      value: postponedTasks.length,
      unit: 'tareas',
      context: [
        ...countReasons(postponedRecords.map((record) => record.postpone_reason_details || record.postpone_reason || '')).slice(0, 3),
        postponedRecords.length === 0 ? 'No hay posposiciones registradas hoy.' : 'El contexto sale del intento real de ejecución.'
      ].filter(Boolean),
      taskTitles: postponedTasks.map((task) => task.title)
    },
    {
      key: 'scheduled' as const,
      label: 'Programadas',
      value: scheduledTasks.length,
      unit: 'tareas',
      context: [
        `${scheduledTasks.length} tareas quedaron en el plan activo.`,
        `Bloques de tarea en timeline: ${taskBlocks.length}.`
      ],
      taskTitles: scheduledTasks.map((task) => task.title)
    },
    {
      key: 'drain' as const,
      label: 'Carga cognitiva',
      value: Math.round(totalCognitiveDrain),
      unit: 'u.',
      context: topDrainBlocks.length > 0
        ? [`Bloques más pesados: ${topDrainBlocks.join(' · ')}`]
        : ['No hay carga cognitiva suficiente para mostrar desglose.'],
      taskTitles: taskBlocks.filter((block) => block.task_id).map((block) => block.title)
    },
    {
      key: 'replan' as const,
      label: 'Replanificaciones',
      value: todayReplans.length,
      unit: 'veces',
      context: todayReplans.length > 0
        ? todayReplans.slice(-3).map((decision) => `${decision.decision === 'accepted' ? 'Aceptada' : 'Rechazada'} · ${decision.reason}`)
        : ['No hubo replanificaciones hoy.'],
      taskTitles: []
    }
  ];

  const decisionContext = [
    {
      label: 'Motivos de salto',
      count: skippedRecords.length,
      context: countReasons(skippedRecords.map((record) => record.skip_reason_details || record.skip_reason || ''))
    },
    {
      label: 'Motivos de posposición',
      count: postponedRecords.length,
      context: countReasons(postponedRecords.map((record) => record.postpone_reason_details || record.postpone_reason || ''))
    },
    {
      label: 'Cambios de plan',
      count: todayReplans.length,
      context: todayReplans.length > 0
        ? todayReplans.slice(-3).map((decision) => `${decision.decision === 'accepted' ? 'Aceptada' : 'Rechazada'} · ${decision.reason}`)
        : ['Sin cambios de plan hoy.']
    }
  ];

  return {
    id: createId('session'),
    date: todayISO(),
    tasksCompleted: tasks.filter((task) => task.status === 'completed').length,
    tasksScheduled: taskBlocks.length,
    tasksSkipped: tasks.filter((task) => task.status === 'skipped').length,
    tasksPostponed: tasks.filter((task) => task.status === 'postponed').length,
    totalWorkMinutes: Math.round(totalWorkMinutes),
    totalCognitiveDrain: Math.round(totalCognitiveDrain),
    expGainedToday: totalExpGained,
    execution_timeline: executionTimeline,
    deviations_count: skippedRecords.length + postponedRecords.length,
    replan_count: todayReplans.length,
    user_feedback_points: skippedRecords.length + postponedRecords.length,
    metric_drilldowns: metricDrilldowns,
    decision_context: decisionContext,
    energy_reported: todayEnergy
      ? { level: todayEnergy.level, fatigue: todayEnergy.fatigue, note: todayEnergy.note, telemetry: todayEnergy.telemetry }
      : undefined,
    suggested_task_ids: state.energy_suggested_task_ids ?? []
  };
}

function isLockedForReorder(block: ScheduleBlock): boolean {
  return Boolean(block.isStaticEvent || block.isRoutineBlock || block.isCompletedGhost);
}

function canMoveThroughRange(blocks: ScheduleBlock[], fromIndex: number, targetIndex: number): boolean {
  if (targetIndex < 0 || targetIndex >= blocks.length) return false;
  const current = blocks[fromIndex];
  if (!current || current.type !== 'task' || isLockedForReorder(current)) return false;

  const start = Math.min(fromIndex, targetIndex);
  const end = Math.max(fromIndex, targetIndex);
  for (let i = start; i <= end; i += 1) {
    if (i === fromIndex) continue;
    if (isLockedForReorder(blocks[i])) return false;
  }

  return true;
}

function reorderAndReflow(blocks: ScheduleBlock[], fromIndex: number, targetIndex: number): ScheduleBlock[] {
  const next = [...blocks];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(targetIndex, 0, moved);

  const start = Math.min(fromIndex, targetIndex);
  const end = Math.max(fromIndex, targetIndex);
  const reflowStartMs = blocks[start].start_time.getTime();
  let cursorMs = reflowStartMs;

  for (let i = start; i <= end; i += 1) {
    const block = next[i];
    const durationMs = block.end_time.getTime() - block.start_time.getTime();
    next[i] = {
      ...block,
      start_time: new Date(cursorMs),
      end_time: new Date(cursorMs + durationMs)
    };
    cursorMs += durationMs;
  }

  return next;
}

function buildMoveSuggestions(blocks: ScheduleBlock[], fromIndex: number, limit = 3): MoveSuggestion[] {
  const suggestions: MoveSuggestion[] = [];

  for (let offset = 1; offset < blocks.length && suggestions.length < limit; offset += 1) {
    const upIndex = fromIndex - offset;
    if (upIndex >= 0 && canMoveThroughRange(blocks, fromIndex, upIndex)) {
      suggestions.push({
        targetIndex: upIndex,
        startTime: blocks[upIndex].start_time,
        direction: 'up'
      });
    }

    if (suggestions.length >= limit) break;

    const downIndex = fromIndex + offset;
    if (downIndex < blocks.length && canMoveThroughRange(blocks, fromIndex, downIndex)) {
      suggestions.push({
        targetIndex: downIndex,
        startTime: blocks[downIndex].start_time,
        direction: 'down'
      });
    }
  }

  return suggestions;
}

function attemptMove(
  blocks: ScheduleBlock[],
  fromIndex: number,
  targetIndex: number
): { result: MoveBlockResult; nextTimeline?: ScheduleBlock[] } {
  if (fromIndex < 0 || fromIndex >= blocks.length || targetIndex < 0 || targetIndex >= blocks.length) {
    return { result: { moved: false, reason: 'out_of_bounds' } };
  }

  const current = blocks[fromIndex];
  if (!current || current.type !== 'task' || isLockedForReorder(current)) {
    return { result: { moved: false, reason: 'invalid_block' } };
  }

  if (!canMoveThroughRange(blocks, fromIndex, targetIndex)) {
    return {
      result: {
        moved: false,
        reason: 'blocked_by_fixed',
        suggestions: buildMoveSuggestions(blocks, fromIndex)
      }
    };
  }

  const nextTimeline = reorderAndReflow(blocks, fromIndex, targetIndex);
  return { result: { moved: true }, nextTimeline };
}

type SetFn = (partial: Partial<LifeStore> | ((state: LifeStore) => Partial<LifeStore>)) => void;
type GetFn = () => LifeStore;

function scheduleMealTimeout(getState: GetFn, setState: SetFn): void {
  clearMealTimeout();
  const timer = getState().activeTimer;
  if (!timer) return;

  const remainingMs = timer.endsAt.getTime() - Date.now();
  if (remainingMs <= 0) {
    void getState().generateTimeline(new Date());
    setState({ activeTimer: null });
    return;
  }

  mealTimeout = setTimeout(() => {
    setState({ activeTimer: null });
    void getState().generateTimeline(new Date());
  }, remainingMs);
}

async function evaluateSchedulerParity(
  localBlocks: ScheduleBlock[],
  tasks: Task[],
  startTime: Date
): Promise<{ parity: LifeStore['last_scheduler_parity']; solverStatus: string }> {
  try {
    const remote = await callSchedulerApi(tasks, startTime);
    const parity = compareSchedulerParity(localBlocks, remote.blocks);
    const enrichedParity: LifeStore['last_scheduler_parity'] = {
      ...parity,
      remote: {
        available: true,
        engine: remote.meta.engine,
        solverStatus: remote.meta.solver_status,
        solveTimeMs: remote.meta.solve_time_ms
      }
    };

    return {
      parity: enrichedParity,
      solverStatus: parity.status === 'ok'
        ? 'LOCAL_PARITY_OK'
        : `LOCAL_PARITY_DRIFT_${parity.metrics.divergenceScore}`
    };
  } catch (error) {
    const fallbackReason = error instanceof SchedulerApiError
      ? error.message
      : error instanceof Error
      ? error.message
      : 'unknown remote error';

    return {
      parity: createRemoteUnavailableParity(fallbackReason),
      solverStatus: 'LOCAL_FALLBACK_REMOTE_UNAVAILABLE'
    };
  }
}

export const createExecutionSlice: StateCreator<LifeStore, [], [], Pick<LifeStore,
  'generateTimeline' | 'setTimeline' | 'moveBlock' | 'updateBreakDuration' | 'deleteBlock' |
  'convertCompletedGhostToFree' |
  'moveBlockToIndex' |
  'startMealTimer' | 'stopTimer' | 'restoreMealTimer' |
  'startTaskExecution' | 'pauseTaskExecution' | 'resumeTaskExecution' | 
  'confirmCompletionOK' | 'confirmCompletionPartial' | 'reportTaskSkipped' | 'reportTaskPostponed' |
  'addReplanDecision' | 'triggerReplanification' | 'resolveScheduleOverflow' | 'dismissScheduleOverflow' | 'confirmReplan' | 'rejectReplan' |
  'resolveFreeBlockOpportunity' | 'dismissFreeBlockOpportunity' |
  'reportDailyEnergy' | 'applyEnergyBasedSuggestions' |
  'checkTransitArrivalPrompt' | 'respondTransitArrivalPrompt' | 'dismissTransitArrivalPrompt'
>> = (set, get) => ({
  generateTimeline: async (
    startTime = new Date(),
    options: { preferredTaskIds?: string[]; suppressOverflowPrompt?: boolean } = {}
  ) => {
    const { tasks, settings } = get();
    const isRestDay = get().isRestDay();
    const fallbackEnergyPreferred = options.preferredTaskIds && options.preferredTaskIds.length > 0
      ? []
      : get().energy_suggested_task_ids;
    const preferredTaskIds = options.preferredTaskIds && options.preferredTaskIds.length > 0
      ? options.preferredTaskIds
      : fallbackEnergyPreferred;
    
    set({ isGenerating: true });

    // Si es día de descanso, no generar tareas, solo bloques de descanso/comidas
    if (isRestDay) {
      const restDayBlocks = buildTimelineLocal(
        [], // Sin tareas
        get().events, // Mantener eventos estáticos
        get().routines,
        startTime,
        settings,
        get().routineOverrides,
        { preferredTaskIds },
        get().habits
      );
      
      set((state) => {
        const today = todayISO();
        const historyBlocks = getDayHistoryBlocks(state, startTime, state.tasks);
        const dayGhostBlocks = getSameDayGhostBlocks(state.completedGhostBlocks, startTime);
        const timelineWithHistory = dedupeScheduleBlocks([...historyBlocks, ...restDayBlocks]);
        const session = buildSession(state, state.tasks, [...timelineWithHistory, ...dayGhostBlocks]);
        const otherSessions = state.sessions.filter((sessionItem) => sessionItem.date !== today);

        return {
          timeline: timelineWithHistory,
          completedGhostBlocks: dayGhostBlocks,
          sessions: [...otherSessions, session],
          lastEngine: 'local-ts',
          lastSolverStatus: 'REST_DAY',
          last_scheduler_parity: undefined,
          pending_transit_arrival_prompt: undefined,
          pending_schedule_overflow: undefined,
          pending_free_block_opportunity: undefined,
          isGenerating: false
        };
      });
      return;
    }

    // Modo normal: planificar tareas
    const schedulableTasks = tasks.filter((task) => task.status === 'pool' || task.status === 'scheduled' || task.status === 'in_progress');

    // Modo local-only: siempre planificar con el scheduler TypeScript local.
    const newBlocks = buildTimelineLocal(
      schedulableTasks,
      get().events,
      get().routines,
      startTime,
      settings,
      get().routineOverrides,
      { preferredTaskIds },
      get().habits
    );
    const engine: LifeStore['lastEngine'] = 'local-ts';
    const parityResult = await evaluateSchedulerParity(newBlocks, schedulableTasks, startTime);

    const scheduledTaskIds = new Set(newBlocks.filter((block) => block.type === 'task' && block.task_id).map((block) => block.task_id as string));
    const today = todayISO();

    set((state) => {
      const updatedTasks = state.tasks.map((task) =>
        task.status === 'pool' && scheduledTaskIds.has(task.id)
          ? { ...task, status: 'scheduled' as const }
          : task
      );

      // Preservar bloques completados (ghost blocks) durante reorganización
      const historyBlocks = getDayHistoryBlocks(state, startTime, updatedTasks);
      const dayGhostBlocks = getSameDayGhostBlocks(state.completedGhostBlocks, startTime);
      const activeTimeline = dedupeScheduleBlocks([...historyBlocks, ...newBlocks]);
      
      // Combinar timeline nuevo con ghost blocks preservados
      const timelineWithGhosts = dedupeScheduleBlocks([...activeTimeline, ...dayGhostBlocks]);

      const session = buildSession(state, updatedTasks, timelineWithGhosts);
      const otherSessions = state.sessions.filter((sessionItem) => sessionItem.date !== today);
      const overflowPrompt = options.suppressOverflowPrompt
        ? undefined
        : createOverflowPromptState(schedulableTasks, newBlocks, startTime);
      const freeBlockOpportunity = createFreeBlockOpportunityState(updatedTasks, activeTimeline, settings, startTime);

      return {
        tasks: updatedTasks,
        timeline: activeTimeline,
        completedGhostBlocks: dayGhostBlocks,
        sessions: [...otherSessions, session],
        lastEngine: engine,
        lastSolverStatus: parityResult.solverStatus,
        last_scheduler_parity: parityResult.parity,
        pending_transit_arrival_prompt: undefined,
        pending_schedule_overflow: overflowPrompt,
        pending_free_block_opportunity: freeBlockOpportunity,
        isGenerating: false
      };
    });

    triggerNotificationResync(get, set, 'resincronizar notificaciones tras generar timeline');
  },

  setTimeline: (blocks: ScheduleBlock[]) => set({ timeline: blocks }),

  moveBlock: (blockId: string, direction: 'up' | 'down') => {
    const state = get();
    const index = state.timeline.findIndex((block) => block.id === blockId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const { result, nextTimeline } = attemptMove(state.timeline, index, targetIndex);

    if (result.moved && nextTimeline) {
      set({ timeline: nextTimeline });
    }

    return result;
  },

  moveBlockToIndex: (blockId: string, targetIndex: number) => {
    const state = get();
    const index = state.timeline.findIndex((block) => block.id === blockId);
    const { result, nextTimeline } = attemptMove(state.timeline, index, targetIndex);

    if (result.moved && nextTimeline) {
      set({ timeline: nextTimeline });
    }

    return result;
  },

  updateBreakDuration: (blockId: string, newMinutes: number) => {
    const target = get().timeline.find((block) => block.id === blockId);
    if (target?.type === 'rest' && target.title === 'Libre') {
      return;
    }
    if (target?.isRoutineBlock && target.routineBlockKey) {
      const date = todayISO();
      const nextStart = target.start_time;
      const startTime = `${String(nextStart.getHours()).padStart(2, '0')}:${String(nextStart.getMinutes()).padStart(2, '0')}`;

      set((state) => {
        const existing = state.routineOverrides.find((item) => item.date === date);
        const remaining = (existing?.blocks ?? []).filter((item) => item.routineBlockKey !== target.routineBlockKey);
        const nextOverride = {
          routineBlockKey: target.routineBlockKey as string,
          startTime,
          durationMinutes: Math.max(1, newMinutes),
          title: target.title,
          hidden: false
        };

        const nextDay = { date, blocks: [...remaining, nextOverride] };
        const others = state.routineOverrides.filter((item) => item.date !== date);
        return { routineOverrides: [...others, nextDay] };
      });

      void get().generateTimeline(new Date());
      return;
    }

    set((state) => {
      const index = state.timeline.findIndex((block) => block.id === blockId);
      if (index < 0) return state;
      const blocks = [...state.timeline];
      const block = blocks[index];
      if (block.type !== 'rest' && block.type !== 'meal') return state;
      if (block.type === 'rest' && block.title === 'Libre') return state;
      const oldDuration = block.end_time.getTime() - block.start_time.getTime();
      const newDuration = newMinutes * 60_000;
      const delta = newDuration - oldDuration;
      const newEnd = new Date(block.end_time.getTime() + delta);
      const nextLockedIndex = blocks.findIndex((candidate, candidateIndex) => candidateIndex > index && isLockedForReorder(candidate));
      const shiftEndIndex = nextLockedIndex >= 0 ? nextLockedIndex : blocks.length;
      const lockedLimitMs = nextLockedIndex >= 0 ? blocks[nextLockedIndex].start_time.getTime() : Number.POSITIVE_INFINITY;
      if (newEnd.getTime() > lockedLimitMs) return state;
      blocks[index] = { ...block, end_time: newEnd };

      for (let cursor = index + 1; cursor < shiftEndIndex; cursor++) {
        blocks[cursor] = {
          ...blocks[cursor],
          start_time: new Date(blocks[cursor].start_time.getTime() + delta),
          end_time: new Date(blocks[cursor].end_time.getTime() + delta)
        };
      }

      return { timeline: blocks };
    });
  },

  deleteBlock: (blockId: string) => {
    const target = get().timeline.find((block) => block.id === blockId);
    if (target?.type === 'rest' && target.title === 'Libre') {
      return;
    }
    if (target?.isRoutineBlock && target.routineBlockKey) {
      const date = todayISO();
      set((state) => {
        const existing = state.routineOverrides.find((item) => item.date === date);
        const remaining = (existing?.blocks ?? []).filter((item) => item.routineBlockKey !== target.routineBlockKey);
        const nextDay = {
          date,
          blocks: [...remaining, { routineBlockKey: target.routineBlockKey as string, hidden: true }]
        };
        const others = state.routineOverrides.filter((item) => item.date !== date);
        return { routineOverrides: [...others, nextDay] };
      });

      void get().generateTimeline(new Date());
      return;
    }

    set((state) => {
      const index = state.timeline.findIndex((block) => block.id === blockId);
      if (index < 0) return state;
      const blocks = [...state.timeline];
      const block = blocks[index];
      if (block.type === 'rest' && block.title === 'Libre') return state;
      if (isLockedForReorder(block)) return state;
      const duration = block.end_time.getTime() - block.start_time.getTime();
      blocks.splice(index, 1);

      const updatedTasks =
        block.task_id
          ? state.tasks.map((task) =>
              task.id === block.task_id && task.status !== 'completed'
                ? { ...task, status: 'pool' as const }
                : task
            )
          : state.tasks;

      const nextLockedIndex = blocks.findIndex((candidate, candidateIndex) => candidateIndex >= index && isLockedForReorder(candidate));
      const shiftEndIndex = nextLockedIndex >= 0 ? nextLockedIndex : blocks.length;

      for (let cursor = index; cursor < shiftEndIndex; cursor++) {
        blocks[cursor] = {
          ...blocks[cursor],
          start_time: new Date(blocks[cursor].start_time.getTime() - duration),
          end_time: new Date(blocks[cursor].end_time.getTime() - duration)
        };
      }

      return { timeline: blocks, tasks: updatedTasks };
    });

    triggerNotificationResync(get, set, 'resincronizar notificaciones tras eliminar bloque');
  },

  convertCompletedGhostToFree: (blockId: string) => {
    set((state) => {
      const ghost = state.completedGhostBlocks.find((block) => block.id === blockId);
      if (!ghost) return state;

      const freeBlock: ScheduleBlock = {
        id: createId('rest'),
        type: 'rest',
        title: 'Libre',
        start_time: new Date(ghost.start_time),
        end_time: new Date(ghost.end_time),
        pinned: false
      };

      return {
        completedGhostBlocks: state.completedGhostBlocks.filter((block) => block.id !== blockId),
        timeline: dedupeScheduleBlocks([...state.timeline, freeBlock])
      };
    });
  },

  startMealTimer: async (durationMinutes?: number) => {
    const { routines } = get();
    clearMealTimeout();
    await cancelAllNotifications();

    const currentDay = new Date().getDay();
    const routine = routines.find((currentRoutine) => currentRoutine.dayOfWeek === currentDay);
    const routineLunch = routine?.meals.find((meal) => meal.type.toLowerCase() === 'almuerzo');
    const finalDuration = durationMinutes ?? routineLunch?.durationMinutes ?? 60;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + finalDuration * MINUTE_MS);

    set({
      activeTimer: {
        id: createId('timer'),
        label: 'meal',
        startedAt,
        endsAt,
        durationMinutes: finalDuration,
        active: true
      }
    });

    scheduleMealTimeout(get, set);
  },

  stopTimer: async () => {
    clearMealTimeout();
    await cancelAllNotifications();
    set({ activeTimer: null });
  },

  restoreMealTimer: () => {
    scheduleMealTimeout(get, set);
  },

  // ============================================
  // FASE C: Execution Nucleus Actions
  // ============================================

  startTaskExecution: (task_id: string) => {
    set((state) => {
      const task = state.tasks.find((t) => t.id === task_id);
      if (!task) return state;
      const now = new Date();
      const { plannedStart, plannedEnd } = buildExecutionPlanWindow(state, task_id, now);

      const record: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: nextExecutionAttempt(state, task_id),
        planned_start: plannedStart,
        planned_end: plannedEnd,
        actual_start: now,
        actual_end: null,
        status: 'in_progress',
        result_code: 'not_started',
        work_minutes: 0,
        estimated_minutes: task.eta_minutes,
        created_at: now,
      };

      return {
        execution_records: [...(state.execution_records || []), record],
      };
    });
  },

  confirmCompletionOK: async (task_id: string) => {
    set((state) => {
      const task = state.tasks.find((t) => t.id === task_id);
      if (!task) return state;

      const now = new Date();
      const { plannedStart, plannedEnd } = buildExecutionPlanWindow(state, task_id, now);
      const gainedXp = computeTaskFocusXp(task);
      const targetBlock = state.timeline.find((block) => block.task_id === task_id);
      const keepGhost = Boolean(
        state.settings.keepCompletedGhostBlock &&
        targetBlock &&
        isSameLocalDay(targetBlock.start_time, now)
      );
      const nextGhostBlocks = state.completedGhostBlocks
        .filter((block) => block.task_id !== task_id)
        .filter((block) => isSameLocalDay(block.start_time, now));

      const completionRecord: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: nextExecutionAttempt(state, task_id),
        planned_start: plannedStart,
        planned_end: plannedEnd,
        actual_start: plannedStart <= now ? plannedStart : now,
        actual_end: now,
        status: 'completed',
        result_code: 'completed',
        work_minutes: Math.max(0, Math.round((now.getTime() - (plannedStart <= now ? plannedStart.getTime() : now.getTime())) / 60_000)),
        estimated_minutes: Math.max(1, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60_000)),
        created_at: now,
      };

      const updatedTasks = setTaskStatus(state.tasks, task_id, 'completed');

      const beforeFocus = state.userProfile.skills.focus;
      const nextFocus = beforeFocus + gainedXp;
      const skillLevelBonus = computeSkillLevelBonus(beforeFocus, nextFocus);
      const xpProgress = applyXpProgress(
        state.userProfile.currentXP,
        state.userProfile.level,
        gainedXp + skillLevelBonus
      );
      const nextSkills = {
        ...state.userProfile.skills,
        focus: nextFocus
      };

      return {
        tasks: updatedTasks,
        timeline: state.timeline.filter((block) => block.task_id !== task_id),
        completedGhostBlocks: keepGhost && targetBlock
          ? [...nextGhostBlocks, { ...targetBlock, isCompletedGhost: true, pinned: true }]
          : nextGhostBlocks,
        execution_records: [...(state.execution_records || []), completionRecord],
        userProfile: {
          ...state.userProfile,
          level: xpProgress.level,
          currentXP: xpProgress.currentXP,
          skills: nextSkills
        }
      };
    });
    get().addConsistencyActivity();
    set((state) => applyEnergyTelemetry(state));
  },

  reportTaskSkipped: async (task_id: string, reason: SkipReason, details: string) => {
    set((state) => {
      const now = new Date();
      const { plannedStart, plannedEnd } = buildExecutionPlanWindow(state, task_id, now);
      const estimatedMinutes = Math.max(1, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60_000));
      // Record de ejecución fallida
      const record: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: nextExecutionAttempt(state, task_id),
        planned_start: plannedStart,
        planned_end: plannedEnd,
        actual_start: null,
        actual_end: null,
        status: 'skipped',
        result_code: 'failed',
        skip_reason: reason,
        skip_reason_details: details,
        work_minutes: 0,
        estimated_minutes: estimatedMinutes,
        created_at: now,
      };

      // Marcar tarea como skipped
      const updatedTasks = setTaskStatus(state.tasks, task_id, 'skipped');

      return {
        tasks: updatedTasks,
        execution_records: [...(state.execution_records || []), record],
        last_replan_reason: `Se saltó "${state.tasks.find((t) => t.id === task_id)?.title ?? 'tarea'}" por ${reason}. ${details}`
      };
    });
    
    // Trigger replanificación después del skip
    await get().triggerReplanification();
  },

  triggerReplanification: async () => {
    const { tasks, settings } = get();

    set({ is_replanning: true, replan_error: undefined });

    const pendingTasks = tasks.filter((task) => task.status !== 'completed');
    const replanStart = new Date();
    const blocks = buildTimelineLocal(
      pendingTasks,
      get().events,
      get().routines,
      replanStart,
      settings,
      get().routineOverrides,
      {},
      get().habits
    );

    const parityResult = await evaluateSchedulerParity(blocks, pendingTasks, replanStart);

    set((state) => {
      const historyBlocks = getDayHistoryBlocks(state, replanStart, state.tasks);
      const dayGhostBlocks = getSameDayGhostBlocks(state.completedGhostBlocks, replanStart);
      const activeTimeline = dedupeScheduleBlocks([...historyBlocks, ...blocks]);

      return {
        timeline: activeTimeline,
        completedGhostBlocks: dayGhostBlocks,
        is_replanning: false,
        replan_error: undefined,
        lastEngine: 'local-ts',
        lastSolverStatus: parityResult.solverStatus,
        last_scheduler_parity: parityResult.parity,
        pending_transit_arrival_prompt: undefined,
        pending_schedule_overflow: undefined,
        pending_free_block_opportunity: createFreeBlockOpportunityState(state.tasks, activeTimeline, settings, replanStart)
      };
    });

    triggerNotificationResync(get, set, 'resincronizar notificaciones tras replanificación');
  },

  resolveScheduleOverflow: async (keepTaskIds: string[]) => {
    const state = get();
    const overflowPrompt = state.pending_schedule_overflow;
    if (!overflowPrompt) return;

    const keepSet = new Set(keepTaskIds);
    const overflowIds = overflowPrompt.candidateTasks.map((task) => task.id);
    const postponeIds = overflowIds.filter((id) => !keepSet.has(id));

    set((current) => ({
      tasks: current.tasks.map((task) => (
        postponeIds.includes(task.id) && task.status !== 'completed'
          ? { ...task, status: 'postponed' as const }
          : task
      )),
      pending_schedule_overflow: undefined,
      last_replan_reason: overflowPrompt.reason
    }));

    await get().generateTimeline(new Date(), { preferredTaskIds: keepTaskIds, suppressOverflowPrompt: true });
  },

  dismissScheduleOverflow: () => {
    set({ pending_schedule_overflow: undefined });
  },

  resolveFreeBlockOpportunity: (taskId: string) => {
    set((state) => {
      const prompt = state.pending_free_block_opportunity;
      if (!prompt) return state;

      const targetTask = state.tasks.find((task) => task.id === taskId);
      const freeBlockIndex = state.timeline.findIndex((block) => block.id === prompt.blockId);
      const freeBlock = freeBlockIndex >= 0 ? state.timeline[freeBlockIndex] : undefined;
      if (!targetTask || !freeBlock || !isGeneratedFreeBlock(freeBlock)) {
        return { pending_free_block_opportunity: undefined };
      }

      const taskMinutes = Math.min(Math.max(FREE_BLOCK_MIN_TASK_MINUTES, targetTask.eta_minutes), prompt.usableMinutes);
      if (taskMinutes < FREE_BLOCK_MIN_TASK_MINUTES) {
        return { pending_free_block_opportunity: undefined };
      }

      const bufferMs = prompt.bufferMinutes * MINUTE_MS;
      const taskStart = new Date(freeBlock.start_time.getTime() + bufferMs);
      const taskEnd = new Date(taskStart.getTime() + taskMinutes * MINUTE_MS);
      const latestTaskEnd = freeBlock.end_time.getTime() - bufferMs;
      if (taskEnd.getTime() > latestTaskEnd) {
        return { pending_free_block_opportunity: undefined };
      }

      const replacementBlocks: ScheduleBlock[] = [];
      if (taskStart.getTime() - freeBlock.start_time.getTime() >= 2 * MINUTE_MS) {
        replacementBlocks.push({
          id: createId('rest'),
          type: 'rest',
          title: 'Libre',
          start_time: new Date(freeBlock.start_time),
          end_time: new Date(taskStart)
        });
      }

      replacementBlocks.push({
        id: createId('block'),
        type: 'task',
        task_id: targetTask.id,
        title: `Avance: ${targetTask.title}`,
        start_time: taskStart,
        end_time: taskEnd,
        cognitive_drain: targetTask.cognitive_load * taskMinutes,
        pinned: true,
        isSoftBlock: taskMinutes < targetTask.eta_minutes
      });

      if (freeBlock.end_time.getTime() - taskEnd.getTime() >= 2 * MINUTE_MS) {
        replacementBlocks.push({
          id: createId('rest'),
          type: 'rest',
          title: 'Libre',
          start_time: new Date(taskEnd),
          end_time: new Date(freeBlock.end_time)
        });
      }

      const nextTimeline = dedupeScheduleBlocks([
        ...state.timeline.slice(0, freeBlockIndex),
        ...replacementBlocks,
        ...state.timeline.slice(freeBlockIndex + 1)
      ]);
      const nextTasks = state.tasks.map((task) => (
        task.id === targetTask.id && task.status === 'pool'
          ? { ...task, status: 'scheduled' as const }
          : task
      ));
      const today = todayISO();
      const nextSession = buildSession(state, nextTasks, [...nextTimeline, ...state.completedGhostBlocks]);
      const otherSessions = state.sessions.filter((session) => session.date !== today);

      return {
        tasks: nextTasks,
        timeline: nextTimeline,
        sessions: [...otherSessions, nextSession],
        pending_free_block_opportunity: undefined
      };
    });

    triggerNotificationResync(get, set, 'resincronizar notificaciones tras usar bloque Libre');
  },

  dismissFreeBlockOpportunity: () => {
    set({ pending_free_block_opportunity: undefined });
  },

  reportDailyEnergy: (level, fatigue, note) => {
    set((state) => {
      const date = todayISO();
      const report: DailyEnergyReport = {
        date,
        level,
        fatigue,
        note: note?.trim() || undefined,
        created_at: new Date()
      };
      const otherReports = state.daily_energy_reports.filter((item) => item.date !== date);
      const draftState: LifeStore = {
        ...state,
        daily_energy_reports: [...otherReports, report]
      };
      const telemetry = computeEnergyTelemetry(draftState, report);
      const nextBias = clamp((state.energy_suggestion_bias ?? 0) + telemetry.biasDelta, ENERGY_BIAS_MIN, ENERGY_BIAS_MAX);
      const suggestedTaskIds = getEnergySuggestedTaskIds(state.tasks, report, nextBias);

      return {
        daily_energy_reports: [...otherReports, { ...report, telemetry }],
        energy_suggestion_bias: nextBias,
        energy_suggested_task_ids: suggestedTaskIds,
        sessions: syncTodaySessionEnergyReport(state.sessions, { ...report, telemetry })
      };
    });
  },

  applyEnergyBasedSuggestions: async () => {
    const preferredTaskIds = get().energy_suggested_task_ids;
    await get().generateTimeline(new Date(), { preferredTaskIds });
  },

  checkTransitArrivalPrompt: (now = new Date()) => {
    set((state) => {
      if (state.pending_transit_arrival_prompt?.visible) return state;
      const nextPrompt = findDueTransitArrivalPrompt(state, now);
      if (!nextPrompt) return state;
      return { pending_transit_arrival_prompt: nextPrompt };
    });
  },

  respondTransitArrivalPrompt: (arrivedOnTime, actualArrivalTime) => {
    set((state) => {
      const prompt = state.pending_transit_arrival_prompt;
      if (!prompt) return state;

      const actualArrival = arrivedOnTime ? prompt.plannedEnd : (actualArrivalTime ?? new Date());
      const delayMinutes = Math.max(0, Math.round((actualArrival.getTime() - prompt.plannedEnd.getTime()) / MINUTE_MS));
      const observedDuration = Math.max(5, Math.round((actualArrival.getTime() - prompt.plannedStart.getTime()) / MINUTE_MS));

      const record = {
        id: createId('transit-arrival'),
        date: prompt.date,
        routineBlockKey: prompt.routineBlockKey,
        transitRoutineId: prompt.transitRoutineId,
        transitLabel: prompt.transitLabel,
        plannedStart: prompt.plannedStart,
        plannedEnd: prompt.plannedEnd,
        actualArrivalTime: actualArrival,
        delayMinutes,
        observedDurationMinutes: observedDuration,
        response: arrivedOnTime ? ('on_time' as const) : ('late' as const)
      };

      const nextRecords = [...state.transit_arrival_records, record].slice(-180);
      return {
        transit_arrival_records: nextRecords,
        pending_transit_arrival_prompt: undefined
      };
    });
  },

  dismissTransitArrivalPrompt: () => {
    set((state) => {
      const prompt = state.pending_transit_arrival_prompt;
      if (!prompt) return state;
      const record = {
        id: createId('transit-arrival'),
        date: prompt.date,
        routineBlockKey: prompt.routineBlockKey,
        transitRoutineId: prompt.transitRoutineId,
        transitLabel: prompt.transitLabel,
        plannedStart: prompt.plannedStart,
        plannedEnd: prompt.plannedEnd,
        actualArrivalTime: prompt.plannedEnd,
        delayMinutes: 0,
        observedDurationMinutes: Math.max(1, Math.round((prompt.plannedEnd.getTime() - prompt.plannedStart.getTime()) / MINUTE_MS)),
        response: 'dismissed' as const
      };

      return {
        transit_arrival_records: [...state.transit_arrival_records, record].slice(-180),
        pending_transit_arrival_prompt: undefined
      };
    });
  },

  pauseTaskExecution: (task_id: string) => {
    // Pausa ejecución actual (podría persistir datos parciales)
    set((state) => {
      // TODO: Grabar pausa en execution_records si es necesario
      return state;
    });
  },

  resumeTaskExecution: (task_id: string) => {
    // Reanuda ejecución de tarea pausada
    set((state) => {
      // TODO: Restaurar contexto de ejecución anterior
      return state;
    });
  },

  confirmCompletionPartial: async (task_id: string, notes: string) => {
    set((state) => {
      const now = new Date();
      const { plannedStart, plannedEnd } = buildExecutionPlanWindow(state, task_id, now);
      // Grabar como parcialmente completada
      const record: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: nextExecutionAttempt(state, task_id),
        planned_start: plannedStart,
        planned_end: plannedEnd,
        actual_start: plannedStart <= now ? plannedStart : now,
        actual_end: now,
        status: 'completed',
        result_code: 'partial',
        work_minutes: Math.max(0, Math.round((now.getTime() - (plannedStart <= now ? plannedStart.getTime() : now.getTime())) / 60_000)),
        estimated_minutes: Math.max(1, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60_000)),
        notes_after: notes,
        created_at: now,
      };

      return {
        execution_records: [...(state.execution_records || []), record],
      };
    });
    set((state) => applyEnergyTelemetry(state));
  },

  reportTaskPostponed: async (task_id: string, reason: PostponeReason, details: string, postponed_until: Date) => {
    set((state) => {
      const now = new Date();
      const { plannedStart, plannedEnd } = buildExecutionPlanWindow(state, task_id, now);
      const estimatedMinutes = Math.max(1, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60_000));
      // Grabar postpone con fecha de reintento
      const record: ExecutionRecord = {
        id: createId('execution'),
        task_id,
        attempt_number: nextExecutionAttempt(state, task_id),
        planned_start: plannedStart,
        planned_end: plannedEnd,
        actual_start: null,
        actual_end: null,
        status: 'postponed',
        result_code: 'not_started',
        postpone_reason: reason,
        postpone_reason_details: details,
        postponed_until,
        work_minutes: 0,
        estimated_minutes: estimatedMinutes,
        created_at: now,
      };

      // Marcar tarea como postponed
      const updatedTasks = setTaskStatus(state.tasks, task_id, 'postponed');

      return {
        tasks: updatedTasks,
        execution_records: [...(state.execution_records || []), record],
        last_replan_reason: `Se pospuso "${state.tasks.find((t) => t.id === task_id)?.title ?? 'tarea'}" hasta ${postponed_until.toLocaleString('es-ES')}. Motivo: ${reason}. ${details}`
      };
    });

    // Trigger replanificación
    await get().triggerReplanification();
  },

  addReplanDecision: (decision, reason, previousBlocks, nextBlocks, diffMinutes) => {
    set((state) => ({
      replan_history: [
        ...state.replan_history,
        {
          timestamp: new Date(),
          decision,
          reason,
          previousBlocks,
          nextBlocks,
          diffMinutes
        }
      ].slice(-25)
    }));
  },

  confirmReplan: async (new_schedule: ScheduleBlock[]) => {
    const previousTimeline = get().timeline;
    const reason = get().last_replan_reason ?? 'Replan automática';
    const diffMinutes = Math.round(
      (new_schedule.reduce((sum, block) => sum + (block.end_time.getTime() - block.start_time.getTime()), 0) -
        previousTimeline.reduce((sum, block) => sum + (block.end_time.getTime() - block.start_time.getTime()), 0)) / 60_000
    );

    set((state) => {
      const now = new Date();
      const today = dateISO(now);
      const historyBlocks = getDayHistoryBlocks(state, now, state.tasks);
      const dayGhostBlocks = getSameDayGhostBlocks(state.completedGhostBlocks, now);
      const updatedTimeline = dedupeScheduleBlocks([...historyBlocks, ...new_schedule]);
      
      // Actualizar timeline con nuevo plan
      const updatedSessions = state.sessions.map((session) =>
        session.date === today
          ? {
              ...session,
              execution_timeline: new_schedule.map((block) => ({
                block_id: block.id,
                block_title: block.title,
                planned_start: block.start_time,
                planned_end: block.end_time,
                actual_start: null,
                actual_end: null,
                status: 'pending' as const,
              })),
              replan_count: (session.replan_count || 0) + 1,
            }
          : session
      );

      return {
        timeline: updatedTimeline,
        completedGhostBlocks: dayGhostBlocks,
        sessions: updatedSessions,
        is_replanning: false,
        replan_error: undefined,
        pending_completion_check: undefined,
        last_replan_reason: undefined,
        pending_free_block_opportunity: createFreeBlockOpportunityState(state.tasks, updatedTimeline, state.settings, now),
      };
    });

    get().addReplanDecision('accepted', reason, previousTimeline.length, new_schedule.length, diffMinutes);
  },

  rejectReplan: () => {
    const previousTimeline = get().timeline;
    const reason = get().last_replan_reason ?? 'Replan automática';
    set({
      is_replanning: false,
      replan_error: undefined,
      pending_completion_check: undefined,
      last_replan_reason: undefined,
      pending_free_block_opportunity: undefined,
    });

    get().addReplanDecision('rejected', reason, previousTimeline.length, previousTimeline.length, 0);
  }
});
