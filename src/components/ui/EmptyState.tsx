import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../theme';
import { AppButton } from './AppButton';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon: Icon, title, message, actionLabel, onAction }: EmptyStateProps): ReactElement {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Icon size={24} color={theme.colors.primary} strokeWidth={2} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {actionLabel && onAction ? <AppButton label={actionLabel} onPress={onAction} variant="tonal" /> : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    root: {
      alignItems: 'center',
      paddingVertical: 28,
      paddingHorizontal: 20,
      gap: 14
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softPrimary
    },
    copy: { alignItems: 'center', gap: 5, maxWidth: 320 },
    title: { color: theme.colors.text, fontSize: theme.typography.titleSm, fontWeight: '800' },
    message: {
      color: theme.colors.muted,
      fontSize: theme.typography.bodySm,
      lineHeight: theme.typography.lineHeight.bodySm,
      textAlign: 'center'
    }
  });
}
