import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLifeStore } from '../src/store/useLifeStore';
import { useAppTheme } from '../src/theme';
import type { BadgeId } from '../src/types';

type AchievementDefinition = {
  id: BadgeId;
  title: string;
  icon: string;
  requirement: string;
  xpReward: number;
  secret?: boolean;
  rarity?: 'común' | 'raro' | 'épico' | 'legendario' | 'misterioso';
  getProgress: (input: { currentStreak: number; totalActiveDays: number }) => string;
};

const ACHIEVEMENT_DEFS: AchievementDefinition[] = [
  // Streak achievements
  {
    id: 'streak_3',
    title: 'Racha 3',
    icon: '🔥',
    requirement: 'Mantén 3 días seguidos de actividad.',
    xpReward: 30,
    rarity: 'común',
    getProgress: ({ currentStreak }) => `${Math.min(currentStreak, 3)}/3 días seguidos`
  },
  {
    id: 'streak_7',
    title: 'Racha 7',
    icon: '⚡',
    requirement: 'Mantén 7 días seguidos de actividad.',
    xpReward: 70,
    rarity: 'raro',
    getProgress: ({ currentStreak }) => `${Math.min(currentStreak, 7)}/7 días seguidos`
  },
  {
    id: 'streak_14',
    title: 'Racha 14',
    icon: '🏅',
    requirement: 'Mantén 14 días seguidos de actividad.',
    xpReward: 140,
    rarity: 'épico',
    getProgress: ({ currentStreak }) => `${Math.min(currentStreak, 14)}/14 días seguidos`
  },
  {
    id: 'streak_30',
    title: 'Racha 30',
    icon: '👑',
    requirement: 'Mantén 30 días seguidos de actividad.',
    xpReward: 300,
    rarity: 'legendario',
    getProgress: ({ currentStreak }) => `${Math.min(currentStreak, 30)}/30 días seguidos`
  },
  {
    id: 'streak_60',
    title: 'Racha 60',
    icon: '🌟',
    requirement: 'Mantén 60 días seguidos de actividad.',
    xpReward: 600,
    rarity: 'legendario',
    getProgress: ({ currentStreak }) => `${Math.min(currentStreak, 60)}/60 días seguidos`
  },

  // Active days achievements
  {
    id: 'active_10',
    title: 'Activo 10',
    icon: '✅',
    requirement: 'Acumula 10 días activos en total.',
    xpReward: 50,
    rarity: 'común',
    getProgress: ({ totalActiveDays }) => `${Math.min(totalActiveDays, 10)}/10 días activos`
  },
  {
    id: 'active_30',
    title: 'Activo 30',
    icon: '📈',
    requirement: 'Acumula 30 días activos en total.',
    xpReward: 120,
    rarity: 'raro',
    getProgress: ({ totalActiveDays }) => `${Math.min(totalActiveDays, 30)}/30 días activos`
  },
  {
    id: 'active_60',
    title: 'Activo 60',
    icon: '🚀',
    requirement: 'Acumula 60 días activos en total.',
    xpReward: 250,
    rarity: 'épico',
    getProgress: ({ totalActiveDays }) => `${Math.min(totalActiveDays, 60)}/60 días activos`
  },
  {
    id: 'active_100',
    title: 'Activo 100',
    icon: '💫',
    requirement: 'Acumula 100 días activos en total.',
    xpReward: 500,
    rarity: 'legendario',
    getProgress: ({ totalActiveDays }) => `${Math.min(totalActiveDays, 100)}/100 días activos`
  },

  // Secret achievements
  {
    id: 'perfect_day',
    title: 'Día Perfecto',
    icon: '✨',
    requirement: '¿Secreto?',
    xpReward: 150,
    secret: true,
    rarity: 'misterioso',
    getProgress: () => 'Completa todas tus tareas planeadas...'
  },
  {
    id: 'night_owl',
    title: 'Búho Nocturno',
    icon: '🦉',
    requirement: '¿Secreto?',
    xpReward: 100,
    secret: true,
    rarity: 'misterioso',
    getProgress: () => 'Trabaja después de las 22:00...'
  },
  {
    id: 'early_bird',
    title: 'Madrugador',
    icon: '🐦',
    requirement: '¿Secreto?',
    xpReward: 100,
    secret: true,
    rarity: 'misterioso',
    getProgress: () => 'Completa una tarea antes de las 08:00...'
  },
  {
    id: 'multitasker',
    title: 'Multitarea',
    icon: '🎪',
    requirement: '¿Secreto?',
    xpReward: 80,
    secret: true,
    rarity: 'misterioso',
    getProgress: () => 'Completa 5+ tareas en un solo día...'
  },
  {
    id: 'consistent_master',
    title: 'Maestro de la Consistencia',
    icon: '🏆',
    requirement: '¿Secreto?',
    xpReward: 200,
    secret: true,
    rarity: 'legendario',
    getProgress: () => 'Mantén una racha de 30+ días...'
  },
  {
    id: 'zero_drain',
    title: 'Mente Fresca',
    icon: '🧊',
    requirement: '¿Secreto?',
    xpReward: 120,
    secret: true,
    rarity: 'misterioso',
    getProgress: () => 'Completa el día sin sobrecargar tu energía cognitiva...'
  },
  {
    id: 'comeback_kid',
    title: 'Niño del Regreso',
    icon: '🔄',
    requirement: '¿Secreto?',
    xpReward: 90,
    secret: true,
    rarity: 'raro',
    getProgress: () => 'Rompe una racha, luego crea una nueva de 7+ días...'
  },
  {
    id: 'focus_master',
    title: 'Maestro del Enfoque',
    icon: '🎯',
    requirement: '¿Secreto?',
    xpReward: 150,
    secret: true,
    rarity: 'épico',
    getProgress: () => 'Alcanza 500 puntos de Enfoque (🧠)...'
  },
  {
    id: 'all_nighter',
    title: 'Desvelo Total',
    icon: '🌙',
    requirement: '¿Secreto?',
    xpReward: 75,
    secret: true,
    rarity: 'raro',
    getProgress: () => 'Completa tareas en 4+ horas seguidas sin descanso...'
  },
  {
    id: 'speedrunner',
    title: 'Velocista',
    icon: '⚡🏃',
    requirement: '¿Secreto?',
    xpReward: 110,
    secret: true,
    rarity: 'épico',
    getProgress: () => 'Completa una tarea 50% más rápido que su estimación...'
  },
];

