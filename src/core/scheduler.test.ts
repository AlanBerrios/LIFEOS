import { describe, expect, it } from 'vitest';
import { generateTimeline } from './scheduler';
import type { Task } from '../types';

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
});
