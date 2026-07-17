export const SKILL_LEVEL_SIZE = 100;
export const SKILL_LEVEL_BONUS_XP = 25;

export interface XpProgress {
  level: number;
  currentXP: number;
}

export interface SkillProgress {
  level: number;
  current: number;
  required: number;
  progress: number;
  pointsToNext: number;
  completedLevels: number;
}

export function getSkillProgress(points: number): SkillProgress {
  const safePoints = Math.max(0, Math.floor(points));
  const completedLevels = Math.floor(safePoints / SKILL_LEVEL_SIZE);
  const current = safePoints % SKILL_LEVEL_SIZE;
  const pointsToNext = current === 0 && safePoints > 0 ? SKILL_LEVEL_SIZE : SKILL_LEVEL_SIZE - current;

  return {
    level: completedLevels + 1,
    current,
    required: SKILL_LEVEL_SIZE,
    progress: current / SKILL_LEVEL_SIZE,
    pointsToNext,
    completedLevels
  };
}

export function computeSkillLevelBonus(beforePoints: number, afterPoints: number): number {
  if (afterPoints <= beforePoints) return 0;

  const beforeCompleted = getSkillProgress(beforePoints).completedLevels;
  const afterCompleted = getSkillProgress(afterPoints).completedLevels;
  return Math.max(0, afterCompleted - beforeCompleted) * SKILL_LEVEL_BONUS_XP;
}

export function applyXpProgress(currentXP: number, level: number, deltaXP: number): XpProgress {
  let nextXP = currentXP + deltaXP;
  let nextLevel = level;

  while (nextXP >= nextLevel * 100) {
    nextXP -= nextLevel * 100;
    nextLevel += 1;
  }

  while (nextXP < 0 && nextLevel > 1) {
    nextLevel -= 1;
    nextXP += nextLevel * 100;
  }

  return {
    level: nextLevel,
    currentXP: Math.max(0, nextXP)
  };
}
