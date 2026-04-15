import type { StateCreator } from 'zustand';
import { createId } from '../../utils/ids';
import { toDate } from '../../utils/date';
import type { LifeStore, TaskDraft, TaskUpdate } from '../lifeStore.types';
import type { Task } from '../../types';

export const createTaskSlice: StateCreator<LifeStore, [], [], Pick<LifeStore,
  'addTask' | 'updateTask' | 'deleteTask' | 'startTask' | 'completeTask' | 'skipTask' | 'postponeTask'
>> = (set, get) => ({
  addTask: (task: TaskDraft) => {
    const created: Task = {
      id: createId('task'),
      title: task.title.trim(),
      description: task.description?.trim() || undefined,
      emoji: task.emoji?.trim() || undefined,
      color: task.color?.trim() || undefined,
      eta_minutes: Math.max(5, Math.round(task.eta_minutes)),
      priority: task.priority,
      cognitive_load: Math.max(1, Math.min(10, Math.round(task.cognitive_load))),
      deadline: toDate(task.deadline),
      fixed_start: toDate(task.fixed_start),
      fixed_end: toDate(task.fixed_end),
      urgency: task.urgency,
      status: 'pool',
      created_at: new Date()
    };

    set((state) => ({ tasks: [...state.tasks, created] }));
  },

  updateTask: (id: string, updates: TaskUpdate) => {
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id !== id) return task;
        return {
          ...task,
          title: updates.title?.trim() ?? task.title,
          description:
            updates.description === undefined
              ? task.description
              : updates.description.trim() || undefined,
          emoji:
            updates.emoji === undefined
              ? task.emoji
              : updates.emoji.trim() || undefined,
          color:
            updates.color === undefined
              ? task.color
              : updates.color.trim() || undefined,
          eta_minutes:
            updates.eta_minutes === undefined
              ? task.eta_minutes
              : Math.max(5, Math.round(updates.eta_minutes)),
          priority: updates.priority ?? task.priority,
          cognitive_load:
            updates.cognitive_load === undefined
              ? task.cognitive_load
              : Math.max(1, Math.min(10, Math.round(updates.cognitive_load))),
          deadline:
            updates.deadline === undefined ? task.deadline : toDate(updates.deadline),
          fixed_start:
            updates.fixed_start === undefined ? task.fixed_start : toDate(updates.fixed_start),
          fixed_end:
            updates.fixed_end === undefined ? task.fixed_end : toDate(updates.fixed_end),
          urgency: updates.urgency ?? task.urgency,
          status: updates.status ?? task.status
        };
      })
    }));
  },

  deleteTask: (id: string) => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
      timeline: state.timeline.filter((block) => block.task_id !== id),
      completedGhostBlocks: state.completedGhostBlocks.filter((block) => block.task_id !== id)
    }));
  },

  startTask: (id: string) => {
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === id ? { ...task, status: 'in_progress' } : task))
    }));
  },

  completeTask: (id: string) => {
    const task = get().tasks.find((current) => current.id === id);
    if (!task) return;

    set((state) => ({
      tasks: state.tasks.map((current) => (current.id === id ? { ...current, status: 'completed' } : current)),
      timeline: state.timeline.filter((block) => block.task_id !== id)
    }));

    const xp = (task.priority * 10) + (task.cognitive_load * 2);
    get().addXP(xp, 'focus');
    get().addConsistencyActivity();
  },

  skipTask: (id: string) => {
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === id ? { ...task, status: 'skipped' } : task)),
      timeline: state.timeline.filter((block) => block.task_id !== id)
    }));
    void get().generateTimeline();
  },

  postponeTask: (id: string) => {
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === id ? { ...task, status: 'postponed' } : task)),
      timeline: state.timeline.filter((block) => block.task_id !== id)
    }));
    void get().generateTimeline();
  }
});
