import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../src/store/useLifeStore';
import { useAppTheme } from '../src/theme';
import { ScreenHeader, SectionHeader } from '../src/components/ui';

export default function AnalyticsScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  
  const tasks = useLifeStore(s => s.tasks);
  const travel = useLifeStore(s => s.travelLogs);
  const stats = {
    totalTasks: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    pending: tasks.filter(t => t.status !== 'completed').length,
    focusZones: travel.filter(t => t.type === 'arrive_uni').length
  };

  const completionRate = stats.totalTasks === 0 ? 0 : Math.round((stats.completed / stats.totalTasks) * 100);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <ScreenHeader
          onBack={() => router.back()}
          eyebrow="Historial"
          title="Analítica"
          subtitle="Resumen acumulado de tu actividad."
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        
        <View style={styles.card}>
          <SectionHeader title="Finalización de tareas" />
          <View style={styles.barCont}>
            <View style={[styles.barFill, { width: `${completionRate}%` }]} />
          </View>
          <Text style={styles.statText}>{completionRate}% completadas</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricSquare}>
            <Text style={styles.metricVal}>{stats.completed}</Text>
            <Text style={styles.metricLabel}>Concluidas</Text>
          </View>
          <View style={styles.metricSquare}>
            <Text style={styles.metricVal}>{stats.pending}</Text>
            <Text style={styles.metricLabel}>Pendientes</Text>
          </View>
          <View style={styles.metricSquare}>
            <Text style={styles.metricVal}>{stats.focusZones}</Text>
            <Text style={styles.metricLabel}>Llegadas registradas</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  header: { paddingHorizontal: 16, marginBottom: 16 },
  scroll: { paddingHorizontal: 16, gap: 16 },
  card: { backgroundColor: lifeTheme.colors.surface, padding: 16, borderRadius: lifeTheme.radius.md, borderWidth: 1, borderColor: lifeTheme.colors.border, gap: 12 },
  barCont: { height: 12, backgroundColor: lifeTheme.colors.background, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: '100%', backgroundColor: lifeTheme.colors.primary, borderRadius: 6 },
  statText: { color: lifeTheme.colors.muted, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  metricsGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metricSquare: { flex: 1, minWidth: '30%', backgroundColor: lifeTheme.colors.surface, padding: 14, borderRadius: lifeTheme.radius.md, alignItems: 'center', borderColor: lifeTheme.colors.border, borderWidth: 1 },
  metricVal: { fontSize: 32, fontWeight: '900', color: lifeTheme.colors.primary, marginBottom: 4 },
  metricLabel: { fontSize: 13, color: lifeTheme.colors.text, fontWeight: '700' },
  });
}
