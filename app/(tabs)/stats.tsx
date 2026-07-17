import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLifeStore } from '../../src/store/useLifeStore';
import { useAppTheme } from '../../src/theme';
import { getSkillProgress, SKILL_LEVEL_BONUS_XP } from '../../src/store/domain/profileProgress';

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function getShortDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es', { weekday: 'short' }).slice(0, 3);
}

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  accent: string;
  delay?: number;
}

function StatCard({ label, value, icon, accent, delay = 0 }: StatCardProps): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(260)} style={styles.statCard}>
      <View style={styles.statCardHeader}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

type SkillKey = 'focus' | 'vitality' | 'discipline' | 'wisdom';

interface SkillDefinition {
  key: SkillKey;
  icon: string;
  label: string;
  source: string;
  meaning: string;
  nextAction: string;
  systemNote: string;
}

interface SkillCardProps {
  definition: SkillDefinition;
  points: number;
  color: string;
  delay?: number;
  onPress: (definition: SkillDefinition) => void;
}

const SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    key: 'focus',
    icon: '🧠',
    label: 'Enfoque',
    meaning: 'Mide tu capacidad acumulada para cerrar tareas exigentes.',
    source: 'Sube al completar tareas. La EXP depende de prioridad y carga cognitiva.',
    nextAction: 'Completa tareas importantes o de alta carga para subirlo mas rapido.',
    systemNote: 'Formula actual: prioridad x10 + carga cognitiva x2.'
  },
  {
    key: 'vitality',
    icon: '⚡',
    label: 'Vitalidad',
    meaning: 'Representa energia de rutina fisica y cuidado personal sostenido.',
    source: 'Sube al completar un habito del dia. Bajar el progreso del habito revierte esa EXP.',
    nextAction: 'Cierra habitos diarios, especialmente los de salud o energia.',
    systemNote: 'Regla actual: +15 al completar el habito diario.'
  },
  {
    key: 'discipline',
    icon: '🛡️',
    label: 'Disciplina',
    meaning: 'Mide consistencia: volver a la app y mantener actividad entre dias.',
    source: 'Sube cuando una accion cuenta como actividad diaria; las rachas tambien pueden dar badges y EXP.',
    nextAction: 'Completa tareas o habitos en dias consecutivos.',
    systemNote: 'Regla actual: +5 por dia activo nuevo; badges de racha dan EXP extra.'
  },
  {
    key: 'wisdom',
    icon: '📜',
    label: 'Sabiduria',
    meaning: 'Deberia representar reflexion, notas, revision y aprendizaje del sistema.',
    source: 'Sube al crear notas utiles o al ampliar una nota con contenido significativo.',
    nextAction: 'Usa notas para registrar decisiones, aprendizajes o reflexiones del dia.',
    systemNote: 'Regla actual: +4/+8/+12 al crear notas segun contenido; +4/+8 al ampliarlas de verdad.'
  }
];

