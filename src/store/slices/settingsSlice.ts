import type { StateCreator } from 'zustand';
import type { AppSettings } from '../../types';
import type { LifeStore } from '../lifeStore.types';

export const createSettingsSlice: StateCreator<LifeStore, [], [], Pick<LifeStore, 'updateSettings' | 'clearOldSessions' | 'clearAllData'>> = (set) => ({
  updateSettings: (partial: Partial<AppSettings>) => {
    set((state) => ({
      settings: { ...state.settings, ...partial }
    }));
  },

  clearOldSessions: () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    set((state) => ({
      sessions: state.sessions.filter((session) => session.date >= cutoffStr)
    }));
  },

  clearAllData: () => {
    set((state) => ({
      tasks: [],
      timeline: [],
      sessions: [],
      activeTimer: null,
      habits: [],
      notes: [],
      alarms: [],
      events: [],
      routines: [],
      travelLogs: [],
      userProfile: {
        ...state.userProfile,
        currentXP: 0,
        level: 1,
        skills: { focus: 0, vitality: 0, discipline: 0, wisdom: 0 }
      },
      lastEngine: 'idle',
      lastSolverStatus: ''
    }));
  }
});
