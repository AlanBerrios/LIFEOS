import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../theme';
import { AnimatedPressable } from './AnimatedPressable';

export type AppButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: AppButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
};

export function AppButton({
  label,
  onPress,
  icon: Icon,
  variant = 'filled',
  disabled,
  loading,
  compact,
  fullWidth,
  accessibilityHint
}: AppButtonProps): ReactElement {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const foreground = variant === 'filled'
    ? theme.colors.onPrimary
    : variant === 'danger'
      ? theme.colors.danger
      : variant === 'text'
        ? theme.colors.primary
        : theme.colors.text;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.base,
        compact && styles.compact,
        fullWidth && styles.fullWidth,
        variant === 'filled' && styles.filled,
        variant === 'tonal' && styles.tonal,
        variant === 'outlined' && styles.outlined,
        variant === 'text' && styles.text,
        variant === 'danger' && styles.danger
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={compact ? 17 : 19} color={foreground} strokeWidth={2.2} /> : null}
          <Text numberOfLines={1} style={[styles.label, compact && styles.compactLabel, { color: foreground }]}>
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    base: {
      minHeight: 48,
      paddingHorizontal: 18,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center'
    },
    compact: {
      minHeight: 48,
      paddingHorizontal: 14
    },
    fullWidth: { width: '100%' },
    filled: { backgroundColor: theme.colors.primary },
    tonal: { backgroundColor: theme.colors.softPrimary },
    outlined: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.outlineStrong
    },
    text: { backgroundColor: 'transparent' },
    danger: { backgroundColor: theme.colors.softAlert },
    content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    label: { fontSize: theme.typography.bodySm, fontWeight: '800' },
    compactLabel: { fontSize: theme.typography.label }
  });
}
