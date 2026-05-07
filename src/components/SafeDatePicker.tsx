import React, { useMemo, useState, ReactElement } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useAppTheme } from '../theme';
import { useLifeStore } from '../store/useLifeStore';

export interface SafeDatePickerProps {
  label: string;
  value: Date | null;
  onClear: () => void;
  onConfirm: (d: Date) => void;
}

export function SafeDatePicker({
  label,
  value,
  onClear,
  onConfirm
}: SafeDatePickerProps): ReactElement {
  const lifeTheme = useAppTheme();
  const uiThemeMode = useLifeStore((s) => s.settings.uiThemeMode ?? 'dark');
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  function handleDateConfirm(selected: Date) {
    const nextDate = value ? new Date(value) : new Date();
    nextDate.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setPendingDate(nextDate);
    setShowDate(false);
    setTimeout(() => setShowTime(true), 0);
  }

  function handleTimeConfirm(selected: Date) {
    const baseDate = pendingDate ?? value ?? new Date();
    const combined = new Date(baseDate);
    combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setPendingDate(null);
    setShowTime(false);
    onConfirm(combined);
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.dateBtn} onPress={() => setShowDate(true)}>
        <Text style={[styles.dateBtnText, value ? styles.dateBtnTextActive : null]}>
          {value
            ? `📅 ${value.toLocaleDateString('es-ES')}  ${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : '+ Seleccionar (opcional)'}
        </Text>
        {value && (
          <Pressable hitSlop={12} onPress={(e) => { e.stopPropagation(); onClear(); }}>
            <Text style={styles.dateClear}>✕</Text>
          </Pressable>
        )}
      </Pressable>

      <DateTimePickerModal
        isVisible={showDate}
        mode="date"
        date={value ?? new Date()}
        locale="es-ES"
        is24Hour
        isDarkModeEnabled={uiThemeMode === 'dark'}
        display={Platform.OS === 'android' ? 'calendar' : 'inline'}
        confirmTextIOS="Siguiente"
        cancelTextIOS="Cancelar"
        buttonTextColorIOS={lifeTheme.colors.primary}
        onConfirm={handleDateConfirm}
        onCancel={() => {
          setShowDate(false);
          setPendingDate(null);
        }}
      />
      <DateTimePickerModal
        isVisible={showTime}
        mode="time"
        date={pendingDate ?? value ?? new Date()}
        locale="es-ES"
        is24Hour
        isDarkModeEnabled={uiThemeMode === 'dark'}
        minuteInterval={5}
        display={Platform.OS === 'android' ? 'clock' : 'spinner'}
        confirmTextIOS="Guardar"
        cancelTextIOS="Cancelar"
        buttonTextColorIOS={lifeTheme.colors.primary}
        onConfirm={handleTimeConfirm}
        onCancel={() => {
          setShowTime(false);
          setPendingDate(null);
        }}
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text
    },
    dateBtn: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.background,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    dateBtnText: {
      fontSize: 12,
      color: theme.colors.muted,
      fontStyle: 'italic'
    },
    dateBtnTextActive: {
      color: theme.colors.text,
      fontWeight: '600',
      fontStyle: 'normal'
    },
    dateClear: {
      fontSize: 14,
      color: theme.colors.alert,
      fontWeight: '600'
    }
  });
}
