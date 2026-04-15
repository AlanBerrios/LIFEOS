import type { StateCreator } from 'zustand';
import type { LifeStore } from '../lifeStore.types';
import { getTodayStr } from '../../utils/date';

export const createRestDaySlice: StateCreator<LifeStore, [], [], Pick<LifeStore, 'markRestDay' | 'clearRestDay' | 'isRestDay'>> = (set, get) => ({
  markRestDay: (date?: string) => {
    const dateStr = date || getTodayStr();
    set((state) => {
      const updated = [...state.rest_days];
      if (!updated.includes(dateStr)) {
        updated.push(dateStr);
      }
      return { rest_days: updated };
    });
  },

  clearRestDay: (date?: string) => {
    const dateStr = date || getTodayStr();
    set((state) => ({
      rest_days: state.rest_days.filter((d) => d !== dateStr)
    }));
  },

  isRestDay: (date?: string) => {
    const dateStr = date || getTodayStr();
    return get().rest_days.includes(dateStr);
  }
});
