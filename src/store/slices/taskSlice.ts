import type { StateCreator } from 'zustand';
import type { LifeStore, TaskDraft, TaskUpdate } from '../lifeStore.types';
import { applyTaskUpdate, computeTaskFocusXp, createTaskFromDraft, removeTaskBlocksById, setTaskStatus } from '../domain/taskRules';

export const createTaskSlice: StateCreator<LifeStore, [], [], Pick<LifeStore,
  'addTask' | 'updateTask' | 'deleteTask' | 'startTask' | 'completeTask' | 'skipTask' | 'postponeTask'
>> = (set, get) => ({
  addTask: (task: TaskDraft) => {
    const created = createTaskFromDraft(task);

    set((state) => ({ tasks: [...state.tasks, created] }));
  },

  updateTask: (id: string, updates: TaskUpdate) => {
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === id ? applyTaskUpdate(task, updates) : task))
    }));
  },

  deleteTask: (id: string) => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
      timeline: removeTaskBlocksById(state.timeline, id),
      completedGhostBlocks: removeTaskBlocksById(state.completedGhostBlocks, id)
    }));
  },

  startTask: (id: string) => {
    set((state) => ({
      tasks: setTaskStatus(state.tasks, id, 'in_progress')
    }));
  },

  completeTask: (id: string) => {
    const task = get().tasks.find((current) => current.id === id);
    if (!task) return;

    set((state) => ({
      tasks: setTaskStatus(state.tasks, id, 'completed'),
      timeline: removeTaskBlocksById(state.timeline, id)
    }));

    const xp = computeTaskFocusXp(task);
    get().addXP(xp, 'focus');
    get().addConsistencyActivity();
  },

  skipTask: (id: string) => {
    set((state) => ({
      tasks: setTaskStatus(state.tasks, id, 'skipped'),
      timeline: removeTaskBlocksById(state.timeline, id)
    }));
    void get().generateTimeline();
  },

  postponeTask: (id: string) => {
    set((state) => ({
      tasks: setTaskStatus(state.tasks, id, 'postponed'),
      timeline: removeTaskBlocksById(state.timeline, id)
    }));
    void get().generateTimeline();
  }
});
