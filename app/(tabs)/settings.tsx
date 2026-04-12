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
import { useAppTheme, UI_ACCENT_PRESETS } from '../../src/theme';
import {
  schedulePendingReminder,
  scheduleImportantTaskAlert,
  cancelAllNotifications,
  rescheduleAll
} from '../../src/services/notifications';
import { getCurrentLocation } from '../../src/services/location';
import { fetchAndParseICS, parseICS } from '../../src/services/icsParser';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type SettingsStyles = ReturnType<typeof createStyles>;

// ─── Accordion Component ──────────────────────────────────────────────────
function Accordion({
  title,
  icon,
  children,
  styles,
  primaryColor
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  styles: SettingsStyles;
  primaryColor: string;
}) {
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
        <Text style={{ color: primaryColor, fontSize: 18, fontWeight: '700' }}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      <Animated.View style={[styles.accordionContent, stylez]}>
        {children}
        <View style={{ height: 16 }} />
      </Animated.View>
    </View>
  );
}

// ─── Setting Row ──────────────────────────────────────────────────────────────
function SettingRow({ label, subtitle, children, styles }: {
  label: string;
  subtitle?: string;
  children: ReactElement;
  styles: SettingsStyles;
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
  const theme = useAppTheme();
  const lifeTheme = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const settings = useLifeStore((s) => s.settings);
  const updateSettings = useLifeStore((s) => s.updateSettings);
  const clearAllData = useLifeStore((s) => s.clearAllData);
  const tasks = useLifeStore((s) => s.tasks);
  const timeline = useLifeStore((s) => s.timeline);
  const routines = useLifeStore((s) => s.routines);
  const events = useLifeStore((s) => s.events);
  const notes = useLifeStore((s) => s.notes);
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
    await rescheduleAll(timeline, tasks, settings, routines, events, notes);
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

      <Accordion styles={styles} primaryColor={lifeTheme.colors.primary} title="Apariencia" icon="🎨">
        <SettingRow styles={styles} label="Modo oscuro" subtitle="Activa modo oscuro o claro para toda la interfaz.">
          <Switch
            value={settings.uiThemeMode === 'dark'}
            onValueChange={(v) => updateSettings({ uiThemeMode: v ? 'dark' : 'light' })}
            trackColor={{ true: lifeTheme.colors.primary, false: lifeTheme.colors.border }}
            thumbColor="#fff"
          />
        </SettingRow>

        <View style={styles.divider} />
        <Text style={styles.inputLabel}>Color principal UI</Text>
        <View style={styles.colorRow}>
          {UI_ACCENT_PRESETS.map((preset) => {
            const selected = settings.uiAccentColor === preset.color;
            return (
              <Pressable
                key={preset.key}
                onPress={() => updateSettings({ uiAccentColor: preset.color })}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: preset.color },
                  selected && styles.colorSwatchSelected
                ]}
              >
                <Text style={styles.colorSwatchText}>{selected ? '✓' : ''}</Text>
              </Pressable>
            );
          })}
        </View>
      </Accordion>

      <Accordion styles={styles} primaryColor={lifeTheme.colors.primary} title="Preferencias de Tareas" icon="🎯">
        <SettingRow styles={styles} label="Límite Agotamiento" subtitle="Minutos de trabajo continuo antes de forzar descanso (racha máxima).">
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
        
        <SettingRow styles={styles} label="Descanso Corto" subtitle="Entre bloques regulares.">
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
        
        <SettingRow styles={styles} label="Descanso Cognitivo" subtitle="Tras agotar racha máxima.">
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

      <Accordion styles={styles} primaryColor={lifeTheme.colors.primary} title="Rutinas y Alarmas" icon="🌙">
        <SettingRow styles={styles} label="Hora de dormir" subtitle="Inicio del periodo de descanso">
          <TextInput
            style={styles.timeInput}
            value={settings.sleepTimeStart}
            onChangeText={(v) => updateSettings({ sleepTimeStart: v })}
            placeholder="23:00" maxLength={5}
          />
        </SettingRow>
        <View style={styles.divider} />
        <SettingRow styles={styles} label="Hora de despertar" subtitle="Fin del periodo de descanso">
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

      <Accordion styles={styles} primaryColor={lifeTheme.colors.primary} title="Gestión Antidistracción" icon="⏳">
        <SettingRow styles={styles} label="Tiempo máx en RRSS" subtitle="Minutos base antes de advertir distracciones (RRSS, videos).">
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

      <Accordion styles={styles} primaryColor={lifeTheme.colors.primary} title="Notificaciones" icon="🔔">
        <SettingRow styles={styles} label="Aviso de inicio" subtitle={`${settings.notifyTaskStartLeadMinutes} min antes de empezar`}>
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
        <SettingRow styles={styles} label="Recordatorio de pendientes" subtitle="Notificación de tareas sin completar">
          <Switch
            value={settings.notifyPendingIntervalMinutes > 0}
            onValueChange={(v) => updateSettings({ notifyPendingIntervalMinutes: v ? 60 : 0 })}
            trackColor={{ true: lifeTheme.colors.primary, false: lifeTheme.colors.border }} thumbColor="#fff"
          />
        </SettingRow>
        <View style={styles.divider} />
        <SettingRow styles={styles} label="Alarmas forzadas" subtitle="Sonido incluso en modo silencio">
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

      <Accordion styles={styles} primaryColor={lifeTheme.colors.primary} title="Geofencing e ICS" icon="📍">
        <SettingRow styles={styles} label="Habilitar Detección" subtitle="Traslados casa-universidad">
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

      <Accordion styles={styles} primaryColor={lifeTheme.colors.primary} title="Mantenimiento" icon="⚙️">
        <SettingRow styles={styles} label="Copia de Seguridad" subtitle="Exporta tus datos localmente">
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
        <Text style={styles.buildInfo}>LifeOS v3.0.0 · Production Build</Text>
      </View>

      <View style={styles.footerInfo}>
        <Text style={styles.footerText}>LifeOS v3.0 "Nexus" | Desarrollado por Alan Berrios Estay (aka BlitZx)</Text>
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

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  headerTitle: { color: theme.colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 16, paddingBottom: 50, gap: 16 },

  accordionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden'
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    backgroundColor: theme.colors.surface,
    elevation: 2,
    zIndex: 10
  },
  accordionTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '800' },
  accordionContent: {
    paddingHorizontal: 16,
    overflow: 'hidden'
  },

  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8, gap: 16 },
  settingInfo: { flex: 1 },
  settingLabel: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  settingSubtitle: { color: theme.colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 8 },
  slider: { marginHorizontal: -4, height: 30 },
  
  valueText: { color: theme.colors.primary, fontSize: 16, fontWeight: '800', marginRight: 8, width: 45, textAlign: 'right' },
  
  applyBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  applyBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  backupBtn: { backgroundColor: theme.colors.success, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  backupBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.75 },

  timeInput: { backgroundColor: theme.colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, color: theme.colors.text, fontSize: 16, fontWeight: '700', width: 65, textAlign: 'center', borderWidth: 1, borderColor: theme.colors.border },

  urlInputBox: { paddingVertical: 8, gap: 12 },
  inputLabel: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: -4 },
  urlInput: { backgroundColor: theme.colors.background, color: theme.colors.text, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, fontSize: 15 },
  colorRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  colorSwatchSelected: {
    transform: [{ scale: 1.06 }],
    borderColor: theme.colors.text,
    borderWidth: 2
  },
  colorSwatchText: { color: '#ffffff', fontWeight: '900', fontSize: 14 },
  
  locBtn: { paddingVertical: 10 },
  locBtnText: { color: theme.colors.primary, fontWeight: '600', fontSize: 14 },
  
  dangerZone: { marginTop: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: `${theme.colors.alert}55` },
  dangerTitle: { color: theme.colors.alert, fontSize: 16, fontWeight: '900', marginBottom: 12, textTransform: 'uppercase' },
  dangerBtn: { backgroundColor: `${theme.colors.alert}15`, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: `${theme.colors.alert}55` },
  dangerBtnText: { color: theme.colors.alert, fontWeight: '800', fontSize: 14 },
  footer: { marginTop: 12, paddingHorizontal: 4, gap: 10 },
  footerTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '800' },
  engineBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, alignSelf: 'flex-start' },
  badgeGreen: { backgroundColor: 'rgba(108,252,184,0.08)', borderColor: 'rgba(108,252,184,0.25)' },
  badgeYellow: { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)' },
  badgePurple: { backgroundColor: 'rgba(124,108,252,0.08)', borderColor: 'rgba(124,108,252,0.25)' },
  engineText: { fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  buildInfo: { color: theme.colors.muted, fontSize: 11, fontWeight: '600' },
  
  footerInfo: { alignItems: 'center', paddingVertical: 24 },
  footerText: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' }
  });
}
