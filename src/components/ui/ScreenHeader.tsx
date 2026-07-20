import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useAppTheme } from '../../theme';
import { AppIconButton } from './AppIconButton';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  action?: ReactNode;
};

export function ScreenHeader({ title, subtitle, eyebrow, onBack, action }: ScreenHeaderProps): ReactElement {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.root}>
      {onBack ? <AppIconButton icon={ArrowLeft} label="Volver" onPress={onBack} /> : null}
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    copy: { flex: 1, gap: 3 },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: theme.typography.label,
      fontWeight: '800'
    },
    title: {
      color: theme.colors.text,
      fontSize: theme.typography.headline,
      lineHeight: theme.typography.lineHeight.headline,
      fontWeight: '900'
    },
    subtitle: {
      color: theme.colors.muted,
      fontSize: theme.typography.bodySm,
      lineHeight: theme.typography.lineHeight.bodySm,
      fontWeight: '500'
    },
    action: { minHeight: 48, justifyContent: 'center' }
  });
}
