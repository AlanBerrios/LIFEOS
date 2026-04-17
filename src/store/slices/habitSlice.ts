import type { StateCreator } from 'zustand';
import { createId } from '../../utils/ids';
import { getTodayStr } from '../../utils/date';
import type { Habit, LifeStore } from '../lifeStore.types';
import { refreshHabitReminderEffect } from '../sideEffects/notifications';

function toDateKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function dayTotals(logs: Habit['logs']): Map<string, number> {
  const totals = new Map<string, number>();
  for (const log of logs) {
    const key = toDateKey(log.timestamp);
    totals.set(key, (totals.get(key) ?? 0) + log.value);
  }
  return totals;
}

function completedDateSet(habit: Habit): Set<string> {
  const totals = dayTotals(habit.logs);
  const threshold = Math.max(1, habit.goalValue || 1);
  const completed = new Set<string>();

  totals.forEach((total, key) => {
    if (total >= threshold) completed.add(key);
  });

  return completed;
}

function previousDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function computeStreak(completedDates: Set<string>, todayStr: string): number {
  const yesterdayStr = previousDateKey(todayStr);
  if (!completedDates.has(todayStr) && !completedDates.has(yesterdayStr)) return 0;

  let streak = 0;
  let cursor = completedDates.has(todayStr) ? todayStr : yesterdayStr;
  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }
  return streak;
}

function latestDateKey(dateKeys: Set<string>): string | undefined {
  if (dateKeys.size === 0) return undefined;
  return Array.from(dateKeys).sort().at(-1);
}

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
    let shouldRevertXP = false;
    set((state) => ({
      habits: state.habits.map((habit) => {
        if (habit.id !== id) return habit;

        const todayStr = getTodayStr();
        const safeGoal = Math.max(1, habit.goalValue || 1);
        const currentTotals = dayTotals(habit.logs);
        const todayTotalBefore = currentTotals.get(todayStr) ?? 0;
        const wasCompletedToday = todayTotalBefore >= safeGoal;

        const nextTodayTotal = Math.max(0, todayTotalBefore + value);
        const logsWithoutToday = habit.logs.filter((log) => toDateKey(log.timestamp) !== todayStr);
        const nextLogs = nextTodayTotal > 0
          ? [...logsWithoutToday, { timestamp: new Date(), value: nextTodayTotal }]
          : logsWithoutToday;

        const updatedHabit: Habit = {
          ...habit,
          logs: nextLogs
        };

        const completedDates = completedDateSet(updatedHabit);
        const isCompletedToday = completedDates.has(todayStr);

        if (!wasCompletedToday && isCompletedToday) {
          shouldAwardXP = true;
        }
        if (wasCompletedToday && !isCompletedToday) {
          shouldRevertXP = true;
        }

        return {
          ...updatedHabit,
          lastCompletedDate: latestDateKey(completedDates),
          streak: computeStreak(completedDates, todayStr)
        };
      })
    }));
    if (shouldAwardXP) {
      get().addXP(15, 'vitality');
      get().addConsistencyActivity();
    }
    if (shouldRevertXP) {
      get().addXP(-15, 'vitality');
    }

    void refreshHabitReminderEffect(get, set);
  },

  unlogHabit: (id: string) => {
    const todayStr = getTodayStr();
    let shouldRevertXP = false;

    set((state) => ({
      habits: state.habits.map((habit) => {
        if (habit.id !== id) return habit;

        const safeGoal = Math.max(1, habit.goalValue || 1);
        const totalsBefore = dayTotals(habit.logs);
        const wasCompletedToday = (totalsBefore.get(todayStr) ?? 0) >= safeGoal;

        const nextLogs = habit.logs.filter((log) => toDateKey(log.timestamp) !== todayStr);
        const completedDates = completedDateSet({ ...habit, logs: nextLogs });

        if (wasCompletedToday) {
          shouldRevertXP = true;
        }

        return {
          ...habit,
          logs: nextLogs,
          lastCompletedDate: latestDateKey(completedDates),
          streak: computeStreak(completedDates, todayStr)
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
