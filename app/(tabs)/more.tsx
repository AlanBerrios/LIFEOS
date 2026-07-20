import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { router } from 'expo-router';
import {
  Activity,
  AlarmClock,
  BarChart3,
  ChevronRight,
  Clock3,
  NotebookPen,
  Settings2,
  SlidersHorizontal,
  Trophy
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable, ScreenHeader, SectionHeader } from '../../src/components/ui';
import { useAppTheme } from '../../src/theme';

type Destination = {
  title: string;
  description: string;
  route: string;
  Icon: LucideIcon;
};

const GROUPS: Array<{ title: string; description: string; items: Destination[] }> = [
  {
    title: 'Organización',
    description: 'Define la estructura que alimenta tu día.',
    items: [
      { title: 'Rutinas', description: 'Sueño, comidas y traslados', route: '/(tabs)/routines', Icon: Clock3 },
      { title: 'Notas', description: 'Captura ideas y recordatorios', route: '/(tabs)/notes', Icon: NotebookPen }
    ]
  },
  {
    title: 'Progreso',
    description: 'Revisa patrones, niveles y resultados.',
    items: [
      { title: 'Métricas', description: 'Resumen y atributos personales', route: '/(tabs)/stats', Icon: BarChart3 },
      { title: 'Logros', description: 'Catálogo, pistas y progreso', route: '/achievements', Icon: Trophy },
      { title: 'Métricas avanzadas', description: 'Uso, ejecución y replans', route: '/advanced-metrics', Icon: Activity },
      { title: 'Analítica', description: 'Lectura rápida de productividad', route: '/analytics', Icon: SlidersHorizontal }
    ]
  },
  {
    title: 'Sistema',
    description: 'Configura avisos, apariencia y datos.',
    items: [
      { title: 'Recordatorios', description: 'Horarios y avisos programados', route: '/alarms', Icon: AlarmClock },
      { title: 'Ajustes', description: 'Preferencias, permisos y respaldo', route: '/(tabs)/settings', Icon: Settings2 }
    ]
  }
];

export default function MoreScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom, 12) + 92 }
      ]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        eyebrow="LIFEOS"
        title="Más"
        subtitle="Herramientas para organizar, revisar y ajustar tu sistema."
      />

      {GROUPS.map((group) => (
        <View key={group.title} style={styles.group}>
          <SectionHeader title={group.title} subtitle={group.description} />
          <View style={styles.list}>
            {group.items.map(({ title, description, route, Icon }, index) => (
              <AnimatedPressable
                key={title}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityHint={description}
                onPress={() => router.push(route as never)}
                style={[styles.row, index < group.items.length - 1 && styles.rowDivider]}
              >
                <View style={styles.iconWrap}>
                  <Icon size={21} color={theme.colors.primary} strokeWidth={2.1} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{title}</Text>
                  <Text style={styles.rowDescription}>{description}</Text>
                </View>
                <ChevronRight size={20} color={theme.colors.subtle} strokeWidth={2.2} />
              </AnimatedPressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { paddingHorizontal: 16, gap: 26 },
    group: { gap: 10 },
    list: {
      overflow: 'hidden',
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface
    },
    row: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10
    },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softPrimary
    },
    rowCopy: { flex: 1, gap: 2 },
    rowTitle: { color: theme.colors.text, fontSize: theme.typography.body, fontWeight: '800' },
    rowDescription: {
      color: theme.colors.muted,
      fontSize: theme.typography.bodySm,
      lineHeight: theme.typography.lineHeight.bodySm
    }
  });
}
