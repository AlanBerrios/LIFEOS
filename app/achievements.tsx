import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLifeStore } from '../src/store/useLifeStore';
import { useAppTheme } from '../src/theme';
import { ScreenHeader } from '../src/components/ui';

type Rarity = 'común' | 'raro' | 'épico' | 'legendario' | 'misterioso';

type AchievementContext = {
  currentStreak: number;
  bestStreak: number;
  totalActiveDays: number;
  level: number;
  focus: number;
  vitality: number;
  discipline: number;
  wisdom: number;
  totalCompletedTasks: number;
  totalSessions: number;
  totalReplans: number;
  bestDayCompleted: number;
  energyReports: number;
};

type AchievementDefinition = {
  id: string;
  title: string;
  icon: string;
  requirement: string;
  hint?: string;
  xpReward: number;
  secret?: boolean;
  rarity: Rarity;
  getProgress: (ctx: AchievementContext) => string;
  isUnlocked: (ctx: AchievementContext) => boolean;
};

function makeStreakAchievement(
  id: string,
  title: string,
  icon: string,
  target: number,
  xpReward: number,
  rarity: Rarity
): AchievementDefinition {
  return {
    id,
    title,
    icon,
    requirement: `Mantén ${target} días seguidos de actividad.`,
    xpReward,
    rarity,
    getProgress: ({ currentStreak }) => `${Math.min(currentStreak, target)}/${target} días seguidos`,
    isUnlocked: ({ currentStreak }) => currentStreak >= target
  };
}

function makeActiveDaysAchievement(
  id: string,
  title: string,
  icon: string,
  target: number,
  xpReward: number,
  rarity: Rarity
): AchievementDefinition {
  return {
    id,
    title,
    icon,
    requirement: `Acumula ${target} días activos en total.`,
    xpReward,
    rarity,
    getProgress: ({ totalActiveDays }) => `${Math.min(totalActiveDays, target)}/${target} días activos`,
    isUnlocked: ({ totalActiveDays }) => totalActiveDays >= target
  };
}

function makeLevelAchievement(
  id: string,
  title: string,
  icon: string,
  target: number,
  xpReward: number,
  rarity: Rarity
): AchievementDefinition {
  return {
    id,
    title,
    icon,
    requirement: `Alcanza nivel ${target}.`,
    xpReward,
    rarity,
    getProgress: ({ level }) => `Nivel ${Math.min(level, target)}/${target}`,
    isUnlocked: ({ level }) => level >= target
  };
}

function makeSkillAchievement(
  id: string,
  title: string,
  icon: string,
  skillLabel: 'Enfoque' | 'Vitalidad' | 'Disciplina' | 'Sabiduría',
  getter: (ctx: AchievementContext) => number,
  target: number,
  xpReward: number,
  rarity: Rarity
): AchievementDefinition {
  return {
    id,
    title,
    icon,
    requirement: `Llega a ${target} puntos de ${skillLabel}.`,
    xpReward,
    rarity,
    getProgress: (ctx) => `${Math.min(getter(ctx), target)}/${target} ${skillLabel}`,
    isUnlocked: (ctx) => getter(ctx) >= target
  };
}

function makeThroughputAchievement(
  id: string,
  title: string,
  icon: string,
  target: number,
  unit: 'tareas' | 'sesiones',
  xpReward: number,
  rarity: Rarity,
  getter: (ctx: AchievementContext) => number
): AchievementDefinition {
  return {
    id,
    title,
    icon,
    requirement: `${unit === 'tareas' ? 'Completa' : 'Registra'} ${target} ${unit} acumuladas.`,
    xpReward,
    rarity,
    getProgress: (ctx) => `${Math.min(getter(ctx), target)}/${target} ${unit}`,
    isUnlocked: (ctx) => getter(ctx) >= target
  };
}

