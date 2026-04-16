import type { ScheduleBlock } from '../types';

export interface SchedulerParityMetrics {
  localTaskCount: number;
  remoteTaskCount: number;
  commonTaskCount: number;
  onlyLocalCount: number;
  onlyRemoteCount: number;
  avgStartDeltaMinutes: number;
  avgDurationDeltaMinutes: number;
  orderMismatchCount: number;
  divergenceScore: number;
  withinThreshold: boolean;
}

export interface SchedulerParityResult {
  status: 'ok' | 'drift' | 'remote_unavailable';
  checkedAt: Date;
  threshold: number;
  summary: string;
  metrics: SchedulerParityMetrics;
  remote?: {
    available: boolean;
    engine?: string;
    solverStatus?: string;
    solveTimeMs?: number;
    error?: string;
  };
}

interface ComparableTaskBlock {
  taskId: string;
  startMs: number;
  durationMs: number;
  index: number;
}

const DEFAULT_DIVERGENCE_THRESHOLD = 25;

function toTaskBlocks(blocks: ScheduleBlock[]): ComparableTaskBlock[] {
  return blocks
    .filter((block) => block.type === 'task' && block.task_id)
    .map((block, index) => ({
      taskId: block.task_id as string,
      startMs: block.start_time.getTime(),
      durationMs: Math.max(0, block.end_time.getTime() - block.start_time.getTime()),
      index
    }));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function compareSchedulerParity(
  localBlocks: ScheduleBlock[],
  remoteBlocks: ScheduleBlock[],
  threshold = DEFAULT_DIVERGENCE_THRESHOLD
): SchedulerParityResult {
  const local = toTaskBlocks(localBlocks);
  const remote = toTaskBlocks(remoteBlocks);

  const localMap = new Map(local.map((block) => [block.taskId, block]));
  const remoteMap = new Map(remote.map((block) => [block.taskId, block]));

  const commonTaskIds = [...localMap.keys()].filter((taskId) => remoteMap.has(taskId));
  const onlyLocalCount = [...localMap.keys()].filter((taskId) => !remoteMap.has(taskId)).length;
  const onlyRemoteCount = [...remoteMap.keys()].filter((taskId) => !localMap.has(taskId)).length;

  const startDeltaMinutes = commonTaskIds.map((taskId) => {
    const localBlock = localMap.get(taskId) as ComparableTaskBlock;
    const remoteBlock = remoteMap.get(taskId) as ComparableTaskBlock;
    return Math.abs(localBlock.startMs - remoteBlock.startMs) / 60_000;
  });

  const durationDeltaMinutes = commonTaskIds.map((taskId) => {
    const localBlock = localMap.get(taskId) as ComparableTaskBlock;
    const remoteBlock = remoteMap.get(taskId) as ComparableTaskBlock;
    return Math.abs(localBlock.durationMs - remoteBlock.durationMs) / 60_000;
  });

  const orderMismatchCount = commonTaskIds.reduce((sum, taskId) => {
    const localBlock = localMap.get(taskId) as ComparableTaskBlock;
    const remoteBlock = remoteMap.get(taskId) as ComparableTaskBlock;
    return sum + (localBlock.index === remoteBlock.index ? 0 : 1);
  }, 0);

  const avgStartDeltaMinutes = startDeltaMinutes.length > 0
    ? round(startDeltaMinutes.reduce((sum, value) => sum + value, 0) / startDeltaMinutes.length)
    : 0;
  const avgDurationDeltaMinutes = durationDeltaMinutes.length > 0
    ? round(durationDeltaMinutes.reduce((sum, value) => sum + value, 0) / durationDeltaMinutes.length)
    : 0;

  const baseCount = Math.max(local.length, remote.length, 1);
  const coverageGap = (onlyLocalCount + onlyRemoteCount) / baseCount;
  const startGap = Math.min(1, avgStartDeltaMinutes / 60);
  const durationGap = Math.min(1, avgDurationDeltaMinutes / 30);
  const orderGap = commonTaskIds.length > 0 ? orderMismatchCount / commonTaskIds.length : 0;

  const divergenceScore = Math.round(
    (coverageGap * 0.45 + startGap * 0.35 + durationGap * 0.1 + orderGap * 0.1) * 100
  );
  const withinThreshold = divergenceScore <= threshold;

  const status: SchedulerParityResult['status'] = withinThreshold ? 'ok' : 'drift';
  const summary = withinThreshold
    ? `Paridad estable (score ${divergenceScore}).`
    : `Divergencia detectada (score ${divergenceScore}).`;

  return {
    status,
    checkedAt: new Date(),
    threshold,
    summary,
    metrics: {
      localTaskCount: local.length,
      remoteTaskCount: remote.length,
      commonTaskCount: commonTaskIds.length,
      onlyLocalCount,
      onlyRemoteCount,
      avgStartDeltaMinutes,
      avgDurationDeltaMinutes,
      orderMismatchCount,
      divergenceScore,
      withinThreshold
    },
    remote: {
      available: true
    }
  };
}

export function createRemoteUnavailableParity(error: string, threshold = DEFAULT_DIVERGENCE_THRESHOLD): SchedulerParityResult {
  return {
    status: 'remote_unavailable',
    checkedAt: new Date(),
    threshold,
    summary: 'Fallback local activo: backend remoto no disponible.',
    metrics: {
      localTaskCount: 0,
      remoteTaskCount: 0,
      commonTaskCount: 0,
      onlyLocalCount: 0,
      onlyRemoteCount: 0,
      avgStartDeltaMinutes: 0,
      avgDurationDeltaMinutes: 0,
      orderMismatchCount: 0,
      divergenceScore: 100,
      withinThreshold: false
    },
    remote: {
      available: false,
      error
    }
  };
}
