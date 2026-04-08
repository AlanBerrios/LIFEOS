import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../../src/store/useLifeStore';
import { lifeTheme } from '../../src/theme';
import { createId } from '../../src/utils/ids';
import { syncRoutineAlarms } from '../../src/services/notifications';
import type { MealRoutine } from '../../src/types';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function RoutinesScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const routines = useLifeStore((s) => s.routines);
  const updateRoutine = useLifeStore((s) => s.updateRoutineDay);
  
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

  const currentRoutine = routines.find(r => r.dayOfWeek === selectedDay);

  if (!currentRoutine) return <View style={styles.screen} />;

  function handleSaveSleep(field: 'sleepStart' | 'sleepEnd', value: string) {
    // Basic regex HH:mm
    if (!/^\d{2}:\d{2}$/.test(value)) return;
    updateRoutine(selectedDay, { [field]: value });
  }

  function handleAddMeal() {
    const newMeal: MealRoutine = {
      id: createId('meal'),
      type: 'almuerzo',
      time: '14:00',
      durationMinutes: 45
    };
    updateRoutine(selectedDay, { meals: [...(currentRoutine?.meals || []), newMeal] });
  }

  function handleDeleteMeal(mealId: string) {
    updateRoutine(selectedDay, {
      meals: currentRoutine!.meals.filter(m => m.id !== mealId)
    });
  }

  function handleUpdateMeal(mealId: string, field: keyof MealRoutine, value: any) {
    updateRoutine(selectedDay, {
      meals: currentRoutine!.meals.map(m => m.id === mealId ? { ...m, [field]: value } : m)
    });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Gestor de Rutinas</Text>
        <Pressable style={styles.syncBtn} onPress={() => { syncRoutineAlarms(routines); Alert.alert('Listo', 'Alarmas sincronizadas'); }}>
          <Text style={styles.syncBtnText}>🔔 Activar Alarmas</Text>
        </Pressable>
      </View>
      
      {/* Selector de Días */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daySelector} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {DAYS.map((dayName, idx) => (
          <Pressable
            key={idx}
            style={[styles.dayChip, selectedDay === idx && styles.dayChipActive]}
            onPress={() => setSelectedDay(idx)}
          >
            <Text style={[styles.dayChipText, selectedDay === idx && styles.dayChipTextActive]}>{dayName}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 24 }}>
        
        {/* Horas de Sueño */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛌 Horas de Sueño</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Hora de Dormir</Text>
              <TextInput
                style={styles.timeInput}
                value={currentRoutine.sleepStart}
                onChangeText={(t) => handleSaveSleep('sleepStart', t)}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Hora de Despertar</Text>
              <TextInput
                style={styles.timeInput}
                value={currentRoutine.sleepEnd}
                onChangeText={(t) => handleSaveSleep('sleepEnd', t)}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>
        </View>

        {/* Comidas */}
        <View style={styles.section}>
          <View style={[styles.row, { marginBottom: 12 }]}>
            <Text style={styles.sectionTitle}>🍽️ Comidas del Día</Text>
            <Pressable onPress={handleAddMeal} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Añadir</Text>
            </Pressable>
          </View>

          {currentRoutine.meals.map((meal) => (
            <View key={meal.id} style={styles.mealCard}>
               <View style={styles.row}>
                 <TextInput
                   style={styles.mealTypeInput}
                   value={meal.type}
                   onChangeText={(t) => handleUpdateMeal(meal.id, 'type', t)}
                 />
                 <Pressable onPress={() => handleDeleteMeal(meal.id)}>
                   <Text style={{ color: lifeTheme.colors.alert, fontWeight: 'bold' }}>X</Text>
                 </Pressable>
               </View>

               <View style={styles.row}>
                 <Text style={styles.label}>Hora</Text>
                 <TextInput
                    style={styles.timeInput}
                    value={meal.time}
                    onChangeText={(t) => handleUpdateMeal(meal.id, 'time', t)}
                    maxLength={5}
                 />
               </View>
               <View style={styles.row}>
                 <Text style={styles.label}>Duración (min)</Text>
                 <TextInput
                    style={styles.timeInput}
                    value={meal.durationMinutes.toString()}
                    onChangeText={(t) => handleUpdateMeal(meal.id, 'durationMinutes', parseInt(t) || 15)}
                    keyboardType="numeric"
                 />
               </View>
            </View>
          ))}
          
          {currentRoutine.meals.length === 0 && (
            <Text style={styles.emptyText}>No hay comidas configuradas para hoy.</Text>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  headerTitle: { color: lifeTheme.colors.text, fontSize: 24, fontWeight: '900' },
  syncBtn: { backgroundColor: lifeTheme.colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  syncBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  daySelector: { maxHeight: 40, flexGrow: 0, marginBottom: 16 },
  dayChip: {
    backgroundColor: lifeTheme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border
  },
  dayChipActive: { backgroundColor: lifeTheme.colors.primary, borderColor: lifeTheme.colors.primary },
  dayChipText: { color: lifeTheme.colors.muted, fontWeight: '700', fontSize: 14 },
  dayChipTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  section: { gap: 8 },
  sectionTitle: { color: lifeTheme.colors.text, fontSize: 18, fontWeight: '800' },
  card: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    gap: 12
  },
  mealCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: lifeTheme.colors.primary,
    marginBottom: 8,
    gap: 8
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: lifeTheme.colors.text, fontSize: 15, fontWeight: '600' },
  timeInput: {
    backgroundColor: lifeTheme.colors.background,
    color: lifeTheme.colors.primary,
    fontWeight: '800',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    textAlign: 'center',
    minWidth: 70
  },
  mealTypeInput: {
    color: lifeTheme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    textTransform: 'capitalize'
  },
  divider: { height: 1, backgroundColor: lifeTheme.colors.border },
  addBtn: { backgroundColor: `${lifeTheme.colors.primary}20`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  addBtnText: { color: lifeTheme.colors.primary, fontWeight: '800', fontSize: 13 },
  emptyText: { color: lifeTheme.colors.muted, textAlign: 'center', fontStyle: 'italic', marginTop: 10 }
});