const ACHIEVEMENT_DEFS: AchievementDefinition[] = [
  // Streak
  makeStreakAchievement('streak_3', 'Racha 3', '🔥', 3, 30, 'común'),
  makeStreakAchievement('streak_7', 'Racha 7', '⚡', 7, 70, 'raro'),
  makeStreakAchievement('streak_14', 'Racha 14', '🏅', 14, 140, 'épico'),
  makeStreakAchievement('streak_30', 'Racha 30', '👑', 30, 300, 'legendario'),
  makeStreakAchievement('streak_60', 'Racha 60', '🌟', 60, 600, 'legendario'),
  makeStreakAchievement('streak_90', 'Racha 90', '🗿', 90, 900, 'legendario'),
  makeStreakAchievement('streak_180', 'Racha 180', '🌋', 180, 1800, 'legendario'),

  // Active days
  makeActiveDaysAchievement('active_10', 'Activo 10', '✅', 10, 50, 'común'),
  makeActiveDaysAchievement('active_30', 'Activo 30', '📈', 30, 120, 'raro'),
  makeActiveDaysAchievement('active_60', 'Activo 60', '🚀', 60, 250, 'épico'),
  makeActiveDaysAchievement('active_100', 'Activo 100', '💫', 100, 500, 'legendario'),
  makeActiveDaysAchievement('active_180', 'Activo 180', '🏛️', 180, 900, 'épico'),
  makeActiveDaysAchievement('active_365', 'Activo 365', '🌍', 365, 1500, 'legendario'),

  // Levels
  makeLevelAchievement('level_5', 'Aventurero Nivel 5', '🥉', 5, 90, 'común'),
  makeLevelAchievement('level_10', 'Aventurero Nivel 10', '🥈', 10, 160, 'raro'),
  makeLevelAchievement('level_20', 'Aventurero Nivel 20', '🥇', 20, 320, 'épico'),
  makeLevelAchievement('level_30', 'Leyenda Nivel 30', '🗡️', 30, 500, 'legendario'),

  // Skills
  makeSkillAchievement('focus_250', 'Mente Centrada', '🧠', 'Enfoque', (ctx) => ctx.focus, 250, 120, 'raro'),
  makeSkillAchievement('focus_500', 'Cerebro de Acero', '🎯', 'Enfoque', (ctx) => ctx.focus, 500, 220, 'épico'),
  makeSkillAchievement('focus_1000', 'Arquitecto Mental', '🧬', 'Enfoque', (ctx) => ctx.focus, 1000, 420, 'legendario'),

  makeSkillAchievement('vitality_250', 'Pulso Constante', '⚡', 'Vitalidad', (ctx) => ctx.vitality, 250, 120, 'raro'),
  makeSkillAchievement('vitality_500', 'Corazón de Titanio', '💪', 'Vitalidad', (ctx) => ctx.vitality, 500, 220, 'épico'),
  makeSkillAchievement('vitality_1000', 'Motor Infinito', '🌩️', 'Vitalidad', (ctx) => ctx.vitality, 1000, 420, 'legendario'),

  makeSkillAchievement('discipline_250', 'Ritmo Firme', '🛡️', 'Disciplina', (ctx) => ctx.discipline, 250, 120, 'raro'),
  makeSkillAchievement('discipline_500', 'Guardia de Hierro', '⛓️', 'Disciplina', (ctx) => ctx.discipline, 500, 220, 'épico'),
  makeSkillAchievement('discipline_1000', 'Código Inquebrantable', '🧱', 'Disciplina', (ctx) => ctx.discipline, 1000, 420, 'legendario'),

  makeSkillAchievement('wisdom_250', 'Reflexión Clara', '📘', 'Sabiduría', (ctx) => ctx.wisdom, 250, 120, 'raro'),
  makeSkillAchievement('wisdom_500', 'Estratega', '♟️', 'Sabiduría', (ctx) => ctx.wisdom, 500, 220, 'épico'),
  makeSkillAchievement('wisdom_1000', 'Oráculo', '🔮', 'Sabiduría', (ctx) => ctx.wisdom, 1000, 420, 'legendario'),

  // Throughput
  makeThroughputAchievement('tasks_50', 'Ejecutor 50', '📌', 50, 'tareas', 140, 'raro', (ctx) => ctx.totalCompletedTasks),
  makeThroughputAchievement('tasks_150', 'Ejecutor 150', '📦', 150, 'tareas', 260, 'épico', (ctx) => ctx.totalCompletedTasks),
  makeThroughputAchievement('tasks_300', 'Ejecutor 300', '🚚', 300, 'tareas', 420, 'legendario', (ctx) => ctx.totalCompletedTasks),
  makeThroughputAchievement('tasks_600', 'Forjador de Resultados', '🏗️', 600, 'tareas', 800, 'legendario', (ctx) => ctx.totalCompletedTasks),

  makeThroughputAchievement('sessions_30', '30 Sesiones', '🗓️', 30, 'sesiones', 180, 'raro', (ctx) => ctx.totalSessions),
  makeThroughputAchievement('sessions_90', '90 Sesiones', '📆', 90, 'sesiones', 320, 'épico', (ctx) => ctx.totalSessions),

  // Secret achievements
  {
    id: 'perfect_day',
    title: 'Día Perfecto',
    icon: '✨',
    requirement: '¿Secreto?',
    xpReward: 150,
    secret: true,
    rarity: 'misterioso',
    getProgress: ({ bestDayCompleted }) => `${Math.min(bestDayCompleted, 8)}/8 tareas en tu mejor día`,
    isUnlocked: ({ bestDayCompleted }) => bestDayCompleted >= 8
  },
  {
    id: 'night_owl',
    title: 'Búho Nocturno',
    icon: '🦉',
    requirement: '¿Secreto?',
    xpReward: 100,
    secret: true,
    rarity: 'misterioso',
    getProgress: ({ totalSessions }) => `${Math.min(totalSessions, 20)}/20 sesiones`,
    isUnlocked: ({ totalSessions, totalReplans }) => totalSessions >= 20 && totalReplans >= 8
  },
  {
    id: 'early_bird',
    title: 'Madrugador',
    icon: '🐦',
    requirement: '¿Secreto?',
    xpReward: 100,
    secret: true,
    rarity: 'misterioso',
    getProgress: ({ currentStreak }) => `${Math.min(currentStreak, 10)}/10 días seguidos`,
    isUnlocked: ({ currentStreak, totalSessions }) => currentStreak >= 10 && totalSessions >= 15
  },
  {
    id: 'multitasker',
    title: 'Multitarea',
    icon: '🎪',
    requirement: '¿Secreto?',
    xpReward: 80,
    secret: true,
    rarity: 'misterioso',
    getProgress: ({ bestDayCompleted }) => `${Math.min(bestDayCompleted, 5)}/5 tareas en un día`,
    isUnlocked: ({ bestDayCompleted }) => bestDayCompleted >= 5
  },
  {
    id: 'consistent_master',
    title: 'Maestro de la Consistencia',
    icon: '🏆',
    requirement: '¿Secreto?',
    xpReward: 200,
    secret: true,
    rarity: 'legendario',
    getProgress: ({ currentStreak }) => `${Math.min(currentStreak, 30)}/30 días seguidos`,
    isUnlocked: ({ currentStreak }) => currentStreak >= 30
  },
  {
    id: 'zero_drain',
    title: 'Mente Fresca',
    icon: '🧊',
    requirement: '¿Secreto?',
    xpReward: 120,
    secret: true,
    rarity: 'misterioso',
    getProgress: ({ energyReports }) => `${Math.min(energyReports, 7)}/7 reportes de energía`,
    isUnlocked: ({ energyReports, totalCompletedTasks }) => energyReports >= 7 && totalCompletedTasks >= 60
  },
  {
    id: 'comeback_kid',
    title: 'Niño del Regreso',
    icon: '🔄',
    requirement: '¿Secreto?',
    xpReward: 90,
    secret: true,
    rarity: 'raro',
    getProgress: ({ bestStreak, currentStreak }) => `${Math.min(bestStreak, 30)}/30 mejor racha · actual ${currentStreak}`,
    isUnlocked: ({ bestStreak, currentStreak }) => bestStreak >= 30 && currentStreak >= 7 && currentStreak < bestStreak
  },
  {
    id: 'focus_master',
    title: 'Maestro del Enfoque',
    icon: '🎯',
    requirement: '¿Secreto?',
    xpReward: 150,
    secret: true,
    rarity: 'épico',
    getProgress: ({ focus }) => `${Math.min(focus, 750)}/750 Enfoque`,
    isUnlocked: ({ focus }) => focus >= 750
  },
  {
    id: 'all_nighter',
    title: 'Desvelo Total',
    icon: '🌙',
    requirement: '¿Secreto?',
    xpReward: 75,
    secret: true,
    rarity: 'raro',
    getProgress: ({ totalSessions }) => `${Math.min(totalSessions, 60)}/60 sesiones`,
    isUnlocked: ({ totalSessions, totalReplans }) => totalSessions >= 60 && totalReplans >= 20
  },
  {
    id: 'speedrunner',
    title: 'Velocista',
    icon: '⚡🏃',
    requirement: '¿Secreto?',
    xpReward: 110,
    secret: true,
    rarity: 'épico',
    getProgress: ({ totalCompletedTasks }) => `${Math.min(totalCompletedTasks, 200)}/200 tareas`,
    isUnlocked: ({ totalCompletedTasks, focus, discipline }) => totalCompletedTasks >= 200 && focus >= 500 && discipline >= 300
  },
  {
    id: 'phoenix_mode',
    title: 'Modo Fénix',
    icon: '🔥🪽',
    requirement: '¿Secreto?',
    xpReward: 180,
    secret: true,
    rarity: 'misterioso',
    getProgress: ({ bestStreak, currentStreak }) => `${Math.min(bestStreak, 60)}/60 mejor racha · actual ${currentStreak}`,
    isUnlocked: ({ bestStreak, currentStreak }) => bestStreak >= 60 && currentStreak >= 14 && currentStreak < bestStreak
  },
  {
    id: 'iron_mind',
    title: 'Mente de Hierro',
    icon: '🧱🧠',
    requirement: '¿Secreto?',
    xpReward: 220,
    secret: true,
    rarity: 'legendario',
    getProgress: ({ discipline }) => `${Math.min(discipline, 1000)}/1000 Disciplina`,
    isUnlocked: ({ discipline }) => discipline >= 1000
  },
  {
    id: 'strategic_brain',
    title: 'Cerebro Estratégico',
    icon: '♟️🧠',
    requirement: '¿Secreto?',
    xpReward: 220,
    secret: true,
    rarity: 'legendario',
    getProgress: ({ wisdom }) => `${Math.min(wisdom, 1000)}/1000 Sabiduría`,
    isUnlocked: ({ wisdom }) => wisdom >= 1000
  },
  {
    id: 'ritual_keeper',
    title: 'Guardián del Ritual',
    icon: '🕯️',
    requirement: '¿Secreto?',
    xpReward: 180,
    secret: true,
    rarity: 'épico',
    getProgress: ({ vitality, discipline }) => `${Math.min(vitality, 750)}/750 Vitalidad · ${Math.min(discipline, 750)}/750 Disciplina`,
    isUnlocked: ({ vitality, discipline }) => vitality >= 750 && discipline >= 750
  },
  {
    id: 'ghost_mode',
    title: 'Modo Fantasma',
    icon: '👻',
    requirement: '¿Secreto?',
    xpReward: 160,
    secret: true,
    rarity: 'misterioso',
    getProgress: ({ totalSessions }) => `${Math.min(totalSessions, 30)}/30 sesiones`,
    isUnlocked: ({ totalSessions, totalReplans }) => totalSessions >= 30 && totalReplans === 0
  }
];

