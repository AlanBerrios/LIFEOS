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
  }),
  rankTasksByImportance: vi.fn((tasks: any[]) => [...tasks].sort((a, b) => (b.priority - a.priority) || (b.cognitive_load - a.cognitive_load)))
}));

vi.mock('../services/notifications', () => ({
  cancelAllNotifications: vi.fn().mockResolvedValue(undefined),
  rescheduleAll: vi.fn().mockResolvedValue(undefined),
  scheduleTaskNotifications: vi.fn().mockResolvedValue(undefined)
}));

import { useLifeStore } from './useLifeStore';
import { callSchedulerApi } from '../services/schedulerApi';

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
      pending_schedule_overflow: undefined,
      last_scheduler_parity: undefined,
      daily_energy_reports: [],
      energy_suggested_task_ids: [],
      energy_suggestion_bias: 0,
      transit_arrival_records: [],
      pending_transit_arrival_prompt: undefined,
      execution_records: [],
      pending_completion_check: undefined,
      is_replanning: false,
      replan_error: undefined,
      userProfile: {
        level: 1,
        currentXP: 0,
        skills: { focus: 0, vitality: 0, discipline: 0, wisdom: 0 },
        consistency: {
          currentStreak: 0,
          bestStreak: 0,
          totalActiveDays: 0,
          lastActiveDate: undefined
        },
        badges: []
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
    expect(useLifeStore.getState().lastSolverStatus).toBe('LOCAL_FALLBACK_REMOTE_UNAVAILABLE');
    expect(useLifeStore.getState().last_scheduler_parity?.status).toBe('remote_unavailable');
    expect(useLifeStore.getState().timeline.length).toBeGreaterThan(0);
  });

  it('marks parity as ok when remote scheduler responds with similar plan', async () => {
    useLifeStore.getState().addTask({
      title: 'Paridad OK',
      eta_minutes: 30,
      priority: 4,
      cognitive_load: 5,
      urgency: 'today'
    });
    const createdTaskId = useLifeStore.getState().tasks[0].id;

    vi.mocked(callSchedulerApi).mockResolvedValueOnce({
      blocks: [
        {
          id: 'remote-task-1',
          type: 'task',
          task_id: createdTaskId,
          title: 'Test Task',
          start_time: new Date('2026-04-11T10:00:00.000Z'),
          end_time: new Date('2026-04-11T10:30:00.000Z')
        }
      ],
      meta: {
        contract_version: '1.0.0',
        solver_status: 'OPTIMAL',
        solve_time_ms: 48,
        tasks_scheduled: 1,
        engine: 'ortools-cpsat'
      }
    });

    await useLifeStore.getState().generateTimeline(new Date('2026-04-11T09:00:00.000Z'));

    const state = useLifeStore.getState();
    expect(state.lastSolverStatus).toBe('LOCAL_PARITY_OK');
    expect(state.last_scheduler_parity?.status).toBe('ok');
    expect(state.last_scheduler_parity?.remote?.available).toBe(true);
  });

  it('opens an overflow prompt when the plan does not fit and resolves by postponing the rest', async () => {
    for (let index = 0; index < 5; index += 1) {
      useLifeStore.getState().addTask({
        title: `Overflow ${index + 1}`,
        eta_minutes: 60,
        priority: index % 2 === 0 ? 5 : 4,
        cognitive_load: 8,
        urgency: 'today'
      });
    }

    await useLifeStore.getState().generateTimeline(new Date('2026-04-11T09:00:00.000Z'));

    const prompt = useLifeStore.getState().pending_schedule_overflow;
    expect(prompt?.visible).toBe(true);
    expect(prompt?.candidateTasks.length).toBeGreaterThan(0);

    const keepTaskIds = prompt?.recommendedTaskIds ?? [];
    await useLifeStore.getState().resolveScheduleOverflow(keepTaskIds);

    const state = useLifeStore.getState();
    expect(state.pending_schedule_overflow).toBeUndefined();
    expect(state.tasks.some((task) => task.status === 'postponed')).toBe(true);
  });

  it('reports daily energy and generates prioritized suggestions', async () => {
    useLifeStore.getState().addTask({
      title: 'Deep Focus',
      eta_minutes: 80,
      priority: 5,
      cognitive_load: 9,
      urgency: 'today'
    });
    useLifeStore.getState().addTask({
      title: 'Quick Admin',
      eta_minutes: 20,
      priority: 3,
      cognitive_load: 2,
      urgency: 'this_week'
    });

    useLifeStore.getState().reportDailyEnergy(2, 'high', 'poco descanso');
    const stateAfterReport = useLifeStore.getState();

    expect(stateAfterReport.daily_energy_reports.length).toBe(1);
    expect(stateAfterReport.energy_suggested_task_ids.length).toBeGreaterThan(0);

    await useLifeStore.getState().applyEnergyBasedSuggestions();
    expect(useLifeStore.getState().timeline.length).toBeGreaterThan(0);
  });

  it('recalibrates energy suggestions when completions diverge from the reported level', async () => {
    useLifeStore.getState().addTask({
      title: 'Deep Focus',
      eta_minutes: 80,
      priority: 5,
      cognitive_load: 9,
      urgency: 'today'
    });
    useLifeStore.getState().addTask({
      title: 'Quick Admin',
      eta_minutes: 20,
      priority: 2,
      cognitive_load: 2,
      urgency: 'this_week'
    });

    await useLifeStore.getState().generateTimeline(new Date('2026-04-11T09:00:00.000Z'));
    useLifeStore.getState().reportDailyEnergy(1, 'high', 'muy cansado');

    const biasAfterReport = useLifeStore.getState().energy_suggestion_bias;
    const taskId = useLifeStore.getState().tasks[0].id;

    await useLifeStore.getState().confirmCompletionOK(taskId);

    const state = useLifeStore.getState();
    expect(state.daily_energy_reports[0]?.telemetry?.completedTaskCount).toBeGreaterThan(0);
    expect(state.daily_energy_reports[0]?.telemetry?.calibration).toBeDefined();
    expect(state.energy_suggestion_bias).not.toBe(biasAfterReport);
    expect(state.energy_suggested_task_ids.length).toBeGreaterThan(0);
  });

  it('prompts transit arrival after block ends and learns duration when user arrives late', () => {
    useLifeStore.setState((state) => ({
      ...state,
      timeline: [
        {
          id: 'transit-1',
          type: 'transit',
          title: '🚗 Casa -> U',
          start_time: new Date('2026-04-11T08:00:00.000Z'),
          end_time: new Date('2026-04-11T08:30:00.000Z'),
          isRoutineBlock: true,
          routineBlockKey: 'transit:transit-1',
          pinned: true
        }
      ],
      routines: state.routines.map((routine, index) => index === 6
        ? {
            ...routine,
            transits: [
              {
                id: 'transit-1',
                label: 'Casa -> U',
                time: '08:00',
                durationMinutes: 30,
                arrivalTime: '08:30'
              }
            ]
          }
        : routine
      )
    }));

    useLifeStore.getState().checkTransitArrivalPrompt(new Date('2026-04-11T08:31:00.000Z'));
    const prompt = useLifeStore.getState().pending_transit_arrival_prompt;
    expect(prompt?.visible).toBe(true);
    expect(prompt?.transitRoutineId).toBe('transit-1');

    useLifeStore.getState().respondTransitArrivalPrompt(false, new Date('2026-04-11T08:50:00.000Z'));
    const state = useLifeStore.getState();
    expect(state.pending_transit_arrival_prompt).toBeUndefined();
    expect(state.transit_arrival_records).toHaveLength(1);
    expect(state.transit_arrival_records[0].response).toBe('late');

    const updatedTransit = state.routines[6].transits.find((transit) => transit.id === 'transit-1');
    expect(updatedTransit?.durationMinutes).toBe(50);
    expect(updatedTransit?.arrivalTime).toBe('08:50');
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

  it('blocks moveBlock when adjacent target is static event', () => {
    useLifeStore.setState((state) => ({
      ...state,
      timeline: [
        {
          id: 'task-a',
          type: 'task',
          task_id: 'task-a',
          title: 'Task A',
          start_time: new Date('2026-04-11T10:00:00.000Z'),
          end_time: new Date('2026-04-11T10:30:00.000Z')
        },
        {
          id: 'event-fixed',
          type: 'task',
          title: 'Evento fijo',
          start_time: new Date('2026-04-11T10:30:00.000Z'),
          end_time: new Date('2026-04-11T11:00:00.000Z'),
          isStaticEvent: true,
          pinned: true
        }
      ]
    }));

    const before = [...useLifeStore.getState().timeline];
    const result = useLifeStore.getState().moveBlock('task-a', 'down');

    expect(result.moved).toBe(false);
    expect(result.reason).toBe('blocked_by_fixed');
    expect(useLifeStore.getState().timeline).toEqual(before);
  });

  it('blocks moveBlockToIndex across routine and ghost blocks', () => {
    useLifeStore.setState((state) => ({
      ...state,
      timeline: [
        {
          id: 'task-a',
          type: 'task',
          task_id: 'task-a',
          title: 'Task A',
          start_time: new Date('2026-04-11T08:00:00.000Z'),
          end_time: new Date('2026-04-11T08:30:00.000Z')
        },
        {
          id: 'routine-lock',
          type: 'meal',
          title: 'Rutina comida',
          start_time: new Date('2026-04-11T08:30:00.000Z'),
          end_time: new Date('2026-04-11T09:00:00.000Z'),
          isRoutineBlock: true,
          routineBlockKey: 'meal-1',
          pinned: true
        },
        {
          id: 'ghost-lock',
          type: 'task',
          task_id: 'task-ghost',
          title: 'Ghost bloqueado',
          start_time: new Date('2026-04-11T09:00:00.000Z'),
          end_time: new Date('2026-04-11T09:30:00.000Z'),
          isCompletedGhost: true,
          pinned: true
        },
        {
          id: 'task-b',
          type: 'task',
          task_id: 'task-b',
          title: 'Task B',
          start_time: new Date('2026-04-11T09:30:00.000Z'),
          end_time: new Date('2026-04-11T10:00:00.000Z')
        }
      ]
    }));

    const before = [...useLifeStore.getState().timeline];
    const result = useLifeStore.getState().moveBlockToIndex('task-a', 3);

    expect(result.moved).toBe(false);
    expect(result.reason).toBe('blocked_by_fixed');
    expect(result.suggestions).toBeDefined();
    expect(useLifeStore.getState().timeline).toEqual(before);
  });
});
