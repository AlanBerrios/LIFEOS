import type { StateCreator } from 'zustand';
import type { LifeStore } from '../lifeStore.types';

export const createProfileSlice: StateCreator<LifeStore, [], [], Pick<LifeStore, 'addXP'>> = (set) => ({
  addXP: (amount, skill) => {
    set((state) => {
      const { level, currentXP, skills } = state.userProfile;
      const nextSkills = { ...skills, [skill]: skills[skill] + amount };
      let nextXP = currentXP + amount;
      let nextLevel = level;

      while (nextXP >= nextLevel * 100) {
        nextXP -= nextLevel * 100;
        nextLevel += 1;
      }

      return {
        userProfile: {
          level: nextLevel,
          currentXP: nextXP,
          skills: nextSkills
        }
      };
    });
  }
});
