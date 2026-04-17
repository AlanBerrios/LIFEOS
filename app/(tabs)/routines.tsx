import { useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Modal,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../../src/store/useLifeStore';
import { useAppTheme } from '../../src/theme';
import { createId } from '../../src/utils/ids';
import type { MealRoutine, TransitRoutine } from '../../src/types';
import { CustomAlertDialog } from '../../src/components/CustomAlertDialog';
import { useCustomAlert } from '../../src/hooks/useCustomAlert';

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
  const lifeTheme = useAppTheme();
  const uiThemeMode = useLifeStore((s) => s.settings.uiThemeMode ?? 'dark');
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const [show, setShow] = useState(false);

  // Convert "HH:mm" to Date object for the picker
  const [h, m] = value.split(':').map(Number);
  const dateValue = new Date();
  dateValue.setHours(h, m, 0, 0);

  return (
    <View style={styles.timePickerContainer}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.timeValueBtn} onPress={() => setShow(true)}>
        <Text style={styles.timeValueText}>{value}</Text>
      </Pressable>

      <DateTimePickerModal
        isVisible={show}
        mode="time"
        date={dateValue}
        locale="es-ES"
        is24Hour
        isDarkModeEnabled={uiThemeMode === 'dark'}
        minuteInterval={5}
        display={Platform.OS === 'android' ? 'clock' : 'spinner'}
        confirmTextIOS="Guardar hora"
        cancelTextIOS="Cancelar"
        buttonTextColorIOS={lifeTheme.colors.primary}
        onConfirm={(selected) => {
          const hh = String(selected.getHours()).padStart(2, '0');
          const mm = String(selected.getMinutes()).padStart(2, '0');
          onConfirm(`${hh}:${mm}`);
          setShow(false);
        }}
        onCancel={() => setShow(false)}
      />
    </View>
  );
}

