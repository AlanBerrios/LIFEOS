import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../theme';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps): ReactElement {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    copy: { flex: 1, gap: 2 },
    title: {
      color: theme.colors.text,
      fontSize: theme.typography.titleSm,
      lineHeight: theme.typography.lineHeight.title,
      fontWeight: '800'
    },
    subtitle: {
      color: theme.colors.muted,
      fontSize: theme.typography.bodySm,
      lineHeight: theme.typography.lineHeight.bodySm
    }
  });
}
