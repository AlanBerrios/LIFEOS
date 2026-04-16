import { describe, expect, it } from 'vitest';
import type { ScheduleBlock } from '../types';
import { compareSchedulerParity } from './schedulerParity';

function makeTaskBlock(taskId: string, startIso: string, durationMin: number, id = taskId): ScheduleBlock {
  const start = new Date(startIso);
  return {
    id,
    type: 'task',
    task_id: taskId,
    title: taskId,
    start_time: start,
    end_time: new Date(start.getTime() + durationMin * 60_000)
  };
}

describe('scheduler parity matrix', () => {
  it('M1 identical plans -> low divergence', () => {
    const local = [makeTaskBlock('a', '2026-04-11T10:00:00.000Z', 30), makeTaskBlock('b', '2026-04-11T10:30:00.000Z', 30)];
    const remote = [makeTaskBlock('a', '2026-04-11T10:00:00.000Z', 30), makeTaskBlock('b', '2026-04-11T10:30:00.000Z', 30)];

    const parity = compareSchedulerParity(local, remote);

    expect(parity.status).toBe('ok');
    expect(parity.metrics.divergenceScore).toBe(0);
  });

  it('M2 same tasks with small offsets -> still within threshold', () => {
    const local = [makeTaskBlock('a', '2026-04-11T10:00:00.000Z', 30), makeTaskBlock('b', '2026-04-11T10:30:00.000Z', 30)];
    const remote = [makeTaskBlock('a', '2026-04-11T10:05:00.000Z', 30), makeTaskBlock('b', '2026-04-11T10:35:00.000Z', 35)];

    const parity = compareSchedulerParity(local, remote);

    expect(parity.status).toBe('ok');
    expect(parity.metrics.avgStartDeltaMinutes).toBeGreaterThan(0);
    expect(parity.metrics.divergenceScore).toBeLessThanOrEqual(parity.threshold);
  });

  it('M3 missing tasks and large offsets -> drift detected', () => {
    const local = [
      makeTaskBlock('a', '2026-04-11T10:00:00.000Z', 30),
      makeTaskBlock('b', '2026-04-11T10:30:00.000Z', 30),
      makeTaskBlock('c', '2026-04-11T11:00:00.000Z', 30)
    ];
    const remote = [
      makeTaskBlock('a', '2026-04-11T12:00:00.000Z', 60),
      makeTaskBlock('x', '2026-04-11T13:00:00.000Z', 45)
    ];

    const parity = compareSchedulerParity(local, remote);

    expect(parity.status).toBe('drift');
    expect(parity.metrics.onlyLocalCount).toBeGreaterThan(0);
    expect(parity.metrics.onlyRemoteCount).toBeGreaterThan(0);
    expect(parity.metrics.divergenceScore).toBeGreaterThan(parity.threshold);
  });
});