export default function RoutinesScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const routines = useLifeStore((s) => s.routines);
  const alarms = useLifeStore((s) => s.alarms);
  const updateRoutine = useLifeStore((s) => s.updateRoutineDay);
  const addAlarm = useLifeStore((s) => s.addAlarm);
  const toggleAlarm = useLifeStore((s) => s.toggleAlarm);
  const deleteAlarm = useLifeStore((s) => s.deleteAlarm);
  
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [isAlarmModalVisible, setIsAlarmModalVisible] = useState(false);
  const [newAlarmLabel, setNewAlarmLabel] = useState('Alarma');
  const [newAlarmTime, setNewAlarmTime] = useState('07:00');
  const [newAlarmDays, setNewAlarmDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [pendingScrollTargetId, setPendingScrollTargetId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const { alertState, showAlert, hideAlert } = useCustomAlert();

  const currentRoutine = routines.find(r => r.dayOfWeek === selectedDay);

  function minutesFromHHMM(value: string): number {
    const [h, m] = value.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    return h * 60 + m;
  }

  function hhmmFromMinutes(totalMinutes: number): string {
    const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function deriveArrivalTime(time: string, durationMinutes: number): string {
    return hhmmFromMinutes(minutesFromHHMM(time) + Math.max(1, durationMinutes));
  }

  function deriveDuration(time: string, arrivalTime: string): number {
    const start = minutesFromHHMM(time);
    let end = minutesFromHHMM(arrivalTime);
    if (end <= start) end += 24 * 60;
    return Math.max(1, end - start);
  }

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
    setPendingScrollTargetId(newMeal.id);
    updateRoutine(selectedDay, { meals: [...(currentRoutine?.meals || []), newMeal] });
    showAlert('Comida añadida', 'Te llevé a la nueva comida para que ajustes nombre, hora y duración.');
  }

  function handleAddTransit() {
    const newTransit: TransitRoutine = {
      id: createId('transit'),
      label: 'Traslado',
      time: '07:30',
      durationMinutes: 30,
      arrivalTime: '08:00'
    };
    setPendingScrollTargetId(newTransit.id);
    updateRoutine(selectedDay, { transits: [...(currentRoutine?.transits || []), newTransit] });
    showAlert('Traslado añadido', 'Te llevé al nuevo traslado para que configures salida, llegada y duración.');
  }

  function handleDeleteMeal(mealId: string) {
    updateRoutine(selectedDay, {
      meals: currentRoutine!.meals.filter(m => m.id !== mealId)
    });
  }

  function handleDeleteTransit(transitId: string) {
    updateRoutine(selectedDay, {
      transits: currentRoutine!.transits.filter((transit) => transit.id !== transitId)
    });
  }

  function handleUpdateMeal(mealId: string, field: keyof MealRoutine, value: any) {
    updateRoutine(selectedDay, {
      meals: currentRoutine!.meals.map(m => m.id === mealId ? { ...m, [field]: value } : m)
    });
  }

  function handleUpdateTransit(transitId: string, field: keyof TransitRoutine, value: any) {
    updateRoutine(selectedDay, {
      transits: currentRoutine!.transits.map((transit) => {
        if (transit.id !== transitId) return transit;
        if (field === 'time') {
          const nextTime = String(value);
          const nextDuration = Math.max(1, transit.durationMinutes || 1);
          return {
            ...transit,
            time: nextTime,
            durationMinutes: nextDuration,
            arrivalTime: deriveArrivalTime(nextTime, nextDuration)
          };
        }
        if (field === 'durationMinutes') {
          const nextDuration = Math.max(1, Number(value) || 1);
          return {
            ...transit,
            durationMinutes: nextDuration,
            arrivalTime: deriveArrivalTime(transit.time, nextDuration)
          };
        }
        if (field === 'arrivalTime') {
          const nextArrivalTime = String(value);
          return {
            ...transit,
            arrivalTime: nextArrivalTime,
            durationMinutes: deriveDuration(transit.time, nextArrivalTime)
          };
        }

        return { ...transit, [field]: value };
      })
    });
  }

  function handleNewRoutineLayout(id: string, event: LayoutChangeEvent): void {
    if (pendingScrollTargetId !== id) return;
    const y = Math.max(0, event.nativeEvent.layout.y - 24);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
      setPendingScrollTargetId(null);
    });
  }

  function toggleAlarmDay(day: number) {
    setNewAlarmDays((prev) => prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort());
  }

  async function handleCreateAlarm() {
    try {
      await addAlarm({
        time: newAlarmTime,
        label: newAlarmLabel.trim() || 'Alarma',
        days: newAlarmDays
      });
      setIsAlarmModalVisible(false);
      setNewAlarmLabel('Alarma');
      setNewAlarmTime('07:00');
      setNewAlarmDays([1, 2, 3, 4, 5]);
      showAlert('Listo', 'Alarma creada correctamente.');
    } catch {
      showAlert('Error', 'No se pudo crear la alarma. Revisa permisos y días seleccionados.');
    }
  }

  async function handleToggleAlarm(id: string, enabled: boolean) {
    try {
      await toggleAlarm(id, enabled);
    } catch {
      showAlert('Error', 'No se pudo actualizar la alarma.');
    }
  }

  async function handleDeleteAlarm(id: string) {
    try {
      await deleteAlarm(id);
    } catch {
      showAlert('Error', 'No se pudo eliminar la alarma.');
    }
  }


  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Gestor de Rutinas</Text>
      </View>
      <Text style={styles.headerSubtitle}>Configura tus bloques fijos para que tu día se planifique solo.</Text>
      
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
        <Text style={styles.sectionLabel}>Resumen del día</Text>
        <View style={styles.overviewCard}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{currentRoutine.sleepStart}</Text>
            <Text style={styles.overviewLabel}>Dormir</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{currentRoutine.sleepEnd}</Text>
            <Text style={styles.overviewLabel}>Despertar</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{currentRoutine.meals.length}</Text>
            <Text style={styles.overviewLabel}>Comidas</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{currentRoutine.transits.length}</Text>
            <Text style={styles.overviewLabel}>Traslados</Text>
          </View>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 20 }}>
        
        {/* Horas de Sueño */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛌 Horas de Sueño</Text>
          <Text style={styles.sectionHint}>Define cuándo descansas para que el plan respete tu energía.</Text>
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

        {/* Alarmas */}
        <View style={styles.section}>
          <View style={[styles.row, { marginBottom: 8 }]}> 
            <Text style={styles.sectionTitle}>⏰ Alarmas</Text>
            <Pressable onPress={() => setIsAlarmModalVisible(true)} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Nueva</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>Activa recordatorios para iniciar o cerrar momentos clave.</Text>

          {alarms.length === 0 ? (
            <Text style={styles.emptyText}>No hay alarmas configuradas.</Text>
          ) : (
            alarms.map((alarm) => (
              <View key={alarm.id} style={styles.mealCard}>
                <View style={styles.row}>
                  <View>
                    <Text style={styles.mealTypeInput}>{alarm.label || 'Alarma'}</Text>
                    <Text style={styles.label}>{alarm.time} · {alarm.days.map((day) => DAYS_SHORT[day]).join(' ')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable
                      style={[styles.togglePill, alarm.enabled && styles.togglePillActive]}
                      onPress={() => void handleToggleAlarm(alarm.id, !alarm.enabled)}
                    >
                      <Text style={[styles.togglePillText, alarm.enabled && styles.togglePillTextActive]}>
                        {alarm.enabled ? 'ON' : 'OFF'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => void handleDeleteAlarm(alarm.id)} style={styles.deleteBtn}>
                      <Text style={{ color: lifeTheme.colors.alert, fontWeight: 'bold' }}>✕</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Comidas */}
        <View style={styles.section}>
          <View style={[styles.row, { marginBottom: 8 }]}>
            <Text style={styles.sectionTitle}>🍽️ Comidas del Día</Text>
            <Pressable onPress={handleAddMeal} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Añadir</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>Cada comida crea un bloque fijo y alimenta tu balance diario.</Text>

          {currentRoutine.meals.map((meal) => (
            <View key={meal.id} style={styles.mealCard} onLayout={(event) => handleNewRoutineLayout(meal.id, event)}>
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

        {/* Traslados */}
        <View style={styles.section}>
          <View style={[styles.row, { marginBottom: 8 }]}>
            <Text style={styles.sectionTitle}>🚗 Traslados</Text>
            <Pressable onPress={handleAddTransit} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Añadir</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>Bloquea tiempo de traslado para evitar solapes.</Text>

          {currentRoutine.transits.map((transit) => (
            <View key={transit.id} style={styles.mealCard} onLayout={(event) => handleNewRoutineLayout(transit.id, event)}>
               <View style={styles.row}>
                 <TextInput
                   style={styles.mealTypeInput}
                   value={transit.label}
                   onChangeText={(t) => handleUpdateTransit(transit.id, 'label', t)}
                   placeholder="Nombre traslado"
                   placeholderTextColor={lifeTheme.colors.muted}
                 />
                 <Pressable onPress={() => handleDeleteTransit(transit.id)} style={styles.deleteBtn}>
                   <Text style={{ color: lifeTheme.colors.alert, fontWeight: 'bold' }}>✕</Text>
                 </Pressable>
               </View>

               <View style={styles.mealDetails}>
                 <SafeTimePicker
                   label="Salida"
                   value={transit.time}
                   onConfirm={(t) => handleUpdateTransit(transit.id, 'time', t)}
                 />
                 <View style={styles.divider} />
                 <SafeTimePicker
                   label="Llegada"
                   value={transit.arrivalTime || deriveArrivalTime(transit.time, transit.durationMinutes)}
                   onConfirm={(t) => handleUpdateTransit(transit.id, 'arrivalTime', t)}
                 />
                 <View style={styles.divider} />
                 <View style={styles.row}>
                    <Text style={styles.label}>Duración</Text>
                    <View style={styles.durationInputGroup}>
                      <TextInput
                          style={styles.durationInput}
                          value={transit.durationMinutes.toString()}
                          onChangeText={(t) => handleUpdateTransit(transit.id, 'durationMinutes', parseInt(t) || 15)}
                          keyboardType="numeric"
                      />
                      <Text style={styles.durationSuffix}>min</Text>
                    </View>
                 </View>
               </View>
            </View>
          ))}

          {currentRoutine.transits.length === 0 && (
            <Text style={styles.emptyText}>No hay traslados configurados para hoy.</Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.introCard}>
            <Text style={styles.introTitle}>Base diaria</Text>
            <Text style={styles.introText}>
              Sueño, comidas y traslados se convierten en bloques del timeline y alertas.
            </Text>
            <Text style={styles.introBullet}>• Evita solapes y protege tus hábitos.</Text>
            <Text style={styles.introBullet}>• Puedes ajustar cada día sin romper la semana.</Text>
          </View>
        </View>

      </ScrollView>

      <Modal visible={isAlarmModalVisible} transparent animationType="slide" onRequestClose={() => setIsAlarmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardAlarm}>
            <Text style={styles.sectionTitle}>Nueva alarma</Text>

            <Text style={styles.label}>Etiqueta</Text>
            <TextInput
              style={styles.alarmInput}
              value={newAlarmLabel}
              onChangeText={setNewAlarmLabel}
              placeholder="Ej: Despertar"
              placeholderTextColor={lifeTheme.colors.muted}
            />

            <SafeTimePicker label="Hora" value={newAlarmTime} onConfirm={setNewAlarmTime} />

            <Text style={styles.label}>Días</Text>
            <View style={styles.daysChipRow}>
              {DAYS_SHORT.map((label, day) => {
                const active = newAlarmDays.includes(day);
                return (
                  <Pressable
                    key={label + day}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() => toggleAlarmDay(day)}
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.row}>
              <Pressable style={styles.cancelBtnModal} onPress={() => setIsAlarmModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.addBtnModal} onPress={() => void handleCreateAlarm()}>
                <Text style={styles.addBtnText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CustomAlertDialog
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onDismiss={hideAlert}
      />
    </View>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  headerTitle: { color: lifeTheme.colors.text, fontSize: 26, fontWeight: '900' },
  headerSubtitle: { color: lifeTheme.colors.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: 16, marginTop: -10, marginBottom: 12 },
  introCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    gap: 6
  },
  introTitle: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '800' },
  introText: { color: lifeTheme.colors.muted, fontSize: 12, lineHeight: 18 },
  introBullet: { color: lifeTheme.colors.muted, fontSize: 12, lineHeight: 18 },
  overviewCard: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, backgroundColor: lifeTheme.colors.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: lifeTheme.colors.border },
  sectionLabel: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
  overviewItem: { flex: 1, alignItems: 'center', gap: 2 },
  overviewValue: { color: lifeTheme.colors.text, fontSize: 18, fontWeight: '900' },
  overviewLabel: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '700' },
  
  daySelectorStatic: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 20 },
  dayCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: lifeTheme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border },
  dayCircleActive: { backgroundColor: lifeTheme.colors.primary, borderColor: lifeTheme.colors.primary },
  dayCircleText: { color: lifeTheme.colors.muted, fontWeight: '800', fontSize: 16 },
  dayCircleTextActive: { color: lifeTheme.colors.onPrimary },
  
  scroll: { flex: 1 },
  section: { gap: 10 },
  sectionTitle: { color: lifeTheme.colors.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  sectionHint: { color: lifeTheme.colors.muted, fontSize: 12, lineHeight: 18, marginTop: -6 },
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
  ,
  togglePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: lifeTheme.colors.border, backgroundColor: lifeTheme.colors.surfaceAlt },
  togglePillActive: { backgroundColor: `${lifeTheme.colors.primary}20`, borderColor: `${lifeTheme.colors.primary}80` },
  togglePillText: { color: lifeTheme.colors.muted, fontWeight: '800', fontSize: 11 },
  togglePillTextActive: { color: lifeTheme.colors.primary },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCardAlarm: { backgroundColor: lifeTheme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: lifeTheme.colors.border },
  alarmInput: { borderWidth: 1, borderColor: lifeTheme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: lifeTheme.colors.text, backgroundColor: lifeTheme.colors.surfaceAlt },
  daysChipRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  dayChip: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: lifeTheme.colors.surfaceAlt, borderWidth: 1, borderColor: lifeTheme.colors.border },
  dayChipActive: { backgroundColor: `${lifeTheme.colors.primary}20`, borderColor: lifeTheme.colors.primary },
  dayChipText: { color: lifeTheme.colors.muted, fontWeight: '800', fontSize: 12 },
  dayChipTextActive: { color: lifeTheme.colors.primary },
  cancelBtnModal: { backgroundColor: lifeTheme.colors.surfaceAlt, borderWidth: 1, borderColor: lifeTheme.colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnModal: { backgroundColor: lifeTheme.colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  cancelBtnText: { color: lifeTheme.colors.text, fontWeight: '800' }
  });
}
