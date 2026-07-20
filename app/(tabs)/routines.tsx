import { useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { FormSheet } from '../../src/components/FormSheet';
import { BellPlus, Plus, Trash2 } from 'lucide-react-native';
import { AppButton, AppIconButton, ScreenHeader, SectionHeader } from '../../src/components/ui';

const DAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
type RoutineDraftKind = 'meal' | 'transit';

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
  const [isRoutineModalVisible, setIsRoutineModalVisible] = useState(false);
  const [routineDraftKind, setRoutineDraftKind] = useState<RoutineDraftKind>('meal');
  const [newAlarmLabel, setNewAlarmLabel] = useState('Alarma');
  const [newAlarmTime, setNewAlarmTime] = useState('07:00');
  const [newAlarmDays, setNewAlarmDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newMealType, setNewMealType] = useState('Nueva Comida');
  const [newMealTime, setNewMealTime] = useState('14:00');
  const [newMealDuration, setNewMealDuration] = useState('45');
  const [newTransitLabel, setNewTransitLabel] = useState('Traslado');
  const [newTransitTime, setNewTransitTime] = useState('07:30');
  const [newTransitArrivalTime, setNewTransitArrivalTime] = useState('08:00');
  const [newTransitDuration, setNewTransitDuration] = useState('30');
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
    setRoutineDraftKind('meal');
    setNewMealType('Nueva Comida');
    setNewMealTime('14:00');
    setNewMealDuration('45');
    setIsRoutineModalVisible(true);
  }

  function handleAddTransit() {
    setRoutineDraftKind('transit');
    setNewTransitLabel('Traslado');
    setNewTransitTime('07:30');
    setNewTransitArrivalTime('08:00');
    setNewTransitDuration('30');
    setIsRoutineModalVisible(true);
  }

  function handleCreateMeal() {
    const newMeal: MealRoutine = {
      id: createId('meal'),
      type: newMealType.trim() || 'Nueva Comida',
      time: newMealTime,
      durationMinutes: Math.max(1, Number(newMealDuration) || 45)
    };
    setPendingScrollTargetId(newMeal.id);
    updateRoutine(selectedDay, { meals: [...(currentRoutine?.meals || []), newMeal] });
    setIsRoutineModalVisible(false);
    showAlert('Comida añadida', 'Te llevé a la nueva comida para que ajustes nombre, hora y duración.');
  }

  function handleCreateTransit() {
    const newTransit: TransitRoutine = {
      id: createId('transit'),
      label: newTransitLabel.trim() || 'Traslado',
      time: newTransitTime,
      durationMinutes: Math.max(1, Number(newTransitDuration) || 30),
      arrivalTime: newTransitArrivalTime
    };
    setPendingScrollTargetId(newTransit.id);
    updateRoutine(selectedDay, { transits: [...(currentRoutine?.transits || []), newTransit] });
    setIsRoutineModalVisible(false);
    showAlert('Traslado añadido', 'Te llevé al nuevo traslado para que configures salida, llegada y duración.');
  }

  function handleDraftTransitTime(nextTime: string) {
    const nextDuration = Math.max(1, Number(newTransitDuration) || 30);
    setNewTransitTime(nextTime);
    setNewTransitArrivalTime(deriveArrivalTime(nextTime, nextDuration));
  }

  function handleDraftTransitArrival(nextArrivalTime: string) {
    setNewTransitArrivalTime(nextArrivalTime);
    setNewTransitDuration(String(deriveDuration(newTransitTime, nextArrivalTime)));
  }

  function handleDraftTransitDuration(nextValue: string) {
    setNewTransitDuration(nextValue);
    const nextDuration = Math.max(1, Number(nextValue) || 30);
    setNewTransitArrivalTime(deriveArrivalTime(newTransitTime, nextDuration));
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

  function closeRoutineModal() {
    setIsRoutineModalVisible(false);
  }

  function getRoutineModalTitle(): string {
    return routineDraftKind === 'meal' ? 'Nueva comida' : 'Nuevo traslado';
  }

  function getRoutineModalHint(): string {
    return routineDraftKind === 'meal'
      ? 'Crea una comida con hora y duración inicial para luego ajustarla en la lista.'
      : 'Crea un traslado con salida, llegada y duración inicial para luego ajustarlo en la lista.';
  }


  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <View style={styles.headerWrap}>
        <ScreenHeader
          eyebrow="Semana base"
          title="Rutinas"
          subtitle="Horarios fijos para cada día."
        />
      </View>
      
      {/* Selector de Días Optimizado */}
      <View style={styles.daySelectorStatic}>
        {DAYS_SHORT.map((dayName, idx) => (
          <Pressable
            key={idx}
            style={[styles.dayCircle, selectedDay === idx && styles.dayCircleActive]}
            onPress={() => setSelectedDay(idx)}
            hitSlop={5}
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
          <SectionHeader title="Sueño" subtitle="Horario protegido" />
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
          <SectionHeader
            title="Recordatorios"
            subtitle="Avisos asociados a tu rutina"
            action={<AppButton label="Nuevo" icon={BellPlus} compact variant="tonal" onPress={() => setIsAlarmModalVisible(true)} />}
          />

          {alarms.length === 0 ? (
            <Text style={styles.emptyText}>No hay recordatorios configurados.</Text>
          ) : (
            alarms.map((alarm) => (
              <View key={alarm.id} style={styles.mealCard}>
                <View style={styles.row}>
                  <View>
                    <Text style={styles.mealTypeInput}>{alarm.label || 'Alarma'}</Text>
                    <Text style={styles.label}>{alarm.time} · {alarm.days.map((day) => DAYS_SHORT[day]).join(' ')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Switch
                      value={alarm.enabled}
                      onValueChange={(enabled) => void handleToggleAlarm(alarm.id, enabled)}
                      trackColor={{ false: lifeTheme.colors.border, true: lifeTheme.colors.primary }}
                      thumbColor={alarm.enabled ? lifeTheme.colors.onPrimary : lifeTheme.colors.muted}
                    />
                    <AppIconButton icon={Trash2} label={`Eliminar recordatorio ${alarm.label}`} size="small" danger onPress={() => void handleDeleteAlarm(alarm.id)} />
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Comidas */}
        <View style={styles.section}>
          <SectionHeader
            title="Comidas"
            action={<AppButton label="Añadir" icon={Plus} compact variant="tonal" onPress={handleAddMeal} />}
          />

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
                 <AppIconButton icon={Trash2} label={`Eliminar ${meal.type}`} size="small" danger onPress={() => handleDeleteMeal(meal.id)} />
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
          <SectionHeader
            title="Traslados"
            action={<AppButton label="Añadir" icon={Plus} compact variant="tonal" onPress={handleAddTransit} />}
          />

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
                 <AppIconButton icon={Trash2} label={`Eliminar ${transit.label}`} size="small" danger onPress={() => handleDeleteTransit(transit.id)} />
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

      </ScrollView>

      <FormSheet visible={isAlarmModalVisible} onClose={() => setIsAlarmModalVisible(false)}>
            <Text style={styles.sectionTitle}>Nuevo recordatorio</Text>

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
                    hitSlop={7}
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.row}>
              <AppButton label="Cancelar" variant="outlined" onPress={() => setIsAlarmModalVisible(false)} />
              <AppButton label="Guardar" onPress={() => void handleCreateAlarm()} />
            </View>
      </FormSheet>

      <FormSheet visible={isRoutineModalVisible} onClose={closeRoutineModal}>
            <Text style={styles.sectionTitle}>{getRoutineModalTitle()}</Text>
            <Text style={styles.sectionHint}>{getRoutineModalHint()}</Text>

            {routineDraftKind === 'meal' ? (
              <>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.alarmInput}
                  value={newMealType}
                  onChangeText={setNewMealType}
                  placeholder="Ej: Desayuno"
                  placeholderTextColor={lifeTheme.colors.muted}
                />

                <SafeTimePicker label="Hora" value={newMealTime} onConfirm={setNewMealTime} />

                <Text style={styles.label}>Duración (min)</Text>
                <TextInput
                  style={styles.alarmInput}
                  value={newMealDuration}
                  onChangeText={setNewMealDuration}
                  keyboardType="numeric"
                  placeholder="45"
                  placeholderTextColor={lifeTheme.colors.muted}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.alarmInput}
                  value={newTransitLabel}
                  onChangeText={setNewTransitLabel}
                  placeholder="Ej: Camino al trabajo"
                  placeholderTextColor={lifeTheme.colors.muted}
                />

                <SafeTimePicker label="Salida" value={newTransitTime} onConfirm={handleDraftTransitTime} />
                <SafeTimePicker label="Llegada" value={newTransitArrivalTime} onConfirm={handleDraftTransitArrival} />

                <Text style={styles.label}>Duración (min)</Text>
                <TextInput
                  style={styles.alarmInput}
                  value={newTransitDuration}
                  onChangeText={handleDraftTransitDuration}
                  keyboardType="numeric"
                  placeholder="30"
                  placeholderTextColor={lifeTheme.colors.muted}
                />
              </>
            )}

            <View style={styles.row}>
              <AppButton label="Cancelar" variant="outlined" onPress={closeRoutineModal} />
              <AppButton
                label="Guardar"
                onPress={() => {
                  if (routineDraftKind === 'meal') {
                    handleCreateMeal();
                  } else {
                    handleCreateTransit();
                  }
                }}
              />
            </View>
      </FormSheet>

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
  headerWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  overviewCard: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, backgroundColor: lifeTheme.colors.surface, borderRadius: lifeTheme.radius.md, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: lifeTheme.colors.border },
  sectionLabel: { color: lifeTheme.colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
  overviewItem: { flex: 1, alignItems: 'center', gap: 1 },
  overviewValue: { color: lifeTheme.colors.text, fontSize: 15, fontWeight: '900' },
  overviewLabel: { color: lifeTheme.colors.muted, fontSize: 10, fontWeight: '700' },
  
  daySelectorStatic: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, marginBottom: 14 },
  dayCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: lifeTheme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border },
  dayCircleActive: { backgroundColor: lifeTheme.colors.primary, borderColor: lifeTheme.colors.primary },
  dayCircleText: { color: lifeTheme.colors.muted, fontWeight: '800', fontSize: 14 },
  dayCircleTextActive: { color: lifeTheme.colors.onPrimary },
  
  scroll: { flex: 1 },
  section: { gap: 10 },
  sectionTitle: { color: lifeTheme.colors.text, fontSize: 19, fontWeight: '900', letterSpacing: 0 },
  sectionHint: { color: lifeTheme.colors.muted, fontSize: 12, lineHeight: 18, marginTop: -6 },
  card: { backgroundColor: lifeTheme.colors.surface, borderRadius: lifeTheme.radius.md, padding: 12, borderWidth: 1, borderColor: lifeTheme.colors.border },
  
  mealCard: { backgroundColor: lifeTheme.colors.surface, borderRadius: lifeTheme.radius.md, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: lifeTheme.colors.border, gap: 6 },
  mealDetails: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: lifeTheme.radius.sm, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: lifeTheme.colors.muted, fontSize: 13, fontWeight: '700' },
  
  timePickerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeValueBtn: { minHeight: 44, minWidth: 76, justifyContent: 'center', alignItems: 'center', backgroundColor: lifeTheme.colors.softPrimary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: lifeTheme.radius.sm },
  timeValueText: { color: lifeTheme.colors.primary, fontWeight: '900', fontSize: 16 },
  
  mealTypeInput: { color: lifeTheme.colors.text, fontSize: 15, fontWeight: '800', flex: 1, textTransform: 'capitalize', paddingVertical: 6 },
  
  durationInputGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  durationInput: { color: lifeTheme.colors.primary, fontWeight: '900', fontSize: 16, textAlign: 'right', minWidth: 54, minHeight: 44, paddingVertical: 6 },
  durationSuffix: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700' },
  
  divider: { height: 1, backgroundColor: lifeTheme.colors.border, marginVertical: 2 },
  emptyText: { color: lifeTheme.colors.muted, textAlign: 'center', marginVertical: 16 }
  ,
  alarmInput: { minHeight: 48, borderWidth: 1, borderColor: lifeTheme.colors.border, borderRadius: lifeTheme.radius.md, paddingHorizontal: 12, paddingVertical: 10, color: lifeTheme.colors.text, backgroundColor: lifeTheme.colors.surfaceAlt },
  daysChipRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  dayChip: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: lifeTheme.colors.surfaceAlt, borderWidth: 1, borderColor: lifeTheme.colors.border },
  dayChipActive: { backgroundColor: `${lifeTheme.colors.primary}20`, borderColor: lifeTheme.colors.primary },
  dayChipText: { color: lifeTheme.colors.muted, fontWeight: '800', fontSize: 12 },
  dayChipTextActive: { color: lifeTheme.colors.primary },
  });
}