function getRarityColor(rarity: Rarity, colors: ReturnType<typeof useAppTheme>['colors']): string {
  switch (rarity) {
    case 'común':
      return colors.muted;
    case 'raro':
      return colors.primary;
    case 'épico':
      return '#a78bfa';
    case 'legendario':
      return '#fbbf24';
    case 'misterioso':
      return '#ec4899';
    default:
      return colors.text;
  }
}

function getSecretHint(id: string): string {
  const hints: Record<string, string> = {
    perfect_day: 'Pista: intenta cerrar un dia con muchas tareas completadas.',
    night_owl: 'Pista: combina varias sesiones con reorganizaciones nocturnas.',
    early_bird: 'Pista: construye una racha estable con sesiones frecuentes.',
    multitasker: 'Pista: concentra varias tareas completadas en un mismo dia.',
    consistent_master: 'Pista: la consistencia larga desbloquea este logro.',
    zero_drain: 'Pista: registra energia y completa tareas de forma sostenida.',
    comeback_kid: 'Pista: recupera una racha fuerte despues de una caida.',
    focus_master: 'Pista: sube tu atributo de Enfoque a un punto alto.',
    all_nighter: 'Pista: acumula sesiones y varias reorganizaciones exigentes.',
    speedrunner: 'Pista: completa muchas tareas con Enfoque y Disciplina altos.',
    phoenix_mode: 'Pista: vuelve a levantar una racha despues de una mejor marca.',
    iron_mind: 'Pista: lleva Disciplina a su tramo mas alto.',
    strategic_brain: 'Pista: desarrolla Sabiduria hasta nivel experto.',
    ritual_keeper: 'Pista: combina Vitalidad y Disciplina en niveles altos.',
    ghost_mode: 'Pista: avanza muchas sesiones sin aceptar replanteos.'
  };
  return hints[id] ?? 'Pista: sigue usando LifeOS de forma consistente.';
}

