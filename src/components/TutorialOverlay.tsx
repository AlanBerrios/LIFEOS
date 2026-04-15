import { useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown
} from 'react-native-reanimated';
import { useRouter, useSegments } from 'expo-router';
import { useLifeStore } from '../store/useLifeStore';
import { useAppTheme } from '../theme';

const { width } = Dimensions.get('window');

type TabKey = 'index' | 'calendar' | 'pool' | 'habits' | 'routines' | 'notes' | 'stats' | 'settings';

const TAB_LABELS: Record<TabKey, string> = {
  index: 'Hoy',
  calendar: 'Calendario',
  pool: 'Task Pool',
  habits: 'Hábitos',
  routines: 'Rutinas',
  notes: 'Notas',
  stats: 'Métricas',
  settings: 'Ajustes'
};

interface TutorialStep {
  id: string;
  tab: TabKey;
  title: string;
  description: string;
  anchor: string;
  anchorHint: string;
  bullets?: string[];
}

const STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    tab: 'index',
    title: 'Bienvenido a LifeOS',
    description: 'Esta guía te acompaña por cada área para que sepas qué hace cada pantalla.',
    anchor: 'Visión general',
    anchorHint: 'Primero entiende el flujo general y luego profundiza en cada módulo.',
    bullets: ['Planifica tu día', 'Ejecuta con foco', 'Mide tu progreso']
  },
  {
    id: 'dashboard',
    tab: 'index',
    title: 'Panel de Hoy',
    description: 'Arriba tienes tu resumen diario: XP, tareas y rachas. Desde aquí defines el ritmo.',
    anchor: 'Header de estado',
    anchorHint: 'Este bloque concentra el estado de tu día y accesos de seguimiento.',
    bullets: ['Conteos rápidos de tareas', 'Acceso a métricas desde las tarjetas']
  },
  {
    id: 'quick-actions',
    tab: 'index',
    title: 'Acciones rápidas',
    description: 'Captura en segundos lo que se te ocurre sin salir del flujo.',
    anchor: 'Acciones centrales',
    anchorHint: 'Desde aquí agregas entradas sin cambiar de contexto.',
    bullets: ['Comida inicia temporizador', 'Tarea, Evento y Nota se crean al instante']
  },
  {
    id: 'timeline',
    tab: 'index',
    title: 'Timeline inteligente',
    description: 'Tu día se organiza en bloques y se rellena en tiempo real.',
    anchor: 'Bloques del día',
    anchorHint: 'Interpreta, mueve y completa bloques desde este foco operativo.',
    bullets: ['Toca [i] para ver detalles', 'Arrastra para mover tareas', 'Completados se preservan como fantasma']
  },
  {
    id: 'calendar',
    tab: 'calendar',
    title: 'Calendario',
    description: 'Visualiza tu agenda por mes, semana o día con toda la información.',
    anchor: 'Vista temporal',
    anchorHint: 'Elige mes/semana/día según el nivel de detalle que necesites.',
    bullets: ['Cambia vista arriba', 'Toca un bloque para info, editar o eliminar', 'Colores y emojis dan contexto rápido']
  },
  {
    id: 'pool',
    tab: 'pool',
    title: 'Task Pool',
    description: 'Aquí capturas y priorizas todo lo pendiente antes de programarlo.',
    anchor: 'Backlog personal',
    anchorHint: 'Refina urgencia, prioridad y carga para ayudar al scheduler.',
    bullets: ['Define urgencia, prioridad y carga cognitiva', 'Usa filtros para ordenar', 'Completa para registrar tu avance']
  },
  {
    id: 'habits',
    tab: 'habits',
    title: 'Mis Hábitos',
    description: 'Tus hábitos diarios viven aquí. Mantener la racha es clave.',
    anchor: 'Seguimiento de constancia',
    anchorHint: 'Monitorea progreso diario y sostenibilidad de tus rutinas personales.',
    bullets: ['Marca progreso diario', 'Revisa rachas y metas', 'Edita cuando cambie tu rutina']
  },
  {
    id: 'routines',
    tab: 'routines',
    title: 'Gestor de Rutinas',
    description: 'Configura tu base diaria: sueño, comidas, traslados y alarmas.',
    anchor: 'Base estructural',
    anchorHint: 'Estas reglas moldean el día automáticamente en el timeline.',
    bullets: ['Sincroniza alarmas y notificaciones', 'Estas rutinas crean bloques automáticos']
  },
  {
    id: 'notes',
    tab: 'notes',
    title: 'Notas',
    description: 'Guarda ideas, recordatorios y reflexiones sin perder el hilo.',
    anchor: 'Captura rápida',
    anchorHint: 'Registra información en segundos y añade recordatorio si hace falta.',
    bullets: ['Crea notas rápidas', 'Agrega recordatorios cuando lo necesites']
  },
  {
    id: 'stats',
    tab: 'stats',
    title: 'Métricas',
    description: 'Analiza tu progreso para mejorar decisiones y ritmo.',
    anchor: 'Panel analítico',
    anchorHint: 'Convierte datos de ejecución en decisiones para el siguiente día.',
    bullets: ['Foco, vitalidad y disciplina', 'Tendencias por semana y mes']
  },
  {
    id: 'settings',
    tab: 'settings',
    title: 'Ajustes',
    description: 'Personaliza LifeOS y controla permisos importantes.',
    anchor: 'Control del sistema',
    anchorHint: 'Aquí defines comportamiento global y reinicias la guía cuando quieras.',
    bullets: ['Tema, notificaciones y privacidad', 'Puedes reiniciar la guía aquí']
  }
];

