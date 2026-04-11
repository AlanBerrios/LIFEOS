import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { create } from 'zustand';
import { createContentSlice } from './slices/contentSlice';
import { createExecutionSlice } from './slices/executionSlice';
import { createHabitSlice } from './slices/habitSlice';
import { createProfileSlice } from './slices/profileSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createTaskSlice } from './slices/taskSlice';
import { DEFAULT_SETTINGS } from '../types';
import { createDefaultRoutines, DEFAULT_HABITS, partializeLifeState, revivePersistedState } from './lifeStore.persistence';
import type { LifeStore } from './lifeStore.types';

export type { SchedulerEngine, TaskDraft, TaskUpdate, LifeStore } from './lifeStore.types';

const initialState = {
  tasks: [],
  timeline: [],
  activeTimer: null,
  sessions: [],
  settings: DEFAULT_SETTINGS,
  habits: DEFAULT_HABITS,
  notes: [],
  alarms: [],
  events: [],
  routines: createDefaultRoutines(),
  travelLogs: [],
  userProfile: {
    level: 1,
    currentXP: 0,
    skills: { focus: 0, vitality: 0, discipline: 0, wisdom: 0 }
  },
  lastEngine: 'idle' as const,
  lastSolverStatus: '',
    isGenerating: false,
    // FASE C: Execution Nucleus
    execution_records: [],
    pending_completion_check: undefined,
    is_replanning: false,
    replan_error: undefined
};

export const useLifeStore = create<LifeStore>()(
  persist(
    (...args) => ({
      ...initialState,
      ...createProfileSlice(...args),
      ...createTaskSlice(...args),
      ...createHabitSlice(...args),
      ...createExecutionSlice(...args),
      ...createSettingsSlice(...args),
      ...createContentSlice(...args)
    }),
    {
      name: 'lifeos-storage-v4',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: partializeLifeState,
      merge: (persistedState, currentState) =>
        revivePersistedState(persistedState as Partial<LifeStore> | undefined, currentState as LifeStore)
    }
  )
);