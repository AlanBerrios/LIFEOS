import { describe, expect, it } from 'vitest';
import { applyXpProgress, computeSkillLevelBonus, getSkillProgress } from './profileProgress';

describe('profileProgress', () => {
  it('derives independent skill levels from points', () => {
    expect(getSkillProgress(0)).toMatchObject({
      level: 1,
      current: 0,
      pointsToNext: 100
    });

    expect(getSkillProgress(245)).toMatchObject({
      level: 3,
      current: 45,
      pointsToNext: 55,
      completedLevels: 2
    });
  });

  it('awards bonus only when crossing skill level thresholds', () => {
    expect(computeSkillLevelBonus(95, 99)).toBe(0);
    expect(computeSkillLevelBonus(95, 100)).toBe(25);
    expect(computeSkillLevelBonus(90, 250)).toBe(50);
    expect(computeSkillLevelBonus(120, 110)).toBe(0);
  });

  it('applies profile xp level progress with positive and negative deltas', () => {
    expect(applyXpProgress(95, 1, 30)).toEqual({ level: 2, currentXP: 25 });
    expect(applyXpProgress(10, 2, -30)).toEqual({ level: 1, currentXP: 80 });
    expect(applyXpProgress(0, 1, -30)).toEqual({ level: 1, currentXP: 0 });
  });
});