function getSafeTab(value: string | undefined): TabKey {
  const key = value as TabKey | undefined;
  if (!key) return 'index';
  return TAB_LABELS[key] ? key : 'index';
}

export function TutorialOverlay(): ReactElement | null {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const router = useRouter();
  const segments = useSegments();
  const { settings, updateSettings } = useLifeStore((s) => ({
    settings: s.settings,
    updateSettings: s.updateSettings
  }));

  if (!settings.showTutorial) return null;

  const stepIndex = Math.min(Math.max(settings.tutorialStep ?? 0, 0), STEPS.length - 1);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const currentTab = getSafeTab(segments?.[1]);
  const isOnTarget = currentTab === step.tab;
  const progressPct = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  function goTo(tab: TabKey) {
    router.push(`/(tabs)/${tab}` as any);
  }

  function finish() {
    updateSettings({ showTutorial: false, tutorialStep: 0 });
  }

  function handleNext() {
    if (isLast) {
      finish();
      return;
    }
    const nextIndex = stepIndex + 1;
    const nextTab = STEPS[nextIndex].tab;
    updateSettings({ tutorialStep: nextIndex });
    if (nextTab !== currentTab) {
      goTo(nextTab);
    }
  }

  function handlePrev() {
    if (stepIndex === 0) return;
    const prevIndex = stepIndex - 1;
    const prevTab = STEPS[prevIndex].tab;
    updateSettings({ tutorialStep: prevIndex });
    if (prevTab !== currentTab) {
      goTo(prevTab);
    }
  }

  function handlePrimary() {
    if (!isOnTarget) {
      goTo(step.tab);
      return;
    }
    handleNext();
  }

  function jumpToStep(index: number) {
    const clamped = Math.min(Math.max(index, 0), STEPS.length - 1);
    const targetStep = STEPS[clamped];
    updateSettings({ tutorialStep: clamped });
    if (targetStep.tab !== currentTab) {
      goTo(targetStep.tab);
    }
  }

  const primaryLabel = !isOnTarget
    ? `Ir a ${TAB_LABELS[step.tab]}`
    : isLast
      ? 'Finalizar'
      : 'Siguiente';

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.container}>
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdrop} />

        <Animated.View entering={SlideInUp.springify()} exiting={SlideOutDown} style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.stepIndicator}>Paso {stepIndex + 1} de {STEPS.length}</Text>
            <View style={styles.sectionPill}>
              <Text style={styles.sectionPillText}>{TAB_LABELS[step.tab]}</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>

          <View style={styles.content}>
            <View style={styles.anchorCard}>
              <Text style={styles.anchorLabel}>ANCLA</Text>
              <Text style={styles.anchorTitle}>{step.anchor}</Text>
              <Text style={styles.anchorHint}>{step.anchorHint}</Text>
            </View>

            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.description}>{step.description}</Text>
            {step.bullets && step.bullets.length > 0 && (
              <View style={styles.bulletList}>
                {step.bullets.map((item) => (
                  <View key={item} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
            {!isOnTarget && (
              <Text style={styles.navHint}>
                Estás en {TAB_LABELS[currentTab]}. Ve a {TAB_LABELS[step.tab]} para continuar.
              </Text>
            )}

            <View style={styles.jumpWrap}>
              <Text style={styles.jumpTitle}>Saltar a paso</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jumpRow}>
                {STEPS.map((item, index) => {
                  const active = index === stepIndex;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.jumpChip, active && styles.jumpChipActive]}
                      onPress={() => jumpToStep(index)}
                    >
                      <Text style={[styles.jumpChipText, active && styles.jumpChipTextActive]}>{index + 1}. {TAB_LABELS[item.tab]}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.skipBtn} onPress={finish}>
              <Text style={styles.skipText}>Saltar</Text>
            </Pressable>

            <View style={styles.footerActions}>
              {stepIndex > 0 && (
                <Pressable style={styles.backBtn} onPress={handlePrev}>
                  <Text style={styles.backText}>Atrás</Text>
                </Pressable>
              )}
              <Pressable style={styles.nextBtn} onPress={handlePrimary}>
                <Text style={styles.nextText}>{primaryLabel}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.85)'
    },
    card: {
      backgroundColor: lifeTheme.colors.surface,
      borderRadius: 28,
      width: Math.min(520, width - 32),
      padding: 24,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      shadowColor: lifeTheme.colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 8,
      gap: 16
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    stepIndicator: {
      color: lifeTheme.colors.primary,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1
    },
    sectionPill: {
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999
    },
    sectionPillText: { color: lifeTheme.colors.text, fontSize: 11, fontWeight: '700' },
    progressTrack: {
      width: '100%',
      height: 6,
      borderRadius: 999,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      overflow: 'hidden'
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: lifeTheme.colors.primary
    },
    content: {
      gap: 10
    },
    anchorCard: {
      backgroundColor: lifeTheme.colors.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      padding: 12,
      gap: 4
    },
    anchorLabel: {
      color: lifeTheme.colors.primary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8
    },
    anchorTitle: {
      color: lifeTheme.colors.text,
      fontSize: 13,
      fontWeight: '800'
    },
    anchorHint: {
      color: lifeTheme.colors.muted,
      fontSize: 12,
      lineHeight: 17
    },
    title: {
      color: lifeTheme.colors.text,
      fontSize: 22,
      fontWeight: '900'
    },
    description: {
      color: lifeTheme.colors.muted,
      fontSize: 15,
      lineHeight: 22
    },
    bulletList: { gap: 6, marginTop: 4 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    bulletDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: lifeTheme.colors.primary,
      marginTop: 7
    },
    bulletText: { color: lifeTheme.colors.text, fontSize: 14, lineHeight: 20, flex: 1 },
    navHint: {
      color: lifeTheme.colors.muted,
      fontSize: 12,
      lineHeight: 18
    },
    jumpWrap: { gap: 6, marginTop: 6 },
    jumpTitle: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '700' },
    jumpRow: { gap: 8, paddingRight: 8 },
    jumpChip: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      backgroundColor: lifeTheme.colors.surfaceAlt
    },
    jumpChipActive: {
      borderColor: lifeTheme.colors.primary,
      backgroundColor: lifeTheme.colors.softPrimary
    },
    jumpChipText: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '700' },
    jumpChipTextActive: { color: lifeTheme.colors.primary },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    footerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    skipBtn: { padding: 10 },
    skipText: { color: lifeTheme.colors.muted, fontWeight: '700' },
    backBtn: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      backgroundColor: lifeTheme.colors.surfaceAlt
    },
    backText: { color: lifeTheme.colors.text, fontWeight: '800', fontSize: 13 },
    nextBtn: {
      backgroundColor: lifeTheme.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14
    },
    nextText: {
      color: lifeTheme.colors.onPrimary,
      fontWeight: '800',
      fontSize: 14
    }
  });
}
