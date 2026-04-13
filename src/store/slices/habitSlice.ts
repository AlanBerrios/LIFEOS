import type { StateCreator } from 'zustand';
import { createId } from '../../utils/ids';
import { getTodayStr } from '../../utils/date';
import type { Habit, LifeStore } from '../lifeStore.types';

export const createHabitSlice: StateCreator<LifeStore, [], [], Pick<LifeStore,
  'addHabit' | 'logHabit' | 'updateHabit' | 'deleteHabit'
>> = (set, get) => ({
  addHabit: (habit) => {
    set((state) => ({
      habits: [
        ...state.habits,
        {
          id: createId('habit'),
          ...habit,
          logs: [],
          streak: 0
        }
      ]
    }));
  },

  logHabit: (id: string, value: number) => {
    let shouldAwardXP = false;
    set((state) => ({
      habits: state.habits.map((habit) => {
        if (habit.id !== id) return habit;
        const now = new Date();
        const todayStr = getTodayStr();
        const isUnmarking = habit.lastCompletedDate === todayStr;

        let newLogs = [...habit.logs];
        let newLastDate = habit.lastCompletedDate;

        if (isUnmarking) {
          newLogs = newLogs.filter((log) => new Date(log.timestamp).toISOString().slice(0, 10) !== todayStr);
          if (newLogs.length > 0) {
            const sorted = newLogs.map((log) => new Date(log.timestamp).toISOString().slice(0, 10)).sort();
            newLastDate = sorted[sorted.length - 1];
          } else {
            newLastDate = undefined;
          }
        } else {
          newLogs.push({ timestamp: now, value });
          newLastDate = todayStr;
          shouldAwardXP = true;
        }

        let newStreak = 0;
        if (newLogs.length > 0) {
          const uniqueDates = Array.from(new Set(newLogs.map((log) => new Date(log.timestamp).toISOString().slice(0, 10)))).sort().reverse();
          const mostRecent = uniqueDates[0];
          const yesterday = new Date(todayStr);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

          if (mostRecent === todayStr || mostRecent === yesterdayStr) {
            newStreak = 1;
            let current = new Date(mostRecent);
            for (let index = 1; index < uniqueDates.length; index++) {
              current.setDate(current.getDate() - 1);
              if (uniqueDates[index] === current.toISOString().slice(0, 10)) {
                newStreak += 1;
              } else {
                break;
              }
            }
          }
        }

        return { ...habit, logs: newLogs, lastCompletedDate: newLastDate, streak: newStreak };
      })
    }));
    if (shouldAwardXP) {
      get().addXP(15, 'vitality');
    }
  },

  updateHabit: (id: string, updates: Partial<Habit>) => {
    set((state) => ({
      habits: state.habits.map((habit) => (habit.id === id ? { ...habit, ...updates } : habit))
    }));
  },

  deleteHabit: (id: string) => {
    set((state) => ({
      habits: state.habits.filter((habit) => habit.id !== id)
    }));
  }
});
