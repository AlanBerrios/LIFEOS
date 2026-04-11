import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../../src/store/useLifeStore';
import { lifeTheme } from '../../src/theme';
import { createId } from '../../src/utils/ids';
import { rescheduleAll } from '../../src/services/notifications';
import type { MealRoutine } from '../../src/types';

const DAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

// ─── Safe Time Picker ─────────────────────────────────────────────────────────

function SafeTimePicker({
  label,
  value, // "HH:mm"
  onConfirm
}: {
  label: string;
  value: string;
  onConfirm: (t: string) => void;
}): ReactElement {
  const [show, setShow] = useState(false);

  // Convert "HH:mm" to Date object for the picker
  const [h, m] = value.split(':').map(Number);
  const dateValue = new Date();
  dateValue.setHours(h, m, 0, 0);

  function onChange(_evt: any, selected?: Date) {
    if (Platform.OS === 'android') setShow(false);
    if (selected) {
      const hh = String(selected.getHours()).padStart(2, '0');
      const mm = String(selected.getMinutes()).padStart(2, '0');
      onConfirm(`${hh}:${mm}`);
    }
  }

  return (
    <View style={styles.timePickerContainer}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.timeValueBtn} onPress={() => setShow(true)}>
        <Text style={styles.timeValueText}>{value}</Text>
      </Pressable>

      {show && (
        <DateTimePicker
          value={dateValue}
          mode="time"
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChange}
          themeVariant="dark"
        />
      )}
    </View>
  );
}

export default function RoutinesScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const tasks = useLifeStore((s) => s.tasks);
  const timeline = useLifeStore((s) => s.timeline);
  const settings = useLifeStore((s) => s.settings);
  const events = useLifeStore((s) => s.events);
  const notes = useLifeStore((s) => s.notes);
  const routines = useLifeStore((s) => s.routines);
  const updateRoutine = useLifeStore((s) => s.updateRoutineDay);
  
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

  const currentRoutine = routines.find(r => r.dayOfWeek === selectedDay);

  if (!currentRoutine) return <View style={styles.screen} />;

  function handleSaveSleep(field: 'sleepStart' | 'sleepEnd', value: string) {
    updateRoutine(selectedDay, { [field]: value });
  }

  function handleAddMeal() {
    const newMeal: MealRoutine = {
      id: createId('meal'),
      type: 'Nueva Comida',
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

  async function handleSyncNotifications(): Promise<void> {
    try {
      await rescheduleAll(timeline, tasks, settings, routines, events, notes);
      Alert.alert('Listo', 'Notificaciones sincronizadas correctamente.');
    } catch {
      Alert.alert('Error', 'No se pudieron sincronizar las notificaciones.');
    }
  }


  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Gestor de Rutinas</Text>
      </View>
      
      {/* Selector de Días Optimizado */}
      <View style={styles.daySelectorStatic}>
        {DAYS_SHORT.map((dayName, idx) => (
          <Pressable
            key={idx}
            style={[styles.dayCircle, selectedDay === idx && styles.dayCircleActive]}
            onPress={() => setSelectedDay(idx)}
          >
            <Text style={[styles.dayCircleText, selectedDay === idx && styles.dayCircleTextActive]}>{dayName}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <Pressable 
          style={styles.syncBtnFull} 
          onPress={() => void handleSyncNotifications()}
        >
          <Text style={styles.syncBtnText}>🔔 Activar y Sincronizar Alarmas</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 20 }}>
        
        {/* Horas de Sueño */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛌 Horas de Sueño</Text>
          <View style={styles.card}>
            <SafeTimePicker
              label="Hora de Dormir"
              value={currentRoutine.sleepStart}
              onConfirm={(t) => handleSaveSleep('sleepStart', t)}
            />
            <View style={styles.divider} />
            <SafeTimePicker
              label="Hora de Despertar"
              value={currentRoutine.sleepEnd}
              onConfirm={(t) => handleSaveSleep('sleepEnd', t)}
            />
          </View>
        </View>

        {/* Comidas */}
        <View style={styles.section}>
          <View style={[styles.row, { marginBottom: 8 }]}>
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
                   placeholder="Nombre comida"
                   placeholderTextColor={lifeTheme.colors.muted}
                 />
                 <Pressable onPress={() => handleDeleteMeal(meal.id)} style={styles.deleteBtn}>
                   <Text style={{ color: lifeTheme.colors.alert, fontWeight: 'bold' }}>✕</Text>
                 </Pressable>
               </View>

               <View style={styles.mealDetails}>
                 <SafeTimePicker
                   label="Hora"
                   value={meal.time}
                   onConfirm={(t) => handleUpdateMeal(meal.id, 'time', t)}
                 />
                 <View style={styles.divider} />
                 <View style={styles.row}>
                    <Text style={styles.label}>Duración</Text>
                    <View style={styles.durationInputGroup}>
                      <TextInput
                          style={styles.durationInput}
                          value={meal.durationMinutes.toString()}
                          onChangeText={(t) => handleUpdateMeal(meal.id, 'durationMinutes', parseInt(t) || 15)}
                          keyboardType="numeric"
                      />
                      <Text style={styles.durationSuffix}>min</Text>
                    </View>
                 </View>
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
  headerTitle: { color: lifeTheme.colors.text, fontSize: 26, fontWeight: '900' },
  syncBtnFull: { 
    backgroundColor: lifeTheme.colors.primary, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 16, 
    width: '100%',
    alignItems: 'center',
    shadowColor: lifeTheme.colors.primary, 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 4,
    marginBottom: 4
  },
  syncBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  
  daySelectorStatic: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 20 },
  dayCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: lifeTheme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border },
  dayCircleActive: { backgroundColor: lifeTheme.colors.primary, borderColor: lifeTheme.colors.primary },
  dayCircleText: { color: lifeTheme.colors.muted, fontWeight: '800', fontSize: 16 },
  dayCircleTextActive: { color: '#fff' },
  
  scroll: { flex: 1 },
  section: { gap: 10 },
  sectionTitle: { color: lifeTheme.colors.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  card: { backgroundColor: lifeTheme.colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: lifeTheme.colors.border },
  
  mealCard: { backgroundColor: lifeTheme.colors.surface, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: lifeTheme.colors.border, gap: 12 },
  mealDetails: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 14, padding: 12, gap: 10 },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: lifeTheme.colors.muted, fontSize: 15, fontWeight: '700' },
  
  timePickerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeValueBtn: { backgroundColor: `${lifeTheme.colors.primary}15`, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  timeValueText: { color: lifeTheme.colors.primary, fontWeight: '900', fontSize: 18 },
  
  mealTypeInput: { color: lifeTheme.colors.text, fontSize: 18, fontWeight: '900', flex: 1, textTransform: 'capitalize' },
  deleteBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  
  durationInputGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  durationInput: { color: lifeTheme.colors.primary, fontWeight: '900', fontSize: 18, textAlign: 'right', minWidth: 40 },
  durationSuffix: { color: lifeTheme.colors.muted, fontSize: 14, fontWeight: '700' },
  
  divider: { height: 1, backgroundColor: lifeTheme.colors.border, marginVertical: 4 },
  addBtn: { backgroundColor: `${lifeTheme.colors.primary}15`, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  addBtnText: { color: lifeTheme.colors.primary, fontWeight: '900', fontSize: 13 },
  emptyText: { color: lifeTheme.colors.muted, textAlign: 'center', fontStyle: 'italic', marginTop: 20 }
});
