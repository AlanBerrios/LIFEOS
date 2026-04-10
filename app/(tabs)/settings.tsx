import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Linking
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeStore } from '../../src/store/useLifeStore';
import { lifeTheme } from '../../src/theme';
import {
  schedulePendingReminder,
  scheduleImportantTaskAlert,
  cancelAllNotifications
} from '../../src/services/notifications';
import { getCurrentLocation } from '../../src/services/location';
import { fetchAndParseICS, parseICS } from '../../src/services/icsParser';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// ─── Accordion Component ──────────────────────────────────────────────────
function Accordion({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const heightValue = useSharedValue(0);

  const stylez = useAnimatedStyle(() => ({
    maxHeight: withTiming(open ? 1000 : 0, { duration: 300 }),
    opacity: withTiming(open ? 1 : 0, { duration: 300 }),
    marginTop: withTiming(open ? 8 : 0, { duration: 300 })
  }));

  return (
    <View style={styles.accordionCard}>
      <Pressable style={styles.accordionHeader} onPress={() => setOpen(!open)}>
        <Text style={styles.accordionTitle}>{icon}  {title}</Text>
        <Text style={{ color: lifeTheme.colors.primary, fontSize: 18, fontWeight: '700' }}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      <Animated.View style={[styles.accordionContent, stylez]}>
        {children}
        <View style={{ height: 16 }} />
      </Animated.View>
    </View>
  );
}

// ─── Setting Row ──────────────────────────────────────────────────────────────
function SettingRow({ label, subtitle, children }: {
  label: string;
  subtitle?: string;
  children: ReactElement;
}): ReactElement {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const settings = useLifeStore((s) => s.settings);
  const updateSettings = useLifeStore((s) => s.updateSettings);
  const clearAllData = useLifeStore((s) => s.clearAllData);
  const tasks = useLifeStore((s) => s.tasks);
  const lastEngine = useLifeStore((s) => s.lastEngine);
  const lastSolverStatus = useLifeStore((s) => s.lastSolverStatus);

  const [icsUrl, setIcsUrl] = useState('');

  async function handleBackup() {
    try {
      const storeState = useLifeStore.getState();
      const backupData = JSON.stringify(storeState, null, 2);
      // @ts-ignore - Expo types issue
      const fileUri = FileSystem.cacheDirectory + 'lifeos_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, backupData, { encoding: 'utf8' });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { dialogTitle: 'Copia de seguridad LifeOS' });
      } else {
        Alert.alert('Error', 'Compartir no está disponible en este dispositivo.');
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo generar la copia de seguridad.');
    }
  }

  function handleClearAll() {
    Alert.alert(
      '⚠️ Borrar todo el historial',
      'Esto eliminará todas las tareas, el timeline y las estadísticas. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'BORRAR TODO',
          style: 'destructive',
          onPress: () => {
            clearAllData();
          }
        }
      ]
    );
  }

  async function handleSetLocation(type: 'home' | 'work') {
    const coords = await getCurrentLocation();
    if (!coords) return;
    
    if (type === 'home') {
      updateSettings({ homeLocation: { latitude: coords.latitude, longitude: coords.longitude } });
      Alert.alert('Ubicación guardada', 'Casa configurada en tu posición actual.');
    } else {
      updateSettings({ workLocation: { latitude: coords.latitude, longitude: coords.longitude } });
      Alert.alert('Ubicación guardada', 'Universidad configurada en tu posición actual.');
    }
  }

  async function handleApplyNotifications() {
    await cancelAllNotifications();
    const pendingTasks = tasks.filter((t) => t.status !== 'completed');
    if (settings.notifyPendingIntervalMinutes > 0 && pendingTasks.length > 0) {
      await schedulePendingReminder(settings.notifyPendingIntervalMinutes, pendingTasks.length);
    }
    if (settings.notifyImportantUnfinished) {
      const important = tasks.find((t) => t.priority >= 4 && t.status !== 'completed');
      if (important) await scheduleImportantTaskAlert(important.title);
    }
    Alert.alert('✅ Notificaciones aplicadas', 'La configuración de notificaciones se ha guardado.');
  }

  async function handleSyncIcsUrl() {
    if (!icsUrl) return;
    const success = await fetchAndParseICS(icsUrl);
    if (success) setIcsUrl('');
  }

  async function handlePickIcsFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/calendar', '*/*'],
        copyToCacheDirectory: true
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const fileUri = res.assets[0].uri;
        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        const parsedEvents = parseICS(fileContent);
        if (parsedEvents.length > 0) {
          useLifeStore.getState().setEvents(parsedEvents);
          Alert.alert('Importado', `${parsedEvents.length} eventos importados exitosamente desde el archivo.`);
        } else {
          Alert.alert('Vacío', 'No se encontraron eventos en el archivo .ics');
        }
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo procesar el archivo seleccionado.');
      console.log(err);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configuración</Text>
      </View>

      <Accordion title="Preferencias de Tareas" icon="🎯">
        <SettingRow label="Límite Agotamiento" subtitle="Minutos de trabajo continuo antes de forzar descanso (racha máxima).">
          <Text style={styles.valueText}>{settings.workStreakLimitMinutes} m</Text>
        </SettingRow>
        <Slider
          style={styles.slider}
          minimumValue={30} maximumValue={180} step={15}
          value={settings.workStreakLimitMinutes}
          onValueChange={(v) => updateSettings({ workStreakLimitMinutes: Math.round(v) })}
          minimumTrackTintColor={lifeTheme.colors.primary} maximumTrackTintColor={lifeTheme.colors.border} thumbTintColor={lifeTheme.colors.primary}
        />
        <View style={styles.divider} />
        
        <SettingRow label="Descanso Corto" subtitle="Entre bloques regulares.">
          <Text style={styles.valueText}>{settings.breakDurationMinutes} m</Text>
        </SettingRow>
        <Slider
          style={styles.slider}
          minimumValue={5} maximumValue={30} step={5}
          value={settings.breakDurationMinutes}
          onValueChange={(v) => updateSettings({ breakDurationMinutes: Math.round(v) })}
          minimumTrackTintColor={lifeTheme.colors.primary} maximumTrackTintColor={lifeTheme.colors.border} thumbTintColor={lifeTheme.colors.primary}
        />
        <View style={styles.divider} />
        
        <SettingRow label="Descanso Cognitivo" subtitle="Tras agotar racha máxima.">
          <Text style={styles.valueText}>{settings.longBreakDurationMinutes} m</Text>
        </SettingRow>
        <Slider
          style={styles.slider}
          minimumValue={10} maximumValue={60} step={5}
          value={settings.longBreakDurationMinutes}
          onValueChange={(v) => updateSettings({ longBreakDurationMinutes: Math.round(v) })}
          minimumTrackTintColor={lifeTheme.colors.primary} maximumTrackTintColor={lifeTheme.colors.border} thumbTintColor={lifeTheme.colors.primary}
        />
      </Accordion>

      <Accordion title="Rutinas y Alarmas" icon="🌙">
        <SettingRow label="Hora de dormir" subtitle="Inicio del periodo de descanso">
          <TextInput
            style={styles.timeInput}
            value={settings.sleepTimeStart}
            onChangeText={(v) => updateSettings({ sleepTimeStart: v })}
            placeholder="23:00" maxLength={5}
          />
        </SettingRow>
        <View style={styles.divider} />
        <SettingRow label="Hora de despertar" subtitle="Fin del periodo de descanso">
          <TextInput
            style={styles.timeInput}
            value={settings.sleepTimeEnd}
            onChangeText={(v) => updateSettings({ sleepTimeEnd: v })}
            placeholder="07:00" maxLength={5}
          />
        </SettingRow>
        <View style={styles.divider} />
        <Pressable
          style={({ pressed }) => [styles.applyBtn, pressed && styles.pressed, { backgroundColor: lifeTheme.colors.surfaceAlt, borderWidth: 1, borderColor: lifeTheme.colors.primary }]}
          onPress={() => router.push('/alarms' as any)}
        >
          <Text style={[styles.applyBtnText, { color: lifeTheme.colors.primary }]}>⏰ Tablero de Alarmas</Text>
        </Pressable>
      </Accordion>

      <Accordion title="Gestión Antidistracción" icon="⏳">
        <SettingRow label="Tiempo máx en RRSS" subtitle="Minutos base antes de advertir distracciones (RRSS, videos).">
          <Text style={styles.valueText}>{settings.maxSocialMinutes} m</Text>
        </SettingRow>
        <Slider
          style={styles.slider}
          minimumValue={5} maximumValue={60} step={5}
          value={settings.maxSocialMinutes}
          onValueChange={(v) => updateSettings({ maxSocialMinutes: Math.round(v) })}
          minimumTrackTintColor={lifeTheme.colors.primary} maximumTrackTintColor={lifeTheme.colors.border} thumbTintColor={lifeTheme.colors.primary}
        />
      </Accordion>

      <Accordion title="Notificaciones" icon="🔔">
        <SettingRow label="Aviso de inicio" subtitle={`${settings.notifyTaskStartLeadMinutes} min antes de empezar`}>
          <Switch
            value={settings.notifyTaskStart}
            onValueChange={(v) => updateSettings({ notifyTaskStart: v })}
            trackColor={{ true: lifeTheme.colors.primary, false: lifeTheme.colors.border }} thumbColor="#fff"
          />
        </SettingRow>
        {settings.notifyTaskStart && (
          <Slider
            style={styles.slider}
            minimumValue={1} maximumValue={30} step={1}
            value={settings.notifyTaskStartLeadMinutes}
            onValueChange={(v) => updateSettings({ notifyTaskStartLeadMinutes: Math.round(v) })}
            minimumTrackTintColor={lifeTheme.colors.primary} maximumTrackTintColor={lifeTheme.colors.border} thumbTintColor={lifeTheme.colors.primary}
          />
        )}
        <View style={styles.divider} />
        <SettingRow label="Recordatorio de pendientes" subtitle="Notificación de tareas sin completar">
          <Switch
            value={settings.notifyPendingIntervalMinutes > 0}
            onValueChange={(v) => updateSettings({ notifyPendingIntervalMinutes: v ? 60 : 0 })}
            trackColor={{ true: lifeTheme.colors.primary, false: lifeTheme.colors.border }} thumbColor="#fff"
          />
        </SettingRow>
        <View style={styles.divider} />
        <SettingRow label="Alarmas forzadas" subtitle="Sonido incluso en modo silencio">
          <Switch
            value={settings.alarmsBypassSilent}
            onValueChange={(v) => updateSettings({ alarmsBypassSilent: v })}
            trackColor={{ true: lifeTheme.colors.primary, false: lifeTheme.colors.border }} thumbColor="#fff"
          />
        </SettingRow>
        <View style={styles.divider} />
        <Pressable style={styles.applyBtn} onPress={() => void handleApplyNotifications()}>
          <Text style={styles.applyBtnText}>Activar y Guardar Reglas</Text>
        </Pressable>
      </Accordion>

      <Accordion title="Geofencing e ICS" icon="📍">
        <SettingRow label="Habilitar Detección" subtitle="Traslados casa-universidad">
          <Switch
            value={settings.enableGeofencing}
            onValueChange={(v) => updateSettings({ enableGeofencing: v })}
            trackColor={{ true: lifeTheme.colors.primary, false: lifeTheme.colors.border }} thumbColor="#fff"
          />
        </SettingRow>
        {settings.enableGeofencing && (
          <>
            <View style={styles.divider} />
             <Pressable style={styles.locBtn} onPress={() => void handleSetLocation('home')}>
                <Text style={styles.locBtnText}>🏠 Configurar "Casa" aquí</Text>
             </Pressable>
             <Pressable style={styles.locBtn} onPress={() => void handleSetLocation('work')}>
                <Text style={styles.locBtnText}>🎓 Configurar "Universidad" aquí</Text>
             </Pressable>
          </>
        )}
        <View style={styles.divider} />
        <Text style={styles.inputLabel}>Importar Calendario (URL o local)</Text>
        <View style={styles.urlInputBox}>
          <TextInput
            style={styles.urlInput}
            value={icsUrl}
            onChangeText={setIcsUrl}
            placeholder="https://.../basic.ics"
            placeholderTextColor={lifeTheme.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.applyBtn} onPress={() => void handleSyncIcsUrl()}>
            <Text style={styles.applyBtnText}>Sincronizar URL</Text>
          </Pressable>
          <Pressable style={[styles.applyBtn, { backgroundColor: lifeTheme.colors.surfaceAlt, borderWidth: 1, borderColor: lifeTheme.colors.muted }]} onPress={() => void handlePickIcsFile()}>
            <Text style={[styles.applyBtnText, { color: lifeTheme.colors.text }]}>📁 Seleccionar Archivo .ics</Text>
          </Pressable>
        </View>
      </Accordion>

      <Accordion title="Mantenimiento" icon="⚙️">
        <SettingRow label="Copia de Seguridad" subtitle="Exporta tus datos localmente">
          <Pressable style={styles.backupBtn} onPress={() => void handleBackup()}>
            <Text style={styles.backupBtnText}>Exportar</Text>
          </Pressable>
        </SettingRow>
        
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Zona de Peligro</Text>
          <Pressable style={styles.dangerBtn} onPress={handleClearAll}>
            <Text style={styles.dangerBtnText}>Borrar Todos los Datos (Wipe)</Text>
          </Pressable>
        </View>
      </Accordion>

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>Sistema y Optimizador</Text>
        <View
          style={[
            styles.engineBadge,
            lastEngine === 'ortools-cpsat' ? styles.badgeGreen :
            lastEngine === 'greedy-fallback' ? styles.badgeYellow : styles.badgePurple
          ]}
        >
          <Text style={[
            styles.engineText,
            lastEngine === 'ortools-cpsat' ? { color: lifeTheme.colors.success } :
            lastEngine === 'greedy-fallback' ? { color: '#f59e0b' } : { color: lifeTheme.colors.primary }
          ]}>
            {lastEngine === 'ortools-cpsat' ? `🔬 OR-Tools (Nube) · ${lastSolverStatus}` :
             lastEngine === 'greedy-fallback' ? `⚠️ Greedy Alg.` :
             '📱 Planificador local'}
          </Text>
        </View>
        <Text style={styles.buildInfo}>LifeOS v2.0.4 · Production Build</Text>
      </View>

      <View style={styles.footerInfo}>
        <Text style={styles.footerText}>LifeOS v2.0 "Nexus" | Desarrollado por Alan Berrios Estay (aka BlitZx)</Text>
        <Pressable onPress={() => Linking.openURL('https://github.com/AlanBerrios/LIFEOS')}>
          <Text style={[styles.footerText, { color: lifeTheme.colors.primary, marginTop: 4, fontWeight: '800' }]}>GitHub: AlanBerrios/LIFEOS</Text>
        </Pressable>
        <Pressable 
          style={{ marginTop: 16, backgroundColor: `${lifeTheme.colors.primary}15`, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: `${lifeTheme.colors.primary}55` }}
          onPress={() => {
            updateSettings({ showTutorial: true });
            Alert.alert('Tutorial Reiniciado', 'Vuelve al Home para ver la guía.');
          }}
        >
          <Text style={{ color: lifeTheme.colors.primary, fontSize: 13, fontWeight: '800' }}>Reiniciar Guía Tutorial</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  headerTitle: { color: lifeTheme.colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 16, paddingBottom: 50, gap: 16 },

  accordionCard: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    overflow: 'hidden'
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    backgroundColor: lifeTheme.colors.surface,
    elevation: 2,
    zIndex: 10
  },
  accordionTitle: { color: lifeTheme.colors.text, fontSize: 17, fontWeight: '800' },
  accordionContent: {
    paddingHorizontal: 16,
    overflow: 'hidden'
  },

  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8, gap: 16 },
  settingInfo: { flex: 1 },
  settingLabel: { color: lifeTheme.colors.text, fontSize: 16, fontWeight: '700' },
  settingSubtitle: { color: lifeTheme.colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  divider: { height: 1, backgroundColor: lifeTheme.colors.border, marginVertical: 8 },
  slider: { marginHorizontal: -4, height: 30 },
  
  valueText: { color: lifeTheme.colors.primary, fontSize: 16, fontWeight: '800', marginRight: 8, width: 45, textAlign: 'right' },
  
  applyBtn: { backgroundColor: lifeTheme.colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  applyBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  backupBtn: { backgroundColor: lifeTheme.colors.success, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  backupBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.75 },

  timeInput: { backgroundColor: lifeTheme.colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, color: lifeTheme.colors.text, fontSize: 16, fontWeight: '700', width: 65, textAlign: 'center', borderWidth: 1, borderColor: lifeTheme.colors.border },

  urlInputBox: { paddingVertical: 8, gap: 12 },
  inputLabel: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: -4 },
  urlInput: { backgroundColor: lifeTheme.colors.background, color: lifeTheme.colors.text, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: lifeTheme.colors.border, fontSize: 15 },
  
  locBtn: { paddingVertical: 10 },
  locBtnText: { color: lifeTheme.colors.primary, fontWeight: '600', fontSize: 14 },
  
  dangerZone: { marginTop: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: `${lifeTheme.colors.alert}55` },
  dangerTitle: { color: lifeTheme.colors.alert, fontSize: 16, fontWeight: '900', marginBottom: 12, textTransform: 'uppercase' },
  dangerBtn: { backgroundColor: `${lifeTheme.colors.alert}15`, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: `${lifeTheme.colors.alert}55` },
  dangerBtnText: { color: lifeTheme.colors.alert, fontWeight: '800', fontSize: 14 },
  
  footerInfo: { alignItems: 'center', paddingVertical: 24 },
  footerText: { color: lifeTheme.colors.muted, fontSize: 12, fontWeight: '600' }
});
