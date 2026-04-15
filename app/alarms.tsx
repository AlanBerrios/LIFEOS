import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Modal,
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
      
      {/* Header Modal / Stack */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>Alarmas</Text>
        <Pressable style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {alarms.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No hay alarmas configuradas.</Text>
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
                <Pressable
                  style={styles.delBtn}
                  onPress={() => {
                    showAlert('Eliminar', '¿Borrar esta alarma?', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Borrar', style: 'destructive', onPress: () => void deleteAlarm(alarm.id) }
                    ]);
                  }}
                >
                  <Text style={styles.delText}>Eliminar</Text>
                </Pressable>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva Alarma</Text>
            
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
                  >
                    <Text style={[styles.daySelectText, isActive && styles.daySelectTextActive]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleCreate}>
                <Text style={styles.saveBtnText}>Guardar Alarma</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  backIcon: { color: lifeTheme.colors.text, fontSize: 24 },
  title: { color: lifeTheme.colors.text, fontSize: 20, fontWeight: '900' },
  addBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  addBtnText: { color: lifeTheme.colors.primary, fontSize: 32, fontWeight: '400', lineHeight: 36 },
  content: { padding: 20, gap: 16 },
  alarmCard: {
    flexDirection: 'row', backgroundColor: lifeTheme.colors.surface, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: lifeTheme.colors.border,
    justifyContent: 'space-between', alignItems: 'center'
  },
  alarmCardDisabled: { opacity: 0.6 },
  alarmCol: { gap: 4, flex: 1 },
  alarmTime: { color: lifeTheme.colors.text, fontSize: 38, fontWeight: '300', letterSpacing: 2 },
  alarmLabel: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '600' },
  textDisabled: { color: lifeTheme.colors.muted },
  daysRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  dayDot: { fontSize: 11, fontWeight: '800', width: 22, textAlign: 'center' },
  dayDotActive: { color: lifeTheme.colors.primary },
  dayDotActiveDisabled: { color: lifeTheme.colors.muted },
  dayDotInactive: { color: 'rgba(255,255,255,0.1)' },
  actionCol: { alignItems: 'flex-end', justifyContent: 'space-between', height: 80 },
  delBtn: { padding: 6 },
  delText: { color: lifeTheme.colors.alert, fontSize: 11, fontWeight: '700' },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { color: lifeTheme.colors.muted, textAlign: 'center', lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: lifeTheme.colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, gap: 16, paddingBottom: 40 },
  modalTitle: { color: lifeTheme.colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  timeInputContainer: { alignItems: 'center', marginVertical: 10 },
  inputTimeHero: { color: lifeTheme.colors.primary, fontSize: 64, fontWeight: '200', textAlign: 'center' },
  label: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '700', marginTop: 10 },
  input: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 12, padding: 14, color: lifeTheme.colors.text, fontSize: 16, borderWidth: 1, borderColor: lifeTheme.colors.border },
  daysSelectRow: { flexDirection: 'row', justifyContent: 'space-between' },
  daySelectBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: lifeTheme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  daySelectBtnActive: { backgroundColor: lifeTheme.colors.primary },
  daySelectText: { color: lifeTheme.colors.muted, fontWeight: '700', fontSize: 12 },
  daySelectTextActive: { color: lifeTheme.colors.onPrimary },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: lifeTheme.colors.surfaceAlt },
  cancelBtnText: { color: lifeTheme.colors.text, fontWeight: '700' },
  saveBtn: { flex: 2, backgroundColor: lifeTheme.colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: lifeTheme.colors.onPrimary, fontWeight: '800' }
  });
}
