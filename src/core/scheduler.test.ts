import { describe, expect, it } from 'vitest';
import { generateTimeline } from './scheduler';
import type { DailyRoutine, Task } from '../types';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? `task-${Math.random().toString(36).slice(2, 10)}`,
    title: overrides.title ?? 'Task',
    description: overrides.description,
    eta_minutes: overrides.eta_minutes ?? 30,
    priority: overrides.priority ?? 3,
    cognitive_load: overrides.cognitive_load ?? 5,
    deadline: overrides.deadline,
    fixed_start: overrides.fixed_start,
    fixed_end: overrides.fixed_end,
    urgency: overrides.urgency ?? 'this_week',
    status: overrides.status ?? 'pool',
    created_at: overrides.created_at ?? new Date('2026-04-11T08:00:00.000Z')
  };
}

describe('scheduler core', () => {
  it('orders tasks by score and inserts a rest block after 90 minutes of work', () => {
    const tasks = [
      makeTask({ id: 'low', title: 'Low', priority: 1, cognitive_load: 2, eta_minutes: 60 }),
      makeTask({ id: 'high', title: 'High', priority: 5, cognitive_load: 4, eta_minutes: 60 }),
      makeTask({ id: 'medium', title: 'Medium', priority: 3, cognitive_load: 3, eta_minutes: 30 })
    ];

    const timeline = generateTimeline(tasks, [], [], new Date('2026-04-11T18:00:00.000Z'));

    const scheduledTaskIds = timeline.filter((block) => block.type === 'task').map((block) => block.task_id);
    expect(scheduledTaskIds).toHaveLength(3);
    expect(scheduledTaskIds).toEqual(expect.arrayContaining(['high', 'medium', 'low']));
    expect(timeline.some((block) => block.type === 'rest')).toBe(true);
  });

  it('ignores completed tasks and keeps schedulable execution deterministic', () => {
    const tasks = [
      makeTask({ id: 'pool', title: 'Pool', status: 'pool' }),
      makeTask({ id: 'done', title: 'Done', status: 'completed' }),
      makeTask({ id: 'scheduled', title: 'Scheduled', status: 'scheduled' })
    ];

    const timeline = generateTimeline(tasks, [], [], new Date('2026-04-11T09:00:00.000Z'));

    const scheduledTaskIds = timeline.filter((block) => block.type === 'task').map((block) => block.task_id);
    expect(scheduledTaskIds).toHaveLength(2);
    expect(scheduledTaskIds).toEqual(expect.arrayContaining(['pool', 'scheduled']));
    expect(timeline.some((block) => block.task_id === 'done')).toBe(false);
  });

  it('respects fixed start and fixed end when the window is feasible', () => {
    const now = new Date('2026-04-11T09:00:00.000Z');
    const fixedStart = new Date('2026-04-11T10:00:00.000Z');
    const fixedEnd = new Date('2026-04-11T10:30:00.000Z');

    const tasks = [
      makeTask({
        id: 'fixed-window',
        title: 'Fixed Window',
        eta_minutes: 30,
        fixed_start: fixedStart,
        fixed_end: fixedEnd,
        urgency: 'today'
      })
    ];

    const timeline = generateTimeline(tasks, [], [], now);
    const block = timeline.find((item) => item.task_id === 'fixed-window');

    expect(block).toBeDefined();
    expect(block?.start_time.getTime()).toBe(fixedStart.getTime());
    expect(block?.end_time.getTime()).toBe(fixedEnd.getTime());
  });

  it('never generates invalid time ranges in timeline blocks', () => {
    const tasks = [
      makeTask({ id: 'a', eta_minutes: 35, urgency: 'today' }),
      makeTask({ id: 'b', eta_minutes: 20, urgency: 'this_week' }),
      makeTask({ id: 'c', eta_minutes: 15, urgency: 'someday' })
    ];

    const timeline = generateTimeline(tasks, [], [], new Date('2026-04-11T09:00:00.000Z'));

    for (const block of timeline) {
      expect(block.start_time.getTime()).toBeLessThan(block.end_time.getTime());
    }
  });

  it('does not schedule flexible tasks past the upcoming sleep routine', () => {
    const now = new Date(2026, 3, 11, 20, 0, 0, 0);
    const routine: DailyRoutine = {
      dayOfWeek: now.getDay(),
      sleepStart: '21:00',
      sleepEnd: '06:00',
      meals: [],
      transits: []
    };
    const tasks = [
      makeTask({ id: 'too-late', eta_minutes: 120, urgency: 'today' })
    ];

    const timeline = generateTimeline(tasks, [], [routine], now);

    expect(timeline.some((block) => block.type === 'sleep')).toBe(true);
    expect(timeline.some((block) => block.task_id === 'too-late')).toBe(false);
  });

  it('does not push tasks into the next local day', () => {
    const now = new Date(2026, 3, 11, 23, 45, 0, 0);
    const tasks = [
      makeTask({ id: 'next-day-overflow', eta_minutes: 30, urgency: 'today' })
    ];

    const timeline = generateTimeline(tasks, [], [], now);

    expect(timeline.some((block) => block.task_id === 'next-day-overflow')).toBe(false);
  });
});
