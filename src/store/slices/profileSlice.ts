import type { StateCreator } from 'zustand';
import type { LifeStore } from '../lifeStore.types';
import { getTodayStr } from '../../utils/date';
import type { BadgeId, BadgeUnlock } from '../../types';
import { applyXpProgress, computeSkillLevelBonus } from '../domain/profileProgress';

interface BadgeDefinition extends Omit<BadgeUnlock, 'unlockedAt'> {
  xpReward: number;
}

function dayDiff(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00`);
  const to = new Date(`${toISO}T00:00:00`);
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

const BADGE_DEFS: BadgeDefinition[] = [
  { id: 'streak_3', title: 'Racha 3', description: '3 días de consistencia seguidos.', icon: '🔥', xpReward: 30 },
  { id: 'streak_7', title: 'Racha 7', description: '7 días de consistencia seguidos.', icon: '⚡', xpReward: 70 },
  { id: 'streak_14', title: 'Racha 14', description: '14 días de consistencia seguidos.', icon: '🏅', xpReward: 140 },
  { id: 'streak_30', title: 'Racha 30', description: '30 días de consistencia seguidos.', icon: '👑', xpReward: 300 },
  { id: 'active_10', title: 'Activo 10', description: '10 días activos acumulados.', icon: '✅', xpReward: 50 },
  { id: 'active_30', title: 'Activo 30', description: '30 días activos acumulados.', icon: '📈', xpReward: 120 },
  { id: 'active_60', title: 'Activo 60', description: '60 días activos acumulados.', icon: '🚀', xpReward: 250 }
];

function shouldUnlockBadge(id: BadgeId, currentStreak: number, totalActiveDays: number): boolean {
  if (id === 'streak_3') return currentStreak >= 3;
  if (id === 'streak_7') return currentStreak >= 7;
  if (id === 'streak_14') return currentStreak >= 14;
  if (id === 'streak_30') return currentStreak >= 30;
  if (id === 'active_10') return totalActiveDays >= 10;
  if (id === 'active_30') return totalActiveDays >= 30;
  return totalActiveDays >= 60;
}

export const createProfileSlice: StateCreator<LifeStore, [], [], Pick<LifeStore, 'addXP' | 'addConsistencyActivity'>> = (set) => ({
  addXP: (amount, skill) => {
    set((state) => {
      const { level, currentXP, skills } = state.userProfile;
      const beforeSkillPoints = skills[skill];
      const nextSkillPoints = Math.max(0, beforeSkillPoints + amount);
      const skillLevelBonus = computeSkillLevelBonus(beforeSkillPoints, nextSkillPoints);
      const nextSkills = { ...skills, [skill]: nextSkillPoints };
      const xpProgress = applyXpProgress(currentXP, level, amount + skillLevelBonus);

      return {
        userProfile: {
          ...state.userProfile,
          level: xpProgress.level,
          currentXP: xpProgress.currentXP,
          skills: nextSkills
        }
      };
    });
  },

  addConsistencyActivity: (date?: string) => {
    const dateISO = date ?? getTodayStr();

    set((state) => {
      const profile = state.userProfile;
      const prevDate = profile.consistency.lastActiveDate;

      // Evitar contar dos veces el mismo día
      if (prevDate === dateISO) {
        return state;
      }

      let currentStreak = 1;
      if (prevDate) {
        const diff = dayDiff(prevDate, dateISO);
        if (diff === 1) {
          currentStreak = profile.consistency.currentStreak + 1;
        }
      }

      const bestStreak = Math.max(profile.consistency.bestStreak, currentStreak);
      const totalActiveDays = profile.consistency.totalActiveDays + 1;

      const alreadyUnlocked = new Set(profile.badges.map((badge) => badge.id));
      const unlockedNow: BadgeUnlock[] = BADGE_DEFS
        .filter((def) => !alreadyUnlocked.has(def.id))
        .filter((def) => shouldUnlockBadge(def.id, currentStreak, totalActiveDays))
        .map((def) => ({
          ...def,
          unlockedAt: new Date()
        }));

      const xpFromBadges = BADGE_DEFS
        .filter((def) => unlockedNow.some((badge) => badge.id === def.id))
        .reduce((sum, def) => sum + def.xpReward, 0);

      const xpProgress = applyXpProgress(profile.currentXP, profile.level, xpFromBadges);

      return {
        userProfile: {
          ...profile,
          level: xpProgress.level,
          currentXP: xpProgress.currentXP,
          consistency: {
            currentStreak,
            bestStreak,
            totalActiveDays,
            lastActiveDate: dateISO
          },
          badges: [...profile.badges, ...unlockedNow],
          skills: {
            ...profile.skills,
            discipline: profile.skills.discipline + 5
          }
        }
      };
    });
  }
});
