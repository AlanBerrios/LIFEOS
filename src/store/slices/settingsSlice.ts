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
      completedGhostBlocks: [],
      sessions: [],
      activeTimer: null,
      habits: [],
      notes: [],
      alarms: [],
      events: [],
      routines: [],
      routineOverrides: [],
      travelLogs: [],
      userProfile: {
        ...state.userProfile,
        currentXP: 0,
        level: 1,
        skills: { focus: 0, vitality: 0, discipline: 0, wisdom: 0 },
        consistency: {
          currentStreak: 0,
          bestStreak: 0,
          totalActiveDays: 0,
          lastActiveDate: undefined
        },
        badges: []
      },
      lastEngine: 'idle',
      lastSolverStatus: '',
      pending_schedule_overflow: undefined,
      pending_free_block_opportunity: undefined,
      global_alert: undefined,
      last_scheduler_parity: undefined,
      daily_energy_reports: [],
      energy_suggested_task_ids: [],
      energy_suggestion_bias: 0,
      transit_arrival_records: [],
      pending_transit_arrival_prompt: undefined
    }));
  }
});