export default function AchievementsScreen(): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userProfile = useLifeStore((s) => s.userProfile);
  const [filterSecret, setFilterSecret] = useState(false);

  const sortedBadges = [...userProfile.badges].sort(
    (a, b) => b.unlockedAt.getTime() - a.unlockedAt.getTime()
  );
  const unlockedBadgeMap = new Map(sortedBadges.map((badge) => [badge.id, badge]));

  const achievements = ACHIEVEMENT_DEFS.map((def) => {
    const unlockedBadge = unlockedBadgeMap.get(def.id);
    const unlocked = Boolean(unlockedBadge);
    return {
      ...def,
      unlocked,
      unlockedAt: unlockedBadge?.unlockedAt,
      progressLabel: def.getProgress({
        currentStreak: userProfile.consistency.currentStreak,
        totalActiveDays: userProfile.consistency.totalActiveDays
      })
    };
  });

  const filteredAchievements = filterSecret ? achievements.filter(a => a.secret) : achievements;
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case 'común': return lifeTheme.colors.muted;
      case 'raro': return lifeTheme.colors.primary;
      case 'épico': return '#a78bfa';
      case 'legendario': return '#fbbf24';
      case 'misterioso': return '#ec4899';
      default: return lifeTheme.colors.text;
    }
  };

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Atrás</Text>
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Logros RPG</Text>
            <Text style={styles.headerSub}>
              {unlockedCount} de {totalCount} desbloqueados
            </Text>
          </View>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: lifeTheme.colors.success }]}>
              {unlockedCount}
            </Text>
            <Text style={styles.statLabel}>Desbloqueados</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: lifeTheme.colors.alert }]}>
              {totalCount - unlockedCount}
            </Text>
            <Text style={styles.statLabel}>Faltantes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#ec4899' }]}>
              {achievements.filter(a => a.secret).length}
            </Text>
            <Text style={styles.statLabel}>Secretos</Text>
          </View>
        </Animated.View>

        {/* Filter button */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <Pressable
            style={[styles.filterBtn, filterSecret && styles.filterBtnActive]}
            onPress={() => setFilterSecret(!filterSecret)}
          >
            <Text style={styles.filterBtnText}>
              {filterSecret ? '🔐 Mostrando secretos' : '🔓 Mostrar secretos'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Achievements grid */}
        <View style={styles.grid}>
          {filteredAchievements.map((achievement, idx) => (
            <Animated.View
              key={achievement.id}
              entering={FadeInRight.delay(idx * 50).duration(300)}
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
                  {achievement.title}
                </Text>

                <Text
                  style={[
                    styles.rarityBadge,
                    { color: getRarityColor(achievement.rarity), borderColor: getRarityColor(achievement.rarity) }
                  ]}
                >
                  {achievement.rarity}
                </Text>

                <Text style={styles.requirementText}>{achievement.requirement}</Text>

                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>{achievement.progressLabel}</Text>
                </View>

                <View style={styles.rewardRow}>
                  <Text style={styles.rewardText}>+{achievement.xpReward} XP</Text>
                  {achievement.unlocked && (
                    <Text style={styles.unlockedAt}>
                      {achievement.unlockedAt?.toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit'
                      })}
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
          ))}
        </View>
      </ScrollView>
    </>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: lifeTheme.colors.background
    },
    content: {
      padding: lifeTheme.spacing.lg,
      gap: lifeTheme.spacing.lg
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8
    },
    backBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: `${lifeTheme.colors.primary}20`,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center'
    },
    backBtnText: {
      color: lifeTheme.colors.primary,
      fontWeight: '600',
      fontSize: 14
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '900',
      color: lifeTheme.colors.text,
      marginBottom: 4
    },
    headerSub: {
      fontSize: 12,
      color: lifeTheme.colors.muted,
      fontWeight: '500'
    },
    statsRow: {
      flexDirection: 'row',
      gap: lifeTheme.spacing.md,
      marginBottom: 8
    },
    statBox: {
      flex: 1,
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: lifeTheme.radius.md,
      padding: lifeTheme.spacing.md,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      alignItems: 'center',
      justifyContent: 'center'
    },
    statNumber: {
      fontSize: 28,
      fontWeight: '900',
      fontFamily: 'monospace',
      marginBottom: 4
    },
    statLabel: {
      fontSize: 11,
      color: lifeTheme.colors.muted,
      fontWeight: '500'
    },
    filterBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      alignItems: 'center',
      justifyContent: 'center'
    },
    filterBtnActive: {
      backgroundColor: `#ec4899${Math.round(0.15 * 255).toString(16).padStart(2, '0')}`,
      borderColor: '#ec4899'
    },
    filterBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: lifeTheme.colors.text
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: lifeTheme.spacing.md,
      justifyContent: 'space-between'
    },
    achievementWrapper: {
      width: '48%'
    },
    achievementCard: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: lifeTheme.radius.md,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: lifeTheme.spacing.md,
      gap: 8
    },
    achievementCardLocked: {
      opacity: 0.6
    },
    achievementCardSecret: {
      borderColor: '#ec4899',
      backgroundColor: `#ec4899${Math.round(0.05 * 255).toString(16).padStart(2, '0')}`
    },
    achievementHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    },
    achievementIcon: {
      fontSize: 32
    },
    secretBadge: {
      fontSize: 14,
      fontWeight: '700'
    },
    achievementTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: lifeTheme.colors.text
    },
    achievementTitleLocked: {
      color: lifeTheme.colors.muted
    },
    rarityBadge: {
      fontSize: 10,
      fontWeight: '600',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      alignSelf: 'flex-start',
      textTransform: 'capitalize'
    },
    requirementText: {
      fontSize: 12,
      color: lifeTheme.colors.muted,
      fontStyle: 'italic'
    },
    progressRow: {
      marginTop: 4
    },
    progressText: {
      fontSize: 12,
      color: lifeTheme.colors.primary,
      fontWeight: '500'
    },
    rewardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: lifeTheme.colors.border
    },
    rewardText: {
      fontSize: 12,
      fontWeight: '600',
      color: lifeTheme.colors.primary
    },
    unlockedAt: {
      fontSize: 10,
      color: lifeTheme.colors.success,
      fontWeight: '500'
    },
    lockOverlay: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      width: 40,
      height: 40,
      backgroundColor: `${lifeTheme.colors.background}d0`,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center'
    },
    lockIcon: {
      fontSize: 24
    }
  });
}