function SkillCard({ definition, points, color, delay = 0, onPress }: SkillCardProps): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const progress = getSkillProgress(points);

  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(260)}>
      <Pressable
        style={styles.skillCard}
        onPress={() => onPress(definition)}
        accessibilityRole="button"
        accessibilityLabel={`Ver detalle de ${definition.label}`}
      >
        <View style={styles.skillTopRow}>
          <Text style={styles.skillIcon}>{definition.icon}</Text>
          <View style={styles.skillTitleWrap}>
            <Text style={styles.skillLabel}>{definition.label}</Text>
            <Text style={styles.skillMeta}>Nivel {progress.level} · {points} pts</Text>
          </View>
          <Text style={[styles.skillLevelBadge, { color, borderColor: `${color}66` }]}>N{progress.level}</Text>
        </View>

        <View style={styles.skillTrack}>
          <View style={[styles.skillFill, { width: `${Math.max(3, progress.progress * 100)}%`, backgroundColor: color }]} />
        </View>

        <Text style={styles.skillHint}>{progress.current}/{progress.required} para el siguiente nivel</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function StatsScreen(): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(null);

  const tasks = useLifeStore((s) => s.tasks);
  const timeline = useLifeStore((s) => s.timeline);
  const sessions = useLifeStore((s) => s.sessions);
  const userProfile = useLifeStore((s) => s.userProfile);

  const today = todayISO();
  const todaySession = sessions.find((s) => s.date === today);
  const last7 = getLast7Days();
  const sessionMap = Object.fromEntries(sessions.map((s) => [s.date, s]));
  const taskMap = Object.fromEntries(tasks.map((task) => [task.id, task]));

  const plannedTaskBlocks = timeline.filter((block) => block.type === 'task' && !!block.task_id);
  const effectiveTaskBlocks = plannedTaskBlocks.filter((block) => {
    const task = block.task_id ? taskMap[block.task_id] : undefined;
    return task?.status !== 'postponed';
  });

  const completedToday = todaySession?.tasksCompleted ?? tasks.filter((t) => t.status === 'completed').length;
  const skippedToday = todaySession?.tasksSkipped ?? tasks.filter((t) => t.status === 'skipped').length;
  const postponedToday = todaySession?.tasksPostponed ?? tasks.filter((t) => t.status === 'postponed').length;
  const scheduledToday = todaySession?.tasksScheduled ?? plannedTaskBlocks.length;
  const totalWork = effectiveTaskBlocks.reduce(
    (sum, block) => sum + (block.end_time.getTime() - block.start_time.getTime()) / 60_000,
    0
  );

  const maxCompleted = Math.max(1, ...last7.map((d) => sessionMap[d]?.tasksCompleted ?? 0));

  const completionRate = scheduledToday > 0 ? Math.round((completedToday / scheduledToday) * 100) : 0;
  const avgLast7 =
    Math.round(
      (last7.reduce((acc, day) => acc + (sessionMap[day]?.tasksCompleted ?? 0), 0) / last7.length) * 10
    ) / 10;

  const unlockedBadges = userProfile.badges.length;
  const knownAchievementsCount = 50;
  const knownSecretsCount = 15;
  const selectedSkillPoints = selectedSkill ? userProfile.skills[selectedSkill.key] : 0;
  const selectedSkillProgress = getSkillProgress(selectedSkillPoints);
  const skillAccentByKey: Record<SkillKey, string> = {
    focus: lifeTheme.colors.primary,
    vitality: lifeTheme.colors.success,
    discipline: '#fb923c',
    wisdom: '#818cf8'
  };

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)} style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroKicker}>Sistema Operativo Personal</Text>
          <Text style={styles.heroTitle}>Estadísticas</Text>
          <Text style={styles.heroSub}>Panel simplificado de hoy con acceso a detalle avanzado.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(260)} style={styles.section}>
          <Text style={styles.sectionTitle}>1. Resumen de Hoy</Text>
          <View style={styles.statGrid}>
            <StatCard label="Completadas" value={`${completedToday}`} icon="✅" accent={lifeTheme.colors.success} delay={80} />
            <StatCard label="Saltadas" value={`${skippedToday}`} icon="⏭️" accent={lifeTheme.colors.muted} delay={120} />
            <StatCard label="Pospuestas" value={`${postponedToday}`} icon="⏳" accent={'#f59e0b'} delay={160} />
            <StatCard label="Planificadas" value={`${scheduledToday}`} icon="⚡" accent={lifeTheme.colors.primary} delay={200} />
            <StatCard label="Trabajo total" value={formatMinutes(Math.round(totalWork))} icon="⏲️" accent={lifeTheme.colors.text} delay={240} />
          </View>

          {scheduledToday > 0 && (
            <View style={styles.progressWrap}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Progreso del día</Text>
                <Text style={styles.progressValue}>{completionRate}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${completionRate}%`, backgroundColor: lifeTheme.colors.success }]} />
              </View>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(260)} style={styles.section}>
          <Text style={styles.sectionTitle}>2. Últimos 7 Días</Text>
          <View style={styles.sparklineRow}>
            {last7.map((date, i) => {
              const completed = sessionMap[date]?.tasksCompleted ?? 0;
              const barHeight = completed === 0 ? 4 : Math.max(12, Math.round((completed / maxCompleted) * 80));
              const isToday = date === today;
              return (
                <Animated.View key={date} entering={FadeInDown.delay(i * 40).duration(220)} style={styles.sparkCol}>
                  <Text style={styles.sparkCount}>{completed > 0 ? completed : ''}</Text>
                  <View
                    style={[
                      styles.sparkBar,
                      {
                        height: barHeight,
                        backgroundColor: isToday
                          ? lifeTheme.colors.primary
                          : completed > 0
                          ? `${lifeTheme.colors.primary}66`
                          : lifeTheme.colors.border
                      }
                    ]}
                  />
                  <Text style={[styles.sparkDay, isToday && styles.sparkDayToday]}>{getShortDay(date)}</Text>
                </Animated.View>
              );
            })}
          </View>
          <Text style={styles.smallHint}>Promedio diario: {avgLast7} tareas completadas.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(190).duration(260)} style={styles.section}>
          <Text style={styles.sectionTitle}>3. Atributos y Habilidades</Text>
          <View style={styles.skillGrid}>
            {SKILL_DEFINITIONS.map((definition, index) => (
              <SkillCard
                key={definition.key}
                definition={definition}
                points={userProfile.skills[definition.key]}
                color={skillAccentByKey[definition.key]}
                delay={200 + index * 40}
                onPress={setSelectedSkill}
              />
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(270).duration(260)} style={styles.section}>
          <Text style={styles.sectionTitle}>4. Logros RPG</Text>
          <View style={styles.achievementsSummaryRow}>
            <View style={styles.achievementMiniCard}>
              <Text style={styles.achievementMiniValue}>{unlockedBadges}</Text>
              <Text style={styles.achievementMiniLabel}>Desbloqueados</Text>
            </View>
            <View style={styles.achievementMiniCard}>
              <Text style={styles.achievementMiniValue}>{knownAchievementsCount}</Text>
              <Text style={styles.achievementMiniLabel}>Catálogo total</Text>
            </View>
            <View style={styles.achievementMiniCard}>
              <Text style={styles.achievementMiniValue}>{knownSecretsCount}</Text>
              <Text style={styles.achievementMiniLabel}>Secretos</Text>
            </View>
          </View>
          <Text style={styles.smallHint}>Catálogo ampliado con logros comunes, épicos, legendarios y secretos.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/achievements' as any)}>
            <Text style={styles.primaryBtnText}>Abrir página de Logros RPG</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(310).duration(260)} style={styles.section}>
          <Text style={styles.sectionTitle}>5. Métricas</Text>
          <View style={styles.simpleMetricsRow}>
            <View style={styles.simpleMetricCard}>
              <Text style={styles.simpleMetricValue}>{completionRate}%</Text>
              <Text style={styles.simpleMetricLabel}>Cumplimiento hoy</Text>
            </View>
            <View style={styles.simpleMetricCard}>
              <Text style={styles.simpleMetricValue}>{avgLast7}</Text>
              <Text style={styles.simpleMetricLabel}>Promedio 7 días</Text>
            </View>
            <View style={styles.simpleMetricCard}>
              <Text style={styles.simpleMetricValue}>{userProfile.consistency.currentStreak}</Text>
              <Text style={styles.simpleMetricLabel}>Racha actual</Text>
            </View>
          </View>
          <Text style={styles.smallHint}>Vista rápida para decisiones del día. El análisis completo vive en la pantalla avanzada.</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.push('/advanced-metrics' as any)}>
            <Text style={styles.secondaryBtnText}>Ver Métricas Avanzadas</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <Modal visible={selectedSkill != null} transparent animationType="fade" onRequestClose={() => setSelectedSkill(null)}>
        <Pressable style={styles.skillModalOverlay} onPress={() => setSelectedSkill(null)}>
          <Pressable style={styles.skillModalCard} onPress={(event) => event.stopPropagation()}>
            {selectedSkill && (
              <>
                <View style={styles.skillModalHeader}>
                  <Text style={styles.skillModalIcon}>{selectedSkill.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.skillModalTitle}>{selectedSkill.label}</Text>
                    <Text style={styles.skillModalSubtitle}>
                      Nivel {selectedSkillProgress.level} · {selectedSkillPoints} puntos
                    </Text>
                  </View>
                </View>

                <View style={styles.skillModalTrack}>
                  <View
                    style={[
                      styles.skillModalFill,
                      {
                        width: `${Math.max(3, selectedSkillProgress.progress * 100)}%`,
                        backgroundColor: skillAccentByKey[selectedSkill.key]
                      }
                    ]}
                  />
                </View>

                <Text style={styles.skillModalBody}>{selectedSkill.meaning}</Text>
                <Text style={styles.skillModalBody}>{selectedSkill.source}</Text>
                <Text style={styles.skillModalBody}>{selectedSkill.nextAction}</Text>
                <Text style={styles.skillModalMeta}>
                  Faltan {selectedSkillProgress.pointsToNext} pts para nivel {selectedSkillProgress.level + 1}.
                  Cada nivel de atributo entrega +{SKILL_LEVEL_BONUS_XP} EXP de perfil.
                </Text>
                <Text style={styles.skillModalMeta}>{selectedSkill.systemNote}</Text>

                <Pressable style={styles.skillModalCloseBtn} onPress={() => setSelectedSkill(null)}>
                  <Text style={styles.skillModalCloseText}>Cerrar</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
    hero: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: lifeTheme.radius.lg,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: lifeTheme.spacing.lg,
      gap: 8,
      overflow: 'hidden'
    },
    heroGlow: {
      position: 'absolute',
      right: -24,
      top: -24,
      width: 120,
      height: 120,
      borderRadius: 999,
      backgroundColor: `${lifeTheme.colors.primary}22`
    },
    heroKicker: {
      color: lifeTheme.colors.success,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase'
    },
    heroTitle: {
      color: lifeTheme.colors.text,
      fontSize: 24,
      fontWeight: '900'
    },
    heroSub: {
      color: lifeTheme.colors.muted,
      fontSize: 12,
      lineHeight: 18
    },
    section: {
      backgroundColor: lifeTheme.colors.surface,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: lifeTheme.radius.lg,
      padding: lifeTheme.spacing.lg,
      gap: 12
    },
    sectionTitle: {
      color: lifeTheme.colors.text,
      fontSize: 14,
      fontWeight: '800',
      textTransform: 'uppercase'
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10
    },
    statCard: {
      flexBasis: '48%',
      flexGrow: 1,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 8
    },
    statCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    statIcon: {
      fontSize: 18
    },
    statValue: {
      fontSize: 22,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    statLabel: {
      color: lifeTheme.colors.muted,
      fontSize: 12,
      fontWeight: '700'
    },
    progressWrap: {
      marginTop: 4,
      gap: 8
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    progressLabel: {
      color: lifeTheme.colors.text,
      fontSize: 12,
      fontWeight: '700'
    },
    progressValue: {
      color: lifeTheme.colors.success,
      fontSize: 12,
      fontWeight: '800',
      fontFamily: 'monospace'
    },
    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: lifeTheme.colors.border,
      overflow: 'hidden'
    },
    progressFill: {
      height: '100%',
      borderRadius: 999
    },
    sparklineRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 6,
      minHeight: 106
    },
    sparkCol: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6
    },
    sparkCount: {
      color: lifeTheme.colors.text,
      fontSize: 10,
      fontWeight: '700',
      minHeight: 12,
      fontFamily: 'monospace'
    },
    sparkBar: {
      width: 18,
      borderRadius: 8,
      minHeight: 4
    },
    sparkDay: {
      color: lifeTheme.colors.muted,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase'
    },
    sparkDayToday: {
      color: lifeTheme.colors.primary
    },
    skillGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10
    },
    skillCard: {
      width: '48%',
      minHeight: 118,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 10
    },
    skillTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    skillIcon: {
      fontSize: 20
    },
    skillTitleWrap: {
      flex: 1,
      minWidth: 0
    },
    skillLabel: {
      color: lifeTheme.colors.text,
      fontSize: 13,
      fontWeight: '800'
    },
    skillMeta: {
      color: lifeTheme.colors.muted,
      fontSize: 10,
      marginTop: 2
    },
    skillLevelBadge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 3,
      fontSize: 10,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    skillTrack: {
      height: 7,
      borderRadius: 999,
      backgroundColor: lifeTheme.colors.border,
      overflow: 'hidden'
    },
    skillFill: {
      height: '100%',
      borderRadius: 999
    },
    skillHint: {
      color: lifeTheme.colors.muted,
      fontSize: 10,
      lineHeight: 14
    },
    achievementsSummaryRow: {
      flexDirection: 'row',
      gap: 10
    },
    achievementMiniCard: {
      flex: 1,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 4
    },
    achievementMiniValue: {
      color: lifeTheme.colors.primary,
      fontSize: 24,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    achievementMiniLabel: {
      color: lifeTheme.colors.muted,
      fontSize: 11,
      fontWeight: '700'
    },
    primaryBtn: {
      marginTop: 2,
      backgroundColor: lifeTheme.colors.primary,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12
    },
    primaryBtnText: {
      color: lifeTheme.colors.onPrimary,
      fontSize: 13,
      fontWeight: '800'
    },
    simpleMetricsRow: {
      flexDirection: 'row',
      gap: 10
    },
    simpleMetricCard: {
      flex: 1,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 4
    },
    simpleMetricValue: {
      color: lifeTheme.colors.text,
      fontSize: 22,
      fontWeight: '900',
      fontFamily: 'monospace'
    },
    simpleMetricLabel: {
      color: lifeTheme.colors.muted,
      fontSize: 11,
      fontWeight: '700'
    },
    secondaryBtn: {
      marginTop: 2,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: lifeTheme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      backgroundColor: `${lifeTheme.colors.primary}12`
    },
    secondaryBtnText: {
      color: lifeTheme.colors.primary,
      fontSize: 13,
      fontWeight: '800'
    },
    smallHint: {
      color: lifeTheme.colors.muted,
      fontSize: 11,
      lineHeight: 17
    },
    skillModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.68)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 22
    },
    skillModalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: lifeTheme.colors.surface,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      borderRadius: 16,
      padding: 16,
      gap: 12
    },
    skillModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10
    },
    skillModalIcon: {
      fontSize: 26
    },
    skillModalTitle: {
      color: lifeTheme.colors.text,
      fontSize: 17,
      fontWeight: '900'
    },
    skillModalSubtitle: {
      color: lifeTheme.colors.muted,
      fontSize: 12,
      marginTop: 2
    },
    skillModalTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: lifeTheme.colors.border,
      overflow: 'hidden'
    },
    skillModalFill: {
      height: '100%',
      borderRadius: 999
    },
    skillModalBody: {
      color: lifeTheme.colors.text,
      fontSize: 13,
      lineHeight: 19
    },
    skillModalMeta: {
      color: lifeTheme.colors.muted,
      fontSize: 12,
      lineHeight: 18
    },
    skillModalCloseBtn: {
      alignSelf: 'flex-end',
      backgroundColor: lifeTheme.colors.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 9
    },
    skillModalCloseText: {
      color: lifeTheme.colors.onPrimary,
      fontSize: 12,
      fontWeight: '900'
    },
  });
}
