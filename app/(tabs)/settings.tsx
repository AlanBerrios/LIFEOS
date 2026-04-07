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
  View
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

function SectionHeader({ title }: { title: string }): ReactElement {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const settings = useLifeStore((s) => s.settings);
  const updateSettings = useLifeStore((s) => s.updateSettings);
  const clearAllData = useLifeStore((s) => s.clearAllData);
  const tasks = useLifeStore((s) => s.tasks);
  const sessions = useLifeStore((s) => s.sessions);

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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>⚙️ Configuración</Text>

      {/* Descansos */}
      <SectionHeader title="⏸ Descansos" />
      <View style={styles.card}>
        <SettingRow
          label="Descanso corto"
          subtitle={`${settings.breakDurationMinutes} min entre tareas`}
        >
          <Text style={styles.valueText}>{settings.breakDurationMinutes} min</Text>
        </SettingRow>
        <Slider
          style={styles.slider}
          minimumValue={5}
          maximumValue={30}
          step={5}
          value={settings.breakDurationMinutes}
          onValueChange={(v) => updateSettings({ breakDurationMinutes: Math.round(v) })}
          minimumTrackTintColor={lifeTheme.colors.primary}
          maximumTrackTintColor={lifeTheme.colors.border}
          thumbTintColor={lifeTheme.colors.primary}
        />

        <View style={styles.divider} />

        <SettingRow
          label="Descanso cognitivo"
          subtitle={`${settings.longBreakDurationMinutes} min tras agotamiento mental`}
        >
          <Text style={styles.valueText}>{settings.longBreakDurationMinutes} min</Text>
        </SettingRow>
        <Slider
          style={styles.slider}
          minimumValue={10}
          maximumValue={60}
          step={5}
          value={settings.longBreakDurationMinutes}
          onValueChange={(v) => updateSettings({ longBreakDurationMinutes: Math.round(v) })}
          minimumTrackTintColor={lifeTheme.colors.primary}
          maximumTrackTintColor={lifeTheme.colors.border}
          thumbTintColor={lifeTheme.colors.primary}
        />

        <View style={styles.divider} />

        <SettingRow
          label="Límite de racha"
          subtitle={`Trabajo continuo máximo: ${settings.workStreakLimitMinutes} min`}
        >
          <Text style={styles.valueText}>{settings.workStreakLimitMinutes} min</Text>
        </SettingRow>
        <Slider
          style={styles.slider}
          minimumValue={30}
          maximumValue={180}
          step={15}
          value={settings.workStreakLimitMinutes}
          onValueChange={(v) => updateSettings({ workStreakLimitMinutes: Math.round(v) })}
          minimumTrackTintColor={lifeTheme.colors.primary}
          maximumTrackTintColor={lifeTheme.colors.border}
          thumbTintColor={lifeTheme.colors.primary}
        />
      </View>

      {/* Notificaciones */}
      <SectionHeader title="🔔 Notificaciones" />
      <View style={styles.card}>
        <SettingRow
          label="Aviso de inicio de tarea"
          subtitle={`${settings.notifyTaskStartLeadMinutes} min antes`}
        >
          <Switch
            value={settings.notifyTaskStart}
            onValueChange={(v) => updateSettings({ notifyTaskStart: v })}
            trackColor={{ true: lifeTheme.colors.primary, false: lifeTheme.colors.border }}
            thumbColor="#fff"
          />
        </SettingRow>

        {settings.notifyTaskStart && (
          <>
            <View style={styles.divider} />
            <SettingRow label="Antelación del aviso" subtitle="Minutos antes">
              <Text style={styles.valueText}>{settings.notifyTaskStartLeadMinutes} min</Text>
            </SettingRow>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={30}
              step={1}
              value={settings.notifyTaskStartLeadMinutes}
              onValueChange={(v) => updateSettings({ notifyTaskStartLeadMinutes: Math.round(v) })}
              minimumTrackTintColor={lifeTheme.colors.primary}
              maximumTrackTintColor={lifeTheme.colors.border}
              thumbTintColor={lifeTheme.colors.primary}
            />
          </>
        )}

        <View style={styles.divider} />

        <SettingRow
          label="Recordatorio de pendientes"
          subtitle="Notificación periódica de tareas sin completar"
        >
          <Switch
            value={settings.notifyPendingIntervalMinutes > 0}
            onValueChange={(v) => updateSettings({ notifyPendingIntervalMinutes: v ? 60 : 0 })}
            trackColor={{ true: lifeTheme.colors.primary, false: lifeTheme.colors.border }}
            thumbColor="#fff"
          />
        </SettingRow>

        {settings.notifyPendingIntervalMinutes > 0 && (
          <>
            <View style={styles.divider} />
            <SettingRow label="Frecuencia" subtitle="Cada cuántos minutos">
              <Text style={styles.valueText}>{settings.notifyPendingIntervalMinutes} min</Text>
            </SettingRow>
            <Slider
              style={styles.slider}
              minimumValue={30}
              maximumValue={240}
              step={30}
              value={settings.notifyPendingIntervalMinutes}
              onValueChange={(v) => updateSettings({ notifyPendingIntervalMinutes: Math.round(v) })}
              minimumTrackTintColor={lifeTheme.colors.primary}
              maximumTrackTintColor={lifeTheme.colors.border}
              thumbTintColor={lifeTheme.colors.primary}
            />
          </>
        )}

        <View style={styles.divider} />

        <SettingRow
          label="Alerta tarea importante"
          subtitle="Avisa a las 21:00 si hay tareas de alta prioridad sin completar"
        >
          <Switch
            value={settings.notifyImportantUnfinished}
            onValueChange={(v) => updateSettings({ notifyImportantUnfinished: v })}
            trackColor={{ true: lifeTheme.colors.primary, false: lifeTheme.colors.border }}
            thumbColor="#fff"
          />
        </SettingRow>

        <View style={styles.divider} />

        <Pressable
          style={({ pressed }) => [styles.applyBtn, pressed && styles.pressed]}
          onPress={() => void handleApplyNotifications()}
        >
          <Text style={styles.applyBtnText}>Aplicar configuración de notificaciones</Text>
        </Pressable>
      </View>

      {/* Datos */}
      <SectionHeader title="📁 Datos" />
      <View style={styles.card}>
        <View style={styles.dataStats}>
          <View style={styles.dataStat}>
            <Text style={styles.dataStatNum}>{tasks.length}</Text>
            <Text style={styles.dataStatLabel}>Tareas</Text>
          </View>
          <View style={styles.dataStat}>
            <Text style={styles.dataStatNum}>{sessions.length}</Text>
            <Text style={styles.dataStatLabel}>Sesiones</Text>
          </View>
          <View style={styles.dataStat}>
            <Text style={styles.dataStatNum}>{tasks.filter(t => t.status === 'completed').length}</Text>
            <Text style={styles.dataStatLabel}>Completadas</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]}
          onPress={handleClearAll}
        >
          <Text style={styles.dangerBtnText}>🗑 Borrar todo el historial</Text>
        </Pressable>
      </View>

      {/* Acerca de */}
      <SectionHeader title="ℹ️ Sobre LifeOS" />
      <View style={styles.card}>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Versión</Text>
          <Text style={styles.aboutValue}>2.0.0</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Motor de optimización</Text>
          <Text style={styles.aboutValue}>OR-Tools CP-SAT</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Backend</Text>
          <Text style={styles.aboutValue} numberOfLines={1}>Render (Python/FastAPI)</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Frontend</Text>
          <Text style={styles.aboutValue}>React Native + Expo</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Desarrollado con ❤️ por</Text>
          <Text style={styles.aboutValue}>Alan</Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lifeTheme.colors.background },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  title: { color: lifeTheme.colors.text, fontSize: 26, fontWeight: '900', marginBottom: 4 },
  sectionHeader: {
    color: lifeTheme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 8
  },
  card: {
    backgroundColor: lifeTheme.colors.surface,
    borderRadius: lifeTheme.radius.md,
    borderWidth: 1,
    borderColor: lifeTheme.colors.border,
    padding: 16,
    gap: 12
  },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingInfo: { flex: 1, gap: 2, marginRight: 12 },
  settingLabel: { color: lifeTheme.colors.text, fontSize: 14, fontWeight: '700' },
  settingSubtitle: { color: lifeTheme.colors.muted, fontSize: 12 },
  valueText: {
    color: lifeTheme.colors.primary,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 50,
    textAlign: 'right'
  },
  slider: { marginHorizontal: -4, height: 30 },
  divider: { height: 1, backgroundColor: lifeTheme.colors.border },
  applyBtn: {
    backgroundColor: lifeTheme.colors.primary,
    borderRadius: 12,
    padding: 13,
    alignItems: 'center'
  },
  applyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  dangerBtn: {
    backgroundColor: 'rgba(252,108,143,0.12)',
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${lifeTheme.colors.alert}44`
  },
  dangerBtnText: { color: lifeTheme.colors.alert, fontWeight: '800', fontSize: 14 },
  dataStats: { flexDirection: 'row', justifyContent: 'space-around' },
  dataStat: { alignItems: 'center', gap: 4 },
  dataStatNum: { color: lifeTheme.colors.primary, fontSize: 28, fontWeight: '900' },
  dataStatLabel: { color: lifeTheme.colors.muted, fontSize: 11 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aboutLabel: { color: lifeTheme.colors.muted, fontSize: 13 },
  aboutValue: { color: lifeTheme.colors.text, fontSize: 13, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
  pressed: { opacity: 0.75 }
});
