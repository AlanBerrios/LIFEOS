import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../services/schedulerApi', () => ({
  callSchedulerApi: vi.fn().mockRejectedValue(new Error('offline')),
  callReplanApi: vi.fn().mockRejectedValue(new Error('offline')),
  SchedulerApiError: class SchedulerApiError extends Error {}
}));

vi.mock('../core/scheduler', () => ({
  generateTimeline: vi.fn(() => {
    const taskId = useLifeStore.getState().tasks[0]?.id ?? 'task-1';
    return [
      {
        id: 'task-1',
        type: 'task' as const,
        task_id: taskId,
        title: 'Test Task',
        start_time: new Date('2026-04-11T10:00:00.000Z'),
        end_time: new Date('2026-04-11T10:30:00.000Z'),
        cognitive_drain: 150
      }
    ];
  })
}));

vi.mock('../services/notifications', () => ({
  cancelAllNotifications: vi.fn().mockResolvedValue(undefined),
  rescheduleAll: vi.fn().mockResolvedValue(undefined),
  scheduleTaskNotifications: vi.fn().mockResolvedValue(undefined)
}));

import { useLifeStore } from './useLifeStore';

describe('useLifeStore replanification', () => {
  beforeEach(() => {
    useLifeStore.setState({
      tasks: [],
      timeline: [],
      sessions: [],
      notes: [],
      alarms: [],
      events: [],
      travelLogs: [],
      habits: [],
      settings: useLifeStore.getState().settings,
      activeTimer: null,
      lastEngine: 'idle',
      lastSolverStatus: '',
      isGenerating: false,
      execution_records: [],
      pending_completion_check: undefined,
      is_replanning: false,
      replan_error: undefined,
      userProfile: {
        level: 1,
        currentXP: 0,
        skills: { focus: 0, vitality: 0, discipline: 0, wisdom: 0 }
      },
      routines: useLifeStore.getState().routines
    });
  });

  it('marks generated pool tasks as scheduled and records a session', async () => {
    useLifeStore.getState().addTask({
      title: 'Replanificar',
      eta_minutes: 30,
      priority: 5,
      cognitive_load: 4,
      urgency: 'today'
    });

    await useLifeStore.getState().generateTimeline(new Date('2026-04-11T09:00:00.000Z'));

    const state = useLifeStore.getState();
    expect(state.timeline).toHaveLength(1);
    expect(state.tasks[0].status).toBe('scheduled');
    expect(state.sessions).toHaveLength(1);
    expect(state.lastEngine).toBe('local-ts');
  });

  it('skip and postpone keep the timeline consistent', async () => {
    useLifeStore.getState().addTask({
      title: 'Aplazar',
      eta_minutes: 30,
      priority: 3,
      cognitive_load: 4,
      urgency: 'today'
    });

    await useLifeStore.getState().generateTimeline(new Date('2026-04-11T09:00:00.000Z'));
    const taskId = useLifeStore.getState().tasks[0].id;

    useLifeStore.getState().skipTask(taskId);
    expect(useLifeStore.getState().tasks[0].status).toBe('skipped');

    useLifeStore.getState().postponeTask(taskId);
    expect(useLifeStore.getState().tasks[0].status).toBe('postponed');
  });

  it('stores execution_records when reporting skipped and postponed outcomes', async () => {
    useLifeStore.getState().addTask({
      title: 'Deep work bloqueado',
      eta_minutes: 40,
      priority: 4,
      cognitive_load: 7,
      urgency: 'today'
    });

    await useLifeStore.getState().generateTimeline(new Date('2026-04-11T11:00:00.000Z'));
    const taskId = useLifeStore.getState().tasks[0].id;

    await useLifeStore.getState().reportTaskSkipped(taskId, 'distraction', 'Reunion inesperada');
    await useLifeStore.getState().reportTaskPostponed(taskId, 'need_more_time', 'Necesito mas foco', new Date('2026-04-11T16:00:00.000Z'));

    const state = useLifeStore.getState();
    expect(state.execution_records.length).toBeGreaterThanOrEqual(2);
    expect(state.execution_records.some((record) => record.status === 'skipped')).toBe(true);
    expect(state.execution_records.some((record) => record.status === 'postponed')).toBe(true);
    expect(state.tasks[0].status).toBe('postponed');
  });

  it('replans with local scheduler without requiring backend', async () => {
    useLifeStore.getState().addTask({
      title: 'Fallback chain',
      eta_minutes: 35,
      priority: 4,
      cognitive_load: 5,
      urgency: 'today'
    });

    await useLifeStore.getState().generateTimeline(new Date('2026-04-11T11:00:00.000Z'));
    const taskId = useLifeStore.getState().tasks[0].id;

    await useLifeStore.getState().reportTaskSkipped(taskId, 'distraction', 'Context switch');

    expect(useLifeStore.getState().lastEngine).toBe('local-ts');
    expect(useLifeStore.getState().lastSolverStatus).toBe('LOCAL_ONLY');
    expect(useLifeStore.getState().timeline.length).toBeGreaterThan(0);
  });

  it('applies confirmReplan and keeps rejectReplan stable', async () => {
    const today = new Date().toISOString().slice(0, 10);

    useLifeStore.setState((state) => ({
      sessions: [
        {
          id: 'session-test',
          date: today,
          tasksCompleted: 0,
          tasksScheduled: 0,
          tasksSkipped: 0,
          tasksPostponed: 0,
          totalWorkMinutes: 0,
          totalCognitiveDrain: 0,
          expGainedToday: 0,
          replan_count: 0,
        }
      ],
      timeline: state.timeline,
      tasks: state.tasks,
      notes: state.notes,
      alarms: state.alarms,
      events: state.events,
      travelLogs: state.travelLogs,
      habits: state.habits,
      settings: state.settings,
      activeTimer: state.activeTimer,
      lastEngine: state.lastEngine,
      lastSolverStatus: state.lastSolverStatus,
      isGenerating: state.isGenerating,
      userProfile: state.userProfile,
      routines: state.routines,
      execution_records: state.execution_records,
      pending_completion_check: state.pending_completion_check,
      is_replanning: state.is_replanning,
      replan_error: state.replan_error,
    }));

    const newSchedule = [
      {
        id: 'replan-task-1',
        type: 'task' as const,
        task_id: 'task-1',
        title: 'Replan Task',
        start_time: new Date('2026-04-11T14:00:00.000Z'),
        end_time: new Date('2026-04-11T14:30:00.000Z'),
        cognitive_drain: 120,
      }
    ];

    await useLifeStore.getState().confirmReplan(newSchedule);

    const afterConfirm = useLifeStore.getState();
    expect(afterConfirm.timeline).toHaveLength(1);
    expect(afterConfirm.timeline[0].id).toBe('replan-task-1');
    expect(afterConfirm.sessions[0].replan_count).toBe(1);

    useLifeStore.setState({
      is_replanning: true,
      replan_error: 'temporary',
      pending_completion_check: {
        task_id: 'task-1',
        task_title: 'Replan Task',
        status: 'pending',
        timestamp: new Date(),
      }
    });

    useLifeStore.getState().rejectReplan();
    const afterReject = useLifeStore.getState();

    expect(afterReject.is_replanning).toBe(false);
    expect(afterReject.replan_error).toBeUndefined();
    expect(afterReject.pending_completion_check).toBeUndefined();
  });
});