export default function AchievementsScreen(): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const userProfile = useLifeStore((s) => s.userProfile);
  const sessions = useLifeStore((s) => s.sessions);
  const replanHistory = useLifeStore((s) => s.replan_history);
  const dailyEnergyReports = useLifeStore((s) => s.daily_energy_reports);

  const [filterSecret, setFilterSecret] = useState(false);

  const sortedBadges = [...userProfile.badges].sort(
    (a, b) => b.unlockedAt.getTime() - a.unlockedAt.getTime()
  );

  const unlockedBadgeMap = new Map<string, (typeof sortedBadges)[number]>(
    sortedBadges.map((badge) => [badge.id, badge])
  );

  const context = useMemo<AchievementContext>(() => {
    const totalCompletedTasks = sessions.reduce((sum, session) => sum + (session.tasksCompleted ?? 0), 0);
    const bestDayCompleted = sessions.reduce((max, session) => Math.max(max, session.tasksCompleted ?? 0), 0);

    return {
      currentStreak: userProfile.consistency.currentStreak,
      bestStreak: userProfile.consistency.bestStreak,
      totalActiveDays: userProfile.consistency.totalActiveDays,
      level: userProfile.level,
      focus: userProfile.skills.focus,
      vitality: userProfile.skills.vitality,
      discipline: userProfile.skills.discipline,
      wisdom: userProfile.skills.wisdom,
      totalCompletedTasks,
      totalSessions: sessions.length,
      totalReplans: replanHistory.length,
      bestDayCompleted,
      energyReports: dailyEnergyReports.length
    };
  }, [dailyEnergyReports.length, replanHistory.length, sessions, userProfile]);

  const achievements = useMemo(() => {
    return ACHIEVEMENT_DEFS.map((def) => {
      const persistedBadge = unlockedBadgeMap.get(def.id);
      const unlocked = Boolean(persistedBadge) || def.isUnlocked(context);

      return {
        ...def,
        hint: def.hint ?? (def.secret ? getSecretHint(def.id) : undefined),
        unlocked,
        unlockedAt: persistedBadge?.unlockedAt,
        progressLabel: def.getProgress(context)
      };
    });
  }, [context, unlockedBadgeMap]);

  const filteredAchievements = filterSecret ? achievements.filter((a) => a.secret) : achievements;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 48 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(220)} style={styles.header}>
        <ScreenHeader
          onBack={() => router.back()}
          eyebrow="Progreso"
          title="Logros"
          subtitle={`${unlockedCount}/${totalCount} desbloqueados`}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(90).duration(260)} style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: lifeTheme.colors.success }]}>{unlockedCount}</Text>
          <Text style={styles.statLabel}>Desbloqueados</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: lifeTheme.colors.alert }]}>{totalCount - unlockedCount}</Text>
          <Text style={styles.statLabel}>Faltantes</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#ec4899' }]}>{achievements.filter((a) => a.secret).length}</Text>
          <Text style={styles.statLabel}>Secretos</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(130).duration(260)}>
        <Pressable
          style={[styles.filterBtn, filterSecret && styles.filterBtnActive]}
          onPress={() => setFilterSecret((prev) => !prev)}
        >
          <Text style={styles.filterBtnText}>
            {filterSecret ? 'Mostrando secretos' : 'Mostrar solo secretos'}
          </Text>
        </Pressable>
      </Animated.View>

      <View style={styles.grid}>
        {filteredAchievements.map((achievement, idx) => {
          const rarityColor = getRarityColor(achievement.rarity, lifeTheme.colors);
          const isHiddenSecret = achievement.secret && !achievement.unlocked;

          return (
            <Animated.View
              key={achievement.id}
              entering={FadeInRight.delay(idx * 30).duration(220)}
              style={styles.achievementWrapper}
            >
              <View
                style={[
                  styles.achievementCard,
                  !achievement.unlocked && styles.achievementCardLocked,
                  achievement.secret && styles.achievementCardSecret
                ]}
              >
                <View style={styles.achievementHeader}>
                  <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                  {achievement.secret && <Text style={styles.secretBadge}>🔐</Text>}
                </View>

                <Text style={[styles.achievementTitle, !achievement.unlocked && styles.achievementTitleLocked]}>
                  {isHiddenSecret ? 'Logro Secreto' : achievement.title}
                </Text>

                <Text style={[styles.rarityBadge, { color: rarityColor, borderColor: rarityColor }]}>
                  {achievement.rarity}
                </Text>

                <Text style={styles.requirementText} numberOfLines={3}>
                  {isHiddenSecret ? achievement.hint : achievement.requirement}
                </Text>

                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>{achievement.progressLabel}</Text>
                </View>

                <View style={styles.rewardRow}>
                  <Text style={styles.rewardText}>+{achievement.xpReward} XP</Text>
                  {achievement.unlocked && (
                    <Text style={styles.unlockedAt}>
                      {achievement.unlockedAt
                        ? achievement.unlockedAt.toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit'
                          })
                        : 'Auto'}
                    </Text>
                  )}
                </View>

                {!achievement.unlocked && (
                  <View style={styles.lockOverlay}>
                    <Text style={styles.lockIcon}>🔒</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: lifeTheme.colors.background
    },
    content: {
      padding: 14,
      gap: 12
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8
    },
    statBox: {
      flex: 1,
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: lifeTheme.radius.md,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 10,
      alignItems: 'center',
      gap: 4
    },
    statNumber: {
      fontSize: 20,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    statLabel: {
      fontSize: 11,
      color: lifeTheme.colors.muted,
      fontWeight: '700',
      textTransform: 'uppercase'
    },
    filterBtn: {
      minHeight: 48,
      backgroundColor: lifeTheme.colors.surface,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: lifeTheme.radius.md,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: 'center'
    },
    filterBtnActive: {
      backgroundColor: `${lifeTheme.colors.primary}20`,
      borderColor: lifeTheme.colors.primary
    },
    filterBtnText: {
      color: lifeTheme.colors.text,
      fontWeight: '700',
      fontSize: 13
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    achievementWrapper: {
      width: '48.8%'
    },
    achievementCard: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: lifeTheme.radius.md,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 10,
      gap: 6,
      minHeight: 168,
      position: 'relative'
    },
    achievementCardLocked: {
      opacity: 0.82
    },
    achievementCardSecret: {
      borderStyle: 'dashed',
      borderColor: '#ec4899'
    },
    achievementHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    },
    achievementIcon: {
      fontSize: 24
    },
    secretBadge: {
      fontSize: 14
    },
    achievementTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: lifeTheme.colors.text,
      lineHeight: 16
    },
    achievementTitleLocked: {
      color: lifeTheme.colors.muted
    },
    rarityBadge: {
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: 'flex-start'
    },
    requirementText: {
      fontSize: 10,
      color: lifeTheme.colors.muted,
      lineHeight: 14
    },
    progressRow: {
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 6
    },
    progressText: {
      fontSize: 10,
      color: lifeTheme.colors.text,
      fontWeight: '600',
      lineHeight: 13
    },
    rewardRow: {
      marginTop: 'auto',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8
    },
    rewardText: {
      fontSize: 11,
      fontWeight: '800',
      color: lifeTheme.colors.success
    },
    unlockedAt: {
      fontSize: 10,
      color: lifeTheme.colors.muted,
      fontWeight: '600'
    },
    lockOverlay: {
      position: 'absolute',
      top: 10,
      right: 10
    },
    lockIcon: {
      fontSize: 14
    }
  });
}
