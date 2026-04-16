import type { StateCreator } from 'zustand';
import { createId } from '../../utils/ids';
import { getTodayStr } from '../../utils/date';
import type { Habit, LifeStore } from '../lifeStore.types';
import { refreshHabitReminderEffect } from '../sideEffects/notifications';

export const createHabitSlice: StateCreator<LifeStore, [], [], Pick<LifeStore,
  'addHabit' | 'logHabit' | 'unlogHabit' | 'updateHabit' | 'deleteHabit'
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

    void refreshHabitReminderEffect(get, set);
  },

  logHabit: (id: string, value: number) => {
    let shouldAwardXP = false;
    set((state) => ({
      habits: state.habits.map((habit) => {
        if (habit.id !== id) return habit;
        const now = new Date();
        const todayStr = getTodayStr();
        const hasLoggedToday = habit.logs.some((log) => new Date(log.timestamp).toISOString().slice(0, 10) === todayStr);
        if (hasLoggedToday) {
          return habit;
        }

        const newLogs = [...habit.logs, { timestamp: now, value }];
        const newLastDate = todayStr;
        shouldAwardXP = true;

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
      get().addConsistencyActivity();
    }

    void refreshHabitReminderEffect(get, set);
  },

  unlogHabit: (id: string) => {
    const todayStr = getTodayStr();
    let shouldRevertXP = false;

    set((state) => ({
      habits: state.habits.map((habit) => {
        if (habit.id !== id) return habit;

        const todayLogs = habit.logs.filter((log) => new Date(log.timestamp).toISOString().slice(0, 10) === todayStr);
        if (todayLogs.length === 0) return habit;

        shouldRevertXP = true;
        const nextLogs = habit.logs.filter((log) => new Date(log.timestamp).toISOString().slice(0, 10) !== todayStr);
        const uniqueDates = Array.from(new Set(nextLogs.map((log) => new Date(log.timestamp).toISOString().slice(0, 10)))).sort().reverse();

        let nextStreak = 0;
        if (uniqueDates.length > 0) {
          const mostRecent = uniqueDates[0];
          const yesterday = new Date(todayStr);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

          if (mostRecent === yesterdayStr) {
            nextStreak = 1;
            let current = new Date(mostRecent);
            for (let index = 1; index < uniqueDates.length; index++) {
              current.setDate(current.getDate() - 1);
              if (uniqueDates[index] === current.toISOString().slice(0, 10)) {
                nextStreak += 1;
              } else {
                break;
              }
            }
          }
        }

        return {
          ...habit,
          logs: nextLogs,
          lastCompletedDate: nextLogs.some((log) => new Date(log.timestamp).toISOString().slice(0, 10) === todayStr)
            ? todayStr
            : nextLogs.length > 0
              ? new Date(nextLogs[nextLogs.length - 1].timestamp).toISOString().slice(0, 10)
              : undefined,
          streak: nextStreak
        };
      })
    }));

    if (shouldRevertXP) {
      get().addXP(-15, 'vitality');
    }

    void refreshHabitReminderEffect(get, set);
  },

  updateHabit: (id: string, updates: Partial<Habit>) => {
    set((state) => ({
      habits: state.habits.map((habit) => (habit.id === id ? { ...habit, ...updates } : habit))
    }));

    void refreshHabitReminderEffect(get, set);
  },

  deleteHabit: (id: string) => {
    set((state) => ({
      habits: state.habits.filter((habit) => habit.id !== id)
    }));

    void refreshHabitReminderEffect(get, set);
  }
});
