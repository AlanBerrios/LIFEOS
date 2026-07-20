import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';
import { AnimatedPressable } from './AnimatedPressable';

type AppIconButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  selected?: boolean;
  danger?: boolean;
  disabled?: boolean;
  size?: 'standard' | 'small';
};

export function AppIconButton({
  icon: Icon,
  label,
  onPress,
  selected,
  danger,
  disabled,
  size = 'standard'
}: AppIconButtonProps): ReactElement {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const color = danger
    ? theme.colors.danger
    : selected
      ? theme.colors.primary
      : theme.colors.muted;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        size === 'small' && styles.small,
        selected && styles.selected,
        danger && styles.danger
      ]}
    >
      <Icon size={size === 'small' ? 19 : 21} color={color} strokeWidth={2.2} />
    </AnimatedPressable>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    base: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt
    },
    small: { width: 48, height: 48, borderRadius: theme.radius.sm },
    selected: { backgroundColor: theme.colors.softPrimary },
    danger: { backgroundColor: theme.colors.softAlert }
  });
}
