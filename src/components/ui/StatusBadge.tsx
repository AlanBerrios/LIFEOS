import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../theme';

type StatusTone = 'neutral' | 'primary' | 'success' | 'warning' | 'info' | 'danger';

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  icon?: LucideIcon;
};

export function StatusBadge({ label, tone = 'neutral', icon: Icon }: StatusBadgeProps): ReactElement {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const colors = {
    neutral: { foreground: theme.colors.muted, background: theme.colors.surfaceAlt },
    primary: { foreground: theme.colors.primary, background: theme.colors.softPrimary },
    success: { foreground: theme.colors.success, background: theme.colors.softSuccess },
    warning: { foreground: theme.colors.warning, background: theme.colors.softWarning },
    info: { foreground: theme.colors.info, background: theme.colors.softInfo },
    danger: { foreground: theme.colors.danger, background: theme.colors.softAlert }
  }[tone];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {Icon ? <Icon size={13} color={colors.foreground} strokeWidth={2.4} /> : null}
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    root: {
      minHeight: 26,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      borderRadius: theme.radius.full
    },
    label: { fontSize: theme.typography.caption, fontWeight: '800' }
  });
}
