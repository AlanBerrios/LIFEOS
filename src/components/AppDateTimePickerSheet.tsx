import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';
import { FormSheet } from './FormSheet';
import { AppButton } from './ui';

export type AppDateTimePickerMode = 'date' | 'time';

interface AppDateTimePickerSheetProps {
  visible: boolean;
  mode: AppDateTimePickerMode;
  value: Date;
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  onConfirm: (value: Date) => void;
  onClose: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function PickerChip({
  label,
  selected,
  onPress
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: lifeTheme.colors.primary, borderColor: lifeTheme.colors.primary }
      ]}
    >
      <Text style={[styles.chipText, selected && { color: lifeTheme.colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function AppDateTimePickerSheet({
  visible,
  mode,
  value,
  title,
  subtitle,
  confirmLabel,
  onConfirm,
  onClose
}: AppDateTimePickerSheetProps): ReactElement {
  const lifeTheme = useAppTheme();
  const styles = useMemo(() => createStyles(lifeTheme), [lifeTheme]);
  const [draft, setDraft] = useState<Date>(value);

  useEffect(() => {
    if (visible) {
      setDraft(new Date(value));
    }
  }, [visible, value]);

  const selectedYear = draft.getFullYear();
  const selectedMonth = draft.getMonth();
  const selectedDay = draft.getDate();
  const selectedHour = draft.getHours();
  const selectedMinute = draft.getMinutes();

  const yearOptions = useMemo(() => {
    const start = new Date().getFullYear() - 8;
    return Array.from({ length: 17 }, (_, index) => start + index);
  }, []);

  const monthOptions = useMemo(() =>
    [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ],
  []);

  const dayOptions = useMemo(
    () => Array.from({ length: daysInMonth(selectedYear, selectedMonth) }, (_, index) => index + 1),
    [selectedMonth, selectedYear]
  );

  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
  const minuteOptions = useMemo(() => Array.from({ length: 60 }, (_, index) => index), []);

  function updateDate(nextYear: number, nextMonth: number, nextDay: number): void {
    setDraft((current) => {
      const next = new Date(current);
      const safeDay = clamp(nextDay, 1, daysInMonth(nextYear, nextMonth));
      next.setFullYear(nextYear, nextMonth, safeDay);
      return next;
    });
  }

  function updateTime(nextHour: number, nextMinute: number): void {
    setDraft((current) => {
      const next = new Date(current);
      next.setHours(nextHour, nextMinute, 0, 0);
      return next;
    });
  }

  return (
    <FormSheet visible={visible} onClose={onClose} align="center" animationType="fade" maxHeight="88%">
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>{mode === 'date' ? 'Selección actual' : 'Hora actual'}</Text>
            <Text style={styles.previewValue}>
              {mode === 'date' ? formatDate(draft) : formatTime(draft)}
            </Text>
          </View>

          {mode === 'date' ? (
            <ScrollView style={styles.scrollArea} contentContainerStyle={styles.sectionContent} nestedScrollEnabled>
              <Text style={styles.sectionTitle}>Año</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {yearOptions.map((year) => (
                  <PickerChip
                    key={year}
                    label={String(year)}
                    selected={year === selectedYear}
                    onPress={() => updateDate(year, selectedMonth, selectedDay)}
                  />
                ))}
              </ScrollView>

              <Text style={styles.sectionTitle}>Mes</Text>
              <View style={styles.grid}>
                {monthOptions.map((label, monthIndex) => (
                  <PickerChip
                    key={label}
                    label={label}
                    selected={monthIndex === selectedMonth}
                    onPress={() => updateDate(selectedYear, monthIndex, selectedDay)}
                  />
                ))}
              </View>

              <Text style={styles.sectionTitle}>Día</Text>
              <View style={styles.grid}>
                {dayOptions.map((day) => (
                  <PickerChip
                    key={day}
                    label={String(day)}
                    selected={day === selectedDay}
                    onPress={() => updateDate(selectedYear, selectedMonth, day)}
                  />
                ))}
              </View>
            </ScrollView>
          ) : (
            <ScrollView style={styles.scrollArea} contentContainerStyle={styles.sectionContent} nestedScrollEnabled>
              <Text style={styles.sectionTitle}>Hora</Text>
              <View style={styles.grid}>
                {hourOptions.map((hour) => (
                  <PickerChip
                    key={hour}
                    label={`${String(hour).padStart(2, '0')}:00`}
                    selected={hour === selectedHour && selectedMinute === 0}
                    onPress={() => updateTime(hour, 0)}
                  />
                ))}
              </View>

              <Text style={styles.sectionTitle}>Minuto</Text>
              <View style={styles.grid}>
                {minuteOptions.map((minute) => (
                  <PickerChip
                    key={minute}
                    label={String(minute).padStart(2, '0')}
                    selected={minute === selectedMinute}
                    onPress={() => updateTime(selectedHour, minute)}
                  />
                ))}
              </View>
            </ScrollView>
          )}

          <View style={styles.actions}>
            <View style={styles.action}><AppButton label="Cancelar" variant="outlined" onPress={onClose} fullWidth /></View>
            <View style={styles.action}><AppButton label={confirmLabel ?? 'Aplicar'} onPress={() => onConfirm(draft)} fullWidth /></View>
          </View>
        </View>
    </FormSheet>
  );
}

function createStyles(lifeTheme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    card: {
      gap: lifeTheme.spacing.sm,
      maxHeight: '84%'
    },
    header: {
      gap: 4
    },
    title: {
      color: lifeTheme.colors.text,
      fontSize: 18,
      fontWeight: '900'
    },
    subtitle: {
      color: lifeTheme.colors.muted,
      fontSize: 13,
      lineHeight: 18
    },
    previewCard: {
      borderRadius: lifeTheme.radius.md,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      paddingHorizontal: lifeTheme.spacing.md,
      paddingVertical: lifeTheme.spacing.sm,
      gap: 2
    },
    previewLabel: {
      color: lifeTheme.colors.muted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0
    },
    previewValue: {
      color: lifeTheme.colors.text,
      fontSize: 16,
      fontWeight: '900'
    },
    scrollArea: {
      maxHeight: 380
    },
    sectionContent: {
      gap: 10,
      paddingBottom: 4
    },
    sectionTitle: {
      color: lifeTheme.colors.text,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0
    },
    row: {
      gap: 8,
      paddingBottom: 4
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    chip: {
      minWidth: 58,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: lifeTheme.colors.border,
      backgroundColor: lifeTheme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center'
    },
    chipText: {
      color: lifeTheme.colors.text,
      fontSize: 12,
      fontWeight: '800'
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 2
    },
    action: { flex: 1 },
  });
}
