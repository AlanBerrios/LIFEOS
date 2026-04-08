import type { ReactElement } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../src/store/useLifeStore';
import { lifeTheme } from '../src/theme';

export default function AnalyticsScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const tasks = useLifeStore(s => s.tasks);
  const travel = useLifeStore(s => s.travelLogs);
  const stats = {
    totalTasks: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    pending: tasks.filter(t => t.status !== 'completed').length,
    focusZons: travel.filter(t => t.type === 'arrive_uni').length
  };

  const completionRate = stats.totalTasks === 0 ? 0 : Math.round((stats.completed / stats.totalTasks) * 100);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'} Volver</Text>
        </Pressable>
        <Text style={styles.title}>Maestría Personal 📈</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tasa de Finalización de Tareas</Text>
          <View style={styles.barCont}>
            <View style={[styles.barFill, { width: `${completionRate}%` }]} />
          </View>
          <Text style={styles.statText}>{completionRate}% Completadas hoy</Text>
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
            <Text style={styles.metricVal}>{stats.focusZons}</Text>
            <Text style={styles.metricLabel}>Zonas Focus</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 24 },
  backBtn: { marginRight: 16 },
  backBtnText: { color: lifeTheme.colors.primary, fontSize: 16, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '900', color: lifeTheme.colors.text },
  scroll: { paddingHorizontal: 16, gap: 16 },
  card: { backgroundColor: lifeTheme.colors.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: lifeTheme.colors.border },
  cardTitle: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  barCont: { height: 12, backgroundColor: lifeTheme.colors.background, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: '100%', backgroundColor: lifeTheme.colors.primary, borderRadius: 6 },
  statText: { color: lifeTheme.colors.muted, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  metricsGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metricSquare: { flex: 1, minWidth: '30%', backgroundColor: lifeTheme.colors.surface, padding: 16, borderRadius: 16, alignItems: 'center', borderColor: lifeTheme.colors.border, borderWidth: 1 },
  metricVal: { fontSize: 32, fontWeight: '900', color: lifeTheme.colors.primary, marginBottom: 4 },
  metricLabel: { fontSize: 13, color: lifeTheme.colors.muted, fontWeight: '700' }
});
