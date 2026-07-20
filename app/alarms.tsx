import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useLifeStore } from '../src/store/useLifeStore';
import { useAppTheme } from '../src/theme';
import { CustomAlertDialog } from '../src/components/CustomAlertDialog';
import { useCustomAlert } from '../src/hooks/useCustomAlert';
import { Bell, Plus, Trash2 } from 'lucide-react-native';
import { FormSheet } from '../src/components/FormSheet';
import { AppButton, AppIconButton, EmptyState, ScreenHeader } from '../src/components/ui';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function AlarmsScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const alarms = useLifeStore((s) => s.alarms);
  const addAlarm = useLifeStore((s) => s.addAlarm);
  const toggleAlarm = useLifeStore((s) => s.toggleAlarm);
  const deleteAlarm = useLifeStore((s) => s.deleteAlarm);

  const [modalVisible, setModalVisible] = useState(false);
  const [newAlarm, setNewAlarm] = useState({
    time: '07:00',
    label: 'Despertar',
    days: [1, 2, 3, 4, 5] // Lun-Vie by default
  });
  const { alertState, showAlert, hideAlert } = useCustomAlert();

  async function handleToggle(id: string, currentEnabled: boolean) {
    try {
      await toggleAlarm(id, !currentEnabled);
      showAlert('Alarma', currentEnabled ? 'Alarma desactivada' : 'Alarma activada');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar la alarma.';
      showAlert('Error', message);
    }
  }

  async function handleCreate() {
    if (!newAlarm.time.match(/^([01]\d|2[0-3]):?([0-5]\d)$/)) {
      showAlert('Error', 'Hora inválida. Usa formato HH:mm (ej: 07:00)');
      return;
    }
    
    try {
      await addAlarm({
        time: newAlarm.time,
        label: newAlarm.label || 'Alarma',
        days: newAlarm.days
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear la alarma.';
      showAlert('Error', message);
      return;
    }

    setModalVisible(false);
    setNewAlarm({ time: '07:00', label: 'Despertar', days: [1, 2, 3, 4, 5] });
  }

  function toggleDaySelection(dIdx: number) {
    setNewAlarm(prev => {
      const isSelected = prev.days.includes(dIdx);
      if (isSelected) return { ...prev, days: prev.days.filter(d => d !== dIdx) };
      return { ...prev, days: [...prev.days, dIdx].sort() };
    });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <ScreenHeader
          onBack={() => router.back()}
          eyebrow="Avisos locales"
          title="Recordatorios"
          subtitle="Se muestran como notificaciones de alta prioridad en Android."
          action={<AppButton label="Nuevo" icon={Plus} compact onPress={() => setModalVisible(true)} />}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {alarms.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon={Bell}
              title="Sin recordatorios"
              message="Añade un horario para recibir un aviso local."
              actionLabel="Crear recordatorio"
              onAction={() => setModalVisible(true)}
            />
          </View>
        ) : (
          alarms.map((alarm, idx) => (
            <Animated.View
              key={alarm.id}
              entering={FadeInDown.delay(idx * 50)}
              layout={Layout.springify()}
              style={[styles.alarmCard, !alarm.enabled && styles.alarmCardDisabled]}
            >
              <View style={styles.alarmCol}>
                <Text style={[styles.alarmTime, !alarm.enabled && styles.textDisabled]}>
                  {alarm.time}
                </Text>
                <Text style={[styles.alarmLabel, !alarm.enabled && styles.textDisabled]}>
                  {alarm.label}
                </Text>
                <View style={styles.daysRow}>
                  {DAYS.map((d, i) => (
                    <Text key={i} style={[
                      styles.dayDot,
                      alarm.days.includes(i) ? styles.dayDotActive : styles.dayDotInactive,
                      !alarm.enabled && alarm.days.includes(i) && styles.dayDotActiveDisabled
                    ]}>
                      {d.charAt(0)}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={styles.actionCol}>
                <Switch
                  value={alarm.enabled}
                  onValueChange={() => handleToggle(alarm.id, alarm.enabled)}
                  trackColor={{ true: lifeTheme.colors.primary, false: lifeTheme.colors.surfaceAlt }}
                  thumbColor="#fff"
                />
                <AppIconButton
                  icon={Trash2}
                  label={`Eliminar recordatorio ${alarm.label}`}
                  danger
                  size="small"
                  onPress={() => {
                    showAlert('Eliminar', '¿Borrar este recordatorio?', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Borrar', style: 'destructive', onPress: () => void deleteAlarm(alarm.id) }
                    ]);
                  }}
                />
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>

      <FormSheet visible={modalVisible} onClose={() => setModalVisible(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo recordatorio</Text>
            
            <View style={styles.timeInputContainer}>
              <TextInput
                style={styles.inputTimeHero}
                value={newAlarm.time}
                onChangeText={(v) => setNewAlarm(p => ({ ...p, time: v }))}
                placeholder="07:00"
                placeholderTextColor={lifeTheme.colors.muted}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <Text style={styles.label}>Etiqueta</Text>
            <TextInput
              style={styles.input}
              value={newAlarm.label}
              onChangeText={(v) => setNewAlarm(p => ({ ...p, label: v }))}
              placeholder="Ej: Despertar, Pastilla..."
              placeholderTextColor={lifeTheme.colors.muted}
            />

            <Text style={styles.label}>Repetir (Días)</Text>
            <View style={styles.daysSelectRow}>
              {DAYS.map((d, i) => {
                const isActive = newAlarm.days.includes(i);
                return (
                  <Pressable
                    key={i}
                    style={[styles.daySelectBtn, isActive && styles.daySelectBtnActive]}
                    onPress={() => toggleDaySelection(i)}
                    hitSlop={4}
                  >
                    <Text style={[styles.daySelectText, isActive && styles.daySelectTextActive]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalBtns}>
              <View style={styles.modalAction}>
                <AppButton label="Cancelar" variant="outlined" onPress={() => setModalVisible(false)} fullWidth />
              </View>
              <View style={styles.modalActionWide}>
                <AppButton label="Guardar" onPress={handleCreate} fullWidth />
              </View>
            </View>
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
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  content: { padding: 20, gap: 16 },
  alarmCard: {
    flexDirection: 'row', backgroundColor: lifeTheme.colors.surface, borderRadius: lifeTheme.radius.md,
    padding: 14, borderWidth: 1, borderColor: lifeTheme.colors.border,
    justifyContent: 'space-between', alignItems: 'center'
  },
  alarmCardDisabled: { opacity: 0.6 },
  alarmCol: { gap: 4, flex: 1 },
  alarmTime: { color: lifeTheme.colors.text, fontSize: 32, fontWeight: '500', letterSpacing: 0 },
  alarmLabel: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '600' },
  textDisabled: { color: lifeTheme.colors.muted },
  daysRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  dayDot: { fontSize: 11, fontWeight: '800', width: 22, textAlign: 'center' },
  dayDotActive: { color: lifeTheme.colors.primary },
  dayDotActiveDisabled: { color: lifeTheme.colors.muted },
  dayDotInactive: { color: 'rgba(255,255,255,0.1)' },
  actionCol: { alignItems: 'flex-end', justifyContent: 'space-between', height: 80 },
  emptyCard: { borderWidth: 1, borderColor: lifeTheme.colors.border, borderRadius: lifeTheme.radius.md, alignItems: 'center' },
  modalCard: { gap: 16 },
  modalTitle: { color: lifeTheme.colors.text, fontSize: 20, fontWeight: '900' },
  timeInputContainer: { alignItems: 'center', marginVertical: 4 },
  inputTimeHero: { minHeight: 64, color: lifeTheme.colors.primary, fontSize: 40, fontWeight: '600', letterSpacing: 0, textAlign: 'center' },
  label: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700', marginTop: 10 },
  input: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 12, padding: 14, color: lifeTheme.colors.text, fontSize: 16, borderWidth: 1, borderColor: lifeTheme.colors.border },
  daysSelectRow: { flexDirection: 'row', justifyContent: 'space-between' },
  daySelectBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: lifeTheme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  daySelectBtnActive: { backgroundColor: lifeTheme.colors.primary },
  daySelectText: { color: lifeTheme.colors.muted, fontWeight: '700', fontSize: 12 },
  daySelectTextActive: { color: lifeTheme.colors.onPrimary },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalAction: { flex: 1 },
  modalActionWide: { flex: 2 },
  });
}
